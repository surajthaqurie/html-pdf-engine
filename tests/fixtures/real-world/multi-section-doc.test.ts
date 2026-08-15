import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../../src/core/html-to-pdf.js";
import { validatePdfStructure } from "../../utils/pdf-validator.js";

describe("Real-World Fixture 15 — Multi-Section Technical Specification", () => {
  it("renders a complex multi-section document with table of contents and internal anchor navigation", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica, sans-serif; font-size: 10pt; color: #1e293b; line-height: 1.5; }
            h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 4px; }
            h2 { color: #1e3a8a; margin-top: 20px; }
            .toc { background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 4px; margin-bottom: 30px; }
            .toc ul { margin: 5px 0 0 0; padding-left: 20px; }
            .toc li { margin-bottom: 4px; }
            .page-break { break-before: page; }
            .code-block { background: #0f172a; color: #f8fafc; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 9pt; }
          </style>
        </head>
        <body>
          <h1>PDF Engine Specification v1.0</h1>
          
          <div class="toc">
            <strong>Table of Contents</strong>
            <ul>
              <li><a href="#overview">1. Architecture Overview</a></li>
              <li><a href="#pipeline">2. Rendering Pipeline</a></li>
              <li><a href="#concurrency">3. Thread-Safe Concurrency</a></li>
            </ul>
          </div>

          <h2 id="overview">1. Architecture Overview</h2>
          <p>The engine is designed as a zero-dependency HTML/CSS layout and PDF generation framework for Node.js.</p>

          <div class="page-break">
            <h2 id="pipeline">2. Rendering Pipeline</h2>
            <p>The pipeline transforms raw HTML strings through tokenization, DOM tree building, CSS cascading, box layout, paint command generation, and PDF binary stream serialization.</p>
            <div class="code-block">
              HTML -> DOM -> Cascade -> Layout -> Paint -> PDF
            </div>
          </div>

          <div class="page-break">
            <h2 id="concurrency">3. Thread-Safe Concurrency</h2>
            <p>Every rendering invocation operates within an isolated LayoutContext, ensuring zero global state leakage across parallel calls. Return to <a href="#overview">Architecture Overview</a>.</p>
          </div>
        </body>
      </html>
    `;

    const buf1 = await HtmlToPdf.generateBuffer({ html, compress: false });
    const buf2 = await HtmlToPdf.generateBuffer({ html, compress: false });
    expect(buf1.equals(buf2)).toBe(true);

    const validation = validatePdfStructure(buf1);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.pageCount).toBe(3);
  });
});
