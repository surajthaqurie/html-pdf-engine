import * as zlib from "zlib";
import { PDFDictionary, PDFNumber, PDFName } from "./pdf-object.js";

const ENCODER = new TextEncoder();
const STREAM_HEADER = new Uint8Array([10, 115, 116, 114, 101, 97, 109, 10]); // \nstream\n
const STREAM_FOOTER = new Uint8Array([10, 101, 110, 100, 115, 116, 114, 101, 97, 109]); // \nendstream

export class PDFStream {
  public readonly dictionary: PDFDictionary;
  public readonly content: Uint8Array;

  constructor(
    content: Uint8Array | string,
    dictionaryEntries?: Record<string, any>,
    compress: boolean = true,
  ) {
    const rawContent =
      typeof content === "string" ? ENCODER.encode(content) : content;

    if (compress && rawContent.length > 32) {
      try {
        const compressed = zlib.deflateSync(Buffer.from(rawContent));
        this.content = new Uint8Array(compressed);
        this.dictionary = new PDFDictionary(dictionaryEntries);
        this.dictionary.set("Filter", new PDFName("FlateDecode"));
      } catch {
        this.content = rawContent;
        this.dictionary = new PDFDictionary(dictionaryEntries);
      }
    } else {
      this.content = rawContent;
      this.dictionary = new PDFDictionary(dictionaryEntries);
    }

    this.dictionary.set("Length", new PDFNumber(this.content.length));
  }

  toBytes(): Uint8Array {
    const dictBytes = this.dictionary.toBytes();

    const totalLength =
      dictBytes.length +
      STREAM_HEADER.length +
      this.content.length +
      STREAM_FOOTER.length;
    const result = new Uint8Array(totalLength);

    let offset = 0;
    result.set(dictBytes, offset);
    offset += dictBytes.length;

    result.set(STREAM_HEADER, offset);
    offset += STREAM_HEADER.length;

    result.set(this.content, offset);
    offset += this.content.length;

    result.set(STREAM_FOOTER, offset);

    return result;
  }
}
