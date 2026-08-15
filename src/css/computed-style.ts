import { ParsedColor } from "./values/units.js";

export type DisplayType =
  | "block"
  | "inline"
  | "none"
  | "table"
  | "table-header-group"
  | "table-row-group"
  | "table-footer-group"
  | "table-row"
  | "table-cell"
  | "flex"
  | "inline-flex"
  | "grid"
  | "inline-grid";

export type PageBreakMode = "auto" | "always" | "avoid";

export type BreakBefore = "auto" | "page";
export type BreakAfter = "auto" | "page";
export type BreakInside = "auto" | "avoid";

export type FlexDirection = "row" | "column" | "row-reverse" | "column-reverse";

export type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";

export type JustifyContent =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type AlignItems =
  | "flex-start"
  | "center"
  | "flex-end"
  | "stretch"
  | "baseline"
  | "start"
  | "end";

export type GridAlign =
  | "auto"
  | "start"
  | "center"
  | "end"
  | "stretch"
  | "flex-start"
  | "flex-end";

export type PositionType = "static" | "relative" | "absolute" | "fixed";

export type FloatType = "none" | "left" | "right";
export type ClearType = "none" | "left" | "right" | "both";

export type OverflowType = "visible" | "hidden" | "auto";

export type BackgroundRepeat = "repeat" | "repeat-x" | "repeat-y" | "no-repeat";

export type TextDecoration = "none" | "underline" | "line-through" | "overline";

export type WhiteSpace = "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line";

export type Visibility = "visible" | "hidden";

export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";

export type VerticalAlign = "baseline" | "top" | "middle" | "bottom" | number;

export type TextOverflow = "clip" | "ellipsis";

export interface ComputedStyle {
  display: DisplayType;
  color: ParsedColor;
  backgroundColor: ParsedColor | null;
  backgroundImage: string | null;
  backgroundPosition: string;
  backgroundSize: string;
  backgroundRepeat: BackgroundRepeat;

  fontSize: number; // in pt
  fontFamily: string; // e.g. "Helvetica"
  fontWeight: "normal" | "bold" | number | string;
  fontStyle: "normal" | "italic" | "oblique";
  lineHeight: number; // pt or multiplier
  letterSpacing: number; // in pt
  wordSpacing: number; // in pt
  textTransform: TextTransform;
  textIndent: number; // in pt
  textDecoration: TextDecoration;
  whiteSpace: WhiteSpace;

  textAlign: "left" | "center" | "right" | "justify";
  verticalAlign: VerticalAlign;
  textOverflow: TextOverflow;
  visibility: Visibility;

  width: number | "auto";
  height: number | "auto";

  minWidth: number | "auto" | "none";
  maxWidth: number | "auto" | "none";
  minHeight: number | "auto" | "none";
  maxHeight: number | "auto" | "none";

  overflow: OverflowType;
  overflowX: OverflowType;
  overflowY: OverflowType;

  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;

  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;

  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;

  borderTopColor: ParsedColor;
  borderRightColor: ParsedColor;
  borderBottomColor: ParsedColor;
  borderLeftColor: ParsedColor;

  borderTopStyle: string;
  borderRightStyle: string;
  borderBottomStyle: string;
  borderLeftStyle: string;

  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;

  // Compatibility getter/setters
  borderColor: ParsedColor;
  borderStyle: string;

  breakBefore: BreakBefore;
  breakAfter: BreakAfter;
  breakInside: BreakInside;

  pageBreakBefore: PageBreakMode;
  pageBreakAfter: PageBreakMode;
  pageBreakInside: PageBreakMode;

  // Positioning Properties
  position: PositionType;
  top: number | string | "auto";
  right: number | string | "auto";
  bottom: number | string | "auto";
  left: number | string | "auto";
  zIndex: number | "auto";

  // Float & Clear
  float: FloatType;
  clear: ClearType;

  // Custom CSS Variables
  customProperties: Record<string, string>;

  // Flexbox Properties
  flexDirection: FlexDirection;
  flexWrap: FlexWrap;
  justifyContent: JustifyContent;
  alignItems: AlignItems;
  rowGap: number;
  columnGap: number;

