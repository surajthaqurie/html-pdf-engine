import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/index.js";
import { extractPdfText } from "../utils/pdf-text-extractor.js";

describe("Phase 7 — PDF Hyperlinks Suite", () => {
  it("renders a clickable link annotation for absolute http/https URLs", async () => {
    const html = `<a href="https://example.com">Visit Example</a>`;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = buffer.toString("latin1");

    expect(pdfStr).toContain("/Type /Annot");
    expect(pdfStr).toContain("/Subtype /Link");
    expect(pdfStr).toContain("/S /URI");
    expect(pdfStr).toContain("/URI (https://example.com)");
    expect(pdfStr).toContain("/Annots");
    const extracted = extractPdfText(buffer);
    expect(extracted).toContain("Visit Example");
  });

  it("renders a clickable link annotation for mailto: URLs", async () => {
    const html = `<a href="mailto:support@example.com">Contact Support</a>`;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = buffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Link");
    expect(pdfStr).toContain("/URI (mailto:support@example.com)");
    const extracted = extractPdfText(buffer);
    expect(extracted).toContain("Contact Support");
  });

  it("supports multiple links on the same page with distinct annotations", async () => {
    const html = `
      <p>Check <a href="https://site1.com">Site 1</a> and <a href="https://site2.com">Site 2</a>.</p>
    `;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = buffer.toString("latin1");

    expect(pdfStr).toContain("/URI (https://site1.com)");
    expect(pdfStr).toContain("/URI (https://site2.com)");
    
    // Check that /Annots array references both link annotations
    const annotsMatch = pdfStr.match(/\/Annots\s*\[(.*?)\]/);
    expect(annotsMatch).not.toBeNull();
    const refs = annotsMatch![1]!.trim().split(/\s+/).filter((s) => s === "R");
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });

  it("attaches link annotations on different pages to their respective page objects", async () => {
    const html = `
      <div>
        <p><a href="https://page1.com">Page 1 Link</a></p>
        <div style="page-break-before: always;">
          <p><a href="https://page2.com">Page 2 Link</a></p>
        </div>
      </div>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    const pages = doc.getPages();

    expect(pages.length).toBe(2);
    expect(pages[0]?.annotations.length).toBe(1);
    expect(pages[0]?.annotations[0]?.uri).toBe("https://page1.com");
    expect(pages[1]?.annotations.length).toBe(1);
    expect(pages[1]?.annotations[0]?.uri).toBe("https://page2.com");
  });

  it("safely ignores invalid or unsupported href values without breaking layout or crashing", async () => {
    const html = `
      <div>
        <a href="javascript:alert(1)">JS Script Link</a>
        <a href="#section-1">Fragment Link</a>
        <a href="/relative/path">Relative Link</a>
        <a href="">Empty Link</a>
        <a>No Href Link</a>
      </div>
    `;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = buffer.toString("latin1");

    expect(pdfStr).not.toContain("/Subtype /Link");
    expect(pdfStr).not.toContain("/Annots");
    const extracted = extractPdfText(buffer);
    expect(extracted).toContain("JS Script Link");
    expect(extracted).toContain("Fragment Link");
    expect(extracted).toContain("Relative Link");
  });

  it("preserves PDF structure cleanly without /Annots when no links are present", async () => {
    const html = `<h1>Plain Title without Links</h1><p>Normal text block.</p>`;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = buffer.toString("latin1");

    expect(pdfStr).not.toContain("/Annots");
    expect(pdfStr).not.toContain("/Subtype /Link");
  });

  it("supports wrapping text links across lines with individual bounding boxes", async () => {
    const longLinkText = "Very Long Link Text That Wraps Across Multiple Lines ".repeat(15);
    const html = `<a href="https://wrapped-link.com">${longLinkText}</a>`;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    const page = doc.getPages()[0];
    
    expect(page).toBeDefined();
    expect(page!.annotations.length).toBeGreaterThan(1);
    for (const annot of page!.annotations) {
      expect(annot.uri).toBe("https://wrapped-link.com");
    }
  });

  it("safely escapes parentheses and backslashes in URL strings", async () => {
    const html = `<a href="https://example.com/path(1)?a=b\\c">Escaped Link</a>`;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = buffer.toString("latin1");

    expect(pdfStr).toContain("/URI (https://example.com/path\\(1\\)?a=b\\\\c)");
  });
});
