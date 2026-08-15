import { ColorRGB } from "../pdf/pdf-content.js";
import { ParsedImageData } from "../pdf/pdf-image.js";
import { TextDecoration } from "../css/computed-style.js";

export type PaintCommandType =
  | "text"
  | "rectangle"
  | "line"
  | "image"
  | "link"
  | "clipStart"
  | "clipEnd";

export interface BasePaintCommand {
  pageIndex: number;
  zIndex?: number | "auto" | undefined;
  isFixed?: boolean | undefined;
}

export interface DrawTextPaintCommand extends BasePaintCommand {
  type: "text";
  text: string;
  x: number;
  y: number;
  fontAlias: string;
  fontName?: string | undefined;
  fontWeight?: "normal" | "bold" | number | string | undefined;
  fontStyle?: "normal" | "italic" | "oblique" | undefined;
  fontSize: number;
  color: ColorRGB;
  letterSpacing?: number | undefined;
  wordSpacing?: number | undefined;
  textDecoration?: TextDecoration | undefined;
}

export interface BorderRadiusConfig {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

export interface DrawRectanglePaintCommand extends BasePaintCommand {
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: ColorRGB | undefined;
  strokeColor?: ColorRGB | undefined;
  lineWidth?: number | undefined;

  borderTopWidth?: number | undefined;
  borderRightWidth?: number | undefined;
  borderBottomWidth?: number | undefined;
  borderLeftWidth?: number | undefined;

  borderTopColor?: ColorRGB | undefined;
  borderRightColor?: ColorRGB | undefined;
  borderBottomColor?: ColorRGB | undefined;
  borderLeftColor?: ColorRGB | undefined;

  borderTopStyle?: string | undefined;
  borderRightStyle?: string | undefined;
  borderBottomStyle?: string | undefined;
  borderLeftStyle?: string | undefined;

  borderRadius?: BorderRadiusConfig | undefined;
}

export interface DrawLinePaintCommand extends BasePaintCommand {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor?: ColorRGB | undefined;
  lineWidth?: number | undefined;
  lineStyle?: "solid" | "dashed" | "dotted" | undefined;
}

export interface DrawImagePaintCommand extends BasePaintCommand {
  type: "image";
  imageData: ParsedImageData;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LinkPaintCommand extends BasePaintCommand {
  type: "link";
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClipStartPaintCommand extends BasePaintCommand {
  type: "clipStart";
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: BorderRadiusConfig | undefined;
}

export interface ClipEndPaintCommand extends BasePaintCommand {
  type: "clipEnd";
}

export type PaintCommand =
  | DrawTextPaintCommand
  | DrawRectanglePaintCommand
  | DrawLinePaintCommand
  | DrawImagePaintCommand
  | LinkPaintCommand
  | ClipStartPaintCommand
  | ClipEndPaintCommand;
