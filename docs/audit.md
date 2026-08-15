# Architecture and Package Audit: html-pdf-engine

## Executive Summary
This document presents the Phase 1 comprehensive audit of `html-pdf-engine` (v1.0.0), a zero-dependency, pure TypeScript HTML/CSS to PDF rendering engine.

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

- **Existing Tests**: 3 integration test files (`tests/pdf-core.test.ts`, `tests/html-to-pdf.test.ts`, `tests/header-footer.test.ts`).
- **Pass Rate**: 100% (11/11 tests passing).
- **Gaps Identified**:
  - Tests need organization into structured subdirectories (`html`, `css`, `cascade`, `layout`, `pagination`, `pdf`, `integration`).
  - Unit tests needed for CSS specificity sorting edge cases, inline style precedence over stylesheet rules, parent-to-child style inheritance, line-wrapping algorithms, malformed HTML parser recovery, empty inputs, and custom page dimensions.

---

## 4. Security & Safety Audit

- **Network Isolation**: The engine executes 100% offline in memory. No network fetch operations exist.
- **Resource Loading**: External images (`<img src="http...">`), external stylesheets (`<link rel="stylesheet" href="...">`), or remote scripts are intentionally excluded from automatic remote loading to prevent SSRF (Server-Side Request Forgery) or network hanging.
- **Client Script Isolation**: `<script>` tags are assigned `display: "none"` and excluded from visual layout compilation.
- **File System Safety**: `generateFile` delegates directly to Node.js `fs.promises.writeFile`. Path validation should be documented for application callers.

---

## 5. Summary of Claims vs Reality

| Feature | Claim Status | Actual Implementation Status |
| :--- | :--- | :--- |
| Zero External Dependencies | Verified | 100% Zero production dependencies |
| HTML Parsing | Verified | Standard tags, text, entities, comments, style tags |
| CSS Cascade | Verified | Inline CSS, `<style>` tags, external CSS string, specificity `[ID, Class, Tag]` |
| PDF FlateDecode Compression | Verified | Native Node.js `zlib` stream compression |
| Page Sizes | Verified | ISO (A0–A6, B4, B5), North American (Letter, Legal, Tabloid, Ledger, Executive), Custom `{ width, height }` |
| Image Tags (`<img>`) | Unsupported | Intentionally unsupported in v1.0 |
| Flexbox / Grid / Absolute Position | Unsupported | Intentionally unsupported in v1.0 (Block & Inline flow supported) |
