import { describe, test, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parseFontFaceRule, parseFontFaceRulesFromCss, FontManager } from "../../src/fonts/font.js";
import { CSSParser } from "../../src/css/parser.js";
import { FontError } from "../../src/errors/pdf-error.js";
import { createMinimalTTFBuffer } from "./ttf-parser.test.js";

const TEST_DIR = path.resolve(process.cwd(), "tests", "fixtures", "tmp-fonts");
const REGULAR_FONT_PATH = path.join(TEST_DIR, "Inter-Regular.ttf");
const BOLD_FONT_PATH = path.join(TEST_DIR, "Inter-Bold.ttf");
const ITALIC_FONT_PATH = path.join(TEST_DIR, "Inter-Italic.ttf");
const INVALID_FONT_PATH = path.join(TEST_DIR, "invalid-font.ttf");

describe("Phase 15 — CSS @font-face Unit & Parser Tests", () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(REGULAR_FONT_PATH, createMinimalTTFBuffer("Inter-Regular"));
    fs.writeFileSync(BOLD_FONT_PATH, createMinimalTTFBuffer("Inter-Bold"));
    fs.writeFileSync(ITALIC_FONT_PATH, createMinimalTTFBuffer("Inter-Italic"));
    fs.writeFileSync(INVALID_FONT_PATH, Buffer.from("NOT_A_VALID_TTF_HEADER"));
  });

  afterAll(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("1. Parses basic @font-face rule", () => {
    const parser = new CSSParser();
    const css = `
      @font-face {
        font-family: "Inter";
        src: url("./Inter-Regular.ttf");
        font-weight: 400;
        font-style: normal;
      }
    `;
    const rules = parser.parse(css);
    const fontFaces = parseFontFaceRulesFromCss(rules);

    expect(fontFaces).toHaveLength(1);
    expect(fontFaces[0]).toEqual({
      family: "Inter",
      src: "./Inter-Regular.ttf",
      weight: 400,
      style: "normal",
      format: undefined,
    });
  });

  test("2. Parses @font-face with format() and quotes", () => {
    const parser = new CSSParser();
    const css = `
      @font-face {
        font-family: 'Inter';
        src: url('Inter-Bold.ttf') format('truetype');
        font-weight: bold;
        font-style: normal;
      }
    `;
    const rules = parser.parse(css);
    const fontFaces = parseFontFaceRulesFromCss(rules);

    expect(fontFaces).toHaveLength(1);
    expect(fontFaces[0]).toEqual({
      family: "Inter",
      src: "Inter-Bold.ttf",
      weight: 700,
      style: "normal",
      format: "truetype",
    });
  });

  test("3. Parses numeric font-weight values (100-900)", () => {
    const decls = {
      "font-family": "Inter",
      src: 'url("./Inter.ttf")',
      "font-weight": "600",
    };
    const rule = parseFontFaceRule(decls);
    expect(rule.weight).toBe(600);
  });

  test("4. Throws FontError on missing font-family", () => {
    const decls = {
      src: 'url("./Inter.ttf")',
    };
    expect(() => parseFontFaceRule(decls)).toThrow(FontError);
    expect(() => parseFontFaceRule(decls)).toThrow("missing font-family");
  });

  test("5. Throws FontError on missing src", () => {
    const decls = {
      "font-family": "Inter",
    };
    expect(() => parseFontFaceRule(decls)).toThrow(FontError);
    expect(() => parseFontFaceRule(decls)).toThrow("missing src");
  });

  test("6. Throws FontError on remote HTTP/HTTPS network URLs", () => {
    const decls = {
      "font-family": "Inter",
      src: 'url("https://fonts.gstatic.com/s/inter.ttf")',
    };
    expect(() => parseFontFaceRule(decls)).toThrow(FontError);
    expect(() => parseFontFaceRule(decls)).toThrow("remote network font URLs");
  });

  test("7. Throws FontError on unsupported font formats (WOFF/WOFF2)", () => {
    const decls1 = {
      "font-family": "Inter",
      src: 'url("./Inter.woff") format("woff")',
    };
    expect(() => parseFontFaceRule(decls1)).toThrow(FontError);
    expect(() => parseFontFaceRule(decls1)).toThrow("unsupported font format");

    const decls2 = {
      "font-family": "Inter",
      src: 'url("./Inter.woff2")',
    };
    expect(() => parseFontFaceRule(decls2)).toThrow(FontError);
    expect(() => parseFontFaceRule(decls2)).toThrow("unsupported font format");
  });

  test("8. Throws FontError on invalid font-weight descriptor", () => {
    const decls = {
      "font-family": "Inter",
      src: 'url("./Inter.ttf")',
      "font-weight": "super-heavy",
    };
    expect(() => parseFontFaceRule(decls)).toThrow(FontError);
    expect(() => parseFontFaceRule(decls)).toThrow("Invalid @font-face descriptor font-weight");
  });

  test("9. Throws FontError on invalid font-style descriptor", () => {
    const decls = {
      "font-family": "Inter",
      src: 'url("./Inter.ttf")',
      "font-style": "slanted",
    };
    expect(() => parseFontFaceRule(decls)).toThrow(FontError);
    expect(() => parseFontFaceRule(decls)).toThrow("Invalid @font-face descriptor font-style");
  });

  test("10. FontManager resolves @font-face rule variants", () => {
    FontManager.clearFontFaceRules();
    FontManager.registerFontFaceRules(
      [
        { family: "InterTest", src: REGULAR_FONT_PATH, weight: 400, style: "normal" },
        { family: "InterTest", src: BOLD_FONT_PATH, weight: 700, style: "normal" },
        { family: "InterTest", src: ITALIC_FONT_PATH, weight: 400, style: "italic" },
      ],
      TEST_DIR,
    );

    const fm = new FontManager();
    const regFont = fm.resolveFont("InterTest", 400, "normal");
    const boldFont = fm.resolveFont("InterTest", "bold", "normal");
    const italicFont = fm.resolveFont("InterTest", 400, "italic");

    expect(regFont.name).toBe("Inter-Regular");
    expect(boldFont.name).toBe("Inter-Bold");
    expect(italicFont.name).toBe("Inter-Italic");
  });

  test("11. FontManager throws FontError if referenced TTF file does not exist", () => {
    FontManager.clearFontFaceRules();
    FontManager.registerFontFaceRules([
      { family: "MissingFont", src: "./non-existent.ttf", weight: 400, style: "normal" },
    ]);

    const fm = new FontManager();
    expect(() => fm.resolveFont("MissingFont", 400, "normal")).toThrow(FontError);
  });

  test("12. FontManager throws FontError if referenced TTF file is corrupt", () => {
    FontManager.clearFontFaceRules();
    FontManager.registerFontFaceRules([
      { family: "CorruptFont", src: INVALID_FONT_PATH, weight: 400, style: "normal" },
    ]);

    const fm = new FontManager();
    expect(() => fm.resolveFont("CorruptFont", 400, "normal")).toThrow(FontError);
  });
});
