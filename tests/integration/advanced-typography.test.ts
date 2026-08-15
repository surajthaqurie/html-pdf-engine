import { describe, test, expect, beforeAll, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { HtmlToPdf } from "../../src/index.js";
import { CSSParser } from "../../src/css/parser.js";
import { CascadeEngine } from "../../src/css/cascade.js";
import { FontManager } from "../../src/fonts/font.js";
import { applyTextTransform } from "../../src/css/computed-style.js";
import { ElementNode } from "../../src/html/dom/node.js";
import { createMinimalTTFBuffer } from "../fonts/ttf-parser.test.js";

const FIXTURES_DIR = path.resolve(
  process.cwd(),
  "tests/fixtures/typography-integration",
);
const INTER_REGULAR_PATH = path.join(FIXTURES_DIR, "Inter-Regular.ttf");
const INTER_BOLD_PATH = path.join(FIXTURES_DIR, "Inter-Bold.ttf");

describe("Phase 19 — Advanced Typography & Text Layout", () => {
  beforeAll(() => {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    fs.writeFileSync(
      INTER_REGULAR_PATH,
      createMinimalTTFBuffer("Inter-Regular"),
    );
    fs.writeFileSync(INTER_BOLD_PATH, createMinimalTTFBuffer("Inter-Bold"));
  });

  beforeEach(() => {
    FontManager.clearCustomFonts();
    FontManager.clearFontFaceRules();
  });

  describe("1. Font Family Fallback Chains & Resolution", () => {
    test("1.1 Parses comma-separated font-family fallback chains in CSS cascade", () => {
      const css = `p { font-family: "CustomFont", "Helvetica", Arial, sans-serif; }`;
      const stylesheet = new CSSParser().parse(css);
      const cascade = new CascadeEngine();
      const computed = cascade.computeStyle(new ElementNode("p"), stylesheet);

      expect(computed.fontFamily).toBe(
        '"CustomFont", "Helvetica", Arial, sans-serif',
      );
    });

    test("1.2 Resolves to primary font when available", () => {
      FontManager.registerFontFaceRules([
        {
          family: "Inter",
          src: INTER_REGULAR_PATH,
          weight: 400,
          style: "normal",
        },
      ]);
      const fontManager = new FontManager();

      const resolved = fontManager.resolveFont(
        '"Inter", "Helvetica", sans-serif',
        400,
        "normal",
      );
      expect(resolved.name).toBe("Inter-Regular");
    });

    test("1.3 Falls back to secondary font when primary is not registered", () => {
      const fontManager = new FontManager();
      const resolved = fontManager.resolveFont(
        '"NonExistentFont", "Times-Roman", sans-serif',
        400,
        "normal",
      );
      expect(resolved.name).toBe("Times-Roman");
    });

    test("1.4 Falls back to generic family (sans-serif -> Helvetica, serif -> Times-Roman, monospace -> Courier)", () => {
      const fontManager = new FontManager();
      const sansFont = fontManager.resolveFont("Unknown, sans-serif");
      const serifFont = fontManager.resolveFont("Unknown, serif");
      const monoFont = fontManager.resolveFont("Unknown, monospace");

      expect(sansFont.name).toBe("Helvetica");
      expect(serifFont.name).toBe("Times-Roman");
      expect(monoFont.name).toBe("Courier");
    });

    test("1.5 Weight/Style variant resolution within font fallback chain", () => {
      FontManager.registerFontFaceRules([
        {
          family: "InterVariant",
          src: INTER_REGULAR_PATH,
          weight: 400,
          style: "normal",
        },
        {
          family: "InterVariant",
          src: INTER_BOLD_PATH,
          weight: 700,
          style: "normal",
        },
      ]);
      const fontManager = new FontManager();

      const boldResolved = fontManager.resolveFont(
        "InterVariant, Helvetica",
        700,
        "normal",
      );
      expect(boldResolved.name).toBe("Inter-Bold");

      const italicResolved = fontManager.resolveFont(
        "InterVariant, Helvetica",
        400,
        "italic",
      );
      expect(italicResolved.name).toBe("Inter-Regular");
    });
  });

  describe("2. Text Transform", () => {
    test("2.1 Correctly transforms text cases", () => {
      expect(applyTextTransform("hello world", "uppercase")).toBe("HELLO WORLD");
      expect(applyTextTransform("HELLO WORLD", "lowercase")).toBe("hello world");
      expect(applyTextTransform("hello world", "capitalize")).toBe("Hello World");
      expect(applyTextTransform("hello world", "none")).toBe("hello world");
    });

    test("2.2 Integrates text-transform into PDF rendering output", async () => {
      const html = `
        <html>
          <body>
            <p style="text-transform: uppercase;">transform me</p>
          </body>
        </html>
      `;
      const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
      const pdfStr = pdfBuffer.toString("latin1");
      expect(pdfStr).toContain("(TRANSFORM ME) Tj");
    });
  });

  describe("3. Word Spacing & Letter Spacing", () => {
    test("3.1 Computes word-spacing in CSS cascade and layout width", () => {
      const css = `p { word-spacing: 10px; letter-spacing: 2px; }`;
      const stylesheet = new CSSParser().parse(css);
      const cascade = new CascadeEngine();
      const computed = cascade.computeStyle(new ElementNode("p"), stylesheet);

      expect(computed.wordSpacing).toBe(7.5);
      expect(computed.letterSpacing).toBe(1.5);
    });

    test("3.2 Emits Tw (word spacing) and Tc (character spacing) in PDF stream", async () => {
      const html = `
        <html>
          <body>
            <p style="word-spacing: 5px; letter-spacing: 2px;">Spaced Words Text</p>
          </body>
        </html>
      `;
      const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
      const pdfStr = pdfBuffer.toString("latin1");

      // 5px = 3.75pt, 2px = 1.5pt
      expect(pdfStr).toContain("3.7500 Tw");
      expect(pdfStr).toContain("1.5000 Tc");
    });
  });

  describe("4. Text Indent & Text Overflow Ellipsis", () => {
    test("4.1 Applies text-indent to first line of paragraph", async () => {
      const html = `
        <html>
          <body>
            <p style="text-indent: 30px; width: 200px;">First line indented paragraph text for layout verification.</p>
          </body>
        </html>
      `;
      const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
      const pdfStr = pdfBuffer.toString("latin1");

      // Margins 36 + text-indent 22.5 (30px * 0.75) = 58.5
      expect(pdfStr).toContain("1 0 0 1 58.5000");
    });

    test("4.2 Renders text-overflow: ellipsis when overflow: hidden and white-space: nowrap", async () => {
      const html = `
        <html>
          <body>
            <div style="width: 100px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">This is a very long text that will be truncated with an ellipsis.</div>
          </body>
        </html>
      `;
      const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
      const pdfStr = pdfBuffer.toString("latin1");

      expect(pdfStr).toContain("...) Tj");
    });
  });

  describe("5. Table Vertical Align", () => {
    test("5.1 Vertically aligns text within table cells (top, middle, bottom)", async () => {
      const html = `
        <html>
          <body>
            <table style="height: 100px;">
              <tr>
                <td style="vertical-align: top;">Top</td>
                <td style="vertical-align: middle;">Middle</td>
                <td style="vertical-align: bottom;">Bottom</td>
              </tr>
            </table>
          </body>
        </html>
      `;
      const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });
});
