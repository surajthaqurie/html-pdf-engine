import {
  BaseNode,
  ElementNode,
  TextNode,
  DocumentNode,
} from "../html/dom/node.js";
import { CSSRule } from "../css/parser.js";
import { resolveOffset } from "../css/cascade.js";
import { ComputedStyle, applyTextTransform } from "../css/computed-style.js";
import { LayoutBox } from "./layout-box.js";
import { createBoxDimensions } from "./box-model.js";
import { FontManager } from "../fonts/font.js";
import { PageMargins } from "../pdf/pdf-page.js";
import { resolveImageSource } from "../pdf/pdf-image.js";
import { parseCssUnit } from "../css/values/units.js";
import { normalizeLinkUrl } from "../pdf/pdf-annotation.js";
import {
  ContainingBlockContext,
  offsetBoxPosition,
  clearTextLines,
} from "./positioning.js";
import {
  parseGridTrackList,
  getGridPlacement,
  isCellAreaFree,
  markCellAreaOccupied,
} from "./grid-layout.js";
import { LayoutContext } from "./layout-context.js";

export type { ContainingBlockContext };

export interface PageLayoutContext {
  pageWidth: number;
  pageHeight: number;
  margins: PageMargins;
  printableWidth: number;
  printableHeight: number;
}

export interface LayoutResult {
  nextY: number;
  nextPageIndex: number;
  absChildren?: LayoutBox[];
}

export class LayoutEngine {
  private defaultFontManager?: FontManager;

  constructor(fontManager?: FontManager) {
    if (fontManager) {
      this.defaultFontManager = fontManager;
    }
  }

  layout(
    dom: BaseNode,
    cssRules: CSSRule[],
    pageWidth: number = 595.28,
    pageHeight: number = 841.89,
    margins: PageMargins = { top: 36, right: 36, bottom: 36, left: 36 },
    imagesMap?: Record<string, Buffer | string>,
    basePath?: string,
    fontManager?: FontManager,
  ): LayoutBox[] {
    const fm = fontManager ?? this.defaultFontManager ?? new FontManager();
    const ctx = new LayoutContext({
      pageWidth,
      pageHeight,
      margins,
      cssRules,
      fontManager: fm,
      imagesMap,
      basePath,
    });

    // 1. Construct Layout Tree from DOM & Cascade CSS
    const rootBox = this.buildLayoutBox(
      dom,
      ctx,
      undefined,
      ctx.printableWidth,
    );
    if (!rootBox) return [];

    // 2. Perform Block & Multi-Page Pagination Layout
    const currentY = margins.top;
    const currentPageIndex = 0;

    const rootCB: ContainingBlockContext = {
      x: margins.left,
      y: margins.top,
      width: ctx.printableWidth,
      height: ctx.printableHeight,
      pageIndex: 0,
    };

    const res = this.layoutBlockBox(
      rootBox,
      margins.left,
      currentY,
      currentPageIndex,
      ctx,
      (box, pageIdx) => {
        box.pageIndex = pageIdx;
      },
      ctx.printableWidth,
      rootCB,
    );

    // Process root-level absolute children (those with no positioned ancestor)
    if (res.absChildren && res.absChildren.length > 0) {
      for (const absChild of res.absChildren) {
        const absCB: ContainingBlockContext = {
          x: margins.left,
          y: margins.top,
          width: ctx.printableWidth,
          height: ctx.printableHeight,
          pageIndex: absChild.pageIndex,
        };
        this.layoutAbsoluteBox(absChild, absCB, ctx);
      }
    }

    this.collectDestinations(rootBox, ctx);
    (rootBox as any).destinations = ctx.destinations;

    return [rootBox];
  }

  private collectDestinations(box: LayoutBox, ctx: LayoutContext): void {
    if (box.anchorId) {
      ctx.addDestination(box.anchorId, box.pageIndex, box.x, box.y);
    }
    for (const child of box.children) {
      this.collectDestinations(child, ctx);
    }
  }

  private buildLayoutBox(
    node: BaseNode,
    ctx: LayoutContext,
    parentStyle?: ComputedStyle,
    parentContentWidth: number = 523.28,
    parentLinkUrl?: string,
  ): LayoutBox | null {
    let currentLinkUrl = parentLinkUrl;
    if (node instanceof ElementNode && node.tagName === "a") {
      const href = node.getAttribute("href");
      const normalized = normalizeLinkUrl(href);
      if (normalized) {
        currentLinkUrl = normalized;
      }
    }

    if (node instanceof DocumentNode) {
      const rootStyle =
        parentStyle ??
        ctx.cascadeEngine.computeStyle(new ElementNode("body"), ctx.cssRules);
      const rootBox = new LayoutBox("Block", rootStyle, node);
      if (currentLinkUrl) rootBox.linkUrl = currentLinkUrl;
      for (const childNode of node.children) {
        const childBox = this.buildLayoutBox(
          childNode,
          ctx,
          rootStyle,
          parentContentWidth,
          currentLinkUrl,
        );
        if (childBox) rootBox.addChild(childBox);
      }
      return rootBox;
    }

    if (node instanceof ElementNode) {
      const style = ctx.cascadeEngine.computeStyle(
        node,
        ctx.cssRules,
        parentStyle,
        parentContentWidth,
      );
      if (style.display === "none") return null;

      if (node.tagName === "img") {
        const src = node.getAttribute("src");
        if (src) {
          const imageData = resolveImageSource(
            src,
            ctx.imagesMap,
            ctx.basePath,
            ctx.imageCache,
          );
          const attrW = node.getAttribute("width");
          const attrH = node.getAttribute("height");

          const targetW: number | "auto" =
            style.width !== "auto"
              ? style.width
              : attrW
                ? parseCssUnit(attrW, parentContentWidth)
                : "auto";
          const targetH: number | "auto" =
            style.height !== "auto"
              ? style.height
              : attrH
                ? parseCssUnit(attrH)
                : "auto";

          let renderW = imageData.width;
          let renderH = imageData.height;

          if (typeof targetW === "number" && targetH === "auto") {
            renderW = targetW;
            renderH = targetW * (imageData.height / imageData.width);
          } else if (typeof targetH === "number" && targetW === "auto") {
            renderH = targetH;
            renderW = targetH * (imageData.width / imageData.height);
          } else if (
            typeof targetW === "number" &&
            typeof targetH === "number"
          ) {
            renderW = targetW;
            renderH = targetH;
          }

          if (renderW > parentContentWidth) {
            renderH = parentContentWidth * (renderH / renderW);
            renderW = parentContentWidth;
          }

          if (style.minWidth !== "none" && typeof style.minWidth === "number") {
            renderW = Math.max(renderW, style.minWidth);
          }
          if (style.maxWidth !== "none" && typeof style.maxWidth === "number") {
            if (renderW > style.maxWidth) {
              const ratio = renderH / renderW;
              renderW = style.maxWidth;
              if (targetH === "auto") renderH = renderW * ratio;
            }
          }
          if (style.minHeight !== "none" && typeof style.minHeight === "number") {
            renderH = Math.max(renderH, style.minHeight);
          }
          if (style.maxHeight !== "none" && typeof style.maxHeight === "number") {
            if (renderH > style.maxHeight) {
              const ratio = renderW / renderH;
              renderH = style.maxHeight;
              if (targetW === "auto") renderW = renderH * ratio;
            }
          }

          const dimensions = createBoxDimensions(style, parentContentWidth);
          dimensions.contentWidth = renderW;
          dimensions.contentHeight = renderH;

          const box = new LayoutBox("Image", style, node, dimensions);
          if (currentLinkUrl) box.linkUrl = currentLinkUrl;
          if (node.id) box.anchorId = node.id;
          box.imageInfo = {
            src,
            imageData,
            width: renderW,
            height: renderH,
          };
          box.width = renderW;
          box.height = renderH;
          return box;
        }
      }

      const boxType =
        style.display === "inline"
          ? "Inline"
          : style.display === "flex" || style.display === "inline-flex"
            ? "Flex"
            : style.display === "grid" || style.display === "inline-grid"
              ? "Grid"
              : style.display === "table"
                ? "Table"
                : style.display === "table-row"
                  ? "TableRow"
                  : style.display === "table-cell"
                    ? "TableCell"
                    : "Block";
      const dimensions = createBoxDimensions(style, parentContentWidth);
      const box = new LayoutBox(boxType, style, node, dimensions);
      if (currentLinkUrl) box.linkUrl = currentLinkUrl;
      if (node.id) box.anchorId = node.id;

      for (const childNode of node.children) {
        const childBox = this.buildLayoutBox(
          childNode,
          ctx,
          style,
          dimensions.contentWidth,
          currentLinkUrl,
        );
        if (childBox) {
          box.addChild(childBox);
        }
      }

      return box;
    } else if (node instanceof TextNode) {
      const textContent = node.text.replace(/\s+/g, " ");
      if (!textContent || textContent === " ") return null;

      const style =
        parentStyle ??
        ctx.cascadeEngine.computeStyle(new ElementNode("span"), ctx.cssRules);
      const box = new LayoutBox("Text", style, node);
      if (currentLinkUrl) box.linkUrl = currentLinkUrl;
      return box;
    }

    return null;
  }

