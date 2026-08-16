# Technical Limitations & Intentional Non-Goals: html-pdf-engine

This document outlines the current technical limitations and architectural non-goals of `html-pdf-engine`.

---

## Technical Limitations

1. **Default Offline Security & Opt-In Asset Resolution**:
   By default, `html-pdf-engine` performs no implicit network requests for external stylesheets, images, or web fonts. All resources are supplied inline or via options. Applications can explicitly configure an opt-in `AssetResolver` (such as `createNetworkAssetResolver()`) for remote asset fetching under controlled security parameters (SSRF protections blocking private IP ranges, timeouts, max bytes limits).

2. **Supported Layout Models**:
   Supports standard CSS Block layout, Inline text flow, HTML Tables, CSS Flexbox (`display: flex`), CSS Grid (`display: grid`), and Practical CSS Positioning (`position: relative`, `position: absolute`, `position: fixed`), plus `z-index` paint ordering. Grid supports explicit and flexible track sizing (`px`, `pt`, `%`, `fr`, `auto`, `repeat()`), explicit placement (`grid-column`, `grid-row`, `span`), automatic item placement, item alignment (`justify-items`, `align-items`, `justify-self`, `align-self`), and `gap`/`row-gap`/`column-gap`.

3. **Font Support**:
   Supports standard PDF Type1 fonts (`Helvetica`, `Times-Roman`, `Courier`) and custom TrueType (`.ttf`) font embedding via `options.fonts` with automatic glyph subsetting. OpenType fonts using TrueType outlines (`.otf` with `glyf` table) are also accepted. Web font formats WOFF and WOFF2 are not supported. Remote HTTP/HTTPS `@font-face` URLs are not supported; fonts must be local file paths, data URLs, or Buffers.

4. **PDF Hyperlinks & Internal Document Navigation (`<a href="...">`)**:
   Generates clickable PDF link annotations (`/Subtype /Link`). Supports external `http://`, `https://`, `mailto:`, and `tel:` URL schemes (`/A /S /URI`). Internal fragment links (`href="#id"`) resolve against DOM element IDs (`id="id"`) and generate PDF internal destination actions (`/A /S /GoTo`). Script execution links (`javascript:`) are safely stripped.

---

## CSS Positioning & Stacking

`html-pdf-engine` implements a practical subset of CSS positioning focused on document layout needs (such as badges, labels, stamps, logos, watermarks, repeating headers/footers, and overlays).

### Supported Subset
- **Position Modes**: `position: static`, `position: relative`, `position: absolute`, `position: fixed`.
- **Offset Declarations**: `top`, `right`, `bottom`, `left` supporting physical units (`px`, `pt`, `mm`, `cm`, `in`) and percentages (`%`).
- **`position: fixed` Behavior**: Removed from flow and rendered on **every page** of the document (ideal for repeating headers, footers, stamps, and watermarks).
- **`z-index` Paint Ordering**: Sorts paint commands ascending by `z-index` within the engine's rendering pipeline per page.
- **Containing Block Resolution**: Absolute elements position relative to their nearest positioned ancestor (`position: relative` or `position: absolute`). Un-parented absolute elements resolve against the document printable page area.
- **Normal Flow Interaction**: Relative elements maintain layout footprint in normal document flow while visually offsetting coordinates. Absolute elements are extracted from normal flow so sibling layout remains unaffected.
- **Layout Integration**: Fully supported inside Flexbox (`display: flex`) and CSS Grid (`display: grid`) container trees.
- **Supported Element Children**: Text nodes, custom TTF fonts, PNG/JPEG images, and clickable PDF hyperlink annotations.
- **Pagination Awareness**: Maintains target page assignment and page index propagation across multi-page document breaks.

### Unsupported Positioning Features
- `position: sticky` (scroll-dependent positioning; static print PDFs have no viewport scroll)
- 2D/3D CSS transforms (`transform: rotate / scale / translate`)
- Full browser CSS 3D stacking contexts and compositing layers

