import { HtmlToPdf } from "../src/index.js";
import * as fs from "fs";
import * as path from "path";

const FIXTURES_DIR = path.resolve(process.cwd(), "tests", "fixtures", "benchmark-assets");
const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const JPEG_BUFFER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

const LOGO_PATH = path.join(FIXTURES_DIR, "logo.png");
const PHOTO_PATH = path.join(FIXTURES_DIR, "photo.jpg");

function setupAssets() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.writeFileSync(LOGO_PATH, PNG_BUFFER);
  fs.writeFileSync(PHOTO_PATH, JPEG_BUFFER);
}

function cleanupAssets() {
  fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
}

// 1. Small Document Workload
const SMALL_DOC_HTML = `
  <!DOCTYPE html>
  <html>
    <head><style>body { font-family: Helvetica; font-size: 12pt; }</style></head>
    <body>
      <h1>Simple Document</h1>
      <p>This is a small single-page document without external assets.</p>
    </body>
  </html>
`;

// 2. Invoice Workload
const INVOICE_HTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        body { font-family: Helvetica; margin: 20px; color: #1e293b; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 10px; }
        .table { display: table; width: 100%; margin-top: 20px; border-collapse: collapse; }
        .tr { display: table-row; }
        .th, .td { display: table-cell; padding: 8px; border-bottom: 1px solid #cbd5e1; }
        .th { font-weight: bold; background-color: #f1f5f9; }
        .totals { margin-top: 20px; text-align: right; font-weight: bold; }
        a { color: #0284c7; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <img src="logo.png" style="width: 100px;" />
          <h1>Invoice #INV-2026-001</h1>
        </div>
        <div>
          <p>Date: August 15, 2026</p>
          <p><a href="https://example.com/pay">Pay Online</a></p>
        </div>
      </div>
      <div class="table">
        <div class="tr">
          <div class="th">Item</div>
          <div class="th">Qty</div>
          <div class="th">Price</div>
        </div>
        <div class="tr">
          <div class="td">Consulting Services</div>
          <div class="td">10</div>
          <div class="td">$150.00</div>
        </div>
        <div class="tr">
          <div class="td">Software License</div>
          <div class="td">1</div>
          <div class="td">$500.00</div>
        </div>
      </div>
      <div class="totals">Total: $2,000.00</div>
    </body>
  </html>
`;

// 3. Complex Layout Workload
const COMPLEX_LAYOUT_HTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        body { font-family: Helvetica; margin: 15px; }
        .flex-container { display: flex; flex-direction: row; flex-wrap: wrap; gap: 15px; }
        .card { width: 45%; border: 1px solid #94a3b8; padding: 10px; position: relative; }
        .badge { position: absolute; top: 5px; right: 5px; background-color: #22c55e; color: #fff; padding: 2px 6px; font-size: 8pt; }
        .grid-container { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 10px; margin-top: 15px; }
        .grid-item { background-color: #f8fafc; padding: 8px; border: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <h2>Dashboard Summary</h2>
      <div class="flex-container">
        <div class="card">
          <span class="badge">Active</span>
          <h3>Module A</h3>
          <p>Nested flex card with relative and absolute positioning.</p>
        </div>
        <div class="card">
          <span class="badge">Pending</span>
          <h3>Module B</h3>
          <p>Second flex card demonstrating wrap layout handling.</p>
        </div>
      </div>
      <div class="grid-container">
        <div class="grid-item">Col 1</div>
        <div class="grid-item">Col 2 (Wide)</div>
        <div class="grid-item">Col 3</div>
      </div>
    </body>
  </html>
`;

// 4. Multi-Page Workload
const MULTI_PAGE_HTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        body { font-family: Helvetica; margin: 20px; }
        .page { break-before: page; }
        table { display: table; width: 100%; border-collapse: collapse; }
        tr { display: table-row; }
        th, td { display: table-cell; padding: 6px; border: 1px solid #cbd5e1; }
        thead { display: table-header-group; }
      </style>
    </head>
    <body>
      <h1>Multi-Page Report - Section 1</h1>
      <p>${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(10)}</p>
      
      <div class="page">
        <h1>Section 2: Itemized Breakdowns</h1>
        <table>
          <thead>
            <tr><th>ID</th><th>Description</th><th>Value</th></tr>
          </thead>
          <tbody>
            ${Array.from({ length: 40 }, (_, i) => `<tr><td>#${i + 1}</td><td>Item Entry ${i + 1}</td><td>$${(i + 1) * 25}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div class="page">
        <h1>Section 3: Summary</h1>
        <p>${"Final summary text block for multi-page evaluation. ".repeat(15)}</p>
      </div>
    </body>
  </html>
`;

// 5. Asset-Heavy Workload
const ASSET_HEAVY_HTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        @font-face {
          font-family: 'TestFont';
          src: url('./logo.png'); /* fallback check */
        }
        body { font-family: Helvetica; }
        .gallery { display: flex; flex-wrap: wrap; gap: 10px; }
        img { width: 60px; height: 60px; }
      </style>
    </head>
    <body>
      <h2>Repeated Asset Benchmark</h2>
      <div class="gallery">
        <img src="logo.png" />
        <img src="logo.png" />
        <img src="photo.jpg" />
        <img src="photo.jpg" />
        <img src="./logo.png" />
        <img src="./photo.jpg" />
        <img src="logo.png" />
        <img src="photo.jpg" />
      </div>
    </body>
  </html>
`;

// 6. Large Tables
function generateTableHtml(rowCount: number): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Helvetica; margin: 15px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 4px; border: 1px solid #ccc; font-size: 9pt; }
        </style>
      </head>
      <body>
        <h3>Table Benchmark (${rowCount} rows)</h3>
        <table>
          <thead>
            <tr><th>#</th><th>Code</th><th>Status</th><th>Value</th></tr>
          </thead>
          <tbody>
            ${Array.from({ length: rowCount }, (_, i) => `<tr><td>${i + 1}</td><td>CODE-${1000 + i}</td><td>Active</td><td>$${(i * 1.5).toFixed(2)}</td></tr>`).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

interface BenchmarkResult {
  workload: string;
  renders: number;
  avgTimeMs: number;
  opsPerSec: number;
  memoryDeltaMb: number;
}

async function benchmarkWorkload(
  name: string,
  html: string,
  renders: number,
  options: any = {},
): Promise<BenchmarkResult> {
  // Warmup
  await HtmlToPdf.generateBuffer({ html, basePath: FIXTURES_DIR, ...options });

  if (global.gc) global.gc();
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();

  for (let i = 0; i < renders; i++) {
    await HtmlToPdf.generateBuffer({ html, basePath: FIXTURES_DIR, ...options });
  }

  const durationMs = performance.now() - start;
  const memAfter = process.memoryUsage().heapUsed;

  const avgTimeMs = durationMs / renders;
  const opsPerSec = renders / (durationMs / 1000);
  const memoryDeltaMb = (memAfter - memBefore) / (1024 * 1024);

  return {
    workload: name,
    renders,
    avgTimeMs,
    opsPerSec,
    memoryDeltaMb,
  };
}

async function runBenchmarkSuite() {
  setupAssets();
  console.log("===============================================================");
  console.log("      html-pdf-engine Phase 17 Full Performance Suite          ");
  console.log("===============================================================\n");

  const results: BenchmarkResult[] = [];

  results.push(await benchmarkWorkload("Simple HTML", SMALL_DOC_HTML, 100));
  results.push(await benchmarkWorkload("Invoice", INVOICE_HTML, 100, { images: { "logo.png": PNG_BUFFER } }));
  results.push(await benchmarkWorkload("Complex Layout", COMPLEX_LAYOUT_HTML, 100));
  results.push(await benchmarkWorkload("Multi-page", MULTI_PAGE_HTML, 50));
  results.push(await benchmarkWorkload("Local Images", ASSET_HEAVY_HTML, 50));
  results.push(await benchmarkWorkload("Large Table (100 rows)", generateTableHtml(100), 20));
  results.push(await benchmarkWorkload("Large Table (500 rows)", generateTableHtml(500), 5));
  results.push(await benchmarkWorkload("Large Table (1,000 rows)", generateTableHtml(1000), 2));

  console.log("| Workload                 | Renders | Avg Time (ms) | Throughput (ops/sec) | Heap Delta (MB) |");
  console.log("| ------------------------ | ------: | ------------: | -------------------: | --------------: |");
  for (const r of results) {
    const nameStr = r.workload.padEnd(24, " ");
    const rendersStr = r.renders.toString().padStart(7, " ");
    const timeStr = r.avgTimeMs.toFixed(2).padStart(13, " ");
    const opsStr = r.opsPerSec.toFixed(2).padStart(20, " ");
    const memStr = r.memoryDeltaMb.toFixed(2).padStart(15, " ");
    console.log(`| ${nameStr} | ${rendersStr} | ${timeStr} | ${opsStr} | ${memStr} |`);
  }

  console.log("\n--- Concurrency Benchmark ---");
  for (const concurrency of [1, 5, 10, 25]) {
    const start = performance.now();
    await Promise.all(
      Array.from({ length: concurrency }, () =>
        HtmlToPdf.generateBuffer({ html: INVOICE_HTML, basePath: FIXTURES_DIR, images: { "logo.png": PNG_BUFFER } }),
      ),
    );
    const duration = performance.now() - start;
    console.log(`Concurrency level ${concurrency.toString().padStart(2, " ")}: ${duration.toFixed(2)} ms total (${(duration / concurrency).toFixed(2)} ms/render avg)`);
  }

  console.log("\n--- Output Determinism Check ---");
  const renderA = await HtmlToPdf.generateBuffer({ html: INVOICE_HTML, basePath: FIXTURES_DIR, images: { "logo.png": PNG_BUFFER }, compress: false });
  const renderB = await HtmlToPdf.generateBuffer({ html: INVOICE_HTML, basePath: FIXTURES_DIR, images: { "logo.png": PNG_BUFFER }, compress: false });
  const renderC = await HtmlToPdf.generateBuffer({ html: INVOICE_HTML, basePath: FIXTURES_DIR, images: { "logo.png": PNG_BUFFER }, compress: false });

  const deterministic = renderA.equals(renderB) && renderB.equals(renderC);
  console.log(`Byte-for-byte deterministic output: ${deterministic ? "PASSED (100% Equal)" : "FAILED"}`);

  cleanupAssets();
}

runBenchmarkSuite().catch((err) => {
  cleanupAssets();
  console.error(err);
});
