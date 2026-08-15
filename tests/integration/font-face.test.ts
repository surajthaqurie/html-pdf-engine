import { describe, test, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { HtmlToPdf } from "../../src/index.js";
import { FontError } from "../../src/errors/pdf-error.js";
import { createMinimalTTFBuffer } from "../fonts/ttf-parser.test.js";

const FIXTURES_DIR = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "font-face-integration",
);
const INTER_REGULAR_PATH = path.join(FIXTURES_DIR, "Inter-Regular.ttf");
const INTER_BOLD_PATH = path.join(FIXTURES_DIR, "Inter-Bold.ttf");
const INTER_ITALIC_PATH = path.join(FIXTURES_DIR, "Inter-Italic.ttf");
const ROBOTO_REGULAR_PATH = path.join(FIXTURES_DIR, "Roboto-Regular.ttf");
const INVALID_TTF_PATH = path.join(FIXTURES_DIR, "corrupt.ttf");
const WOFF_FONT_PATH = path.join(FIXTURES_DIR, "sample.woff");

describe("Phase 15 — Local @font-face Support Integration Tests", () => {
  beforeAll(() => {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    fs.writeFileSync(
      INTER_REGULAR_PATH,
      createMinimalTTFBuffer("Inter-Regular"),
    );
    fs.writeFileSync(INTER_BOLD_PATH, createMinimalTTFBuffer("Inter-Bold"));
    fs.writeFileSync(INTER_ITALIC_PATH, createMinimalTTFBuffer("Inter-Italic"));
    fs.writeFileSync(
      ROBOTO_REGULAR_PATH,
      createMinimalTTFBuffer("Roboto-Regular"),
    );
    fs.writeFileSync(
      INVALID_TTF_PATH,
      Buffer.from("CORRUPT_HEADER_DATA_1234567890"),
    );
    fs.writeFileSync(WOFF_FONT_PATH, Buffer.from("WOFF_HEADER_DUMMY_DATA"));
  });

  afterAll(() => {
    fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
  });

  test("1. Basic @font-face loading and embedding in PDF", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "Inter";
              src: url("${INTER_REGULAR_PATH}");
            }
            body { font-family: "Inter"; font-size: 14px; }
          </style>
        </head>
        <body>
          <p>Hello @font-face World</p>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
    expect(pdfStr).toContain("/Subtype /Type0");
    expect(pdfStr).toContain("/Subtype /CIDFontType2");
  });

  test("2. Relative TTF path resolution with basePath option", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "InterRel";
              src: url("./Inter-Regular.ttf");
            }
            body { font-family: "InterRel"; }
          </style>
        </head>
        <body>
          <p>Relative font path text</p>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      basePath: FIXTURES_DIR,
      compress: false,
    });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
  });

  test("3. Multiple font weight variants resolution (400 vs 700 / bold)", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "InterVar";
              src: url("${INTER_REGULAR_PATH}");
              font-weight: 400;
            }
            @font-face {
              font-family: "InterVar";
              src: url("${INTER_BOLD_PATH}");
              font-weight: 700;
            }
            p.regular { font-family: "InterVar"; font-weight: 400; }
            p.bold { font-family: "InterVar"; font-weight: 700; }
          </style>
        </head>
        <body>
          <p class="regular">Regular Text</p>
          <p class="bold">Bold Text</p>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
    expect(pdfStr).toContain("/BaseFont /Inter-Bold");
  });

  test("4. Font style resolution (normal vs italic)", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "InterStyle";
              src: url("${INTER_REGULAR_PATH}");
              font-style: normal;
            }
            @font-face {
              font-family: "InterStyle";
              src: url("${INTER_ITALIC_PATH}");
              font-style: italic;
            }
            p.normal { font-family: "InterStyle"; font-style: normal; }
            p.italic { font-family: "InterStyle"; font-style: italic; }
          </style>
        </head>
        <body>
          <p class="normal">Normal Text</p>
          <p class="italic">Italic Text</p>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
    expect(pdfStr).toContain("/BaseFont /Inter-Italic");
  });

  test("5. Multiple font families in single document", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "InterFamily";
              src: url("${INTER_REGULAR_PATH}");
            }
            @font-face {
              font-family: "RobotoFamily";
              src: url("${ROBOTO_REGULAR_PATH}");
            }
          </style>
        </head>
        <body>
          <h1 style="font-family: 'InterFamily';">Heading in Inter</h1>
          <p style="font-family: 'RobotoFamily';">Paragraph in Roboto</p>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
    expect(pdfStr).toContain("/BaseFont /Roboto-Regular");
  });

  test("6. Explicit options.fonts API takes precedence over CSS @font-face", async () => {
    const overrideBuffer = createMinimalTTFBuffer("ExplicitOverrideFont");

    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "InterOverride";
              src: url("${INTER_REGULAR_PATH}");
            }
          </style>
        </head>
        <body>
          <p style="font-family: 'InterOverride';">Precedence Test</p>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      compress: false,
      fonts: {
        InterOverride: {
          regular: overrideBuffer,
        },
      },
    });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /ExplicitOverrideFont");
    expect(pdfStr).not.toContain("/BaseFont /Inter-Regular");
  });

  test("7. Font subsetting, /ToUnicode generation & text searchability", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "InterSubset";
              src: url("${INTER_REGULAR_PATH}");
            }
          </style>
        </head>
        <body>
          <p style="font-family: 'InterSubset';">AAAA</p>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/Adobe-Identity-UCS");
    expect(pdfStr).toContain("beginbfchar");
    expect(pdfStr).toContain("<0001000100010001> Tj");
  });

  test("8. Table layout text rendering with @font-face font", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "TableFont";
              src: url("${INTER_REGULAR_PATH}");
            }
            table { width: 100%; font-family: "TableFont"; }
            th, td { border: 1px solid black; padding: 4px; }
          </style>
        </head>
        <body>
          <table>
            <thead><tr><th>Header</th></tr></thead>
            <tbody><tr><td>Cell Content</td></tr></tbody>
          </table>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
  });

  test("9. Flexbox & Flex-wrap text rendering with @font-face font", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "FlexFont";
              src: url("${INTER_REGULAR_PATH}");
            }
            .flex-container {
              display: flex;
              flex-wrap: wrap;
              font-family: "FlexFont";
            }
            .flex-item { width: 200px; }
          </style>
        </head>
        <body>
          <div class="flex-container">
            <div class="flex-item">Item A</div>
            <div class="flex-item">Item B</div>
          </div>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
  });

  test("10. CSS Grid layout text rendering with @font-face font", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "GridFont";
              src: url("${INTER_REGULAR_PATH}");
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              font-family: "GridFont";
            }
          </style>
        </head>
        <body>
          <div class="grid">
            <div>Grid 1</div>
            <div>Grid 2</div>
          </div>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
  });

  test("11. Positioned text rendering with @font-face font", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "PosFont";
              src: url("${INTER_REGULAR_PATH}");
            }
            .abs {
              position: absolute;
              top: 50px;
              left: 100px;
              font-family: "PosFont";
            }
          </style>
        </head>
        <body>
          <div class="abs">Positioned Text</div>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
  });

  test("12. Dynamic Headers and Footers with @font-face font", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "HeaderFooterFont";
              src: url("${INTER_REGULAR_PATH}");
            }
            body { font-family: "HeaderFooterFont"; }
          </style>
        </head>
        <body>
          <p>Document Content</p>
        </body>
      </html>
    `;

    const pdfBuffer = await HtmlToPdf.generateBuffer({
      html,
      compress: false,
      header: {
        left: "Header Page {{pageNumber}}",
      },
      footer: {
        right: "Page {{pageNumber}} of {{totalPages}}",
      },
    });
    const pdfStr = pdfBuffer.toString("latin1");

    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
  });

  test("13. Multi-page document text rendering across page boundaries", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "MultiPageFont";
              src: url("${INTER_REGULAR_PATH}");
            }
            body { font-family: "MultiPageFont"; font-size: 16px; }
            .page-break { break-before: page; }
          </style>
        </head>
        <body>
          <div>Page 1 Content</div>
          <div class="page-break">Page 2 Content</div>
        </body>
      </html>
    `;

    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(2);

    const pdfStr = doc.save().toString("latin1");
    expect(pdfStr).toContain("/BaseFont /Inter-Regular");
  });

  test("14. Throws FontError on missing font file", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "MissingFont";
              src: url("./does-not-exist.ttf");
            }
            body { font-family: "MissingFont"; }
          </style>
        </head>
        <body>
          <p>Text</p>
        </body>
      </html>
    `;

    await expect(HtmlToPdf.generateBuffer({ html })).rejects.toThrow(FontError);
  });

  test("15. Throws FontError on corrupt TTF file", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "CorruptFont";
              src: url("${INVALID_TTF_PATH}");
            }
            body { font-family: "CorruptFont"; }
          </style>
        </head>
        <body>
          <p>Text</p>
        </body>
      </html>
    `;

    await expect(HtmlToPdf.generateBuffer({ html })).rejects.toThrow(FontError);
  });

  test("16. Throws FontError on unsupported WOFF format", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "WoffFont";
              src: url("${WOFF_FONT_PATH}");
            }
            body { font-family: "WoffFont"; }
          </style>
        </head>
        <body>
          <p>Text</p>
        </body>
      </html>
    `;

    await expect(HtmlToPdf.generateBuffer({ html })).rejects.toThrow(FontError);
  });

  test("17. Deterministic output byte equality for identical renders", async () => {
    const html = `
      <html>
        <head>
          <style>
            @font-face {
              font-family: "DetFont";
              src: url("${INTER_REGULAR_PATH}");
            }
            body { font-family: "DetFont"; }
          </style>
        </head>
        <body>
          <p>Deterministic Output Test</p>
        </body>
      </html>
    `;

    const render1 = await HtmlToPdf.generateBuffer({ html, compress: false });
    const render2 = await HtmlToPdf.generateBuffer({ html, compress: false });

    expect(render1.equals(render2)).toBe(true);
  });
});
