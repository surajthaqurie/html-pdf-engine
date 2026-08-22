# Changelog

## 1.1.2

### Patch Changes

- Stabilize layout and paint engine positioning and border rendering.

## 1.1.1

### Patch Changes

- Fix rendering pipeline performance regression and improve release stability

## 1.1.0

### Minor Changes

- Improve rendering layout, text extraction, and invoice rendering reliability

## 1.0.1

### Patch Changes

- 83aa289: Prepare the 1.0.1 release with updated documentation covering the current HTML, CSS, layout, SVG, image, font, metadata, pagination, hyperlink, header/footer, and error-handling capabilities.

All notable changes to html-pdf-engine will be documented here.

### Fixed

- **Documentation**: Comprehensive documentation audit correcting inaccurate claims. Documented the previously unlisted SVG vector rendering capabilities, clarified CSS `@page` override behaviors, and provided full public API typings.

## [1.0.0] - 2026-08-16

### Added

- **HTML & CSS Core**: Pure TypeScript HTML tokenizer/parser with malformed tag auto-recovery. CSS parser, cascade engine, and specificity calculator.
- **Layout Engines**: Block, Inline, Flexbox (with `flex-wrap`), CSS Grid, and HTML Tables (with multi-page repeating `<thead>` and row-level `break-inside: avoid`).
- **CSS Features**: Custom Properties (variables), Media Queries (`@media print`, `@media all`, `min-width`, `max-width`), sizing constraints (`min-width`, `max-width`, `min-height`, `max-height`), and `overflow: hidden` container clipping.
- **Positioning**: Practical CSS positioning (`position: relative`, `absolute`, `fixed`) with `z-index` paint ordering.
- **Pagination**: Modern fragmentation (`break-before: page`, `break-after: page`, `break-inside: avoid`) and CSS `@page` rule support.
- **Fonts**: Built-in Type1 fonts (Helvetica, Times-Roman, Courier) and custom TrueType (`.ttf`) font embedding with automatic glyph subsetting and `/ToUnicode` CMaps.
- **Images**: Native PNG, JPEG, and SVG vector embedding via Data URLs, local files, `Buffer` objects, or opt-in `AssetResolver` with SSRF protection.
- **PDF Generation**: Native PDF 1.7 binary writer with FlateDecode (`zlib`) stream compression. Support for dynamic headers/footers (`{{pageNumber}}`, `{{totalPages}}`), clickable hyperlinks, internal anchors, and PDF metadata.
