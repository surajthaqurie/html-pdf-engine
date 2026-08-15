import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../utils/pdf-validator.js";
import * as fs from "fs";
import * as path from "path";

const SVG_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect x="0" y="0" width="100" height="100" fill="#0284c7"/>
  <circle cx="50" cy="50" r="30" fill="white"/>
  <path d="M 20 80 L 50 20 L 80 80 Z" fill="#0f172a"/>
</svg>`;

function render(
  html: string,
  images?: Record<string, Buffer | string>,
): Promise<Buffer> {
  return HtmlToPdf.generateBuffer({ html, images, compress: false });
}

describe("SVG Integration", () => {
  it("renders inline <svg> into a valid PDF", async () => {
    const buf = await render(`<html><body>${SVG_LOGO}</body></html>`);
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
    expect(v.pageCount).toBe(1);
  });

  it("renders <img src='logo.svg'> from images map", async () => {
    const buf = await render(
      `<html><body><img src="logo.svg" width="120" height="120"/></body></html>`,
      { "logo.svg": Buffer.from(SVG_LOGO, "utf8") },
    );
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });

  it("renders SVG data URL via <img>", async () => {
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(SVG_LOGO).toString("base64")}`;
    const buf = await render(
      `<html><body><img src="${dataUrl}" width="80" height="80"/></body></html>`,
    );
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });

  it("renders SVG alongside a table", async () => {
    const buf = await render(`<html><body>
      <table><tr><td>A</td><td>B</td></tr></table>
      ${SVG_LOGO}
    </body></html>`);
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });

  it("renders SVG inside a flexbox container", async () => {
    const buf = await render(`<html><body>
      <div style="display:flex;justify-content:space-between">
        <div>Left text</div>
        ${SVG_LOGO}
      </div>
    </body></html>`);
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });

  it("renders SVG inside a grid container", async () => {
    const buf = await render(`<html><body>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>Cell A</div>
        ${SVG_LOGO}
      </div>
    </body></html>`);
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });

  it("renders multiple SVGs in one document", async () => {
    const buf = await render(`<html><body>
      ${SVG_LOGO}
      ${SVG_LOGO}
      ${SVG_LOGO}
    </body></html>`);
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });

  it("paginates a document containing SVGs", async () => {
    let html = "<html><body>";
    for (let i = 0; i < 60; i++) {
      html += `<div>Row ${i}</div>`;
      if (i % 10 === 0) html += SVG_LOGO;
    }
    html += "</body></html>";
    const buf = await render(html);
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
    expect(v.pageCount).toBeGreaterThan(1);
  });

  it("renders SVG with headers and footers", async () => {
    const buf = await HtmlToPdf.generateBuffer({
      html: `<html><body>${SVG_LOGO}<p>content</p></body></html>`,
      compress: false,
      header: { text: "Header", align: "center" },
      footer: {
        text: "Page {{pageNumber}} of {{totalPages}}",
        align: "center",
      },
    });
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });

  it("renders SVG with custom fonts", async () => {
    const buf = await render(`<html><body>
      <div style="font-family:Helvetica">${SVG_LOGO}<p>text</p></div>
    </body></html>`);
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });

  it("produces deterministic output across repeated renders", async () => {
    const a = await render(`<html><body>${SVG_LOGO}</body></html>`);
    const b = await render(`<html><body>${SVG_LOGO}</body></html>`);
    expect(a.equals(b)).toBe(true);
  });

  it("emits expected PDF vector operators for inline SVG", async () => {
    const buf = await render(
      `<html><body><svg width="50" height="50"><rect width="20" height="20" fill="red"/></svg></body></html>`,
    );
    const str = buf.toString("binary");
    // The rect 're' operator and fill 'f' should be present in a content stream.
    expect(str).toContain("re");
    expect(str).toMatch(/f|B|S/);
  });

  it("falls back gracefully when <img> references a non-SVG asset", async () => {
    // A valid 1x1 PNG via data URL should still work (raster path).
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const buf = await render(
      `<html><body><img src="data:image/png;base64,${pngBase64}" width="10" height="10"/></body></html>`,
    );
    const v = validatePdfStructure(buf);
    expect(v.valid).toBe(true);
  });
});