  private layoutBlockBox(
    box: LayoutBox,
    startX: number,
    startY: number,
    startPageIndex: number,
    ctx: LayoutContext,
    onPlacePage?: (box: LayoutBox, pageIndex: number) => void,
    parentContainerWidth?: number,
    parentCB?: ContainingBlockContext,
  ): LayoutResult {
    if (
      box.boxType === "Table" ||
      box.style.display === "table"
    ) {
      return this.layoutTableBox(
        box,
        startX,
        startY,
        startPageIndex,
        ctx,
        onPlacePage,
        parentCB,
      );
    }

    if (
      box.boxType === "Flex" ||
      box.style.display === "flex" ||
      box.style.display === "inline-flex"
    ) {
      return this.layoutFlexBox(
        box,
        startX,
        startY,
        startPageIndex,
        ctx,
        onPlacePage,
        parentCB,
      );
    }

    if (
      box.boxType === "Grid" ||
      box.style.display === "grid" ||
      box.style.display === "inline-grid"
    ) {
      return this.layoutGridBox(
        box,
        startX,
        startY,
        startPageIndex,
        ctx,
        onPlacePage,
        parentCB,
      );
    }

    let currentY = startY;
    let pageIdx = startPageIndex;

    const dim = box.dimensions;
    const marginLeft = dim ? dim.margin.left : 0;
    const marginTop = dim ? dim.margin.top : 0;
    const marginBottom = dim ? dim.margin.bottom : 0;
    const paddingLeft = dim ? dim.padding.left : 0;
    const paddingRight = dim ? dim.padding.right : 0;
    const paddingTop = dim ? dim.padding.top : 0;
    const paddingBottom = dim ? dim.padding.bottom : 0;
    const borderLeft = dim ? dim.border.left : 0;
    const borderTop = dim ? dim.border.top : 0;
    const borderBottom = dim ? dim.border.bottom : 0;

    // Check break-before / page-break-before
    const isBreakBefore =
      !isAncestorClipped(box.parent) &&
      box.boxType !== "Text" &&
      (box.style.breakBefore === "page" ||
        box.style.pageBreakBefore === "always");

    if (isBreakBefore) {
      if (currentY > ctx.margins.top) {
        pageIdx++;
        currentY = ctx.margins.top;
      }
    } else {
      currentY += marginTop;
    }

    // Check break-inside: avoid / page-break-inside: avoid
    const isBreakInsideAvoid =
      box.boxType !== "Text" &&
      (box.style.breakInside === "avoid" ||
        box.style.pageBreakInside === "avoid");

    if (isBreakInsideAvoid && currentY > ctx.margins.top) {
      const requiredH = this.estimateBoxHeight(
        box,
        parentContainerWidth || ctx.printableWidth,
        ctx,
      );
      if (
        !isAncestorClipped(box.parent) &&
        currentY + requiredH > ctx.margins.top + ctx.printableHeight &&
        requiredH <= ctx.printableHeight
      ) {
        pageIdx++;
        currentY = ctx.margins.top;
      }
    }

    // Set box origin coordinates
    box.x = startX + marginLeft;
    box.y = currentY;
    box.pageIndex = pageIdx;
    if (onPlacePage) onPlacePage(box, pageIdx);

    const innerX = box.x + borderLeft + paddingLeft;
    let innerY = currentY + borderTop + paddingTop;

    let contentHeight = 0;
    const localAbsChildren: LayoutBox[] = [];
    const isPositionedContainer =
      box.style.position === "relative" || box.style.position === "absolute";

    if (box.boxType === "Image" && box.imageInfo) {
      const renderW = box.imageInfo.width;
      const renderH = box.imageInfo.height;

      if (
        !isAncestorClipped(box.parent) &&
        currentY + renderH > ctx.margins.top + ctx.printableHeight
      ) {
        pageIdx++;
        currentY = ctx.margins.top;
      }

      box.x = startX + marginLeft;
      box.y = currentY;
      box.pageIndex = pageIdx;
      if (onPlacePage) onPlacePage(box, pageIdx);

      box.width = renderW;
      box.height = renderH;

      const finalY = currentY + renderH + marginBottom;
      return { nextY: finalY, nextPageIndex: pageIdx };
    }

    if (box.boxType === "Text" && box.node instanceof TextNode) {
      // Inline text layout
      const font = ctx.fontManager.resolveFont(
        box.style.fontFamily,
        box.style.fontWeight,
        box.style.fontStyle,
      );
      const fontSize = box.style.fontSize;
      const letterSpacing = box.style.letterSpacing || 0;
      const wordSpacing = box.style.wordSpacing || 0;

      let lineHeight = font.getLineHeight(fontSize) * 1.2;
      if (typeof box.style.lineHeight === "number") {
        if (box.style.lineHeight <= 5) {
          lineHeight = font.getLineHeight(fontSize) * box.style.lineHeight;
        } else {
          lineHeight = box.style.lineHeight;
        }
      }

      const transformedText = applyTextTransform(
        box.node.text,
        box.style.textTransform,
      );

      const maxWrapWidth =
        parentContainerWidth && parentContainerWidth > 0
          ? parentContainerWidth
          : ctx.printableWidth;

      const isNowrap = box.style.whiteSpace === "nowrap";

      if (
        isNowrap &&
        box.style.textOverflow === "ellipsis" &&
        (box.style.overflow === "hidden" ||
          box.style.overflowX === "hidden" ||
          box.parent?.style.overflow === "hidden" ||
          box.parent?.style.overflowX === "hidden")
      ) {
        let textToRender = transformedText;
        let measuredW = font.measureTextWidth(
          textToRender,
          fontSize,
          letterSpacing,
          wordSpacing,
        );

        if (measuredW > maxWrapWidth) {
          const ellipsisW = font.measureTextWidth(
            "...",
            fontSize,
            letterSpacing,
            wordSpacing,
          );
          const targetW = Math.max(0, maxWrapWidth - ellipsisW);
          let sliceLen = textToRender.length;
          while (
            sliceLen > 0 &&
            font.measureTextWidth(
              textToRender.slice(0, sliceLen),
              fontSize,
              letterSpacing,
              wordSpacing,
            ) > targetW
          ) {
            sliceLen--;
          }
          textToRender = textToRender.slice(0, sliceLen) + "...";
          measuredW = font.measureTextWidth(
            textToRender,
            fontSize,
            letterSpacing,
            wordSpacing,
          );
        }

        box.textLines.push({
          text: textToRender,
          x: innerX,
          y: innerY,
          width: measuredW,
          height: lineHeight,
          pageIndex: pageIdx,
        });

        innerY += lineHeight;
        contentHeight += lineHeight;
      } else if (isNowrap) {
        const indent = box.style.textIndent || 0;
        const measuredW = font.measureTextWidth(
          transformedText,
          fontSize,
          letterSpacing,
          wordSpacing,
        );

        box.textLines.push({
          text: transformedText,
          x: innerX + indent,
          y: innerY,
          width: measuredW,
          height: lineHeight,
          pageIndex: pageIdx,
        });

        innerY += lineHeight;
        contentHeight += lineHeight;
      } else {
        const words = transformedText.split(" ");
        let currentLineText = "";
        let currentLineWidth = 0;

        for (let i = 0; i < words.length; i++) {
          const word = words[i] ?? "";
          const testText = currentLineText
            ? `${currentLineText} ${word}`
            : word;
          const testWidth = font.measureTextWidth(
            testText,
            fontSize,
            letterSpacing,
            wordSpacing,
          );

          const lineIndent =
            box.textLines.length === 0 ? box.style.textIndent || 0 : 0;
          const availWidth = maxWrapWidth - lineIndent;

          if (testWidth > availWidth && currentLineText) {
            if (
              !isAncestorClipped(box.parent) &&
              innerY + lineHeight > ctx.margins.top + ctx.printableHeight
            ) {
              pageIdx++;
              innerY = ctx.margins.top;
            }

            box.textLines.push({
              text: currentLineText,
              x: innerX + lineIndent,
              y: innerY,
              width: currentLineWidth,
              height: lineHeight,
              pageIndex: pageIdx,
            });

            innerY += lineHeight;
            contentHeight += lineHeight;
            currentLineText = word;
            currentLineWidth = font.measureTextWidth(
              word,
              fontSize,
              letterSpacing,
              wordSpacing,
            );
          } else {
            currentLineText = testText;
            currentLineWidth = testWidth;
          }
        }

        if (currentLineText) {
          const lineIndent =
            box.textLines.length === 0 ? box.style.textIndent || 0 : 0;
          if (
            !isAncestorClipped(box.parent) &&
            innerY + lineHeight > ctx.margins.top + ctx.printableHeight
          ) {
            pageIdx++;
            innerY = ctx.margins.top;
          }

          box.textLines.push({
            text: currentLineText,
            x: innerX + lineIndent,
            y: innerY,
            width: currentLineWidth,
            height: lineHeight,
            pageIndex: pageIdx,
          });

          innerY += lineHeight;
          contentHeight += lineHeight;
        }
      }
    } else {
      // Child layout
      const containerWidthForChild = dim
        ? dim.contentWidth
        : ctx.printableWidth;
      for (const child of box.children) {
        if (child.style.position === "absolute") {
          child.pageIndex = pageIdx;
          localAbsChildren.push(child);
          continue;
        }

        if (child.style.width === "auto" && child.dimensions) {
          const mH =
            child.dimensions.margin.left +
            child.dimensions.margin.right +
            child.dimensions.padding.left +
            child.dimensions.padding.right +
            child.dimensions.border.left +
            child.dimensions.border.right;
          child.dimensions.contentWidth = Math.max(
            0,
            containerWidthForChild - mH,
          );
          child.width = child.dimensions.contentWidth;
        }

        const activeCBForChild: ContainingBlockContext = isPositionedContainer
          ? {
              x: box.x + borderLeft,
              y: box.y + borderTop,
              width:
                (dim ? dim.contentWidth : ctx.printableWidth) +
                paddingLeft +
                paddingRight,
              height: 0, // updated later
              pageIndex: box.pageIndex,
            }
          : parentCB || {
              x: ctx.margins.left,
              y: ctx.margins.top,
              width: ctx.printableWidth,
              height: ctx.printableHeight,
              pageIndex: pageIdx,
            };

        const res = this.layoutBlockBox(
          child,
          innerX,
          innerY,
          pageIdx,
          ctx,
          onPlacePage,
          containerWidthForChild,
          activeCBForChild,
        );

        if (res.absChildren) {
          localAbsChildren.push(...res.absChildren);
        }

        innerY = res.nextY;
        pageIdx = res.nextPageIndex;
      }
      contentHeight = innerY - (currentY + borderTop + paddingTop);
    }

    box.width = dim ? dim.contentWidth : ctx.printableWidth;
    if (box.style.minWidth !== "none" && typeof box.style.minWidth === "number") {
      box.width = Math.max(box.width, box.style.minWidth);
    }
    if (box.style.maxWidth !== "none" && typeof box.style.maxWidth === "number") {
      box.width = Math.min(box.width, box.style.maxWidth);
    }

    box.height =
      dim && dim.contentHeight > 0 ? dim.contentHeight : contentHeight;
    if (box.style.minHeight !== "none" && typeof box.style.minHeight === "number") {
      box.height = Math.max(box.height, box.style.minHeight);
    }
    if (box.style.maxHeight !== "none" && typeof box.style.maxHeight === "number") {
      box.height = Math.min(box.height, box.style.maxHeight);
    }

    let finalY =
      currentY +
      borderTop +
      paddingTop +
      box.height +
      paddingBottom +
      borderBottom +
      marginBottom;

    const isClipped =
      box.style.overflow === "hidden" || box.style.overflowY === "hidden";

    if (isClipped) {
      const boxTotalH =
        borderTop +
        paddingTop +
        box.height +
        paddingBottom +
        borderBottom;
      pageIdx =
        box.pageIndex +
        Math.floor((box.y + boxTotalH - ctx.margins.top) / ctx.printableHeight);
      finalY = box.y + boxTotalH + marginBottom;
      while (finalY > ctx.margins.top + ctx.printableHeight) {
        finalY -= ctx.printableHeight;
      }
    } else if (isAncestorClipped(box.parent)) {
      pageIdx = startPageIndex;
    } else {
      while (finalY > ctx.margins.top + ctx.printableHeight) {
        pageIdx++;
        finalY -= ctx.printableHeight;
      }
    }

    const isBreakAfter =
      box.boxType !== "Text" &&
      (box.style.breakAfter === "page" ||
        box.style.pageBreakAfter === "always");

    if (isBreakAfter) {
      pageIdx++;
      finalY = ctx.margins.top;
    }

    const currentPaddingBoxCB: ContainingBlockContext = {
      x: box.x + borderLeft,
      y: box.y + borderTop,
      width: box.width + paddingLeft + paddingRight,
      height: box.height + paddingTop + paddingBottom,
      pageIndex: box.pageIndex,
    };

    let remainingAbsChildren: LayoutBox[] = [];

    if (isPositionedContainer) {
      for (const absChild of localAbsChildren) {
        this.layoutAbsoluteBox(absChild, currentPaddingBoxCB, ctx);
      }
    } else {
      remainingAbsChildren = localAbsChildren;
    }

    if (box.style.position === "relative") {
      this.applyRelativeOffset(box, parentCB || currentPaddingBoxCB);
    }

    return {
      nextY: finalY,
      nextPageIndex: isAncestorClipped(box.parent) ? startPageIndex : pageIdx,
      absChildren: remainingAbsChildren,
    };
  }

