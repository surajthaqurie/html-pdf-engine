import { ColorRGB } from "./pdf-content.js";
import { PDFPage } from "./pdf-page.js";
import { FontManager } from "../fonts/font.js";

export type HeaderFooterTextResolver = (
  pageNumber: number,
  totalPages: number,
) => string;

export interface HeaderFooterOptions {
  /**
   * Template string supporting {{pageNumber}} and {{totalPages}}, or a resolver function.
   * Example: "Page {{pageNumber}} of {{totalPages}}"
   */
  text?: string | HeaderFooterTextResolver;
  align?: "left" | "center" | "right";
  fontSize?: number;
  fontName?: string;
  color?: ColorRGB;
  showDividerLine?: boolean;
  dividerColor?: ColorRGB;
  dividerWidth?: number;
  /**
   * Offset from edge of page in points (defaults: header top offset = 20pt, footer bottom offset = 20pt)
   */
  offset?: number;
}

export interface HeaderFooterConfig {
  header?: HeaderFooterOptions | undefined;
  footer?: HeaderFooterOptions | undefined;
}

export class HeaderFooterRenderer {
  private fontManager = new FontManager();

  /**
   * Renders header and footer on a specific page
   */
  renderHeaderAndFooter(
    page: PDFPage,
    pageNumber: number,
    totalPages: number,
    config: HeaderFooterConfig,
  ): void {
    if (config.header) {
      this.renderHeader(page, pageNumber, totalPages, config.header);
    }
    if (config.footer) {
      this.renderFooter(page, pageNumber, totalPages, config.footer);
    }
  }

  private resolveText(
    textOption: string | HeaderFooterTextResolver | undefined,
    pageNumber: number,
    totalPages: number,
  ): string {
    if (!textOption) return "";
    if (typeof textOption === "function") {
      return textOption(pageNumber, totalPages);
    }
    return textOption
      .replace(/\{\{\s*pageNumber\s*\}\}/g, pageNumber.toString())
      .replace(/\{\{\s*totalPages\s*\}\}/g, totalPages.toString());
  }

  private calculateX(
    textWidth: number,
    pageWidth: number,
    leftMargin: number,
    rightMargin: number,
    align: "left" | "center" | "right",
  ): number {
    const printableWidth = pageWidth - leftMargin - rightMargin;
    if (align === "center") {
      return leftMargin + (printableWidth - textWidth) / 2;
    }
    if (align === "right") {
      return pageWidth - rightMargin - textWidth;
    }
    return leftMargin;
  }

  private renderHeader(
    page: PDFPage,
    pageNumber: number,
    totalPages: number,
    options: HeaderFooterOptions,
  ): void {
    const text = this.resolveText(options.text, pageNumber, totalPages);
    const fontName = options.fontName ?? "Helvetica";
    const fontSize = options.fontSize ?? 9;
    const font = this.fontManager.getFont(fontName);
    const color = options.color ?? { r: 0.4, g: 0.4, b: 0.4 };
    const align = options.align ?? "center";
    const offset = options.offset ?? 20;

    if (text) {
      const textWidth = font.measureTextWidth(text, fontSize);
      const x = this.calculateX(
        textWidth,
        page.width,
        page.margins.left,
        page.margins.right,
        align,
      );
      // Header y in HTML coordinates (from top of page)
      const y = offset;

      page.drawText(text, x, y, {
        fontAlias: "F1",
        fontName: font.name,
        fontSize,
        color,
        useHtmlCoordinates: true,
      });
    }

    if (options.showDividerLine) {
      const lineY = page.margins.top;
      const dividerColor = options.dividerColor ?? { r: 0.8, g: 0.8, b: 0.8 };
      const lineWidth = options.dividerWidth ?? 0.5;

      page.drawLine(
        page.margins.left,
        lineY,
        page.width - page.margins.right,
        lineY,
        {
          strokeColor: dividerColor,
          lineWidth,
          useHtmlCoordinates: true,
        },
      );
    }
  }

  private renderFooter(
    page: PDFPage,
    pageNumber: number,
    totalPages: number,
    options: HeaderFooterOptions,
  ): void {
    const text = this.resolveText(options.text, pageNumber, totalPages);
    const fontName = options.fontName ?? "Helvetica";
    const fontSize = options.fontSize ?? 9;
    const font = this.fontManager.getFont(fontName);
    const color = options.color ?? { r: 0.4, g: 0.4, b: 0.4 };
    const align = options.align ?? "center";
    const offset = options.offset ?? 20;

    if (options.showDividerLine) {
      const lineY = page.height - page.margins.bottom;
      const dividerColor = options.dividerColor ?? { r: 0.8, g: 0.8, b: 0.8 };
      const lineWidth = options.dividerWidth ?? 0.5;

      page.drawLine(
        page.margins.left,
        lineY,
        page.width - page.margins.right,
        lineY,
        {
          strokeColor: dividerColor,
          lineWidth,
          useHtmlCoordinates: true,
        },
      );
    }

    if (text) {
      const textWidth = font.measureTextWidth(text, fontSize);
      const x = this.calculateX(
        textWidth,
        page.width,
        page.margins.left,
        page.margins.right,
        align,
      );
      // Footer y in HTML coordinates (from top of page)
      const y = page.height - offset;

      page.drawText(text, x, y, {
        fontAlias: "F1",
        fontName: font.name,
        fontSize,
        color,
        useHtmlCoordinates: true,
      });
    }
  }
}
