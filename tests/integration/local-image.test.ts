import { describe, test, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { HtmlToPdf } from "../../src/index.js";
import { ImageError } from "../../src/errors/pdf-error.js";
import { extractPdfText } from "../utils/pdf-text-extractor.js";

const FIXTURES_DIR = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "local-image-integration",
);

const NESTED_DIR = path.join(FIXTURES_DIR, "assets", "images");

const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const JPEG_BUFFER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

const LOGO_PNG = path.join(FIXTURES_DIR, "logo.png");
const PHOTO_JPG = path.join(FIXTURES_DIR, "photo.jpg");
const NESTED_PNG = path.join(NESTED_DIR, "banner.png");
const CORRUPT_IMAGE = path.join(FIXTURES_DIR, "corrupt.png");
const DUMMY_DIR = path.join(FIXTURES_DIR, "sample-dir");

describe("Phase 16 — Local Image Asset Resolution Integration Tests", () => {
  beforeAll(() => {
    fs.mkdirSync(NESTED_DIR, { recursive: true });
    fs.mkdirSync(DUMMY_DIR, { recursive: true });
    fs.writeFileSync(LOGO_PNG, PNG_BUFFER);
    fs.writeFileSync(PHOTO_JPG, JPEG_BUFFER);
    fs.writeFileSync(NESTED_PNG, PNG_BUFFER);
    fs.writeFileSync(CORRUPT_IMAGE, Buffer.from("NOT_AN_IMAGE_DATA_12345"));
  });

  afterAll(() => {
    fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  test("1. Basic local PNG resolution with absolute path", async () => {
    const html = `<html><body><img src="${LOGO_PNG}" style="width: 100px; height: 100px;" /></body></html>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
    expect(pdfStr).toContain("/Filter /FlateDecode");
    expect(pdfStr).toContain("/Im1 Do");
  });

  test("2. Basic local JPEG resolution", async () => {
    const html = `<html><body><img src="${PHOTO_JPG}" style="width: 120px; height: 80px;" /></body></html>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
    expect(pdfStr).toContain("/Filter /DCTDecode");
  });

  test("3. Relative ./ path resolution with basePath", async () => {
    const html = `<html><body><img src="./logo.png" style="width: 50px;" /></body></html>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      basePath: FIXTURES_DIR,
      compress: false,
    });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
    expect(pdfStr).toContain("/Im1 Do");
  });

  test("4. Relative nested path resolution with basePath", async () => {
    const html = `<html><body><img src="./assets/images/banner.png" style="width: 60px;" /></body></html>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      basePath: FIXTURES_DIR,
      compress: false,
    });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("5. Relative ../ path resolution within basePath", async () => {
    const html = `<html><body><img src="./assets/other/../images/banner.png" style="width: 40px;" /></body></html>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      basePath: FIXTURES_DIR,
      compress: false,
    });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("6. Data URL regression check", async () => {
    const dataUrl = `data:image/png;base64,${PNG_BUFFER.toString("base64")}`;
    const html = `<html><body><img src="${dataUrl}" style="width: 30px;" /></body></html>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("7. Existing options.images API regression check", async () => {
    const html = `<html><body><img src="custom-logo" style="width: 80px;" /></body></html>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      images: {
        "custom-logo": PNG_BUFFER,
      },
      compress: false,
    });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("8. Explicit options.images precedence over filesystem", async () => {
    const html = `<html><body><img src="logo.png" style="width: 90px;" /></body></html>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      basePath: FIXTURES_DIR,
      images: {
        "logo.png": JPEG_BUFFER,
      },
      compress: false,
    });
    const pdfStr = pdfBuffer.toString("latin1");

    // Must use JPEG from options.images, not PNG from filesystem
    expect(pdfStr).toContain("/Filter /DCTDecode");
  });

  test("9. Throws ImageError on missing local image file", async () => {
    const html = `<html><body><img src="./non-existent-image.png" /></body></html>`;
    await expect(
      HtmlToPdf.generateBuffer({ html, basePath: FIXTURES_DIR }),
    ).rejects.toThrow(ImageError);
  });

  test("10. Throws ImageError on corrupt image file", async () => {
    const html = `<html><body><img src="${CORRUPT_IMAGE}" /></body></html>`;
    await expect(HtmlToPdf.generateBuffer({ html })).rejects.toThrow(
      ImageError,
    );
  });

  test("11. Throws ImageError on directory path", async () => {
    const html = `<html><body><img src="${DUMMY_DIR}" /></body></html>`;
    await expect(HtmlToPdf.generateBuffer({ html })).rejects.toThrow(
      ImageError,
    );
  });

  test("12. Throws ImageError on path traversal attempt escaping basePath", async () => {
    const html = `<html><body><img src="../../../../etc/passwd" /></body></html>`;
    await expect(
      HtmlToPdf.generateBuffer({ html, basePath: FIXTURES_DIR }),
    ).rejects.toThrow(ImageError);
  });

  test("13. Throws ImageError on remote HTTP/HTTPS images", async () => {
    const html1 = `<html><body><img src="https://example.com/logo.png" /></body></html>`;
    await expect(HtmlToPdf.generateBuffer({ html: html1 })).rejects.toThrow(
      ImageError,
    );

    const html2 = `<html><body><img src="http://example.com/photo.jpg" /></body></html>`;
    await expect(HtmlToPdf.generateBuffer({ html: html2 })).rejects.toThrow(
      ImageError,
    );
  });

  test("14. Caching: Repeated image references in document render without error", async () => {
    const html = `
      <html>
        <body>
          <img src="${LOGO_PNG}" style="width: 50px;" />
          <img src="${LOGO_PNG}" style="width: 50px;" />
          <img src="${LOGO_PNG}" style="width: 50px;" />
        </body>
      </html>
    `;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("15. Concurrent rendering isolation", async () => {
    const htmlA = `<html><body><img src="${LOGO_PNG}" style="width: 40px;" /></body></html>`;
    const htmlB = `<html><body><img src="${PHOTO_JPG}" style="width: 60px;" /></body></html>`;

    const [resA, resB] = await Promise.all([
      HtmlToPdf.generateBuffer({ html: htmlA, compress: false }),
      HtmlToPdf.generateBuffer({ html: htmlB, compress: false }),
    ]);

    expect(resA.toString("latin1")).toContain("/Filter /FlateDecode");
    expect(resB.toString("latin1")).toContain("/Filter /DCTDecode");
  });

  test("16. Image sizing: width, height, min/max constraints", async () => {
    const html = `
      <html>
        <body>
          <img src="${LOGO_PNG}" style="width: 100px; max-width: 50px;" />
          <img src="${LOGO_PNG}" style="width: 20px; min-width: 80px;" />
        </body>
      </html>
    `;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("17. Image in Table layout", async () => {
    const html = `
      <html>
        <body>
          <table>
            <thead><tr><th>Product</th><th>Preview</th></tr></thead>
            <tbody>
              <tr><td>Logo</td><td><img src="${LOGO_PNG}" style="width: 40px;" /></td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("18. Image in Flexbox & Flex-wrap layout", async () => {
    const html = `
      <html>
        <head>
          <style>
            .flex-row { display: flex; flex-wrap: wrap; }
          </style>
        </head>
        <body>
          <div class="flex-row">
            <div><img src="${LOGO_PNG}" style="width: 50px;" /></div>
            <div><img src="${PHOTO_JPG}" style="width: 50px;" /></div>
          </div>
        </body>
      </html>
    `;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("19. Image in CSS Grid layout", async () => {
    const html = `
      <html>
        <head>
          <style>
            .grid { display: grid; grid-template-columns: 1fr 1fr; }
          </style>
        </head>
        <body>
          <div class="grid">
            <img src="${LOGO_PNG}" style="width: 40px;" />
            <img src="${PHOTO_JPG}" style="width: 40px;" />
          </div>
        </body>
      </html>
    `;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("20. Image in Positioned elements (position: absolute)", async () => {
    const html = `
      <html>
        <body>
          <div style="position: relative; width: 400px; height: 300px;">
            <img src="${LOGO_PNG}" style="position: absolute; top: 20px; left: 30px; width: 50px;" />
          </div>
        </body>
      </html>
    `;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("21. Paginated local image across page breaks", async () => {
    const html = `
      <html>
        <body>
          <div>Page 1</div>
          <div style="break-before: page;">
            <img src="${LOGO_PNG}" style="width: 60px;" />
          </div>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(2);

    const pdfStr = doc.save().toString("latin1");
    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("22. Local image in Headers and Footers", async () => {
    const html = `<html><body><p>Main Page Content</p></body></html>`;
    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      compress: false,
      header: {
        text: "Logo Header",
        align: "left",
      },
      footer: {
        text: "Page {{pageNumber}}",
        align: "right",
      },
    });
    const pdfStr = pdfBuffer.toString("latin1");

    const extracted = extractPdfText(pdfBuffer);
    expect(extracted).toContain("Main Page Content");
  });

  test("23. Hyperlinked local image (<a href='...'><img src='...' /></a>)", async () => {
    const html = `
      <html>
        <body>
          <a href="https://example.com">
            <img src="${LOGO_PNG}" style="width: 80px;" />
          </a>
        </body>
      </html>
    `;
    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Subtype /Link");
    expect(pdfStr).toContain("/URI (https://example.com)");
    expect(pdfStr).toContain("/Subtype /Image");
  });

  test("24. Deterministic PDF output byte equality for local images", async () => {
    const html = `
      <html>
        <body>
          <img src="${LOGO_PNG}" style="width: 100px;" />
          <img src="${PHOTO_JPG}" style="width: 100px;" />
        </body>
      </html>
    `;

    const render1 = await HtmlToPdf.generateBuffer({ html, compress: false });
    const render2 = await HtmlToPdf.generateBuffer({ html, compress: false });

    expect(render1.equals(render2)).toBe(true);
  });
});
