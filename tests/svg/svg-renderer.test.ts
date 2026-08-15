import { describe, it, expect } from "vitest";
import { SvgParser } from "../../src/svg/svg-parser.js";
import { TextNode } from "../../src/html/dom/node.js";
import { SvgRenderer } from "../../src/svg/svg-renderer.js";
import { PDFDocument } from "../../src/pdf/pdf-document.js";
import { CSSParser } from "../../src/css/parser.js";

function render(svg: string, width = 100, height = 100): string {
  const root = new SvgParser().parse(svg);
  const doc = new PDFDocument();
  const renderer = new SvgRenderer();
  return renderer.render(root, doc, width, height, [], 0, 0);
}

describe("SVG Renderer — Primitives", () => {
  it("renders <rect> with re operator", () => {
    const out = render(
      `<svg><rect x="10" y="10" width="20" height="30"/></svg>`,
    );
    expect(out).toContain("10.0000 10.0000 20.0000 30.0000 re");
  });

  it("renders <rect> with rounded corners as cubic curves", () => {
    const out = render(
      `<svg><rect x="0" y="0" width="20" height="20" rx="5" ry="5"/></svg>`,
    );
    expect(out).toContain(" c");
    expect(out).toContain("h");
  });

  it("renders <circle> as 4 cubic curves", () => {
    const out = render(`<svg><circle cx="50" cy="50" r="20"/></svg>`);
    const cCount = (out.match(/ c/g) || []).length;
    expect(cCount).toBeGreaterThanOrEqual(4);
    expect(out).toContain("h");
  });

  it("renders <ellipse>", () => {
    const out = render(`<svg><ellipse cx="50" cy="50" rx="30" ry="20"/></svg>`);
    expect(out).toContain(" c");
    expect(out).toContain("h");
  });

  it("renders <line> with m and l", () => {
    const out = render(`<svg><line x1="10" y1="10" x2="90" y2="90"/></svg>`);
    expect(out).toContain("10.0000 10.0000 m");
    expect(out).toContain("90.0000 90.0000 l");
  });

  it("renders <polyline> with m and l (no close)", () => {
    const out = render(`<svg><polyline points="10,10 20,20 30,10"/></svg>`);
    expect(out).toContain("10.0000 10.0000 m");
    expect(out).toContain("20.0000 20.0000 l");
    expect(out).toContain("30.0000 10.0000 l");
    expect(out).not.toContain("\nh\n");
  });

  it("renders <polygon> with close path", () => {
    const out = render(`<svg><polygon points="10,10 20,20 30,10"/></svg>`);
    expect(out).toContain("h");
  });

  it("renders <path> with vector ops", () => {
    const out = render(`<svg><path d="M 10 10 L 90 90 Z"/></svg>`);
    expect(out).toContain("10.0000 10.0000 m");
    expect(out).toContain("90.0000 90.0000 l");
    expect(out).toContain("h");
  });

  it("applies fill color via rg operator", () => {
    const out = render(`<svg><rect width="10" height="10" fill="red"/></svg>`);
    expect(out).toContain("1.0000 0.0000 0.0000 rg");
    expect(out).toContain("f");
  });

  it("applies stroke color via RG operator", () => {
    const out = render(
      `<svg><rect width="10" height="10" fill="none" stroke="blue"/></svg>`,
    );
    expect(out).toContain("0.0000 0.0000 1.0000 RG");
    expect(out).toContain("S");
  });

  it("applies both fill and stroke with B operator", () => {
    const out = render(
      `<svg><rect width="10" height="10" fill="red" stroke="blue"/></svg>`,
    );
    expect(out).toContain("B");
  });

  it("applies stroke-width via w operator", () => {
    const out = render(
      `<svg><rect width="10" height="10" stroke="black" stroke-width="3"/></svg>`,
    );
    expect(out).toContain("3.0000 w");
  });

  it("applies stroke-linecap via J operator", () => {
    const out = render(
      `<svg><line x1="0" y1="0" x2="10" y2="10" stroke="black" stroke-linecap="round"/></svg>`,
    );
    expect(out).toContain("1 J");
  });

  it("applies stroke-linejoin via j operator", () => {
    const out = render(
      `<svg><polygon points="0,0 10,10 20,0" stroke="black" stroke-linejoin="bevel"/></svg>`,
    );
    expect(out).toContain("2 j");
  });

  it("applies stroke-dasharray via d operator", () => {
    const out = render(
      `<svg><line x1="0" y1="0" x2="10" y2="10" stroke="black" stroke-dasharray="2 1"/></svg>`,
    );
    expect(out).toContain("[2.0000 1.0000] 0 d");
  });

  it("skips display:none elements", () => {
    const out = render(
      `<svg><rect width="10" height="10" display="none"/></svg>`,
    );
    expect(out).not.toContain("re");
  });

  it("skips visibility:hidden elements", () => {
    const out = render(
      `<svg><rect width="10" height="10" visibility="hidden"/></svg>`,
    );
    expect(out).not.toContain("re");
  });

  it("applies opacity via ExtGState gs operator", () => {
    const out = render(
      `<svg><rect width="10" height="10" opacity="0.5"/></svg>`,
    );
    expect(out).toContain("gs");
  });

  it("applies nested group transforms with q/Q and cm", () => {
    const out = render(
      `<svg><g transform="translate(10,10)"><rect width="5" height="5"/></g></svg>`,
    );
    expect(out).toContain("q");
    expect(out).toContain("1 0 0 1 10.0000 10.0000 cm");
    expect(out).toContain("Q");
  });

  it("applies CSS rules from <style> blocks", () => {
    const root = new SvgParser().parse(
      `<svg><style>rect { fill: green; }</style><rect width="10" height="10"/></svg>`,
    );
    const doc = new PDFDocument();
    // Extract style rules like the layout engine does
    const firstChild = root.children[0]!.children[0];
    const cssText = firstChild instanceof TextNode ? firstChild.text : "";
    const rules = new CSSParser().parse(cssText);
    const out = new SvgRenderer().render(root, doc, 100, 100, rules, 0, 0);
    expect(out).toContain("0.0000 0.5000 0.0000 rg");
  });

  it("emits the viewBox coordinate transform via cm", () => {
    const out = render(
      `<svg viewBox="0 0 200 100" width="100" height="50"></svg>`,
      100,
      50,
    );
    // sx = 100/200 = 0.5, sy = -50/100 = -0.5
    expect(out).toContain("0.5000 0 0 -0.5000");
    expect(out).toContain("cm");
  });

  it("returns empty string for zero-size svg", () => {
    const out = render(`<svg width="0" height="0"></svg>`, 0, 0);
    expect(out).toBe("");
  });
});