  private layoutFlexBox(
    box: LayoutBox,
    startX: number,
    startY: number,
    startPageIndex: number,
    ctx: LayoutContext,
    onPlacePage?: (box: LayoutBox, pageIndex: number) => void,
    parentCB?: ContainingBlockContext,
  ): LayoutResult {
    let currentY = startY;
    let pageIdx = startPageIndex;

    const dim = box.dimensions;
    const marginLeft = dim ? dim.margin.left : 0;
    const marginTop = dim ? dim.margin.top : 0;
    const marginBottom = dim ? dim.margin.bottom : 0;
    const paddingLeft = dim ? dim.padding.left : 0;
    const paddingRight = dim ? dim.padding.right : 0;
    const paddingTop = dim ? dim.padding.top : 0;
    const paddingBottom = dim ? dim.padding.bottom : 0;
    const borderLeft = dim ? dim.border.left : 0;
    const borderTop = dim ? dim.border.top : 0;
    const borderBottom = dim ? dim.border.bottom : 0;

    const isBreakBefore =
      box.style.breakBefore === "page" ||
      box.style.pageBreakBefore === "always";

    if (isBreakBefore) {
      if (currentY > ctx.margins.top) {
        pageIdx++;
        currentY = ctx.margins.top;
      }
    } else {
      currentY += marginTop;
    }

    const isBreakInsideAvoid =
      box.style.breakInside === "avoid" ||
      box.style.pageBreakInside === "avoid";

    if (isBreakInsideAvoid && currentY > ctx.margins.top) {
      const requiredH = this.estimateBoxHeight(box, ctx.printableWidth, ctx);
      if (
        currentY + requiredH > ctx.margins.top + ctx.printableHeight &&
        requiredH <= ctx.printableHeight
      ) {
        pageIdx++;
        currentY = ctx.margins.top;
      }
    }

    box.x = startX + marginLeft;
    box.y = currentY;
    box.pageIndex = pageIdx;
    if (onPlacePage) onPlacePage(box, pageIdx);

    const innerX = box.x + borderLeft + paddingLeft;
    const innerY = currentY + borderTop + paddingTop;
    const containerContentWidth = dim ? dim.contentWidth : ctx.printableWidth;

    const localAbsChildren: LayoutBox[] = [];
    const flowChildren: LayoutBox[] = [];

    for (const child of box.children) {
      if (child.style.position === "absolute") {
        child.pageIndex = pageIdx;
        localAbsChildren.push(child);
      } else {
        flowChildren.push(child);
      }
    }

    const isRow =
      box.style.flexDirection === "row" ||
      box.style.flexDirection === "row-reverse";
    const isReverse =
      box.style.flexDirection === "row-reverse" ||
      box.style.flexDirection === "column-reverse";

    const flexWrap = box.style.flexWrap || "nowrap";

    const mainGap = isRow
      ? box.style.columnGap || box.style.rowGap
      : box.style.rowGap || box.style.columnGap;

    const children = isReverse
      ? [...flowChildren].reverse()
      : [...flowChildren];

    const isPositionedContainer =
      box.style.position === "relative" || box.style.position === "absolute";

    if (children.length === 0) {
      box.width = containerContentWidth;
      box.height = dim && dim.contentHeight > 0 ? dim.contentHeight : 0;
      const finalY =
        currentY +
        borderTop +
        paddingTop +
        box.height +
        paddingBottom +
        borderBottom +
        marginBottom;

      const currentPaddingBoxCB: ContainingBlockContext = {
        x: box.x + borderLeft,
        y: box.y + borderTop,
        width: box.width + paddingLeft + paddingRight,
        height: box.height + paddingTop + paddingBottom,
        pageIndex: box.pageIndex,
      };

      let remainingAbsChildren: LayoutBox[] = [];
      if (isPositionedContainer) {
        for (const absChild of localAbsChildren) {
          this.layoutAbsoluteBox(absChild, currentPaddingBoxCB, ctx);
        }
      } else {
        remainingAbsChildren = localAbsChildren;
      }

      if (box.style.position === "relative") {
        this.applyRelativeOffset(box, parentCB || currentPaddingBoxCB);
      }

      return {
        nextY: finalY,
        nextPageIndex: pageIdx,
        absChildren: remainingAbsChildren,
      };
    }

    if (isRow) {
      interface FlexItemInfo {
        child: LayoutBox;
        baseMainSize: number;
        flexGrow: number;
        flexShrink: number;
        finalMainSize: number;
        outerMarginMain: number;
      }

      const flexItems: FlexItemInfo[] = [];

      for (const child of children) {
        let baseSize: number;
        if (
          child.style.flexBasis !== "auto" &&
          typeof child.style.flexBasis === "number"
        ) {
          baseSize = child.style.flexBasis;
        } else if (typeof child.style.width === "number") {
          baseSize = child.style.width;
        } else {
          const res = this.layoutBlockBox(child, 0, 0, pageIdx, ctx, undefined);
          if (res.absChildren) localAbsChildren.push(...res.absChildren);
          baseSize = child.width;
        }

        const childDim = child.dimensions;
        const outerMarginMain = childDim
          ? childDim.margin.left +
            childDim.margin.right +
            childDim.padding.left +
            childDim.padding.right +
            childDim.border.left +
            childDim.border.right
          : 0;

        flexItems.push({
          child,
          baseMainSize: baseSize,
          flexGrow: child.style.flexGrow,
          flexShrink: child.style.flexShrink,
          finalMainSize: baseSize,
          outerMarginMain,
        });
      }

      interface FlexLine {
        items: FlexItemInfo[];
        crossSize: number;
      }

      const flexLines: FlexLine[] = [];

      if (flexWrap === "nowrap") {
        flexLines.push({ items: flexItems, crossSize: 0 });
      } else {
        let currentLineItems: FlexItemInfo[] = [];
        let currentLineMainSize = 0;

        for (const item of flexItems) {
          const itemTotalWidth = item.baseMainSize + item.outerMarginMain;
          if (currentLineItems.length === 0) {
            currentLineItems.push(item);
            currentLineMainSize = itemTotalWidth;
          } else {
            if (
              currentLineMainSize + mainGap + itemTotalWidth >
              containerContentWidth
            ) {
              flexLines.push({ items: currentLineItems, crossSize: 0 });
              currentLineItems = [item];
              currentLineMainSize = itemTotalWidth;
            } else {
              currentLineItems.push(item);
              currentLineMainSize += mainGap + itemTotalWidth;
            }
          }
        }
        if (currentLineItems.length > 0) {
          flexLines.push({ items: currentLineItems, crossSize: 0 });
        }
      }

      for (const line of flexLines) {
        const lineItems = line.items;
        const totalLineGaps = (lineItems.length - 1) * mainGap;
        const totalLineBaseSize =
          lineItems.reduce(
            (acc, item) => acc + item.baseMainSize + item.outerMarginMain,
            0,
          ) + totalLineGaps;
        const lineFreeSpace = containerContentWidth - totalLineBaseSize;

        if (lineFreeSpace > 0) {
          const totalGrow = lineItems.reduce((acc, i) => acc + i.flexGrow, 0);
          if (totalGrow > 0) {
            for (const item of lineItems) {
              item.finalMainSize =
                item.baseMainSize + (item.flexGrow / totalGrow) * lineFreeSpace;
            }
          }
        } else if (lineFreeSpace < 0) {
          const totalShrink = lineItems.reduce(
            (acc, i) => acc + i.flexShrink,
            0,
          );
          if (totalShrink > 0) {
            for (const item of lineItems) {
              const shrinkAmount =
                (item.flexShrink / totalShrink) * Math.abs(lineFreeSpace);
              item.finalMainSize = Math.max(
                0,
                item.baseMainSize - shrinkAmount,
              );
            }
          }
        }

        for (const item of lineItems) {
          if (item.child.dimensions) {
            item.child.dimensions.contentWidth = item.finalMainSize;
          }
          item.child.width = item.finalMainSize;
          const res = this.layoutBlockBox(
            item.child,
            0,
            0,
            pageIdx,
            ctx,
            undefined,
          );
          if (res.absChildren) localAbsChildren.push(...res.absChildren);
        }

        line.crossSize = Math.max(
          0,
          ...lineItems.map((i) => i.child.totalHeight),
        );
      }

      const crossGap = box.style.rowGap || box.style.columnGap || 0;
      const orderedLines =
        flexWrap === "wrap-reverse" ? [...flexLines].reverse() : flexLines;

      let currentLineY = innerY;

      for (const line of orderedLines) {
        if (
          currentLineY + line.crossSize >
            ctx.margins.top + ctx.printableHeight &&
          currentLineY > ctx.margins.top
        ) {
          pageIdx++;
          currentLineY = ctx.margins.top;
        }

        const lineItems = line.items;
        const totalFinalMainSize =
          lineItems.reduce((acc, i) => acc + i.child.totalWidth, 0) +
          (lineItems.length - 1) * mainGap;
        const remainingMainSpace = containerContentWidth - totalFinalMainSize;

        let startXOffset = 0;
        let betweenGap = mainGap;

        const justify = box.style.justifyContent;
        if (justify === "flex-end") {
          startXOffset = remainingMainSpace;
        } else if (justify === "center") {
          startXOffset = remainingMainSpace / 2;
        } else if (justify === "space-between") {
          if (lineItems.length > 1) {
            betweenGap = mainGap + remainingMainSpace / (lineItems.length - 1);
          }
        } else if (justify === "space-around") {
          if (lineItems.length > 0) {
            const share = remainingMainSpace / lineItems.length;
            startXOffset = share / 2;
            betweenGap = mainGap + share;
          }
        } else if (justify === "space-evenly") {
          if (lineItems.length > 0) {
            const share = remainingMainSpace / (lineItems.length + 1);
            startXOffset = share;
            betweenGap = mainGap + share;
          }
        }

        let currentX = innerX + startXOffset;
        const align = box.style.alignItems;

        for (const item of lineItems) {
          const child = item.child;
          const childDim = child.dimensions;
          const childMarginLeft = childDim ? childDim.margin.left : 0;
          const childMarginTop = childDim ? childDim.margin.top : 0;

          const targetX = currentX + childMarginLeft;
          let targetY = currentLineY + childMarginTop;

          if (align === "flex-end") {
            targetY =
              currentLineY +
              line.crossSize -
              child.totalHeight +
              childMarginTop;
          } else if (align === "center") {
            targetY =
              currentLineY +
              (line.crossSize - child.totalHeight) / 2 +
              childMarginTop;
          } else if (align === "stretch") {
            if (child.style.height === "auto" && child.dimensions) {
              const extraH = childDim
                ? childDim.padding.top +
                  childDim.padding.bottom +
                  childDim.border.top +
                  childDim.border.bottom +
                  childDim.margin.top +
                  childDim.margin.bottom
                : 0;
              child.dimensions.contentHeight = Math.max(
                0,
                line.crossSize - extraH,
              );
              child.height = child.dimensions.contentHeight;
            }
          }

          const dx = targetX - child.x;
          const dy = targetY - child.y;
          const pageDelta = pageIdx - child.pageIndex;
          offsetBoxPosition(child, dx, dy, pageDelta);

          currentX += child.totalWidth + betweenGap;
        }

        currentLineY += line.crossSize + crossGap;
      }

      const totalContentHeight =
        currentLineY - innerY - (orderedLines.length > 0 ? crossGap : 0);

      box.width = containerContentWidth;
      box.height =
        dim && dim.contentHeight > 0
          ? dim.contentHeight
          : Math.max(0, totalContentHeight);

      const finalY =
        currentY +
        borderTop +
        paddingTop +
        box.height +
        paddingBottom +
        borderBottom +
        marginBottom;

      const currentPaddingBoxCB: ContainingBlockContext = {
        x: box.x + borderLeft,
        y: box.y + borderTop,
        width: box.width + paddingLeft + paddingRight,
        height: box.height + paddingTop + paddingBottom,
        pageIndex: box.pageIndex,
      };

      let remainingAbsChildren: LayoutBox[] = [];
      if (isPositionedContainer) {
        for (const absChild of localAbsChildren) {
          this.layoutAbsoluteBox(absChild, currentPaddingBoxCB, ctx);
        }
      } else {
        remainingAbsChildren = localAbsChildren;
      }

      if (box.style.position === "relative") {
        this.applyRelativeOffset(box, parentCB || currentPaddingBoxCB);
      }

      return {
        nextY: finalY,
        nextPageIndex: pageIdx,
        absChildren: remainingAbsChildren,
      };
    } else {
      // Column direction layout
      const crossGap = box.style.columnGap || box.style.rowGap || 0;
      const maxMainHeight =
        dim && dim.contentHeight > 0 ? dim.contentHeight : ctx.printableHeight;

      interface ColItemInfo {
        child: LayoutBox;
        totalHeight: number;
        totalWidth: number;
      }

      const colItems: ColItemInfo[] = [];
      for (const child of children) {
        const res = this.layoutBlockBox(child, 0, 0, pageIdx, ctx, undefined);
        if (res.absChildren) localAbsChildren.push(...res.absChildren);
        colItems.push({
          child,
          totalHeight: child.totalHeight,
          totalWidth: child.totalWidth,
        });
      }

      interface ColLine {
        items: ColItemInfo[];
        crossSize: number;
      }

      const colLines: ColLine[] = [];

      if (flexWrap === "nowrap") {
        colLines.push({ items: colItems, crossSize: 0 });
      } else {
        let currentLineItems: ColItemInfo[] = [];
        let currentLineHeight = 0;

        for (const item of colItems) {
          if (currentLineItems.length === 0) {
            currentLineItems.push(item);
            currentLineHeight = item.totalHeight;
          } else {
            if (
              currentLineHeight + mainGap + item.totalHeight >
              maxMainHeight
            ) {
              colLines.push({ items: currentLineItems, crossSize: 0 });
              currentLineItems = [item];
              currentLineHeight = item.totalHeight;
            } else {
              currentLineItems.push(item);
              currentLineHeight += mainGap + item.totalHeight;
            }
          }
        }
        if (currentLineItems.length > 0) {
          colLines.push({ items: currentLineItems, crossSize: 0 });
        }
      }

      for (const line of colLines) {
        line.crossSize = Math.max(0, ...line.items.map((i) => i.totalWidth));
      }

      const orderedColLines =
        flexWrap === "wrap-reverse" ? [...colLines].reverse() : colLines;

      let currentXOffset = innerX;
      const align = box.style.alignItems;
      let maxColY = innerY;

      for (const line of orderedColLines) {
        let currentChildY = innerY;

        for (const item of line.items) {
          const child = item.child;

          let targetX = currentXOffset;
          if (align === "center") {
            targetX = currentXOffset + (line.crossSize - child.totalWidth) / 2;
          } else if (align === "flex-end") {
            targetX = currentXOffset + line.crossSize - child.totalWidth;
          } else if (align === "stretch") {
            if (child.style.width === "auto" && child.dimensions) {
              child.dimensions.contentWidth = line.crossSize;
              child.width = line.crossSize;
            }
          }

          const dx = targetX - child.x;
          const dy = currentChildY - child.y;
          const pageDelta = pageIdx - child.pageIndex;
          offsetBoxPosition(child, dx, dy, pageDelta);

          currentChildY += child.totalHeight + mainGap;
        }

        if (currentChildY > maxColY) {
          maxColY = currentChildY;
        }

        currentXOffset += line.crossSize + crossGap;
      }

      const totalContentHeight =
        maxColY - innerY - (colItems.length > 0 ? mainGap : 0);
      box.width = containerContentWidth;
      box.height =
        dim && dim.contentHeight > 0
          ? dim.contentHeight
          : Math.max(0, totalContentHeight);

      const finalY =
        currentY +
        borderTop +
        paddingTop +
        box.height +
        paddingBottom +
        borderBottom +
        marginBottom;

      const currentPaddingBoxCB: ContainingBlockContext = {
        x: box.x + borderLeft,
        y: box.y + borderTop,
        width: box.width + paddingLeft + paddingRight,
        height: box.height + paddingTop + paddingBottom,
        pageIndex: box.pageIndex,
      };

      let remainingAbsChildren: LayoutBox[] = [];
      if (isPositionedContainer) {
        for (const absChild of localAbsChildren) {
          this.layoutAbsoluteBox(absChild, currentPaddingBoxCB, ctx);
        }
      } else {
        remainingAbsChildren = localAbsChildren;
      }

      if (box.style.position === "relative") {
        this.applyRelativeOffset(box, parentCB || currentPaddingBoxCB);
      }

      return {
        nextY: finalY,
        nextPageIndex: pageIdx,
        absChildren: remainingAbsChildren,
      };
    }
  }

