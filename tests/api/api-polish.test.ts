import { describe, it, expect } from "vitest";
import {
  HtmlToPdf,
  PDFDocument,
  PDFPage,
  PdfError,
  FontError,
  ImageError,
  HtmlParseError,
  CssParseError,
  LayoutError,
  UnsupportedFeatureError,
  FontManager,
  Font,
  HeaderFooterRenderer,
  STANDARD_PAGE_SIZES,
  type HtmlToPdfOptions,
  type HtmlToFileOptions,
  type PDFMetadataOptions,
  type CustomFontMap,
  type FontVariantSource,
  type ImageMap,
  type ParsedImageData,
  type ColorRGB,
  type HeaderFooterOptions,
  type HeaderFooterTextResolver,
  type PageSizeName,
  type PageOrientation,
  type PageMargins,
  type PageSize,
} from "../../src/index.js";

describe("Phase 6 — API Polish & Error Handling Suite", () => {
  describe("1. Public API & Root Exports", () => {
    it("exports HtmlToPdf and error classes from package root", () => {
      expect(HtmlToPdf).toBeDefined();
      expect(typeof HtmlToPdf.generateBuffer).toBe("function");
      expect(PdfError).toBeDefined();
      expect(FontError).toBeDefined();
      expect(ImageError).toBeDefined();
      expect(HtmlParseError).toBeDefined();
      expect(CssParseError).toBeDefined();
      expect(LayoutError).toBeDefined();
      expect(UnsupportedFeatureError).toBeDefined();
      expect(PDFDocument).toBeDefined();
      expect(PDFPage).toBeDefined();
      expect(FontManager).toBeDefined();
      expect(Font).toBeDefined();
      expect(HeaderFooterRenderer).toBeDefined();
      expect(STANDARD_PAGE_SIZES).toBeDefined();
    });

    it("ensures all custom library errors inherit from PdfError base class", () => {
      const imgErr = new ImageError("Test image error");
      const fontErr = new FontError("Test font error");
      const htmlErr = new HtmlParseError("Test html error");
      const cssErr = new CssParseError("Test css error");
      const layoutErr = new LayoutError("Test layout error");
      const unsuppErr = new UnsupportedFeatureError("Test feature");

      expect(imgErr).toBeInstanceOf(PdfError);
      expect(fontErr).toBeInstanceOf(PdfError);
      expect(htmlErr).toBeInstanceOf(PdfError);
      expect(cssErr).toBeInstanceOf(PdfError);
      expect(layoutErr).toBeInstanceOf(PdfError);
      expect(unsuppErr).toBeInstanceOf(PdfError);
    });

    it("allows typescript consumers to type options, fonts, images, and resolvers using root exports", async () => {
      const metadata: PDFMetadataOptions = {
        title: "Consumer Test Invoice",
        author: "Acme Corp",
      };

      const fontVariant: FontVariantSource = {
        regular: Buffer.from("dummy-font-buffer"),
      };

      const customFonts: CustomFontMap = {
        DummyFont: fontVariant,
      };

      const imagesMap: ImageMap = {
        "logo.png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      };

      const pageColor: ColorRGB = { r: 0.1, g: 0.2, b: 0.3 };
      const resolver: HeaderFooterTextResolver = (page, total) => `Page ${page} of ${total}`;

      const headerOpts: HeaderFooterOptions = {
        text: resolver,
        color: pageColor,
      };

      const pageSizeName: PageSizeName = "A4";
      const orientation: PageOrientation = "portrait";

      const options: HtmlToPdfOptions = {
        html: "<h1>Type Export Test</h1>",
        meta: metadata,
        images: imagesMap,
        header: headerOpts,
        page: pageSizeName,
        orientation,
      };

      const doc: PDFDocument = await HtmlToPdf.generate(options);
      const pages: PDFPage[] = doc.getPages();

      expect(doc).toBeInstanceOf(PDFDocument);
      expect(pages.length).toBe(1);
      expect(pages[0]).toBeInstanceOf(PDFPage);
    });
  });

  describe("2. PDF Metadata Options & Backward Compatibility", () => {
    it("serializes PDF metadata into Info dictionary using primary meta option", async () => {
      const metaOptions: PDFMetadataOptions = {
        title: "Q3 Financial Invoice",
        author: "Acme Accounting Corp",
        subject: "Billing Statement",
        keywords: "invoice,finance,2026",
        creator: "Enterprise Invoice App",
      };

      const options: HtmlToPdfOptions = {
        html: "<h1>Invoice Document</h1>",
        compress: false,
        meta: metaOptions,
      };

      const buffer = await HtmlToPdf.generateBuffer(options);
      const pdfStr = buffer.toString("latin1");

      expect(pdfStr).toContain("/Title (Q3 Financial Invoice)");
      expect(pdfStr).toContain("/Author (Acme Accounting Corp)");
      expect(pdfStr).toContain("/Subject (Billing Statement)");
      expect(pdfStr).toContain("/Keywords (invoice,finance,2026)");
      expect(pdfStr).toContain("/Creator (Enterprise Invoice App)");
      expect(pdfStr).toContain("/Producer (html-pdf-engine)");
    });

    it("supports backward-compatible metadata option alias", async () => {
      const buffer = await HtmlToPdf.generateBuffer({
        html: "<h1>Legacy Options Document</h1>",
        compress: false,
        metadata: {
          title: "Legacy Title",
          author: "Legacy Author",
        },
      });

      const pdfStr = buffer.toString("latin1");
      expect(pdfStr).toContain("/Title (Legacy Title)");
      expect(pdfStr).toContain("/Author (Legacy Author)");
    });

    it("generates valid PDF documents when metadata is omitted", async () => {
      const buffer = await HtmlToPdf.generateBuffer({
        html: "<h1>No Metadata Document</h1>",
        compress: false,
      });

      const pdfStr = buffer.toString("latin1");
      expect(pdfStr).toContain("%PDF-1.7");
      expect(pdfStr).toContain("/Type /Catalog");
      expect(pdfStr).not.toContain("/Title");
    });
  });

  describe("3. Image Validation & Error Handling", () => {
    it("throws ImageError for unsupported image formats", async () => {
      const invalidBuffer = Buffer.from("THIS_IS_NOT_AN_IMAGE_FILE");

      await expect(
        HtmlToPdf.generateBuffer({
          html: '<img src="test.bmp" />',
          images: { "test.bmp": invalidBuffer },
        }),
      ).rejects.toThrow(ImageError);
    });

    it("throws ImageError for empty image buffers", async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        HtmlToPdf.generateBuffer({
          html: '<img src="empty.png" />',
          images: { "empty.png": emptyBuffer },
        }),
      ).rejects.toThrow(/empty buffer/i);
    });

    it("throws ImageError for malformed base64 Data URLs", async () => {
      await expect(
        HtmlToPdf.generateBuffer({
          html: '<img src="data:image/png;base64," />',
        }),
      ).rejects.toThrow(ImageError);
    });

    it("throws ImageError for malformed PNG header structure", async () => {
      // Valid PNG magic bytes followed by truncated header
      const malformedPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
      ]);

      await expect(
        HtmlToPdf.generateBuffer({
          html: '<img src="corrupt.png" />',
          images: { "corrupt.png": malformedPng },
        }),
      ).rejects.toThrow(ImageError);
    });

    it("throws ImageError for malformed JPEG missing SOF marker", async () => {
      // Valid JPEG SOI marker followed by garbage
      const malformedJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

      await expect(
        HtmlToPdf.generateBuffer({
          html: '<img src="corrupt.jpg" />',
          images: { "corrupt.jpg": malformedJpeg },
        }),
      ).rejects.toThrow(/missing SOF marker|corrupt/i);
    });

    it("throws ImageError for missing or unreadable local image files", async () => {
      await expect(
        HtmlToPdf.generateBuffer({
          html: '<img src="non_existent_file_path_12345.png" />',
        }),
      ).rejects.toThrow(ImageError);
    });
  });

  describe("4. Font Validation & Error Handling", () => {
    it("throws FontError for missing TTF files", async () => {
      await expect(
        HtmlToPdf.generateBuffer({
          html: '<p style="font-family: MissingFont;">Text</p>',
          fonts: {
            MissingFont: {
              regular: "/non/existent/path/font.ttf",
            },
          },
        }),
      ).rejects.toThrow(FontError);
    });

    it("throws FontError for empty font Buffers", async () => {
      await expect(
        HtmlToPdf.generateBuffer({
          html: '<p style="font-family: EmptyFont;">Text</p>',
          fonts: {
            EmptyFont: {
              regular: Buffer.alloc(0),
            },
          },
        }),
      ).rejects.toThrow(FontError);
    });

    it("throws FontError for corrupt or invalid TTF data", async () => {
      const corruptTTF = Buffer.from("INVALID_TTF_FONT_FILE_HEADER_DATA");

      await expect(
        HtmlToPdf.generateBuffer({
          html: '<p style="font-family: CorruptFont;">Text</p>',
          fonts: {
            CorruptFont: {
              regular: corruptTTF,
            },
          },
        }),
      ).rejects.toThrow(FontError);
    });
  });
});
