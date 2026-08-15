# Engine Architecture Overview: html-pdf-engine

`html-pdf-engine` operates as a deterministic, pure TypeScript compiler pipeline that converts HTML and CSS markup directly into binary PDF (v1.7) documents without relying on headless browsers or native platform subprocesses.

---

## Compiler Pipeline Flow

```text
               HTML & CSS Input String
                         │
                         ▼
        ┌──────────────────────────────────┐
        │        1. HTML Tokenizer         │
        └──────────────────────────────────┘
                         │ (HTMLToken Stream)
                         ▼
        ┌──────────────────────────────────┐
        │         2. DOM Parser            │
        └──────────────────────────────────┘
                         │ (DocumentNode & ElementNode Tree)
                         ▼
        ┌──────────────────────────────────┐
        │    3. CSS Parser & Specificity   │
        └──────────────────────────────────┘
                         │ (CSSRule Declarations & Vectors)
                         ▼
        ┌──────────────────────────────────┐
        │        4. Cascade Engine         │
        └──────────────────────────────────┘
                         │ (ComputedStyle per Element)
                         ▼
        ┌──────────────────────────────────┐
        │         5. Layout Engine         │
        └──────────────────────────────────┘
                         │ (LayoutBox Tree & Multi-Page Pagination)
                         ▼
        ┌──────────────────────────────────┐
        │          6. Paint Engine         │
        └──────────────────────────────────┘
                         │ (Graphics Paint Commands)
                         ▼
        ┌──────────────────────────────────┐
        │     7. PDF Document Serializer   │
        └──────────────────────────────────┘
                         │ (FlateDecode Stream Compression)
                         ▼
             Node.js Binary Buffer / PDF File
```

---

## Pipeline Stage Breakdown

### Stage 1: HTML Tokenizer (`src/html/tokenizer.ts`)
- Scans raw string input character-by-character.
- Emits tokens: `StartTag`, `EndTag`, `Text`, `Comment`.
- Handles character entity decoding (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`).

### Stage 2: DOM Parser (`src/html/parser.ts`)
- Constructs an in-memory document object model (`DocumentNode`, `ElementNode`, `TextNode`, `CommentNode`).
- Features auto-recovery for unclosed or malformed tags.

### Stage 3: CSS Parser & Specificity (`src/css/parser.ts`, `src/css/specificity.ts`)
- Parses stylesheet rules from external CSS strings and inline `<style>` tags.
- Calculates 4-vector specificity `[Inline, ID, Class, Tag]` for every selector.

### Stage 4: Cascade Engine (`src/css/cascade.ts`)
- Resolves computed styles for each node by cascading:
  1. User-Agent element defaults (`display`, `margin`, `font-size`)
  2. Matching stylesheet rules (sorted by specificity)
  3. Inline `style="..."` attribute overrides
  4. Inherited properties from parent nodes (`font-family`, `color`, `line-height`)

### Stage 5: Layout Engine (`src/layout/layout-engine.ts`)
- Computes element box geometry (`contentWidth`, `contentHeight`, `margins`, `paddings`, `borders`).
- Performs inline text line-wrapping using exact font glyph widths.
- Splits content across printable page heights and applies `page-break-before/after`.

### Stage 6: Paint Engine (`src/paint/paint-engine.ts`)
- Translates layout boxes into vector graphics painting commands (text positioning, fill rects, stroke borders).

### Stage 7: PDF Serializer (`src/pdf/pdf-document.ts`, `src/pdf/pdf-stream.ts`)
- Encodes page operations into standard PDF 1.7 content streams.
- Applies `zlib` FlateDecode stream compression.
- Assembles PDF Catalog, Pages tree, Font dictionaries, XRef cross-reference table, and Trailer.