  private layoutGridBox(
    box: LayoutBox,
    startX: number,
    startY: number,
    startPageIndex: number,
    ctx: LayoutContext,
    onPlacePage?: (box: LayoutBox, pageIndex: number) => void,
    parentCB?: ContainingBlockContext,
  ): LayoutResult {
    let currentY = startY;
    let pageIdx = startPageIndex;

    const dim = box.dimensions;
    const marginLeft = dim ? dim.margin.left : 0;
    const marginTop = dim ? dim.margin.top : 0;
    const marginBottom = dim ? dim.margin.bottom : 0;
    const paddingLeft = dim ? dim.padding.left : 0;
    const paddingRight = dim ? dim.padding.right : 0;
    const paddingTop = dim ? dim.padding.top : 0;
    const paddingBottom = dim ? dim.padding.bottom : 0;
    const borderLeft = dim ? dim.border.left : 0;
    const borderTop = dim ? dim.border.top : 0;
    const borderBottom = dim ? dim.border.bottom : 0;

    const isBreakBefore =
      box.style.breakBefore === "page" ||
      box.style.pageBreakBefore === "always";

    if (isBreakBefore) {
      if (currentY > ctx.margins.top) {
        pageIdx++;
        currentY = ctx.margins.top;
      }
    } else {
      currentY += marginTop;
    }

    const isBreakInsideAvoid =
      box.style.breakInside === "avoid" ||
      box.style.pageBreakInside === "avoid";

    if (isBreakInsideAvoid && currentY > ctx.margins.top) {
      const requiredH = this.estimateBoxHeight(box, ctx.printableWidth, ctx);
      if (
        currentY + requiredH > ctx.margins.top + ctx.printableHeight &&
        requiredH <= ctx.printableHeight
      ) {
        pageIdx++;
        currentY = ctx.margins.top;
      }
    }

    box.x = startX + marginLeft;
    box.y = currentY;
    box.pageIndex = pageIdx;
    if (onPlacePage) onPlacePage(box, pageIdx);

    const innerX = box.x + borderLeft + paddingLeft;
    const innerY = currentY + borderTop + paddingTop;
    const containerContentWidth =
      typeof box.style.width === "number"
        ? box.style.width
        : box.width > 0
          ? box.width
          : dim
            ? dim.contentWidth
            : ctx.printableWidth;

    const localAbsChildren: LayoutBox[] = [];
    const flowChildren: LayoutBox[] = [];

    for (const child of box.children) {
      if (child.style.position === "absolute") {
        child.pageIndex = pageIdx;
        localAbsChildren.push(child);
      } else {
        flowChildren.push(child);
      }
    }

    const isPositionedContainer =
      box.style.position === "relative" || box.style.position === "absolute";

    if (flowChildren.length === 0) {
      box.width = containerContentWidth;
      box.height = dim && dim.contentHeight > 0 ? dim.contentHeight : 0;
      const finalY =
        currentY +
        borderTop +
        paddingTop +
        box.height +
        paddingBottom +
        borderBottom +
        marginBottom;

      const currentPaddingBoxCB: ContainingBlockContext = {
        x: box.x + borderLeft,
        y: box.y + borderTop,
        width: box.width + paddingLeft + paddingRight,
        height: box.height + paddingTop + paddingBottom,
        pageIndex: box.pageIndex,
      };

      let remainingAbsChildren: LayoutBox[] = [];
      if (isPositionedContainer) {
        for (const absChild of localAbsChildren) {
          this.layoutAbsoluteBox(absChild, currentPaddingBoxCB, ctx);
        }
      } else {
        remainingAbsChildren = localAbsChildren;
      }

      if (box.style.position === "relative") {
        this.applyRelativeOffset(box, parentCB || currentPaddingBoxCB);
      }

      return {
        nextY: finalY,
        nextPageIndex: pageIdx,
        absChildren: remainingAbsChildren,
      };
    }

    const columnGap = box.style.columnGap || box.style.rowGap || 0;
    const rowGap = box.style.rowGap || box.style.columnGap || 0;

    const colTrackDefs = parseGridTrackList(box.style.gridTemplateColumns);

    let maxColIndex = colTrackDefs.length;
    for (const child of flowChildren) {
      const placement = getGridPlacement(child);
      if (placement.colStart !== null) {
        maxColIndex = Math.max(
          maxColIndex,
          placement.colStart + placement.colSpan,
        );
      }
    }
    const numCols = Math.max(maxColIndex, 1);

    while (colTrackDefs.length < numCols) {
      colTrackDefs.push({ type: "fr", val: 1 });
    }

    interface PlacedGridItem {
      child: LayoutBox;
      row: number;
      col: number;
      spanRows: number;
      spanCols: number;
    }

    const occupied: boolean[][] = [];
    const placedItems: PlacedGridItem[] = [];
    let autoRow = 0;
    let autoCol = 0;

    for (const child of flowChildren) {
      const p = getGridPlacement(child);
      let r: number;
      let c: number;

      if (p.rowStart !== null && p.colStart !== null) {
        r = p.rowStart;
        c = p.colStart;
      } else if (p.rowStart !== null && p.colStart === null) {
        r = p.rowStart;
        c = 0;
        while (!isCellAreaFree(occupied, r, c, p.rowSpan, p.colSpan, numCols)) {
          c++;
        }
      } else if (p.rowStart === null && p.colStart !== null) {
        c = p.colStart;
        r = 0;
        while (!isCellAreaFree(occupied, r, c, p.rowSpan, p.colSpan, numCols)) {
          r++;
        }
      } else {
        r = autoRow;
        c = autoCol;
        while (!isCellAreaFree(occupied, r, c, p.rowSpan, p.colSpan, numCols)) {
          c++;
          if (c + p.colSpan > numCols) {
            c = 0;
            r++;
          }
        }
        autoRow = r;
        autoCol = c + p.colSpan;
        if (autoCol >= numCols) {
          autoCol = 0;
          autoRow++;
        }
      }

      markCellAreaOccupied(occupied, r, c, p.rowSpan, p.colSpan);
      placedItems.push({
        child,
        row: r,
        col: c,
        spanRows: p.rowSpan,
        spanCols: p.colSpan,
      });
    }

    const totalColGaps = (numCols - 1) * columnGap;
    const availColWidth = Math.max(0, containerContentWidth - totalColGaps);

    const colWidths: number[] = new Array(numCols).fill(0);
    let usedColWidth = 0;
    let totalFr = 0;

    for (let i = 0; i < numCols; i++) {
      const def = colTrackDefs[i]!;
      if (def.type === "px") {
        colWidths[i] = def.val;
        usedColWidth += def.val;
      } else if (def.type === "percent") {
        const w = (def.val / 100) * containerContentWidth;
        colWidths[i] = w;
        usedColWidth += w;
      } else if (def.type === "auto") {
        let maxAutoW = 0;
        for (const item of placedItems) {
          if (item.col === i && item.spanCols === 1) {
            const res = this.layoutBlockBox(
              item.child,
              0,
              0,
              pageIdx,
              ctx,
              undefined,
            );
            if (res.absChildren) localAbsChildren.push(...res.absChildren);
            const getIntrinsicWidth = (b: LayoutBox): number => {
              if (typeof b.style.width === "number") return b.style.width;
              if (b.boxType === "Image") return b.width;
              let maxW = 0;
              for (const line of b.textLines) maxW = Math.max(maxW, line.width);
              for (const ch of b.children)
                maxW = Math.max(maxW, getIntrinsicWidth(ch));
              return maxW;
            };
            const measuredW = getIntrinsicWidth(item.child);
            maxAutoW = Math.max(maxAutoW, measuredW);
          }
        }
        colWidths[i] = maxAutoW;
        usedColWidth += maxAutoW;
      } else if (def.type === "fr") {
        totalFr += def.val;
      }
    }

    const remainingColWidth = Math.max(0, availColWidth - usedColWidth);
    if (totalFr > 0) {
      for (let i = 0; i < numCols; i++) {
        const def = colTrackDefs[i]!;
        if (def.type === "fr") {
          colWidths[i] = (def.val / totalFr) * remainingColWidth;
        }
      }
    }

    const colX: number[] = new Array(numCols).fill(0);
    let currColX = innerX;
    for (let i = 0; i < numCols; i++) {
      colX[i] = currColX;
      currColX += colWidths[i]! + columnGap;
    }

    const rowTrackDefs = parseGridTrackList(box.style.gridTemplateRows);
    let maxRowIdx = rowTrackDefs.length - 1;
    for (const item of placedItems) {
      maxRowIdx = Math.max(maxRowIdx, item.row + item.spanRows - 1);
    }
    const numRows = Math.max(maxRowIdx + 1, 1);

    while (rowTrackDefs.length < numRows) {
      rowTrackDefs.push({ type: "auto", val: 0 });
    }

    const rowHeights: number[] = new Array(numRows).fill(0);

    for (let r = 0; r < numRows; r++) {
      const def = rowTrackDefs[r]!;
      if (def.type === "px") {
        rowHeights[r] = def.val;
      } else if (def.type === "percent" && dim && dim.contentHeight > 0) {
        rowHeights[r] = (def.val / 100) * dim.contentHeight;
      } else {
        let maxRowH = 0;
        for (const item of placedItems) {
          if (item.row === r && item.spanRows === 1) {
            let cellW = 0;
            for (let c = item.col; c < item.col + item.spanCols; c++) {
              cellW += colWidths[c] ?? 0;
            }
            if (item.spanCols > 1) cellW += (item.spanCols - 1) * columnGap;
            if (item.child.dimensions)
              item.child.dimensions.contentWidth = cellW;
            item.child.width = cellW;

            const clearLines = (b: LayoutBox) => {
              b.textLines = [];
              for (const ch of b.children) clearLines(ch);
            };
            clearLines(item.child);

            const res = this.layoutBlockBox(
              item.child,
              0,
              0,
              pageIdx,
              ctx,
              undefined,
              cellW,
            );
            if (res.absChildren) localAbsChildren.push(...res.absChildren);
            maxRowH = Math.max(maxRowH, item.child.height);
          }
        }
        rowHeights[r] = maxRowH;
      }
    }

    const rowYPos: number[] = new Array(numRows).fill(0);
    const rowPageIndices: number[] = new Array(numRows).fill(0);

    let currRowY = innerY;
    let currRowPageIdx = pageIdx;

    for (let r = 0; r < numRows; r++) {
      const rH = rowHeights[r]!;
      if (currRowY + rH > ctx.margins.top + ctx.printableHeight && r > 0) {
        currRowPageIdx++;
        currRowY = ctx.margins.top;
      }
      rowYPos[r] = currRowY;
      rowPageIndices[r] = currRowPageIdx;
      currRowY += rH + rowGap;
    }

    pageIdx = currRowPageIdx;

    for (const item of placedItems) {
      let cellW = 0;
      for (let c = item.col; c < item.col + item.spanCols; c++) {
        cellW += colWidths[c] || 0;
      }
      cellW += (item.spanCols - 1) * columnGap;

      let cellH = 0;
      for (let r = item.row; r < item.row + item.spanRows; r++) {
        cellH += rowHeights[r] || 0;
      }
      cellH += (item.spanRows - 1) * rowGap;

      const cellX = colX[item.col]!;
      const cellY = rowYPos[item.row]!;
      const itemPageIndex = rowPageIndices[item.row]!;

      const justify =
        item.child.style.justifySelf !== "auto"
          ? item.child.style.justifySelf
          : box.style.justifyItems;
      const align =
        item.child.style.alignSelf !== "auto"
          ? item.child.style.alignSelf
          : box.style.alignItems;

      const childDim = item.child.dimensions;
      const mL = childDim ? childDim.margin.left : 0;
      const mR = childDim ? childDim.margin.right : 0;
      const mT = childDim ? childDim.margin.top : 0;
      const mB = childDim ? childDim.margin.bottom : 0;
      const pL = childDim ? childDim.padding.left : 0;
      const pR = childDim ? childDim.padding.right : 0;
      const pT = childDim ? childDim.padding.top : 0;
      const pB = childDim ? childDim.padding.bottom : 0;
      const bL = childDim ? childDim.border.left : 0;
      const bR = childDim ? childDim.border.right : 0;
      const bT = childDim ? childDim.border.top : 0;
      const bB = childDim ? childDim.border.bottom : 0;

      let targetW: number;
      if (typeof item.child.style.width === "number") {
        targetW = item.child.style.width;
      } else if (justify === "stretch") {
        targetW = Math.max(0, cellW - mL - mR - pL - pR - bL - bR);
      } else {
        targetW = item.child.width;
      }

      item.child.width = targetW;
      if (item.child.dimensions) {
        item.child.dimensions.contentWidth = targetW;
      }
      const clearLines = (b: LayoutBox) => {
        b.textLines = [];
        for (const ch of b.children) clearLines(ch);
      };
      clearLines(item.child);

      const res = this.layoutBlockBox(
        item.child,
        0,
        0,
        itemPageIndex,
        ctx,
        undefined,
        targetW,
      );
      if (res.absChildren) localAbsChildren.push(...res.absChildren);

      const totalItemW = item.child.width + pL + pR + bL + bR;
      const totalItemH = item.child.height + pT + pB + bT + bB;

      let finalX = cellX + mL;
      if (justify === "end" || justify === "flex-end") {
        finalX = cellX + cellW - mR - totalItemW;
      } else if (justify === "center") {
        finalX = cellX + mL + (cellW - mL - mR - totalItemW) / 2;
      }

      let finalY = cellY + mT;
      if (align === "end" || align === "flex-end") {
        finalY = cellY + cellH - mB - totalItemH;
      } else if (align === "center") {
        finalY = cellY + mT + (cellH - mT - mB - totalItemH) / 2;
      }

      const dx = finalX - item.child.x;
      const dy = finalY - item.child.y;
      const pageDelta = itemPageIndex - item.child.pageIndex;
      offsetBoxPosition(item.child, dx, dy, pageDelta);
      if (onPlacePage) onPlacePage(item.child, itemPageIndex);
    }

    const gridTotalH = Math.max(0, currRowY - rowGap - innerY);
    box.width = containerContentWidth;
    box.height = dim && dim.contentHeight > 0 ? dim.contentHeight : gridTotalH;

    let finalY =
      currentY +
      borderTop +
      paddingTop +
      box.height +
      paddingBottom +
      borderBottom +
      marginBottom;

    const isBreakAfter =
      box.style.breakAfter === "page" ||
      box.style.pageBreakAfter === "always";

    if (isBreakAfter) {
      pageIdx++;
      finalY = ctx.margins.top;
    }

    const currentPaddingBoxCB: ContainingBlockContext = {
      x: box.x + borderLeft,
      y: box.y + borderTop,
      width: box.width + paddingLeft + paddingRight,
      height: box.height + paddingTop + paddingBottom,
      pageIndex: box.pageIndex,
    };

    let remainingAbsChildren: LayoutBox[] = [];
    if (isPositionedContainer) {
      for (const absChild of localAbsChildren) {
        this.layoutAbsoluteBox(absChild, currentPaddingBoxCB, ctx);
      }
    } else {
      remainingAbsChildren = localAbsChildren;
    }

    if (box.style.position === "relative") {
      this.applyRelativeOffset(box, parentCB || currentPaddingBoxCB);
    }

    return {
      nextY: finalY,
      nextPageIndex: pageIdx,
      absChildren: remainingAbsChildren,
    };
  }

