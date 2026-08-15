import * as zlib from "node:zlib";
import * as fs from "node:fs";
import * as path from "node:path";
import { ImageError } from "../errors/pdf-error.js";

export type ImageMap = Record<string, Buffer | string>;

import { SvgParser } from "../svg/svg-parser.js";
import { SvgElementNode } from "../svg/svg-node.js";

export interface ParsedImageData {
  width: number;
  height: number;
  format: "png" | "jpeg" | "svg";
  pdfStreamData: Uint8Array;
  filter?: "FlateDecode" | "DCTDecode";
  colorSpace?: "DeviceRGB" | "DeviceGray";
  bitsPerComponent?: number;
  smaskData?: Uint8Array;
  svgNode?: SvgElementNode;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function parseImage(input: Buffer | Uint8Array): ParsedImageData {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);

  if (buf.length === 0) {
    throw new ImageError("Invalid image data: empty buffer");
  }

  // 1. Check JPEG Magic Number (0xFF, 0xD8)
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    return parseJpeg(buf);
  }

  // 2. Check PNG Magic Number (89 50 4E 47 0D 0A 1A 0A)
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return parsePng(buf);
  }

  // 3. Check for SVG
  const strStart = buf
    .toString("utf8", 0, Math.min(buf.length, 1024))
    .trimStart();
  if (
    strStart.startsWith("<svg") ||
    strStart.startsWith("<?xml") ||
    strStart.includes("<svg")
  ) {
    return parseSvg(buf);
  }

  throw new ImageError("Invalid image data: unsupported image format");
}

function parseSvg(buf: Buffer): ParsedImageData {
  const fullStr = buf.toString("utf8");
  try {
    const parser = new SvgParser();
    const svgNode = parser.parse(fullStr);
    let wStr = svgNode.getAttribute("width") || "300";
    let hStr = svgNode.getAttribute("height") || "150";
    if (wStr.endsWith("px")) wStr = wStr.slice(0, -2);
    if (hStr.endsWith("px")) hStr = hStr.slice(0, -2);
    const width = Number.parseFloat(wStr) || 300;
    const height = Number.parseFloat(hStr) || 150;

    return {
      width,
      height,
      format: "svg",
      pdfStreamData: buf,
      svgNode,
    };
  } catch (e) {
    throw new ImageError(
      `Invalid SVG data: ${e instanceof Error ? e.message : "parse error"}`,
    );
  }
}

function parseJpeg(buf: Buffer): ParsedImageData {
  try {
    const res = scanJpegMarkers(buf);
    if (res) return res;
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError(
      `Invalid JPEG image data: ${e instanceof Error ? e.message : "corrupt structure"}`,
    );
  }

  throw new ImageError("Invalid JPEG image data: missing SOF marker");
}

function scanJpegMarkers(buf: Buffer): ParsedImageData | null {
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === undefined) break;

    // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2) contain image dimensions
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return extractJpegDimensions(buf, offset);
    }

    // Skip marker segment
    if (offset + 3 < buf.length) {
      const length = buf.readUInt16BE(offset + 2);
      offset += 2 + length;
    } else {
      break;
    }
  }
  return null;
}

function extractJpegDimensions(
  buf: Buffer,
  offset: number,
): ParsedImageData | null {
  if (offset + 9 >= buf.length) return null;
  const height = buf.readUInt16BE(offset + 5);
  const width = buf.readUInt16BE(offset + 7);
  const numComponents = buf[offset + 9];
  const colorSpace = numComponents === 1 ? "DeviceGray" : "DeviceRGB";
  return {
    width,
    height,
    format: "jpeg",
    pdfStreamData: buf,
    filter: "DCTDecode",
    colorSpace,
    bitsPerComponent: 8,
  };
}

interface PngChunks {
  width: number;
  height: number;
  colorType: number;
  idatChunks: Buffer[];
  palette: Buffer | null;
}

function extractPngChunks(buf: Buffer): PngChunks {
  let offset = 8;
  let width = 0,
    height = 0,
    colorType = 2;
  const idatChunks: Buffer[] = [];
  let palette: Buffer | null = null;
  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const chunkLen = buf.readUInt32BE(offset);
    const chunkType = buf.toString("ascii", offset + 4, offset + 8);
    const dataOffset = offset + 8;

    if (chunkType === "IHDR") {
      if (dataOffset + 10 > buf.length) break;
      width = buf.readUInt32BE(dataOffset);
      height = buf.readUInt32BE(dataOffset + 4);
      colorType = buf[dataOffset + 9] ?? 2;
    } else if (chunkType === "PLTE") {
      palette = buf.subarray(dataOffset, dataOffset + chunkLen);
    } else if (chunkType === "IDAT") {
      idatChunks.push(buf.subarray(dataOffset, dataOffset + chunkLen));
    } else if (chunkType === "IEND") {
      break;
    }
    offset += 12 + chunkLen;
  }
  return { width, height, colorType, idatChunks, palette };
}

