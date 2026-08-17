import * as zlib from "node:zlib";

function findStreamStartIndex(str: string, pos: number): { idx: number; prefixLen: number } {
  const s1 = str.indexOf("stream\n", pos);
  const s2 = str.indexOf("stream\r\n", pos);
  
  if (s1 !== -1 && s2 !== -1) {
    return s1 < s2 ? { idx: s1, prefixLen: 7 } : { idx: s2, prefixLen: 8 };
  }
  if (s1 !== -1) return { idx: s1, prefixLen: 7 };
  if (s2 !== -1) return { idx: s2, prefixLen: 8 };
  return { idx: -1, prefixLen: 0 };
}

function processStreamData(str: string, streamIdx: number, endIdx: number, prefixLen: number, dictStr: string): string {
  let streamData = str.substring(streamIdx + prefixLen, endIdx);
  if (streamData.endsWith("\r\n")) {
    streamData = streamData.substring(0, streamData.length - 2);
  } else if (streamData.endsWith("\n")) {
    streamData = streamData.substring(0, streamData.length - 1);
  }

  if (dictStr.includes("/Filter /FlateDecode") || dictStr.includes("/Filter/FlateDecode")) {
    try {
      const buf = Buffer.from(streamData, "binary");
      streamData = zlib.unzipSync(buf).toString("binary");
    } catch {
      // ignore if decompression fails
    }
  }
  return streamData;
}

function extractDecodedStreams(str: string): string[] {
  const decodedStreams: string[] = [];
  let pos = 0;

  while (true) {
    const { idx: streamIdx, prefixLen } = findStreamStartIndex(str, pos);
    if (streamIdx === -1) break;

    const endIdx = str.indexOf("endstream", streamIdx);
    if (endIdx === -1) break;

    const dictStart = str.lastIndexOf("<<", streamIdx);
    if (dictStart !== -1 && dictStart >= pos) {
      const dictStr = str.substring(dictStart, streamIdx);
      const streamData = processStreamData(str, streamIdx, endIdx, prefixLen, dictStr);
      decodedStreams.push(streamData);
    }
    pos = endIdx + 9;
  }
  return decodedStreams;
}

function extractCMaps(streams: string[]): Map<string, string>[] {
  const cmaps: Map<string, string>[] = [];
  const bfcharRegex = /beginbfchar(.*?)endbfchar/gs;
  const lineRegex = /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/;

  for (const streamData of streams) {
    let bfMatch;
    while ((bfMatch = bfcharRegex.exec(streamData)) !== null) {
      const cmap = new Map<string, string>();
      const lines = bfMatch[1]!.trim().split("\n");
      
      for (const line of lines) {
        const match = lineRegex.exec(line);
        if (match) {
          const gidHex = match[1]!.toUpperCase();
          const unicodeHex = match[2]!;
          const unicodeCode = Number.parseInt(unicodeHex, 16);
          cmap.set(gidHex, String.fromCodePoint(unicodeCode));
        }
      }
      cmaps.push(cmap);
    }
  }
  return cmaps;
}

function decodeAsciiHex(hex: string): string {
  let decoded = "";
  for (let i = 0; i < hex.length; i += 2) {
    if (i + 2 <= hex.length) {
      const code = Number.parseInt(hex.substring(i, i + 2), 16);
      if (code >= 32 && code <= 126) {
        decoded += String.fromCodePoint(code);
      }
    }
  }
  return decoded;
}

function decodeCMapHex(hex: string, cmaps: Map<string, string>[]): string {
  let decoded = "";
  for (const cmap of cmaps) {
    let cmapDecoded = "";
    for (let i = 0; i < hex.length; i += 4) {
      if (i + 4 <= hex.length) {
        const gid = hex.substring(i, i + 4);
        if (cmap.has(gid)) {
          cmapDecoded += cmap.get(gid)!;
        }
      }
    }
    if (cmapDecoded.length > 0) {
      decoded += (decoded.length > 0 ? " " : "") + cmapDecoded;
    }
  }
  return decoded;
}

function decodeHex(hex: string, cmaps: Map<string, string>[]): string {
  const ascii = decodeAsciiHex(hex);
  const cmapStr = decodeCMapHex(hex, cmaps);
  
  if (ascii && cmapStr) {
    return `${ascii} ${cmapStr}`;
  }
  return ascii || cmapStr;
}

function findLiteralStringEnd(textBlock: string, startIdx: number): number {
  let end = startIdx;
  while (end < textBlock.length) {
    if (textBlock[end] === '\\') {
      end += 2;
    } else if (textBlock[end] === ')') {
      break;
    } else {
      end++;
    }
  }
  return end;
}

function extractLiteralStrings(textBlock: string): string[] {
  const literals: string[] = [];
  let i = 0;
  while (i < textBlock.length) {
    if (textBlock[i] === '(') {
      const end = findLiteralStringEnd(textBlock, i + 1);
      if (end < textBlock.length) {
        literals.push(textBlock.substring(i + 1, end));
      }
      i = end + 1;
    } else {
      i++;
    }
  }
  return literals;
}

function extractTextFromStreams(streams: string[], cmaps: Map<string, string>[]): string {
  let text = "";
  
  for (const streamData of streams) {
    let pos = 0;
    while (true) {
      const btIdx = streamData.indexOf("BT", pos);
      if (btIdx === -1) break;
      
      const etIdx = streamData.indexOf("ET", btIdx);
      if (etIdx === -1) break;
      
      const textBlock = streamData.substring(btIdx + 2, etIdx);
      
      const literals = extractLiteralStrings(textBlock);
      for (const literal of literals) {
        text += literal.replace(/\\(.)/g, "$1") + " ";
      }
      
      const hexMatches = [...textBlock.matchAll(/<([0-9A-Fa-f]+)>/g)];
      for (const m of hexMatches) {
        text += decodeHex(m[1]!.toUpperCase(), cmaps) + " ";
      }
      
      pos = etIdx + 2;
    }
  }
  return text.trim();
}

export function extractPdfText(buffer: Buffer): string {
  const str = buffer.toString("binary");
  const decodedStreams = extractDecodedStreams(str);
  const cmaps = extractCMaps(decodedStreams);
  return extractTextFromStreams(decodedStreams, cmaps);
}
