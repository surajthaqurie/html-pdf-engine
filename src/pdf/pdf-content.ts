export interface ColorRGB {
  r: number; // 0 to 1
  g: number; // 0 to 1
  b: number; // 0 to 1
  a?: number; // 0 to 1
}

export type GidHexResolver = (fontName: string, text: string) => string;

export interface DrawCustomTextOp {
  type: "customText";
  text: string;
  fontName: string;
  fontAlias: string;
  fontSize: number;
  x: number;
  y: number;
  letterSpacing?: number;
  wordSpacing?: number;
}

type PDFOp = { type: "raw"; code: string } | DrawCustomTextOp;

// Complete CP1252 byte mapping for the 0x80-0x9F range
const CP1252_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

// Transliteration table: Unicode chars above U+00FF that don't exist in CP1252
// are mapped to the closest ASCII/Latin-1 equivalent string.
const UNICODE_XLAT: Record<number, string> = {
  0x00a0: " ",   // NO-BREAK SPACE → regular space
  0x00ad: "-",   // SOFT HYPHEN
  0x00d7: "x",   // × MULTIPLICATION SIGN
  0x00f7: "/",   // ÷ DIVISION SIGN
  0x2010: "-",   // ‐ HYPHEN
  0x2011: "-",   // ‑ NON-BREAKING HYPHEN
  0x2012: "-",   // ‒ FIGURE DASH
  0x2015: "-",   // ― HORIZONTAL BAR
  0x2032: "'",   // ′ PRIME
  0x2033: '"',   // ″ DOUBLE PRIME
  0x2044: "/",   // ⁄ FRACTION SLASH
  0x2190: "<-",  // ←
  0x2192: "->",  // →
  0x2194: "<->", // ↔
  0x21d2: "=>",  // ⇒
  0x2009: " ",   // THIN SPACE
  0x200b: "",    // ZERO WIDTH SPACE
  0x200c: "",    // ZERO WIDTH NON-JOINER
  0x200d: "",    // ZERO WIDTH JOINER
  0x2212: "-",   // − MINUS SIGN
  0x2248: "~=",  // ≈
  0x2260: "!=",  // ≠
  0x2264: "<=",  // ≤
  0x2265: ">=",  // ≥
  0x221e: "inf", // ∞
  0x03b1: "a",   // α
  0x03b2: "b",   // β
  0x03b3: "g",   // γ
  0x03c0: "pi",  // π
  0x00a9: "(c)", // © (already in Latin-1 but safe fallback)
  0x00ae: "(R)", // ®
  0x2120: "(SM)",// ℠
  0x2103: "C",   // ℃
  0x2109: "F",   // ℉
  0x25cf: "*",   // ●
  0x25a0: "[]",  // ■
  0x2713: "v",   // ✓
  0x2717: "x",   // ✗
  0x25b6: ">",   // ▶
  0x25c0: "<",   // ◀
  0x25bc: "v",   // ▼
  0x25b2: "^",   // ▲
  0xfb01: "fi",  // ﬁ LATIN SMALL LIGATURE FI
  0xfb02: "fl",  // ﬂ LATIN SMALL LIGATURE FL
};

/**
 * Convert a Unicode JS string to a CP1252/WinAnsiEncoding hex byte stream
 * for use as a PDF <hex> Tj operand.
 *
 * Per-character strategy:
 *  1. U+0000–U+00FF  → direct byte (Latin-1 maps 1:1 to CP1252)
 *  2. In CP1252_EXTRA → mapped CP1252 byte
 *  3. In UNICODE_XLAT → best-effort ASCII transliteration (recursed)
 *  4. Unknown        → 0x3F '?'
 */
