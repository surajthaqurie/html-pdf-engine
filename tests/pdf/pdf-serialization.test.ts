import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import { escapePdfString, PDFString } from "../../src/pdf/pdf-object.js";
import { validatePdfStructure } from "../utils/pdf-validator.js";

describe("Phase 23 — PDF String & Unicode Serialization & Links", () => {
  it("escapes special characters correctly in PDF literal strings", () => {
    expect(escapePdfString("Hello (World)")).toBe("Hello \\(World\\)");
    expect(escapePdfString("C:\\Program Files\\App")).toBe("C:\\\\Program Files\\\\App");
    expect(escapePdfString("Line1\r\nLine2\tTab")).toBe("Line1\\r\\nLine2\\tTab");
    expect(escapePdfString("FormFeed\fBackspace\b")).toBe("FormFeed\\fBackspace\\b");
  });

  it("serializes Unicode and Nepali text correctly without PDF stream corruption", async () => {
    const html = `
      <html>
        <body>
          <h1>Nepali Test: नमस्कार संसार</h1>
          <p>Latin Accented: François, Müller, &amp; Crème brûlée</p>
          <p>Symbols: © 2026 ™ ® € £ ¥ ➔ ★</p>
        </body>
      </html>
    `;

    const buf = await HtmlToPdf.generateBuffer({ html, compress: false });
    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("distinguishes external links (http, https, mailto, tel) from internal anchor links (#id)", async () => {
    const html = `
      <html>
        <body>
          <h1 id="top">Top Header</h1>
          <a href="#section2">Go to Section 2</a>
          <a href="https://example.com">Website</a>
          <a href="mailto:support@example.com">Email Us</a>
          <a href="tel:+18005550199">Call Us</a>

          <div style="margin-top: 1000px;">
            <h2 id="section2">Section 2</h2>
            <a href="#top">Back to Top</a>
          </div>
        </body>
      </html>
    `;

    const buf = await HtmlToPdf.generateBuffer({ html });
    const pdfStr = buf.toString("binary");

    expect(pdfStr).toContain("https://example.com");
    expect(pdfStr).toContain("mailto:support@example.com");
    expect(pdfStr).toContain("tel:+18005550199");

    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("handles duplicate anchor IDs deterministically without crashing", async () => {
    const html = `
      <html>
        <body>
          <h2 id="target">Target 1</h2>
          <h2 id="target">Target 2</h2>
          <a href="#target">Link to Target</a>
        </body>
      </html>
    `;

    const buf1 = await HtmlToPdf.generateBuffer({ html, compress: false });
    const buf2 = await HtmlToPdf.generateBuffer({ html, compress: false });

    expect(buf1.equals(buf2)).toBe(true);

    const validation = validatePdfStructure(buf1);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it("handles missing internal anchor links safely", async () => {
    const html = `
      <html>
        <body>
          <a href="#nonexistent">Dead Link</a>
        </body>
      </html>
    `;

    const buf = await HtmlToPdf.generateBuffer({ html });
    const validation = validatePdfStructure(buf);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });
});
