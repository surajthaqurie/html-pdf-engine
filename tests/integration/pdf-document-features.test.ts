import { describe, it, expect } from "vitest";
import { HtmlToPdf, PDFDocument } from "../../src/index.js";

describe("Phase 21 — Production PDF Document Features, Navigation & Serialization Hardening", () => {
  describe("1. PDF Document Metadata & Escaping", () => {
    it("serializes all standard metadata fields into PDF Info dictionary", async () => {
      const html = `<h1>Metadata Document</h1>`;
      const buffer = await HtmlToPdf.generateBuffer({
        html,
        meta: {
          title: "Production PDF Guide",
          author: "Engine Architect",
          subject: "PDF/A Standard Verification",
          keywords: ["pdf", "engine", "typescript", "renderer"],
          creator: "Custom Studio Creator",
          producer: "html-pdf-engine-v21",
        },
        compress: false,
      });
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr).toContain("/Title (Production PDF Guide)");
      expect(pdfStr).toContain("/Author (Engine Architect)");
      expect(pdfStr).toContain("/Subject (PDF/A Standard Verification)");
      expect(pdfStr).toContain("/Keywords (pdf, engine, typescript, renderer)");
      expect(pdfStr).toContain("/Creator (Custom Studio Creator)");
      expect(pdfStr).toContain("/Producer (html-pdf-engine-v21)");
    });

    it("correctly escapes special characters in literal string metadata", async () => {
      const html = `<h1>Escaped Metadata</h1>`;
      const buffer = await HtmlToPdf.generateBuffer({
        html,
        meta: {
          title: "Title (with parens) & \\ backslash \r\n and tabs \t",
        },
        compress: false,
      });
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr).toContain(
        "/Title (Title \\(with parens\\) & \\\\ backslash \\r\\n and tabs \\t)",
      );
    });

    it("encodes Unicode metadata strings using UTF-16BE BOM hex format", async () => {
      const html = `<h1>Unicode Metadata</h1>`;
      const buffer = await HtmlToPdf.generateBuffer({
        html,
        meta: {
          title: "Report — 2026", // Em-dash (char code 8212 > 127)
          author: "सूर्य", // Devanagari script
        },
        compress: false,
      });
      const pdfStr = buffer.toString("latin1");

      // Title containing em-dash should be output in hex format starting with FEFF
      expect(pdfStr).toMatch(/\/Title <FEFF[0-9A-F]+>/);
      expect(pdfStr).toMatch(/\/Author <FEFF[0-9A-F]+>/);
    });
  });

  describe("2. Document Language & Viewer Preferences", () => {
    it("sets document language in PDF Catalog dictionary", async () => {
      const html = `<html lang="fr-FR"><body><h1>Bonjour</h1></body></html>`;
      const buffer = await HtmlToPdf.generateBuffer({
        html,
        language: "fr-FR",
        compress: false,
      });
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr).toContain("/Lang (fr-FR)");
    });

    it("serializes viewer preferences in Catalog dictionary", async () => {
      const html = `<h1>Viewer Preferences</h1>`;
      const buffer = await HtmlToPdf.generateBuffer({
        html,
        viewerPreferences: {
          hideToolbar: true,
          hideMenubar: true,
          hideWindowUI: false,
          fitWindow: true,
          centerWindow: true,
          displayDocTitle: true,
        },
        compress: false,
      });
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr).toContain("/ViewerPreferences <<");
      expect(pdfStr).toContain("/HideToolbar true");
      expect(pdfStr).toContain("/HideMenubar true");
      expect(pdfStr).toContain("/HideWindowUI false");
      expect(pdfStr).toContain("/FitWindow true");
      expect(pdfStr).toContain("/CenterWindow true");
      expect(pdfStr).toContain("/DisplayDocTitle true");
    });
  });

  describe("3. Controlled PDF Specification Version & Page Labels", () => {
    it("outputs specified PDF version in header comment", async () => {
      const html = `<h1>PDF 1.4 Test</h1>`;
      const buffer = await HtmlToPdf.generateBuffer({
        html,
        pdfVersion: "1.4",
      });
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr.startsWith("%PDF-1.4")).toBe(true);
    });

    it("serializes PDF PageLabels range catalog dictionary", async () => {
      const html = `<h1>Page Labels</h1>`;
      const buffer = await HtmlToPdf.generateBuffer({
        html,
        pageLabels: [
          {
            startPage: 1,
            style: "lowercase-roman",
            prefix: "i-",
            firstNumber: 1,
          },
          {
            startPage: 3,
            style: "decimal",
            prefix: "Page-",
            firstNumber: 1,
          },
        ],
        compress: false,
      });
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr).toContain("/PageLabels <<");
      expect(pdfStr).toContain("/Nums [");
      expect(pdfStr).toContain("/S /r");
      expect(pdfStr).toContain("/P (i-)");
      expect(pdfStr).toContain("/S /D");
      expect(pdfStr).toContain("/P (Page-)");
    });
  });

  describe("4. Internal Anchors & Document Navigation", () => {
    it("creates internal GoTo link annotation for in-page fragment links", async () => {
      const html = `
        <div>
          <a href="#target-heading">Go to Heading</a>
          <div style="height: 100px;"></div>
          <h2 id="target-heading">Target Heading</h2>
        </div>
      `;
      const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr).toContain("/Subtype /Link");
      expect(pdfStr).toContain("/S /GoTo");
      expect(pdfStr).toContain("/XYZ");
    });

    it("resolves cross-page internal anchors with correct target page reference", async () => {
      const html = `
        <div>
          <a href="#section-page2">Jump to Page 2</a>
          <div style="page-break-before: always;">
            <h2 id="section-page2">Page 2 Content</h2>
          </div>
        </div>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      const pages = doc.getPages();
      expect(pages.length).toBe(2);

      const buffer = doc.save();
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr).toContain("/Subtype /Link");
      expect(pdfStr).toContain("/S /GoTo");

      // Verify destination coordinates were captured
      const dest = doc.getDestination("section-page2");
      expect(dest).toBeDefined();
      expect(dest?.pageIndex).toBe(1);
    });

    it("enforces first-occurrence-wins rule for duplicate anchor IDs", async () => {
      const html = `
        <div>
          <h2 id="duplicate-id">First Heading</h2>
          <div style="page-break-before: always;">
            <h2 id="duplicate-id">Second Heading</h2>
          </div>
        </div>
      `;
      const doc = await HtmlToPdf.generate({ html, compress: false });
      const dest = doc.getDestination("duplicate-id");

      expect(dest).toBeDefined();
      expect(dest?.pageIndex).toBe(0); // First occurrence on page 0 wins
    });

    it("safely ignores missing internal anchor targets without crashing", async () => {
      const html = `<a href="#non-existent-anchor">Broken Link</a>`;
      const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr).not.toContain("/Subtype /Link");
      expect(pdfStr).toContain("Broken Link");
    });

    it("supports tel: external links along with http, https, and mailto", async () => {
      const html = `<a href="tel:+18005550199">Call Support</a>`;
      const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr).toContain("/Subtype /Link");
      expect(pdfStr).toContain("/URI (tel:+18005550199)");
    });
  });

  describe("5. PDF Object Integrity & Byte Determinism", () => {
    it("produces byte-for-byte identical PDF output for identical render options", async () => {
      const options = {
        html: `
          <div lang="en">
            <h1 id="top">Deterministic Build</h1>
            <p><a href="#top">Back to top</a></p>
          </div>
        `,
        meta: { title: "Determinism Test", author: "QA" },
        viewerPreferences: { displayDocTitle: true },
        compress: false,
      };

      const buf1 = await HtmlToPdf.generateBuffer(options);
      const buf2 = await HtmlToPdf.generateBuffer(options);

      expect(buf1.equals(buf2)).toBe(true);
    });

    it("maintains strict object isolation and context memory safety during concurrent renders", async () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        HtmlToPdf.generateBuffer({
          html: `<h1 id="sec-${i}">Document ${i}</h1><a href="#sec-${i}">Link ${i}</a>`,
          meta: { title: `Doc ${i}` },
          language: i % 2 === 0 ? "en-US" : "fr-FR",
          compress: false,
        }),
      );

      const buffers = await Promise.all(tasks);
      expect(buffers.length).toBe(10);

      buffers.forEach((buf, i) => {
        const pdfStr = buf.toString("latin1");
        expect(pdfStr).toContain(`/Title (Doc ${i})`);
        expect(pdfStr).toContain(i % 2 === 0 ? "/Lang (en-US)" : "/Lang (fr-FR)");
      });
    });
  });
});
