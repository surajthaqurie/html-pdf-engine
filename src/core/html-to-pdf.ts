import * as fs from "fs";
import { HTMLParser } from "../html/parser.js";
import { CSSParser } from "../css/parser.js";
import { LayoutEngine } from "../layout/layout-engine.js";
import { PaintEngine } from "../paint/paint-engine.js";
import {
  PDFDocument,
  PDFMetadataOptions,
  PdfViewerPreferences,
  PdfVersion,
  PageLabelRange,
} from "../pdf/pdf-document.js";
import {
  PageSizeName,
  PageOrientation,
  PageMargins,
  PageSize,
  STANDARD_PAGE_SIZES,
} from "../pdf/pdf-page.js";
import { HeaderFooterOptions } from "../pdf/pdf-header-footer.js";
import {
  CustomFontMap,
  FontManager,
  parseFontFaceRulesFromCss,
} from "../fonts/font.js";
import { ImageMap } from "../pdf/pdf-image.js";
import { PdfError } from "../errors/pdf-error.js";

import { parsePageRules } from "../css/cascade.js";

import { AssetResolver } from "../assets/asset-resolver.js";

/**
 * Options for HTML-to-PDF document compilation.
 */
export interface HtmlToPdfOptions {
  /** Raw HTML string or document markup to render. */
  html: string;
  /** Optional external CSS string to cascade with HTML markup. */
  css?: string;
  /** Page size format (e.g. "A4", "Letter") or custom `{ width, height }` in points. */
  page?: PageSizeName | PageSize;
  /** Page layout orientation. Default is "portrait". */
  orientation?: PageOrientation;
  /** Page margins in points (`pt`). Default is 36pt (0.5 in). */
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  /** Enables FlateDecode stream compression. Default is true. */
  compress?: boolean;
  /** Options for dynamic top page headers. */
  header?: HeaderFooterOptions;
  /** Options for dynamic bottom page footers. */
  footer?: HeaderFooterOptions;
  /**
   * PDF document metadata dictionary options (Title, Author, Subject, Keywords, Creator).
   */
  meta?: PDFMetadataOptions;
  /**
   * Alias for `meta`. Supported for backward compatibility.
   * @deprecated Use `meta` instead.
   */
  metadata?: PDFMetadataOptions;
  /** Document language identifier for PDF Catalog /Lang (e.g. "en-US"). */
  language?: string;
  /** Alias for `language`. */
  lang?: string;
  /** PDF Viewer preferences (HideToolbar, HideMenubar, DisplayDocTitle, FitWindow, etc.). */
  viewerPreferences?: PdfViewerPreferences;
  /** Controlled PDF Specification Version (e.g. "1.7", "1.4"). Default is "1.7". */
  pdfVersion?: PdfVersion;
  /** PDF Page numbering/label ranges (decimal, roman, letters, prefix, start page). */
  pageLabels?: PageLabelRange | PageLabelRange[];
  /** Map of image names/IDs to Buffers or base64 Data URLs. */
  images?: ImageMap;
  /** Map of custom TTF font families to file paths or Buffers. */
  fonts?: CustomFontMap;
  /** Optional base directory path for resolving relative asset URLs and @font-face font files. */
  basePath?: string;
  /** Optional render-scoped asset resolver for remote images or dynamic resources. */
  assetResolver?: AssetResolver;
}

/**
 * Options for generating and writing a PDF document directly to disk.
 */
export interface HtmlToFileOptions extends HtmlToPdfOptions {
  /** Target file system path where the PDF will be written. */
  output: string;
}

export class HtmlToPdf {
  private static htmlParser = new HTMLParser();
  private static cssParser = new CSSParser();