---

## PDF Pagination and Page Breaks

`html-pdf-engine` provides targeted server-side PDF pagination and page-break control rather than implementing the complete browser CSS fragmentation specification.

### Supported

- `break-before: page` (and legacy `page-break-before: always`)
- `break-after: page` (and legacy `page-break-after: always`)
- `break-inside: avoid` (and legacy `page-break-inside: avoid`)
- Practical multi-page document pagination and vertical height estimation
- Table row (`tr`) fragmentation prevention where space permits
- Flexbox (including multi-line `flex-wrap`) and CSS Grid container/item pagination integration
- Positioned element (`relative` / `absolute`) page index propagation across page breaks

### Limitations

- No multi-column fragmentation (`columns` / `break-inside: avoid-column`)
- No CSS regions or named flows
- No `left`, `right`, `recto`, or `verso` page-break values
- No advanced browser fragmentation rules or widows/orphans control
- No complete W3C CSS fragmentation specification implementation
- Oversized elements exceeding printable page height fall back to multi-page splitting
- Complex deeply-nested layouts may experience practical pagination boundaries

---

## Table Pagination and Layout

`html-pdf-engine` implements a dedicated block-based table layout engine (`layoutTableBox`) tailored for business documents (invoices, receipts, financial reports, itemized statements).

### Supported Table Features
- **Automatic Repeating Headers (`<thead>`)**: Automatically clones and re-renders table header rows at the top of subsequent PDF pages when a table crosses a page boundary.
- **Multi-Row Headers**: Supports multiple header rows (`<tr>`) inside `<thead>`, maintaining order and relative heights across page breaks.
- **Table Row Fragmentation Prevention (`break-inside: avoid`)**: Table rows (`tr`) with `break-inside: avoid` (or `page-break-inside: avoid`) move cleanly to the next page when space on the current page is insufficient.
- **Row Height Calculation**: Automatically calculates row height based on the tallest cell content, supporting nested text, block elements, images, and flexbox/grid containers inside cells.
- **Column Sizing**: Supports explicit column width declarations (`pt`, `px`, `%`, `width="..."` attributes) and fallback automatic equal-width column distribution.
- **Asset Cloning**: Clones text lines, embedded images, custom font usage, and clickable hyperlink annotations (`<a href="...">`) across repeated headers on subsequent pages.

### Table Limitations & Non-Goals
- **Complete W3C Table Specification**: Does not implement the complete CSS 2.1 / CSS 3 table specification (e.g. `table-layout: fixed` algorithm with strict column sizing rules, `caption-side`, `border-collapse: collapse` vs `separate` border resolution algorithms).
- **Multi-Page Row Spanning (`rowspan`) across Page Breaks**: While `colspan` and single-page `rowspan` are supported, `rowspan` cells that span across page break boundaries fall back to per-page row breaking.
- **Automatic Content-Based Column Width Measurement**: Column width calculation relies on explicit column widths or equal-width distribution, rather than multi-pass min-content/max-content text measurement across all table rows.

---

## CSS Sizing Constraints & Print Features

`html-pdf-engine` implements practical CSS dimension constraints (`min-width`/`max-width`, `min-height`/`max-height`), PDF-native container clipping (`overflow: hidden`), and `@page` rule document configuration.

### Supported Features
- **Sizing Constraints**: `min-width`, `max-width`, `min-height`, and `max-height` supported across block boxes, images, table cells, flex items, grid items, and positioned elements.
- **Percentage & Unit Resolution**: Resolves `px`, `pt`, `mm`, `cm`, `in`, and `%` (relative to parent containing block width/height).
- **Aspect-Ratio Preserving Scaling**: Images with `max-width` or `max-height` maintain natural aspect ratio unless both dimensions are explicitly set.
- **PDF Container Clipping (`overflow: hidden`)**: Emits native PDF `q`/`Q` (graphics save/restore) and `W` (clipping path) operators. Prevents overflow content from rendering outside container bounds.
- **Overflow-Aware Pagination**: Canned/height-constrained boxes with `overflow: hidden` do not trigger unintended page breaks for hidden child content.
- **Hyperlink Annotation Clipping**: Clickable link annotations (`<a href="...">`) inside `overflow: hidden` containers are dynamically cropped to the active clipping region or omitted if entirely out of bounds.
- **Document `@page` Rules**: Parses `@page { size: A4 landscape; margin: 20pt; }` declarations for document size, orientation, and uniform/per-edge margins. Explicit JS options take precedence.

