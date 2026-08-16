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
| **Simple HTML** | 100 | ~0.73 ms | ~1,366 | ~3.19 |
| **Invoice** | 100 | ~2.18 ms | ~458 | ~0.14 |
| **Complex Layout** | 100 | ~1.67 ms | ~598 | ~-0.66 |
| **Multi-page Report** | 50 | ~8.05 ms | ~124 | ~19.79 |
| **Local Images** | 50 | ~1.40 ms | ~715 | ~-6.08 |
| **Large Table (100 rows)** | 20 | ~25.41 ms | ~39 | ~2.37 |
| **Large Table (500 rows)** | 5 | ~150.89 ms | ~7 | ~17.42 |

### Methodology & Scope

- **Engine Render Time vs Application Time**: Benchmark measurements reflect engine execution (HTML parsing, CSS cascade, layout box generation, paint command emission, stream encoding, FlateDecode compression). Disk I/O or network asset fetching time is excluded.
- **Warm-Up Execution**: The suite executes initial warm-up renders to allow V8 JIT optimization prior to measurement.
- **Concurrency**: Tested across concurrency levels (1 to 25 parallel renders) demonstrating linear scaling without worker contention.
- **Deterministic Validation**: Every benchmark suite run verifies byte-for-byte output identity across repeated executions.