  /**
   * Generates a PDFDocument instance from HTML + CSS
   */
  static async generate(options: HtmlToPdfOptions): Promise<PDFDocument> {
    if (!options || typeof options !== "object") {
      throw new PdfError("Invalid options: Options must be an object.");
    }
    if (typeof options.html !== "string") {
      throw new PdfError("Invalid options: 'html' property must be a string.");
    }

    const fontManager = new FontManager();

    if (options.fonts) {
      fontManager.registerCustomFonts(options.fonts);
    }

    // 1. Parse HTML to DOM
    const dom = this.htmlParser.parse(options.html);

    // 2. Extract Embedded <style> tags from DOM
    let embeddedCss = "";
    const styleElements = dom.querySelectorAll("style");
    for (const styleElem of styleElements) {
      for (const child of styleElem.children) {
        if ("text" in child && typeof (child as any).text === "string") {
          embeddedCss += (child as any).text + "\n";
        }
      }
    }

    const fullCss = `${embeddedCss}\n${options.css ?? ""}`;
    const cssRules = this.cssParser.parse(fullCss);

    const fontFaceRules = parseFontFaceRulesFromCss(cssRules);
    if (fontFaceRules.length > 0) {
      fontManager.registerFontFaceRules(fontFaceRules, options.basePath);
    }

    const pageRuleConfig = parsePageRules(cssRules);

    const pageOpt = options.page ?? pageRuleConfig.pageSize ?? "A4";
    const orientation =
      options.orientation ?? pageRuleConfig.orientation ?? "portrait";

    const margins: PageMargins = {
      top: options.margin?.top ?? pageRuleConfig.margins?.top ?? 36,
      right: options.margin?.right ?? pageRuleConfig.margins?.right ?? 36,
      bottom: options.margin?.bottom ?? pageRuleConfig.margins?.bottom ?? 36,
      left: options.margin?.left ?? pageRuleConfig.margins?.left ?? 36,
    };

    let dimensions: PageSize;

    if (typeof pageOpt === "string") {
      dimensions = STANDARD_PAGE_SIZES[pageOpt] ?? STANDARD_PAGE_SIZES.A4;
    } else {
      dimensions = pageOpt;
    }

    const pageWidth =
      orientation === "landscape"
        ? Math.max(dimensions.width, dimensions.height)
        : Math.min(dimensions.width, dimensions.height);
    const pageHeight =
      orientation === "landscape"
        ? Math.min(dimensions.width, dimensions.height)
        : Math.max(dimensions.width, dimensions.height);

    // 3. Perform Multi-Page Layout Computation
    const layoutEngine = new LayoutEngine(fontManager);
    const layoutBoxes = layoutEngine.layout(
      dom,
      cssRules,
      pageWidth,
      pageHeight,
      margins,
      options.images,
      options.basePath,
      fontManager,
    );

    // 4. Generate Paint Commands & Render onto PDF Pages
    const paintEngine = new PaintEngine(fontManager);
    const paintCommands = paintEngine.generatePaintCommands(layoutBoxes);

    const doc = new PDFDocument();
    if (options.compress !== undefined) doc.setCompress(options.compress);
    if (options.header) doc.setHeader(options.header);
    if (options.footer) doc.setFooter(options.footer);

    const metaOpts = options.meta ?? options.metadata;
    if (metaOpts) doc.setMetadata(metaOpts);

    const langOpt = options.language ?? options.lang;
    if (langOpt) doc.setLanguage(langOpt);

    if (options.viewerPreferences)
      doc.setViewerPreferences(options.viewerPreferences);
    if (options.pdfVersion) doc.setPdfVersion(options.pdfVersion);
    if (options.pageLabels) doc.setPageLabels(options.pageLabels);

    const destinations = (layoutBoxes[0] as any)?.destinations;
    if (destinations) {
      doc.setDestinations(destinations);
    }

    paintEngine.renderToPdf(
      doc,
      paintCommands,
      pageOpt,
      orientation,
      margins,
    );

    return doc;
  }

  /**
   * Generates a Node.js Buffer containing binary PDF output
   */
  static async generateBuffer(options: HtmlToPdfOptions): Promise<Buffer> {
    const doc = await this.generate(options);
    return doc.save();
  }

  /**
   * Generates a PDF file directly on disk
   */
  static async generateFile(options: HtmlToFileOptions): Promise<void> {
    const buffer = await this.generateBuffer(options);
    await fs.promises.writeFile(options.output, buffer);
  }
}
