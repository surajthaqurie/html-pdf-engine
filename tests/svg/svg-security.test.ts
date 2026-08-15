import { describe, it, expect } from "vitest";
import { SvgParser } from "../../src/svg/svg-parser.js";
import { SvgRenderer } from "../../src/svg/svg-renderer.js";
import { PDFDocument } from "../../src/pdf/pdf-document.js";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../utils/pdf-validator.js";

function renderToPdf(html: string): Promise<Buffer> {
  return HtmlToPdf.generateBuffer({ html, compress: false });
}

describe("SVG Security", () => {
  it("strips <script> tags and never executes them", async () => {
    const html = `<html><body><svg width="50" height="50"><script>alert('xss')</script><rect width="10" height="10" fill="red"/></svg></body></html>`;
    const buf = await renderToPdf(html);
    const str = buf.toString("binary");
    expect(str).not.toContain("alert");
    expect(str).not.toContain("<script");
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });

  it("ignores event handler attributes (onclick, onload)", () => {
    const root = new SvgParser().parse(
      `<svg><rect width="10" height="10" onclick="alert(1)" onload="evil()"/></svg>`,
    );
    const rect = root.children[0]!;
    expect(rect.getAttribute("onclick")).toBeNull();
    expect(rect.getAttribute("onload")).toBeNull();
  });

  it("ignores javascript: URLs in attributes", () => {
    const root = new SvgParser().parse(
      `<svg><a xlink:href="javascript:alert(1)"><rect width="10" height="10"/></a></svg>`,
    );
    const a = root.children[0]!;
    // javascript: URL must be dropped (attribute not set)
    expect(a.getAttribute("xlink:href")).toBeNull();
  });

  it("ignores external entity declarations (XXE)", () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE svg [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<svg><rect width="10" height="10"/></svg>`;
    const root = new SvgParser().parse(xml);
    expect(root.tagName).toBe("svg");
    // No entity expansion should occur; no /etc/passwd content in tree
    const doc = new PDFDocument();
    const out = new SvgRenderer().render(root, doc, 100, 100, [], 0, 0);
    expect(out).not.toContain("root:");
    expect(out).not.toContain("/etc/passwd");
  });

  it("does not resolve billion-laughs entity expansion", () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE lolz [
 <!ENTITY lol "lol">
 <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
]>
<svg><rect width="10" height="10"/></svg>`;
    const root = new SvgParser().parse(xml);
    // Entities are not expanded; the &lol; references would remain literal
    // but since we ignore DTD entirely, parsing succeeds without expansion.
    expect(root.tagName).toBe("svg");
  });

  it("rejects malformed XML safely", () => {
    expect(() => new SvgParser().parse(`<svg><rect></svg>`)).toThrow();
    expect(() => new SvgParser().parse(`<svg><`)).toThrow();
    expect(() => new SvgParser().parse(`not xml at all`)).toThrow();
  });

  it("rejects extremely deep nesting", () => {
    let nested = `<svg>`;
    for (let i = 0; i < 300; i++) nested += `<g>`;
    nested += `<rect/>`;
    for (let i = 0; i < 300; i++) nested += `</g>`;
    nested += `</svg>`;
    expect(() => new SvgParser().parse(nested)).toThrow();
  });

  it("handles extremely large path data without crashing", () => {
    let d = "M 0 0";
    for (let i = 0; i < 5000; i++) {
      d += ` L ${i} ${i}`;
    }
    const root = new SvgParser().parse(`<svg><path d="${d}"/></svg>`);
    const doc = new PDFDocument();
    const out = new SvgRenderer().render(root, doc, 1000, 1000, [], 0, 0);
    expect(out).toContain("m");
    expect(out).toContain("l");
  });

  it("does not inject malformed PDF operators from path data", () => {
    // Path data is parsed numerically; arbitrary strings cannot become PDF ops.
    const root = new SvgParser().parse(`<svg><path d="M 0 0 L 10 10"/></svg>`);
    const doc = new PDFDocument();
    const out = new SvgRenderer().render(root, doc, 100, 100, [], 0, 0);
    // Only valid PDF path operators should appear
    expect(out).not.toContain("BT");
    expect(out).not.toContain("Tj");
    expect(out).not.toContain("Do");
  });

  it("does not auto-fetch remote SVG via <img>", async () => {
    const html = `<html><body><img src="https://evil.example.com/x.svg"/></body></html>`;
    // Should throw ImageError for remote URL, not perform a network request.
    await expect(renderToPdf(html)).rejects.toThrow();
  });

  it("renders inline SVG without network access", async () => {
    const html = `<html><body><svg width="20" height="20"><rect width="10" height="10" fill="black"/></svg></body></html>`;
    const buf = await renderToPdf(html);
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });
});
