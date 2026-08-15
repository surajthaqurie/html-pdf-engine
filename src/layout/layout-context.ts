import { PageMargins } from "../pdf/pdf-page.js";
import { FontManager } from "../fonts/font.js";
import { CascadeEngine } from "../css/cascade.js";
import { CSSRule } from "../css/parser.js";
import { ImageMap, ParsedImageData } from "../pdf/pdf-image.js";

/**
 * A named position within a PDF document used as an internal navigation target.
 *
 * Destinations are registered during layout (when an element with `id` is encountered)
 * and resolved during PDF serialization (when link annotations are written). The two
 * phases are intentionally separated:
 *
 * - During layout, the engine does not know the final PDF object references (cross-reference
 *   table offsets). Storing destinations as logical (pageIndex, x, y) coordinates decouples
 *   the layout engine from the PDF serialization format.
 * - During serialization (PDFDocument.serialize()), the page object references are known
 *   and `/GoTo` actions can reference them by PDF object ID.
 * - The first-occurrence-wins strategy ensures anchors within repeated content (e.g.,
 *   table headers printed on each page) resolve to the first instance, consistent with
 *   browser behavior for `#anchor` navigation.
 */
export interface PDFDestination {
  name: string;
  pageIndex: number;
  x: number;
  y: number;
}

/**
 * Isolated, render-scoped context holding all state for a single PDF render pass.
 *
 * One LayoutContext is created per `HtmlToPdf.generate()` call. It is never shared
 * across concurrent renders, which is what makes the engine thread-safe:
 * each concurrent caller operates on independent context instances.
 *
 * The context owns:
 *   - Page geometry (width, height, margins, printable area)
 *   - A scoped CascadeEngine instance (with its own font manager reference)
 *   - Parsed CSS rules for the render
 *   - An image cache keyed by source URL/path (prevents re-decoding the same image)
 *   - A destination registry for internal anchor resolution
 */
export class LayoutContext {
  public readonly pageWidth: number;
  public readonly pageHeight: number;
  public readonly margins: PageMargins;
  public readonly printableWidth: number;
  public readonly printableHeight: number;
  public readonly fontManager: FontManager;
  public readonly cascadeEngine: CascadeEngine;
  public readonly cssRules: CSSRule[];
  public readonly imagesMap?: ImageMap | undefined;
  public readonly basePath?: string | undefined;
  public readonly imageCache: Map<string, ParsedImageData> = new Map();
  public readonly destinations: Map<string, PDFDestination> = new Map();

  constructor(options: {
    pageWidth: number;
    pageHeight: number;
    margins: PageMargins;
    cssRules: CSSRule[];
    fontManager: FontManager;
    imagesMap?: ImageMap | undefined;
    basePath?: string | undefined;
  }) {
    this.pageWidth = options.pageWidth;
    this.pageHeight = options.pageHeight;
    this.margins = options.margins;
    this.printableWidth =
      options.pageWidth - options.margins.left - options.margins.right;
    this.printableHeight =
      options.pageHeight - options.margins.top - options.margins.bottom;
    this.fontManager = options.fontManager;
    this.cascadeEngine = new CascadeEngine(options.fontManager);
    this.cssRules = options.cssRules;
    this.imagesMap = options.imagesMap;
    this.basePath = options.basePath;
  }

  /**
   * Registers a named anchor destination at its first occurrence.
   *
   * First-occurrence-wins: if the same anchor `id` appears multiple times
   * (e.g., in a repeated table header), the first registered position is used.
   * This is consistent with how browsers resolve `#anchor` navigation.
   */
  addDestination(name: string, pageIndex: number, x: number, y: number): void {
    const key = name.trim();
    if (!key) return;
    if (!this.destinations.has(key)) {
      this.destinations.set(key, { name: key, pageIndex, x, y });
    }
  }
}
