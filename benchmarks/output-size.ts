import { HtmlToPdf } from "../src/index.js";

async function runOutputSizeBenchmark() {
  console.log("=== Benchmark: Compressed vs Uncompressed Output Size ===");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Helvetica; margin: 20px; }
          h1 { color: #1e40af; }
          p { color: #334155; line-height: 1.5; }
        </style>
      </head>
      <body>
        <h1>PDF Stream Compression Benchmark</h1>
        ${"<p>Demonstrating FlateDecode stream compression efficiency for PDF documents.</p>".repeat(30)}
      </body>
    </html>
  `;

  const uncompressed = await HtmlToPdf.generateBuffer({ html, compress: false });
  const compressed = await HtmlToPdf.generateBuffer({ html, compress: true });

  const uncompressedSizeKB = (uncompressed.length / 1024).toFixed(2);
  const compressedSizeKB = (compressed.length / 1024).toFixed(2);
  const ratio = (((uncompressed.length - compressed.length) / uncompressed.length) * 100).toFixed(1);

  console.log(`Uncompressed Stream Size: ${uncompressedSizeKB} KB`);
  console.log(`Compressed Stream Size: ${compressedSizeKB} KB`);
  console.log(`Compression Reduction: ${ratio}% smaller`);
}

runOutputSizeBenchmark().catch(console.error);
