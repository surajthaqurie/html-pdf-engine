import { ParsedTTF, parseTTF } from "./ttf-parser.js";
import { FontError } from "../errors/pdf-error.js";

export interface SubsetItem {
  subsetBuffer: Buffer;
  subsetParsedTTF: ParsedTTF;
  oldToNewGidMap: Map<number, number>;
  codePointToSubsetGidMap: Map<number, number>;
}

/**
 * Subsets a parsed TrueType font to include only the specified used code points.
 * Falls back to original buffer if subsetting cannot be safely completed.
 */
export function subsetTTF(
  parsedTTF: ParsedTTF,
  usedCodePoints: Set<number>,
): SubsetItem {
  try {
    return createTTFSubset(parsedTTF, usedCodePoints);
  } catch (e) {
    // Fallback: Return original TTF if subsetting encounters an unexpected error
    const codePointToSubsetGidMap = new Map<number, number>();
    const oldToNewGidMap = new Map<number, number>();

    for (let g = 0; g < parsedTTF.numGlyphs; g++) {
      oldToNewGidMap.set(g, g);
    }
    for (const [cp, gid] of parsedTTF.cmap.entries()) {
      codePointToSubsetGidMap.set(cp, gid);
    }

    return {
      subsetBuffer: parsedTTF.rawBuffer,
      subsetParsedTTF: parsedTTF,
      oldToNewGidMap,
      codePointToSubsetGidMap,
    };
  }
}

