import { LayoutBox, TextLine } from "../layout/layout-box.js";
import { PaintCommand, BorderRadiusConfig } from "./paint-command.js";
import { PDFDocument } from "../pdf/pdf-document.js";
import {
  PageSizeName,
  PageOrientation,
  PageMargins,
  PageSize,
} from "../pdf/pdf-page.js";
import { ColorRGB } from "../pdf/pdf-content.js";
import { FontManager } from "../fonts/font.js";
import { ComputedStyle } from "../css/computed-style.js";

/**
 * Traverses a LayoutBox subtree and collects all text lines with their associated styles.
 *
 * This is used for link annotation emission: an `<a>` element may have inline children
 * whose text lines are distributed across the child boxes. To emit correct per-line
 * link annotations (supporting wrapped text), we collect all descendant text lines
 * and measure each individually.
 */
function collectSubtreeTextLines(
  box: LayoutBox,
): { line: TextLine; style: ComputedStyle }[] {
  const result: { line: TextLine; style: ComputedStyle }[] = [];
  if (box.textLines && box.textLines.length > 0) {
    for (const line of box.textLines) {
      result.push({ line, style: box.style });
    }
  }
  for (const child of box.children) {
    result.push(...collectSubtreeTextLines(child));
  }
  return result;
}

/**
 * PaintEngine converts a LayoutBox tree into an ordered list of PaintCommands,
 * then rasterizes those commands onto PDFPage objects.
 *
 * Rendering pipeline:
 *   1. `generatePaintCommands(rootBoxes)` — tree traversal emitting typed paint commands.
 *   2. `render(doc, commands, ...)` — command dispatch onto PDFPage drawing primitives.
 *
 * position: fixed semantics:
 *   Unlike browsers where `position: fixed` is relative to the viewport (which scrolls),
 *   in PDF there is no scrollable viewport. "Fixed" in this engine means the element is
 *   painted on EVERY page of the document at the same coordinates. This matches the
 *   expected use case (repeating headers, footers, watermarks, page numbers overlaid on
 *   all pages). Fixed commands are emitted once and then expanded across all pages by
 *   the render() method.
 *
 * z-index stacking:
 *   Each page's paint commands are sorted ascending by z-index before rendering.
 *   `z-index: auto` is treated as 0 for sorting. Only integer z-index values affect
 *   paint order. CSS stacking contexts (which require understanding of position + z-index
 *   combinations) are not fully implemented — only the numeric sort is applied.
 *   The sort is stable within equal z-index values.
 *
 * Link annotation emission:
 *   PDF link annotations are rectangular areas. For wrapped inline links, each text line
 *   gets its own annotation rectangle (measured with font metrics). Container-style links
 *   (e.g., `<a>` wrapping a block or image) emit a single annotation covering the box.
 */
export class PaintEngine {
  private fontManager: FontManager;

  constructor(fontManager?: FontManager) {
    this.fontManager = fontManager ?? new FontManager();
  }

  generatePaintCommands(rootBoxes: LayoutBox[]): PaintCommand[] {
    const commands: PaintCommand[] = [];

    for (const box of rootBoxes) {
      this.traverseAndPaint(box, commands);
    }

    return commands;
  }

