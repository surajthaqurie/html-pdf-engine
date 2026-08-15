# CSS Support Reference

> **html-pdf-engine** targets deterministic, high-performance server-side PDF generation, **not** full browser rendering.
> This document reflects the CSS subset supported as of Phase 22.

---

## What Is Supported

### Box Model

| Property | Supported Values | Notes |
|---|---|---|
| `width` / `height` | `auto`, fixed units, `%` | Percentage relative to containing block |
| `min-width` / `max-width` | fixed units, `%`, `none`, `auto` | Across block, table-cell, flex/grid items, images |
| `min-height` / `max-height` | fixed units, `%`, `none`, `auto` | |
| `margin` / `padding` | shorthand, individual sides | `auto` for centering |
| `overflow` / `overflow-x` / `overflow-y` | `visible`, `hidden`, `auto` | `hidden` emits PDF clip path |
| `box-sizing` | _Not supported_ | Border-box model not applied |

### Typography

| Property | Supported Values |
|---|---|
| `font-size` | `px`, `pt`, `em`, `rem`, `%` |
| `font-family` | Helvetica, Times-Roman, system fonts + custom TTF via `options.fonts` |
| `font-weight` | `normal`, `bold`, numeric `100`–`900` |
| `font-style` | `normal`, `italic`, `oblique` |
| `line-height` | unitless multiplier, `px`, `pt` |
| `letter-spacing` | `normal`, `px`, `pt` |
| `word-spacing` | `normal`, `px`, `pt` |
| `text-align` | `left`, `center`, `right`, `justify` |
| `text-decoration` | `none`, `underline`, `line-through`, `overline` |
| `text-transform` | `none`, `uppercase`, `lowercase`, `capitalize` |
| `text-indent` | `px`, `pt`, `%` |
| `white-space` | `normal`, `nowrap`, `pre`, `pre-wrap`, `pre-line` |
| `vertical-align` | `baseline`, `top`, `middle`, `bottom`, numeric |
| `text-overflow` | `clip`, `ellipsis` |

### Colors & Backgrounds

| Property | Supported Values |
|---|---|
| `color` | hex (`#RGB`, `#RRGGBB`, `#RGBA`, `#RRGGBBAA`), `rgb()`, `rgba()`, `hsl()`, `hsla()`, named colors, `transparent` |
| `background-color` | All color formats above |
| `background-image` | `url("path")` for local files and base64 data URIs |
| `background-size` | `auto`, `cover`, `contain`, explicit units, `%` |
| `background-position` | `left`, `right`, `center`, `top`, `bottom` keywords |
| `background-repeat` | `repeat`, `repeat-x`, `repeat-y`, `no-repeat` |
| `background` | Shorthand parsing (`color`, `url()`, `position`, `size`, `repeat`) |

### Borders

| Property | Supported |
|---|---|
| `border` shorthand | ✅ |
| `border-top/right/bottom/left` | ✅ Individual sides |
| `border-width` / `border-color` / `border-style` | ✅ |
| `border-radius` | ✅ All corners, shorthand + individual |
| Border styles | `solid`, `dashed`, `dotted`, `none` |

### Layout Models

#### Block & Inline
- `display: block`, `display: inline`
- Standard block formatting context, inline text wrapping

#### Flexbox (`display: flex` / `inline-flex`)

| Property | Supported |
|---|---|
| `flex-direction` | `row`, `column`, `row-reverse`, `column-reverse` |
| `flex-wrap` | `nowrap`, `wrap`, `wrap-reverse` |
| `flex-flow` | Shorthand |
| `justify-content` | `flex-start`, `center`, `flex-end`, `space-between`, `space-around`, `space-evenly` |
| `align-items` | `flex-start`, `center`, `flex-end`, `stretch`, `baseline` |
| `gap` / `row-gap` / `column-gap` | All units |
| `flex-grow` / `flex-shrink` / `flex-basis` | ✅ |
| `flex` | Shorthand |
| `align-self` / `justify-self` | ✅ |

#### CSS Grid (`display: grid` / `inline-grid`)

| Property | Supported |
|---|---|
| `grid-template-columns` / `grid-template-rows` | Fixed, `%`, `fr`, `auto`, `repeat(count, track)` |
| `grid-column` / `grid-row` | Explicit index + `span N` |
| `gap` / `row-gap` / `column-gap` | ✅ |
| `justify-items` / `align-items` | `start`, `center`, `end`, `stretch` |
| `justify-self` / `align-self` | ✅ |

#### Tables

| Element | Supported |
|---|---|
| `table`, `thead`, `tbody`, `tfoot` | ✅ |
| `tr`, `th`, `td` | ✅ |
| `colspan` | ✅ |
| `thead` repeating on page breaks | ✅ |
| `break-inside: avoid` on `tr` | ✅ |
| `border-collapse` | Visual equivalent |

#### Lists
- `ul`, `ol`, `li` with standard bullet/numbered layout

### CSS Positioning

| Value | Behavior |
|---|---|
| `position: static` | Default normal flow |
| `position: relative` | Normal flow position with visual offset via `top/right/bottom/left` |
| `position: absolute` | Removed from flow, positioned relative to nearest positioned ancestor |
| `position: fixed` | **Phase 22**: Removed from flow; rendered on **every page** (suitable for repeating headers/footers/watermarks) |
| `z-index` | **Phase 22**: Paint-order sorting across all commands per page |
| `float: left/right` | Parsed and stored; **not used in layout** (see Limitations) |
| `clear` | Parsed and stored; **not used in layout** |

### CSS Fragmentation (Page Breaks)