  private layoutTableBox(
    box: LayoutBox,
    startX: number,
    startY: number,
    startPageIndex: number,
    ctx: LayoutContext,
    onPlacePage?: (box: LayoutBox, pageIndex: number) => void,
    parentCB?: ContainingBlockContext,
  ): LayoutResult {
    let currentY = startY;
    let pageIdx = startPageIndex;

    const dim = box.dimensions;
    const marginLeft = dim ? dim.margin.left : 0;
    const marginTop = dim ? dim.margin.top : 0;
    const marginBottom = dim ? dim.margin.bottom : 0;
    const paddingLeft = dim ? dim.padding.left : 0;
    const paddingRight = dim ? dim.padding.right : 0;
    const paddingTop = dim ? dim.padding.top : 0;
    const paddingBottom = dim ? dim.padding.bottom : 0;
    const borderLeft = dim ? dim.border.left : 0;
    const borderTop = dim ? dim.border.top : 0;
    const borderBottom = dim ? dim.border.bottom : 0;

    const isBreakBefore =
      box.style.breakBefore === "page" ||
      box.style.pageBreakBefore === "always";

    if (isBreakBefore) {
      if (currentY > ctx.margins.top) {
        pageIdx++;
        currentY = ctx.margins.top;
      }
    } else {
      currentY += marginTop;
    }

    const isBreakInsideAvoid =
      box.style.breakInside === "avoid" ||
      box.style.pageBreakInside === "avoid";

    if (isBreakInsideAvoid && currentY > ctx.margins.top) {
      const requiredH = this.estimateBoxHeight(box, ctx.printableWidth, ctx);
      if (
        currentY + requiredH > ctx.margins.top + ctx.printableHeight &&
        requiredH <= ctx.printableHeight
      ) {
        pageIdx++;
        currentY = ctx.margins.top;
      }
    }

    box.x = startX + marginLeft;
    box.y = currentY;
    box.pageIndex = pageIdx;
    if (onPlacePage) onPlacePage(box, pageIdx);

    const innerX = box.x + borderLeft + paddingLeft;
    const innerY = currentY + borderTop + paddingTop;
    const tableWidth =
      typeof box.style.width === "number"
        ? box.style.width
        : box.width > 0
          ? box.width
          : dim && dim.contentWidth > 0
            ? dim.contentWidth
            : ctx.printableWidth;

    const localAbsChildren: LayoutBox[] = [];

    const headerRows: LayoutBox[] = [];
    const bodyRows: LayoutBox[] = [];
    const footerRows: LayoutBox[] = [];

    const collectRows = (
      b: LayoutBox,
      group: "header" | "body" | "footer" | "auto",
    ) => {
      for (const child of b.children) {
        if (child.style.position === "absolute") {
          child.pageIndex = pageIdx;
          localAbsChildren.push(child);
          continue;
        }

        const tag = child.node instanceof ElementNode ? child.node.tagName : "";
        const disp = child.style.display;

        if (disp === "table-header-group" || tag === "thead") {
          collectRows(child, "header");
        } else if (disp === "table-footer-group" || tag === "tfoot") {
          collectRows(child, "footer");
        } else if (disp === "table-row-group" || tag === "tbody") {
          collectRows(child, "body");
        } else if (
          disp === "table-row" ||
          child.boxType === "TableRow" ||
          tag === "tr"
        ) {
          if (group === "header") headerRows.push(child);
          else if (group === "footer") footerRows.push(child);
          else bodyRows.push(child);
        } else if (
          child.children.some(
            (c) => c.boxType === "TableRow" || c.style.display === "table-row",
          )
        ) {
          collectRows(child, group);
        } else {
          if (group === "header") headerRows.push(child);
          else if (group === "footer") footerRows.push(child);
          else bodyRows.push(child);
        }
      }
    };

    collectRows(box, "auto");

    const allRows = [...headerRows, ...bodyRows, ...footerRows];
    if (allRows.length === 0) {
      box.width = tableWidth;
      box.height = dim && dim.contentHeight > 0 ? dim.contentHeight : 0;
      const finalY =
        currentY +
        borderTop +
        paddingTop +
        box.height +
        paddingBottom +
        borderBottom +
        marginBottom;
      return {
        nextY: finalY,
        nextPageIndex: pageIdx,
        absChildren: localAbsChildren,
      };
    }

    interface TableCellPos {
      cell: LayoutBox;
      row: number;
      col: number;
      spanRows: number;
      spanCols: number;
    }

    const cellPositions: TableCellPos[] = [];
    const occupiedUntilRow: number[] = [];
    let numCols = 0;

    for (let r = 0; r < allRows.length; r++) {
      const rowBox = allRows[r]!;
      let c = 0;
      for (const cell of rowBox.children) {
        if (cell.style.position === "absolute") continue;

        while ((occupiedUntilRow[c] ?? 0) > r) {
          c++;
        }
        let colspan = 1;
        let rowspan = 1;
        if (cell.node instanceof ElementNode) {
          const cs = cell.node.getAttribute("colspan");
          const rs = cell.node.getAttribute("rowspan");
          if (cs) {
            const p = parseInt(cs, 10);
            if (!isNaN(p) && p > 1) colspan = p;
          }
          if (rs) {
            const p = parseInt(rs, 10);
            if (!isNaN(p) && p > 1) rowspan = p;
          }
        }

        const untilRow = r + rowspan;
        for (let cc = c; cc < c + colspan; cc++) {
          occupiedUntilRow[cc] = untilRow;
        }

        cellPositions.push({
          cell,
          row: r,
          col: c,
          spanRows: rowspan,
          spanCols: colspan,
        });
        numCols = Math.max(numCols, c + colspan);
        c += colspan;
      }
    }

    numCols = Math.max(numCols, 1);

    const colWidths: number[] = new Array(numCols).fill(0);
    const explicitColWidths: (number | null)[] = new Array(numCols).fill(null);

    for (const item of cellPositions) {
      if (item.spanCols === 1) {
        let w: number | null = null;
        if (typeof item.cell.style.width === "number") {
          w = item.cell.style.width;
        } else if (item.cell.node instanceof ElementNode) {
          const attrW = item.cell.node.getAttribute("width");
          if (attrW) {
            w = parseCssUnit(attrW, tableWidth);
          }
        }
        if (w !== null && w > 0) {
          explicitColWidths[item.col] = Math.max(
            explicitColWidths[item.col] ?? 0,
            w,
          );
        }
      }
    }

    let totalExplicit = 0;
    let autoColCount = 0;
    for (let i = 0; i < numCols; i++) {
      if (explicitColWidths[i] !== null) {
        colWidths[i] = explicitColWidths[i]!;
        totalExplicit += explicitColWidths[i]!;
      } else {
        autoColCount++;
      }
    }

    if (autoColCount > 0) {
      const remainingW = Math.max(0, tableWidth - totalExplicit);
      const autoW = remainingW / autoColCount;
      for (let i = 0; i < numCols; i++) {
        if (explicitColWidths[i] === null) {
          colWidths[i] = autoW;
        }
      }
    } else if (totalExplicit > 0 && Math.abs(totalExplicit - tableWidth) > 0.1) {
      const scale = tableWidth / totalExplicit;
      for (let i = 0; i < numCols; i++) {
        colWidths[i] = colWidths[i]! * scale;
      }
    } else if (totalExplicit === 0) {
      const autoW = tableWidth / numCols;
      for (let i = 0; i < numCols; i++) {
        colWidths[i] = autoW;
      }
    }

    const colX: number[] = new Array(numCols).fill(0);
    let currColX = innerX;
    for (let i = 0; i < numCols; i++) {
      colX[i] = currColX;
      currColX += colWidths[i]!;
    }

    const layoutRow = (
      rowBox: LayoutBox,
      rowY: number,
      rowPageIdx: number,
    ): number => {
      rowBox.x = innerX;
      rowBox.y = rowY;
      rowBox.width = tableWidth;
      rowBox.pageIndex = rowPageIdx;
      if (onPlacePage) onPlacePage(rowBox, rowPageIdx);

      let maxRowH = 0;
      const rowCells = cellPositions.filter(
        (cp) => rowBox.children.includes(cp.cell),
      );

      for (const item of rowCells) {
        let cellW = 0;
        for (let c = item.col; c < item.col + item.spanCols; c++) {
          cellW += colWidths[c] ?? 0;
        }

        const cellDim = item.cell.dimensions;
        const pL = cellDim ? cellDim.padding.left : 0;
        const pR = cellDim ? cellDim.padding.right : 0;
        const bL = cellDim ? cellDim.border.left : 0;
        const bR = cellDim ? cellDim.border.right : 0;
        const pT = cellDim ? cellDim.padding.top : 0;
        const pB = cellDim ? cellDim.padding.bottom : 0;
        const bT = cellDim ? cellDim.border.top : 0;
        const bB = cellDim ? cellDim.border.bottom : 0;

        const cellContentW = Math.max(0, cellW - pL - pR - bL - bR);
        item.cell.width = cellContentW;
        if (item.cell.dimensions) {
          item.cell.dimensions.contentWidth = cellContentW;
        }

        clearTextLines(item.cell);

        const cellX = colX[item.col]! + (cellDim ? cellDim.margin.left : 0);
        const cellY = rowY + (cellDim ? cellDim.margin.top : 0);

        const res = this.layoutBlockBox(
          item.cell,
          cellX,
          cellY,
          rowPageIdx,
          ctx,
          onPlacePage,
          cellContentW,
        );
        if (res.absChildren) localAbsChildren.push(...res.absChildren);

        const cellOuterH = item.cell.height + pT + pB + bT + bB;
        maxRowH = Math.max(maxRowH, cellOuterH);
      }

      if (typeof rowBox.style.height === "number") {
        maxRowH = Math.max(maxRowH, rowBox.style.height);
      }
      rowBox.height = maxRowH;

      for (const item of rowCells) {
        const cellDim = item.cell.dimensions;
        const pT = cellDim ? cellDim.padding.top : 0;
        const pB = cellDim ? cellDim.padding.bottom : 0;
        const bT = cellDim ? cellDim.border.top : 0;
        const bB = cellDim ? cellDim.border.bottom : 0;
        const oldContentH = item.cell.height;
        const newContentH = Math.max(
          oldContentH,
          maxRowH - pT - pB - bT - bB,
        );
        item.cell.height = newContentH;

        const vAlign = item.cell.style.verticalAlign;
        if (
          (vAlign === "middle" || vAlign === "bottom") &&
          newContentH > oldContentH
        ) {
          const deltaY =
            vAlign === "middle"
              ? (newContentH - oldContentH) / 2
              : newContentH - oldContentH;
          if (deltaY > 0) {
            shiftBoxVertical(item.cell, deltaY);
          }
        }
      }

      return maxRowH;
    };

    let headerHeight = 0;
    let currRowY = innerY;
    let currPageIdx = pageIdx;

    for (const hRow of headerRows) {
      const rH = layoutRow(hRow, currRowY, currPageIdx);
      currRowY += rH;
      headerHeight += rH;
    }

    const printableBottom = ctx.margins.top + ctx.printableHeight;

    for (const bRow of bodyRows) {
      const isTrBreakBefore =
        bRow.style.breakBefore === "page" ||
        bRow.style.pageBreakBefore === "always";

      const isTrBreakInsideAvoid =
        bRow.style.breakInside === "avoid" ||
        bRow.style.pageBreakInside === "avoid";

      const rH = layoutRow(bRow, currRowY, currPageIdx);

      if (isTrBreakBefore && currRowY > ctx.margins.top) {
        currPageIdx++;
        currRowY = ctx.margins.top;

        if (headerRows.length > 0) {
          const headerDy = currRowY - innerY;
          const headerPageDelta = currPageIdx - pageIdx;
          for (const hRow of headerRows) {
            const clonedH = cloneLayoutBox(hRow, headerDy, headerPageDelta);
            box.addChild(clonedH);
            currRowY += clonedH.height;
          }
        }
        layoutRow(bRow, currRowY, currPageIdx);
        currRowY += bRow.height;
      } else if (
        (currRowY + rH > printableBottom || isTrBreakInsideAvoid) &&
        currRowY + rH > printableBottom &&
        currRowY > ctx.margins.top
      ) {
        currPageIdx++;
        currRowY = ctx.margins.top;

        if (headerRows.length > 0) {
          const headerDy = currRowY - innerY;
          const headerPageDelta = currPageIdx - pageIdx;
          for (const hRow of headerRows) {
            const clonedH = cloneLayoutBox(hRow, headerDy, headerPageDelta);
            box.addChild(clonedH);
            currRowY += clonedH.height;
          }
        }

        layoutRow(bRow, currRowY, currPageIdx);
        currRowY += bRow.height;
      } else {
        currRowY += rH;
      }

      while (currRowY > printableBottom + ctx.printableHeight) {
        currPageIdx++;
        currRowY -= ctx.printableHeight;
      }
    }

    if (footerRows.length > 0) {
      let footerTotalH = 0;
      for (const fRow of footerRows) {
        const rH = layoutRow(fRow, currRowY, currPageIdx);
        footerTotalH += rH;
      }

      if (
        currRowY + footerTotalH > printableBottom &&
        currRowY > ctx.margins.top
      ) {
        currPageIdx++;
        currRowY = ctx.margins.top;
        if (headerRows.length > 0) {
          const headerDy = currRowY - innerY;
          const headerPageDelta = currPageIdx - pageIdx;
          for (const hRow of headerRows) {
            const clonedH = cloneLayoutBox(hRow, headerDy, headerPageDelta);
            box.addChild(clonedH);
            currRowY += clonedH.height;
          }
        }
        for (const fRow of footerRows) {
          const rH = layoutRow(fRow, currRowY, currPageIdx);
          currRowY += rH;
        }
      } else {
        currRowY += footerTotalH;
      }
    }

    const tableTotalH = Math.max(0, currRowY - innerY);
    box.width = tableWidth;
    box.height = dim && dim.contentHeight > 0 ? dim.contentHeight : tableTotalH;

    let finalY =
      currentY +
      borderTop +
      paddingTop +
      box.height +
      paddingBottom +
      borderBottom +
      marginBottom;

    const isBreakAfter =
      box.style.breakAfter === "page" ||
      box.style.pageBreakAfter === "always";

    if (isBreakAfter) {
      currPageIdx++;
      finalY = ctx.margins.top;
    }

    const isPositionedContainer =
      box.style.position === "relative" || box.style.position === "absolute";

    const currentPaddingBoxCB: ContainingBlockContext = {
      x: box.x + borderLeft,
      y: box.y + borderTop,
      width: box.width + paddingLeft + paddingRight,
      height: box.height + paddingTop + paddingBottom,
      pageIndex: box.pageIndex,
    };

    let remainingAbsChildren: LayoutBox[] = [];
    if (isPositionedContainer) {
      for (const absChild of localAbsChildren) {
        this.layoutAbsoluteBox(absChild, currentPaddingBoxCB, ctx);
      }
    } else {
      remainingAbsChildren = localAbsChildren;
    }

    if (box.style.position === "relative") {
      this.applyRelativeOffset(box, parentCB || currentPaddingBoxCB);
    }

    return {
      nextY: finalY,
      nextPageIndex: currPageIdx,
      absChildren: remainingAbsChildren,
    };
  }

