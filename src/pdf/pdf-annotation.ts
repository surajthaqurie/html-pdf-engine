import {
  PDFDictionary,
  PDFArray,
  PDFName,
  PDFNumber,
  PDFString,
  PDFRef,
  PDFNull,
} from "./pdf-object.js";

/**
 * Normalizes and validates a hyperlink URL or internal anchor reference.
 * Supported schemes: http://, https://, mailto:, tel:, and internal #anchors.
 */
export function normalizeLinkUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("#") && trimmed.length > 1) {
    return trimmed;
  }

  return null;
}

export type LinkTarget =
  | { type: "uri"; uri: string }
  | { type: "goto"; pageRef: PDFRef; pdfX: number; pdfY: number };

/**
 * Represents a PDF Link Annotation (/Subtype /Link).
 */
export class PDFLinkAnnotation {
  constructor(
    /** Rectangle in PDF page coordinates: [llx, lly, urx, ury] */
    public readonly rect: [number, number, number, number],
    /** Target URI or internal GoTo destination */
    public readonly target: LinkTarget,
  ) {}

  get uri(): string | undefined {
    return this.target.type === "uri" ? this.target.uri : undefined;
  }

  toDictionary(): PDFDictionary {
    let actionDict: PDFDictionary;

    if (this.target.type === "uri") {
      actionDict = new PDFDictionary({
        S: new PDFName("URI"),
        URI: new PDFString(this.target.uri),
      });
    } else {
      actionDict = new PDFDictionary({
        S: new PDFName("GoTo"),
        D: new PDFArray([
          this.target.pageRef,
          new PDFName("XYZ"),
          new PDFNumber(this.target.pdfX),
          new PDFNumber(this.target.pdfY),
          new PDFNull(),
        ]),
      });
    }

    return new PDFDictionary({
      Type: new PDFName("Annot"),
      Subtype: new PDFName("Link"),
      Rect: new PDFArray([
        new PDFNumber(this.rect[0]),
        new PDFNumber(this.rect[1]),
        new PDFNumber(this.rect[2]),
        new PDFNumber(this.rect[3]),
      ]),
      Border: new PDFArray([
        new PDFNumber(0),
        new PDFNumber(0),
        new PDFNumber(0),
      ]),
      A: actionDict,
    });
  }
}
