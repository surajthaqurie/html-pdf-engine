// High-level API facade
export {
  HtmlToPdf,
  type HtmlToPdfOptions,
  type HtmlToFileOptions,
} from "./core/html-to-pdf.js";

// PDF Document, Pages & Metadata
export {
  PDFDocument,
  type PDFMetadataOptions,
  type PdfViewerPreferences,
  type PdfVersion,
  type PageLabelStyle,
  type PageLabelRange,
} from "./pdf/pdf-document.js";

export {
  type PDFDestination,
} from "./layout/layout-context.js";

export {
  PDFPage,
  type PageSizeName,
  type PageOrientation,
  type PageMargins,
  type PageSize,
  STANDARD_PAGE_SIZES,
} from "./pdf/pdf-page.js";

// Dynamic Headers & Footers
export {
  type HeaderFooterOptions,
  type HeaderFooterTextResolver,
  HeaderFooterRenderer,
} from "./pdf/pdf-header-footer.js";

// Custom Fonts
export {
  FontManager,
  Font,
  type CustomFontMap,
  type FontVariantSource,
  type FontFaceRule,
} from "./fonts/font.js";

// Images & Colors
export {
  type ImageMap,
  type ParsedImageData,
} from "./pdf/pdf-image.js";

export {
  type ColorRGB,
} from "./pdf/pdf-content.js";

// Asset Strategy & Resolution
export {
  type AssetResolver,
  type AssetResolutionContext,
  type NetworkAssetResolverOptions,
  createNetworkAssetResolver,
} from "./assets/asset-resolver.js";

// Errors
export {
  PdfError,
  FontError,
  ImageError,
  HtmlParseError,
  CssParseError,
  LayoutError,
  UnsupportedFeatureError,
} from "./errors/pdf-error.js";

// Sizing, Overflow & Layout Types
export {
  type OverflowType,
  type ComputedStyle,
} from "./css/computed-style.js";

export {
  type PageRuleConfig,
  parsePageRules,
} from "./css/cascade.js";
