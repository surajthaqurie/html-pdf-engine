# Changelog

## 1.10.0

### Minor Changes

- e2621da: Advanced document sizing, overflow clipping, print-oriented layout, local @font-face support, and deterministic local image asset resolution.

### Patch Changes

- 5897fc9: Phase 17 — Performance & Memory Stabilization:
  - Established comprehensive benchmark suite (`benchmarks/suite.ts`) covering render speed, memory footprint, output size, large tables, multi-page layout, asset handling, concurrency, and byte-level determinism.
  - Optimized `FontManager` resolution caching (`resolutionCache`), eliminating redundant parsing and variant lookups.
  - Replaced 2D table cell occupancy array allocation (`boolean[][]`) in `LayoutEngine` with 1D `occupiedUntilRow` array, reducing memory overhead for large tables.
  - Optimized PDF serializer (`PDFObject`, `PDFIndirectObject`, `PDFStream`) with shared `TextEncoder` and pre-encoded byte array constants.

## 1.10.0

### Minor Changes

- **Phase 14 — Advanced Document Layout & Print Features**:
  - CSS sizing constraints (`min-width`, `max-width`, `min-height`, `max-height`) supported across Block boxes, Images, Table cells, Flex items, Grid items, and Positioned elements with unit conversion (`px`, `pt`, `mm`, `cm`, `in`, `%`).
  - Image scaling preserving natural aspect ratio under `max-width`/`max-height` constraints.
  - PDF container clipping (`overflow: hidden` / `overflow-y: hidden`) emitting native PDF graphics state clipping paths (`q`, `W n`).
  - Overflow-aware pagination suppressing unwanted page breaks for content clipped inside fixed-height containers.
  - Clickable hyperlink annotation (`<a href="...">`) clipping and cropping within `overflow: hidden` regions.
  - CSS `@page` rule parser supporting paper size (`A4`, `Letter`, `landscape`, custom dimensions) and uniform/per-edge margins directly from stylesheet rules.

## 1.9.0

### Minor Changes

- Add multi-page table pagination with repeating table headers and row-level page-break control.

## 1.8.0

### Minor Changes

- fefac73: Add practical CSS relative and absolute positioning support with containing block resolution, offsets, Flexbox/Grid integration, and pagination support.
- Add practical CSS pagination and page-break controls for multi-page PDF documents.

## 1.7.0

### Minor Changes

- **Phase 12 — Advanced PDF Pagination & Page-Break Control**:
  - Support for modern CSS fragmentation properties: `break-before`, `break-after`, and `break-inside`.
  - Support for legacy aliases: `page-break-before`, `page-break-after`, and `page-break-inside`.
  - Forced page breaks with `break-before: page` (or `page-break-before: always`) and `break-after: page` (or `page-break-after: always`).
  - Container and element fragmentation prevention using `break-inside: avoid` (or `page-break-inside: avoid`) based on recursive box height estimation (`estimateBoxHeight`).
  - Practical table-row (`tr`) pagination handling preventing unwanted breaks inside table rows where space permits.
  - Full pagination integration across Block containers, Flexbox (including multi-line `flex-wrap`), CSS Grid, and positioned (`relative` / `absolute`) elements.
  - Edge-case protection suppressing unnecessary blank pages at document start/end and fallback splitting for oversized content to prevent pagination loops.
- fefac73: Add practical CSS relative and absolute positioning support with containing block resolution, offsets, Flexbox/Grid integration, and pagination support.

## 1.6.1

### Added

- **Phase 11 — Practical CSS Positioning**:
  - Support for relative positioning (`position: relative`) preserving normal document flow while applying visual offsets.
  - Support for absolute positioning (`position: absolute`) extracting elements from normal document flow.
  - Offset resolution for `top`, `right`, `bottom`, `left` properties supporting physical units (`px`, `pt`, `mm`, `cm`, `in`) and percentages (`%`).
  - Containing-block resolution relative to nearest positioned ancestor (`relative` or `absolute`) or document printable page area.
  - Positioning integration inside Flexbox (`display: flex`) and CSS Grid (`display: grid`) layouts.
  - Multi-page pagination support with automatic page index propagation across page breaks.
  - Complete layout support for positioned text, custom TTF fonts, native PNG/JPEG images, and clickable PDF hyperlink annotations.

### Patch Changes

- Finalize public API documentation, TypeScript type exports, and feature/limitation documentation.

## 1.6.0

### Minor Changes

- **TrueType Font Subsetting**: Native zero-dependency TTF font subsetter generating compact CIDFontType2 / Type0 subset font binaries and `/ToUnicode` CMaps based on characters used in the document.
- **Practical CSS Grid Layout (`display: grid`)**: Practical 2D Grid engine supporting fixed (`px`, `pt`, `mm`, `cm`, `in`), percentage (`%`), flexible (`fr`), `auto`, and `repeat()` tracks, explicit positioning (`grid-column`, `grid-row`, `span`), automatic item placement, item alignment (`justify-items`, `align-items`, `justify-self`, `align-self`), and gap spacing (`gap`, `row-gap`, `column-gap`).
- **Multi-Line Flexbox Wrapping (`flex-wrap`)**: Support for `flex-wrap: nowrap | wrap | wrap-reverse` and `flex-flow` shorthand.
- **PDF Hyperlinks (`<a href="...">`)**: Clickable PDF link annotations (`/Subtype /Link`, `/A /S /URI`) supporting `http://`, `https://`, and `mailto:` schemes across wrapped text lines.
- **API Polish & Public Type Exports**: Complete public TypeScript type audit exporting all required consumer options, metadata types, error hierarchy, and document structures from package root.

