import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import { CSSParser } from "../../src/css/parser.js";
import { CascadeEngine } from "../../src/css/cascade.js";
import { ElementNode } from "../../src/html/dom/node.js";

// ParsedColor values are 0-1 normalized floats (r/255, g/255, b/255)
function toNormalizedColor(r: number, g: number, b: number, a = 1) {
  return { r: r / 255, g: g / 255, b: b / 255, ...(a !== 1 ? { a } : {}) };
}

describe("Phase 22 — CSS Custom Properties & Media Queries", () => {
  it("resolves simple CSS variables var(--name)", () => {
    const cascade = new CascadeEngine();
    const parser = new CSSParser();
    const rules = parser.parse(`
      :root {
        --primary-color: #0284c7;
        --font-size-title: 20pt;
      }
      .heading {
        color: var(--primary-color);
        font-size: var(--font-size-title);
      }
    `);

    const elem = new ElementNode("h1", { class: "heading" });
    const style = cascade.computeStyle(elem, rules);

    // #0284c7 = rgb(2, 132, 199) → normalized
    expect(style.color.r).toBeCloseTo(2 / 255, 5);
    expect(style.color.g).toBeCloseTo(132 / 255, 5);
    expect(style.color.b).toBeCloseTo(199 / 255, 5);
    expect(style.fontSize).toBe(20);
  });

  it("resolves nested CSS variables and fallback values", () => {
    const cascade = new CascadeEngine();
    const parser = new CSSParser();
    const rules = parser.parse(`
      :root {
        --base: #1e293b;
        --text: var(--base);
      }
      .card {
        color: var(--text);
        background-color: var(--missing-bg, #f1f5f9);
      }
    `);

    const elem = new ElementNode("div", { class: "card" });
    const style = cascade.computeStyle(elem, rules);

    // #1e293b = rgb(30, 41, 59) → normalized
    expect(style.color.r).toBeCloseTo(30 / 255, 5);
    expect(style.color.g).toBeCloseTo(41 / 255, 5);
    expect(style.color.b).toBeCloseTo(59 / 255, 5);

    // #f1f5f9 = rgb(241, 245, 249) → normalized
    expect(style.backgroundColor).not.toBeNull();
    expect(style.backgroundColor!.r).toBeCloseTo(241 / 255, 5);
    expect(style.backgroundColor!.g).toBeCloseTo(245 / 255, 5);
    expect(style.backgroundColor!.b).toBeCloseTo(249 / 255, 5);
  });

  it("safely handles circular CSS variable dependencies without throwing", () => {
    const cascade = new CascadeEngine();
    const parser = new CSSParser();
    const rules = parser.parse(`
      :root {
        --var-a: var(--var-b);
        --var-b: var(--var-a);
      }
      .box {
        color: var(--var-a, #ff0000);
      }
    `);

    const elem = new ElementNode("div", { class: "box" });
    // Should not throw — cycle detection must terminate
    expect(() => cascade.computeStyle(elem, rules)).not.toThrow();
  });

  it("evaluates @media print blocks when rendering PDF", async () => {
    const html = `
      <style>
        .banner { color: #ff0000; }
        @media print {
          .banner { color: #008000; }
        }
        @media screen {
          .banner { color: #0000ff; }
        }
      </style>
      <div class="banner">Print Target Banner</div>
    `;

    const doc = await HtmlToPdf.generate({ html });
    expect(doc).toBeDefined();
    expect(doc.getPages().length).toBe(1);
  });

  it("evaluates @media min-width and max-width media query conditions", () => {
    const cascade = new CascadeEngine();
    const parser = new CSSParser();
    const rules = parser.parse(`
      @media (min-width: 500pt) {
        .responsive { display: block; }
      }
      @media (max-width: 300pt) {
        .responsive { display: none; }
      }
    `);

    const elem1 = new ElementNode("div", { class: "responsive" });
    const elem2 = new ElementNode("div", { class: "responsive" });

    const styleWide = cascade.computeStyle(elem1, rules, undefined, 600);
    const styleNarrow = cascade.computeStyle(elem2, rules, undefined, 200);

    expect(styleWide.display).toBe("block");
    expect(styleNarrow.display).toBe("none");
  });

  it("resolves CSS variables via inline style attribute", async () => {
    const html = `
      <style>
        :root { --brand: #0284c7; }
      </style>
      <p style="color: var(--brand);">Hello</p>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
  });
});