### Limitations & Non-Goals
- **Scrollbars & Scrolling**: `overflow: scroll` and `overflow: auto` behave as `overflow: hidden` or default static layout (PDFs are static print documents).
- **`overflow-x` / `overflow-y` Indirection**: Independent axis clipping applies the container bounds box.
- **Intrinsic Sizing Keywords**: `fit-content`, `min-content`, and `max-content` keywords are not evaluated; explicit numeric lengths or percentages should be used.
- **Named Page At-Rules**: Named `@page identifier` rules and page selectors (`:left`, `:right`, `:first`) are excluded in favor of standard single document `@page` scope.

---

## Architectural Non-Goals

`html-pdf-engine` is a deterministic, server-side document compiler — not a browser runtime. The following are outside its current scope:

### Rendering & Layout
- **CSS 2D/3D transforms** (`transform: rotate`, `scale`, `translate`, `matrix`): The CSS `transform` property is not parsed or applied. Note: `text-transform` (uppercase/lowercase/capitalize) is a supported, separate property.
- **`position: sticky`**: Scroll-viewport-relative positioning is not applicable to static print PDFs.
- **CSS Multi-column layout** (`columns`, `column-count`, `column-width`): Not implemented.
- **CSS animations & transitions** (`@keyframes`, `transition`): Not applicable to static PDF output.
- **CSS filters & shadows** (`filter`, `box-shadow`, `text-shadow`): Not implemented.
- **SVG limitations**: While a dedicated SVG renderer is included for core primitives (`path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`), it does not support `<text>` elements, gradients, clipping, or filters.
- **Canvas rendering**: `<canvas>` elements are not rendered.

### Image Formats
- The built-in image pipeline supports **PNG**, **JPEG**, and **SVG** (vector subset).
- **WebP**, **AVIF**, **GIF**, and **BMP** images are not decoded. Passing these formats throws an `ImageError`.

### Font Formats
- **WOFF** and **WOFF2** web font formats are explicitly rejected at the `@font-face` parser stage (`FontError`).
- **Remote HTTP/HTTPS `@font-face` URLs** are not supported and throw a `FontError`. Fonts must be supplied as local file paths, data URLs, or Buffer objects.
- **Pure CFF OpenType** (`.otf` files using PostScript/CFF outlines) may fail to parse, as the parser reads the TrueType table structure. `.otf` fonts using TrueType outlines (`glyf` table) are accepted.

### Accessibility
- **Tagged PDF** is not implemented. The engine emits no `StructTreeRoot`, `MarkInfo`, or marked-content sequences.
- **PDF/UA compliance** is not implemented. PDF/UA requires a fully tagged document structure.
- The `options.language` / `/Lang` catalog entry is a PDF metadata field only. Its presence does not make the document a tagged or accessibility-compliant PDF.

### JavaScript & Interactivity
- **Client-side JavaScript execution**: `<script>` tags are intentionally excluded from execution to guarantee deterministic rendering and prevent SSRF/RCE vulnerabilities. This is an intentional design decision, not a defect.
- **DOM event handlers** (`onclick`, `onload`, etc.): Stripped during parsing.
- **Interactive form fields**: `<input>`, `<select>`, `<textarea>` are parsed as block elements and not rendered as interactive PDF form fields.

### Browser Compatibility
- **Full Web Browser Compatibility**: The project is designed for server-side PDF document generation (invoices, reports, receipts), not rendering arbitrary web pages.