function createTTFSubset(
  parsedTTF: ParsedTTF,
  usedCodePoints: Set<number>,
): SubsetItem {
  const rawBuffer = parsedTTF.rawBuffer;
  const numTables = rawBuffer.readUInt16BE(4);
  const tables: Record<string, { offset: number; length: number }> = {};

  let tableOffset = 12;
  for (let i = 0; i < numTables; i++) {
    if (tableOffset + 16 > rawBuffer.length) break;
    const tag = rawBuffer.toString("ascii", tableOffset, tableOffset + 4);
    const offset = rawBuffer.readUInt32BE(tableOffset + 8);
    const length = rawBuffer.readUInt32BE(tableOffset + 12);
    tables[tag] = { offset, length };
    tableOffset += 16;
  }

  const headTable = tables["head"];
  const hheaTable = tables["hhea"];
  const maxpTable = tables["maxp"];
  const locaTable = tables["loca"];
  const glyfTable = tables["glyf"];

  if (!headTable || !hheaTable || !maxpTable || !locaTable || !glyfTable) {
    throw new FontError("TTF missing required tables for subsetting");
  }

  const indexToLocFormat = rawBuffer.readUInt16BE(headTable.offset + 50);
  const numOfLongHorMetrics = rawBuffer.readUInt16BE(hheaTable.offset + 34);

  // 1. Read original loca offsets
  const locaOffsets: number[] = new Array(parsedTTF.numGlyphs + 1);
  if (indexToLocFormat === 0) {
    for (let i = 0; i <= parsedTTF.numGlyphs; i++) {
      locaOffsets[i] = rawBuffer.readUInt16BE(locaTable.offset + i * 2) * 2;
    }
  } else {
    for (let i = 0; i <= parsedTTF.numGlyphs; i++) {
      locaOffsets[i] = rawBuffer.readUInt32BE(locaTable.offset + i * 4);
    }
  }

  // 2. Collect required GIDs (including composite glyph components)
  const requiredGids = new Set<number>();
  requiredGids.add(0); // Always include .notdef

  for (const cp of usedCodePoints) {
    const gid = parsedTTF.cmap.get(cp);
    if (gid !== undefined && gid >= 0 && gid < parsedTTF.numGlyphs) {
      requiredGids.add(gid);
    }
  }

  const stack = Array.from(requiredGids);
  while (stack.length > 0) {
    const gid = stack.pop()!;
    const start = locaOffsets[gid];
    const end = locaOffsets[gid + 1];
    if (start === undefined || end === undefined || end <= start) continue;

    const absStart = glyfTable.offset + start;
    if (absStart + 10 > rawBuffer.length) continue;

    const numberOfContours = rawBuffer.readInt16BE(absStart);
    if (numberOfContours === -1) {
      // Composite glyph
      let pos = absStart + 10;
      while (pos + 4 <= rawBuffer.length) {
        const flags = rawBuffer.readUInt16BE(pos);
        const compGid = rawBuffer.readUInt16BE(pos + 2);
        if (
          compGid >= 0 &&
          compGid < parsedTTF.numGlyphs &&
          !requiredGids.has(compGid)
        ) {
          requiredGids.add(compGid);
          stack.push(compGid);
        }
        pos += 4;
        if (flags & 0x0001) pos += 4;
        else pos += 2; // ARG_1_AND_2_ARE_WORDS
        if (flags & 0x0008) pos += 2; // WE_HAVE_A_SCALE
        else if (flags & 0x0040) pos += 4; // WE_HAVE_AN_X_AND_Y_SCALE
        else if (flags & 0x0080) pos += 8; // WE_HAVE_A_TWO_BY_TWO
        if ((flags & 0x0020) === 0) break; // MORE_COMPONENTS
      }
    }
  }

  const subsetGids = Array.from(requiredGids).sort((a, b) => a - b);
  const subsetCount = subsetGids.length;

  const oldToNewGidMap = new Map<number, number>();
  for (let k = 0; k < subsetCount; k++) {
    oldToNewGidMap.set(subsetGids[k]!, k);
  }

  const codePointToSubsetGidMap = new Map<number, number>();
  for (const cp of usedCodePoints) {
    const oldGid = parsedTTF.cmap.get(cp) ?? 0;
    const newGid = oldToNewGidMap.get(oldGid) ?? 0;
    codePointToSubsetGidMap.set(cp, newGid);
  }

  // 3. Build new 'glyf' and 'loca' tables
  const glyfChunks: Buffer[] = [];
  const newLocaOffsets: number[] = [0];
  let currentGlyfLen = 0;

  for (let k = 0; k < subsetCount; k++) {
    const oldGid = subsetGids[k]!;
    const start = locaOffsets[oldGid]!;
    const end = locaOffsets[oldGid + 1]!;
    const len = end - start;

    if (len === 0) {
      newLocaOffsets.push(currentGlyfLen);
      continue;
    }

    const absStart = glyfTable.offset + start;
    const glyphBuf = Buffer.from(rawBuffer.subarray(absStart, absStart + len));

    if (glyphBuf.readInt16BE(0) === -1) {
      // Rewrite component GIDs in composite glyph
      let pos = 10;
      while (pos + 4 <= glyphBuf.length) {
        const flags = glyphBuf.readUInt16BE(pos);
        const oldCompGid = glyphBuf.readUInt16BE(pos + 2);
        const newCompGid = oldToNewGidMap.get(oldCompGid) ?? 0;
        glyphBuf.writeUInt16BE(newCompGid, pos + 2);

        pos += 4;
        if (flags & 0x0001) pos += 4;
        else pos += 2;
        if (flags & 0x0008) pos += 2;
        else if (flags & 0x0040) pos += 4;
        else if (flags & 0x0080) pos += 8;
        if ((flags & 0x0020) === 0) break;
      }
    }

    glyfChunks.push(glyphBuf);
    currentGlyfLen += glyphBuf.length;

    // Pad glyph data to 2-byte boundary
    if (glyphBuf.length % 2 !== 0) {
      glyfChunks.push(Buffer.alloc(1));
      currentGlyfLen += 1;
    }
    newLocaOffsets.push(currentGlyfLen);
  }

  const newGlyfBuf = Buffer.concat(glyfChunks);
  const newLocaBuf = Buffer.alloc((subsetCount + 1) * 4);
  for (let i = 0; i <= subsetCount; i++) {
    newLocaBuf.writeUInt32BE(newLocaOffsets[i]!, i * 4);
  }

  // 4. Build new 'hmtx' table
  const newHmtxBuf = Buffer.alloc(subsetCount * 4);
  const hmtxTable = tables["hmtx"];
  for (let k = 0; k < subsetCount; k++) {
    const oldGid = subsetGids[k]!;
    const adv = parsedTTF.hmtx[oldGid] ?? 0;

    let lsb = 0;
    if (hmtxTable) {
      if (oldGid < numOfLongHorMetrics) {
        const entryOffset = hmtxTable.offset + oldGid * 4;
        if (entryOffset + 4 <= rawBuffer.length) {
          lsb = rawBuffer.readInt16BE(entryOffset + 2);
        }
      } else {
        const lsbOffset =
          hmtxTable.offset +
          numOfLongHorMetrics * 4 +
          (oldGid - numOfLongHorMetrics) * 2;
        if (lsbOffset + 2 <= rawBuffer.length) {
          lsb = rawBuffer.readInt16BE(lsbOffset);
        }
      }
    }

    newHmtxBuf.writeUInt16BE(adv, k * 4);
    newHmtxBuf.writeInt16BE(lsb, k * 4 + 2);
  }

  // 5. Build new 'hhea' table
  const newHheaBuf = Buffer.from(
    rawBuffer.subarray(hheaTable.offset, hheaTable.offset + 36),
  );
  newHheaBuf.writeUInt16BE(subsetCount, 34); // numberOfHMetrics = subsetCount

  // 6. Build new 'maxp' table
  const newMaxpBuf = Buffer.from(
    rawBuffer.subarray(maxpTable.offset, maxpTable.offset + maxpTable.length),
  );
  newMaxpBuf.writeUInt16BE(subsetCount, 4); // numGlyphs = subsetCount

  // 7. Build new 'head' table
  const newHeadBuf = Buffer.from(
    rawBuffer.subarray(headTable.offset, headTable.offset + 54),
  );
  newHeadBuf.writeUInt32BE(0, 8); // checkSumAdjustment = 0
  newHeadBuf.writeUInt16BE(1, 50); // indexToLocFormat = 1 (uint32 loca)

  // 8. Build new 'cmap' table
  const newCmapBuf = buildCmapFormat4(codePointToSubsetGidMap);

  // 9. Minimal Format 3.0 'post' table
  const newPostBuf = Buffer.alloc(32);
  newPostBuf.writeUInt32BE(0x00030000, 0); // format 3.0
  const origPost = tables["post"];
  if (origPost && origPost.offset + 16 <= rawBuffer.length) {
    newPostBuf.writeInt32BE(rawBuffer.readInt32BE(origPost.offset + 4), 4); // italicAngle
    newPostBuf.writeInt16BE(rawBuffer.readInt16BE(origPost.offset + 8), 8); // underlinePosition
    newPostBuf.writeInt16BE(rawBuffer.readInt16BE(origPost.offset + 10), 10); // underlineThickness
    newPostBuf.writeUInt32BE(rawBuffer.readUInt32BE(origPost.offset + 12), 12); // isFixedPitch
  }

  // 10. Copy 'name' table and optional 'OS/2' table
  const newTableMap: Record<string, Buffer> = {
    head: newHeadBuf,
    hhea: newHheaBuf,
    maxp: newMaxpBuf,
    hmtx: newHmtxBuf,
    cmap: newCmapBuf,
    loca: newLocaBuf,
    glyf: newGlyfBuf,
    post: newPostBuf,
  };

  const origName = tables["name"];
  if (origName) {
    newTableMap["name"] = Buffer.from(
      rawBuffer.subarray(origName.offset, origName.offset + origName.length),
    );
  }

  const origOS2 = tables["OS/2"];
  if (origOS2) {
    newTableMap["OS/2"] = Buffer.from(
      rawBuffer.subarray(origOS2.offset, origOS2.offset + origOS2.length),
    );
  }

  const origCvt = tables["cvt "];
  if (origCvt) {
    newTableMap["cvt "] = Buffer.from(
      rawBuffer.subarray(origCvt.offset, origCvt.offset + origCvt.length),
    );
  }

  const origFpgm = tables["fpgm"];
  if (origFpgm) {
    newTableMap["fpgm"] = Buffer.from(
      rawBuffer.subarray(origFpgm.offset, origFpgm.offset + origFpgm.length),
    );
  }

  const origPrep = tables["prep"];
  if (origPrep) {
    newTableMap["prep"] = Buffer.from(
      rawBuffer.subarray(origPrep.offset, origPrep.offset + origPrep.length),
    );
  }

  const origGasp = tables["gasp"];
  if (origGasp) {
    newTableMap["gasp"] = Buffer.from(
      rawBuffer.subarray(origGasp.offset, origGasp.offset + origGasp.length),
    );
  }

  // Assemble final TTF binary
  const tableTags = Object.keys(newTableMap).sort();
  const subsetNumTables = tableTags.length;

  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= subsetNumTables) {
    searchRange *= 2;
    entrySelector++;
  }
  searchRange *= 16;
  const rangeShift = subsetNumTables * 16 - searchRange;

  const headerBuf = Buffer.alloc(12);
  headerBuf.writeUInt32BE(0x00010000, 0);
  headerBuf.writeUInt16BE(subsetNumTables, 4);
  headerBuf.writeUInt16BE(searchRange, 6);
  headerBuf.writeUInt16BE(entrySelector, 8);
  headerBuf.writeUInt16BE(rangeShift, 10);

  const dirLen = subsetNumTables * 16;
  const dirBuf = Buffer.alloc(dirLen);

  let currentDataOffset = 12 + dirLen;
  const paddedTableBufs: Buffer[] = [];

  for (let i = 0; i < subsetNumTables; i++) {
    const tag = tableTags[i]!;
    const tBuf = newTableMap[tag]!;

    let padLen = 0;
    if (tBuf.length % 4 !== 0) {
      padLen = 4 - (tBuf.length % 4);
    }
    const paddedBuf =
      padLen > 0 ? Buffer.concat([tBuf, Buffer.alloc(padLen)]) : tBuf;
    paddedTableBufs.push(paddedBuf);

    const checksum = calculateTableChecksum(paddedBuf);

    dirBuf.write(tag, i * 16, 4, "ascii");
    dirBuf.writeUInt32BE(checksum, i * 16 + 4);
    dirBuf.writeUInt32BE(currentDataOffset, i * 16 + 8);
    dirBuf.writeUInt32BE(tBuf.length, i * 16 + 12); // Write unpadded original length

    currentDataOffset += paddedBuf.length;
  }

  const finalTtfBuf = Buffer.concat([headerBuf, dirBuf, ...paddedTableBufs]);

  // Calculate file checksum and update checkSumAdjustment in 'head'
  const headDirIdx = tableTags.indexOf("head");
  if (headDirIdx !== -1) {
    const headDataOffset = dirBuf.readUInt32BE(headDirIdx * 16 + 8);
    const fileChecksum = calculateTableChecksum(finalTtfBuf);
    const checkSumAdjustment = (0xb1b0afba - fileChecksum) >>> 0;
    finalTtfBuf.writeUInt32BE(checkSumAdjustment, headDataOffset + 8);
  }

  const subsetParsedTTF = parseTTF(finalTtfBuf, parsedTTF.family);

  return {
    subsetBuffer: finalTtfBuf,
    subsetParsedTTF,
    oldToNewGidMap,
    codePointToSubsetGidMap,
  };
}

