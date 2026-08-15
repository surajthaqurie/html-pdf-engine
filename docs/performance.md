# Performance & Benchmarks: html-pdf-engine

`html-pdf-engine` is designed for fast, memory-efficient PDF generation of structured business documents in serverless, microservice, and Node.js backend environments.

---

## Architectural Performance Characteristics

1. **In-Memory Compilation**:
   `html-pdf-engine` operates as a direct compiler pipeline within Node.js process memory. It avoids external process spawning and IPC overhead.

2. **Pre-Calculated Font Metrics**:
   Font character widths for Helvetica, Times-Roman, and Courier are pre-calculated into lookup tables for fast line-wrapping calculation. Custom TTF fonts are parsed once per render session and subsetted to contain only referenced glyphs.

3. **Native Stream Compression**:
   PDF content streams are compressed in memory using Node.js native `zlib.deflateSync`, reducing output binary size without subprocess overhead.

---

## Reproducible Benchmark Suite

Benchmarks indicate low-millisecond rendering for the structured-document workloads included in this repository.

### Command

```bash
npm run benchmark
```

### Measured Workloads (Node.js v22, Linux x86_64)

| Workload | Iterations | Avg Time per PDF | Throughput (ops/sec) | Heap Delta (MB) |
| :--- | ---: | ---: | ---: | ---: |
| **Simple HTML** | 100 | ~0.96 ms | ~1,038 | ~4.00 |
| **Invoice** | 100 | ~2.71 ms | ~368 | ~0.94 |
| **Complex Layout** | 100 | ~1.62 ms | ~618 | ~2.58 |
| **Multi-page Report** | 50 | ~9.47 ms | ~105 | ~19.96 |
| **Local Images** | 50 | ~1.96 ms | ~510 | (varies) |
| **Large Table (100 rows)** | 20 | ~38.47 ms | ~26 | (varies) |
| **Large Table (500 rows)** | 5 | ~135.47 ms | ~7 | ~20.40 |

### Methodology & Scope

- **Engine Render Time vs Application Time**: Benchmark measurements reflect engine execution (HTML parsing, CSS cascade, layout box generation, paint command emission, stream encoding, FlateDecode compression). Disk I/O or network asset fetching time is excluded.
- **Warm-Up Execution**: The suite executes initial warm-up renders to allow V8 JIT optimization prior to measurement.
- **Concurrency**: Tested across concurrency levels (1 to 25 parallel renders) demonstrating linear scaling without worker contention.
- **Deterministic Validation**: Every benchmark suite run verifies byte-for-byte output identity across repeated executions.
