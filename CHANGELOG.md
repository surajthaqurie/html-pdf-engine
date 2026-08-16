# Changelog

All notable changes to html-pdf-engine will be documented here.

## [Unreleased]

## [1.0.0] - 2026-08-16

### Added

- **HTML & CSS Core**: Pure TypeScript HTML tokenizer/parser with malformed tag auto-recovery. CSS parser, cascade engine, and specificity calculator.
- **Layout Engines**: Block, Inline, Flexbox (with `flex-wrap`), CSS Grid, and HTML Tables (with multi-page repeating `<thead>` and row-level `break-inside: avoid`).
- **CSS Features**: Custom Properties (variables), Media Queries (`@media print`, `@media all`, `min-width`, `max-width`), sizing constraints (`min-width`, `max-width`, `min-height`, `max-height`), and `overflow: hidden` container clipping.
- **Positioning**: Practical CSS positioning (`position: relative`, `absolute`, `fixed`) with `z-index` paint ordering.
- **Pagination**: Modern fragmentation (`break-before: page`, `break-after: page`, `break-inside: avoid`) and CSS `@page` rule support.
- **Fonts**: Built-in Type1 fonts (Helvetica, Times-Roman, Courier) and custom TrueType (`.ttf`) font embedding with automatic glyph subsetting and `/ToUnicode` CMaps.
- **Images**: Native PNG and JPEG embedding via Data URLs, local files, `Buffer` objects, or opt-in `AssetResolver` with SSRF protection.
- **PDF Generation**: Native PDF 1.7 binary writer with FlateDecode (`zlib`) stream compression. Support for dynamic headers/footers (`{{pageNumber}}`, `{{totalPages}}`), clickable hyperlinks, internal anchors, and PDF metadata.