function getPngBpp(colorType: number): number {
  if (colorType === 0 || colorType === 3) return 1;
  if (colorType === 4) return 2;
  if (colorType === 6) return 4;
  return 3;
}

function applyPngFilter(
  filterType: number,
  raw: number,
  left: number,
  above: number,
  aboveLeft: number,
): number {
  if (filterType === 1) return (raw + left) & 0xff;
  if (filterType === 2) return (raw + above) & 0xff;
  if (filterType === 3) return (raw + Math.floor((left + above) / 2)) & 0xff;
  if (filterType === 4)
    return (raw + paethPredictor(left, above, aboveLeft)) & 0xff;
  return raw;
}

function unfilterPngData(
  decompressed: Buffer,
  width: number,
  height: number,
  colorType: number,
): Buffer {
  const bpp = getPngBpp(colorType);
  const rowBytes = width * bpp;
  const rawPixels = Buffer.alloc(height * rowBytes);
  let inOffset = 0;
  let prevRow = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y++) {
    const filterType = decompressed[inOffset++] ?? 0;
    const currentRow = Buffer.alloc(rowBytes);

    for (let x = 0; x < rowBytes; x++) {
      const raw = decompressed[inOffset++] ?? 0;
      const left = x >= bpp ? currentRow[x - bpp]! : 0;
      const above = prevRow[x]!;
      const aboveLeft = x >= bpp ? prevRow[x - bpp]! : 0;

      currentRow[x] = applyPngFilter(filterType, raw, left, above, aboveLeft);
    }
    currentRow.copy(rawPixels, y * rowBytes);
    prevRow = currentRow;
  }
  return rawPixels;
}

function formatPngData(
  rawPixels: Buffer,
  width: number,
  height: number,
  colorType: number,
  palette: Buffer | null,
): ParsedImageData {
  let finalRgb: Buffer;
  let finalAlpha: Buffer | undefined = undefined;
  let colorSpace: "DeviceRGB" | "DeviceGray" = "DeviceRGB";

  if (colorType === 6) {
    finalRgb = Buffer.alloc(width * height * 3);
    finalAlpha = Buffer.alloc(width * height * 1);
    for (let i = 0; i < width * height; i++) {
      finalRgb[i * 3] = rawPixels[i * 4]!;
      finalRgb[i * 3 + 1] = rawPixels[i * 4 + 1]!;
      finalRgb[i * 3 + 2] = rawPixels[i * 4 + 2]!;
      finalAlpha[i] = rawPixels[i * 4 + 3]!;
    }
  } else if (colorType === 4) {
    finalRgb = Buffer.alloc(width * height * 1);
    finalAlpha = Buffer.alloc(width * height * 1);
    colorSpace = "DeviceGray";
    for (let i = 0; i < width * height; i++) {
      finalRgb[i] = rawPixels[i * 2]!;
      finalAlpha[i] = rawPixels[i * 2 + 1]!;
    }
  } else if (colorType === 3 && palette) {
    finalRgb = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      const idx = rawPixels[i]!;
      finalRgb[i * 3] = palette[idx * 3] ?? 0;
      finalRgb[i * 3 + 1] = palette[idx * 3 + 1] ?? 0;
      finalRgb[i * 3 + 2] = palette[idx * 3 + 2] ?? 0;
    }
  } else if (colorType === 0) {
    finalRgb = rawPixels;
    colorSpace = "DeviceGray";
  } else {
    finalRgb = rawPixels;
  }

  const pdfStreamData = zlib.deflateSync(finalRgb);
  const smaskData = finalAlpha ? zlib.deflateSync(finalAlpha) : undefined;
  const res: ParsedImageData = {
    width,
    height,
    format: "png",
    pdfStreamData,
    filter: "FlateDecode",
    colorSpace,
    bitsPerComponent: 8,
  };
  if (smaskData) res.smaskData = smaskData;
  return res;
}

function parsePng(buf: Buffer): ParsedImageData {
  try {
    const { width, height, colorType, idatChunks, palette } =
      extractPngChunks(buf);

    if (width === 0 || height === 0 || idatChunks.length === 0) {
      throw new ImageError(
        "Invalid PNG image data: missing IHDR or IDAT chunks",
      );
    }

    const compressedIdat = Buffer.concat(idatChunks);
    const decompressed = zlib.inflateSync(compressedIdat);

    const rawPixels = unfilterPngData(decompressed, width, height, colorType);
    return formatPngData(rawPixels, width, height, colorType, palette);
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError(
      `Invalid PNG image data: ${e instanceof Error ? e.message : "decompression failed"}`,
    );
  }
}

