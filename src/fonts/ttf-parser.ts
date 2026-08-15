import * as fs from "fs";
import { FontError } from "../errors/pdf-error.js";

export interface ParsedTTF {
  postScriptName: string;
  family: string;
  subfamily: string;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  bbox: [number, number, number, number];
  numGlyphs: number;
  hmtx: Uint16Array; // advanceWidth per glyph ID
  cmap: Map<number, number>; // codePoint -> glyphID
  rawBuffer: Buffer;
}

export function parseTTF(
  input: Buffer | Uint8Array | string,
  fontNameForContext?: string,
): ParsedTTF {
  let buf: Buffer;
  const contextName = fontNameForContext ? ` "${fontNameForContext}"` : "";

  if (typeof input === "string") {
    if (input.startsWith("data:")) {
      const commaIdx = input.indexOf(",");
      if (commaIdx === -1) {
        throw new FontError(
          `Unable to load font${contextName}: malformed base64 Data URL`,
        );
      }
      buf = Buffer.from(input.slice(commaIdx + 1), "base64");
    } else {
      let filePath = input;
      if (filePath.startsWith("file://")) filePath = filePath.slice(7);
      if (!fs.existsSync(filePath)) {
        throw new FontError(
          `Unable to load font${contextName}: file "${filePath}" does not exist`,
        );
      }
      try {
        buf = fs.readFileSync(filePath);
      } catch (e) {
        throw new FontError(
          `Unable to load font${contextName}: file "${filePath}" is unreadable`,
        );
      }
    }
  } else if (Buffer.isBuffer(input)) {
    buf = input;
  } else {
    buf = Buffer.from(input);
  }

  if (!buf || buf.length === 0) {
    throw new FontError(`Unable to load font${contextName}: empty font Buffer`);
  }

  if (buf.length < 12) {
    throw new FontError(
      `Unable to load font${contextName}: corrupt or truncated TTF header`,
    );
  }

  try {
    const numTables = buf.readUInt16BE(4);
    const tables: Record<string, { offset: number; length: number }> = {};

    let tableOffset = 12;
    for (let i = 0; i < numTables; i++) {
      if (tableOffset + 16 > buf.length) break;
      const tag = buf.toString("ascii", tableOffset, tableOffset + 4);
      const offset = buf.readUInt32BE(tableOffset + 8);
      const length = buf.readUInt32BE(tableOffset + 12);
      tables[tag] = { offset, length };
      tableOffset += 16;
    }

    // 1. Read 'head' table
    const headTable = tables["head"];
    if (!headTable) {
      throw new FontError(
        `Unable to load font${contextName}: missing 'head' table`,
      );
    }
    const unitsPerEm = buf.readUInt16BE(headTable.offset + 18) || 1000;
    const xMin = buf.readInt16BE(headTable.offset + 36);
    const yMin = buf.readInt16BE(headTable.offset + 38);
    const xMax = buf.readInt16BE(headTable.offset + 40);
    const yMax = buf.readInt16BE(headTable.offset + 42);

    // 2. Read 'hhea' table
    const hheaTable = tables["hhea"];
    if (!hheaTable) {
      throw new FontError(
        `Unable to load font${contextName}: missing 'hhea' table`,
      );
    }
    const ascent = buf.readInt16BE(hheaTable.offset + 4);
    const descent = buf.readInt16BE(hheaTable.offset + 6);
    const numOfLongHorMetrics = buf.readUInt16BE(hheaTable.offset + 34);

    // 3. Read 'maxp' table
    const maxpTable = tables["maxp"];
    if (!maxpTable) {
      throw new FontError(
        `Unable to load font${contextName}: missing 'maxp' table`,
      );
    }
    const numGlyphs = buf.readUInt16BE(maxpTable.offset + 4);

    // 4. Read 'hmtx' table
    const hmtxTable = tables["hmtx"];
    if (!hmtxTable) {
      throw new FontError(
        `Unable to load font${contextName}: missing 'hmtx' table`,
      );
    }

    const hmtx = new Uint16Array(numGlyphs);
    let lastAdvanceWidth = 0;

    for (let i = 0; i < numGlyphs; i++) {
      if (i < numOfLongHorMetrics) {
        const entryOffset = hmtxTable.offset + i * 4;
        if (entryOffset + 2 <= buf.length) {
          lastAdvanceWidth = buf.readUInt16BE(entryOffset);
        }
      }
      hmtx[i] = lastAdvanceWidth;
    }

    // 5. Read 'cmap' table
    const cmapTable = tables["cmap"];
    const cmap = new Map<number, number>();
    if (cmapTable) {
      parseCmapTable(buf, cmapTable.offset, cmap);
    }

    // 6. Read 'name' table
    let family = "CustomFont";
    let subfamily = "Regular";
    let postScriptName = "CustomFont-Regular";

    const nameTable = tables["name"];
    if (nameTable) {
      const names = parseNameTable(buf, nameTable.offset);
      if (names.postScriptName) postScriptName = names.postScriptName;
      if (names.family) family = names.family;
      if (names.subfamily) subfamily = names.subfamily;
    }

    // Normalize PostScript name to valid PDF Name (no spaces or special chars)
    postScriptName = postScriptName.replace(/[^a-zA-Z0-9-]/g, "");
    if (!postScriptName) postScriptName = "CustomFont";

    return {
      postScriptName,
      family,
      subfamily,
      unitsPerEm,
      ascent,
      descent,
      bbox: [
        Math.round((xMin * 1000) / unitsPerEm),
        Math.round((yMin * 1000) / unitsPerEm),
        Math.round((xMax * 1000) / unitsPerEm),
        Math.round((yMax * 1000) / unitsPerEm),
      ],
      numGlyphs,
      hmtx,
      cmap,
      rawBuffer: buf,
    };
  } catch (e) {
    if (e instanceof FontError) throw e;
    throw new FontError(
      `Unable to load font${contextName}: ${e instanceof Error ? e.message : "corrupt TTF font data"}`,
    );
  }
}

