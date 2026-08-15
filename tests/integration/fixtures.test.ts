import { describe, it, expect } from "vitest";
import { HtmlToPdf } from "../../src/core/html-to-pdf.js";
import * as fs from "fs";
import * as path from "path";

describe("Phase 9 — Document Rendering Fixtures Suite", () => {
  const artifactsDir = path.join(process.cwd(), "artifacts", "fixtures");

  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // 1. Basic Document
  it("should render 1. Basic Document fixture", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica; margin: 20px; }
            h1 { color: #1e3a8a; font-size: 24pt; }
            p { font-size: 11pt; color: #374151; line-height: 1.5; }
          </style>
        </head>
        <body>
          <h1>Basic Document Fixture</h1>
          <p>This fixture tests basic HTML element rendering, paragraph flow, and simple styling.</p>
        </body>
      </html>
    `;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    fs.writeFileSync(path.join(artifactsDir, "01_basic_document.pdf"), buffer);

    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.toString("binary")).toContain("(Basic Document Fixture) Tj");
  });

  // 2. Invoice
  it("should render 2. Invoice fixture", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica; margin: 30px; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
            .title { color: #1d4ed8; font-size: 22pt; margin: 0; }
            .info { font-size: 10pt; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background-color: #f3f4f6; color: #1f2937; padding: 8px; text-align: left; }
            td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 10pt; }
            .total { font-size: 12pt; font-weight: bold; text-align: right; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">INVOICE #INV-2026-001</h1>
            <p class="info">Date: August 15, 2026 | Billed To: Acme Corp</p>
          </div>
          <table>
            <thead>
              <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>
            </thead>
            <tbody>
              <tr><td>TypeScript Engine Consulting</td><td>10 hrs</td><td>$150.00</td><td>$1,500.00</td></tr>
              <tr><td>PDF Generation Pipeline Optimization</td><td>5 hrs</td><td>$150.00</td><td>$750.00</td></tr>
            </tbody>
          </table>
          <div class="total"><p>Total Due: $2,250.00</p></div>
        </body>
      </html>
    `;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    fs.writeFileSync(path.join(artifactsDir, "02_invoice.pdf"), buffer);

    expect(buffer.toString("binary")).toContain("(INVOICE #INV-2026-001) Tj");
    expect(buffer.toString("binary")).toContain("(Total Due: $2,250.00) Tj");
  });

  // 3. Receipt
  it("should render 3. Receipt fixture", async () => {
    const html = `
      <div style="font-family: Courier; padding: 15px; width: 250pt;">
        <h2 style="text-align: center; margin-bottom: 5px;">COFFEE SHOP RECEIPT</h2>
        <p style="text-align: center; font-size: 9pt; margin-top: 0;">Order #4092 - 2026-08-15</p>
        <hr />
        <p>1x Espresso ........... $3.50</p>
        <p>1x Almond Croissant ..... $4.50</p>
        <hr />
        <p style="font-weight: bold;">TOTAL: $8.00</p>
        <p style="text-align: center; font-size: 8pt; margin-top: 15px;">Thank you for your visit!</p>
      </div>
    `;
    const doc = await HtmlToPdf.generate({
      html,
      page: { width: 280, height: 400 },
      compress: false,
    });
    const buffer = doc.save();
    fs.writeFileSync(path.join(artifactsDir, "03_receipt.pdf"), buffer);

    expect(buffer.toString("binary")).toContain("(COFFEE SHOP RECEIPT) Tj");
  });

  // 4. Quotation
  it("should render 4. Quotation fixture", async () => {
    const html = `
      <div style="font-family: Helvetica; margin: 25px;">
        <h1 style="color: #0f766e;">Commercial Price Quotation</h1>
        <p>Prepared for: Tech Solutions Inc.</p>
        <table style="margin-top: 15px;">
          <tr><th>Service Module</th><th>Estimated Price</th></tr>
          <tr><td>Architecture Audit</td><td>$3,000.00</td></tr>
          <tr><td>Performance Benchmark Suite</td><td>$1,500.00</td></tr>
        </table>
      </div>
    `;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    fs.writeFileSync(path.join(artifactsDir, "04_quotation.pdf"), buffer);

    expect(buffer.toString("binary")).toContain("(Commercial Price Quotation) Tj");
  });

  // 5. Report
  it("should render 5. Report fixture", async () => {
    const html = `
      <div style="font-family: Helvetica; margin: 30px;">
        <h1 style="color: #1e293b; border-bottom: 2px solid #3b82f6;">Executive Summary Report</h1>
        <p>This report outlines the structural audit and technical quality enhancements for html-pdf-engine.</p>
        <h2>Key Metrics</h2>
        <ul>
          <li>Zero Runtime Dependencies</li>
          <li>Sub-10ms Render Speed</li>
          <li>Strict TypeScript Type Safety</li>
        </ul>
      </div>
    `;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    fs.writeFileSync(path.join(artifactsDir, "05_report.pdf"), buffer);

    expect(buffer.toString("binary")).toContain("(Executive Summary Report) Tj");
  });

  // 6. Table
  it("should render 6. Table fixture", async () => {
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
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    fs.writeFileSync(path.join(artifactsDir, "06_table.pdf"), buffer);

    expect(buffer.toString("binary")).toContain("(System Performance Matrix) Tj");
  });

  // 7. Long Text
  it("should render 7. Long Text fixture", async () => {
    const paragraphs = Array.from(
      { length: 15 },
      (_, i) =>
        `<p style="line-height: 1.4; margin-bottom: 10px;">Paragraph block #${i + 1}: Detailed prose text demonstrating inline character measurement, text wrapping, margin spacing, and continuous page flow in pure TypeScript rendering engine.</p>`,
    ).join("");

    const html = `<div style="font-family: Times-Roman; margin: 30px;">${paragraphs}</div>`;
    const buffer = await HtmlToPdf.generateBuffer({ html, compress: false });
    fs.writeFileSync(path.join(artifactsDir, "07_long_text.pdf"), buffer);

    expect(buffer.length).toBeGreaterThan(500);
  });

  // 8. Multi-page Document
  it("should render 8. Multi-page Document fixture", async () => {
    const content = Array.from(
      { length: 45 },
      (_, i) => `<p style="height: 25pt;">Multi-page line item row ${i + 1}</p>`,
    ).join("");

    const html = `<div style="font-family: Helvetica;">${content}</div>`;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    fs.writeFileSync(path.join(artifactsDir, "08_multi_page.pdf"), doc.save());

    expect(doc.getPages().length).toBeGreaterThan(1);
  });

  // 9. Page Breaks
  it("should render 9. Page Breaks fixture", async () => {
    const html = `
      <div style="font-family: Helvetica;">
        <h1>Section 1 - Page 1</h1>
        <div style="page-break-before: always;">
          <h1>Section 2 - Forced Page 2</h1>
        </div>
      </div>
    `;
    const doc = await HtmlToPdf.generate({ html, compress: false });
    fs.writeFileSync(path.join(artifactsDir, "09_page_breaks.pdf"), doc.save());

    expect(doc.getPages().length).toBe(2);
  });

  // 10. Headers
  it("should render 10. Headers fixture", async () => {
    const html = "<h1>Document with Top Header</h1>";
    const buffer = await HtmlToPdf.generateBuffer({
      html,
      header: { text: "Official Header Title", align: "right", showDividerLine: true },
      compress: false,
    });
    fs.writeFileSync(path.join(artifactsDir, "10_headers.pdf"), buffer);

    expect(buffer.toString("binary")).toContain("(Official Header Title) Tj");
  });

  // 11. Footers
  it("should render 11. Footers fixture", async () => {
    const html = "<h1>Document with Bottom Footer</h1>";
    const buffer = await HtmlToPdf.generateBuffer({
      html,
      footer: { text: "Page {{pageNumber}} of {{totalPages}}", align: "center", showDividerLine: true },
      compress: false,
    });
    fs.writeFileSync(path.join(artifactsDir, "11_footers.pdf"), buffer);

    expect(buffer.toString("binary")).toContain("(Page 1 of 1) Tj");
  });

  // 12. Multi-Page Enterprise Invoice Fixture (Phase 4 + 5)
  it("should render 12. Multi-Page Enterprise Invoice fixture with logo, custom fonts, flexbox header, and multi-page table", async () => {
    const { createMinimalTTFBuffer } = await import("../fonts/ttf-parser.test.js");
    const regularFontBuffer = createMinimalTTFBuffer("EnterpriseFont-Regular");
    const boldFontBuffer = createMinimalTTFBuffer("EnterpriseFont-Bold");

    const rows = Array.from(
      { length: 40 },
      (_, i) => `
        <tr>
          <td>Line Item #${i + 1} - Enterprise Service Package</td>
          <td>1</td>
          <td>$250.00</td>
          <td>$250.00</td>
        </tr>
      `,
    ).join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'EnterpriseFont', sans-serif; margin: 0; padding: 20pt; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2pt solid #0284c7; padding-bottom: 10pt; margin-bottom: 15pt; }
            .logo { width: 100pt; height: 35pt; }
            .title { font-size: 20pt; font-weight: bold; color: #0369a1; margin: 0; text-align: right; }
            .meta { font-size: 9pt; color: #64748b; margin-top: 3pt; text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-top: 10pt; }
            th { background-color: #f1f5f9; color: #334155; padding: 6pt; text-align: left; font-size: 10pt; font-weight: bold; border-bottom: 2pt solid #cbd5e1; }
            td { padding: 6pt; border-bottom: 1pt solid #e2e8f0; font-size: 9pt; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <img class="logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="Logo" />
            </div>
            <div>
              <h1 class="title">ENTERPRISE STATEMENT</h1>
              <p class="meta">Account: #ACC-9042 | Period: Q3 2026</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Service Description</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const doc = await HtmlToPdf.generate({
      html,
      compress: false,
      fonts: {
        EnterpriseFont: {
          regular: regularFontBuffer,
          bold: boldFontBuffer,
        },
      },
      footer: { text: "Confidential - Page {{pageNumber}} of {{totalPages}}", align: "right" },
    });

    const pdfBuffer = doc.save();
    fs.writeFileSync(path.join(artifactsDir, "12_enterprise_invoice.pdf"), pdfBuffer);

    const pdfStr = pdfBuffer.toString("latin1");

    // 1. Page count assertions
    const pageCount = doc.getPages().length;
    expect(pageCount).toBeGreaterThanOrEqual(2);
    expect(pdfStr).toContain("/Type /Pages");
    expect(pdfStr).toContain(`/Count ${pageCount}`);

    // 2. Document Catalog & Structure assertions
    expect(pdfStr).toContain("/Type /Catalog");

    // 3. Image object assertions
    expect(pdfStr).toContain("/Subtype /Image");
    expect(pdfStr).toContain("/Width 1");
    expect(pdfStr).toContain("/Height 1");

    // 4. Custom TTF Font & CID CMap assertions
    expect(pdfStr).toContain("/Subtype /Type0");
    expect(pdfStr).toContain("/Subtype /CIDFontType2");
    expect(pdfStr).toContain("/BaseFont /EnterpriseFont-Regular");
    expect(pdfStr).toContain("/BaseFont /EnterpriseFont-Bold");
    expect(pdfStr).toContain("/ToUnicode");
    expect(pdfStr).toContain("/CMapName /Adobe-Identity-UCS");

    // 5. Text operators assertions
    expect(pdfStr).toContain("Tj");
  });
});
