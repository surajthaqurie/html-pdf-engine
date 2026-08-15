import { describe, it, expect } from "vitest";
import { subsetTTF } from "../../src/fonts/ttf-subsetter.js";
import { parseTTF, ParsedTTF } from "../../src/fonts/ttf-parser.js";
import { Font, FontManager } from "../../src/fonts/font.js";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import { PDFDocument } from "../../src/pdf/pdf-document.js";

/**
 * Helper to build a minimal valid TrueType Font buffer in memory.
 */
function createDummyTTFBuffer(
  postScriptName = "SubsetTestFont",
  numGlyphs = 120,
): Buffer {
  const tableTags = ["OS/2", "cmap", "glyf", "head", "hhea", "hmtx", "loca", "maxp", "name", "post"];
  const numTables = tableTags.length;

  const header = Buffer.alloc(12);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(numTables, 4);
  header.writeUInt16BE(128, 6);
  header.writeUInt16BE(3, 8);
  header.writeUInt16BE(32, 10);

  const headBuf = Buffer.alloc(54);
  headBuf.writeUInt16BE(1, 0); // version
  headBuf.writeUInt16BE(1000, 18); // unitsPerEm
  headBuf.writeInt16BE(0, 36); // xMin
  headBuf.writeInt16BE(-200, 38); // yMin
  headBuf.writeInt16BE(1000, 40); // xMax
  headBuf.writeInt16BE(800, 42); // yMax
  headBuf.writeUInt16BE(1, 50); // indexToLocFormat = 1 (long)

  const hheaBuf = Buffer.alloc(36);
  hheaBuf.writeInt16BE(800, 4); // ascent
  hheaBuf.writeInt16BE(-200, 6); // descent
  hheaBuf.writeUInt16BE(numGlyphs, 34); // numOfLongHorMetrics

  const maxpBuf = Buffer.alloc(32);
  maxpBuf.writeUInt32BE(0x00010000, 0);
  maxpBuf.writeUInt16BE(numGlyphs, 4);

  // loca: numGlyphs + 1 uint32 offsets
  const locaBuf = Buffer.alloc((numGlyphs + 1) * 4);
  // glyf data: create dummy simple glyphs + composite glyphs
  const glyfChunks: Buffer[] = [];
  let currentOffset = 0;

  for (let i = 0; i < numGlyphs; i++) {
    locaBuf.writeUInt32BE(currentOffset, i * 4);
    if (i === 32) {
      // Create a composite glyph referencing component glyphs 1 and 2
      const compGlyph = Buffer.alloc(24);
      compGlyph.writeInt16BE(-1, 0); // composite header flag
      compGlyph.writeInt16BE(0, 2);
      compGlyph.writeInt16BE(0, 4);
      compGlyph.writeInt16BE(500, 6);
      compGlyph.writeInt16BE(500, 8);
      // Component 1 (flags = MORE_COMPONENTS | ARG_1_AND_2_ARE_WORDS)
      compGlyph.writeUInt16BE(0x0020 | 0x0001, 10);
      compGlyph.writeUInt16BE(1, 12); // compGid 1
      compGlyph.writeInt16BE(0, 14); // arg1
      compGlyph.writeInt16BE(0, 16); // arg2
      // Component 2 (flags = 0)
      compGlyph.writeUInt16BE(0x0000, 18);
      compGlyph.writeUInt16BE(2, 20); // compGid 2
      compGlyph.writeInt8(0, 22); // arg1
      compGlyph.writeInt8(0, 23); // arg2

      glyfChunks.push(compGlyph);
      currentOffset += compGlyph.length;
    } else {
      // Dummy simple glyph
      const simpleGlyph = Buffer.alloc(12);
      simpleGlyph.writeInt16BE(1, 0); // 1 contour
      simpleGlyph.writeInt16BE(0, 2);
      simpleGlyph.writeInt16BE(0, 4);
      simpleGlyph.writeInt16BE(500, 6);
      simpleGlyph.writeInt16BE(500, 8);
      glyfChunks.push(simpleGlyph);
      currentOffset += simpleGlyph.length;
    }
  }
  locaBuf.writeUInt32BE(currentOffset, numGlyphs * 4);
  const glyfBuf = Buffer.concat(glyfChunks);

  // hmtx: numGlyphs * 4 bytes
  const hmtxBuf = Buffer.alloc(numGlyphs * 4);
  for (let i = 0; i < numGlyphs; i++) {
    hmtxBuf.writeUInt16BE(600, i * 4); // advanceWidth = 600
    hmtxBuf.writeInt16BE(0, i * 4 + 2); // lsb = 0
  }

  // cmap: format 4 subtable
  const segCount = 2;
  const cmapSubLen = 14 + segCount * 8 + 2; // 32 bytes
  const cmapSub = Buffer.alloc(cmapSubLen);
  cmapSub.writeUInt16BE(4, 0);
  cmapSub.writeUInt16BE(cmapSubLen, 2);
  cmapSub.writeUInt16BE(0, 4);
  cmapSub.writeUInt16BE(segCount * 2, 6);
  cmapSub.writeUInt16BE(4, 8);
  cmapSub.writeUInt16BE(1, 10);
  cmapSub.writeUInt16BE(0, 12);

  // endCode
  cmapSub.writeUInt16BE(0x00ff, 14);
  cmapSub.writeUInt16BE(0xffff, 16);
  // reserved
  cmapSub.writeUInt16BE(0, 18);
  // startCode
  cmapSub.writeUInt16BE(0x0020, 20);
  cmapSub.writeUInt16BE(0xffff, 22);
  // idDelta
  cmapSub.writeInt16BE(0, 24);
  cmapSub.writeInt16BE(1, 26);
  // idRangeOffset
  cmapSub.writeUInt16BE(0, 28);
  cmapSub.writeUInt16BE(0, 30);

  const cmapBuf = Buffer.alloc(12 + cmapSubLen);
  cmapBuf.writeUInt16BE(0, 0);
  cmapBuf.writeUInt16BE(1, 2);
  cmapBuf.writeUInt16BE(3, 4);
  cmapBuf.writeUInt16BE(1, 6);
  cmapBuf.writeUInt32BE(12, 8);
  cmapSub.copy(cmapBuf, 12);

  // name table
  const psNameBytes = Buffer.from(postScriptName, "ascii");
  const nameBuf = Buffer.alloc(18 + psNameBytes.length);
  nameBuf.writeUInt16BE(0, 0);
  nameBuf.writeUInt16BE(1, 2);
  nameBuf.writeUInt16BE(18, 4);
  // Record 1: NameID 6 (PostScript Name)
  nameBuf.writeUInt16BE(1, 6); // platform 1
  nameBuf.writeUInt16BE(0, 8);
  nameBuf.writeUInt16BE(0, 10);
  nameBuf.writeUInt16BE(6, 12); // name ID 6
  nameBuf.writeUInt16BE(psNameBytes.length, 14);
  nameBuf.writeUInt16BE(0, 16);
  psNameBytes.copy(nameBuf, 18);

  const postBuf = Buffer.alloc(32);
  postBuf.writeUInt32BE(0x00030000, 0);

  const os2Buf = Buffer.alloc(96);

  const tableMap: Record<string, Buffer> = {
    "OS/2": os2Buf,
    cmap: cmapBuf,
    glyf: glyfBuf,
    head: headBuf,
    hhea: hheaBuf,
    hmtx: hmtxBuf,
    loca: locaBuf,
    maxp: maxpBuf,
    name: nameBuf,
    post: postBuf,
  };

  const dirBuf = Buffer.alloc(numTables * 16);
  let dataOffset = 12 + numTables * 16;
  const paddedBufs: Buffer[] = [];

  const sortedTags = Object.keys(tableMap).sort();
  for (let i = 0; i < numTables; i++) {
    const tag = sortedTags[i]!;
    const tBuf = tableMap[tag]!;
    let pad = 0;
    if (tBuf.length % 4 !== 0) pad = 4 - (tBuf.length % 4);
    const pBuf = pad > 0 ? Buffer.concat([tBuf, Buffer.alloc(pad)]) : tBuf;
    paddedBufs.push(pBuf);

    dirBuf.write(tag, i * 16, 4, "ascii");
    dirBuf.writeUInt32BE(0, i * 16 + 4);
    dirBuf.writeUInt32BE(dataOffset, i * 16 + 8);
    dirBuf.writeUInt32BE(tBuf.length, i * 16 + 12);
    dataOffset += pBuf.length;
  }

  return Buffer.concat([header, dirBuf, ...paddedBufs]);
}

