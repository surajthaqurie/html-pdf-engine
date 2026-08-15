import { describe, test, expect } from "vitest";
import { HtmlToPdf, PdfError } from "../../src/index.js";
import { createMinimalTTFBuffer } from "../fonts/ttf-parser.test.js";

describe("Phase 20 — Concurrency & Pipeline Hardening", () => {
  test("handles 20 concurrent document rendering jobs simultaneously without state contamination", async () => {
    const fontAlphaBuffer = createMinimalTTFBuffer("FontAlpha-Regular");
    const fontBetaBuffer = createMinimalTTFBuffer("FontBeta-Regular");

    const tasks = Array.from({ length: 20 }, (_, index) => {
      const isEven = index % 2 === 0;
      const fontFamily = isEven ? "FontAlpha" : "FontBeta";
      const fontBuffer = isEven ? fontAlphaBuffer : fontBetaBuffer;

      const html = `
        <html>
          <head>
            <style>
              body { font-family: '${fontFamily}', sans-serif; font-size: 14px; color: ${isEven ? "#ff0000" : "#0000ff"}; }
            </style>
          </head>
          <body>
            <h1>Doc Index ${index}</h1>
            <p>Content for ${fontFamily}</p>
          </body>
        </html>
      `;

      return HtmlToPdf.generateBuffer({
        html,
        compress: false,
        fonts: {
          [fontFamily]: {
            regular: fontBuffer,
          },
        },
      });
    });

    const results = await Promise.all(tasks);

    expect(results).toHaveLength(20);

    results.forEach((pdfBuffer, index) => {
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(100);

      const isEven = index % 2 === 0;
      const expectedFontName = isEven ? "FontAlpha-Regular" : "FontBeta-Regular";
      const pdfText = pdfBuffer.toString("latin1");

      expect(pdfText).toContain(`/BaseFont /${expectedFontName}`);
    });
  });

  test("validates invalid options at API boundary", async () => {
    // @ts-expect-error invalid options argument
    await expect(HtmlToPdf.generateBuffer(null)).rejects.toThrow(PdfError);

    // @ts-expect-error invalid html argument
    await expect(HtmlToPdf.generateBuffer({ html: 12345 })).rejects.toThrow(PdfError);
  });
});
