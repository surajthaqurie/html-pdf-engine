# Feature Support Matrix: html-pdf-engine

This document details the feature support matrix for `html-pdf-engine` (v1.0.0). Feature support is determined based on actual implementation and automated test coverage in the codebase.

Status Levels:
- **SUPPORTED**: Fully implemented, verified in automated test suite.
- **PARTIAL**: Basic implementation present; edge cases or complex variants not covered.
- **UNSUPPORTED**: Not currently implemented.
- **INTENTIONAL NON-GOAL**: Deliberately outside the project scope.

---

## 1. HTML Element Support

| HTML Element / Feature | Support Status | Notes / Limitations |
| :--- | :--- | :--- |
| `<!DOCTYPE html>` / `<html>` / `<body>` | **SUPPORTED** | Standard root document structure parsed cleanly. |
| `<head>` / `<meta>` / `<title>` | **SUPPORTED** | Parsed and safely excluded from visual rendering. |
| `<div>` / `<span>` / `<p>` | **SUPPORTED** | Standard block and inline text elements. |
| `<h1>`–`<h6>` | **SUPPORTED** | Headings 1 through 6 with User-Agent default sizes and margins. |
| `<strong>`, `<b>`, `<em>`, `<i>` | **SUPPORTED** | Bold, italic, and bold-oblique font variant resolution. |
| `<ul>`, `<ol>`, `<li>` | **SUPPORTED** | Lists with bullet and numbered margins. |
| `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<th>`, `<td>` | **SUPPORTED** | Table rendering with borders, cell padding, column width calculation (explicit pt/px/%, auto distribution), cell content wrapping, automatic `<thead>` repeating headers across multi-page breaks, multi-row header repetition, table row (`tr`) `break-inside: avoid` support, and row height resolution based on tallest cell. |
| `<hr>` | **SUPPORTED** | Horizontal divider rules. |
| `<style>` | **SUPPORTED** | CSS text content extracted and parsed into cascade engine. |
| `<script>` | **SUPPORTED** | Parsed and assigned `display: none` (code not visually printed). |
| `<a>` (Hyperlinks) | **SUPPORTED** | Clickable URL link annotations (`/Subtype /Link`) supporting external `http://`, `https://`, `mailto:`, and `tel:` schemes (`/A /S /URI`), as well as internal fragment links (`href="#id"`) resolved to PDF `/A /S /GoTo` destination coordinates across multi-line wrapped text boxes and repeated headers. |
| `<img>` (Images — PNG/JPEG) | **SUPPORTED** | PNG and JPEG images via base64 Data URLs, local filesystem paths, Buffer input (`options.images`), or opt-in `AssetResolver`. Format is detected by binary magic bytes; other formats throw an `ImageError`. |
| `<img>` (Images — SVG, WebP, AVIF, GIF, BMP) | **UNSUPPORTED** | No built-in decoders for vector or modern raster formats. The image pipeline accepts only PNG and JPEG binary data. |
| `<form>`, `<input>`, `<button>` | **INTENTIONAL NON-GOAL** | Interactive form controls are not rendered. |
| `<svg>`, `<canvas>` | **UNSUPPORTED** | No SVG path renderer or canvas implementation. |
| `<iframe>`, `<video>`, `<audio>` | **INTENTIONAL NON-GOAL** | Embedded media elements are not rendered. |
| `<script>` | **INTENTIONAL NON-GOAL** | Script tags are parsed and assigned `display: none`. JavaScript is never executed. |

---

## 2. CSS Feature Support

