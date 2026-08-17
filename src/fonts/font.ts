import * as path from "path";
import * as fs from "fs";
import { FontError } from "../errors/pdf-error.js";
import { FontMetrics, STANDARD_FONT_METRICS } from "./font-metrics.js";
import { parseTTF, ParsedTTF } from "./ttf-parser.js";
import { CSSRule } from "../css/parser.js";

export interface FontVariantSource {
  regular: string | Buffer;
  bold?: string | Buffer;
  italic?: string | Buffer;
  boldItalic?: string | Buffer;
}

export type CustomFontMap = Record<string, FontVariantSource>;

export interface FontFaceRule {
  family: string;
  src: string;
  weight: number;
  style: "normal" | "italic" | "oblique";
  format?: string;
  basePath?: string;
}

export class Font {
  public readonly metrics: FontMetrics;
  public readonly isCustom: boolean;
  public readonly parsedTTF?: ParsedTTF;
  private readonly asciiWidths: Uint16Array = new Uint16Array(256);

  constructor(
    public readonly name: string,
    parsedTTF?: ParsedTTF,
  ) {
    if (parsedTTF) {
      this.isCustom = true;
      this.parsedTTF = parsedTTF;
      this.metrics = {
        name: parsedTTF.postScriptName,
        unitsPerEm: parsedTTF.unitsPerEm,
        ascent: parsedTTF.ascent,
        descent: parsedTTF.descent,
        defaultWidth: 500,
        widths: {},
      };
    } else {
      this.isCustom = false;
      const metrics = STANDARD_FONT_METRICS[name];
      if (!metrics) {
        const defaultMetrics = STANDARD_FONT_METRICS["Helvetica"];
        if (!defaultMetrics) {
          throw new FontError(`Unknown font: ${name}`);
        }
        this.metrics = defaultMetrics;
      } else {
        this.metrics = metrics;
      }

      // Pre-populate ASCII lookup array for O(1) character width access
      this.asciiWidths.fill(this.metrics.defaultWidth);
      for (const [codeStr, width] of Object.entries(this.metrics.widths)) {
        const code = parseInt(codeStr, 10);
        if (code >= 0 && code < 256) {
          this.asciiWidths[code] = width;
        }
      }
    }
  }

  charToGid(codePoint: number): number {
    if (this.isCustom && this.parsedTTF) {
      return this.parsedTTF.cmap.get(codePoint) ?? 0;
    }
    return codePoint;
  }

  getCharWidth(codePoint: number): number {
    if (this.isCustom && this.parsedTTF) {
      const gid = this.charToGid(codePoint);
      const advanceWidth =
        this.parsedTTF.hmtx[gid] ?? this.parsedTTF.hmtx[0] ?? 0;
      return Math.round((advanceWidth * 1000) / this.parsedTTF.unitsPerEm);
    }
    if (codePoint < 256) {
      return this.asciiWidths[codePoint] ?? this.metrics.defaultWidth;
    }
    return this.metrics.defaultWidth;
  }

  /**
   * Fast text width measurement in points.
   */
  /**
   * Fast text width measurement in points.
   */
  measureTextWidth(
    text: string,
    fontSize: number,
    letterSpacing: number = 0,
    wordSpacing: number = 0,
  ): number {
    let totalUnits = 0;
    const len = text.length;
    let spaceCount = 0;

    for (let i = 0; i < len; i++) {
      const code = text.charCodeAt(i);
      totalUnits += this.getCharWidth(code);
      if (code === 32) {
        spaceCount++;
      }
    }

    const baseWidth = (totalUnits * fontSize) / 1000;
    const extraLetter = len > 1 ? (len - 1) * letterSpacing : 0;
    const extraWord = spaceCount * wordSpacing;
    return baseWidth + extraLetter + extraWord;
  }

  getAscent(fontSize: number): number {
    return (this.metrics.ascent * fontSize) / this.metrics.unitsPerEm;
  }

  getDescent(fontSize: number): number {
    return (
      (Math.abs(this.metrics.descent) * fontSize) / this.metrics.unitsPerEm
    );
  }

  getLineHeight(fontSize: number): number {
    return (
      ((this.metrics.ascent - this.metrics.descent) * fontSize) /
      this.metrics.unitsPerEm
    );
  }
}

