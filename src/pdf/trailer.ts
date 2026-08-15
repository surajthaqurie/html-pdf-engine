import { PDFDictionary, PDFNumber, PDFRef } from "./pdf-object.js";

export class PDFTrailer {
  constructor(
    public readonly size: number,
    public readonly rootRef: PDFRef,
    public readonly infoRef?: PDFRef,
  ) {}

  toBytes(startXRefOffset: number): Uint8Array {
    const dict = new PDFDictionary({
      Size: new PDFNumber(this.size),
      Root: this.rootRef,
    });
    if (this.infoRef) {
      dict.set("Info", this.infoRef);
    }

    const str = `trailer\n${dict.toString()}\nstartxref\n${startXRefOffset}\n%%EOF\n`;
    return new TextEncoder().encode(str);
  }
}
