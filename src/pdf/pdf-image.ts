import * as zlib from "zlib";
import * as fs from "fs";
import * as path from "path";
import { ImageError } from "../errors/pdf-error.js";

export type ImageMap = Record<string, Buffer | string>;

export interface ParsedImageData {
  width: number;
  height: number;
  format: "png" | "jpeg";
  pdfStreamData: Uint8Array;
  filter: "FlateDecode" | "DCTDecode";
  colorSpace: "DeviceRGB" | "DeviceGray";
  bitsPerComponent: number;
  smaskData?: Uint8Array;
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

  throw new ImageError("Invalid image data: unsupported image format");
}

function parseJpeg(buf: Buffer): ParsedImageData {
  try {
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
        if (offset + 9 >= buf.length) break;
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

      // Skip marker segment
      if (offset + 3 < buf.length) {
        const length = buf.readUInt16BE(offset + 2);
        offset += 2 + length;
      } else {
        break;
      }
    }
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError(
      `Invalid JPEG image data: ${e instanceof Error ? e.message : "corrupt structure"}`,
    );
  }

  throw new ImageError("Invalid JPEG image data: missing SOF marker");
}

function parsePng(buf: Buffer): ParsedImageData {
  try {
    let offset = 8;
    let width = 0;
    let height = 0;
    let colorType = 2;
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

    if (width === 0 || height === 0 || idatChunks.length === 0) {
      throw new ImageError("Invalid PNG image data: missing IHDR or IDAT chunks");
    }

    const compressedIdat = Buffer.concat(idatChunks);
    const decompressed = zlib.inflateSync(compressedIdat);

    let bpp = 3;
    if (colorType === 0) bpp = 1; // Grayscale
    else if (colorType === 2) bpp = 3; // RGB
    else if (colorType === 3) bpp = 1; // Indexed
    else if (colorType === 4) bpp = 2; // Grayscale + Alpha
    else if (colorType === 6) bpp = 4; // RGBA

    const rowBytes = width * bpp;
    const rawPixels = Buffer.alloc(height * rowBytes);

    let inOffset = 0;
    let prevRow = Buffer.alloc(rowBytes);

    for (let y = 0; y < height; y++) {
      const filterType = decompressed[inOffset++];
      const currentRow = Buffer.alloc(rowBytes);

      for (let x = 0; x < rowBytes; x++) {
        const raw = decompressed[inOffset++] ?? 0;
        const left = x >= bpp ? currentRow[x - bpp]! : 0;
        const above = prevRow[x]!;
        const aboveLeft = x >= bpp ? prevRow[x - bpp]! : 0;

        let val = raw;
        if (filterType === 1) val = (raw + left) & 0xff;
        else if (filterType === 2) val = (raw + above) & 0xff;
        else if (filterType === 3)
          val = (raw + Math.floor((left + above) / 2)) & 0xff;
        else if (filterType === 4)
          val = (raw + paethPredictor(left, above, aboveLeft)) & 0xff;

        currentRow[x] = val;
      }

      currentRow.copy(rawPixels, y * rowBytes);
      prevRow = currentRow;
    }

    let finalRgb: Buffer;
    let finalAlpha: Buffer | undefined = undefined;
    let colorSpace: "DeviceRGB" | "DeviceGray" = "DeviceRGB";

    if (colorType === 6) {
      // RGBA -> Separate RGB and Alpha
      finalRgb = Buffer.alloc(width * height * 3);
      finalAlpha = Buffer.alloc(width * height * 1);
      for (let i = 0; i < width * height; i++) {
        finalRgb[i * 3] = rawPixels[i * 4]!;
        finalRgb[i * 3 + 1] = rawPixels[i * 4 + 1]!;
        finalRgb[i * 3 + 2] = rawPixels[i * 4 + 2]!;
        finalAlpha[i] = rawPixels[i * 4 + 3]!;
      }
    } else if (colorType === 4) {
      // Grayscale + Alpha
      finalRgb = Buffer.alloc(width * height * 1);
      finalAlpha = Buffer.alloc(width * height * 1);
      colorSpace = "DeviceGray";
      for (let i = 0; i < width * height; i++) {
        finalRgb[i] = rawPixels[i * 2]!;
        finalAlpha[i] = rawPixels[i * 2 + 1]!;
      }
    } else if (colorType === 3 && palette) {
      // Indexed PLTE
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

    if (smaskData) {
      res.smaskData = smaskData;
    }

    return res;
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
  if (cache && cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  let result: ParsedImageData;

  // 1. Check custom imagesMap (explicit options.images take precedence)
  if (imagesMap && imagesMap[cleanSrc] !== undefined) {
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

  // 2. Base64 Data URL (data:image/png;base64,... or data:image/jpeg;base64,...)
  if (cleanSrc.startsWith("data:")) {
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
    result = parseImage(buffer);
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
  let rawPath = cleanSrc;
  if (rawPath.startsWith("file://")) {
    rawPath = rawPath.slice(7);
  }

  let resolvedPath: string;

  if (path.isAbsolute(rawPath)) {
    resolvedPath = path.normalize(rawPath);
    if (basePath) {
      const normalizedBase = path.resolve(basePath);
      const rel = path.relative(normalizedBase, resolvedPath);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new ImageError(
          `Access denied: image path "${cleanSrc}" is outside configured basePath "${basePath}"`,
        );
      }
    }
  } else {
    const rootDir = basePath ? path.resolve(basePath) : process.cwd();
    resolvedPath = path.resolve(rootDir, rawPath);

    if (basePath) {
      const normalizedBase = path.resolve(basePath);
      const rel = path.relative(normalizedBase, resolvedPath);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new ImageError(
          `Access denied: image path "${cleanSrc}" is outside configured basePath "${basePath}"`,
        );
      }
    }
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new ImageError(`Unable to load image "${cleanSrc}": file does not exist`);
  }

  try {
    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      throw new ImageError(`Unable to load image "${cleanSrc}": path is a directory`);
    }
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError(
      `Unable to load image "${cleanSrc}": ${e instanceof Error ? e.message : "stat error"}`,
    );
  }

  try {
    const buffer = fs.readFileSync(resolvedPath);
    result = parseImage(buffer);
    if (cache) cache.set(cacheKey, result);
    return result;
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError(
      `Unable to read image file "${resolvedPath}": ${e instanceof Error ? e.message : "read error"}`,
    );
  }
}
