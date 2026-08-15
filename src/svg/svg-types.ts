export interface SvgPoint {
  x: number;
  y: number;
}

export type SvgTransformType = "translate" | "scale" | "rotate" | "matrix";

export interface SvgTransform {
  type: SvgTransformType;
  props: number[];
}
