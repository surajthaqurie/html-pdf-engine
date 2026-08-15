import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import { parseCssColor } from "../../src/css/values/units.js";
import { CascadeEngine } from "../../src/css/cascade.js";
import { HTMLParser } from "../../src/html/parser.js";
import { ElementNode } from "../../src/html/dom/node.js";

describe("Phase 18 — Advanced CSS & Rendering Compatibility", () => {
  const parser = new HTMLParser();

  describe("1. CSS Color Functions", () => {
    it("should parse rgb() and rgba() colors correctly", () => {
      const c1 = parseCssColor("rgb(255, 128, 0)");
      expect(c1.r).toBeCloseTo(1, 2);
      expect(c1.g).toBeCloseTo(0.5, 2);
      expect(c1.b).toBe(0);

      const c2 = parseCssColor("rgba(0, 255, 128, 0.5)");
      expect(c2.r).toBe(0);
      expect(c2.g).toBe(1);
      expect(c2.b).toBeCloseTo(0.5, 2);
      expect(c2.a).toBe(0.5);
    });

    it("should parse hsl() and hsla() colors correctly", () => {
      const c1 = parseCssColor("hsl(0, 100%, 50%)"); // pure red
      expect(c1.r).toBeCloseTo(1, 2);
      expect(c1.g).toBe(0);
      expect(c1.b).toBe(0);

      const c2 = parseCssColor("hsla(120, 100%, 50%, 0.8)"); // green with alpha
      expect(c2.r).toBe(0);
      expect(c2.g).toBeCloseTo(1, 2);
      expect(c2.b).toBe(0);
      expect(c2.a).toBe(0.8);
    });

    it("should safely fall back for invalid color strings", () => {
      const c = parseCssColor("invalid-color-123");
      expect(c).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe("2. Background Shorthand & Multi-value Parsing", () => {
    it("should parse background shorthand correctly", () => {
      const html = `<div style="background: #ff0000 url('bg.png') no-repeat center / cover;"></div>`;
      const doc = parser.parse(html);
      const elem = doc.querySelector("div") as ElementNode;
      const cascade = new CascadeEngine();
      const style = cascade.computeStyle(elem, []);

      expect(style.backgroundColor).toEqual({ r: 1, g: 0, b: 0 });
      expect(style.backgroundImage).toBe("bg.png");
      expect(style.backgroundRepeat).toBe("no-repeat");
      expect(style.backgroundPosition).toBe("center");
      expect(style.backgroundSize).toBe("cover");
    });
  });

  describe("3. Border & Border Radius Shorthands", () => {
    it("should parse border shorthand correctly", () => {
      const html = `<div style="border: 2px dashed #00ff00;"></div>`;
      const doc = parser.parse(html);
      const elem = doc.querySelector("div") as ElementNode;
      const cascade = new CascadeEngine();
      const style = cascade.computeStyle(elem, []);

      expect(style.borderTopWidth).toBe(1.5);
      expect(style.borderRightWidth).toBe(1.5);
      expect(style.borderBottomWidth).toBe(1.5);
      expect(style.borderLeftWidth).toBe(1.5);
      expect(style.borderTopStyle).toBe("dashed");
      expect(style.borderTopColor).toEqual({ r: 0, g: 1, b: 0 });
    });

    it("should parse border-radius 1, 2, 3, 4 value syntaxes", () => {
      const html = `
        <div id="d1" style="border-radius: 10px;"></div>
        <div id="d2" style="border-radius: 10px 20px;"></div>
        <div id="d3" style="border-radius: 10px 20px 30px 40px;"></div>
      `;
      const doc = parser.parse(html);
      const cascade = new CascadeEngine();

      const el1 = doc.querySelector("#d1") as ElementNode;
      const st1 = cascade.computeStyle(el1, []);
      expect(st1.borderTopLeftRadius).toBe(7.5);
      expect(st1.borderTopRightRadius).toBe(7.5);
      expect(st1.borderBottomRightRadius).toBe(7.5);
      expect(st1.borderBottomLeftRadius).toBe(7.5);

      const el3 = doc.querySelector("#d3") as ElementNode;
      const st3 = cascade.computeStyle(el3, []);
      expect(st3.borderTopLeftRadius).toBe(7.5);
      expect(st3.borderTopRightRadius).toBe(15);
      expect(st3.borderBottomRightRadius).toBe(22.5);
      expect(st3.borderBottomLeftRadius).toBe(30);
    });
  });

  describe("4. Text Formatting & Visibility", () => {
    it("should compute letter-spacing, text-decoration, white-space, and visibility", () => {
      const html = `<div style="letter-spacing: 2px; text-decoration: underline; white-space: nowrap; visibility: hidden;"></div>`;
      const doc = parser.parse(html);
      const elem = doc.querySelector("div") as ElementNode;
      const cascade = new CascadeEngine();
      const style = cascade.computeStyle(elem, []);

      expect(style.letterSpacing).toBe(1.5);
      expect(style.textDecoration).toBe("underline");
      expect(style.whiteSpace).toBe("nowrap");
      expect(style.visibility).toBe("hidden");
    });
  });

  describe("5. End-to-End PDF Generation with Phase 18 Features", () => {
    it("should render a PDF with advanced CSS properties without errors", async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .card {
              background-color: hsl(210, 80%, 90%);
              border: 2px solid rgb(0, 100, 200);
              border-radius: 12px;
              padding: 16px;
              letter-spacing: 1px;
            }
            .title {
              text-decoration: underline;
              color: rgba(200, 0, 0, 0.9);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 class="title">Phase 18 Advanced CSS</h1>
            <p style="border-bottom: 1px dashed green;">Rounded corners and color functions work seamlessly!</p>
          </div>
        </body>
        </html>
      `;

      const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(500);

      const header = pdfBuffer.subarray(0, 5).toString("utf-8");
      expect(header).toBe("%PDF-");
    });
  });
});
