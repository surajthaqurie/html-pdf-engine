# Page Layout & Pagination: html-pdf-engine

This document details the multi-page pagination algorithm, page breaks, margins, and header/footer template placeholders in `html-pdf-engine`.

---

## Printable Page Geometry

Each page in `html-pdf-engine` consists of total paper dimensions and inner printable margins:

```text
┌────────────────────────────────────────────────────────┐
│                        Page Top                        │
│   ┌────────────────────────────────────────────────┐   │
│   │                 Header Area                    │   │
│   ├────────────────────────────────────────────────┤   │
│   │                                                │   │
│   │                Printable Area                  │   │
│   │                                                │   │
│   │                                                │   │
│   ├────────────────────────────────────────────────┤   │
│   │                 Footer Area                    │   │
│   └────────────────────────────────────────────────┘   │
│                       Page Bottom                      │
└────────────────────────────────────────────────────────┘
```

---

## Pagination Algorithm

1. **Content Height Tracking**:
   As block layout boxes are stacked vertically, the engine accumulates vertical height (`currentY`).
2. **Page Split Detection**:
   When adding an element or text line would exceed `pageHeight - marginBottom`, the layout engine moves to the next page index (`pageIdx++`) and resets `currentY = marginTop`.
3. **Page Breaks**:
   - `page-break-before: always`: Immediately increments `pageIdx` before laying out the element.
   - `page-break-after: always`: Forces next content onto `pageIdx + 1` after laying out the element.

---

## Table Pagination & Repeating Headers

`html-pdf-engine` features a dedicated multi-page table layout algorithm (`layoutTableBox`):

1. **Row Collection & Ordering**:
   Table rows are categorized into `headerRows` (`<thead>`), `bodyRows` (`<tbody>`), and `footerRows` (`<tfoot>`).
2. **Column Sizing & Geometry**:
   Column widths are calculated from explicit cell styles, `width` attributes, or equal auto-distribution across `tableWidth`.
3. **Header Cloning across Page Breaks**:
   When a body row (`tr`) crosses printable page bottom, the layout engine advances to the next page (`pageIdx++`), resets `currentY = marginTop`, and clones `headerRows` to the top of the new page before placing the row.
4. **Hyperlink & Image Preservation**:
   Hyperlink annotations (`<a>`), image commands, and custom TTF font usages within cloned headers are preserved with updated page coordinates.
5. **Row Avoidance (`break-inside: avoid`)**:
   Rows with `break-inside: avoid` (or `page-break-inside: avoid`) are moved to the top of the next page if they exceed current printable height.

---

## Dynamic Header & Footer Templates

Headers and footers support dynamic text replacement:

- `{{pageNumber}}`: 1-indexed page number of the active page.
- `{{totalPages}}`: Total calculated page count for the compiled document.

```typescript
const buffer = await HtmlToPdf.generateBuffer({
  html: "<p>Multi-page document...</p>",
  header: { text: "Quarterly Audit", align: "left", showDividerLine: true },
  footer: { text: "Page {{pageNumber}} of {{totalPages}}", align: "center", showDividerLine: true },
});
```

