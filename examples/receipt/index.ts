import { HtmlToPdf } from "../../src/index.js";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const outputDir = path.join(process.cwd(), "artifacts", "examples");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate Thermal Receipt with custom receipt dimensions (280pt x 500pt)
  const pdfBuffer = await HtmlToPdf.generateBuffer({
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Courier; margin: 10px; font-size: 9pt; }
            .center { text-align: center; }
            .title { font-weight: bold; font-size: 11pt; margin: 0; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            .item-row { margin: 4px 0; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="center">
            <p class="title">COFFEE HOUSE</p>
            <p>Receipt #84920</p>
          </div>
          <div class="line"></div>
          <div class="item-row">1x Espresso ........ $3.50</div>
          <div class="item-row">1x Croissant ....... $4.00</div>
          <div class="line"></div>
          <div class="right"><strong>TOTAL: $7.50</strong></div>
          <div class="line"></div>
          <div class="center">Thank you for visiting!</div>
        </body>
      </html>
    `,
    page: { width: 280, height: 500 },
  });

  const outputPath = path.join(outputDir, "receipt_example.pdf");
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`Receipt example generated at: ${outputPath}`);
}

main().catch(console.error);
