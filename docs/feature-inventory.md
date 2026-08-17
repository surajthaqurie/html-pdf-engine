# Feature Inventory: html-pdf-engine

This internal inventory assesses all currently implemented user-facing features against tests, documentation, and limitations.

## 1. Core PDF Generation
- **Native PDF 1.7 binary writer**: Implemented. Documented. Accurate. Tested. Example: Basic usage. Limitations: No tagged PDF / accessibility support.
- **FlateDecode (`zlib`) compression**: Implemented. Documented. Accurate. Tested.
- **PDF Document Metadata**: Implemented (`options.meta`). Documented. Accurate. Tested.
- **Viewer Preferences & Catalog Options**: Implemented (`options.viewerPreferences`, `/Lang`, `/PageLabels`). Documented. Accurate. Tested.
- **Dynamic Headers/Footers**: Implemented (`options.header`, `options.footer`, `{{pageNumber}}`, `{{totalPages}}`). Documented. Accurate. Tested. Example: Invoice.

## 2. HTML Parsing & Rendering
- **Standard HTML5 tags**: Implemented (`<div>`, `<p>`, `<span>`, `<h1>`-`<h6>`, `<table>`, `<ul>`, `<ol>`, `<a>`, `<img>`, `<svg>`). Documented. Accurate. Tested.
- **Malformed tag auto-recovery**: Implemented. Documented. Accurate. Tested.
- **Security (Script execution)**: Implemented (`<script>` tags hidden). Documented. Accurate. Tested.
- **Hyperlinks (External `/URI`)**: Implemented. Documented. Accurate. Tested.
- **Internal Anchors (`/GoTo`)**: Implemented. Documented. Accurate. Tested.

## 3. CSS Parsing & Cascade
- **External & Inline CSS**: Implemented. Documented. Accurate. Tested.
- **CSS Specificity Calculation**: Implemented. Documented. Accurate. Tested.
- **CSS Variables (Custom Properties)**: Implemented. Documented. Accurate. Tested. Limitations: Only standard standard scoping, cycle detection is in place.
- **Media Queries**: Implemented (`@media print`, `@media all`, `min-width`, `max-width`). Documented. Accurate. Tested.
- **CSS `@page` At-Rules**: Implemented (size, orientation, margin). Documented. Accurate. Tested.

## 4. Layout & Positioning
- **Block & Inline Layout**: Implemented. Documented. Accurate. Tested.
- **Sizing Constraints (`min/max-width`, `min/max-height`)**: Implemented. Documented. Accurate. Tested.
- **Overflow Clipping (`overflow: hidden`)**: Implemented (PDF graphic state `q`/`Q`/`W`). Documented. Accurate. Tested.
- **CSS Positioning (`relative`, `absolute`, `fixed`)**: Implemented (with `z-index`). Documented. Accurate. Tested. Limitations: `position: sticky` not supported.
- **Pagination (`break-before/after: page`, `break-inside: avoid`)**: Implemented. Documented. Accurate. Tested.

## 5. Flexbox & Grid
- **1D Flexbox**: Implemented (`flex-direction`, `flex-wrap`, `justify-content`, `align-items`, `gap`, etc.). Documented. Accurate. Tested.
- **2D CSS Grid**: Implemented (tracks, explicit placement, auto placement, alignment). Documented. Accurate. Tested. Limitations: `grid-template-areas`, `subgrid`, `minmax()` not supported.

## 6. HTML Tables
- **Multi-page repeating `<thead>`**: Implemented. Documented. Accurate. Tested.
- **Cell properties & Borders**: Implemented. Documented. Accurate. Tested.
- **`break-inside: avoid` on `<tr>`**: Implemented. Documented. Accurate. Tested.

## 7. Images & Typography
- **Local/Buffer PNG, JPEG, SVG**: Implemented. Documented. Accurate. Tested. Limitations: WebP, AVIF, GIF not supported.
- **Remote Image Loading**: Implemented (via `AssetResolver`). Documented. Accurate. Tested.
- **Inline SVG Vector Rendering**: Implemented (`path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `transform`, `viewBox`). Limitations: `<text>`, gradients, clipping, filters are not supported. Documented. Accurate. Tested.
- **System Fonts**: Automatically embeds available system TrueType fonts. Implemented. Documented. Accurate. Tested.
- **Custom Fonts (TTF)**: Implemented. Documented. Accurate. Tested. Limitations: WOFF/WOFF2 not supported.
- **TrueType Subsetting**: Implemented. Documented. Accurate. Tested.

## 8. Error Handling
- **Specific Error Classes**: Implemented (`PdfError`, `FontError`, `ImageError`, etc.). Documented. Accurate. Tested.

## 9. File & Buffer Output
- **`generateBuffer()`**: Implemented. Documented. Accurate. Tested.
- **`generateFile()`**: Implemented. Documented. Accurate. Tested.

## 10. Node.js Compatibility & TypeScript Support
- **Node `>=18.0.0`**: Implemented. Documented. Accurate. Tested.
- **Zero Runtime Dependencies**: Implemented. Documented. Accurate. Tested.
- **Pure TypeScript ESM**: Implemented. Documented. Accurate. Tested.