function toWinAnsiHex(text: string): string {
  let hex = "";
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i) ?? text.charCodeAt(i);
    if (cp > 0xffff) i++; // skip low surrogate of surrogate pair

    if (cp <= 0xff) {
      hex += cp.toString(16).padStart(2, "0");
    } else if (CP1252_EXTRA[cp] !== undefined) {
      hex += CP1252_EXTRA[cp]!.toString(16).padStart(2, "0");
    } else if (UNICODE_XLAT[cp] !== undefined) {
      // Transliteration is ASCII — recursion terminates immediately
      hex += toWinAnsiHex(UNICODE_XLAT[cp]!);
    } else {
      hex += "3f"; // '?'
    }
  }
  return hex.toUpperCase();
}


export function generateRoundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  radii: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  },
): string {
  const k = 0.55228475;
  const maxR = Math.min(w / 2, h / 2);
  const r1 = Math.max(0, Math.min(radii.topLeft, maxR));
  const r2 = Math.max(0, Math.min(radii.topRight, maxR));
  const r3 = Math.max(0, Math.min(radii.bottomRight, maxR));
  const r4 = Math.max(0, Math.min(radii.bottomLeft, maxR));

  if (r1 === 0 && r2 === 0 && r3 === 0 && r4 === 0) {
    return `${x.toFixed(4)} ${y.toFixed(4)} ${w.toFixed(4)} ${h.toFixed(4)} re`;
  }

  const ops: string[] = [];
  ops.push(
    `${(x + r1).toFixed(4)} ${(y + h).toFixed(4)} m`,
    `${(x + w - r2).toFixed(4)} ${(y + h).toFixed(4)} l`,
  );
  if (r2 > 0) {
    ops.push(
      `${(x + w - r2 * (1 - k)).toFixed(4)} ${(y + h).toFixed(4)} ${(x + w).toFixed(4)} ${(y + h - r2 * (1 - k)).toFixed(4)} ${(x + w).toFixed(4)} ${(y + h - r2).toFixed(4)} c`,
    );
  }
  ops.push(`${(x + w).toFixed(4)} ${(y + r3).toFixed(4)} l`);
  if (r3 > 0) {
    ops.push(
      `${(x + w).toFixed(4)} ${(y + r3 * (1 - k)).toFixed(4)} ${(x + w - r3 * (1 - k)).toFixed(4)} ${y.toFixed(4)} ${(x + w - r3).toFixed(4)} ${y.toFixed(4)} c`,
    );
  }
  ops.push(`${(x + r4).toFixed(4)} ${y.toFixed(4)} l`);
  if (r4 > 0) {
    ops.push(
      `${(x + r4 * (1 - k)).toFixed(4)} ${y.toFixed(4)} ${x.toFixed(4)} ${(y + r4 * (1 - k)).toFixed(4)} ${x.toFixed(4)} ${(y + r4).toFixed(4)} c`,
    );
  }
  ops.push(`${x.toFixed(4)} ${(y + h - r1).toFixed(4)} l`);
  if (r1 > 0) {
    ops.push(
      `${x.toFixed(4)} ${(y + h - r1 * (1 - k)).toFixed(4)} ${(x + r1 * (1 - k)).toFixed(4)} ${(y + h).toFixed(4)} ${(x + r1).toFixed(4)} ${(y + h).toFixed(4)} c`,
    );
  }
  ops.push("h");
  return ops.join("\n");
}

export class PDFContentStream {
  private readonly ops: PDFOp[] = [];

  addRawOp(code: string): void {
    this.ops.push({ type: "raw", code });
  }

  setStrokeColor(color: ColorRGB): void {
    const r = color.r.toFixed(4);
    const g = color.g.toFixed(4);
    const b = color.b.toFixed(4);
    this.ops.push({ type: "raw", code: `${r} ${g} ${b} RG` });
  }

  setFillColor(color: ColorRGB): void {
    const r = color.r.toFixed(4);
    const g = color.g.toFixed(4);
    const b = color.b.toFixed(4);
    this.ops.push({ type: "raw", code: `${r} ${g} ${b} rg` });
  }

  setLineWidth(width: number): void {
    this.ops.push({ type: "raw", code: `${width.toFixed(4)} w` });
  }

