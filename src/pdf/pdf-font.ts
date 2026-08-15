import { PDFDictionary, PDFName } from "./pdf-object.js";

export class PDFFont {
  public readonly dictionary: PDFDictionary;

  constructor(
    public readonly pdfFontName: string, // e.g. "F1"
    public readonly baseFont: string, // e.g. "Helvetica"
  ) {
    this.dictionary = new PDFDictionary({
      Type: new PDFName("Font"),
      Subtype: new PDFName("Type1"),
      BaseFont: new PDFName(baseFont),
      Encoding: new PDFName("WinAnsiEncoding"),
    });
  }
}
