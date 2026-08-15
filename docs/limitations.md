# Technical Limitations & Intentional Non-Goals: html-pdf-engine

This document outlines the current technical limitations and architectural non-goals of `html-pdf-engine`.

---

## Technical Limitations (v1.0.0)

1. **No External Network Calls**:
   `html-pdf-engine` does not make network calls to fetch remote stylesheets (`<link href="http...">`), remote images (`<img src="http...">`), or web fonts (`@font-face`). All resources must be provided inline or passed directly.

2. **Supported Layout Models**:
   Supports standard CSS Block layout, Inline text flow, HTML Tables, CSS Flexbox (`display: flex`), CSS Grid (`display: grid`), and Practical CSS Positioning (`position: relative` and `position: absolute`). Grid supports explicit and flexible track sizing (`px`, `pt`, `%`, `fr`, `auto`, `repeat()`), explicit placement (`grid-column`, `grid-row`, `span`), automatic item placement, item alignment (`justify-items`, `align-items`, `justify-self`, `align-self`), and `gap`/`row-gap`/`column-gap`.

3. **Font Support**:
   Supports standard PDF Type1 fonts (`Helvetica`, `Times-Roman`, `Courier`) and custom TrueType (`.ttf`) font embedding via `options.fonts`. Network font loading (`@font-face` with URL) is excluded to maintain zero external network calls.

4. **PDF Hyperlinks (`<a href="...">`)**:
   Generates clickable PDF link annotations (`/Subtype /Link`, `/A /S /URI`). Supports absolute `http://`, `https://`, and `mailto:` URL schemes across single-line and multi-line wrapped text boxes. Relative paths (`/page.html`), fragment identifiers (`#section`), and script execution (`javascript:`) are safely ignored to maintain PDF security and stability.

---

## CSS Positioning

`html-pdf-engine` intentionally implements a practical subset of CSS positioning focused on document layout needs (such as badges, labels, stamps, logos, watermarks, and header overlays) rather than full browser rendering engine behavior.

### Supported Subset
- **Position Modes**: `position: static`, `position: relative`, `position: absolute`.
- **Offset Declarations**: `top`, `right`, `bottom`, `left` supporting physical units (`px`, `pt`, `mm`, `cm`, `in`) and percentages (`%`).
- **Containing Block Resolution**: Absolute elements position relative to their nearest positioned ancestor (`position: relative` or `position: absolute`). Un-parented absolute elements resolve against the document printable page area.
- **Normal Flow Interaction**: Relative elements maintain their layout footprint in normal document flow while visually offsetting coordinates. Absolute elements are extracted from normal flow so sibling layout remains unaffected.
- **Layout Integration**: Fully supported inside Flexbox (`display: flex`) and CSS Grid (`display: grid`) container trees.
- **Supported Element Children**: Text nodes, custom TTF fonts, PNG/JPEG images, and clickable PDF hyperlink annotations.
- **Pagination Awareness**: Maintains target page assignment and page index propagation across multi-page document breaks.

### Unsupported Positioning Features
- `position: fixed` (viewport-pinned elements across pages)
- `position: sticky` (scroll-dependent positioning)
- `z-index` stacking context layers (paint order strictly follows box tree recursion)
- 2D/3D CSS transforms (`transform: rotate / scale / translate`)
- Advanced CSS stacking contexts

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

- **Client-side JavaScript Execution**: `<script>` tags are intentionally excluded from execution to guarantee deterministic rendering and prevent SSRF/RCE vulnerabilities.
- **Full Web Browser Compatibility**: The project is designed for server-side PDF document generation (invoices, reports, receipts), not rendering arbitrary web pages.

