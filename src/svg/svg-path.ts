import { SvgError } from "../errors/pdf-error.js";

export function tokenizePath(d: string): (string | number)[] {
  const tokens: (string | number)[] = [];
  let i = 0;
  const len = d.length;

  while (i < len) {
    const char = d[i]!;
    if (/\s/.test(char) || char === ",") {
      i++;
      continue;
    }

    if (/[MmLlHhVvCcSsQqTtZz]/.test(char)) {
      tokens.push(char);
      i++;
      continue;
    }

    const num = scanNumber(d, i, len);
    if (num === null) {
      throw new SvgError(
        `Invalid number in path: '${d.slice(i, i + 10)}' at index ${i}`,
      );
    }
    tokens.push(num.value);
    i = num.nextIndex;
  }
  return tokens;
}

function scanNumber(
  d: string,
  i: number,
  len: number,
): { value: number; nextIndex: number } | null {
  const start = i;
  if (d[i] === "+" || d[i] === "-") i++;
  let hasDot = false;
  while (i < len) {
    const c = d[i]!;
    if (c >= "0" && c <= "9") {
      i++;
    } else if (c === "." && !hasDot) {
      hasDot = true;
      i++;
    } else {
      break;
    }
  }
  if (i < len && (d[i] === "e" || d[i] === "E")) {
    i++;
    if (i < len && (d[i] === "+" || d[i] === "-")) i++;
    while (i < len && d[i]! >= "0" && d[i]! <= "9") i++;
  }
  const numStr = d.slice(start, i);
  const val = Number.parseFloat(numStr);
  if (Number.isNaN(val)) return null;
  return { value: val, nextIndex: i };
}

