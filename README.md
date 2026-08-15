# html-pdf-engine

Lightweight, dependency-free HTML & CSS to PDF engine for Node.js, designed for invoices, receipts, reports, and structured documents.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/html-pdf-engine.svg)](https://www.npmjs.com/package/html-pdf-engine)
[![Node Version](https://img.shields.io/node/v/html-pdf-engine.svg)](https://nodejs.org/)

---

## Overview

`html-pdf-engine` is a pure TypeScript library that compiles HTML and CSS directly into PDF 1.7 binary documents in Node.js with **zero runtime dependencies**.

### Scope & Rendering Model

`html-pdf-engine` is **not a browser runtime** (such as Chromium, WebKit, or Firefox). It is designed specifically for fast, deterministic server-side document rendering.

- **No Browser Process**: Generates PDF binary streams natively without invoking Chromium or external subprocesses.
- **No JavaScript Execution**: `<script>` tags are parsed and visually hidden to guarantee security and deterministic execution.
- **Default Offline Security & Opt-In Asset Resolution**: By default, the engine makes zero implicit network requests for external stylesheets, images, or web fonts. Applications can explicitly configure an opt-in `AssetResolver` (including the built-in `createNetworkAssetResolver()`) with SSRF protection, timeout, and byte limits.
- **Targeted Document CSS Subset**: Implements a CSS subset tailored for structured business layouts (Block, Inline, Table, Flexbox with wrapping, CSS Grid, CSS Custom Properties / `var()`, Media Queries, `position: relative / absolute / fixed`, and `z-index` paint ordering).

---

## Key Technical Highlights

- **Zero Runtime Dependencies**: Built entirely from scratch in TypeScript, relying solely on Node's native `node:zlib` for FlateDecode stream compression.
- **Node.js Requirement**: Requires Node.js `>= 18.0.0`.
- **Package Size**: ~146.5 kB packed tarball (~797.3 kB unpacked, verified via `npm pack --dry-run`).
- **Low-Millisecond Rendering**: Generates structured document PDFs in low milliseconds with minimal memory overhead.
- **TrueType Font Subsetting**: Embeds only the used glyphs for custom `.ttf` fonts into Type0/CIDFontType2 objects with `/ToUnicode` CMaps, minimizing output file size.
- **1D/2D Modern Layout**: 1D Flexbox (with `flex-wrap`) and 2D CSS Grid support for complex document structures.
- **CSS Custom Properties & Variables**: Supports `--custom-property` definitions, `var()` resolution, fallbacks, inheritance, nested references, and cycle detection.
- **CSS `@media` Queries**: Evaluates `@media print`, `@media all`, and width-based `(min-width: ...)` / `(max-width: ...)` queries against page content width.
- **CSS Sizing Constraints**: `min-width`, `max-width`, `min-height`, `max-height` supported across block boxes, images, table cells, flex/grid items, and positioned elements.
- **PDF Container Clipping (`overflow: hidden`)**: PDF-native graphics clipping (`q`/`Q`/`W`) for content containment, overflow-aware pagination suppression, and link annotation cropping.
- **CSS `@page` Rule Support**: Parses `@page { size: A4 landscape; margin: 20pt; }` at-rules for document dimensions, orientation, and margins directly from CSS.
- **Practical CSS Positioning & Stacking**: `position: relative`, `position: absolute`, and `position: fixed` (repeats element across pages for headers/footers/watermarks) with `z-index` paint ordering.
- **Advanced PDF Pagination**: Modern `break-before: page`, `break-after: page`, `break-inside: avoid`, and legacy `page-break-*` aliases for reliable document page fragmentation across Block, Table, Flexbox, and Grid layouts.
- **Clickable PDF Hyperlinks & Internal Anchors**: Renders external URLs (`http://`, `https://`, `mailto:`, `tel:`) into `/URI` annotations and internal fragment links (`href="#anchor"`) into PDF `/GoTo` destinations.
- **PDF Document Metadata & Preferences**: Embeds metadata into PDF `/Info` dictionaries (`Title`, `Author`, `Subject`, `Keywords`, `Creator`, `Producer`), catalog `/ViewerPreferences`, `/Lang`, and `/PageLabels`.

---

## Installation

```bash
npm install html-pdf-engine
```

Or using `yarn` or `pnpm`:

```bash
yarn add html-pdf-engine
# or
pnpm add html-pdf-engine
```

---

## Basic Usage Example

```typescript
import { HtmlToPdf } from "html-pdf-engine";
import * as fs from "node:fs";

const pdfBuffer = await HtmlToPdf.generateBuffer({
  html: `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Helvetica, sans-serif; padding: 20px; }
          h1 { color: #0284c7; font-size: 24pt; margin-bottom: 8px; }
          p { color: #334155; font-size: 11pt; line-height: 1.5; }
        </style>
      </head>
      <body>
        <h1>Order Confirmation</h1>
        <p>Thank you for your purchase. Your order has been processed successfully.</p>
      </body>
    </html>
  `,
  page: "A4",
  orientation: "portrait",
  margin: { top: 36, right: 36, bottom: 36, left: 36 },
});

fs.writeFileSync("./confirmation.pdf", pdfBuffer);
```

---

## Real-World Invoice Example

This example demonstrates dynamic header layout using Flexbox, summary calculations using CSS Grid, embedded image asset mapping, metadata, and page footers:

```typescript
import { HtmlToPdf } from "html-pdf-engine";
import * as fs from "node:fs";

const logoBuffer = fs.readFileSync("./assets/logo.png");

const pdfBuffer = await HtmlToPdf.generateBuffer({
  html: `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Helvetica, sans-serif; margin: 0; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          .title { color: #0369a1; font-size: 22pt; margin: 0; }
          .meta { font-size: 10pt; color: #64748b; text-align: right; }
          
          .grid-summary { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-top: 20px; font-size: 10pt; }
          .grid-header { font-weight: bold; background-color: #f1f5f9; padding: 8px; }
          .grid-cell { padding: 8px; border-bottom: 1px solid #e2e8f0; }

          .total-box { margin-top: 20px; text-align: right; font-size: 12pt; font-weight: bold; color: #0f172a; }
          a { color: #0284c7; text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <img src="logo.png" width="120" />
            <h1 class="title">INVOICE #INV-2026-892</h1>
          </div>
          <div class="meta">
            <strong>Date:</strong> August 15, 2026<br/>
            <strong>Due Date:</strong> September 15, 2026<br/>
            <strong>Support:</strong> <a href="mailto:billing@example.com">billing@example.com</a>
          </div>
        </div>

        <div class="grid-summary">
          <div class="grid-header">Service Description</div>
          <div class="grid-header">Hours</div>
          <div class="grid-header">Amount</div>

          <div class="grid-cell">Cloud Architecture Advisory</div>
          <div class="grid-cell">12 hrs</div>
          <div class="grid-cell">$1,800.00</div>

          <div class="grid-cell">PDF Generation Engine Setup</div>
          <div class="grid-cell">8 hrs</div>
          <div class="grid-cell">$1,200.00</div>
        </div>

        <div class="total-box">
          Total Due: $3,000.00
        </div>
      </body>
    </html>
  `,
  images: {
    "logo.png": logoBuffer,
  },
  meta: {
    title: "Invoice INV-2026-892",
    author: "Acme Consulting Services",
    subject: "Monthly Statement",
    keywords: "invoice, consulting, cloud",
  },
  footer: {
    text: "Page {{pageNumber}} of {{totalPages}}",
    align: "center",
    showDividerLine: true,
  },
});

fs.writeFileSync("./invoice.pdf", pdfBuffer);
```

---

## Asset Handling Guide

By default, `html-pdf-engine` operates entirely server-side and performs no implicit network requests for external HTTP/HTTPS assets. Applications can supply assets via `options.images` / `options.fonts`, local filesystem paths, base64 data URLs, or an opt-in `AssetResolver`.

### Remote Asset Loading (Opt-In)

For environments requiring dynamic remote asset resolution, `html-pdf-engine` provides the `AssetResolver` interface and a built-in `createNetworkAssetResolver()` factory with strict SSRF protections and resource limits:

```typescript
import { HtmlToPdf, createNetworkAssetResolver } from "html-pdf-engine";

const assetResolver = createNetworkAssetResolver({
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB limit
  timeoutMs: 3000,
  maxRedirects: 3,
  allowPrivateIPs: false,       // SSRF protection: blocks local/private IP ranges (default)
});

const pdf = await HtmlToPdf.generateBuffer({
  html: '<img src="https://cdn.example.com/logo.png" />',
  assetResolver,
});
```

### 1. Images

Supported image formats:
- **PNG** (`image/png`)
- **JPEG** (`image/jpeg`)

Image sources can be specified in HTML `<img src="...">` using:
- **Base64 Data URLs**: `<img src="data:image/png;base64,iVBORw0KGgo..." />`
- **Local Filesystem Paths**: `<img src="./assets/logo.png" />` or `<img src="../images/photo.jpg" />` (resolved relative to `basePath` or `process.cwd()`)
- **Explicit Image Map (`options.images`)**: Pass Node.js `Buffer` objects or base64 strings mapped by identifier:

```typescript
const pdf = await HtmlToPdf.generateBuffer({
  html: '<img src="./images/company-logo.png" width="150" />',
  basePath: "./public", // Base directory for resolving relative image and @font-face assets
  images: {
    // Explicit options.images take precedence over local filesystem paths
    "company-logo.png": fs.readFileSync("./assets/company-logo.png"),
  },
});
```

### 2. Custom Font Embedding

The built-in font pipeline supports:
- **TrueType (`.ttf`)** — fully supported
- **OpenType with TrueType outlines (`.otf` with `glyf` table)** — accepted by the parser (same binary table structure)
- **WOFF / WOFF2** — **not supported**; the `@font-face` parser throws a `FontError` for these formats
- **Remote `@font-face` URLs (http/https)** — **not supported**; throws a `FontError`. Fonts must be supplied as local file paths, data URLs, or Buffers.

Network font imports (`@font-face` with URL) are not supported. Pass font file paths or Node.js `Buffer` objects via `options.fonts`:

```typescript
const pdf = await HtmlToPdf.generateBuffer({
  html: '<p style="font-family: Inter; font-weight: bold;">Custom Font Headline</p>',
  fonts: {
    Inter: {
      regular: "./fonts/Inter-Regular.ttf",
      bold: "./fonts/Inter-Bold.ttf",
      italic: fs.readFileSync("./fonts/Inter-Italic.ttf"),
    },
  },
});
```

**Font Subsetting**: Custom fonts are automatically subsetted during PDF compilation. Only the character glyphs referenced in the document are embedded into the PDF binary, resulting in compact output file sizes.

---

## Feature Capabilities & API Reference

### PDF Document Metadata

PDF document metadata can be provided via `options.meta` (or the legacy alias `options.metadata`):

```typescript
const pdf = await HtmlToPdf.generateBuffer({
  html: "<h1>Document</h1>",
  meta: {
    title: "Annual Report 2026",
    author: "Finance Department",
    subject: "Financial Analysis",
    keywords: "finance, report, 2026",
    creator: "Internal Reporting Suite",
  },
});
```

### PDF Hyperlinks & Internal Document Navigation

Clickable HTML anchor tags (`<a href="...">`) are parsed into native PDF Link Annotations (`/Subtype /Link`):

```html
<!-- External Web URLs & Protocol Schemes -->
<a href="https://example.com">Visit Website</a>
<a href="mailto:support@example.com">Contact Support</a>
<a href="tel:+18005550199">Call Support</a>

<!-- Internal Document Fragment Links -->
<a href="#section-2">Jump to Section 2</a>

<!-- Target Anchor Destination -->
<h2 id="section-2">Section 2</h2>
```

- **External Links**: Generated as `/A /S /URI` actions supporting `http://`, `https://`, `mailto:`, and `tel:` schemes.
- **Internal Fragment Links**: Fragment URLs (`href="#id"`) are resolved against matching DOM element IDs (`id="id"`) and compiled into PDF `/A /S /GoTo` internal destination actions.
- **Bounding Boxes & Wrapping**: Hyperlink bounding boxes are computed from laid-out inline text lines, supporting multi-line wrapped links across pages.

### CSS Sizing Constraints & Container Clipping

`html-pdf-engine` supports standard CSS dimension constraints (`min-width`, `max-width`, `min-height`, `max-height`) and `overflow: hidden` container clipping across all layout models:

```html
<style>
  /* Responsive image scaling while preserving aspect ratio */
  img.hero { max-width: 100%; max-height: 200pt; }

  /* Canned card container with overflow clipping */
  .badge-card {
    min-width: 200pt;
    max-height: 120pt;
    overflow: hidden;
    border: 1pt solid #cbd5e1;
  }
</style>
```

- **Sizing Constraints**: `min-width`/`max-width` and `min-height`/`max-height` work across Block boxes, Images, Table cells, Flex items, Grid items, and Positioned elements.
- **PDF-Native Container Clipping**: `overflow: hidden` emits PDF graphics state clipping commands (`q`, `W n`), ensuring content and clickable hyperlink annotations do not spill outside container boundaries.
- **Pagination Protection**: Content overflowing inside `overflow: hidden` containers is clipped visually without triggering spurious multi-page document pagination.

### CSS `@page` At-Rules

Documents can specify page dimensions, orientation, and margins directly in CSS via `@page` rules:

```css
@page {
  size: A4 landscape;
  margin: 20pt 30pt;
}

/* Custom dimensions */
@page {
  size: 8.5in 11in;
  margin-top: 0.5in;
  margin-bottom: 0.5in;
}
```

Explicit JavaScript options (`page`, `orientation`, `margin`) provided to `HtmlToPdf.generate()` will override CSS `@page` declarations if specified.

---

## Layout Support Matrix

### Flexbox (`display: flex` / `display: inline-flex`)

| Flex Property | Supported Values |
| :--- | :--- |
| `flex-direction` | `row`, `column`, `row-reverse`, `column-reverse` |
| `flex-wrap` | `nowrap`, `wrap`, `wrap-reverse` |
| `flex-flow` | Shorthand combination of `flex-direction` and `flex-wrap` |
| `justify-content` | `flex-start`, `center`, `flex-end`, `space-between`, `space-around`, `space-evenly` |
| `align-items` | `flex-start`, `center`, `flex-end`, `stretch` |
| `gap` / `row-gap` / `column-gap` | Explicit gap sizing in `px`, `pt`, `mm`, `cm`, `in`, `%` |
| `flex-grow` / `flex-shrink` / `flex-basis` | Item flexibility coefficients and base size resolution |

### CSS Grid (`display: grid` / `display: inline-grid`)

| Grid Property | Supported Values |
| :--- | :--- |
| `grid-template-columns` | Fixed (`px`, `pt`, `mm`, `cm`, `in`), percentage (`%`), flexible (`fr`), `auto`, `repeat(count, track)` |
| `grid-template-rows` | Fixed (`px`, `pt`, `mm`, `cm`, `in`), percentage (`%`), flexible (`fr`), `auto`, `repeat(count, track)` |
| `grid-column` / `grid-column-start` / `grid-column-end` | Explicit column index placement and `span N` coverage |
| `grid-row` / `grid-row-start` / `grid-row-end` | Explicit row index placement and `span N` coverage |
| `gap` / `row-gap` / `column-gap` | Track spacing between grid columns and rows |
| `justify-items` / `align-items` | Grid container item alignment (`start`, `center`, `end`, `stretch`) |
| `justify-self` / `align-self` | Individual grid item self-alignment (`start`, `center`, `end`, `stretch`) |
| Item Placement | Automatic placement algorithm for unplaced items into available grid cells |

### CSS Positioning (`position: relative` / `position: absolute`)

`html-pdf-engine` supports practical CSS positioning for document overlays, badges, watermarks, stamps, and structured report layouts.

```html
<div style="position: relative; width: 100%; height: 120px;">
  <div style="position: absolute; top: 10px; right: 20px; background-color: #22c55e; color: #ffffff; padding: 4px 8px; border-radius: 4px;">
    PAID
  </div>
</div>
```

- **`position: relative`**: Preserves the element's space in normal document flow while applying visual `top`, `right`, `bottom`, `left` offsets.
- **`position: absolute`**: Removes the element from normal document flow and positions it relative to its nearest positioned ancestor (`relative` or `absolute`).
- **Containing Block Resolution**: Un-parented absolute elements resolve against the document/page printable coordinate area.
- **Offsets**: Supports explicit units (`px`, `pt`, `mm`, `cm`, `in`) and percentage values (`%`).

| Positioning Property | Supported Values / Behavior |
| :--- | :--- |
| `position` | `static`, `relative`, `absolute` |
| `top` / `right` / `bottom` / `left` | Fixed units (`px`, `pt`, `mm`, `cm`, `in`) and percentages (`%`) |
| Containing Block | Nearest positioned ancestor (`relative` / `absolute`) or document printable area |
| Layout Integration | Positioned elements inside Flexbox (`display: flex`) and CSS Grid (`display: grid`) |
| Supported Children | Text nodes, custom TTF fonts, PNG/JPEG images, and clickable PDF hyperlinks |
| Pagination | Multi-page aware page index propagation across page breaks |

### Advanced PDF Pagination & Page-Break Control

`html-pdf-engine` provides practical PDF pagination and page-break control for structured multi-page documents such as invoices, reports, statements, and forms.

```html
<section style="break-before: page;">
  <h2>Invoice Summary</h2>
</section>

<div style="break-inside: avoid;">
  <h3>Payment Details</h3>
  <p>Important content that should remain together.</p>
</div>
```

#### Modern CSS Fragmentation Properties

```css
break-before: auto | page;
break-after: auto | page;
break-inside: auto | avoid;
```

#### Legacy CSS Page-Break Aliases

```css
page-break-before: auto | always;
page-break-after: auto | always;
page-break-inside: auto | avoid;
```

#### Behavior & Layout Rules

- **`break-before: page`** (or `page-break-before: always`): Starts an element on a new PDF page (suppressed if the element is already positioned at the start of a page).
- **`break-after: page`** (or `page-break-after: always`): Forces following content onto the next PDF page (suppressed if applied to the final element in the document).
- **`break-inside: avoid`** (or `page-break-inside: avoid`): Attempts to keep a block container, table row (`tr`), Flexbox container/item, Grid container/item, image, or text group together on the current page if vertical space permits.
- **Oversized Content Fallback**: If an element's total height exceeds a single page's printable height, `break-inside: avoid` permits normal multi-page splitting to prevent infinite pagination loops.
- **Practical PDF Pagination**: Designed for deterministic server-side document rendering. Advanced browser CSS fragmentation features (such as `break-before/after: left | right | recto | verso`, column fragmentation, CSS regions, or subpage fragmentation) are intentionally unsupported.

---

## Dynamic Headers and Footers

Top headers and bottom footers can be attached via `options.header` and `options.footer`:

```typescript
const pdf = await HtmlToPdf.generateBuffer({
  html: "<div>Content across multiple pages...</div>",
  header: {
    text: "Confidential Financial Report",
    align: "left",
    fontSize: 9,
    showDividerLine: true,
  },
  footer: {
    text: (page, total) => `Page ${page} of ${total}`,
    align: "center",
    fontSize: 9,
    showDividerLine: true,
  },
});
```

---

## Public TypeScript API & Error Handling

### Primary Methods (`HtmlToPdf`)

- `HtmlToPdf.generateBuffer(options: HtmlToPdfOptions): Promise<Buffer>`: Compiles HTML/CSS options into a Node.js `Buffer`.
- `HtmlToPdf.generateFile(options: HtmlToFileOptions): Promise<void>`: Compiles HTML/CSS options and writes directly to disk.
- `HtmlToPdf.generate(options: HtmlToPdfOptions): Promise<PDFDocument>`: Low-level API returning the structured `PDFDocument` instance.

### Exported Types & Interfaces

```typescript
import type {
  HtmlToPdfOptions,
  HtmlToFileOptions,
  PDFMetadataOptions,
  PageSizeName,
  PageOrientation,
  PageMargins,
  PageSize,
  HeaderFooterOptions,
  HeaderFooterTextResolver,
  CustomFontMap,
  FontVariantSource,
  ImageMap,
  ParsedImageData,
  ColorRGB,
} from "html-pdf-engine";
```

### Error Hierarchy

All custom errors extend `PdfError`:

```typescript
import {
  PdfError,
  FontError,
  ImageError,
  HtmlParseError,
  CssParseError,
  LayoutError,
  UnsupportedFeatureError,
} from "html-pdf-engine";

try {
  const pdfBuffer = await HtmlToPdf.generateBuffer({ html });
} catch (error) {
  if (error instanceof FontError) {
    console.error("Font resolution failure:", error.message);
  } else if (error instanceof ImageError) {
    console.error("Image processing failure:", error.message);
  } else if (error instanceof PdfError) {
    console.error("PDF engine error:", error.message);
  }
}
```

---

## Feature Matrix

| Feature | Support Level | Implementation Notes |
| :--- | :--- | :--- |
| **HTML Parsing** | **Supported** | Valid standard HTML5 structure (`<div>`, `<p>`, `<span>`, `<h1>`–`<h6>`, `<table>`, `<ul>`, `<ol>`, `<a>`, `<img>`). |
| **Block & Inline Layout** | **Supported** | Text wrapping, line height, margins, padding, border shorthand & individual sides. |
| **HTML Tables** | **Supported** | `<table>`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td` with borders, padding, cell text-wrapping, automatic `<thead>` repeating headers across multi-page breaks, multi-row header repetition, and `break-inside: avoid` on `tr`. |
| **Lists** | **Supported** | `<ul>`, `<ol>`, `<li>` with standard bullet and numbered layout spacing. |
| **PNG & JPEG Images** | **Supported** | Base64 Data URLs, local file paths, and Node.js Buffer mapping (`options.images`). |
| **Custom TTF Fonts** | **Supported** | Custom `.ttf` embedding via `options.fonts` (`regular`, `bold`, `italic`, `boldItalic`). |
| **TTF Subsetting** | **Supported** | Embeds subsetted CIDFontType2 / Type0 glyph maps with `/ToUnicode` CMaps. |
| **Flexbox Layout** | **Supported** | 1D & multi-line layout (`flex-direction`, `flex-wrap`, `justify-content`, `align-items`, `gap`, `flex-grow/shrink/basis`). |
| **CSS Grid Layout** | **Supported** | 2D track layout (`px`, `pt`, `%`, `fr`, `auto`, `repeat()`), explicit placement (`grid-column`, `grid-row`, `span`), auto placement, item alignment. |
| **CSS Positioning & Stacking** | **Supported** | Practical `position: static`, `relative`, `absolute`, and `fixed` (repeated across pages for headers/footers/watermarks) with containing block resolution and `z-index` paint ordering. `position: sticky` and 2D/3D transforms unsupported. |
| **PDF Pagination & Page Breaks** | **Supported** | Practical `break-before: page`, `break-after: page`, `break-inside: avoid`, and legacy `page-break-*` aliases across Block, multi-page Table (`<thead>` automatic repeating headers across page breaks), Flexbox, Grid, and positioned elements. |
| **PDF Hyperlinks & Anchors** | **Supported** | Clickable `/URI` link annotations (`http://`, `https://`, `mailto:`, `tel:`) and internal fragment link annotations (`href="#id"`) resolved to PDF `/GoTo` destinations. |
| **PDF Metadata & Preferences** | **Supported** | Custom `/Info` dictionary entries (`Title`, `Author`, `Subject`, `Keywords`, `Creator`, `Producer`), catalog `/ViewerPreferences`, `/Lang`, and `/PageLabels`. |
| **Headers & Footers** | **Supported** | Dynamic `{{pageNumber}}` & `{{totalPages}}` text resolvers with alignment and divider lines. |
| **CSS Variables** | **Supported** | Custom properties (`var(--name)`), fallback values, inheritance, nested variable resolution, and cycle protection. |
| **Media Queries** | **Supported** | `@media print`, `@media all`, and width-based `(min-width: ...)` / `(max-width: ...)` query blocks evaluated against PDF page content width. |
| **JavaScript Execution** | **Not Supported** | `<script>` tags parsed and visually hidden for security. |
| **Remote Asset Loading** | **Opt-In** | Default renderer executes offline without network calls. Opt-in `AssetResolver` (`createNetworkAssetResolver()`) supported with SSRF protection, timeout, and byte limits. |

---

## Technical Limitations & Non-Goals

The following features are intentionally unsupported or limited to maintain a deterministic, lightweight server architecture:

- **Image Formats**: The built-in image pipeline supports **PNG** and **JPEG** only (detected by binary magic bytes). SVG, WebP, AVIF, GIF, and BMP are not decoded and will throw an `ImageError`.
- **Font Formats**: Custom font embedding supports TrueType (`.ttf`) and OpenType-with-TTF-outlines. WOFF and WOFF2 are not supported. Remote `@font-face` HTTP/HTTPS URLs are not supported.
- **CSS Transforms**: The `transform` property (`rotate`, `scale`, `translate`, `matrix`) is not parsed or applied. Note: `text-transform` (uppercase/lowercase) is a separate supported property.
- **`position: sticky`**: Not implemented; scroll-relative positioning is not meaningful in static PDFs.
- **Unsupported Layout**: CSS Multi-column layout (`columns`), CSS regions, and `float`/`clear` have partial or no layout effect.
- **Grid Template Areas & Subgrid**: Named `grid-template-areas`, `subgrid`, `minmax()`, `auto-fit`, and `auto-fill` are not supported.
- **Interactive Features**: JavaScript execution (`<script>`), CSS animations (`@keyframes`), hover states (`:hover`), and interactive form controls are excluded.
- **SVG & Canvas**: No built-in SVG path renderer or Canvas API.
- **Tagged PDF & Accessibility**: No `StructTreeRoot`, `MarkInfo`, or marked-content sequences are generated. The `/Lang` catalog entry is a metadata field only — its presence does not produce a tagged or PDF/UA-compliant PDF.
- **Filters & Shadows**: `filter`, `box-shadow`, and `text-shadow` are not implemented.

For a complete reference on supported properties and limitations, see the [Feature Matrix](https://github.com/surajthaqurie/html-pdf-engine/blob/main/docs/feature-matrix.md) and [Limitations](https://github.com/surajthaqurie/html-pdf-engine/blob/main/docs/limitations.md) documentation on GitHub.

---

## Performance Benchmarks

Measured using the repository benchmark suite (`npm run benchmark`) on Node.js v22 (x86_64 Linux, single process execution). Run `npm run benchmark` to reproduce:

| Workload | Iterations | Avg Time per PDF | Throughput (ops/sec) |
| :--- | ---: | ---: | ---: |
| **Simple HTML** | 100 | ~0.96 ms | ~1,038 |
| **Invoice** | 100 | ~2.71 ms | ~368 |
| **Complex Layout** | 100 | ~1.62 ms | ~618 |
| **Multi-page Report** | 50 | ~9.47 ms | ~105 |
| **Local Images** | 50 | ~1.96 ms | ~510 |
| **Large Table (100 rows)** | 20 | ~38.47 ms | ~26 |
| **Large Table (500 rows)** | 5 | ~135.47 ms | ~7 |

- **Methodology**: Measurements reflect engine execution only — HTML parsing, CSS cascade, layout box generation, paint command emission, and FlateDecode stream compression. Disk I/O and network asset fetching time are excluded.
- **Warm-up**: Initial renders are performed before measurement to allow V8 JIT optimization.
- **Determinism**: Output byte-for-byte identical across repeated executions (verified by benchmark suite).
- **Concurrency**: Linear throughput scaling observed across 1–25 concurrent renders.

### Package Footprint

- **Published Tarball Size**: ~146.5 kB packed (`npm pack --dry-run`)
- **Unpacked Size**: ~797.3 kB
- **Runtime Dependencies**: **0**

---

## Development & Test Commands

```bash
# Install development dependencies
npm install

# Run Vitest integration test suite (143 tests)
npm test

# Typecheck TypeScript codebase
npm run test:typecheck

# Compile production distribution (dist/)
npm run build

# Run local benchmark suite
npm run benchmark

# Dry-run package distribution
npm pack --dry-run
```

---

## License

[MIT](LICENSE)
