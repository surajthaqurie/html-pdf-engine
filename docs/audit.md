# Architecture and Package Audit: html-pdf-engine

## Executive Summary
This document presents the comprehensive audit of `html-pdf-engine` (v1.0.0), a zero-dependency, pure TypeScript HTML/CSS to PDF rendering engine.

---

## 1. Package Configuration & Publishing Audit (`package.json`, `tsconfig.json`)

### Observations & Settings
- **Name**: `html-pdf-engine`
- **Version**: `1.0.0`
- **Type**: `module` (ESM native)
- **Main & Exports**: Points to `./dist/index.js` with typings `./dist/index.d.ts`.
- **TypeScript Config (`tsconfig.json`)**:
  - Target: `ES2022`
  - Module / ModuleResolution: `NodeNext`
  - Strict mode enabled (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`).
  - Declarations enabled (`declaration: true`, `declarationMap: true`, `sourceMap: true`).
- **Dependencies**: 0 runtime dependencies (`dependencies: {}`). DevDependencies include `@types/node`, `typescript`, and `vitest`.

---

## 2. Core Architecture Audit (`src/`)

The core architecture follows a compiler pipeline pattern:

```text
HTML & CSS Input
  │
  ├──► HTML Parser (`src/html/`) ────► DOM Node Tree
  │
  ├──► CSS Parser (`src/css/`) ─────► CSS Rules & Specificity Engine
  │
  └──► Cascade Engine ──────────────► Computed Element Styles
            │
            ▼
     Layout Engine (`src/layout/`) ──► Box Model & Multi-Page Layout Tree
            │
            ▼
     Paint Engine (`src/paint/`) ───► Painting Operations & Commands
            │
            ▼
     PDF Writer (`src/pdf/`) ────────► PDF 1.7 Stream & Binary Serializer
```

### Module Analysis

1. **`src/core/html-to-pdf.ts`**: High-level facade API (`HtmlToPdf.generate`, `generateBuffer`, `generateFile`).
2. **`src/html/`**:
   - `tokenizer.ts`: Tokenizes HTML into `StartTag`, `EndTag`, `Text`, `Comment`. Decodes standard HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`).
   - `parser.ts`: Constructs `DocumentNode` and `ElementNode` trees. Auto-recovers unclosed tags.
   - `dom/node.ts`: Core DOM primitives (`BaseNode`, `DocumentNode`, `ElementNode`, `TextNode`, `CommentNode`).
3. **`src/css/`**:
   - `parser.ts`: Parses CSS selectors and rule declarations.
   - `cascade.ts`: Matches element selectors, scores specificity `(ID, Class, Tag)`, cascades inline `style="..."` attributes, applies UA element defaults.
   - `specificity.ts`: Calculates numeric specificity score vectors `[ID, Class, Tag]`.
   - `computed-style.ts`: Defines `ComputedStyle` model.
   - `values/units.ts`: Converts CSS units (`px`, `pt`, `mm`, `cm`, `in`, `%`) and hex/named/rgb colors to normalized points (`pt`) and RGB `[0..1]`.
4. **`src/layout/`**:
   - `layout-engine.ts`: Computes box dimensions (`width`, `height`, `margins`, `paddings`), handles line-wrapping for inline text flow, and executes multi-page pagination.
   - `box-model.ts`: Calculates block layout box geometry.
   - `layout-box.ts`: Defines `LayoutBox` structure.
5. **`src/paint/`**:
   - `paint-engine.ts`: Converts layout boxes into drawing commands (text, rectangles, lines, borders, backgrounds).
   - `paint-command.ts`: Types of graphics paint commands.
6. **`src/pdf/`**:
   - `pdf-document.ts`: Assembles PDF Catalog, Pages, XRef Table, and Trailer.
   - `pdf-page.ts`: Manages PDF page dimensions and contents.
   - `pdf-content.ts`: PDF graphics content stream generator.
   - `pdf-stream.ts`: Handles stream objects and FlateDecode (`zlib`) compression.
   - `pdf-font.ts` & `src/fonts/`: Standard Type1 Helvetica, Times-Roman, and Courier metrics.
   - `pdf-header-footer.ts`: Renders headers/footers with `{{pageNumber}}` and `{{totalPages}}` placeholders.