export function parseFontFamilyChain(familyStr: string): string[] {
  if (!familyStr) return ["Helvetica"];
  const list: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < familyStr.length; i++) {
    const char = familyStr[i];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (char === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (char === "," && !inSingle && !inDouble) {
      const clean = current.trim().replace(/^['"]|['"]$/g, "").trim();
      if (clean) list.push(clean);
      current = "";
      continue;
    }
    current += char;
  }
  const clean = current.trim().replace(/^['"]|['"]$/g, "").trim();
  if (clean) list.push(clean);
  return list.length > 0 ? list : ["Helvetica"];
}

export class FontManager {
  private static globalInstanceMap = new Map<string, Font>();
  private static globalCustomFontMap = new Map<string, FontVariantSource>();
  private static globalFontFaceRulesMap = new Map<string, (FontFaceRule & { basePath?: string })[]>();
  private static globalFontToFamilyMap = new Map<string, string>();
  private static globalResolutionCache = new Map<string, Font>();

  private instanceMap = new Map<string, Font>();
  private customFontMap = new Map<string, FontVariantSource>();
  private fontFaceRulesMap = new Map<string, (FontFaceRule & { basePath?: string })[]>();
  private fontToFamilyMap = new Map<string, string>();
  private resolutionCache = new Map<string, Font>();

  static clearCustomFonts(): void {
    FontManager.globalCustomFontMap.clear();
    FontManager.globalInstanceMap.clear();
    FontManager.globalFontToFamilyMap.clear();
    FontManager.globalResolutionCache.clear();
  }

  static clearFontFaceRules(): void {
    FontManager.globalFontFaceRulesMap.clear();
    FontManager.globalInstanceMap.clear();
    FontManager.globalFontToFamilyMap.clear();
    FontManager.globalResolutionCache.clear();
  }

  static registerCustomFonts(fonts: CustomFontMap): void {
    FontManager.doRegisterCustomFonts(
      fonts,
      FontManager.globalCustomFontMap,
      FontManager.globalFontToFamilyMap,
      FontManager.globalInstanceMap,
    );
  }

  static registerFontFaceRules(
    rules: FontFaceRule[],
    basePath?: string,
  ): void {
    FontManager.doRegisterFontFaceRules(
      rules,
      FontManager.globalFontFaceRulesMap,
      basePath,
    );
  }

  private static doRegisterCustomFonts(
    fonts: CustomFontMap,
    customMap: Map<string, FontVariantSource>,
    familyMap: Map<string, string>,
    instMap: Map<string, Font>,
  ): void {
    for (const [familyName, variant] of Object.entries(fonts)) {
      customMap.set(familyName, variant);
      customMap.set(familyName.toLowerCase(), variant);

      for (const src of [
        variant.regular,
        variant.bold,
        variant.italic,
        variant.boldItalic,
      ]) {
        if (src) {
          const parsed = parseTTF(src, familyName);
          customMap.set(parsed.postScriptName, variant);
          customMap.set(parsed.postScriptName.toLowerCase(), variant);
          familyMap.set(parsed.postScriptName, familyName);
          familyMap.set(parsed.postScriptName.toLowerCase(), familyName);
          let font =
            instMap.get(parsed.postScriptName) ??
            FontManager.globalInstanceMap.get(parsed.postScriptName);
          if (!font) {
            font = new Font(parsed.postScriptName, parsed);
            instMap.set(parsed.postScriptName, font);
            FontManager.globalInstanceMap.set(parsed.postScriptName, font);
          }
        }
      }
    }
  }

  private static doRegisterFontFaceRules(
    rules: FontFaceRule[],
    rulesMap: Map<string, (FontFaceRule & { basePath?: string })[]>,
    basePath?: string,
  ): void {
    for (const rule of rules) {
      const key = rule.family.toLowerCase();
      let list = rulesMap.get(key);
      if (!list) {
        list = [];
        rulesMap.set(key, list);
      }
      const entry: FontFaceRule & { basePath?: string } = { ...rule };
      if (basePath !== undefined) {
        entry.basePath = basePath;
      }
      list.push(entry);
    }
  }

  clearCustomFonts(): void {
    this.customFontMap.clear();
    this.instanceMap.clear();
    this.fontToFamilyMap.clear();
    this.resolutionCache.clear();
  }

  clearFontFaceRules(): void {
    this.fontFaceRulesMap.clear();
    this.instanceMap.clear();
    this.fontToFamilyMap.clear();
    this.resolutionCache.clear();
  }

  registerCustomFonts(fonts: CustomFontMap): void {
    FontManager.doRegisterCustomFonts(
      fonts,
      this.customFontMap,
      this.fontToFamilyMap,
      this.instanceMap,
    );
  }

  registerFontFaceRules(rules: FontFaceRule[], basePath?: string): void {
    FontManager.doRegisterFontFaceRules(
      rules,
      this.fontFaceRulesMap,
      basePath,
    );
  }

  getFont(name: string): Font {
    let font =
      this.instanceMap.get(name) ?? FontManager.globalInstanceMap.get(name);
    if (!font) {
      font = new Font(name);
      this.instanceMap.set(name, font);
      FontManager.globalInstanceMap.set(name, font);
    }
    return font;
  }

  resolveFont(
    family: string,
    weight: "normal" | "bold" | number | string = "normal",
    style: "normal" | "italic" | "oblique" = "normal",
  ): Font {
    const cacheKey = `${family.toLowerCase()}:${weight}:${style}`;
    const cached =
      this.resolutionCache.get(cacheKey) ??
      FontManager.globalResolutionCache.get(cacheKey);
    if (cached) return cached;

    const font = this.doResolveFont(family, weight, style);
    this.resolutionCache.set(cacheKey, font);
    return font;
  }

  private doResolveFont(
    familyChain: string,
    weight: "normal" | "bold" | number | string = "normal",
    style: "normal" | "italic" | "oblique" = "normal",
  ): Font {
    const isBold =
      weight === "bold" ||
      weight === 700 ||
      (typeof weight === "number" && weight >= 600) ||
      (typeof weight === "string" && parseInt(weight, 10) >= 600);
    const isItalic = style === "italic" || style === "oblique";

    const families = parseFontFamilyChain(familyChain);

    for (const family of families) {
      const famLower = family.toLowerCase();

      // 0. Check if family is an already loaded custom font in instanceMap
      const existingFont =
        this.instanceMap.get(family) ??
        this.instanceMap.get(famLower) ??
        FontManager.globalInstanceMap.get(family) ??
        FontManager.globalInstanceMap.get(famLower);

      if (existingFont) {
        if (!existingFont.isCustom && (famLower === "helvetica" || famLower === "arial" || famLower === "sans-serif" || famLower === "times" || famLower === "times-roman" || famLower === "times new roman" || famLower === "serif" || famLower === "courier" || famLower === "monospace")) {
          // Let it fall through to generic standard font handling below
        } else {
          const originalFamily =
            this.fontToFamilyMap.get(family) ??
            this.fontToFamilyMap.get(famLower) ??
            FontManager.globalFontToFamilyMap.get(family) ??
            FontManager.globalFontToFamilyMap.get(famLower);

          if (!isBold && !isItalic) {
            return existingFont;
          }
          if (
            isBold &&
            (famLower.includes("bold") ||
              existingFont.name.toLowerCase().includes("bold"))
          ) {
            return existingFont;
          }
          if (
            isItalic &&
            (famLower.includes("italic") ||
              existingFont.name.toLowerCase().includes("italic"))
          ) {
            return existingFont;
          }
          if (
            originalFamily &&
            originalFamily.toLowerCase() !== famLower
          ) {
            return this.doResolveFont(originalFamily, weight, style);
          }
          return existingFont;
        }
      }

      // 1. Check customFontMap (options.fonts API takes precedence)
      const customVariant =
        this.customFontMap.get(family) ??
        this.customFontMap.get(famLower) ??
        FontManager.globalCustomFontMap.get(family) ??
        FontManager.globalCustomFontMap.get(famLower);

      if (customVariant) {
        let source: string | Buffer;
        if (isBold && isItalic && customVariant.boldItalic) {
          source = customVariant.boldItalic;
        } else if (isBold && customVariant.bold) {
          source = customVariant.bold;
        } else if (isItalic && customVariant.italic) {
          source = customVariant.italic;
        } else {
          source = customVariant.regular;
        }

        const parsed = parseTTF(source, family);
        this.fontToFamilyMap.set(parsed.postScriptName, family);
        FontManager.globalFontToFamilyMap.set(parsed.postScriptName, family);
        let font =
          this.instanceMap.get(parsed.postScriptName) ??
          FontManager.globalInstanceMap.get(parsed.postScriptName);
        if (!font) {
          font = new Font(parsed.postScriptName, parsed);
          this.instanceMap.set(parsed.postScriptName, font);
          FontManager.globalInstanceMap.set(parsed.postScriptName, font);
        }
        return font;
      }

      // 2. Check CSS @font-face rules
      const fontFaceRules =
        this.fontFaceRulesMap.get(famLower) ??
        FontManager.globalFontFaceRulesMap.get(famLower);
      if (fontFaceRules && fontFaceRules.length > 0) {
        const bestRule = this.findBestFontFaceRule(fontFaceRules, weight, style);
        if (bestRule) {
          let fontPath = bestRule.src;
          if (fontPath.startsWith("data:")) {
            const parsed = parseTTF(fontPath, family);
            this.fontToFamilyMap.set(parsed.postScriptName, family);
            FontManager.globalFontToFamilyMap.set(parsed.postScriptName, family);
            let font =
              this.instanceMap.get(parsed.postScriptName) ??
              FontManager.globalInstanceMap.get(parsed.postScriptName);
            if (!font) {
              font = new Font(parsed.postScriptName, parsed);
              this.instanceMap.set(parsed.postScriptName, font);
              FontManager.globalInstanceMap.set(parsed.postScriptName, font);
            }
            return font;
          }

          if (fontPath.startsWith("file://")) {
            fontPath = fontPath.slice(7);
          }
          if (!path.isAbsolute(fontPath)) {
            const rootDir = bestRule.basePath ?? process.cwd();
            fontPath = path.resolve(rootDir, fontPath);
          }

          if (!fs.existsSync(fontPath)) {
            throw new FontError(
              `Unable to load font "${family}": file "${fontPath}" does not exist`,
            );
          }

          const parsed = parseTTF(fontPath, family);
          this.fontToFamilyMap.set(parsed.postScriptName, family);
          FontManager.globalFontToFamilyMap.set(parsed.postScriptName, family);
          let font =
            this.instanceMap.get(parsed.postScriptName) ??
            FontManager.globalInstanceMap.get(parsed.postScriptName);
          if (!font) {
            font = new Font(parsed.postScriptName, parsed);
            this.instanceMap.set(parsed.postScriptName, font);
            FontManager.globalInstanceMap.set(parsed.postScriptName, font);
          }
          return font;
        }
      }

      // 3. Check Standard / Generic PDF font family aliases
      if (
        famLower === "helvetica" ||
        famLower === "arial" ||
        famLower === "sans-serif"
      ) {
        let standardName = "Helvetica";
        if (isBold && isItalic) standardName = "Helvetica-BoldOblique";
        else if (isBold) standardName = "Helvetica-Bold";
        else if (isItalic) standardName = "Helvetica-Oblique";
        return this.getFont(standardName);
      }

      if (
        famLower === "times" ||
        famLower === "times-roman" ||
        famLower === "times new roman" ||
        famLower === "serif"
      ) {
        let standardName = "Times-Roman";
        if (isBold && isItalic) standardName = "Times-BoldItalic";
        else if (isBold) standardName = "Times-Bold";
        else if (isItalic) standardName = "Times-Italic";
        return this.getFont(standardName);
      }

      if (
        famLower === "courier" ||
        famLower === "courier new" ||
        famLower === "monospace"
      ) {
        let standardName = "Courier";
        if (isBold && isItalic) standardName = "Courier-BoldOblique";
        else if (isBold) standardName = "Courier-Bold";
        else if (isItalic) standardName = "Courier-Oblique";
        return this.getFont(standardName);
      }
    }

    // 4. Ultimate Fallback to Helvetica
    let fallbackName = "Helvetica";
    if (isBold && isItalic) fallbackName = "Helvetica-BoldOblique";
    else if (isBold) fallbackName = "Helvetica-Bold";
    else if (isItalic) fallbackName = "Helvetica-Oblique";
    return this.getFont(fallbackName);
  }

  private findBestFontFaceRule(
    rules: FontFaceRule[],
    weight: "normal" | "bold" | number | string,
    style: "normal" | "italic" | "oblique",
  ): FontFaceRule | null {
    if (rules.length === 0) return null;

    let reqWeight = 400;
    if (weight === "bold") reqWeight = 700;
    else if (weight === "normal") reqWeight = 400;
    else if (typeof weight === "number") reqWeight = weight;
    else {
      const p = parseInt(weight, 10);
      reqWeight = isNaN(p) ? 400 : p;
    }

    const reqItalic = style === "italic" || style === "oblique";

    // 1. Filter by style
    let candidates = rules.filter((r) => {
      const rItalic = r.style === "italic" || r.style === "oblique";
      return rItalic === reqItalic;
    });
    if (candidates.length === 0) {
      candidates = rules;
    }

    // 2. Exact weight match
    const exact = candidates.find((r) => r.weight === reqWeight);
    if (exact) return exact;

    // 3. Weight range matching heuristic
    if (reqWeight >= 600) {
      const higherOrEqual = candidates
        .filter((r) => r.weight >= reqWeight)
        .sort((a, b) => a.weight - b.weight);
      if (higherOrEqual.length > 0 && higherOrEqual[0]) return higherOrEqual[0];

      const lower = candidates
        .filter((r) => r.weight < reqWeight)
        .sort((a, b) => b.weight - a.weight);
      if (lower.length > 0 && lower[0]) return lower[0];
    } else if (reqWeight < 400) {
      const lowerOrEqual = candidates
        .filter((r) => r.weight <= reqWeight)
        .sort((a, b) => b.weight - a.weight);
      if (lowerOrEqual.length > 0 && lowerOrEqual[0]) return lowerOrEqual[0];

      const higher = candidates
        .filter((r) => r.weight > reqWeight)
        .sort((a, b) => a.weight - b.weight);
      if (higher.length > 0 && higher[0]) return higher[0];
    } else {
      const sorted = [...candidates].sort(
        (a, b) =>
          Math.abs(a.weight - reqWeight) - Math.abs(b.weight - reqWeight),
      );
      if (sorted.length > 0 && sorted[0]) return sorted[0];
    }

    return candidates[0] ?? null;
  }
}

export function parseFontFaceRule(
  declarations: Record<string, string>,
): FontFaceRule {
  const familyRaw = declarations["font-family"];
  if (!familyRaw) {
    throw new FontError("Invalid @font-face declaration: missing font-family");
  }
  const family = familyRaw.replace(/^['"]|['"]$/g, "").trim();
  if (!family) {
    throw new FontError("Invalid @font-face declaration: empty font-family");
  }

  const srcRaw = declarations["src"];
  if (!srcRaw) {
    throw new FontError(
      `Invalid @font-face declaration for "${family}": missing src`,
    );
  }

  if (srcRaw.includes("http://") || srcRaw.includes("https://")) {
    throw new FontError(
      `Unable to load font "${family}": remote network font URLs ("http/https") are not supported`,
    );
  }

  const urlMatch = srcRaw.match(/url\((?:['"]?)([^'")]+)(?:['"]?)\)/i);
  if (!urlMatch || !urlMatch[1]) {
    throw new FontError(
      `Invalid @font-face declaration for "${family}": missing valid url() in src`,
    );
  }
  const urlStr = urlMatch[1].trim();

  const formatMatch = srcRaw.match(/format\((?:['"]?)([^'")]+)(?:['"]?)\)/i);
  const formatStr =
    formatMatch && formatMatch[1]
      ? formatMatch[1].toLowerCase().trim()
      : undefined;

  if (
    formatStr &&
    !["truetype", "opentype", "embedded-opentype"].includes(formatStr)
  ) {
    throw new FontError(
      `Unable to load font "${family}": unsupported font format "${formatStr}"`,
    );
  }

  const ext = urlStr.split(".").pop()?.toLowerCase();
  if (
    (ext === "woff" || ext === "woff2") &&
    (!formatStr || formatStr === "woff" || formatStr === "woff2")
  ) {
    throw new FontError(
      `Unable to load font "${family}": unsupported font format "${ext}"`,
    );
  }

  let weight = 400;
  const weightRaw = declarations["font-weight"]?.toLowerCase()?.trim();
  if (weightRaw) {
    if (weightRaw === "normal") {
      weight = 400;
    } else if (weightRaw === "bold") {
      weight = 700;
    } else {
      const parsedW = parseInt(weightRaw, 10);
      if (isNaN(parsedW) || parsedW < 100 || parsedW > 900) {
        throw new FontError(
          `Invalid @font-face descriptor font-weight: "${weightRaw}"`,
        );
      }
      weight = parsedW;
    }
  }

  let style: "normal" | "italic" | "oblique" = "normal";
  const styleRaw = declarations["font-style"]?.toLowerCase()?.trim();
  if (styleRaw) {
    if (styleRaw === "normal") style = "normal";
    else if (styleRaw === "italic") style = "italic";
    else if (styleRaw === "oblique") style = "oblique";
    else {
      throw new FontError(
        `Invalid @font-face descriptor font-style: "${styleRaw}"`,
      );
    }
  }

  const rule: FontFaceRule = {
    family,
    src: urlStr,
    weight,
    style,
  };
  if (formatStr !== undefined) {
    rule.format = formatStr;
  }
  return rule;
}

export function parseFontFaceRulesFromCss(rules: CSSRule[]): FontFaceRule[] {
  const fontFaceRules: FontFaceRule[] = [];
  const fontRules = rules.filter((r) =>
    r.selector.trim().toLowerCase().startsWith("@font-face"),
  );
  for (const rule of fontRules) {
    const fontFace = parseFontFaceRule(rule.declarations);
    fontFaceRules.push(fontFace);
  }
  return fontFaceRules;
}
