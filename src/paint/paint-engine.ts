import { LayoutBox, TextLine } from "../layout/layout-box.js";
import { PaintCommand, BorderRadiusConfig } from "./paint-command.js";
import { PDFDocument } from "../pdf/pdf-document.js";
import {
  PageSizeName,
  PageOrientation,
  PageMargins,
  PageSize,
} from "../pdf/pdf-page.js";

import { FontManager } from "../fonts/font.js";
import { ComputedStyle } from "../css/computed-style.js";
import { SvgRenderer } from "../svg/svg-renderer.js";

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
  private readonly fontManager: FontManager;

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
    if (box.boxType !== "Text") {
      this.paintBackgroundColor(box, commands, radii, pageIndex, zIndex, isFixed);

      // 1b. Draw Background Image if present
      this.paintBackgroundImage(box, commands, pageIndex, zIndex, isFixed);

      // 2. Draw Borders if present
      this.paintBorders(box, commands, radii, pageIndex, zIndex, isFixed);
    }

    // 3. Draw Image Content if present
    this.paintImageContent(box, commands, pageIndex, zIndex, isFixed);

    // 4. Draw Text Lines if present
    this.paintTextLines(box, commands, pageIndex, zIndex, isFixed);

    // 5. Draw Hyperlinks if this box is an <a> element with linkUrl
    this.paintHyperlinks(box, commands, pageIndex, zIndex, isFixed);

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

  private paintBackgroundColor(box: LayoutBox, commands: PaintCommand[], radii: BorderRadiusConfig | undefined, pageIndex: number, zIndex: number | "auto", isFixed: boolean) {
    const dim = box.dimensions;
    const pL = dim ? dim.padding.left : 0;
    const pR = dim ? dim.padding.right : 0;
    const pT = dim ? dim.padding.top : 0;
    const pB = dim ? dim.padding.bottom : 0;
    const bL = dim ? dim.border.left : 0;
    const bR = dim ? dim.border.right : 0;
    const bT = dim ? dim.border.top : 0;
    const bB = dim ? dim.border.bottom : 0;

    const borderBoxW = box.width + pL + pR + bL + bR;
    const borderBoxH = box.height + pT + pB + bT + bB;

    if (box.style.backgroundColor && box.style.backgroundColor.a !== 0 && borderBoxW > 0 && borderBoxH > 0) {
      commands.push({
        type: "rectangle",
        x: box.x,
        y: box.y,
        width: borderBoxW,
        height: borderBoxH,
        fillColor: box.style.backgroundColor,
        borderRadius: radii,
        pageIndex,
        zIndex,
        isFixed,
      });
    }
  }

  private paintBackgroundImage(box: LayoutBox, commands: PaintCommand[], pageIndex: number, zIndex: number | "auto", isFixed: boolean) {
    if (box.bgImageInfo && box.width > 0 && box.height > 0) {
      const img = box.bgImageInfo.imageData;
      const { tileW, tileH } = this.calculateBackgroundTileSize(box, img);
      const { startX, startY } = this.calculateBackgroundStartPosition(box, tileW, tileH);
      this.generateBackgroundCommands({
        box,
        commands,
        img,
        tileW,
        tileH,
        startX,
        startY,
        pageIndex,
        zIndex,
        isFixed,
      });
    }
  }

  private calculateBackgroundTileSize(box: LayoutBox, img: any): { tileW: number, tileH: number } {
    const sizeStr = box.style.backgroundSize.trim().toLowerCase();
    if (sizeStr === "cover" || sizeStr === "contain") {
      return this.calculateCoverContainTileSize(box, img, sizeStr);
    } 
    return this.calculateExplicitTileSize(box, img, sizeStr);
  }

  private calculateCoverContainTileSize(box: LayoutBox, img: any, sizeStr: string): { tileW: number, tileH: number } {
    const scale = sizeStr === "cover"
        ? Math.max(box.width / img.width, box.height / img.height)
        : Math.min(box.width / img.width, box.height / img.height);
    return { tileW: img.width * scale, tileH: img.height * scale };
  }

  private calculateExplicitTileSize(box: LayoutBox, img: any, sizeStr: string): { tileW: number, tileH: number } {
    let tileW = img.width;
    let tileH = img.height;
    if (sizeStr.includes(" ")) {
      const parts = sizeStr.split(/\s+/);
      if (parts[0] && parts[0] !== "auto") {
        tileW = parts[0].endsWith("%") ? (Number.parseFloat(parts[0]) / 100) * box.width : Number.parseFloat(parts[0]);
      }
      if (parts[1] && parts[1] !== "auto") {
        tileH = parts[1].endsWith("%") ? (Number.parseFloat(parts[1]) / 100) * box.height : Number.parseFloat(parts[1]);
      }
    }
    return { tileW, tileH };
  }

  private calculateBackgroundStartPosition(box: LayoutBox, tileW: number, tileH: number): { startX: number, startY: number } {
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
    return { startX, startY };
  }

  private generateBackgroundCommands(opts: {
    box: LayoutBox;
    commands: PaintCommand[];
    img: any;
    tileW: number;
    tileH: number;
    startX: number;
    startY: number;
    pageIndex: number;
    zIndex: number | "auto";
    isFixed: boolean;
  }) {
    const { box, commands, img, tileW, tileH, startX, startY, pageIndex, zIndex, isFixed } = opts;
    const repeat = box.style.backgroundRepeat;
    if (repeat === "no-repeat") {
      commands.push({ type: "image", imageData: img, x: startX, y: startY, width: tileW, height: tileH, pageIndex, zIndex, isFixed });
    } else if (repeat === "repeat-x") {
      for (let x = startX; x < box.x + box.width; x += tileW) {
        commands.push({ type: "image", imageData: img, x, y: startY, width: Math.min(tileW, box.x + box.width - x), height: tileH, pageIndex, zIndex, isFixed });
      }
    } else if (repeat === "repeat-y") {
      for (let y = startY; y < box.y + box.height; y += tileH) {
        commands.push({ type: "image", imageData: img, x: startX, y, width: tileW, height: Math.min(tileH, box.y + box.height - y), pageIndex, zIndex, isFixed });
      }
    } else {
      for (let y = startY; y < box.y + box.height; y += tileH) {
        for (let x = startX; x < box.x + box.width; x += tileW) {
          commands.push({ type: "image", imageData: img, x, y, width: Math.min(tileW, box.x + box.width - x), height: Math.min(tileH, box.y + box.height - y), pageIndex, zIndex, isFixed });
        }
      }
    }
  }

  private isUniformSolidBorder(box: LayoutBox): boolean {
    const hasBorderTop = box.style.borderTopWidth > 0 && box.style.borderTopStyle !== "none";
    const hasBorderRight = box.style.borderRightWidth > 0 && box.style.borderRightStyle !== "none";
    const hasBorderBottom = box.style.borderBottomWidth > 0 && box.style.borderBottomStyle !== "none";
    const hasBorderLeft = box.style.borderLeftWidth > 0 && box.style.borderLeftStyle !== "none";

    if (!(hasBorderTop && hasBorderRight && hasBorderBottom && hasBorderLeft)) return false;

    const sameWidth = box.style.borderTopWidth === box.style.borderRightWidth && box.style.borderTopWidth === box.style.borderBottomWidth && box.style.borderTopWidth === box.style.borderLeftWidth;
    if (!sameWidth) return false;

    const sameColor = box.style.borderTopColor.r === box.style.borderRightColor.r && box.style.borderTopColor.g === box.style.borderRightColor.g && box.style.borderTopColor.b === box.style.borderRightColor.b && box.style.borderTopColor.a === box.style.borderRightColor.a && box.style.borderTopColor.r === box.style.borderBottomColor.r && box.style.borderTopColor.g === box.style.borderBottomColor.g && box.style.borderTopColor.b === box.style.borderBottomColor.b && box.style.borderTopColor.a === box.style.borderBottomColor.a && box.style.borderTopColor.r === box.style.borderLeftColor.r && box.style.borderTopColor.g === box.style.borderLeftColor.g && box.style.borderTopColor.b === box.style.borderLeftColor.b && box.style.borderTopColor.a === box.style.borderLeftColor.a;
    if (!sameColor) return false;

    const sameStyle = box.style.borderTopStyle === box.style.borderRightStyle && box.style.borderTopStyle === box.style.borderBottomStyle && box.style.borderTopStyle === box.style.borderLeftStyle;
    return sameStyle && box.style.borderTopStyle === "solid";
  }

  private paintBorders(box: LayoutBox, commands: PaintCommand[], radii: BorderRadiusConfig | undefined, pageIndex: number, zIndex: number | "auto", isFixed: boolean) {
    const dim = box.dimensions;
    const pL = dim ? dim.padding.left : 0;
    const pR = dim ? dim.padding.right : 0;
    const pT = dim ? dim.padding.top : 0;
    const pB = dim ? dim.padding.bottom : 0;
    const bL = dim ? dim.border.left : 0;
    const bR = dim ? dim.border.right : 0;
    const bT = dim ? dim.border.top : 0;
    const bB = dim ? dim.border.bottom : 0;

    const borderBoxW = box.width + pL + pR + bL + bR;
    const borderBoxH = box.height + pT + pB + bT + bB;

    if (this.isUniformSolidBorder(box)) {
      commands.push({ type: "rectangle", x: box.x, y: box.y, width: borderBoxW, height: borderBoxH, strokeColor: box.style.borderTopColor, lineWidth: box.style.borderTopWidth, borderRadius: radii, pageIndex, zIndex, isFixed });
      return;
    }

    if (box.style.borderTopWidth > 0 && box.style.borderTopStyle !== "none") {
      commands.push({ type: "line", x1: box.x, y1: box.y, x2: box.x + borderBoxW, y2: box.y, strokeColor: box.style.borderTopColor, lineWidth: box.style.borderTopWidth, lineStyle: box.style.borderTopStyle as any, pageIndex, zIndex, isFixed });
    }
    if (box.style.borderRightWidth > 0 && box.style.borderRightStyle !== "none") {
      commands.push({ type: "line", x1: box.x + borderBoxW, y1: box.y, x2: box.x + borderBoxW, y2: box.y + borderBoxH, strokeColor: box.style.borderRightColor, lineWidth: box.style.borderRightWidth, lineStyle: box.style.borderRightStyle as any, pageIndex, zIndex, isFixed });
    }
    if (box.style.borderBottomWidth > 0 && box.style.borderBottomStyle !== "none") {
      commands.push({ type: "line", x1: box.x, y1: box.y + borderBoxH, x2: box.x + borderBoxW, y2: box.y + borderBoxH, strokeColor: box.style.borderBottomColor, lineWidth: box.style.borderBottomWidth, lineStyle: box.style.borderBottomStyle as any, pageIndex, zIndex, isFixed });
    }
    if (box.style.borderLeftWidth > 0 && box.style.borderLeftStyle !== "none") {
      commands.push({ type: "line", x1: box.x, y1: box.y, x2: box.x, y2: box.y + borderBoxH, strokeColor: box.style.borderLeftColor, lineWidth: box.style.borderLeftWidth, lineStyle: box.style.borderLeftStyle as any, pageIndex, zIndex, isFixed });
    }
  }

  private paintImageContent(box: LayoutBox, commands: PaintCommand[], pageIndex: number, zIndex: number | "auto", isFixed: boolean) {
    if (box.imageInfo) {
      commands.push({ type: "image", imageData: box.imageInfo.imageData, x: box.x, y: box.y, width: box.width, height: box.height, pageIndex, zIndex, isFixed });
    }
  }

  private paintTextLines(box: LayoutBox, commands: PaintCommand[], pageIndex: number, zIndex: number | "auto", isFixed: boolean) {
    if (box.textLines && box.textLines.length > 0) {
      for (const line of box.textLines) {
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
          pageIndex: isFixed ? pageIndex : line.pageIndex,
          zIndex,
          isFixed,
        });
      }
    }
  }

  private paintHyperlinks(box: LayoutBox, commands: PaintCommand[], pageIndex: number, zIndex: number | "auto", isFixed: boolean) {
    if (box.linkUrl && box.node && "tagName" in box.node && (box.node as any).tagName === "a" && box.width > 0 && box.height > 0) {
      const subtreeLines = collectSubtreeTextLines(box);
      if (subtreeLines.length > 0) {
        for (const item of subtreeLines) {
          const l = item.line;
          const fontObj = this.fontManager.resolveFont(item.style.fontFamily, item.style.fontWeight, item.style.fontStyle);
          const textW = fontObj.measureTextWidth(l.text, item.style.fontSize, item.style.letterSpacing || 0, item.style.wordSpacing || 0);
          const lineH = item.style.fontSize * item.style.lineHeight;
          commands.push({ type: "link", url: box.linkUrl, x: l.x, y: l.y, width: textW, height: lineH, pageIndex: isFixed ? pageIndex : l.pageIndex, zIndex, isFixed });
        }
      } else {
        commands.push({ type: "link", url: box.linkUrl, x: box.x, y: box.y, width: box.width, height: box.height, pageIndex, zIndex, isFixed });
      }
    }
  }

  renderToPdf(
    doc: PDFDocument,
    commands: PaintCommand[],
    pageSize: PageSizeName | PageSize = "A4",
    orientation: PageOrientation = "portrait",
    margins?: PageMargins,
  ): void {
    this.render(doc, commands, pageSize, orientation, margins);
  }

  render(
    doc: PDFDocument,
    commands: PaintCommand[],
    pageSize: PageSizeName | PageSize = "A4",
    orientation: PageOrientation = "portrait",
    margins?: PageMargins,
  ): void {
    const activeMargins = margins ?? { top: 36, right: 36, bottom: 36, left: 36 };

    const maxPageIndex = Math.max(
      ...commands.filter((c) => !c.isFixed).map((c) => c.pageIndex),
      0,
    );

    while (doc.getPages().length <= maxPageIndex) {
      doc.addPage(pageSize, orientation, activeMargins);
    }

    const totalPagesCount = doc.getPages().length;
    const pageCommandsMap = this.expandAndGroupCommands(commands, totalPagesCount);
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
        this.renderCommand(cmd, page, pages, doc);
      }
    }
  }

  private expandAndGroupCommands(commands: PaintCommand[], totalPagesCount: number): Map<number, PaintCommand[]> {
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

    const pageCommandsMap = new Map<number, PaintCommand[]>();
    for (const cmd of expandedCommands) {
      let list = pageCommandsMap.get(cmd.pageIndex);
      if (!list) {
        list = [];
        pageCommandsMap.set(cmd.pageIndex, list);
      }
      list.push(cmd);
    }
    return pageCommandsMap;
  }

  private renderCommand(cmd: PaintCommand, page: any, pages: any[], doc: PDFDocument) {
    if (cmd.type === "text") {
      this.renderTextCommand(cmd, page, doc);
    } else if (cmd.type === "rectangle") {
      this.renderRectangleCommand(cmd, page);
    } else if (cmd.type === "line") {
      this.renderLineCommand(cmd, page);
    } else if (cmd.type === "image") {
      this.renderImageCommand(cmd, page, doc);
    } else if (cmd.type === "link") {
      this.renderLinkCommand(cmd, page, pages, doc);
    } else if (cmd.type === "clipStart") {
      page.startClip(cmd.x, cmd.y, cmd.width, cmd.height, true, cmd.borderRadius);
    } else if (cmd.type === "clipEnd") {
      page.endClip();
    }
  }

  private renderTextCommand(cmd: any, page: any, doc: PDFDocument) {
    const fontName = cmd.fontName ?? "Helvetica";
    const font = this.fontManager.resolveFont(fontName, cmd.fontWeight, cmd.fontStyle);
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
      const textWidth = font.measureTextWidth(cmd.text, cmd.fontSize, cmd.letterSpacing || 0, cmd.wordSpacing || 0);
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
  }

  private renderRectangleCommand(cmd: any, page: any) {
    const rectOpts: any = { useHtmlCoordinates: true, radii: cmd.borderRadius };
    if (cmd.fillColor) rectOpts.fillColor = cmd.fillColor;
    if (cmd.strokeColor) rectOpts.strokeColor = cmd.strokeColor;
    if (cmd.lineWidth !== undefined) rectOpts.lineWidth = cmd.lineWidth;
    page.drawRectangle(cmd.x, cmd.y, cmd.width, cmd.height, rectOpts);
  }

  private renderLineCommand(cmd: any, page: any) {
    const lineOpts: any = { useHtmlCoordinates: true, lineStyle: cmd.lineStyle };
    if (cmd.strokeColor) lineOpts.strokeColor = cmd.strokeColor;
    if (cmd.lineWidth !== undefined) lineOpts.lineWidth = cmd.lineWidth;
    page.drawLine(cmd.x1, cmd.y1, cmd.x2, cmd.y2, lineOpts);
  }

  private renderImageCommand(cmd: any, page: any, doc: PDFDocument) {
    if (cmd.imageData.format === "svg" && cmd.imageData.svgNode) {
      const renderer = new SvgRenderer();
      const pdfY = page.height - cmd.y - cmd.height;
      const opsStr = renderer.render(cmd.imageData.svgNode, doc, cmd.width, cmd.height, [], cmd.x, pdfY);
      page.addRawOp(opsStr);
    } else {
      const alias = doc.addImage(cmd.imageData);
      page.drawImage(alias, cmd.x, cmd.y, cmd.width, cmd.height, { useHtmlCoordinates: true });
    }
  }

  private renderLinkCommand(cmd: any, page: any, pages: any[], doc: PDFDocument) {
    if (cmd.url.startsWith("#")) {
      const destName = cmd.url.slice(1);
      const dest = doc.getDestination(destName);
      if (dest) {
        const targetPage = pages[dest.pageIndex];
        const pageHeight = targetPage ? targetPage.height : page.height;
        const pdfY = pageHeight - dest.y;
        page.addLinkAnnotation(cmd.x, cmd.y, cmd.width, cmd.height, { type: "goto", pageRef: undefined as any, pdfX: dest.x, pdfY }, true);
        const lastAnnot = page.annotations.at(-1);
        if (lastAnnot) {
          (lastAnnot.target as any).targetPageIndex = dest.pageIndex;
        }
      }
    } else {
      page.addLinkAnnotation(cmd.x, cmd.y, cmd.width, cmd.height, cmd.url, true);
    }
  }
}