  private traverseAndPaint(box: LayoutBox, commands: PaintCommand[]): void {
    const pageIndex = box.pageIndex;
    const zIndex = box.style.zIndex;
    const isFixed = box.style.position === "fixed";

    const isClipped =
      (box.style.overflow === "hidden" ||
        box.style.overflowX === "hidden" ||
        box.style.overflowY === "hidden") &&
      box.width > 0 &&
      box.height > 0;

    const radii: BorderRadiusConfig | undefined =
      box.style.borderTopLeftRadius > 0 ||
      box.style.borderTopRightRadius > 0 ||
      box.style.borderBottomRightRadius > 0 ||
      box.style.borderBottomLeftRadius > 0
        ? {
            topLeft: box.style.borderTopLeftRadius,
            topRight: box.style.borderTopRightRadius,
            bottomRight: box.style.borderBottomRightRadius,
            bottomLeft: box.style.borderBottomLeftRadius,
          }
        : undefined;

    if (isClipped) {
      const dim = box.dimensions;
      const bLeft = dim ? dim.border.left : 0;
      const bTop = dim ? dim.border.top : 0;
      const bRight = dim ? dim.border.right : 0;
      const bBottom = dim ? dim.border.bottom : 0;

      const clipX = box.x + bLeft;
      const clipY = box.y + bTop;
      const clipW = Math.max(0, box.width - bLeft - bRight);
      const clipH = Math.max(0, box.height - bTop - bBottom);

      commands.push({
        type: "clipStart",
        x: clipX,
        y: clipY,
        width: clipW,
        height: clipH,
        borderRadius: radii,
        pageIndex,
        zIndex,
        isFixed,
      });
    }

    // 1. Draw Background Color if present
    if (
      box.style.backgroundColor &&
      box.style.backgroundColor.a !== 0 &&
      box.width > 0 &&
      box.height > 0
    ) {
      commands.push({
        type: "rectangle",
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        fillColor: box.style.backgroundColor,
        borderRadius: radii,
        pageIndex,
        zIndex,
        isFixed,
      });
    }

    // 1b. Draw Background Image if present
    if (box.bgImageInfo && box.width > 0 && box.height > 0) {
      const img = box.bgImageInfo.imageData;
      let tileW = img.width;
      let tileH = img.height;

      const sizeStr = box.style.backgroundSize.trim().toLowerCase();
      if (sizeStr === "cover" || sizeStr === "contain") {
        const scale =
          sizeStr === "cover"
            ? Math.max(box.width / img.width, box.height / img.height)
            : Math.min(box.width / img.width, box.height / img.height);
        tileW = img.width * scale;
        tileH = img.height * scale;
      } else if (sizeStr.includes(" ")) {
        const parts = sizeStr.split(/\s+/);
        if (parts[0] && parts[0] !== "auto") {
          tileW = parts[0].endsWith("%")
            ? (parseFloat(parts[0]) / 100) * box.width
            : parseFloat(parts[0]);
        }
        if (parts[1] && parts[1] !== "auto") {
          tileH = parts[1].endsWith("%")
            ? (parseFloat(parts[1]) / 100) * box.height
            : parseFloat(parts[1]);
        }
      }

      let startX = box.x;
      let startY = box.y;
      const posStr = box.style.backgroundPosition.trim().toLowerCase();
      if (posStr.includes("center")) {
        startX = box.x + (box.width - tileW) / 2;
        startY = box.y + (box.height - tileH) / 2;
      } else if (posStr.includes("right")) {
        startX = box.x + box.width - tileW;
      } else if (posStr.includes("bottom")) {
        startY = box.y + box.height - tileH;
      }

      const repeat = box.style.backgroundRepeat;
      if (repeat === "no-repeat") {
        commands.push({
          type: "image",
          imageData: img,
          x: startX,
          y: startY,
          width: tileW,
          height: tileH,
          pageIndex,
          zIndex,
          isFixed,
        });
      } else if (repeat === "repeat-x") {
        for (let x = startX; x < box.x + box.width; x += tileW) {
          const w = Math.min(tileW, box.x + box.width - x);
          commands.push({
            type: "image",
            imageData: img,
            x,
            y: startY,
            width: w,
            height: tileH,
            pageIndex,
            zIndex,
            isFixed,
          });
        }
      } else if (repeat === "repeat-y") {
        for (let y = startY; y < box.y + box.height; y += tileH) {
          const h = Math.min(tileH, box.y + box.height - y);
          commands.push({
            type: "image",
            imageData: img,
            x: startX,
            y,
            width: tileW,
            height: h,
            pageIndex,
            zIndex,
            isFixed,
          });
        }
      } else {
        for (let y = startY; y < box.y + box.height; y += tileH) {
          for (let x = startX; x < box.x + box.width; x += tileW) {
            const w = Math.min(tileW, box.x + box.width - x);
            const h = Math.min(tileH, box.y + box.height - y);
            commands.push({
              type: "image",
              imageData: img,
              x,
              y,
              width: w,
              height: h,
              pageIndex,
              zIndex,
              isFixed,
            });
          }
        }
      }
    }

    // 2. Draw Borders if present
    const hasBorderTop =
      box.style.borderTopWidth > 0 && box.style.borderTopStyle !== "none";
    const hasBorderRight =
      box.style.borderRightWidth > 0 && box.style.borderRightStyle !== "none";
    const hasBorderBottom =
      box.style.borderBottomWidth > 0 && box.style.borderBottomStyle !== "none";
    const hasBorderLeft =
      box.style.borderLeftWidth > 0 && box.style.borderLeftStyle !== "none";

    const sameWidth =
      box.style.borderTopWidth === box.style.borderRightWidth &&
      box.style.borderTopWidth === box.style.borderBottomWidth &&
      box.style.borderTopWidth === box.style.borderLeftWidth;

    const sameColor =
      box.style.borderTopColor.r === box.style.borderRightColor.r &&
      box.style.borderTopColor.g === box.style.borderRightColor.g &&
      box.style.borderTopColor.b === box.style.borderRightColor.b &&
      box.style.borderTopColor.a === box.style.borderRightColor.a &&
      box.style.borderTopColor.r === box.style.borderBottomColor.r &&
      box.style.borderTopColor.g === box.style.borderBottomColor.g &&
      box.style.borderTopColor.b === box.style.borderBottomColor.b &&
      box.style.borderTopColor.a === box.style.borderBottomColor.a &&
      box.style.borderTopColor.r === box.style.borderLeftColor.r &&
      box.style.borderTopColor.g === box.style.borderLeftColor.g &&
      box.style.borderTopColor.b === box.style.borderLeftColor.b &&
      box.style.borderTopColor.a === box.style.borderLeftColor.a;

    const sameStyle =
      box.style.borderTopStyle === box.style.borderRightStyle &&
      box.style.borderTopStyle === box.style.borderBottomStyle &&
      box.style.borderTopStyle === box.style.borderLeftStyle;

    if (
      hasBorderTop &&
      hasBorderRight &&
      hasBorderBottom &&
      hasBorderLeft &&
      sameWidth &&
      sameColor &&
      sameStyle &&
      box.style.borderTopStyle === "solid"
    ) {
      commands.push({
        type: "rectangle",
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        strokeColor: box.style.borderTopColor,
        lineWidth: box.style.borderTopWidth,
        borderRadius: radii,
        pageIndex,
        zIndex,
        isFixed,
      });
    } else {
      if (hasBorderTop) {
        commands.push({
          type: "line",
          x1: box.x,
          y1: box.y,
          x2: box.x + box.width,
          y2: box.y,
          strokeColor: box.style.borderTopColor,
          lineWidth: box.style.borderTopWidth,
          lineStyle: box.style.borderTopStyle as any,
          pageIndex,
          zIndex,
          isFixed,
        });
      }
      if (hasBorderRight) {
        commands.push({
          type: "line",
          x1: box.x + box.width,
          y1: box.y,
          x2: box.x + box.width,
          y2: box.y + box.height,
          strokeColor: box.style.borderRightColor,
          lineWidth: box.style.borderRightWidth,
          lineStyle: box.style.borderRightStyle as any,
          pageIndex,
          zIndex,
          isFixed,
        });
      }
      if (hasBorderBottom) {
        commands.push({
          type: "line",
          x1: box.x,
          y1: box.y + box.height,
          x2: box.x + box.width,
          y2: box.y + box.height,
          strokeColor: box.style.borderBottomColor,
          lineWidth: box.style.borderBottomWidth,
          lineStyle: box.style.borderBottomStyle as any,
          pageIndex,
          zIndex,
          isFixed,
        });
      }
      if (hasBorderLeft) {
        commands.push({
          type: "line",
          x1: box.x,
          y1: box.y,
          x2: box.x,
          y2: box.y + box.height,
          strokeColor: box.style.borderLeftColor,
          lineWidth: box.style.borderLeftWidth,
          lineStyle: box.style.borderLeftStyle as any,
          pageIndex,
          zIndex,
          isFixed,
        });
      }
    }

    // 3. Draw Image Content if present
    if (box.imageInfo) {
      commands.push({
        type: "image",
        imageData: box.imageInfo.imageData,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        pageIndex,
        zIndex,
        isFixed,
      });
    }

    // 4. Draw Text Lines if present
    if (box.textLines && box.textLines.length > 0) {
      for (const line of box.textLines) {
        const linePageIndex = isFixed ? pageIndex : line.pageIndex;
        commands.push({
          type: "text",
          text: line.text,
          x: line.x,
          y: line.y,
          fontAlias: box.style.fontFamily,
          fontName: box.style.fontFamily,
          fontWeight: box.style.fontWeight,
          fontStyle: box.style.fontStyle,
          fontSize: box.style.fontSize,
          color: box.style.color,
          letterSpacing: box.style.letterSpacing,
          wordSpacing: box.style.wordSpacing,
          textDecoration: box.style.textDecoration,
          pageIndex: linePageIndex,
          zIndex,
          isFixed,
        });
      }
    }

    // 5. Draw Hyperlinks if this box is an <a> element with linkUrl
    if (
      box.linkUrl &&
      box.node &&
      "tagName" in box.node &&
      (box.node as any).tagName === "a" &&
      box.width > 0 &&
      box.height > 0
    ) {
      const subtreeLines = collectSubtreeTextLines(box);
      if (subtreeLines.length > 0) {
        for (const item of subtreeLines) {
          const l = item.line;
          const fontObj = this.fontManager.resolveFont(
            item.style.fontFamily,
            item.style.fontWeight,
            item.style.fontStyle,
          );
          const textW = fontObj.measureTextWidth(
            l.text,
            item.style.fontSize,
            item.style.letterSpacing || 0,
            item.style.wordSpacing || 0,
          );
          const lineH = item.style.fontSize * item.style.lineHeight;
          const linePageIndex = isFixed ? pageIndex : l.pageIndex;
          commands.push({
            type: "link",
            url: box.linkUrl,
            x: l.x,
            y: l.y,
            width: textW,
            height: lineH,
            pageIndex: linePageIndex,
            zIndex,
            isFixed,
          });
        }
      } else {
        commands.push({
          type: "link",
          url: box.linkUrl,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          pageIndex,
          zIndex,
          isFixed,
        });
      }
    }

    // 6. Recursively paint children
    for (const child of box.children) {
      this.traverseAndPaint(child, commands);
    }

    if (isClipped) {
      commands.push({
        type: "clipEnd",
        pageIndex,
        zIndex,
        isFixed,
      });
    }
  }

