import { NAMED_COLORS } from "../../constants/css.js";
import { CssParseError } from "../../errors/pdf-error.js";

const DEFAULT_FONT_SIZE = 12;

export interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

function makeColor(r: number, g: number, b: number, a = 1): ParsedColor {
  const normR = Math.max(0, Math.min(1, r));
  const normG = Math.max(0, Math.min(1, g));
  const normB = Math.max(0, Math.min(1, b));
  const normA = Math.max(0, Math.min(1, a));

  if (normA !== 1) {
    return { r: normR, g: normG, b: normB, a: normA };
  }
  return { r: normR, g: normG, b: normB };
}

export function parseCssColor(colorStr: string): ParsedColor {
  const fallback: ParsedColor = { r: 0, g: 0, b: 0 };
  if (!colorStr) return fallback;
  const str = colorStr.trim().toLowerCase();

  if (str === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const named = NAMED_COLORS[str];
  if (named) {
    return makeColor(named.r, named.g, named.b, 1);
  }

  if (str.startsWith("#")) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      const r = parseInt((hex[0] ?? "0") + (hex[0] ?? "0"), 16) / 255;
      const g = parseInt((hex[1] ?? "0") + (hex[1] ?? "0"), 16) / 255;
      const b = parseInt((hex[2] ?? "0") + (hex[2] ?? "0"), 16) / 255;
      return isNaN(r) || isNaN(g) || isNaN(b) ? fallback : makeColor(r, g, b, 1);
    }
    if (hex.length === 4) {
      const r = parseInt((hex[0] ?? "0") + (hex[0] ?? "0"), 16) / 255;
      const g = parseInt((hex[1] ?? "0") + (hex[1] ?? "0"), 16) / 255;
      const b = parseInt((hex[2] ?? "0") + (hex[2] ?? "0"), 16) / 255;
      const a = parseInt((hex[3] ?? "0") + (hex[3] ?? "0"), 16) / 255;
      return isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)
        ? fallback
        : makeColor(r, g, b, a);
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return isNaN(r) || isNaN(g) || isNaN(b) ? fallback : makeColor(r, g, b, 1);
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      return isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)
        ? fallback
        : makeColor(r, g, b, a);
    }
  }

  if (str.startsWith("rgb")) {
    const match = str.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const raw = match[1].replace(/\//g, ",").trim();
      const parts = raw
        .split(/[\s,]+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (parts.length >= 3) {
        const parseVal = (v: string): number => {
          if (v.endsWith("%")) {
            return (parseFloat(v.slice(0, -1)) / 100) * 255;
          }
          return parseFloat(v);
        };
        const parseAlpha = (v?: string): number => {
          if (!v) return 1;
          if (v.endsWith("%")) {
            return parseFloat(v.slice(0, -1)) / 100;
          }
          return parseFloat(v);
        };

        const rVal = parseVal(parts[0] ?? "0");
        const gVal = parseVal(parts[1] ?? "0");
        const bVal = parseVal(parts[2] ?? "0");
        const aVal = parseAlpha(parts[3]);

        if (
          !isNaN(rVal) &&
          !isNaN(gVal) &&
          !isNaN(bVal) &&
          !isNaN(aVal)
        ) {
          return makeColor(rVal / 255, gVal / 255, bVal / 255, aVal);
        }
      }
    }
  }

  if (str.startsWith("hsl")) {
    const match = str.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const raw = match[1].replace(/\//g, ",").trim();
      const parts = raw
        .split(/[\s,]+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (parts.length >= 3) {
        let h = 0;
        const hStr = parts[0] ?? "0";
        if (hStr.endsWith("deg")) h = parseFloat(hStr.slice(0, -3));
        else if (hStr.endsWith("rad"))
          h = parseFloat(hStr.slice(0, -3)) * (180 / Math.PI);
        else if (hStr.endsWith("turn")) h = parseFloat(hStr.slice(0, -4)) * 360;
        else h = parseFloat(hStr);

        const parsePercent = (v: string): number => {
          if (v.endsWith("%")) return parseFloat(v.slice(0, -1)) / 100;
          return parseFloat(v);
        };
        const parseAlpha = (v?: string): number => {
          if (!v) return 1;
          if (v.endsWith("%")) return parseFloat(v.slice(0, -1)) / 100;
          return parseFloat(v);
        };

        const s = parsePercent(parts[1] ?? "0");
        const l = parsePercent(parts[2] ?? "0");
        const a = parseAlpha(parts[3]);

        if (!isNaN(h) && !isNaN(s) && !isNaN(l) && !isNaN(a)) {
          const { r, g, b } = hslToRgb(h, s, l);
          return makeColor(r, g, b, a);
        }
      }
    }
  }

  return fallback;
}

function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const normH = ((h % 360) + 360) % 360;
  const normS = Math.max(0, Math.min(1, s));
  const normL = Math.max(0, Math.min(1, l));

  const c = (1 - Math.abs(2 * normL - 1)) * normS;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = normL - c / 2;

  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (0 <= normH && normH < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (60 <= normH && normH < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (120 <= normH && normH < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (180 <= normH && normH < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (240 <= normH && normH < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else if (300 <= normH && normH < 360) {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  return {
    r: r1 + m,
    g: g1 + m,
    b: b1 + m,
  };
}

export function parseCssUnit(
  valStr: string | number,
  relativeBase: number = DEFAULT_FONT_SIZE,
): number {
  if (typeof valStr === "number") return valStr;
  if (!valStr || typeof valStr !== "string") return 0;
  const str = valStr.trim().toLowerCase();

  if (str === "0" || str === "auto") return 0;

  if (str.endsWith("%")) {
    const num = parseFloat(str.slice(0, -1));
    return isNaN(num) ? 0 : (num / 100) * relativeBase;
  }

  if (str.endsWith("px")) {
    const num = parseFloat(str.slice(0, -2));
    return isNaN(num) ? 0 : num * 0.75;
  }

  if (str.endsWith("pt")) {
    const num = parseFloat(str.slice(0, -2));
    return isNaN(num) ? 0 : num;
  }

  if (str.endsWith("em") || str.endsWith("rem")) {
    const num = parseFloat(str.replace(/(em|rem)$/, ""));
    return isNaN(num) ? 0 : num * relativeBase;
  }

  if (str.endsWith("in")) {
    const num = parseFloat(str.slice(0, -2));
    return isNaN(num) ? 0 : num * 72;
  }

  if (str.endsWith("cm")) {
    const num = parseFloat(str.slice(0, -2));
    return isNaN(num) ? 0 : num * (72 / 2.54);
  }

  if (str.endsWith("mm")) {
    const num = parseFloat(str.slice(0, -2));
    return isNaN(num) ? 0 : num * (72 / 25.4);
  }

  const num = parseFloat(str);
  if (!isNaN(num)) {
    return num;
  }

  throw new CssParseError(`Invalid CSS unit: ${valStr}`);
}