| Property | Values |
|---|---|
| `break-before` / `page-break-before` | `auto`, `page` / `always` |
| `break-after` / `page-break-after` | `auto`, `page` / `always` |
| `break-inside` / `page-break-inside` | `auto`, `avoid` |

### CSS Custom Properties (Variables) — Phase 22

```css
:root {
  --primary-color: #0284c7;
  --font-size-body: 11pt;
}

h1 { color: var(--primary-color); }
p { font-size: var(--font-size-body); }

/* Fallback value */
.card { background-color: var(--missing, #f8fafc); }
```

- ✅ `--custom-property` declaration and `var()` resolution
- ✅ Nested variable references (`--a: var(--b)`)
- ✅ Fallback values `var(--name, fallback)`
- ✅ Declarations in `:root`, `*`, `html`, `body`
- ✅ Cycle detection (recursive references terminate safely)
- ✅ Inheritance through DOM hierarchy (child elements receive parent's variables)

### Media Queries — Phase 22

```css
/* Supported */
@media print { ... }           /* Always applied to PDF */
@media all { ... }             /* Always applied */
@media (min-width: 400pt) { ... }
@media (max-width: 700pt) { ... }

/* Not applied */
@media screen { ... }
@media speech { ... }
```

| Query Type | Support |
|---|---|
| `print` | ✅ Always applied |
| `all` | ✅ Always applied |
| `screen` | ❌ Never applied |
| `(min-width: X)` | ✅ Evaluated against page content width |
| `(max-width: X)` | ✅ Evaluated against page content width |
| `(prefers-color-scheme)` | ❌ Not supported |
| `(orientation)` | ❌ Not supported |

### Pseudo-classes & Selectors

| Selector | Support |
|---|---|
| `*` | ✅ Universal |
| `tag` | ✅ Element type |
| `.class` | ✅ Class |
| `#id` | ✅ ID |
| `tag.class` | ✅ Compound |
| `parent child` | ✅ Descendant |
| `:root` | ✅ Matches `html` element |
| `:hover`, `:focus`, `:active` | ⚠️ Rule applied as static (no interaction in PDF) |
| `:first-child`, `:nth-child()` | ⚠️ Pseudo-class stripped; selector base matched |
| `::before`, `::after` | ❌ No generated content |
| `+`, `~`, `>` combinators | ❌ Not supported |

### `@page` At-Rules

```css
@page {
  size: A4 landscape;
  margin: 20pt 30pt;
}
```

Supported: `size` (named + dimensions + orientation), `margin` sides.

### Visibility

| Property | Values |
|---|---|
| `visibility` | `visible`, `hidden` |
| `display: none` | ✅ Element and subtree excluded from layout |
| `opacity` | ❌ Not supported |

---

## What Is NOT Supported

These features are **intentionally excluded** to preserve zero-dependency, deterministic server rendering:

| Feature | Status |
|---|---|
| `float: left/right` layout | ❌ Parsed but not applied to layout |
| `clear` | ❌ Parsed but not applied |
| `position: sticky` | ❌ Not supported |
| CSS Transforms (`rotate`, `scale`, `translate`) | ❌ Not supported |
| CSS Animations & Transitions (`@keyframes`, `transition`) | ❌ Ignored |
| `grid-template-areas` / `minmax()` / `auto-fit` / `auto-fill` / `subgrid` | ❌ Not supported |
| `columns` (CSS Multi-column Layout) | ❌ Not supported |
| `clip-path`, `mask` | ❌ Not supported |
| `filter`, `backdrop-filter` | ❌ Not supported |
| CSS `calc()` expressions | ❌ Not supported |
| `env()`, `attr()` expressions | ❌ Not supported |
| `@import` (external stylesheets) | ❌ Not supported |
| Remote `@font-face` URLs | ❌ Blocked (pass fonts via `options.fonts`) |
| Remote image URLs | ❌ Blocked by default (use `options.assetResolver`) |
| JavaScript execution (`<script>`) | ❌ Stripped for security |
| SVG rendering | ❌ Not supported |
| `<canvas>` | ❌ Not supported |
| `<video>`, `<audio>` | ❌ Not supported |

---

## Asset Handling

### Remote Assets via AssetResolver (Phase 22)

`html-pdf-engine` does not automatically fetch remote resources, but exposes an opt-in `AssetResolver` interface for controlled access:

```typescript
import {
  HtmlToPdf,
  createNetworkAssetResolver,
} from "html-pdf-engine";

const resolver = createNetworkAssetResolver({
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB limit
  timeoutMs: 3000,
  maxRedirects: 3,
  allowPrivateIPs: false,       // SSRF protection (default)
});

const pdf = await HtmlToPdf.generateBuffer({
  html: `<img src="https://cdn.example.com/logo.png" />`,
  assetResolver: resolver,
});
```

**Security**: `createNetworkAssetResolver` blocks private IP ranges (127.0.0.1, 10.x.x.x, 192.168.x.x, 169.254.x.x) by default to prevent SSRF attacks.

---

## Comparison vs Browser Engines

| Capability | html-pdf-engine | Puppeteer/Playwright |
|---|---|---|
| JavaScript execution | ❌ | ✅ |
| Full CSS cascade | Subset | ✅ |
| Web fonts from CDN | ❌ (opt-in resolver) | ✅ |
| Pixel-perfect render | ❌ | ✅ |
| Runtime dependencies | **0** | Chromium (~200 MB) |
| Render speed | **~0.4–1.3 ms** | 100–800 ms |
| Deterministic output | **✅ Byte-identical** | ❌ Varies |
| Server footprint | **< 1 MB** | 200+ MB |
| Thread safety | **✅** | ❌ Requires process isolation |