  renderToPdf(
    doc: PDFDocument,
    commands: PaintCommand[],
    pageSize: PageSizeName | PageSize = "A4",
    orientation: PageOrientation = "portrait",
    margins: PageMargins = { top: 36, right: 36, bottom: 36, left: 36 },
  ): void {
    this.render(doc, commands, pageSize, orientation, margins);
  }

  render(
    doc: PDFDocument,
    commands: PaintCommand[],
    pageSize: PageSizeName | PageSize = "A4",
    orientation: PageOrientation = "portrait",
    margins: PageMargins = { top: 36, right: 36, bottom: 36, left: 36 },
  ): void {
    const maxPageIndex = Math.max(
      ...commands.filter((c) => !c.isFixed).map((c) => c.pageIndex),
      0,
    );

    while (doc.getPages().length <= maxPageIndex) {
      doc.addPage(pageSize, orientation, margins);
    }

    const totalPagesCount = doc.getPages().length;

    // Expand position: fixed commands across all pages
    const expandedCommands: PaintCommand[] = [];
    for (const cmd of commands) {
      if (cmd.isFixed) {
        for (let p = 0; p < totalPagesCount; p++) {
          expandedCommands.push({ ...cmd, pageIndex: p });
        }
      } else {
        expandedCommands.push(cmd);
      }
    }

    // Group commands by pageIndex
    const pageCommandsMap = new Map<number, PaintCommand[]>();
    for (const cmd of expandedCommands) {
      let list = pageCommandsMap.get(cmd.pageIndex);
      if (!list) {
        list = [];
        pageCommandsMap.set(cmd.pageIndex, list);
      }
      list.push(cmd);
    }

    const pages = doc.getPages();

    for (let pIndex = 0; pIndex < pages.length; pIndex++) {
      const page = pages[pIndex];
      if (!page) continue;

      const pageCmds = pageCommandsMap.get(pIndex) ?? [];

      // Sort page commands by zIndex ascending (z-index: auto treated as 0)
      pageCmds.sort((a, b) => {
        const zA = typeof a.zIndex === "number" ? a.zIndex : 0;
        const zB = typeof b.zIndex === "number" ? b.zIndex : 0;
        return zA - zB;
      });

      for (const cmd of pageCmds) {
        if (cmd.type === "text") {
          const fontName = cmd.fontName ?? "Helvetica";
          const font = this.fontManager.resolveFont(
            fontName,
            cmd.fontWeight,
            cmd.fontStyle,
          );
          const alias = doc.addFont(font.name);

          doc.registerFontUsage(font.name, cmd.text);
          page.drawText(cmd.text, cmd.x, cmd.y, {
            fontAlias: alias,
            fontName: font.name,
            fontSize: cmd.fontSize,
            color: cmd.color,
            useHtmlCoordinates: true,
            letterSpacing: cmd.letterSpacing,
            wordSpacing: cmd.wordSpacing,
          });

          if (cmd.textDecoration && cmd.textDecoration !== "none") {
            const textWidth = font.measureTextWidth(
              cmd.text,
              cmd.fontSize,
              cmd.letterSpacing || 0,
              cmd.wordSpacing || 0,
            );

            let lineY = cmd.y + cmd.fontSize * 0.95;
            if (cmd.textDecoration === "line-through") {
              lineY = cmd.y + cmd.fontSize * 0.5;
            } else if (cmd.textDecoration === "overline") {
              lineY = cmd.y + cmd.fontSize * 0.05;
            }

            page.drawLine(cmd.x, lineY, cmd.x + textWidth, lineY, {
              strokeColor: cmd.color,
              lineWidth: Math.max(0.5, cmd.fontSize * 0.06),
              useHtmlCoordinates: true,
            });
          }
        } else if (cmd.type === "rectangle") {
          const rectOpts: {
            fillColor?: ColorRGB | undefined;
            strokeColor?: ColorRGB | undefined;
            lineWidth?: number | undefined;
            useHtmlCoordinates: boolean;
            radii?: BorderRadiusConfig | undefined;
          } = {
            useHtmlCoordinates: true,
            radii: cmd.borderRadius,
          };
          if (cmd.fillColor) rectOpts.fillColor = cmd.fillColor;
          if (cmd.strokeColor) rectOpts.strokeColor = cmd.strokeColor;
          if (cmd.lineWidth !== undefined) rectOpts.lineWidth = cmd.lineWidth;

          page.drawRectangle(cmd.x, cmd.y, cmd.width, cmd.height, rectOpts);
        } else if (cmd.type === "line") {
          const lineOpts: {
            strokeColor?: ColorRGB | undefined;
            lineWidth?: number | undefined;
            useHtmlCoordinates: boolean;
            lineStyle?: string | undefined;
          } = {
            useHtmlCoordinates: true,
            lineStyle: cmd.lineStyle,
          };
          if (cmd.strokeColor) lineOpts.strokeColor = cmd.strokeColor;
          if (cmd.lineWidth !== undefined) lineOpts.lineWidth = cmd.lineWidth;

          page.drawLine(cmd.x1, cmd.y1, cmd.x2, cmd.y2, lineOpts);
        } else if (cmd.type === "image") {
          const alias = doc.addImage(cmd.imageData);
          page.drawImage(alias, cmd.x, cmd.y, cmd.width, cmd.height, {
            useHtmlCoordinates: true,
          });
        } else if (cmd.type === "link") {
          if (cmd.url.startsWith("#")) {
            const destName = cmd.url.slice(1);
            const dest = doc.getDestination(destName);
            if (dest) {
              const targetPage = pages[dest.pageIndex];
              const pageHeight = targetPage ? targetPage.height : page.height;
              const pdfY = pageHeight - dest.y;
              page.addLinkAnnotation(
                cmd.x,
                cmd.y,
                cmd.width,
                cmd.height,
                {
                  type: "goto",
                  pageRef: undefined as any,
                  pdfX: dest.x,
                  pdfY,
                },
                true,
              );
              const lastAnnot = page.annotations[page.annotations.length - 1];
              if (lastAnnot) {
                (lastAnnot.target as any).targetPageIndex = dest.pageIndex;
              }
            }
          } else {
            page.addLinkAnnotation(
              cmd.x,
              cmd.y,
              cmd.width,
              cmd.height,
              cmd.url,
              true,
            );
          }
        } else if (cmd.type === "clipStart") {
          page.startClip(
            cmd.x,
            cmd.y,
            cmd.width,
            cmd.height,
            true,
            cmd.borderRadius,
          );
        } else if (cmd.type === "clipEnd") {
          page.endClip();
        }
      }
    }
  }
}
