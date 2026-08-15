# Feature Support Matrix: html-pdf-engine

This document details the feature support matrix for `html-pdf-engine` (v1.10.0). Feature support is determined based on actual implementation and automated test coverage in the codebase.

Status Levels:
- **SUPPORTED**: Fully implemented, verified in automated test suite.
- **PARTIALLY SUPPORTED**: Basic implementation present; edge cases or complex variants not supported.
- **IN DEVELOPMENT**: Planned for upcoming minor release.
- **NOT SUPPORTED**: Intentionally or currently unsupported.

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
| `<a>` (Hyperlinks) | **SUPPORTED** | Clickable URL link annotations (`/Subtype /Link`, `/A /S /URI`) supporting absolute `http://`, `https://`, and `mailto:` schemes across multi-line wrapped text boxes and repeated table headers. Invalid/unsupported schemes are handled safely. |
| `<img>` (Images) | **SUPPORTED** | PNG & JPEG base64 Data URLs, local filesystem paths (resolved relative to `basePath` or `process.cwd()`), and Buffer input (`options.images`). Includes path traversal protection and in-memory session caching. |
| `<form>`, `<input>`, `<button>` | **NOT SUPPORTED** | Interactive form controls unsupported. |
| `<svg>`, `<canvas>` | **NOT SUPPORTED** | Vector graphics canvas rendering unsupported. |
| `<iframe>`, `<video>`, `<audio>` | **NOT SUPPORTED** | Embedded media unsupported. |

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
| **Fonts & Variants** | **SUPPORTED** | Standard Type1 fonts (`Helvetica`, `Times`, `Courier`) + Custom TTF font embedding (`options.fonts`, `@font-face`) via Type0/CIDFontType2 with `/ToUnicode` CMaps. |
| **Font Weight & Style** | **SUPPORTED** | `font-weight: bold`, `font-style: italic` / `oblique`. |
| **Box Model** (`width`, `height`) | **SUPPORTED** | Supports `pt`, `px`, `in`, `mm`, `cm`, `%`, and `auto`. |
| **Margins** (`margin-top/right/bottom/left`) | **SUPPORTED** | Shorthand (1, 2, 3, 4 values) and individual margin properties. |
| **Paddings** (`padding-top/right/bottom/left`) | **SUPPORTED** | Shorthand (1, 2, 3, 4 values) and individual padding properties. |
| **Borders** (`border`, `border-width/color/style`, `border-top/right/bottom/left`, `border-radius`) | **SUPPORTED** | Full border shorthand, side-specific borders, stroke styles (`solid`, `dashed`, `dotted`), stroke width/colors, and rounded corners (`border-radius` 1–4 value syntaxes and individual corner radii). |
| **Text Alignment & Formatting** (`text-align`, `letter-spacing`, `text-decoration`, `white-space`, `visibility`) | **SUPPORTED** | Horizontal text alignment (`left`, `center`, `right`, `justify`), character spacing (`letter-spacing` via `Tc` PDF operator), text decorations (`underline`, `line-through`, `overline`), `white-space` controls (`nowrap`, `normal`, `pre-wrap`), and element `visibility: hidden \| visible`. |
| **Line Height** | **SUPPORTED** | Line height spacing multipliers and point units. |
| **Pagination / Page Breaks** (`break-before`, `break-after`, `break-inside`, `page-break-*`) | **SUPPORTED** | Practical server-side PDF fragmentation. Modern CSS (`break-before: auto \| page`, `break-after: auto \| page`, `break-inside: auto \| avoid`) and legacy aliases (`page-break-before: auto \| always`, `page-break-after: auto \| always`, `page-break-inside: auto \| avoid`). Integrated with block layout, multi-page tables (`<thead>` automatic repeating across page breaks, multi-row headers, table row `tr` fragmentation prevention), Flexbox, flex-wrap, Grid, positioned elements, and multi-page document pagination. |
| **Positioning** (`position: static \| relative \| absolute`) | **PARTIALLY SUPPORTED** | Practical `position: static`, `position: relative`, and `position: absolute` with `top`, `right`, `bottom`, `left` offsets (`px`, `pt`, `mm`, `cm`, `in`, `%`). Supports containing-block resolution, normal-flow removal for absolute, flow preservation for relative, and integration with Flexbox, CSS Grid, text, images, custom fonts, and multi-page pagination. `position: fixed`, `position: sticky`, `z-index`, CSS transforms, and advanced stacking contexts are unsupported. |
| **Flexbox** (`display: flex`) | **SUPPORTED** | 1D and Multi-Line Flexbox layout (`flex-direction`, `flex-wrap: nowrap \| wrap \| wrap-reverse`, `flex-flow`, `justify-content`, `align-items`, `gap`, `row-gap`, `column-gap`, `flex-grow/shrink/basis`). |
| **Grid** (`display: grid`) | **SUPPORTED** | Practical CSS Grid layout (`grid-template-columns`, `grid-template-rows`, `grid-column`/`grid-row`/`span`, `gap`/`row-gap`/`column-gap`, `justify-items`/`align-items`, `justify-self`/`align-self`, `repeat()`, `fr` units). |
| **Sizing Constraints** (`min-width`, `max-width`, `min-height`, `max-height`) | **SUPPORTED** | Supported across block boxes, images (aspect-ratio preserved), table cells, flex items, grid items, and positioned elements. Supports `px`, `pt`, `mm`, `cm`, `in`, `%`. |
| **Overflow Clipping** (`overflow: hidden`) | **SUPPORTED** | Emits native PDF graphics clipping paths (`q`/`Q`/`W`). Prevents overflow content from rendering outside container bounds and suppresses unintended page breaks for hidden overflow content. Hyperlinks are dynamically cropped or omitted. |
| **Print `@page` Rules** (`@page { size; margin; }`) | **SUPPORTED** | CSS `@page` rule parsing for document size (`A4`, `Letter`, `landscape`, custom dimensions) and uniform/per-side margins. Explicit JS API options override CSS `@page` rules. |
| **Media Queries** (`@media`) | **NOT SUPPORTED** | Media queries unsupported. |
| **CSS Variables** (`var(--foo)`) | **NOT SUPPORTED** | Custom property variables unsupported. |

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
| **PDF Hyperlinks** | **SUPPORTED** | Clickable link annotations (`/Subtype /Link`, `/A /S /URI`) generated with precise page coordinates for text and image links. |
| **PDF Document Metadata** | **SUPPORTED** | PDF `/Info` dictionary containing `Title`, `Author`, `Subject`, `Keywords`, `Creator`, `Producer`. |
