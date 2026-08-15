import { BaseNode } from "../html/dom/node.js";
import { ComputedStyle } from "../css/computed-style.js";
import { BoxDimensions } from "./box-model.js";
import { ParsedImageData } from "../pdf/pdf-image.js";

export type BoxType =
  | "Block"
  | "Inline"
  | "Text"
  | "Table"
  | "TableRow"
  | "TableCell"
  | "Image"
  | "Flex"
  | "Grid";

export interface TextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
}

export class LayoutBox {
  public pageIndex: number = 0;
  public x: number = 0;
  public y: number = 0;
  public width: number = 0;
  public height: number = 0;

  public parent: LayoutBox | null = null;
  public children: LayoutBox[] = [];
  public textLines: TextLine[] = [];
  public linkUrl?: string;
  public anchorId?: string;
  public imageInfo?: {
    src: string;
    imageData: ParsedImageData;
    width: number;
    height: number;
  };
  public bgImageInfo?: {
    imageData: ParsedImageData;
    position: string;
    size: string;
    repeat: "repeat" | "repeat-x" | "repeat-y" | "no-repeat";
  };

  constructor(
    public readonly boxType: BoxType,
    public readonly style: ComputedStyle,
    public readonly node?: BaseNode,
    public dimensions?: BoxDimensions,
  ) {}

  addChild(child: LayoutBox): void {
    child.parent = this;
    this.children.push(child);
  }

  get totalWidth(): number {
    if (!this.dimensions) return this.width;
    const d = this.dimensions;
    return (
      this.width +
      d.padding.left +
      d.padding.right +
      d.border.left +
      d.border.right +
      d.margin.left +
      d.margin.right
    );
  }

  get totalHeight(): number {
    if (!this.dimensions) return this.height;
    const d = this.dimensions;
    return (
      this.height +
      d.padding.top +
      d.padding.bottom +
      d.border.top +
      d.border.bottom +
      d.margin.top +
      d.margin.bottom
    );
  }
}
