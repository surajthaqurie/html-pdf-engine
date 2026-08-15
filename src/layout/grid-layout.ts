import { parseCssUnit } from "../css/values/units.js";
import { LayoutBox } from "./layout-box.js";

export interface GridTrackDef {
  type: "px" | "percent" | "fr" | "auto";
  val: number;
}

export function parseGridTrackList(str: string): GridTrackDef[] {
  if (!str || str === "none") return [];
  let s = str.trim();

  while (s.includes("repeat(")) {
    s = s.replace(
      /repeat\(\s*(\d+)\s*,\s*([^)]+)\)/g,
      (_, countStr, tracksStr) => {
        const count = parseInt(countStr, 10);
        if (isNaN(count) || count <= 0) return tracksStr;
        return new Array(count).fill(tracksStr.trim()).join(" ");
      },
    );
  }

  const tokens = s.split(/\s+/).filter(Boolean);
  const defs: GridTrackDef[] = [];

  for (const token of tokens) {
    if (
      token.endsWith("px") ||
      token.endsWith("pt") ||
      token.endsWith("mm") ||
      token.endsWith("cm") ||
      token.endsWith("in")
    ) {
      defs.push({ type: "px", val: parseCssUnit(token) });
    } else if (token.endsWith("%")) {
      defs.push({ type: "percent", val: parseFloat(token) || 0 });
    } else if (token.endsWith("fr")) {
      defs.push({ type: "fr", val: parseFloat(token) || 1 });
    } else if (token === "auto") {
      defs.push({ type: "auto", val: 0 });
    } else {
      const num = parseCssUnit(token);
      if (!isNaN(num)) {
        defs.push({ type: "px", val: num });
      } else {
        defs.push({ type: "auto", val: 0 });
      }
    }
  }

  return defs;
}

export interface GridPlacement {
  colStart: number | null;
  colSpan: number;
  rowStart: number | null;
  rowSpan: number;
}

export function getGridPlacement(child: LayoutBox): GridPlacement {
  let colStart: number | null = null;
  let colSpan = 1;
  let rowStart: number | null = null;
  let rowSpan = 1;

  const cs = child.style.gridColumnStart;
  const ce = child.style.gridColumnEnd;
  const rs = child.style.gridRowStart;
  const re = child.style.gridRowEnd;

  if (typeof cs === "number") {
    colStart = cs > 0 ? cs - 1 : 0;
  }
  if (typeof ce === "number" && colStart !== null) {
    colSpan = Math.max(1, ce - 1 - colStart);
  } else if (typeof ce === "string" && ce.startsWith("span")) {
    const spanVal = parseInt(ce.replace("span", "").trim(), 10);
    if (!isNaN(spanVal)) colSpan = spanVal;
  } else if (typeof cs === "string" && cs.startsWith("span")) {
    const spanVal = parseInt(cs.replace("span", "").trim(), 10);
    if (!isNaN(spanVal)) colSpan = spanVal;
  }

  if (typeof rs === "number") {
    rowStart = rs > 0 ? rs - 1 : 0;
  }
  if (typeof re === "number" && rowStart !== null) {
    rowSpan = Math.max(1, re - 1 - rowStart);
  } else if (typeof re === "string" && re.startsWith("span")) {
    const spanVal = parseInt(re.replace("span", "").trim(), 10);
    if (!isNaN(spanVal)) rowSpan = spanVal;
  } else if (typeof rs === "string" && rs.startsWith("span")) {
    const spanVal = parseInt(rs.replace("span", "").trim(), 10);
    if (!isNaN(spanVal)) rowSpan = spanVal;
  }

  return { colStart, colSpan, rowStart, rowSpan };
}

export function isCellAreaFree(
  occupied: boolean[][],
  startRow: number,
  startCol: number,
  spanRows: number,
  spanCols: number,
  maxCols: number,
): boolean {
  if (startCol + spanCols > maxCols) return false;
  for (let r = startRow; r < startRow + spanRows; r++) {
    const rowArr = occupied[r];
    if (!rowArr) continue;
    for (let c = startCol; c < startCol + spanCols; c++) {
      if (rowArr[c]) return false;
    }
  }
  return true;
}

export function markCellAreaOccupied(
  occupied: boolean[][],
  startRow: number,
  startCol: number,
  spanRows: number,
  spanCols: number,
): void {
  for (let r = startRow; r < startRow + spanRows; r++) {
    if (!occupied[r]) occupied[r] = [];
    for (let c = startCol; c < startCol + spanCols; c++) {
      occupied[r]![c] = true;
    }
  }
}
