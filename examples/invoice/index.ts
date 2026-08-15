import { HtmlToPdf } from "../../src/index.js";
import * as fs from "fs";
import * as path from "path";

function createMinimalTTFBuffer(postScriptName = "TestFont-Regular"): Buffer {
  const headData = Buffer.alloc(54);
  headData.writeUInt16BE(1000, 18);
  headData.writeInt16BE(0, 36);
  headData.writeInt16BE(-200, 38);
  headData.writeInt16BE(1000, 40);
  headData.writeInt16BE(800, 42);

  const hheaData = Buffer.alloc(36);
  hheaData.writeInt16BE(800, 4);
  hheaData.writeInt16BE(-200, 6);
  hheaData.writeUInt16BE(2, 34);

  const maxpData = Buffer.alloc(32);
  maxpData.writeUInt16BE(2, 4);

  const hmtxData = Buffer.alloc(8);
  hmtxData.writeUInt16BE(500, 0);
  hmtxData.writeInt16BE(0, 2);
  hmtxData.writeUInt16BE(600, 4);
  hmtxData.writeInt16BE(0, 6);

  const cmapSub = Buffer.alloc(32);
  cmapSub.writeUInt16BE(4, 0);
  cmapSub.writeUInt16BE(32, 2);
  cmapSub.writeUInt16BE(4, 6);
  cmapSub.writeUInt16BE(0x0041, 14);
  cmapSub.writeUInt16BE(0xffff, 16);
  cmapSub.writeUInt16BE(0x0041, 20);
  cmapSub.writeUInt16BE(0xffff, 22);
  const delta = (1 - 0x0041) & 0xffff;
  cmapSub.writeInt16BE(delta > 0x7fff ? delta - 0x10000 : delta, 24);
  cmapSub.writeInt16BE(0, 26);
  cmapSub.writeUInt16BE(0, 28);
  cmapSub.writeUInt16BE(0, 30);

  const cmapData = Buffer.alloc(12 + cmapSub.length);
  cmapData.writeUInt16BE(0, 0);
  cmapData.writeUInt16BE(1, 2);
  cmapData.writeUInt16BE(3, 4);
  cmapData.writeUInt16BE(1, 6);
  cmapData.writeUInt32BE(12, 8);
  cmapSub.copy(cmapData, 12);

  const psNameBuf = Buffer.from(postScriptName, "ascii");
  const nameSub = Buffer.alloc(6 + 12 + psNameBuf.length);
  nameSub.writeUInt16BE(0, 0);
  nameSub.writeUInt16BE(1, 2);
  nameSub.writeUInt16BE(18, 4);
  nameSub.writeUInt16BE(1, 6);
  nameSub.writeUInt16BE(0, 8);
  nameSub.writeUInt16BE(0, 10);
  nameSub.writeUInt16BE(6, 12);
  nameSub.writeUInt16BE(psNameBuf.length, 14);
  nameSub.writeUInt16BE(0, 16);
  psNameBuf.copy(nameSub, 18);

  const tables = [
    { tag: "head", buf: headData },
    { tag: "hhea", buf: hheaData },
    { tag: "maxp", buf: maxpData },
    { tag: "hmtx", buf: hmtxData },
    { tag: "cmap", buf: cmapData },
    { tag: "name", buf: nameSub },
  ];

  let offset = 12 + tables.length * 16;
  const tableHeaders: Buffer[] = [];

  for (const t of tables) {
    const th = Buffer.alloc(16);
    th.write(t.tag, 0, 4, "ascii");
    th.writeUInt32BE(0, 4);
    th.writeUInt32BE(offset, 8);
    th.writeUInt32BE(t.buf.length, 12);
    tableHeaders.push(th);
    offset += t.buf.length;
  }

  const header = Buffer.alloc(12);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(tables.length, 4);

  return Buffer.concat([header, ...tableHeaders, ...tables.map((t) => t.buf)]);
}

async function main() {
  const outputDir = path.join(process.cwd(), "artifacts", "examples");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const customRegularFont = createMinimalTTFBuffer("InterCustom-Regular");
  const customBoldFont = createMinimalTTFBuffer("InterCustom-Bold");

  const pdfBuffer = await HtmlToPdf.generateBuffer({
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: InterCustom, sans-serif; margin: 0; padding: 20px; }
            .logo { width: 120px; height: 40px; }
            .invoice-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
            .title { color: #0369a1; font-size: 22pt; margin: 0; font-weight: bold; text-align: right; }
            .meta { color: #64748b; font-size: 10pt; margin-top: 5px; text-align: right; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background-color: #f1f5f9; color: #334155; text-align: left; padding: 8px; font-size: 10pt; border-bottom: 2px solid #cbd5e1; font-weight: bold; }
            td { padding: 8px; font-size: 10pt; border-bottom: 1px solid #e2e8f0; color: #475569; }
            .total { text-align: right; font-weight: bold; color: #0f172a; font-size: 12pt; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            <div>
              <img class="logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="Logo" />
            </div>
            <div>
              <h1 class="title">INVOICE #INV-2026-001</h1>
              <p class="meta">Date: August 15, 2026 | Due Date: September 15, 2026</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>HTML-to-PDF Rendering Engine License</td>
                <td>1</td>
                <td>$499.00</td>
                <td>$499.00</td>
              </tr>
              <tr>
                <td>Enterprise Support & SLA (1 Year)</td>
                <td>1</td>
                <td>$299.00</td>
                <td>$299.00</td>
              </tr>
            </tbody>
          </table>

          <div class="total">Total Due: $798.00</div>
        </body>
      </html>
    `,
    page: "A4",
    fonts: {
      InterCustom: {
        regular: customRegularFont,
        bold: customBoldFont,
      },
    },
    header: { text: "Acme Corporation Inc.", align: "left" },
    footer: { text: "Page {{pageNumber}} of {{totalPages}}", align: "center", showDividerLine: true },
  });

  const outputPath = path.join(outputDir, "invoice_example.pdf");
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`Invoice example generated at: ${outputPath}`);
}

main().catch(console.error);
