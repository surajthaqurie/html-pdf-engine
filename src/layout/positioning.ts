import { LayoutBox } from "./layout-box.js";

export interface ContainingBlockContext {
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

/**
 * Recursively offsets a box, its text lines, and child boxes by (dx, dy)
 * and adjusts pageIndex by pageIndexDelta.
 */
export function offsetBoxPosition(
  box: LayoutBox,
  dx: number,
  dy: number,
  pageIndexDelta: number = 0,
): void {
  box.x += dx;
  box.y += dy;
  box.pageIndex += pageIndexDelta;
  if (box.textLines) {
    for (const line of box.textLines) {
      line.x += dx;
      line.y += dy;
      line.pageIndex += pageIndexDelta;
    }
  }
  for (const child of box.children) {
    offsetBoxPosition(child, dx, dy, pageIndexDelta);
  }
}

/**
 * Recursively clears text lines from a box subtree before re-laying out an absolute element.
 */
export function clearTextLines(box: LayoutBox): void {
  box.textLines = [];
  for (const child of box.children) {
    clearTextLines(child);
  }
}