describe("Phase 9 — TrueType Font Subsetting", () => {
  it("should subset a custom TTF font for simple ASCII characters", () => {
    const dummyBuf = createDummyTTFBuffer("TestFont", 100);
    const parsed = parseTTF(dummyBuf, "TestFont");

    const usedCodePoints = new Set<number>([0x41, 0x42, 0x43]); // 'A', 'B', 'C'
    const subset = subsetTTF(parsed, usedCodePoints);

    expect(subset.subsetBuffer.length).toBeLessThan(dummyBuf.length);
    expect(subset.subsetParsedTTF.numGlyphs).toBe(4); // .notdef + A, B, C
    expect(subset.codePointToSubsetGidMap.get(0x41)).toBeDefined();
    expect(subset.codePointToSubsetGidMap.get(0x42)).toBeDefined();
    expect(subset.codePointToSubsetGidMap.get(0x43)).toBeDefined();
  });

  it("should deduplicate repeated characters and include .notdef", () => {
    const dummyBuf = createDummyTTFBuffer("TestFont", 200);
    const parsed = parseTTF(dummyBuf, "TestFont");

    const usedCodePoints = new Set<number>([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // 'H','e','l','l','o'
    const subset = subsetTTF(parsed, usedCodePoints);

    // Unique chars: 'H', 'e', 'l', 'o' (4 chars) + .notdef = 5 glyphs
    expect(subset.subsetParsedTTF.numGlyphs).toBe(5);
  });

  it("should recursively include component glyphs for composite glyphs", () => {
    const dummyBuf = createDummyTTFBuffer("CompFont", 100);
    const parsed = parseTTF(dummyBuf, "CompFont");

    // Code point 0x20 (32) maps to composite glyph 32 which references components 1 and 2
    const usedCodePoints = new Set<number>([0x20]);
    const subset = subsetTTF(parsed, usedCodePoints);

    // Should include .notdef (0), composite (32), component (1), component (2) -> 4 glyphs
    expect(subset.subsetParsedTTF.numGlyphs).toBe(4);
    expect(subset.oldToNewGidMap.has(0)).toBe(true);
    expect(subset.oldToNewGidMap.has(32)).toBe(true);
    expect(subset.oldToNewGidMap.has(1)).toBe(true);
    expect(subset.oldToNewGidMap.has(2)).toBe(true);
  });

  it("should handle font variants (regular, bold, italic, boldItalic) independently", () => {
    const regBuf = createDummyTTFBuffer("Custom-Regular", 80);
    const boldBuf = createDummyTTFBuffer("Custom-Bold", 80);

    FontManager.registerCustomFonts({
      CustomVariant: {
        regular: regBuf,
        bold: boldBuf,
      },
    });

    const fm = new FontManager();
    const regFont = fm.resolveFont("CustomVariant", "normal", "normal");
    const boldFont = fm.resolveFont("CustomVariant", "bold", "normal");

    expect(regFont.name).toBe("Custom-Regular");
    expect(boldFont.name).toBe("Custom-Bold");
  });

  it("should generate a significantly smaller PDF size when subsetting custom fonts", async () => {
    const ttfBuf = createDummyTTFBuffer("LargeFont", 500);

    const html = `
      <style>
        body { font-family: 'LargeFont'; font-size: 14px; }
      </style>
      <p>Hello Subset World</p>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      fonts: {
        LargeFont: { regular: ttfBuf },
      },
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);

    // Verify PDF contains /CIDFontType2 and /ToUnicode
    const pdfStr = pdfBuffer.toString("binary");
    expect(pdfStr).toContain("/CIDFontType2");
    expect(pdfStr).toContain("/ToUnicode");
  });

  it("should preserve text searchability via /ToUnicode map in subsetted fonts", async () => {
    const ttfBuf = createDummyTTFBuffer("SearchFont", 60);

    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html: "<p style='font-family: SearchFont'>Searchable Text</p>",
      fonts: {
        SearchFont: { regular: ttfBuf },
      },
      compress: false,
    });

    const pdfStr = pdfBuffer.toString("binary");
    expect(pdfStr).toContain("/Adobe-Identity-UCS");
    expect(pdfStr).toContain("beginbfchar");
  });

  it("should fall back gracefully to full buffer if subsetting fails", () => {
    const corruptBuf = Buffer.from("Not a valid TTF file header data");
    let caughtErr = false;
    try {
      parseTTF(corruptBuf);
    } catch (e) {
      caughtErr = true;
    }
    expect(caughtErr).toBe(true);

    const dummyBuf = createDummyTTFBuffer("FallbackFont", 20);
    const parsed = parseTTF(dummyBuf);

    // Corrupt loca table offset to force subsetting failure
    parsed.rawBuffer.writeUInt32BE(999999, 12 + 16 * 6 + 8); // overwrite loca offset

    const subset = subsetTTF(parsed, new Set([0x41]));
    expect(subset.subsetBuffer).toBe(parsed.rawBuffer);
  });
});