  setLineDash(style?: string, lineWidth = 1): void {
    if (style === "dashed") {
      const d1 = (lineWidth * 3).toFixed(4);
      const d2 = (lineWidth * 2).toFixed(4);
      this.ops.push({ type: "raw", code: `[${d1} ${d2}] 0 d 0 J` });
    } else if (style === "dotted") {
      const d1 = lineWidth.toFixed(4);
      const d2 = lineWidth.toFixed(4);
      this.ops.push({ type: "raw", code: `[${d1} ${d2}] 0 d 1 J` });
    } else {
      this.ops.push({ type: "raw", code: "[] 0 d 0 J" });
    }
  }

  drawRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
    fill = false,
    stroke = false,
    radii?: {
      topLeft: number;
      topRight: number;
      bottomRight: number;
      bottomLeft: number;
    },
  ): void {
    if (
      radii &&
      (radii.topLeft > 0 ||
        radii.topRight > 0 ||
        radii.bottomRight > 0 ||
        radii.bottomLeft > 0)
    ) {
      const pathCode = generateRoundedRectPath(x, y, width, height, radii);
      this.ops.push({ type: "raw", code: pathCode });
      if (fill && stroke) {
        this.ops.push({ type: "raw", code: "B" });
      } else if (fill) {
        this.ops.push({ type: "raw", code: "f" });
      } else if (stroke) {
        this.ops.push({ type: "raw", code: "S" });
      }
    } else {
      this.ops.push({
        type: "raw",
        code: `${x.toFixed(4)} ${y.toFixed(4)} ${width.toFixed(4)} ${height.toFixed(4)} re`,
      });
      if (fill && stroke) {
        this.ops.push({ type: "raw", code: "B" });
      } else if (fill) {
        this.ops.push({ type: "raw", code: "f" });
      } else if (stroke) {
        this.ops.push({ type: "raw", code: "S" });
      }
    }
  }

  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    style?: string,
    width = 1,
  ): void {
    if (style) {
      this.setLineDash(style, width);
    }
    this.ops.push(
      { type: "raw", code: `${x1.toFixed(4)} ${y1.toFixed(4)} m` },
      { type: "raw", code: `${x2.toFixed(4)} ${y2.toFixed(4)} l` },
      { type: "raw", code: "S" },
    );
    if (style) {
      this.setLineDash("solid", 1);
    }
  }

  drawText(
    text: string,
    fontAlias: string,
    fontSize: number,
    x: number,
    y: number,
    letterSpacing = 0,
    wordSpacing = 0,
  ): void {
    let hasNonAscii = false;
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 127) {
        hasNonAscii = true;
        break;
      }
    }

    let textOperand: string;
    if (hasNonAscii) {
      const hexStr = toWinAnsiHex(text);
      textOperand = `<${hexStr}>`;
    } else {
      const escapedText = text
        .replaceAll("\\", String.raw`\\`)
        .replaceAll("(", String.raw`\(`)
        .replaceAll(")", String.raw`\)`)
        .replaceAll("\r", String.raw`\r`)
        .replaceAll("\n", String.raw`\n`);
      textOperand = `(${escapedText})`;
    }

    const tcCode = letterSpacing !== 0 ? `${letterSpacing.toFixed(4)} Tc\n` : "";
    const resetTc = letterSpacing !== 0 ? `\n0.0000 Tc` : "";
    const twCode = wordSpacing !== 0 ? `${wordSpacing.toFixed(4)} Tw\n` : "";
    const resetTw = wordSpacing !== 0 ? `\n0.0000 Tw` : "";

    const code =
      `BT\n` +
      tcCode +
      twCode +
      `/${fontAlias} ${fontSize.toFixed(4)} Tf\n` +
      `1 0 0 1 ${x.toFixed(4)} ${y.toFixed(4)} Tm\n` +
      `${textOperand} Tj` +
      resetTw +
      resetTc +
      `\nET`;
    this.ops.push({ type: "raw", code });
  }


  drawTextHex(
    hexString: string,
    fontAlias: string,
    fontSize: number,
    x: number,
    y: number,
    letterSpacing = 0,
    wordSpacing = 0,
  ): void {
    const tcCode =
      letterSpacing !== 0 ? `${letterSpacing.toFixed(4)} Tc\n` : "";
    const resetTc = letterSpacing !== 0 ? `\n0.0000 Tc` : "";
    const twCode = wordSpacing !== 0 ? `${wordSpacing.toFixed(4)} Tw\n` : "";
    const resetTw = wordSpacing !== 0 ? `\n0.0000 Tw` : "";

    const code =
      `BT\n` +
      tcCode +
      twCode +
      `/${fontAlias} ${fontSize.toFixed(4)} Tf\n` +
      `1 0 0 1 ${x.toFixed(4)} ${y.toFixed(4)} Tm\n` +
      `<${hexString}> Tj` +
      resetTw +
      resetTc +
      `\nET`;
    this.ops.push({ type: "raw", code });
  }

  drawCustomText(opts: Omit<DrawCustomTextOp, "type">): void {
    this.ops.push({
      type: "customText",
      ...opts,
    });
  }

  startClip(
    x: number,
    y: number,
    width: number,
    height: number,
    radii?: {
      topLeft: number;
      topRight: number;
      bottomRight: number;
      bottomLeft: number;
    },
  ): void {
    if (
      radii &&
      (radii.topLeft > 0 ||
        radii.topRight > 0 ||
        radii.bottomRight > 0 ||
        radii.bottomLeft > 0)
    ) {
      const pathCode = generateRoundedRectPath(x, y, width, height, radii);
      const code = `q\n${pathCode}\nW\nn`;
      this.ops.push({ type: "raw", code });
    } else {
      const code =
        `q\n` +
        `${x.toFixed(4)} ${y.toFixed(4)} ${width.toFixed(4)} ${height.toFixed(4)} re\n` +
        `W\n` +
        `n`;
      this.ops.push({ type: "raw", code });
    }
  }

  endClip(): void {
    this.ops.push({ type: "raw", code: "Q" });
  }

  drawImage(
    alias: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    const code =
      `q\n` +
      `${width.toFixed(4)} 0 0 ${height.toFixed(4)} ${x.toFixed(4)} ${y.toFixed(4)} cm\n` +
      `/${alias} Do\n` +
      `Q`;
    this.ops.push({ type: "raw", code });
  }

  toString(gidResolver?: GidHexResolver): string {
    const lines: string[] = [];
    for (const op of this.ops) {
      if (op.type === "raw") {
        lines.push(op.code);
      } else if (op.type === "customText") {
        lines.push(this.formatCustomTextOp(op, gidResolver));
      }
    }
    return lines.join("\n");
  }

  private formatCustomTextOp(
    op: DrawCustomTextOp,
    gidResolver?: GidHexResolver,
  ): string {
    const hex = gidResolver ? gidResolver(op.fontName, op.text) : op.text;
    const tcCode =
      op.letterSpacing && op.letterSpacing !== 0
        ? `${op.letterSpacing.toFixed(4)} Tc\n`
        : "";
    const resetTc =
      op.letterSpacing && op.letterSpacing !== 0 ? `\n0.0000 Tc` : "";
    const twCode =
      op.wordSpacing && op.wordSpacing !== 0
        ? `${op.wordSpacing.toFixed(4)} Tw\n`
        : "";
    const resetTw = op.wordSpacing && op.wordSpacing !== 0 ? `\n0.0000 Tw` : "";

    return (
      `BT\n` +
      tcCode +
      twCode +
      `/${op.fontAlias} ${op.fontSize.toFixed(4)} Tf\n` +
      `1 0 0 1 ${op.x.toFixed(4)} ${op.y.toFixed(4)} Tm\n` +
      `<${hex}> Tj` +
      resetTw +
      resetTc +
      `\nET`
    );
  }

  toBytes(gidResolver?: GidHexResolver): Uint8Array {
    return new TextEncoder().encode(this.toString(gidResolver));
  }
}