## 1.5.0

### Minor Changes

- 0408be9: Add TrueType font subsetting to reduce embedded font and PDF sizes.

## 1.4.0

### Minor Changes

- Add practical CSS flex-wrap support for multi-line flex layouts

## 1.3.0

### Minor Changes

- **Phase 8 — Practical CSS Flexbox Wrapping (`flex-wrap`)**:
  - Full support for `flex-wrap: nowrap`, `flex-wrap: wrap`, `flex-wrap: wrap-reverse`, and `flex-flow` shorthand parser.
  - Multi-line flex container line generation partitioning items across main-axis overflow boundaries.
  - Per-line main-axis space distribution (`flex-grow`, `flex-shrink`, `justify-content`).
  - Per-line cross-axis alignment (`align-items: flex-start | center | flex-end | stretch`).
  - Cross-axis line placement supporting `wrap-reverse` order inversion.
  - Seamless pagination for multi-line flex containers spanning page breaks.
  - Complete integration test suite verifying images, custom TTF fonts, and PDF hyperlink annotations inside wrapped flex items.
- Add clickable PDF hyperlink support for HTML anchor elements

## 1.2.1

### Added
- **Phase 7 — PDF Hyperlinks (`<a href="...">`)**:
  - Full support for clickable URL link annotations in generated PDFs (`/Subtype /Link`, `/A /S /URI`).
  - Supported URL schemes: absolute `http://`, `https://`, and `mailto:` links.
  - Precise PDF annotation coordinate calculation derived from final laid-out text and image rectangles.
  - Multi-line text link support with individual clickable bounding boxes for line-wrapped links across pages.
  - Safe URL scheme normalization preventing malicious script execution (`javascript:`) or relative fragment errors.

### Patch Changes

- Polish public API, error handling, metadata, and TypeScript exports

All notable changes to `html-pdf-engine` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-08-15

### Added
- **Phase 1 — Native Image Embedding (`<img>`)**:
  - Full support for base64 PNG and JPEG Data URLs (`data:image/png;base64,...`, `data:image/jpeg;base64,...`).
  - Support for local file paths and raw `Buffer` image inputs via `options.images`.
  - PDF XObject `/Subtype /Image` stream writer with native `/DCTDecode` (JPEG) and `/FlateDecode` (PNG) support.
- **Phase 2 — Custom TrueType (`.ttf`) Font Embedding**:
  - Native binary TTF parser (`ttf-parser.ts`) extracting metrics (`hmtx`), PostScript names, and character mappings.
  - Custom font registration via `options.fonts = { "FontName": { regular, bold?, italic?, boldItalic? } }`.
  - PDF `/Subtype /Type0` and `/Subtype /CIDFontType2` stream embedding with `/ToUnicode` CMaps for searchable, selectable text in generated PDFs.
  - Real font advance layout wrapping based on embedded TTF glyph metrics.
- **Phase 3 — Pure 1D CSS Flexbox Layout Engine**:
  - Layout engine support for `display: flex` and `display: inline-flex`.
  - Flex directions: `row`, `column`, `row-reverse`, `column-reverse`.
  - Justification: `justify-content: flex-start | center | flex-end | space-between | space-around | space-evenly`.
  - Alignment: `align-items: flex-start | center | flex-end | stretch`.
  - Spacing: `gap`, `row-gap`, `column-gap`.
  - Flex item sizing: `flex-grow`, `flex-shrink`, `flex-basis`, and `flex` shorthand parser.
- **Phase 4 & 5 — Integration Fixtures & Strengthened Assertions**:
  - Added enterprise multi-page invoice fixture combining Flexbox headers, base64 images, custom TTF fonts, and multi-page table pagination.
  - Strengthened PDF document object assertions (page count, catalog, XObject images, Type0 fonts, `/ToUnicode` CMaps, `Tj` operators).
  - Updated documentation (`README.md`, `feature-matrix.md`, `limitations.md`) with honest positioning, package size metrics (~69 kB tarball, zero runtime dependencies), capability comparison matrix, and performance benchmarks (~4.5ms invoice generation).
- **Phase 6 — API Polish & Actionable Error Handling**:
  - Streamlined public metadata API via `meta?: PDFMetadataOptions` (`title`, `author`, `subject`, `keywords`, `creator`) with backward compatibility for `metadata`.
  - Introduced deterministic error hierarchy (`PdfError`, `ImageError`, `FontError`) ensuring consistent, actionable messages without swallowing layout/parsing errors.
  - Cleaned root exports in `src/index.ts` to hide internal parser/layout/object modules and expose only intentional public API types and classes.

---

## [1.1.0] - 2026-08-15

### Minor Changes
- Add CSS improvements, PDF metadata support, font variants, and pagination fixes.

---

## [1.0.0] - 2026-08-15

### Added
- Pure TypeScript HTMLTokenizer and HTMLParser with auto-recovery for malformed tags.
- CSSParser and Specificity Calculator (`[Inline, ID, Class, Tag]`).
- Cascade Engine for element styling, parent inheritance, and inline style overrides.
- Layout Engine with box geometry, line-wrapping, and multi-page pagination.
- Native PDF 1.7 binary writer with FlateDecode (`zlib`) stream compression.
- Dynamic Header and Footer support with `{{pageNumber}}` and `{{totalPages}}` placeholders.
- Standard ISO/North American page sizes and custom `{ width, height }` dimensions.
- High-level `HtmlToPdf.generateBuffer` and `HtmlToPdf.generateFile` API facade.