  private layoutAbsoluteBox(
    absBox: LayoutBox,
    cb: ContainingBlockContext,
    ctx: LayoutContext,
  ): void {
    const dim =
      absBox.dimensions ?? createBoxDimensions(absBox.style, cb.width);
    absBox.dimensions = dim;

    const mL = dim.margin.left;
    const mR = dim.margin.right;
    const mT = dim.margin.top;
    const mB = dim.margin.bottom;
    const pL = dim.padding.left;
    const pR = dim.padding.right;
    const pT = dim.padding.top;
    const pB = dim.padding.bottom;
    const bL = dim.border.left;
    const bR = dim.border.right;
    const bT = dim.border.top;
    const bB = dim.border.bottom;

    const extraH = mL + mR + pL + pR + bL + bR;
    const extraV = mT + mB + pT + pB + bT + bB;

    const topOffset = resolveOffset(absBox.style.top, cb.height);
    const bottomOffset = resolveOffset(absBox.style.bottom, cb.height);
    const leftOffset = resolveOffset(absBox.style.left, cb.width);
    const rightOffset = resolveOffset(absBox.style.right, cb.width);

    // 1. Determine Target Content Width
    let targetWidth: number;
    if (
      leftOffset !== "auto" &&
      rightOffset !== "auto" &&
      absBox.style.width === "auto"
    ) {
      targetWidth = Math.max(0, cb.width - leftOffset - rightOffset - extraH);
    } else if (typeof absBox.style.width === "number") {
      targetWidth = absBox.style.width;
    } else {
      const maxAvail =
        leftOffset !== "auto"
          ? Math.max(0, cb.width - leftOffset - extraH)
          : Math.max(0, cb.width - extraH);
      targetWidth = maxAvail;
    }

    dim.contentWidth = targetWidth;
    absBox.width = targetWidth;

    clearTextLines(absBox);

    const targetPageIndex = cb.pageIndex;

    const absCB: ContainingBlockContext = {
      x: 0,
      y: 0,
      width: targetWidth,
      height: 0,
      pageIndex: targetPageIndex,
    };

    const res = this.layoutBlockBox(
      absBox,
      0,
      0,
      targetPageIndex,
      ctx,
      undefined,
      targetWidth,
      absCB,
    );

    // Handle nested absolute children returned from absBox layout if absBox wasn't positioned itself
    if (res.absChildren && res.absChildren.length > 0) {
      const absPaddingCB: ContainingBlockContext = {
        x: absBox.x + bL,
        y: absBox.y + bT,
        width: absBox.width + pL + pR,
        height: absBox.height + pT + pB,
        pageIndex: absBox.pageIndex,
      };
      for (const child of res.absChildren) {
        this.layoutAbsoluteBox(child, absPaddingCB, ctx);
      }
    }

    // 2. Determine Target Content Height
    if (
      topOffset !== "auto" &&
      bottomOffset !== "auto" &&
      absBox.style.height === "auto"
    ) {
      const stretchedH = Math.max(
        0,
        cb.height - topOffset - bottomOffset - extraV,
      );
      dim.contentHeight = stretchedH;
      absBox.height = stretchedH;
    }

    const boxTotalWidth = absBox.width + pL + pR + bL + bR;
    const boxTotalHeight = absBox.height + pT + pB + bT + bB;

    // 3. Calculate Final X
    let finalX: number;
    if (leftOffset !== "auto") {
      finalX = cb.x + leftOffset + mL;
    } else if (rightOffset !== "auto") {
      finalX = cb.x + cb.width - rightOffset - mR - boxTotalWidth;
    } else {
      finalX = cb.x + mL;
    }

    // 4. Calculate Final Y
    let finalY: number;
    if (topOffset !== "auto") {
      finalY = cb.y + topOffset + mT;
    } else if (bottomOffset !== "auto") {
      finalY = cb.y + cb.height - bottomOffset - mB - boxTotalHeight;
    } else {
      finalY = cb.y + mT;
    }

    // 5. Shift absBox and all its contents to (finalX, finalY)
    const dx = finalX - absBox.x;
    const dy = finalY - absBox.y;
    const pageIndexDelta = targetPageIndex - absBox.pageIndex;
    offsetBoxPosition(absBox, dx, dy, pageIndexDelta);
    absBox.pageIndex = targetPageIndex;
  }

