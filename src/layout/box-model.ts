import { ComputedStyle } from "../css/computed-style.js";

export interface BoxSpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BoxDimensions {
  contentWidth: number;
  contentHeight: number;
  padding: BoxSpacing;
  border: BoxSpacing;
  margin: BoxSpacing;
}

export function createBoxDimensions(
  style: ComputedStyle,
  parentContentWidth: number,
): BoxDimensions {
  const margin: BoxSpacing = {
    top: style.marginTop,
    right: style.marginRight,
    bottom: style.marginBottom,
    left: style.marginLeft,
  };

  const padding: BoxSpacing = {
    top: style.paddingTop,
    right: style.paddingRight,
    bottom: style.paddingBottom,
    left: style.paddingLeft,
  };

  const border: BoxSpacing = {
    top: style.borderTopWidth,
    right: style.borderRightWidth,
    bottom: style.borderBottomWidth,
    left: style.borderLeftWidth,
  };

  let contentWidth = 0;
  if (style.width === "auto") {
    contentWidth = Math.max(
      0,
      parentContentWidth -
        margin.left -
        margin.right -
        padding.left -
        padding.right -
        border.left -
        border.right,
    );
  } else {
    contentWidth = style.width;
  }

  if (style.minWidth !== "none" && typeof style.minWidth === "number") {
    contentWidth = Math.max(contentWidth, style.minWidth);
  }
  if (style.maxWidth !== "none" && typeof style.maxWidth === "number") {
    contentWidth = Math.min(contentWidth, style.maxWidth);
  }
  contentWidth = Math.max(0, contentWidth);

  let contentHeight = style.height === "auto" ? 0 : style.height;
  if (style.height !== "auto") {
    if (style.minHeight !== "none" && typeof style.minHeight === "number") {
      contentHeight = Math.max(contentHeight, style.minHeight);
    }
    if (style.maxHeight !== "none" && typeof style.maxHeight === "number") {
      contentHeight = Math.min(contentHeight, style.maxHeight);
    }
    contentHeight = Math.max(0, contentHeight);
  }

  return {
    contentWidth,
    contentHeight,
    padding,
    border,
    margin,
  };
}
