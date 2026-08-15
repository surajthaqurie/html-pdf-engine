import { describe, test, expect } from "vitest";
import { HtmlToPdf } from "../../src/index.js";
import { createMinimalTTFBuffer } from "../fonts/ttf-parser.test.js";

describe("Phase 2: Custom TTF Font Embedding Integration Tests", () => {
  test("embeds custom TTF font into PDF as Type0 with ToUnicode CMap", async () => {
    const regularFontBuffer = createMinimalTTFBuffer("RobotoCustom-Regular");
    const boldFontBuffer = createMinimalTTFBuffer("RobotoCustom-Bold");

    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'RobotoCustom', sans-serif; font-size: 14px; }
            h1 { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Heading in Bold Roboto</h1>
          <p>Paragraph in Regular Roboto</p>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      compress: false,
      fonts: {
        RobotoCustom: {
          regular: regularFontBuffer,
          bold: boldFontBuffer,
        },
      },
    });

    const pdfContent = pdfBuffer.toString("latin1");

    // Verify Type0, CIDFontType2, FontDescriptor, and ToUnicode CMap objects
    expect(pdfContent).toContain("/Subtype /Type0");
    expect(pdfContent).toContain("/Subtype /CIDFontType2");
    expect(pdfContent).toContain("/Type /FontDescriptor");
    expect(pdfContent).toContain("/BaseFont /RobotoCustom-Regular");
    expect(pdfContent).toContain("/BaseFont /RobotoCustom-Bold");
    expect(pdfContent).toContain("/CMapName /Adobe-Identity-UCS");
    expect(pdfContent).toContain("beginbfchar");
  });

  test("uses real custom font advance metrics for layout and line wrapping", async () => {
    const fontBuffer = createMinimalTTFBuffer("CustomMetricsFont");

    const html = `
      <html>
        <body style="font-family: 'CustomMetricsFont'; font-size: 10px; width: 100px;">
          <p>AAAA</p>
        </body>
      </html>
    `;

    const doc = await HtmlToPdf.generate({
      html,
      compress: false,
      fonts: {
        CustomMetricsFont: {
          regular: fontBuffer,
        },
      },
    });

    const pages = doc.getPages();
    expect(pages.length).toBe(1);

    const pdfBuffer = doc.save();
    const pdfContent = pdfBuffer.toString("latin1");

    expect(pdfContent).toContain("/BaseFont /CustomMetricsFont");
    // Text operator for custom font uses hex CID encoding (e.g. <0001000100010001> Tj)
    expect(pdfContent).toContain("<0001000100010001> Tj");
  });

  test("falls back to standard Helvetica when font is not registered in options.fonts", async () => {
    const html = `
      <html>
        <body style="font-family: 'NonExistentFont';">
          <p>Fallback Text</p>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      compress: false,
    });

    const pdfContent = pdfBuffer.toString("latin1");

    expect(pdfContent).toContain("/BaseFont /Helvetica");
  });
});
