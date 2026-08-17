import { PDFContentStream, ColorRGB } from "./pdf-content.js";
import { PDFLinkAnnotation, LinkTarget } from "./pdf-annotation.js";
import {
  PDFDictionary,
  PDFArray,
  PDFName,
  PDFNumber,
  PDFRef,
} from "./pdf-object.js";
import {
  STANDARD_PAGE_DIMENSIONS,
  DEFAULT_PAGE_MARGINS,
} from "../constants/page.js";
import { FontManager } from "../fonts/font.js";

export type PageSizeName =
  | "A0"
  | "A1"
  | "A2"
  | "A3"
  | "A4"
  | "A5"
  | "A6"
  | "B4"
  | "B5"
  | "Letter"
  | "Legal"
  | "Tabloid"
  | "Ledger"
  | "Executive";

export type PageOrientation = "portrait" | "landscape";

export interface PageSize {
  width: number; // in points
  height: number; // in points
}

export const STANDARD_PAGE_SIZES = STANDARD_PAGE_DIMENSIONS;

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export class PDFPage {
  public readonly width: number;
  public readonly height: number;
  public readonly contentStream: PDFContentStream;
  public readonly annotations: PDFLinkAnnotation[] = [];

  constructor(
    pageSize: PageSizeName | PageSize = "A4",
    orientation: PageOrientation = "portrait",
    public readonly margins: PageMargins = DEFAULT_PAGE_MARGINS,
  ) {
    let size: PageSize;
    if (typeof pageSize === "string") {
      size = STANDARD_PAGE_SIZES[pageSize] || STANDARD_PAGE_SIZES.A4;
    } else {
      size = pageSize;
    }

    if (orientation === "landscape") {
      this.width = Math.max(size.width, size.height);
      this.height = Math.min(size.width, size.height);
    } else {
      this.width = Math.min(size.width, size.height);
      this.height = Math.max(size.width, size.height);
    }

    this.contentStream = new PDFContentStream();
  }

  /**
   * Converts HTML top-left (x, y) to PDF bottom-left (x_pdf, y_pdf)
   */
  toPdfCoordinates(
    x: number,
    y: number,
    itemHeight: number = 0,
  ): { x: number; y: number } {
    return {
      x: x,
      y: this.height - y - itemHeight,
    };
  }

  addRawOp(code: string): void {
    this.contentStream.addRawOp(code);
  }

  /**
   * High-level helper to draw text using top-left HTML origin (or direct PDF origin if specified)
   */
  drawText(
    text: string,
    x: number,
    y: number,
    options: {
      fontAlias?: string | undefined;
      fontName?: string | undefined;
      fontSize?: number | undefined;
      color?: ColorRGB | undefined;
      useHtmlCoordinates?: boolean | undefined;
      isHex?: boolean | undefined;
      letterSpacing?: number | undefined;
      wordSpacing?: number | undefined;
    } = {},
  ): void {
    const fontAlias = options.fontAlias ?? "F1";
    const fontSize = options.fontSize ?? 12;
    const useHtmlCoords = options.useHtmlCoordinates ?? true;
    const color = options.color ?? { r: 0, g: 0, b: 0 };
    const isHex = options.isHex ?? false;
    const letterSpacing = options.letterSpacing ?? 0;
    const wordSpacing = options.wordSpacing ?? 0;

    let pdfX = x;
    let pdfY = y;

    if (useHtmlCoords) {
      // In HTML, y is the top of text box.
      let ascent = fontSize * 0.8;
      if (options.fontName) {
        const font = new FontManager().getFont(options.fontName);
        ascent = font.getAscent(fontSize);
      }
      pdfY = this.height - y - ascent;
    }

    this.contentStream.setFillColor(color);
    if (isHex) {
      this.contentStream.drawTextHex(
        text,
        fontAlias,
        fontSize,
        pdfX,
        pdfY,
        letterSpacing,
        wordSpacing,
      );
    } else if (options.fontName) {
      const font = new FontManager().getFont(options.fontName);
      if (font.isCustom) {
        this.contentStream.drawCustomText({
          text,
          fontName: options.fontName,
          fontAlias,
          fontSize,
          x: pdfX,
          y: pdfY,
          letterSpacing,
          wordSpacing,
        });
      } else {
        this.contentStream.drawText(
          text,
          fontAlias,
          fontSize,
          pdfX,
          pdfY,
          letterSpacing,
          wordSpacing,
        );
      }
    } else {
      this.contentStream.drawText(
        text,
        fontAlias,
        fontSize,
        pdfX,
        pdfY,
        letterSpacing,
        wordSpacing,
      );
    }
  }

  /**
   * High-level helper to draw rectangle using top-left HTML origin
   */
  drawRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      fillColor?: ColorRGB | undefined;
      strokeColor?: ColorRGB | undefined;
      lineWidth?: number | undefined;
      useHtmlCoordinates?: boolean | undefined;
      radii?:
        | {
            topLeft: number;
            topRight: number;
            bottomRight: number;
            bottomLeft: number;
          }
        | undefined;
    } = {},
  ): void {
    const useHtmlCoords = options.useHtmlCoordinates ?? true;
    let pdfX = x;
    let pdfY = y;

    if (useHtmlCoords) {
      pdfY = this.height - y - height;
    }

    if (options.lineWidth !== undefined) {
      this.contentStream.setLineWidth(options.lineWidth);
    }
    if (options.strokeColor) {
      this.contentStream.setStrokeColor(options.strokeColor);
    }
    if (options.fillColor) {
      this.contentStream.setFillColor(options.fillColor);
    }

    this.contentStream.drawRectangle(
      pdfX,
      pdfY,
      width,
      height,
      !!options.fillColor,
      !!options.strokeColor,
      options.radii,
    );
  }

  /**
   * High-level helper to draw a line
   */
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: {
      strokeColor?: ColorRGB | undefined;
      lineWidth?: number | undefined;
      useHtmlCoordinates?: boolean | undefined;
      lineStyle?: string | undefined;
    } = {},
  ): void {
    const useHtmlCoords = options.useHtmlCoordinates ?? true;
    let pdfY1 = y1;
    let pdfY2 = y2;

    if (useHtmlCoords) {
      pdfY1 = this.height - y1;
      pdfY2 = this.height - y2;
    }

    if (options.lineWidth !== undefined) {
      this.contentStream.setLineWidth(options.lineWidth);
    }
    if (options.strokeColor) {
      this.contentStream.setStrokeColor(options.strokeColor);
    }

    this.contentStream.drawLine(
      x1,
      pdfY1,
      x2,
      pdfY2,
      options.lineStyle,
      options.lineWidth ?? 1,
    );
  }

  /**
   * High-level helper to draw an image using top-left HTML origin
   */
  drawImage(
    alias: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      useHtmlCoordinates?: boolean;
    } = {},
  ): void {
    const useHtmlCoords = options.useHtmlCoordinates ?? true;
    let pdfX = x;
    let pdfY = y;

    if (useHtmlCoords) {
      pdfY = this.height - y - height;
    }

    this.contentStream.drawImage(alias, pdfX, pdfY, width, height);
  }

  private readonly clipStack: Array<[number, number, number, number]> = [];

  startClip(
    x: number,
    y: number,
    width: number,
    height: number,
    useHtmlCoordinates = true,
    radii?: {
      topLeft: number;
      topRight: number;
      bottomRight: number;
      bottomLeft: number;
    },
  ): void {
    let pdfX = x;
    let pdfY = y;
    if (useHtmlCoordinates) {
      pdfY = this.height - y - height;
    }
    this.clipStack.push([pdfX, pdfY, pdfX + width, pdfY + height]);
    this.contentStream.startClip(pdfX, pdfY, width, height, radii);
  }

  endClip(): void {
    if (this.clipStack.length > 0) {
      this.clipStack.pop();
    }
    this.contentStream.endClip();
  }

  /**
   * Helper to add a link annotation to the page
   */
  addLinkAnnotation(
    x: number,
    y: number,
    width: number,
    height: number,
    target: LinkTarget | string,
    useHtmlCoordinates: boolean = true,
  ): void {
    let pdfX1 = x;
    let pdfY1 = y;
    let pdfX2 = x + width;
    let pdfY2 = y + height;

    if (useHtmlCoordinates) {
      pdfY1 = this.height - y - height;
      pdfY2 = this.height - y;
    }

    let rect: [number, number, number, number] = [pdfX1, pdfY1, pdfX2, pdfY2];

    for (const clip of this.clipStack) {
      const cx1 = Math.max(rect[0], clip[0]);
      const cy1 = Math.max(rect[1], clip[1]);
      const cx2 = Math.min(rect[2], clip[2]);
      const cy2 = Math.min(rect[3], clip[3]);

      if (cx1 >= cx2 || cy1 >= cy2) {
        // Completely clipped out!
        return;
      }
      rect = [cx1, cy1, cx2, cy2];
    }

    const linkTarget: LinkTarget =
      typeof target === "string" ? { type: "uri", uri: target } : target;

    this.annotations.push(new PDFLinkAnnotation(rect, linkTarget));
  }

  toDictionary(
    parentRef: PDFRef,
    resourceRef: PDFRef,
    contentStreamRef: PDFRef,
    annotsRef?: PDFRef[],
  ): PDFDictionary {
    const dict = new PDFDictionary({
      Type: new PDFName("Page"),
      Parent: parentRef,
      MediaBox: new PDFArray([
        new PDFNumber(0),
        new PDFNumber(0),
        new PDFNumber(this.width),
        new PDFNumber(this.height),
      ]),
      Resources: resourceRef,
      Contents: contentStreamRef,
    });

    if (annotsRef && annotsRef.length > 0) {
      dict.set("Annots", new PDFArray(annotsRef));
    }

    return dict;
  }
}
