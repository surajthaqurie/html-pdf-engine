# Public API Reference: html-pdf-engine

This document outlines the public API available in `html-pdf-engine`.

## 1. Primary Methods

### `HtmlToPdf.generateBuffer(options: HtmlToPdfOptions): Promise<Buffer>`
**Purpose**: Compiles HTML and CSS into a Node.js `Buffer` containing the binary PDF output.
**Parameters**: `options` (`HtmlToPdfOptions`) - Configuration for the PDF generation.
**Return Value**: `Promise<Buffer>`
**Errors**: Throws subclasses of `PdfError` (e.g., `HtmlParseError`, `FontError`, `ImageError`).
**Example**:
```typescript
import { HtmlToPdf } from "html-pdf-engine";

const buffer = await HtmlToPdf.generateBuffer({
  html: "<h1>Hello World</h1>",
  page: "A4"
});
```

### `HtmlToPdf.generateFile(options: HtmlToFileOptions): Promise<void>`
**Purpose**: Compiles HTML and CSS and writes the PDF directly to disk.
**Parameters**: `options` (`HtmlToFileOptions`) - Configuration for the PDF generation, including output path.
**Return Value**: `Promise<void>`
**Errors**: Throws subclasses of `PdfError` or Node.js filesystem errors.
**Example**:
```typescript
await HtmlToPdf.generateFile({
  html: "<h1>Hello World</h1>",
  output: "./report.pdf"
});
```

### `HtmlToPdf.generate(options: HtmlToPdfOptions): Promise<PDFDocument>`
**Purpose**: Low-level API returning the structured `PDFDocument` instance before saving.
**Parameters**: `options` (`HtmlToPdfOptions`)
**Return Value**: `Promise<PDFDocument>`
**Errors**: Throws subclasses of `PdfError`.
**Example**:
```typescript
const doc = await HtmlToPdf.generate({ html: "<p>Content</p>" });
const buffer = doc.save();
```

## 2. Configuration Options

### `HtmlToPdfOptions`
```typescript
export interface HtmlToPdfOptions {
  html: string;
  css?: string;
  page?: PageSizeName | PageSize;
  orientation?: PageOrientation; // "portrait" | "landscape"
  margin?: { top?: number; right?: number; bottom?: number; left?: number; };
  compress?: boolean;
  header?: HeaderFooterOptions;
  footer?: HeaderFooterOptions;
  meta?: PDFMetadataOptions;
  metadata?: PDFMetadataOptions; // deprecated alias for meta
  language?: string;
  lang?: string; // alias
  viewerPreferences?: PdfViewerPreferences;
  pdfVersion?: PdfVersion; // "1.3" | "1.4" | "1.5" | "1.6" | "1.7"
  pageLabels?: PageLabelRange | PageLabelRange[];
  images?: ImageMap; // Record<string, Buffer | string | Uint8Array>
  fonts?: CustomFontMap;
  basePath?: string;
  assetResolver?: AssetResolver;
}
```

### `HtmlToFileOptions`
```typescript
export interface HtmlToFileOptions extends HtmlToPdfOptions {
  output: string;
}
```

### `PDFMetadataOptions`
```typescript
export interface PDFMetadataOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string | string[];
  creator?: string;
  producer?: string;
}
```

### `PdfViewerPreferences`
```typescript
export interface PdfViewerPreferences {
  hideToolbar?: boolean;
  hideMenubar?: boolean;
  hideWindowUI?: boolean;
  fitWindow?: boolean;
  centerWindow?: boolean;
  displayDocTitle?: boolean;
}
```

### `PageLabelRange`
```typescript
export type PageLabelStyle = "decimal" | "lowercase-roman" | "uppercase-roman" | "lowercase-letters" | "uppercase-letters";

export interface PageLabelRange {
  startPage?: number;
  style?: PageLabelStyle;
  prefix?: string;
  firstNumber?: number;
}
```

### `PageSize`
```typescript
export interface PageSize {
  width: number;
  height: number;
}
// PageSizeName allows "A4", "Letter", "Legal", etc.
```

## 3. Headers & Footers

### `HeaderFooterOptions`
```typescript
export interface HeaderFooterOptions {
  text: string | HeaderFooterTextResolver;
  align?: "left" | "center" | "right";
  fontSize?: number;
  showDividerLine?: boolean;
}
```

### `HeaderFooterTextResolver`
```typescript
export type HeaderFooterTextResolver = (pageNumber: number, totalPages: number) => string;
```

## 4. Fonts and Images

### `CustomFontMap`
```typescript
export interface CustomFontMap {
  [fontFamily: string]: {
    regular?: FontVariantSource;
    bold?: FontVariantSource;
    italic?: FontVariantSource;
    boldItalic?: FontVariantSource;
  };
}
export type FontVariantSource = string | Buffer | Uint8Array;
```

### `ImageMap`
```typescript
export interface ImageMap {
  [identifier: string]: string | Buffer | Uint8Array; // Path, Data URL, or Buffer
}
```

## 5. Asset Resolution

### `AssetResolver`
```typescript
export interface AssetResolver {
  resolve(url: string, context: AssetResolutionContext): Promise<Buffer | Uint8Array | null> | Buffer | Uint8Array | null;
}
```

### `createNetworkAssetResolver(options?: NetworkAssetResolverOptions): AssetResolver`
**Purpose**: Creates an opt-in network asset resolver with SSRF protection and resource limits.
**Parameters**: `options` (`NetworkAssetResolverOptions`)
```typescript
export interface NetworkAssetResolverOptions {
  maxSizeBytes?: number; // Default: 10 MB
  timeoutMs?: number; // Default: 5000 ms
  maxRedirects?: number; // Default: 3
  allowPrivateIPs?: boolean; // Default: false (SSRF protection)
}
```

## 6. Error Handling
All error classes extend `PdfError`.
```typescript
class PdfError extends Error {}
class FontError extends PdfError {}
class ImageError extends PdfError {}
class HtmlParseError extends PdfError {}
class CssParseError extends PdfError {}
class LayoutError extends PdfError {}
class UnsupportedFeatureError extends PdfError {}
```