export function compileSvgPathToPdf(d: string): string {
  if (!d) return "";
  let tokens: (string | number)[] = [];
  try {
    tokens = tokenizePath(d);
  } catch (err: any) {
    throw new SvgError(err.message || "Failed to tokenize path");
  }

  const ops: string[] = [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let px = 0; // last control point X
  let py = 0; // last control point Y
  let lastCmd = "";

  let tIdx = 0;
  const tLen = tokens.length;

  while (tIdx < tLen) {
    const token = tokens[tIdx]!;
    if (typeof token !== "string") {
      // Implicit command repetition
      if (lastCmd === "") {
        throw new SvgError(
          `Malformed path: leading coordinates without command at index ${tIdx}`,
        );
      }
      // For implicit 'm'/'M' command, subsequent pairs are treated as 'l'/'L'
      let cmd = lastCmd;
      if (cmd === "m") cmd = "l";
      else if (cmd === "M") cmd = "L";

      processCommand(cmd);
    } else {
      const cmd = token;
      tIdx++;
      processCommand(cmd);
    }
  }

  function getArgs(count: number): number[] {
    const args: number[] = [];
    for (let c = 0; c < count; c++) {
      if (tIdx >= tLen || typeof tokens[tIdx] !== "number") {
        throw new SvgError(
          `Malformed path command '${lastCmd}': expected ${count} numeric arguments`,
        );
      }
      args.push(tokens[tIdx] as number);
      tIdx++;
    }
    return args;
  }

  function processCommand(cmd: string) {
    lastCmd = cmd;
    const isRel = cmd === cmd.toLowerCase();

    switch (cmd) {
      case "M":
      case "m":
        handleMoveTo(cmd, isRel);
        break;
      case "L":
      case "l":
        handleLineTo(cmd, isRel);
        break;
      case "H":
      case "h":
        handleHorizontal(cmd, isRel);
        break;
      case "V":
      case "v":
        handleVertical(cmd, isRel);
        break;
      case "C":
      case "c":
        handleCubic(cmd, isRel);
        break;
      case "S":
      case "s":
        handleSmoothCubic(cmd, isRel);
        break;
      case "Q":
      case "q":
        handleQuadratic(cmd, isRel);
        break;
      case "T":
      case "t":
        handleSmoothQuadratic(cmd, isRel);
        break;
      case "Z":
      case "z":
        handleClose();
        break;
      default:
        throw new SvgError(`Unsupported SVG path command: '${cmd}'`);
    }
  }

  function handleMoveTo(_cmd: string, isRel: boolean) {
    const [x, y] = getArgs(2);
    if (isRel) {
      cx += x!;
      cy += y!;
    } else {
      cx = x!;
      cy = y!;
    }
    ops.push(`${cx.toFixed(4)} ${cy.toFixed(4)} m`);
    startX = cx;
    startY = cy;
    px = cx;
    py = cy;
  }

  function handleLineTo(_cmd: string, isRel: boolean) {
    const [x, y] = getArgs(2);
    if (isRel) {
      cx += x!;
      cy += y!;
    } else {
      cx = x!;
      cy = y!;
    }
    ops.push(`${cx.toFixed(4)} ${cy.toFixed(4)} l`);
    px = cx;
    py = cy;
  }

  function handleHorizontal(_cmd: string, isRel: boolean) {
    const [x] = getArgs(1);
    if (isRel) {
      cx += x!;
    } else {
      cx = x!;
    }
    ops.push(`${cx.toFixed(4)} ${cy.toFixed(4)} l`);
    px = cx;
    py = cy;
  }

  function handleVertical(_cmd: string, isRel: boolean) {
    const [y] = getArgs(1);
    if (isRel) {
      cy += y!;
    } else {
      cy = y!;
    }
    ops.push(`${cx.toFixed(4)} ${cy.toFixed(4)} l`);
    px = cx;
    py = cy;
  }

  function handleCubic(_cmd: string, isRel: boolean) {
    const [x1, y1, x2, y2, x, y] = getArgs(6);
    let absX1 = x1!;
    let absY1 = y1!;
    let absX2 = x2!;
    let absY2 = y2!;
    let absX = x!;
    let absY = y!;
    if (isRel) {
      absX1 = cx + x1!;
      absY1 = cy + y1!;
      absX2 = cx + x2!;
      absY2 = cy + y2!;
      absX = cx + x!;
      absY = cy + y!;
    }
    ops.push(
      `${absX1.toFixed(4)} ${absY1.toFixed(4)} ${absX2.toFixed(4)} ${absY2.toFixed(4)} ${absX.toFixed(4)} ${absY.toFixed(4)} c`,
    );
    cx = absX;
    cy = absY;
    px = absX2;
    py = absY2;
  }

  function handleSmoothCubic(_cmd: string, isRel: boolean) {
    const [x2, y2, x, y] = getArgs(4);
    let absX2 = x2!;
    let absY2 = y2!;
    let absX = x!;
    let absY = y!;
    if (isRel) {
      absX2 = cx + x2!;
      absY2 = cy + y2!;
      absX = cx + x!;
      absY = cy + y!;
    }

    let absX1 = cx;
    let absY1 = cy;
    if (/[CcSs]/.test(lastCmd)) {
      absX1 = 2 * cx - px;
      absY1 = 2 * cy - py;
    }

    ops.push(
      `${absX1.toFixed(4)} ${absY1.toFixed(4)} ${absX2.toFixed(4)} ${absY2.toFixed(4)} ${absX.toFixed(4)} ${absY.toFixed(4)} c`,
    );
    cx = absX;
    cy = absY;
    px = absX2;
    py = absY2;
  }

  function handleQuadratic(_cmd: string, isRel: boolean) {
    const [x1, y1, x, y] = getArgs(4);
    let absX1 = x1!;
    let absY1 = y1!;
    let absX = x!;
    let absY = y!;
    if (isRel) {
      absX1 = cx + x1!;
      absY1 = cy + y1!;
      absX = cx + x!;
      absY = cy + y!;
    }

    const qcx1 = cx + (2 / 3) * (absX1 - cx);
    const qcy1 = cy + (2 / 3) * (absY1 - cy);
    const qcx2 = absX + (2 / 3) * (absX1 - absX);
    const qcy2 = absY + (2 / 3) * (absY1 - absY);

    ops.push(
      `${qcx1.toFixed(4)} ${qcy1.toFixed(4)} ${qcx2.toFixed(4)} ${qcy2.toFixed(4)} ${absX.toFixed(4)} ${absY.toFixed(4)} c`,
    );
    cx = absX;
    cy = absY;
    px = absX1;
    py = absY1;
  }

  function handleSmoothQuadratic(_cmd: string, isRel: boolean) {
    const [x, y] = getArgs(2);
    let absX = x!;
    let absY = y!;
    if (isRel) {
      absX = cx + x!;
      absY = cy + y!;
    }

    let absX1 = cx;
    let absY1 = cy;
    if (/[QqTt]/.test(lastCmd)) {
      absX1 = 2 * cx - px;
      absY1 = 2 * cy - py;
    }

    const qcx1 = cx + (2 / 3) * (absX1 - cx);
    const qcy1 = cy + (2 / 3) * (absY1 - cy);
    const qcx2 = absX + (2 / 3) * (absX1 - absX);
    const qcy2 = absY + (2 / 3) * (absY1 - absY);

    ops.push(
      `${qcx1.toFixed(4)} ${qcy1.toFixed(4)} ${qcx2.toFixed(4)} ${qcy2.toFixed(4)} ${absX.toFixed(4)} ${absY.toFixed(4)} c`,
    );
    cx = absX;
    cy = absY;
    px = absX1;
    py = absY1;
  }

  function handleClose() {
    ops.push("h");
    cx = startX;
    cy = startY;
    px = cx;
    py = cy;
  }

  return ops.join("\n");
}