  flexGrow: number;
  flexShrink: number;
  flexBasis: number | "auto";

  // Grid Properties
  gridTemplateColumns: string;
  gridTemplateRows: string;
  gridColumnStart: string | number;
  gridColumnEnd: string | number;
  gridRowStart: string | number;
  gridRowEnd: string | number;
  justifyItems: GridAlign;
  justifySelf: GridAlign;
  alignSelf: GridAlign;
}

export function createDefaultComputedStyle(
  parent?: ComputedStyle,
): ComputedStyle {
  const defaultColor: ParsedColor = parent
    ? { ...parent.color }
    : { r: 0, g: 0, b: 0, a: 1 };
  const defaultBorderColor: ParsedColor = { r: 0, g: 0, b: 0, a: 1 };

  return {
    display: "block",
    color: defaultColor,
    backgroundColor: null,
    backgroundImage: null,
    backgroundPosition: "0% 0%",
    backgroundSize: "auto",
    backgroundRepeat: "repeat",

    fontSize: parent ? parent.fontSize : 12,
    fontFamily: parent ? parent.fontFamily : "Helvetica",
    fontWeight: parent ? parent.fontWeight : "normal",
    fontStyle: parent ? parent.fontStyle : "normal",
    lineHeight: parent ? parent.lineHeight : 1.2,
    letterSpacing: parent ? parent.letterSpacing : 0,
    wordSpacing: parent ? parent.wordSpacing : 0,
    textTransform: parent ? parent.textTransform : "none",
    textIndent: parent ? parent.textIndent : 0,
    textDecoration: parent ? parent.textDecoration : "none",
    whiteSpace: parent ? parent.whiteSpace : "normal",

    textAlign: parent ? parent.textAlign : "left",
    verticalAlign: parent ? parent.verticalAlign : "baseline",
    textOverflow: parent ? parent.textOverflow : "clip",
    visibility: parent ? parent.visibility : "visible",

    width: "auto",
    height: "auto",

    minWidth: "none",
    maxWidth: "none",
    minHeight: "none",
    maxHeight: "none",

    overflow: "visible",
    overflowX: "visible",
    overflowY: "visible",

    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,

    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,

    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,

    borderTopColor: defaultBorderColor,
    borderRightColor: defaultBorderColor,
    borderBottomColor: defaultBorderColor,
    borderLeftColor: defaultBorderColor,

    borderTopStyle: "none",
    borderRightStyle: "none",
    borderBottomStyle: "none",
    borderLeftStyle: "none",

    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,

    get borderColor(): ParsedColor {
      return this.borderTopColor;
    },
    set borderColor(c: ParsedColor) {
      this.borderTopColor = c;
      this.borderRightColor = c;
      this.borderBottomColor = c;
      this.borderLeftColor = c;
    },

    get borderStyle(): string {
      return this.borderTopStyle;
    },
    set borderStyle(s: string) {
      this.borderTopStyle = s;
      this.borderRightStyle = s;
      this.borderBottomStyle = s;
      this.borderLeftStyle = s;
    },

    breakBefore: "auto",
    breakAfter: "auto",
    breakInside: "auto",

    pageBreakBefore: "auto",
    pageBreakAfter: "auto",
    pageBreakInside: "auto",

    position: "static",
    top: "auto",
    right: "auto",
    bottom: "auto",
    left: "auto",
    zIndex: "auto",

    float: "none",
    clear: "none",

    customProperties: parent ? { ...parent.customProperties } : {},

    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "flex-start",
    alignItems: "stretch",
    rowGap: 0,
    columnGap: 0,

    flexGrow: 0,
    flexShrink: 1,
    flexBasis: "auto",

    gridTemplateColumns: "",
    gridTemplateRows: "",
    gridColumnStart: "auto",
    gridColumnEnd: "auto",
    gridRowStart: "auto",
    gridRowEnd: "auto",
    justifyItems: "stretch",
    justifySelf: "auto",
    alignSelf: "auto",
  };
}

export function applyTextTransform(
  text: string,
  transform: TextTransform,
): string {
  if (!text || transform === "none") return text;
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize") {
    return text.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return text;
}