  private applyRelativeOffset(
    box: LayoutBox,
    cb: ContainingBlockContext,
  ): void {
    const topOffset = resolveOffset(box.style.top, cb.height);
    const bottomOffset = resolveOffset(box.style.bottom, cb.height);
    const leftOffset = resolveOffset(box.style.left, cb.width);
    const rightOffset = resolveOffset(box.style.right, cb.width);

    let dx = 0;
    if (leftOffset !== "auto") {
      dx = leftOffset;
    } else if (rightOffset !== "auto") {
      dx = -rightOffset;
    }

    let dy = 0;
    if (topOffset !== "auto") {
      dy = topOffset;
    } else if (bottomOffset !== "auto") {
      dy = -bottomOffset;
    }

    if (dx !== 0 || dy !== 0) {
      offsetBoxPosition(box, dx, dy, 0);
    }
  }

  private estimateBoxHeight(
    box: LayoutBox,
    parentContainerWidth: number,
    ctx: LayoutContext,
  ): number {
    const dim = box.dimensions;
    const marginTop = dim ? dim.margin.top : 0;
    const marginBottom = dim ? dim.margin.bottom : 0;
    const paddingTop = dim ? dim.padding.top : 0;
    const paddingBottom = dim ? dim.padding.bottom : 0;
    const borderTop = dim ? dim.border.top : 0;
    const borderBottom = dim ? dim.border.bottom : 0;
    const verticalExtras =
      marginTop +
      marginBottom +
      paddingTop +
      paddingBottom +
      borderTop +
      borderBottom;

    if (typeof box.style.height === "number") {
      return box.style.height + verticalExtras;
    }

    if (box.boxType === "Image" && box.imageInfo) {
      return box.imageInfo.height + verticalExtras;
    }

    if (box.boxType === "Text" && box.node instanceof TextNode) {
      const font = ctx.fontManager.resolveFont(
        box.style.fontFamily,
        box.style.fontWeight,
        box.style.fontStyle,
      );
      const fontSize = box.style.fontSize;
      const letterSpacing = box.style.letterSpacing || 0;
      const wordSpacing = box.style.wordSpacing || 0;

      let lineHeight = font.getLineHeight(fontSize) * 1.2;
      if (typeof box.style.lineHeight === "number") {
        if (box.style.lineHeight <= 5) {
          lineHeight = font.getLineHeight(fontSize) * box.style.lineHeight;
        } else {
          lineHeight = box.style.lineHeight;
        }
      }

      const transformedText = applyTextTransform(
        box.node.text,
        box.style.textTransform,
      );
      const maxWrapWidth =
        parentContainerWidth > 0 ? parentContainerWidth : ctx.printableWidth;

      if (box.style.whiteSpace === "nowrap") {
        return lineHeight + verticalExtras;
      }

      const words = transformedText.split(" ");
      let lineCount = 0;
      let currentLineText = "";

      for (let i = 0; i < words.length; i++) {
        const word = words[i] ?? "";
        const testText = currentLineText ? `${currentLineText} ${word}` : word;
        const testWidth = font.measureTextWidth(
          testText,
          fontSize,
          letterSpacing,
          wordSpacing,
        );
        const lineIndent = lineCount === 0 ? box.style.textIndent || 0 : 0;
        const availWidth = maxWrapWidth - lineIndent;

        if (testWidth > availWidth && currentLineText) {
          lineCount++;
          currentLineText = word;
        } else {
          currentLineText = testText;
        }
      }
      if (currentLineText) {
        lineCount++;
      }
      return Math.max(1, lineCount) * lineHeight + verticalExtras;
    }

    const containerContentWidth =
      dim && dim.contentWidth > 0
        ? dim.contentWidth
        : parentContainerWidth > 0
          ? parentContainerWidth
          : ctx.printableWidth;

    if (
      box.boxType === "Flex" ||
      box.style.display === "flex" ||
      box.style.display === "inline-flex"
    ) {
      const isRow =
        box.style.flexDirection === "row" ||
        box.style.flexDirection === "row-reverse";
      const flexWrap = box.style.flexWrap || "nowrap";
      const rowGap = box.style.rowGap || 0;
      const columnGap = box.style.columnGap || 0;
      const flowChildren = box.children.filter(
        (c) => c.style.position !== "absolute",
      );

      if (flowChildren.length === 0) {
        return verticalExtras;
      }

      if (isRow && flexWrap === "nowrap") {
        let maxChildH = 0;
        const itemW =
          (containerContentWidth - (flowChildren.length - 1) * columnGap) /
          flowChildren.length;
        for (const child of flowChildren) {
          maxChildH = Math.max(
            maxChildH,
            this.estimateBoxHeight(child, itemW, ctx),
          );
        }
        return maxChildH + verticalExtras;
      } else {
        let totalH = 0;
        for (const child of flowChildren) {
          totalH +=
            this.estimateBoxHeight(child, containerContentWidth, ctx) + rowGap;
        }
        return Math.max(0, totalH - rowGap) + verticalExtras;
      }
    }

    if (
      box.boxType === "Grid" ||
      box.style.display === "grid" ||
      box.style.display === "inline-grid"
    ) {
      const rowGap = box.style.rowGap || 0;
      const flowChildren = box.children.filter(
        (c) => c.style.position !== "absolute",
      );
      let totalH = 0;
      for (const child of flowChildren) {
        totalH +=
          this.estimateBoxHeight(child, containerContentWidth, ctx) + rowGap;
      }
      return Math.max(0, totalH - rowGap) + verticalExtras;
    }

    let contentHeight = 0;
    for (const child of box.children) {
      if (child.style.position === "absolute") continue;
      contentHeight += this.estimateBoxHeight(child, containerContentWidth, ctx);
    }

    let estH = contentHeight;
    if (box.style.minHeight !== "none" && typeof box.style.minHeight === "number") {
      estH = Math.max(estH, box.style.minHeight);
    }
    if (box.style.maxHeight !== "none" && typeof box.style.maxHeight === "number") {
      estH = Math.min(estH, box.style.maxHeight);
    }

    return estH + verticalExtras;
  }
}

