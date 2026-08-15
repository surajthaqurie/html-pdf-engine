import { HtmlToPdf } from "../src/index.js";

async function runMemoryBenchmark() {
  console.log("=== Benchmark: Memory Footprint ===");

  if (global.gc) {
    global.gc();
  }

  const initialMemory = process.memoryUsage().heapUsed;

  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Memory Overhead Test</h1>
        ${"<p>Testing memory footprint allocation during PDF generation.</p>".repeat(50)}
      </body>
    </html>
  `;

  const iterations = 50;
  for (let i = 0; i < iterations; i++) {
    await HtmlToPdf.generateBuffer({ html });
  }

  const finalMemory = process.memoryUsage().heapUsed;
  const memoryDeltaMB = ((finalMemory - initialMemory) / 1024 / 1024).toFixed(2);

  console.log(`Initial Heap Memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Final Heap Memory after ${iterations} renders: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap Delta: ${memoryDeltaMB} MB`);
}

runMemoryBenchmark().catch(console.error);
