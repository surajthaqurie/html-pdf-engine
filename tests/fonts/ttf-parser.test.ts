import { describe, test, expect } from "vitest";
import { parseTTF } from "../../src/fonts/ttf-parser.js";
import { Font, FontManager } from "../../src/fonts/font.js";

/**
 * Constructs a minimal valid TTF font buffer in memory for testing
 */
export function createMinimalTTFBuffer(postScriptName = "TestFont-Regular"): Buffer {
  const headData = Buffer.alloc(54);
  headData.writeUInt16BE(1000, 18); // unitsPerEm
  headData.writeInt16BE(0, 36); // xMin
  headData.writeInt16BE(-200, 38); // yMin
  headData.writeInt16BE(1000, 40); // xMax
  headData.writeInt16BE(800, 42); // yMax

  const hheaData = Buffer.alloc(36);
  hheaData.writeInt16BE(800, 4); // ascent
  hheaData.writeInt16BE(-200, 6); // descent
  hheaData.writeUInt16BE(2, 34); // numOfLongHorMetrics

  const maxpData = Buffer.alloc(32);
  maxpData.writeUInt16BE(2, 4); // numGlyphs = 2

  const hmtxData = Buffer.alloc(8);
  hmtxData.writeUInt16BE(500, 0); // glyph 0 advance = 500
  hmtxData.writeInt16BE(0, 2);
  hmtxData.writeUInt16BE(600, 4); // glyph 1 ('A') advance = 600
  hmtxData.writeInt16BE(0, 6);

  // Minimal CMap format 4 (segCount = 2)
  const cmapSub = Buffer.alloc(32);
  cmapSub.writeUInt16BE(4, 0); // format 4
  cmapSub.writeUInt16BE(32, 2); // length
  cmapSub.writeUInt16BE(4, 6); // segCountX2 = 4 (segCount = 2)
  // endCount: [0x0041, 0xFFFF]
  cmapSub.writeUInt16BE(0x0041, 14);
  cmapSub.writeUInt16BE(0xffff, 16);
  // pad = 0 (18..19)
  // startCount: [0x0041, 0xFFFF]
  cmapSub.writeUInt16BE(0x0041, 20);
  cmapSub.writeUInt16BE(0xffff, 22);
  // idDelta: [1 - 0x0041, 0] -> (0x0041 + delta) = 1
  const delta = (1 - 0x0041) & 0xffff;
  cmapSub.writeInt16BE(delta > 0x7fff ? delta - 0x10000 : delta, 24);
  cmapSub.writeInt16BE(0, 26);
  // idRangeOffset: [0, 0]
  cmapSub.writeUInt16BE(0, 28);
  cmapSub.writeUInt16BE(0, 30);

  const cmapData = Buffer.alloc(12 + cmapSub.length);
  cmapData.writeUInt16BE(0, 0); // version
  cmapData.writeUInt16BE(1, 2); // numSubtables = 1
  cmapData.writeUInt16BE(3, 4); // platformID 3
  cmapData.writeUInt16BE(1, 6); // encodingID 1
  cmapData.writeUInt32BE(12, 8); // offset to subtable
  cmapSub.copy(cmapData, 12);

  // Minimal Name table
  const psNameBuf = Buffer.from(postScriptName, "ascii");
  const nameSub = Buffer.alloc(6 + 12 + psNameBuf.length);
  nameSub.writeUInt16BE(0, 0); // format
  nameSub.writeUInt16BE(1, 2); // count = 1
  nameSub.writeUInt16BE(18, 4); // stringOffset
  nameSub.writeUInt16BE(1, 6); // platformID 1 (ASCII)
  nameSub.writeUInt16BE(0, 8);
  nameSub.writeUInt16BE(0, 10);
  nameSub.writeUInt16BE(6, 12); // nameID 6 (PostScript Name)
  nameSub.writeUInt16BE(psNameBuf.length, 14);
  nameSub.writeUInt16BE(0, 16);
  psNameBuf.copy(nameSub, 18);

  const tables = [
    { tag: "head", buf: headData },
    { tag: "hhea", buf: hheaData },
    { tag: "maxp", buf: maxpData },
    { tag: "hmtx", buf: hmtxData },
    { tag: "cmap", buf: cmapData },
    { tag: "name", buf: nameSub },
  ];

  let offset = 12 + tables.length * 16;
  const tableHeaders: Buffer[] = [];

  for (const t of tables) {
    const th = Buffer.alloc(16);
    th.write(t.tag, 0, 4, "ascii");
    th.writeUInt32BE(0, 4); // checksum
    th.writeUInt32BE(offset, 8);
    th.writeUInt32BE(t.buf.length, 12);
    tableHeaders.push(th);
    offset += t.buf.length;
  }

  const header = Buffer.alloc(12);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(tables.length, 4);

  return Buffer.concat([header, ...tableHeaders, ...tables.map((t) => t.buf)]);
}

describe("TTF Font Parser", () => {
  test("parses minimal TTF buffer correctly", () => {
    const buf = createMinimalTTFBuffer("CustomInter-Regular");
    const parsed = parseTTF(buf);

    expect(parsed.postScriptName).toBe("CustomInter-Regular");
    expect(parsed.unitsPerEm).toBe(1000);
    expect(parsed.ascent).toBe(800);
    expect(parsed.descent).toBe(-200);
    expect(parsed.numGlyphs).toBe(2);
    expect(parsed.cmap.get(0x0041)).toBe(1); // 'A' -> glyph ID 1
    expect(parsed.hmtx[1]).toBe(600); // Glyph 1 advance = 600
  });

  test("Font class uses custom TTF metrics for text measurement", () => {
    const buf = createMinimalTTFBuffer("CustomInter-Regular");
    const parsed = parseTTF(buf);
    const font = new Font("CustomInter-Regular", parsed);

    expect(font.isCustom).toBe(true);
    expect(font.charToGid(0x0041)).toBe(1);
    expect(font.getCharWidth(0x0041)).toBe(600); // 600 em units

    // At font size 12pt, width of 'A' (600 em) is (600 * 12) / 1000 = 7.2pt
    expect(font.measureTextWidth("A", 12)).toBe(7.2);
  });
});