function cloneLayoutBox(
  box: LayoutBox,
  dy: number,
  pageIndexDelta: number,
): LayoutBox {
  const cloned = new LayoutBox(
    box.boxType,
    box.style,
    box.node,
    box.dimensions ? { ...box.dimensions } : undefined,
  );
  cloned.x = box.x;
  cloned.y = box.y + dy;
  cloned.width = box.width;
  cloned.height = box.height;
  cloned.pageIndex = box.pageIndex + pageIndexDelta;
  if (box.linkUrl !== undefined) {
    cloned.linkUrl = box.linkUrl;
  }
  if (box.imageInfo) {
    cloned.imageInfo = { ...box.imageInfo };
  }
  for (const line of box.textLines) {
    cloned.textLines.push({
      ...line,
      y: line.y + dy,
      pageIndex: line.pageIndex + pageIndexDelta,
    });
  }
  for (const child of box.children) {
    cloned.addChild(cloneLayoutBox(child, dy, pageIndexDelta));
  }
  return cloned;
}

function isAncestorClipped(box: LayoutBox | null): boolean {
  let curr = box;
  while (curr) {
    if (
      curr.style.overflow === "hidden" ||
      curr.style.overflowY === "hidden"
    ) {
      return true;
    }
    curr = curr.parent;
  }
  return false;
}

function shiftBoxVertical(box: LayoutBox, deltaY: number): void {
  for (const child of box.children) {
    child.y += deltaY;
    shiftBoxVertical(child, deltaY);
  }
  if (box.textLines) {
    for (const line of box.textLines) {
      line.y += deltaY;
    }
  }
}