function calculateTableChecksum(buf: Buffer): number {
  let sum = 0;
  const nlongs = Math.floor((buf.length + 3) / 4);
  for (let i = 0; i < nlongs; i++) {
    const pos = i * 4;
    let val = 0;
    if (pos + 4 <= buf.length) {
      val = buf.readUInt32BE(pos);
    } else {
      const b0 = buf[pos] ?? 0;
      const b1 = buf[pos + 1] ?? 0;
      const b2 = buf[pos + 2] ?? 0;
      const b3 = buf[pos + 3] ?? 0;
      val = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    }
    sum = (sum + val) >>> 0;
  }
  return sum >>> 0;
}

function buildCmapFormat4(codePointToSubsetGid: Map<number, number>): Buffer {
  const entries: { cp: number; gid: number }[] = [];
  for (const [cp, gid] of codePointToSubsetGid.entries()) {
    if (cp <= 0xffff) {
      entries.push({ cp, gid });
    }
  }
  entries.sort((a, b) => a.cp - b.cp);

  const segments: { startCode: number; endCode: number; idDelta: number }[] = [];

  let i = 0;
  while (i < entries.length) {
    const start = entries[i]!;
    let end = start;
    let j = i + 1;

    while (
      j < entries.length &&
      entries[j]!.cp === end.cp + 1 &&
      entries[j]!.gid === end.gid + 1
    ) {
      end = entries[j]!;
      j++;
    }

    const idDelta = (start.gid - start.cp) & 0xffff;
    segments.push({
      startCode: start.cp,
      endCode: end.cp,
      idDelta,
    });
    i = j;
  }

  // Always append 0xFFFF terminator segment
  segments.push({
    startCode: 0xffff,
    endCode: 0xffff,
    idDelta: 1,
  });

  const segCount = segments.length;
  const segCountX2 = segCount * 2;

  let searchRange = 1;
  let entrySelector = 0;
  while (searchRange * 2 <= segCount) {
    searchRange *= 2;
    entrySelector++;
  }
  searchRange *= 2;
  const rangeShift = segCountX2 - searchRange;

  const subtableLen = 14 + segCount * 8 + 2;
  const cmapSub = Buffer.alloc(subtableLen);

  cmapSub.writeUInt16BE(4, 0);
  cmapSub.writeUInt16BE(subtableLen, 2);
  cmapSub.writeUInt16BE(0, 4);
  cmapSub.writeUInt16BE(segCountX2, 6);
  cmapSub.writeUInt16BE(searchRange, 8);
  cmapSub.writeUInt16BE(entrySelector, 10);
  cmapSub.writeUInt16BE(rangeShift, 12);

  const endPtr = 14;
  const startPtr = 14 + segCount * 2 + 2;
  const deltaPtr = startPtr + segCount * 2;
  const rangeOffsetPtr = deltaPtr + segCount * 2;

  for (let s = 0; s < segCount; s++) {
    const seg = segments[s]!;
    cmapSub.writeUInt16BE(seg.endCode, endPtr + s * 2);
    cmapSub.writeUInt16BE(seg.startCode, startPtr + s * 2);
    cmapSub.writeUInt16BE(seg.idDelta & 0xffff, deltaPtr + s * 2);
    cmapSub.writeUInt16BE(0, rangeOffsetPtr + s * 2);
  }

  const headerLen = 12;
  const totalCmapLen = headerLen + subtableLen;
  const cmapBuf = Buffer.alloc(totalCmapLen);

  cmapBuf.writeUInt16BE(0, 0);
  cmapBuf.writeUInt16BE(1, 2);
  cmapBuf.writeUInt16BE(3, 4);
  cmapBuf.writeUInt16BE(1, 6);
  cmapBuf.writeUInt32BE(12, 8);
  cmapSub.copy(cmapBuf, 12);

  return cmapBuf;
}