export function resolveImageSource(
  src: string,
  imagesMap?: Record<string, Buffer | string>,
  basePath?: string,
  cache?: Map<string, ParsedImageData>,
): ParsedImageData {
  if (!src || typeof src !== "string" || src.trim() === "") {
    throw new ImageError("Invalid image source: source string is empty");
  }

  const cleanSrc = src.trim();
  const cacheKey = `${basePath ?? ""}:${cleanSrc}`;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  let result: ParsedImageData;

  // 1. Check custom imagesMap (explicit options.images take precedence)
  if (imagesMap?.[cleanSrc] !== undefined) {
    const item = imagesMap[cleanSrc]!;
    if (Buffer.isBuffer(item)) {
      result = parseImage(item);
    } else if (typeof item === "string") {
      result = resolveImageSource(item, undefined, basePath, cache);
    } else {
      throw new ImageError(
        `Invalid image source for "${cleanSrc}": unsupported type in images map`,
      );
    }
    if (cache) cache.set(cacheKey, result);
    return result;
  }

  // 2. Base64 Data URL
  if (cleanSrc.startsWith("data:")) {
    result = parseBase64Image(cleanSrc);
    if (cache) cache.set(cacheKey, result);
    return result;
  }

  // 3. Reject Remote HTTP/HTTPS URLs
  if (
    cleanSrc.startsWith("http://") ||
    cleanSrc.startsWith("https://") ||
    cleanSrc.startsWith("//")
  ) {
    throw new ImageError(
      `Unable to load image "${cleanSrc}": remote HTTP/HTTPS images are not supported`,
    );
  }

  // 4. Local File Path Resolution
  result = resolveLocalImage(cleanSrc, basePath);
  if (cache) cache.set(cacheKey, result);
  return result;
}

function parseBase64Image(cleanSrc: string): ParsedImageData {
  const commaIdx = cleanSrc.indexOf(",");
  if (commaIdx === -1) {
    throw new ImageError(
      `Invalid image data: malformed base64 Data URL for image source "${cleanSrc.slice(0, 50)}"`,
    );
  }
  const base64Str = cleanSrc.slice(commaIdx + 1).trim();
  if (base64Str.length === 0) {
    throw new ImageError(
      `Invalid image data: base64 Data URL is empty for image source "${cleanSrc.slice(0, 50)}"`,
    );
  }
  const buffer = Buffer.from(base64Str, "base64");
  if (buffer.length === 0) {
    throw new ImageError(
      `Invalid image data: failed to decode base64 string for image source "${cleanSrc.slice(0, 50)}"`,
    );
  }
  return parseImage(buffer);
}

function getResolvedLocalImagePath(rawPath: string, basePath?: string): string {
  if (path.isAbsolute(rawPath)) {
    return path.normalize(rawPath);
  }
  const rootDir = basePath ? path.resolve(basePath) : process.cwd();
  return path.resolve(rootDir, rawPath);
}

function validateLocalImagePath(
  cleanSrc: string,
  resolvedPath: string,
  basePath?: string,
) {
  if (basePath) {
    const normalizedBase = path.resolve(basePath);
    const rel = path.relative(normalizedBase, resolvedPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new ImageError(
        `Access denied: image path "${cleanSrc}" is outside configured basePath "${basePath}"`,
      );
    }
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new ImageError(
      `Unable to load image "${cleanSrc}": file does not exist`,
    );
  }

  try {
    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      throw new ImageError(
        `Unable to load image "${cleanSrc}": path is a directory`,
      );
    }
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError(
      `Unable to load image "${cleanSrc}": ${e instanceof Error ? e.message : "stat error"}`,
    );
  }
}

function resolveLocalImage(
  cleanSrc: string,
  basePath?: string,
): ParsedImageData {
  const rawPath = cleanSrc.startsWith("file://") ? cleanSrc.slice(7) : cleanSrc;
  const resolvedPath = getResolvedLocalImagePath(rawPath, basePath);

  validateLocalImagePath(cleanSrc, resolvedPath, basePath);

  try {
    const buffer = fs.readFileSync(resolvedPath);
    return parseImage(buffer);
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError(
      `Unable to read image file "${resolvedPath}": ${e instanceof Error ? e.message : "read error"}`,
    );
  }
}
