import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import { createNetworkAssetResolver } from "../../src/assets/asset-resolver.js";
import { validatePdfStructure } from "../utils/pdf-validator.js";

describe("Phase 23 — Security, Asset Resolver & Malformed Input Resiliency", () => {
  it("blocks remote HTTP/HTTPS image requests by default (SSRF safety)", async () => {
    const html = `<html><body><img src="http://169.254.169.254/latest/meta-data/" /></body></html>`;

    // Engine should fail safely with an ImageError or ignore, without making network request
    await expect(HtmlToPdf.generateBuffer({ html })).rejects.toThrow();
  });

  it("handles malformed HTML (unclosed tags, nested invalid tags, weird attributes)", async () => {
    const malformedHtml = `
      <div><h1>Malformed Document Title</div>
      <p>Unclosed paragraph
      <span>Nested <b>bold <i>italic without closing
      <table border="invalid"><tr><td>Missing row closure
      <img src="" alt="empty src">
      <div class=>Invalid class syntax</div>
    `;

    const buf = await HtmlToPdf.generateBuffer({ html: malformedHtml });
    expect(buf.length).toBeGreaterThan(0);

    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("handles malformed CSS declarations safely without crashing parser", async () => {
    const html = `
      <html>
        <head>
          <style>
            body { font-size: invalid_px; color: ; margin: 10px 20px 30px; }
            h1 { color: #zzzzzz; width: calc(;;;); }
            div { flex: 1 1 1 1 1 1; grid-template-columns: repeat(invalid); }
            @media screen and (min-width: abc) { p { color: red; } }
          </style>
        </head>
        <body>
          <h1>Malformed CSS Recovery Test</h1>
          <p>This text should render safely with fallback defaults.</p>
        </body>
      </html>
    `;

    const buf = await HtmlToPdf.generateBuffer({ html });
    expect(buf.length).toBeGreaterThan(0);

    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("rejects unsupported protocols in AssetResolver", async () => {
    const resolver = createNetworkAssetResolver();
    await expect(resolver.resolve("ftp://example.com/image.png", { type: "image" })).rejects.toThrow();
    await expect(resolver.resolve("gopher://example.com", { type: "image" })).rejects.toThrow();
    await expect(resolver.resolve("file:///etc/passwd", { type: "image" })).rejects.toThrow();
  });

  it("renders empty document safely", async () => {
    const buf = await HtmlToPdf.generateBuffer({ html: "" });
    expect(buf.length).toBeGreaterThan(0);

    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });
});
