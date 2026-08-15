import { Font } from "../fonts/font.js";
import {
  PDFDictionary,
  PDFArray,
  PDFName,
  PDFNumber,
  PDFString,
  PDFIndirectObject,
} from "./pdf-object.js";
import { PDFStream } from "./pdf-stream.js";

export function createPDFType0Font(
  font: Font,
  allocObjNum: () => number,
  compress: boolean = true,
): { fontObj: PDFIndirectObject; auxiliaryObjs: PDFIndirectObject[] } {
  if (!font.isCustom || !font.parsedTTF) {
    throw new Error(`Font ${font.name} is not a custom TTF font.`);
  }

  const ttf = font.parsedTTF;

  // 1. FontFile2 Stream
  const fontFileObjNum = allocObjNum();
  const fontFileStream = new PDFStream(
    ttf.rawBuffer,
    {
      Length1: new PDFNumber(ttf.rawBuffer.length),
    },
    compress,
  );
  const fontFileObj = new PDFIndirectObject(fontFileObjNum, fontFileStream);

  // 2. FontDescriptor
  const descObjNum = allocObjNum();
  const descDict = new PDFDictionary({
    Type: new PDFName("FontDescriptor"),
    FontName: new PDFName(ttf.postScriptName),
    Flags: new PDFNumber(32),
    FontBBox: new PDFArray(ttf.bbox.map((n) => new PDFNumber(n))),
    ItalicAngle: new PDFNumber(0),
    Ascent: new PDFNumber(Math.round((ttf.ascent * 1000) / ttf.unitsPerEm)),
    Descent: new PDFNumber(Math.round((ttf.descent * 1000) / ttf.unitsPerEm)),
    CapHeight: new PDFNumber(Math.round((ttf.ascent * 1000) / ttf.unitsPerEm)),
    StemV: new PDFNumber(80),
    FontFile2: fontFileObj.ref,
  });
  const descObj = new PDFIndirectObject(descObjNum, descDict);

  // 3. CIDFontType2
  const cidObjNum = allocObjNum();
  const widths: PDFNumber[] = [];
  for (let i = 0; i < ttf.numGlyphs; i++) {
    const adv = ttf.hmtx[i] ?? 0;
    const w = Math.round((adv * 1000) / ttf.unitsPerEm);
    widths.push(new PDFNumber(w));
  }

  const cidDict = new PDFDictionary({
    Type: new PDFName("Font"),
    Subtype: new PDFName("CIDFontType2"),
    BaseFont: new PDFName(ttf.postScriptName),
    CIDSystemInfo: new PDFDictionary({
      Registry: new PDFString("Adobe"),
      Ordering: new PDFString("Identity"),
      Supplement: new PDFNumber(0),
    }),
    FontDescriptor: descObj.ref,
    DW: new PDFNumber(1000),
    W: new PDFArray([new PDFNumber(0), new PDFArray(widths)]),
    CIDToGIDMap: new PDFName("Identity"),
  });
  const cidObj = new PDFIndirectObject(cidObjNum, cidDict);

  // 4. ToUnicode CMap Stream
  const toUnicodeObjNum = allocObjNum();
  let cmapText =
    "/CIDInit /ProcSet findresource begin\n" +
    "12 dict begin\n" +
    "begincmap\n" +
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n" +
    "/CMapName /Adobe-Identity-UCS def\n" +
    "/CMapType 2 def\n" +
    "1 begincodespacerange\n" +
    "<0000> <FFFF>\n" +
    "endcodespacerange\n";

  const mappings: { gidHex: string; uHex: string }[] = [];
  for (const [codePoint, gid] of ttf.cmap.entries()) {
    const gidHex = gid.toString(16).padStart(4, "0").toUpperCase();
    const uHex = codePoint.toString(16).padStart(4, "0").toUpperCase();
    mappings.push({ gidHex, uHex });
  }

  const chunkSize = 100;
  for (let i = 0; i < mappings.length; i += chunkSize) {
    const chunk = mappings.slice(i, i + chunkSize);
    cmapText += `${chunk.length} beginbfchar\n`;
    for (const m of chunk) {
      cmapText += `<${m.gidHex}> <${m.uHex}>\n`;
    }
    cmapText += "endbfchar\n";
  }

  cmapText +=
    "endcmap\n" +
    "CMapName currentdict /CMap defineresource pop\n" +
    "end\n" +
    "end\n";

  const cmapBytes = new TextEncoder().encode(cmapText);
  const toUnicodeStream = new PDFStream(cmapBytes, undefined, compress);
  const toUnicodeObj = new PDFIndirectObject(toUnicodeObjNum, toUnicodeStream);

  // 5. Type0 Font
  const type0ObjNum = allocObjNum();
  const type0Dict = new PDFDictionary({
    Type: new PDFName("Font"),
    Subtype: new PDFName("Type0"),
    BaseFont: new PDFName(ttf.postScriptName),
    Encoding: new PDFName("Identity-H"),
    DescendantFonts: new PDFArray([cidObj.ref]),
    ToUnicode: toUnicodeObj.ref,
  });
  const type0Obj = new PDFIndirectObject(type0ObjNum, type0Dict);

  return {
    fontObj: type0Obj,
    auxiliaryObjs: [fontFileObj, descObj, cidObj, toUnicodeObj],
  };
}