| CSS Feature / Property | Support Status | Notes / Limitations |
| :--- | :--- | :--- |
| **Inline Styles** (`style="..."`) | **SUPPORTED** | Highest specificity priority in cascade engine. |
| **Style Blocks** (`<style>`) | **SUPPORTED** | Extracted from DOM and parsed into cascade engine. |
| **External CSS String** (`css` option) | **SUPPORTED** | Cascaded alongside HTML document styles. |
| **Selectors** (`*`, `tag`, `.cls`, `#id`, `tag.cls`, `tag#id`, `A B`) | **SUPPORTED** | Standard single, compound, and descendant selectors supported. |
| **Specificity & Cascade** | **SUPPORTED** | Vector specificity scoring `[ID, Class, Tag]` implemented. |
| **CSS Inheritance** | **SUPPORTED** | Inherits `font-family`, `font-size`, `color`, `line-height` from parent nodes. |
| **Color Functions** (`Hex`, `RGB`, `RGBA`, `HSL`, `HSLA`, Named) | **SUPPORTED** | Hex (`#rgb`, `#rrggbb`, `#rgba`, `#rrggbbaa`), `rgb()`, `rgba()`, `hsl()`, `hsla()`, named colors, and `transparent` fallback handling. |
| **Backgrounds** (`background-color`, `background-image`, `background-position`, `background-size`, `background-repeat`, `background` shorthand) | **SUPPORTED** | Background color, image URL rendering, tiling (`repeat`, `repeat-x`, `repeat-y`, `no-repeat`), scaling (`cover`, `contain`), and position offsets (`top`, `bottom`, `left`, `right`, `center`). |
| **Built-in PDF Type1 Fonts** | **SUPPORTED** | Standard PDF Type1 fonts: `Helvetica` (+ Bold, Oblique, BoldOblique), `Times-Roman` (+ Bold, Italic, BoldItalic), `Courier` (+ Bold, Oblique, BoldOblique). |
| **Custom Font Embedding — TTF** | **SUPPORTED** | TrueType Font (`.ttf`) embedding via `options.fonts` or `@font-face` CSS rule. Parsed as Type0/CIDFontType2 with glyph subsetting and `/ToUnicode` CMaps. |
| **Custom Font Embedding — OpenType/TTF outline** | **SUPPORTED** | OpenType fonts using TrueType glyph outlines (`.otf` files with `glyf` table) are accepted and parsed identically to TTF. OpenType files using CFF (PostScript) outlines are not separately handled and may fail to parse. |
| **Custom Font Embedding — WOFF / WOFF2** | **UNSUPPORTED** | Web font formats WOFF and WOFF2 are explicitly rejected. The `@font-face` parser throws a `FontError` for `.woff`/`.woff2` file extensions or `format("woff")`/`format("woff2")` declarations. |
| **Remote `@font-face` URLs (http/https)** | **UNSUPPORTED** | Remote HTTP/HTTPS URLs in `@font-face src` throw a `FontError`. Fonts must be supplied as local file paths, data URLs, or Buffer objects. |
| **Font Weight & Style** | **SUPPORTED** | `font-weight: bold`, `font-style: italic` / `oblique`. |
| **Box Model** (`width`, `height`) | **SUPPORTED** | Supports `pt`, `px`, `in`, `mm`, `cm`, `%`, and `auto`. |
| **Margins** (`margin-top/right/bottom/left`) | **SUPPORTED** | Shorthand (1, 2, 3, 4 values) and individual margin properties. |
| **Paddings** (`padding-top/right/bottom/left`) | **SUPPORTED** | Shorthand (1, 2, 3, 4 values) and individual padding properties. |
| **Borders** (`border`, `border-width/color/style`, `border-top/right/bottom/left`, `border-radius`) | **SUPPORTED** | Full border shorthand, side-specific borders, stroke styles (`solid`, `dashed`, `dotted`), stroke width/colors, and rounded corners (`border-radius` 1–4 value syntaxes and individual corner radii). |
| **Text Alignment & Formatting** (`text-align`, `letter-spacing`, `text-decoration`, `white-space`, `visibility`) | **SUPPORTED** | Horizontal text alignment (`left`, `center`, `right`, `justify`), character spacing (`letter-spacing` via `Tc` PDF operator), text decorations (`underline`, `line-through`, `overline`), `white-space` controls (`nowrap`, `normal`, `pre-wrap`), and element `visibility: hidden \| visible`. |
| **Line Height** | **SUPPORTED** | Line height spacing multipliers and point units. |
| **Pagination / Page Breaks** (`break-before`, `break-after`, `break-inside`, `page-break-*`) | **SUPPORTED** | Practical server-side PDF fragmentation. Modern CSS (`break-before: auto \| page`, `break-after: auto \| page`, `break-inside: auto \| avoid`) and legacy aliases (`page-break-before: auto \| always`, `page-break-after: auto \| always`, `page-break-inside: auto \| avoid`). Integrated with block layout, multi-page tables (`<thead>` automatic repeating across page breaks, multi-row headers, table row `tr` fragmentation prevention), Flexbox, flex-wrap, Grid, positioned elements, and multi-page document pagination. |
| **Positioning** (`position: static \| relative \| absolute \| fixed`, `z-index`) | **SUPPORTED** | `position: static`, `relative`, `absolute`, and `fixed` (renders on every document page — headers/footers/watermarks) with `top`, `right`, `bottom`, `left` offsets and `z-index` paint-order sorting. |
| **`position: sticky`** | **UNSUPPORTED** | Scroll-viewport-relative positioning is not applicable to static PDF output and is not implemented. |
| **CSS 2D/3D Transforms** (`transform: rotate`, `scale`, `translate`, `matrix`) | **UNSUPPORTED** | The CSS `transform` property is not parsed or applied. `text-transform` (uppercase/lowercase/capitalize) is a separate supported property. |
| **Flexbox** (`display: flex`) | **SUPPORTED** | 1D and Multi-Line Flexbox layout (`flex-direction`, `flex-wrap: nowrap \| wrap \| wrap-reverse`, `flex-flow`, `justify-content`, `align-items`, `gap`, `row-gap`, `column-gap`, `flex-grow/shrink/basis`). |
| **Grid** (`display: grid`) | **SUPPORTED** | Practical CSS Grid layout (`grid-template-columns`, `grid-template-rows`, `grid-column`/`grid-row`/`span`, `gap`/`row-gap`/`column-gap`, `justify-items`/`align-items`, `justify-self`/`align-self`, `repeat()`, `fr` units). |
| **Sizing Constraints** (`min-width`, `max-width`, `min-height`, `max-height`) | **SUPPORTED** | Supported across block boxes, images (aspect-ratio preserved), table cells, flex items, grid items, and positioned elements. Supports `px`, `pt`, `mm`, `cm`, `in`, `%`. |
| **Overflow Clipping** (`overflow: hidden`) | **SUPPORTED** | Emits native PDF graphics clipping paths (`q`/`Q`/`W`). Prevents overflow content from rendering outside container bounds and suppresses unintended page breaks for hidden overflow content. Hyperlinks are dynamically cropped or omitted. |
| **Print `@page` Rules** (`@page { size; margin; }`) | **SUPPORTED** | CSS `@page` rule parsing for document size (`A4`, `Letter`, `landscape`, custom dimensions) and uniform/per-side margins. Explicit JS API options override CSS `@page` rules. |
| **Media Queries** (`@media`) | **SUPPORTED** | `@media print`, `@media all`, and width-based `@media (min-width: ...)` / `@media (max-width: ...)` query evaluation against printable page content width. Screen media excluded. |
| **CSS Variables** (`var(--foo)`) | **SUPPORTED** | CSS custom property declarations (`--name: value`), `var()` resolution, fallbacks (`var(--name, default)`), nested variables, cycle protection, and DOM inheritance. |

