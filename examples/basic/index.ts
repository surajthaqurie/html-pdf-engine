import { HtmlToPdf } from "../../src/index.js";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const outputDir = path.join(process.cwd(), "artifacts", "examples");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const pdfBuffer = await HtmlToPdf.generateBuffer({
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Helvetica; margin: 30px; }
            h1 { color: #1e40af; border-bottom: 2px solid #2563eb; }
            p { font-size: 11pt; line-height: 1.6; color: #334155; }
          </style>
        </head>
        <body>
          <h1>Basic PDF Document</h1>
          <p>This is a basic example of generating a PDF using html-pdf-engine in Node.js.</p>
        </body>
      </html>
    `,
    page: "A4",
  });

  const outputPath = path.join(outputDir, "basic_example.pdf");
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`Basic example generated at: ${outputPath}`);
}

main().catch(console.error);
