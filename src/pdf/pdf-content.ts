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

type PDFOp =
  | { type: "raw"; code: string }
  | DrawCustomTextOp;

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
    `${(x + w - r2).toFixed(4)} ${(y + h).toFixed(4)} l`
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
    if (radii && (radii.topLeft > 0 || radii.topRight > 0 || radii.bottomRight > 0 || radii.bottomLeft > 0)) {
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
      { type: "raw", code: "S" }
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
    const escapedText = text
      .replaceAll("\\", String.raw`\\`)
      .replaceAll("(", String.raw`\(`)
      .replaceAll(")", String.raw`\)`)
      .replaceAll("\r", String.raw`\r`)
      .replaceAll("\n", String.raw`\n`);

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
      `(${escapedText}) Tj` +
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
    if (radii && (radii.topLeft > 0 || radii.topRight > 0 || radii.bottomRight > 0 || radii.bottomLeft > 0)) {
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

  private formatCustomTextOp(op: DrawCustomTextOp, gidResolver?: GidHexResolver): string {
    const hex = gidResolver
      ? gidResolver(op.fontName, op.text)
      : op.text;
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
    const resetTw =
      op.wordSpacing && op.wordSpacing !== 0 ? `\n0.0000 Tw` : "";

    return `BT\n` +
      tcCode +
      twCode +
      `/${op.fontAlias} ${op.fontSize.toFixed(4)} Tf\n` +
      `1 0 0 1 ${op.x.toFixed(4)} ${op.y.toFixed(4)} Tm\n` +
      `<${hex}> Tj` +
      resetTw +
      resetTc +
      `\nET`;
  }

  toBytes(gidResolver?: GidHexResolver): Uint8Array {
    return new TextEncoder().encode(this.toString(gidResolver));
  }
}