| **`text-transform`** | **SUPPORTED** | `text-transform: uppercase \| lowercase \| capitalize \| none` applied during text layout. This is distinct from the CSS `transform` property. |

---

## 3. PDF Output Feature Support

| PDF Feature | Support Status | Notes / Limitations |
| :--- | :--- | :--- |
| **Standard Page Sizes** (A0–A6, B4, B5, Letter, Legal, etc.) | **SUPPORTED** | All standard paper sizes supported out of the box. |
| **Custom Page Sizes** (`{ width, height }`) | **SUPPORTED** | Custom dimensions in points (`pt`). |
| **Page Orientation** (`portrait`, `landscape`) | **SUPPORTED** | Page dimension swapping supported. |
| **Multi-Page Pagination** | **SUPPORTED** | Automatic content flow and page splitting. |
| **Dynamic Headers & Footers** | **SUPPORTED** | Supports dynamic `{{pageNumber}}` and `{{totalPages}}` placeholders. |
| **FlateDecode Compression** | **SUPPORTED** | Native Node.js `zlib` stream compression. |
| **PDF Hyperlinks & Anchors** | **SUPPORTED** | Clickable `/URI` link annotations (`http://`, `https://`, `mailto:`, `tel:`) and internal fragment link annotations (`href="#id"`) with exact page coordinates for text and image targets. |
| **PDF Metadata & Preferences** | **SUPPORTED** | PDF `/Info` dictionary (`Title`, `Author`, `Subject`, `Keywords`, `Creator`, `Producer`), catalog `/ViewerPreferences`, `/Lang`, and `/PageLabels`. |
| **Tagged PDF / PDF Accessibility** | **UNSUPPORTED** | No `StructTreeRoot`, `MarkInfo`, or marked-content sequences are generated. The `/Lang` catalog entry is a metadata field only and does not constitute a tagged or accessible PDF. |
| **PDF/UA Compliance** | **UNSUPPORTED** | PDF/UA requires tagged PDF structure. This is not implemented. Do not rely on this engine for PDF/UA-compliant document generation. |