---

## 3. Test Suite Audit

- **Test Files**: 55 test files across unit, integration, font, API, and real-world fixture test suites.
- **Pass Rate**: 100% (384/384 tests passing, verified via `npm test`).
- **Coverage**: Unit tests for CSS cascade, specificity, custom properties, media queries, layout models (block, flex, grid, table), pagination, font subsetting, image parsing, positioning, overflow clipping, hyperlinks, PDF metadata, and malformed input resilience.

---

## 4. Security & Safety Audit

- **Network Security**: Pure offline execution by default. Opt-in remote asset loading via `AssetResolver` / `createNetworkAssetResolver()` includes built-in SSRF protections (blocking local/private IP ranges), configurable timeouts, max payload size limits, and redirect bounds.
- **Resource Boundaries**: In-memory binary compilation avoids process-spawning vulnerabilities.
- **Client Script Isolation**: `<script>` tags and inline event attributes are stripped and set to `display: none`.
- **Serialization Escaping**: Escape handling for PDF literal strings (`escapePdfString`) and UTF-16BE encoding with BOM (`FEFF`).

---

## 5. Summary of Claims vs Reality

| Feature | Implementation Status |
| :--- | :--- |
| Zero External Dependencies | Verified — 0 runtime production dependencies |
| HTML Parsing & Auto-Recovery | Verified — Standard HTML5 tags, entity decoding, unclosed tag recovery |
| CSS Cascade & Specificity | Verified — Inline CSS, `<style>` blocks, external CSS, `[ID, Class, Tag]` specificity |
| CSS Custom Properties (Variables) | Verified — `--var` declarations, `var()` resolution, fallbacks, inheritance, cycle protection |
| CSS Media Queries | Verified — `@media print`, `@media all`, `@media (min-width / max-width)` against PDF width |
| Layout Engines | Verified — Block, Inline, HTML Tables (repeating `<thead>`), Flexbox, CSS Grid |
| Positioning & Stacking | Verified — `position: static / relative / absolute / fixed`, `z-index` paint ordering |
| PDF Fragmentation & Breaks | Verified — `break-before/after: page`, `break-inside: avoid`, legacy `page-break-*` |
| PDF Hyperlinks & Internal Anchors | Verified — `/URI` annotations (`http`, `https`, `mailto`, `tel`) and `#anchor` `/GoTo` links |
| Asset Resolution | Verified — PNG/JPEG/SVG Data URLs, local file paths, Buffer mapping, opt-in `AssetResolver` |
| PDF Compression & Metadata | Verified — `zlib` FlateDecode compression, `/Info` dictionary, `/ViewerPreferences` |
| Image Formats | PNG, JPEG, SVG — WebP, AVIF, GIF, BMP are not decoded |
| Font Formats | TTF (and OTF-TTF-outline) supported; WOFF/WOFF2 and remote HTTP `@font-face` URLs are not |
| Tagged PDF / PDF Accessibility | Not implemented — no `StructTreeRoot`, `MarkInfo`, or marked-content sequences |
| CSS Transforms | Not implemented — `transform: rotate/scale/translate` not parsed or applied |
| `position: sticky` | Not implemented — scroll-relative positioning not applicable to static PDFs |

### Current Benchmark Summary (from `npm run benchmark`)

| Workload | Avg Time | Throughput |
| :--- | ---: | ---: |
| Simple HTML (100 renders) | ~0.73 ms | ~1,366 ops/sec |
| Invoice (100 renders) | ~2.18 ms | ~458 ops/sec |
| Complex Layout (100 renders) | ~1.67 ms | ~598 ops/sec |
| Multi-page (50 renders) | ~8.05 ms | ~124 ops/sec |

### Package Size (from `npm pack --dry-run`)
- **Packed**: ~169.1 kB
- **Unpacked**: ~945.0 kB
- **Files in package**: 187 (dist/ + README.md + LICENSE + package.json)
