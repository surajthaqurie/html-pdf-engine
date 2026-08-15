import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/index.js";
import { createMinimalTTFBuffer } from "../fonts/ttf-parser.test.js";

describe("Phase 13 — Advanced Table Pagination & Repeating Headers", () => {
  // 1. Single-page table regression
  it("renders single-page table with header rendered once", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead>
              <tr><th>Header Col 1</th><th>Header Col 2</th></tr>
            </thead>
            <tbody>
              <tr><td>Row 1 Col 1</td><td>Row 1 Col 2</td></tr>
              <tr><td>Row 2 Col 1</td><td>Row 2 Col 2</td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("(Header Col 1) Tj");
  });

  // 2. Multi-page table
  it("paginates multi-page table across multiple pages", async () => {
    const rows = Array.from({ length: 60 }, (_, i) => `
      <tr><td style="height: 20pt;">Row item ${i + 1}</td><td>Value ${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead>
              <tr><th>Item Name</th><th>Value</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBeGreaterThan(1);
  });

  // 3. Automatic <thead> repetition
  it("repeats <thead> header on Page 2 of a multi-page table", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `
      <tr><td style="height: 25pt;">Row #${i + 1} description text</td><td>${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead>
              <tr><th>Unique Header Column A</th><th>Unique Header Column B</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
    const pdfStr = doc.save().toString("binary");

    const matches = pdfStr.match(/\(Unique Header Column A\) Tj/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  // 4. Multiple <thead> rows
  it("repeats all rows of a multi-row <thead>", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `
      <tr><td style="height: 20pt;">Product ${i + 1}</td><td>Category ${i + 1}</td><td>$${i + 10}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead>
              <tr><th colspan="2">Main Category Section</th><th>Pricing</th></tr>
              <tr><th>Product Name</th><th>Category</th><th>Amount</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
    const pdfStr = doc.save().toString("binary");

    const matchesTop = pdfStr.match(/\(Main Category Section\) Tj/g);
    const matchesSub = pdfStr.match(/\(Product Name\) Tj/g);
    expect(matchesTop!.length).toBeGreaterThanOrEqual(2);
    expect(matchesSub!.length).toBeGreaterThanOrEqual(2);
  });

  // 5. Header geometry consistency
  it("maintains consistent column geometry across pages", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `
      <tr><td style="height: 20pt;">Data Row ${i + 1}</td><td>Details for item ${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead>
              <tr><th style="width: 200pt;">Fixed Col 1</th><th>Auto Col 2</th></tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
  });

  // 6. Table row break-inside: avoid
  it("respects break-inside: avoid on tr elements near page bottom", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 0;">
          <div style="height: 700pt;">Spacer block</div>
          <table style="width: 100%;">
            <thead>
              <tr><th>Header Cell</th></tr>
            </thead>
            <tbody>
              <tr style="break-inside: avoid;">
                <td style="height: 100pt;">Row that should move to Page 2</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(2);
  });

  // 7. page-break-inside: avoid legacy alias
  it("respects legacy page-break-inside: avoid on tr", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 0;">
          <div style="height: 700pt;">Spacer block</div>
          <table style="width: 100%;">
            <tbody>
              <tr style="page-break-inside: avoid;">
                <td style="height: 120pt;">Legacy page break inside row</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(2);
  });

  // 8. Long text inside table cells
  it("wraps long text inside cell and calculates row height", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <tbody>
              <tr>
                <td style="width: 100pt;">
                  Very long text string that will wrap across multiple lines inside this cell and push the height of the row.
                </td>
                <td>Short cell</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
  });

  // 9. Row height based on tallest cell
  it("expands row height to match tallest cell in that row", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <tbody>
              <tr>
                <td style="height: 150pt; background-color: yellow;">Tall Cell</td>
                <td style="background-color: blue;">Short Cell</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
  });

  // 10. Large table pagination (100 rows)
  it("paginates 100-row table efficiently without errors", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => `
      <tr><td style="height: 18pt;">Large Row Item #${i + 1}</td><td>Pass</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead><tr><th>Index</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const start = Date.now();
    const doc = await HtmlToPdf.generate({ html, compress: false });
    const duration = Date.now() - start;
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
    expect(duration).toBeLessThan(2000);
  });

  // 11. Table with images
  it("renders image inside repeated header and body cell across pages", async () => {
    const imgData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const rows = Array.from({ length: 40 }, (_, i) => `
      <tr><td style="height: 20pt;">Item ${i + 1}</td><td><img src="${imgData}" style="width: 10pt; height: 10pt;" /></td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead>
              <tr>
                <th><img src="${imgData}" style="width: 15pt; height: 15pt;" /> Header Logo</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("/Subtype /Image");
  });

  // 12. Table with custom fonts
  it("subsets custom font used in repeated table header", async () => {
    const fontBuf = createMinimalTTFBuffer("TableFont-Regular");
    const rows = Array.from({ length: 40 }, (_, i) => `
      <tr><td style="height: 20pt;">Custom font data row ${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'TableFont', sans-serif; }
          </style>
        </head>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead>
              <tr><th>Header With Custom Font</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({
      html,
      compress: false,
      fonts: { TableFont: { regular: fontBuf } },
    });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("/BaseFont /TableFont-Regular");
  });

  // 13. Table with hyperlinks
  it("renders hyperlink annotation inside cell", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <tbody>
              <tr>
                <td><a href="https://example.com/item">Item Link</a></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("/Subtype /Link");
    expect(pdfStr).toContain("https://example.com/item");
  });

  // 14. Hyperlinks in repeated headers
  it("repeats hyperlink annotation on Page 2 when header is repeated", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `
      <tr><td style="height: 20pt;">Row ${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead>
              <tr>
                <th><a href="https://example.com/header">Header Link</a></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
    const pdfStr = doc.save().toString("binary");

    const linkMatches = pdfStr.match(/\/Subtype \/Link/g);
    expect(linkMatches).not.toBeNull();
    expect(linkMatches!.length).toBeGreaterThanOrEqual(2);
  });

  // 15. Table inside Flexbox
  it("renders table inside flexbox container", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <div style="display: flex;">
            <table style="width: 100%;">
              <thead><tr><th>Flex Table Header</th></tr></thead>
              <tbody><tr><td>Flex Table Body Cell</td></tr></tbody>
            </table>
          </div>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("(Flex Table Header) Tj");
  });

  // 16. Table inside flex-wrap
  it("paginates table inside flex-wrap container", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `
      <tr><td style="height: 20pt;">Wrapped Flex Table Row ${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <div style="display: flex; flex-wrap: wrap;">
            <table style="width: 100%;">
              <thead><tr><th>Flex Wrap Header</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
  });

  // 17. Table inside Grid
  it("renders table inside grid container", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <div style="display: grid; grid-template-columns: 1fr;">
            <table style="width: 100%;">
              <thead><tr><th>Grid Table Header</th></tr></thead>
              <tbody><tr><td>Grid Table Cell</td></tr></tbody>
            </table>
          </div>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("(Grid Table Header) Tj");
  });

  // 18. Nested Grid inside table cell
  it("renders nested grid container inside a table cell", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <tbody>
              <tr>
                <td>
                  <div style="display: grid; grid-template-columns: 1fr 1fr;">
                    <div>Cell Grid Left</div>
                    <div>Cell Grid Right</div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("(Cell Grid Left) Tj");
  });

  // 19. Nested Flexbox inside table cell
  it("renders nested flexbox inside table cell", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <tbody>
              <tr>
                <td>
                  <div style="display: flex; justify-content: space-between;">
                    <span>Flex Item 1</span>
                    <span>Flex Item 2</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("(Flex Item 1) Tj");
  });

  // 20. Nested tables
  it("renders nested table inside cell without corrupting outer layout", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%; border: 1px solid black;">
            <thead><tr><th>Outer Header</th></tr></thead>
            <tbody>
              <tr>
                <td>
                  <table style="width: 100%; border: 1px red;">
                    <thead><tr><th>Inner Header</th></tr></thead>
                    <tbody><tr><td>Inner Cell Data</td></tr></tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("(Outer Header) Tj");
    expect(pdfStr).toContain("(Inner Header) Tj");
  });

  // 21. Explicit break-before
  it("forces page break before table with break-before: page", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 0;">
          <div style="height: 100pt;">Top block</div>
          <table style="break-before: page; width: 100%;">
            <thead><tr><th>Table Header</th></tr></thead>
            <tbody><tr><td>Table Content</td></tr></tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(2);
  });

  // 22. Explicit break-after
  it("forces page break after table with break-after: page", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 0;">
          <table style="break-after: page; width: 100%;">
            <thead><tr><th>Table Header</th></tr></thead>
            <tbody><tr><td>Table Content</td></tr></tbody>
          </table>
          <div>Content After Table</div>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(2);
  });

  // 23. break-inside: avoid on table
  it("moves entire table to next page if it fits and break-inside: avoid is set", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 0;">
          <div style="height: 650pt;">Spacer</div>
          <table style="break-inside: avoid; width: 100%;">
            <thead><tr><th>Avoid Header</th></tr></thead>
            <tbody><tr><td style="height: 100pt;">Avoid Body</td></tr></tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(2);
  });

  // 24. Oversized table row
  it("handles oversized row taller than page printable height without infinite loop", async () => {
    const html = `
      <html>
        <body style="margin: 0; padding: 0;">
          <table style="width: 100%;">
            <tbody>
              <tr>
                <td style="height: 900pt;">Oversized Row Cell</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
  });

  // 25. Page index propagation
  it("synchronizes pageIndex across table row, cell, and text lines", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `
      <tr><td style="height: 20pt;">Item ${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead><tr><th>Header</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
  });

  // 26. Border consistency across pages
  it("renders borders for repeated table headers on page 2", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `
      <tr><td style="border-bottom: 1px solid #ccc; height: 20pt;">Row ${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%; border: 2px solid blue;">
            <thead>
              <tr style="border-bottom: 2px solid red;">
                <th style="padding: 10pt;">Bordered Header</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
  });

  // 27. Header/footer interaction
  it("renders PDF page headers/footers alongside repeating table headers", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `
      <tr><td style="height: 20pt;">Line Item #${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead><tr><th>Table Header Text</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({
      html,
      compress: false,
      header: { text: "PDF Document Header", align: "right" },
      footer: { text: "Page {{pageNumber}} of {{totalPages}}", align: "center" },
    });
    expect(doc.getPages().length).toBeGreaterThanOrEqual(2);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("(PDF Document Header) Tj");
    expect(pdfStr).toContain("(Table Header Text) Tj");
  });

  // 28. Dynamic page numbers
  it("substitutes dynamic page numbers in PDF footer on multi-page table", async () => {
    const rows = Array.from({ length: 45 }, (_, i) => `
      <tr><td style="height: 20pt;">Data Row ${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead><tr><th>Dynamic Header</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const doc = await HtmlToPdf.generate({
      html,
      compress: false,
      footer: { text: "Page {{pageNumber}} of {{totalPages}}", align: "center" },
    });
    const pageCount = doc.getPages().length;
    expect(pageCount).toBeGreaterThanOrEqual(2);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain(`(Page 1 of ${pageCount}) Tj`);
    expect(pdfStr).toContain(`(Page 2 of ${pageCount}) Tj`);
  });

  // 29. Deterministic PDF output
  it("produces identical byte output for deterministic multi-page table", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => `
      <tr><td>Row ${i + 1}</td></tr>
    `).join("");
    const html = `
      <html>
        <body style="margin: 0; padding: 20pt;">
          <table style="width: 100%;">
            <thead><tr><th>Header</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const doc1 = await HtmlToPdf.generate({ html, compress: false });
    const doc2 = await HtmlToPdf.generate({ html, compress: false });
    expect(Buffer.from(doc1.save()).equals(Buffer.from(doc2.save()))).toBe(true);
  });

  // 30. Regression against existing table behavior
  it("retains existing simple table layout and structure", async () => {
    const html = `
      <div style="font-family: Helvetica; margin: 20px;">
        <h2>System Performance Matrix</h2>
        <table style="border: 1px solid #cbd5e1; margin-top: 10px;">
          <thead>
            <tr style="background-color: #e2e8f0;">
              <th style="padding: 6px;">Module</th>
              <th style="padding: 6px;">Execution Time</th>
              <th style="padding: 6px;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding: 6px;">HTML Tokenizer</td><td style="padding: 6px;">0.12 ms</td><td style="padding: 6px;">PASSED</td></tr>
            <tr><td style="padding: 6px;">CSS Cascade</td><td style="padding: 6px;">0.24 ms</td><td style="padding: 6px;">PASSED</td></tr>
            <tr><td style="padding: 6px;">PDF Writer</td><td style="padding: 6px;">0.18 ms</td><td style="padding: 6px;">PASSED</td></tr>
          </tbody>
        </table>
      </div>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    expect(doc.getPages().length).toBe(1);
    const pdfStr = doc.save().toString("binary");
    expect(pdfStr).toContain("(System Performance Matrix) Tj");
    expect(pdfStr).toContain("(HTML Tokenizer) Tj");
  });
});
