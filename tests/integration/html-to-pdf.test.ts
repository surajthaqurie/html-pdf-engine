import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import * as fs from "fs";
import * as path from "path";

describe("HtmlToPdf Integration API", () => {
  it("should generate a valid PDF binary buffer from HTML & CSS", async () => {
    const buffer = await HtmlToPdf.generateBuffer({
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Helvetica; margin: 20px; }
              h1 { color: #1e40af; }
              p { color: #334155; font-size: 11pt; }
            </style>
          </head>
          <body>
            <h1>Integration Test Report</h1>
            <p>This is an automated end-to-end integration test PDF.</p>
          </body>
        </html>
      `,
      page: "A4",
      orientation: "portrait",
      compress: false, // Turn off compression for plain string matching test
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    const pdfStr = buffer.toString("binary");
    expect(pdfStr).toContain("%PDF-1.7");
    expect(pdfStr).toContain("Integration Test Report");
  });

  it("should generate a PDF file directly to disk path", async () => {
    const outputDir = path.join(process.cwd(), "artifacts");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, "integration_test_output.pdf");

    await HtmlToPdf.generateFile({
      html: "<h1>File Direct Output Test</h1>",
      output: outputPath,
    });

    expect(fs.existsSync(outputPath)).toBe(true);
    const stat = fs.statSync(outputPath);
    expect(stat.size).toBeGreaterThan(100);
  });
});