function parseCmapTable(
  buf: Buffer,
  cmapOffset: number,
  outMap: Map<number, number>,
): void {
  const numSubtables = buf.readUInt16BE(cmapOffset + 2);
  let bestOffset = -1;
  let bestFormat = -1;

  for (let i = 0; i < numSubtables; i++) {
    const recOffset = cmapOffset + 4 + i * 8;
    const platformID = buf.readUInt16BE(recOffset);
    const encodingID = buf.readUInt16BE(recOffset + 2);
    const subOffset = cmapOffset + buf.readUInt32BE(recOffset + 4);

    const format = buf.readUInt16BE(subOffset);
    if (format === 4) {
      if (
        (platformID === 3 && encodingID === 1) ||
        platformID === 0 ||
        bestFormat === -1
      ) {
        bestOffset = subOffset;
        bestFormat = 4;
      }
    } else if (format === 12) {
      bestOffset = subOffset;
      bestFormat = 12;
      break;
    }
  }

  if (bestFormat === 4 && bestOffset !== -1) {
    parseCmapFormat4(buf, bestOffset, outMap);
  } else if (bestFormat === 12 && bestOffset !== -1) {
    parseCmapFormat12(buf, bestOffset, outMap);
  }
}

function parseCmapFormat4(
  buf: Buffer,
  subOffset: number,
  outMap: Map<number, number>,
): void {
  const segCount = buf.readUInt16BE(subOffset + 6) / 2;
  const endCountOffset = subOffset + 14;
  const startCountOffset = endCountOffset + segCount * 2 + 2;
  const idDeltaOffset = startCountOffset + segCount * 2;
  const idRangeOffsetOffset = idDeltaOffset + segCount * 2;

  for (let i = 0; i < segCount; i++) {
    const endCode = buf.readUInt16BE(endCountOffset + i * 2);
    const startCode = buf.readUInt16BE(startCountOffset + i * 2);
    const idDelta = buf.readInt16BE(idDeltaOffset + i * 2);
    const idRangeOffset = buf.readUInt16BE(idRangeOffsetOffset + i * 2);

    if (startCode === 0xffff || endCode === 0xffff) continue;

    for (let c = startCode; c <= endCode; c++) {
      let gid = 0;
      if (idRangeOffset === 0) {
        gid = (c + idDelta) & 0xffff;
      } else {
        const glyphIdPtr =
          idRangeOffsetOffset +
          i * 2 +
          idRangeOffset +
          (c - startCode) * 2;
        if (glyphIdPtr + 2 <= buf.length) {
          gid = buf.readUInt16BE(glyphIdPtr);
          if (gid !== 0) {
            gid = (gid + idDelta) & 0xffff;
          }
        }
      }
      if (gid !== 0) {
        outMap.set(c, gid);
      }
    }
  }
}

function parseCmapFormat12(
  buf: Buffer,
  subOffset: number,
  outMap: Map<number, number>,
): void {
  const nGroups = buf.readUInt32BE(subOffset + 12);
  let groupOffset = subOffset + 16;

  for (let i = 0; i < nGroups; i++) {
    if (groupOffset + 12 > buf.length) break;
    const startCharCode = buf.readUInt32BE(groupOffset);
    const endCharCode = buf.readUInt32BE(groupOffset + 4);
    const startGlyphID = buf.readUInt32BE(groupOffset + 8);

    for (let c = startCharCode; c <= endCharCode; c++) {
      const gid = startGlyphID + (c - startCharCode);
      outMap.set(c, gid);
    }

    groupOffset += 12;
  }
}

function parseNameTable(
  buf: Buffer,
  nameOffset: number,
): {
  family?: string | undefined;
  subfamily?: string | undefined;
  postScriptName?: string | undefined;
} {
  const count = buf.readUInt16BE(nameOffset + 2);
  const stringOffset = nameOffset + buf.readUInt16BE(nameOffset + 4);

  let family: string | undefined;
  let subfamily: string | undefined;
  let postScriptName: string | undefined;

  for (let i = 0; i < count; i++) {
    const recOffset = nameOffset + 6 + i * 12;
    const platformID = buf.readUInt16BE(recOffset);
    const nameID = buf.readUInt16BE(recOffset + 6);
    const length = buf.readUInt16BE(recOffset + 8);
    const offset = buf.readUInt16BE(recOffset + 10);

    const strPtr = stringOffset + offset;
    if (strPtr + length > buf.length) continue;

    let val = "";
    if (platformID === 3 || platformID === 0) {
      // UTF-16BE
      val = decodeUtf16Be(buf, strPtr, length);
    } else {
      val = buf.toString("ascii", strPtr, strPtr + length);
    }

    if (nameID === 1 && !family) family = val;
    else if (nameID === 2 && !subfamily) subfamily = val;
    else if (nameID === 6 && !postScriptName) postScriptName = val;
  }

  return { family, subfamily, postScriptName };
}

function decodeUtf16Be(buf: Buffer, offset: number, length: number): string {
  let str = "";
  for (let i = 0; i < length; i += 2) {
    if (offset + i + 1 < buf.length) {
      const code = buf.readUInt16BE(offset + i);
      str += String.fromCharCode(code);
    }
  }
  return str;
}
