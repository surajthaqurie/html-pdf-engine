import { HtmlToPdf } from "../src/index.js";

async function runRenderSpeedBenchmark() {
  console.log("=== Benchmark: Render Speed ===");

  const invoiceHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Helvetica; margin: 20px; }
          h1 { color: #1e40af; }
          p { color: #334155; font-size: 11pt; }
        </style>
      </head>
      <body>
        <h1>Benchmark Invoice #1001</h1>
        <p>This is a performance benchmark test for html-pdf-engine.</p>
      </body>
    </html>
  `;

  // Warmup
  await HtmlToPdf.generateBuffer({ html: invoiceHtml });

  const iterations = 100;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await HtmlToPdf.generateBuffer({ html: invoiceHtml });
  }

  const durationMs = performance.now() - start;
  const avgMs = durationMs / iterations;
  const opsPerSec = (iterations / (durationMs / 1000)).toFixed(2);

  console.log(`Total Time for ${iterations} renders: ${durationMs.toFixed(2)} ms`);
  console.log(`Average Render Time per PDF: ${avgMs.toFixed(2)} ms`);
  console.log(`Throughput: ${opsPerSec} ops/sec`);
}

runRenderSpeedBenchmark().catch(console.error);
