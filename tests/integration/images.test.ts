import { describe, test, expect } from "vitest";
import { HtmlToPdf } from "../../src/index.js";

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const TINY_JPEG_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

describe("Phase 1: Image Support Integration Tests", () => {
  test("embeds PNG base64 data URL into PDF as XObject", async () => {
    const html = `
      <html>
        <body>
          <h1>Invoice with Logo</h1>
          <img src="${TINY_PNG_DATA_URL}" style="width: 100px; height: 50px;" />
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfContent = pdfBuffer.toString("latin1");

    expect(pdfContent).toContain("/Type /XObject");
    expect(pdfContent).toContain("/Subtype /Image");
    expect(pdfContent).toContain("/Im1 Do");
    // 100px = 75pt, 50px = 37.5pt
    expect(pdfContent).toContain("75.0000 0 0 37.5000");
  });

  test("embeds JPEG base64 data URL into PDF with DCTDecode filter", async () => {
    const html = `
      <html>
        <body>
          <img src="${TINY_JPEG_DATA_URL}" width="120" height="80" />
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfContent = pdfBuffer.toString("latin1");

    expect(pdfContent).toContain("/Filter /DCTDecode");
    expect(pdfContent).toContain("/Subtype /Image");
    expect(pdfContent).toContain("120.0000 0 0 80.0000");
  });

  test("preserves aspect ratio when only width is set", async () => {
    const doc = await HtmlToPdf.generate({
      html: `<html><body><img src="${TINY_PNG_DATA_URL}" style="width: 50px; height: auto;" /></body></html>`,
      compress: false,
    });

    const pages = doc.getPages();
    expect(pages.length).toBe(1);

    const pdfBuffer = doc.save();
    const pdfContent = pdfBuffer.toString("latin1");

    // 1x1 image, width=50px (37.5pt) -> height should be calculated as 50px (37.5pt)
    expect(pdfContent).toContain("37.5000 0 0 37.5000");
  });

  test("resolves custom image buffer from images option map", async () => {
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    const html = `<html><body><img src="my-logo.png" style="width: 80px;" /></body></html>`;

    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      images: {
        "my-logo.png": pngBuffer,
      },
      compress: false,
    });

    const pdfContent = pdfBuffer.toString("latin1");
    expect(pdfContent).toContain("/Subtype /Image");
    expect(pdfContent).toContain("/Im1 Do");
    // 80px = 60pt
    expect(pdfContent).toContain("60.0000 0 0 60.0000");
  });
});
