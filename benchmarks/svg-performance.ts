import { HtmlToPdf } from "../src/index.js";

// A simple inline SVG with a few primitives.
const SIMPLE_SVG_HTML = `
  <!DOCTYPE html>
  <html>
    <head><style>body { font-family: Helvetica; margin: 20px; }</style></head>
    <body>
      <h1>Simple SVG Benchmark</h1>
      <svg width="200" height="200" viewBox="0 0 200 200">
        <rect x="10" y="10" width="80" height="80" fill="#1e40af" stroke="#000" stroke-width="2"/>
        <circle cx="150" cy="50" r="30" fill="#22c55e"/>
        <line x1="10" y1="120" x2="190" y2="180" stroke="#ef4444" stroke-width="3"/>
        <polygon points="100,100 130,160 70,160" fill="#f59e0b"/>
      </svg>
    </body>
  </html>
`;

// A complex SVG exercising many path commands, transforms, and groups.
const COMPLEX_SVG_HTML = `
  <!DOCTYPE html>
  <html>
    <head><style>body { font-family: Helvetica; margin: 20px; }</style></head>
    <body>
      <h1>Complex SVG Benchmark</h1>
      <svg width="400" height="400" viewBox="0 0 400 400">
        <g transform="translate(20,20)">
          <path d="M10 10 L90 10 L50 90 Z" fill="#3b82f6"/>
          <g transform="rotate(45 50 50) scale(0.8)">
            <rect x="0" y="0" width="100" height="100" fill="#10b981" fill-opacity="0.5" stroke="#000"/>
            <circle cx="50" cy="50" r="25" fill="#f97316"/>
          </g>
          <path d="M0 200 C50 150 150 150 200 200 S300 250 400 200" fill="none" stroke="#8b5cf6" stroke-width="4"/>
          <path d="M0 300 Q100 250 200 300 T400 300" fill="none" stroke="#ec4899" stroke-width="3"/>
          <polyline points="10,350 50,320 90,350 130,320 170,350" fill="none" stroke="#64748b" stroke-width="2"/>
          <ellipse cx="300" cy="100" rx="60" ry="30" fill="#facc15" stroke="#000"/>
        </g>
      </svg>
    </body>
  </html>
`;

// A document with many inline SVGs to measure scaling.
function manySvgsHtml(count: number): string {
  const svgs = Array.from(
    { length: count },
    (_, i) =>
      `<svg width="50" height="50" viewBox="0 0 50 50"><rect x="2" y="2" width="46" height="46" fill="hsl(${(i * 30) % 360},70%,50%)"/><circle cx="25" cy="25" r="15" fill="#fff" fill-opacity="0.6"/></svg>`,
  ).join("\n");
  return `
    <!DOCTYPE html>
    <html>
      <head><style>body { font-family: Helvetica; margin: 10px; }</style></head>
      <body>
        <h1>Many SVGs Benchmark (${count})</h1>
        ${svgs}
      </body>
    </html>
  `;
}

// A single SVG with a very large path (many segments).
function largePathSvgHtml(segments: number): string {
  // Build a zig-zag path with `segments` line segments.
  const parts: string[] = ["M10 10"];
  for (let i = 1; i <= segments; i++) {
    const x = 10 + (i % 2 === 0 ? 0 : 5);
    const y = 10 + i * 2;
    parts.push(`L${x} ${y}`);
  }
  parts.push("Z");
  const d = parts.join(" ");
  return `
    <!DOCTYPE html>
    <html>
      <head><style>body { font-family: Helvetica; margin: 10px; }</style></head>
      <body>
        <h1>Large Path SVG Benchmark (${segments} segments)</h1>
        <svg width="200" height="800" viewBox="0 0 200 800">
          <path d="${d}" fill="#0ea5e9" fill-opacity="0.4" stroke="#0369a1" stroke-width="1"/>
        </svg>
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
  outputBytes: number;
}

async function benchmarkWorkload(
  name: string,
  html: string,
  renders: number,
): Promise<BenchmarkResult> {
  // Warmup
  await HtmlToPdf.generateBuffer({ html });

  if (global.gc) global.gc();
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();
  let lastBuffer: Buffer | null = null;

  for (let i = 0; i < renders; i++) {
    lastBuffer = await HtmlToPdf.generateBuffer({ html });
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
    outputBytes: lastBuffer ? lastBuffer.length : 0,
  };
}

async function runSvgBenchmarkSuite() {
  console.log(
    "===============================================================",
  );
  console.log("      html-pdf-engine SVG Performance Suite                   ");
  console.log(
    "===============================================================\n",
  );

  const results: BenchmarkResult[] = [];

  results.push(await benchmarkWorkload("Simple SVG", SIMPLE_SVG_HTML, 100));
  results.push(await benchmarkWorkload("Complex SVG", COMPLEX_SVG_HTML, 100));
  results.push(await benchmarkWorkload("Many SVGs (25)", manySvgsHtml(25), 50));
  results.push(
    await benchmarkWorkload("Many SVGs (100)", manySvgsHtml(100), 20),
  );
  results.push(
    await benchmarkWorkload(
      "Large Path (1k segments)",
      largePathSvgHtml(1000),
      20,
    ),
  );
  results.push(
    await benchmarkWorkload(
      "Large Path (5k segments)",
      largePathSvgHtml(5000),
      5,
    ),
  );

  console.log(
    "| Workload                  | Renders | Avg Time (ms) | Throughput (ops/sec) | Heap Delta (MB) | Output (bytes) |",
  );
  console.log(
    "| ------------------------- | ------: | ------------: | -------------------: | --------------: | -------------: |",
  );
  for (const r of results) {
    const nameStr = r.workload.padEnd(25, " ");
    const rendersStr = r.renders.toString().padStart(7, " ");
    const timeStr = r.avgTimeMs.toFixed(2).padStart(13, " ");
    const opsStr = r.opsPerSec.toFixed(2).padStart(20, " ");
    const memStr = r.memoryDeltaMb.toFixed(2).padStart(15, " ");
    const outStr = r.outputBytes.toString().padStart(14, " ");
    console.log(
      `| ${nameStr} | ${rendersStr} | ${timeStr} | ${opsStr} | ${memStr} | ${outStr} |`,
    );
  }

  console.log("\n--- SVG Output Determinism Check ---");
  const a = await HtmlToPdf.generateBuffer({
    html: COMPLEX_SVG_HTML,
    compress: false,
  });
  const b = await HtmlToPdf.generateBuffer({
    html: COMPLEX_SVG_HTML,
    compress: false,
  });
  const c = await HtmlToPdf.generateBuffer({
    html: COMPLEX_SVG_HTML,
    compress: false,
  });
  const deterministic = a.equals(b) && b.equals(c);
  console.log(
    `Byte-for-byte deterministic SVG output: ${deterministic ? "PASSED (100% Equal)" : "FAILED"}`,
  );
}

runSvgBenchmarkSuite().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
