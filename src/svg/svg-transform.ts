import type { SvgTransform } from "./svg-types.js";
import { SvgError } from "../errors/pdf-error.js";

export function parseSvgTransform(transformStr: string | null): SvgTransform[] {
  if (!transformStr) return [];
  const results: SvgTransform[] = [];
  const regex = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let match;
  while ((match = regex.exec(transformStr)) !== null) {
    const type = match[1]!.toLowerCase();
    const argsStr = match[2]!;
    const args = argsStr
      .trim()
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map((s) => parseFloat(s))
      .filter((n) => !isNaN(n));

    if (type === "translate") {
      if (args.length === 0)
        throw new SvgError("Invalid translate transform: missing arguments");
      const tx = args[0]!;
      const ty = args.length > 1 ? args[1]! : 0;
      results.push({ type: "translate", props: [tx, ty] });
    } else if (type === "scale") {
      if (args.length === 0)
        throw new SvgError("Invalid scale transform: missing arguments");
      const sx = args[0]!;
      const sy = args.length > 1 ? args[1]! : sx;
      results.push({ type: "scale", props: [sx, sy] });
    } else if (type === "rotate") {
      if (args.length === 0)
        throw new SvgError("Invalid rotate transform: missing arguments");
      const angle = args[0]!;
      const cx = args.length > 1 ? args[1]! : 0;
      const cy = args.length > 2 ? args[2]! : 0;
      results.push({ type: "rotate", props: [angle, cx, cy] });
    } else if (type === "matrix") {
      if (args.length < 6)
        throw new SvgError("Invalid matrix transform: requires 6 arguments");
      results.push({ type: "matrix", props: args.slice(0, 6) });
    } else {
      throw new SvgError(`Unsupported SVG transform type: ${type}`);
    }
  }
  return results;
}

export function transformToPdfCommands(transforms: SvgTransform[]): string {
  if (transforms.length === 0) return "";
  const ops: string[] = [];
  for (const t of transforms) {
    if (t.type === "translate") {
      const tx = t.props[0]!;
      const ty = t.props[1]!;
      ops.push(`1 0 0 1 ${tx.toFixed(4)} ${ty.toFixed(4)} cm`);
    } else if (t.type === "scale") {
      const sx = t.props[0]!;
      const sy = t.props[1]!;
      ops.push(`${sx.toFixed(4)} 0 0 ${sy.toFixed(4)} 0 0 cm`);
    } else if (t.type === "rotate") {
      const angle = t.props[0]!;
      const cx = t.props[1]!;
      const cy = t.props[2]!;
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      if (cx !== 0 || cy !== 0) {
        ops.push(`1 0 0 1 ${cx.toFixed(4)} ${cy.toFixed(4)} cm`);
        ops.push(
          `${cos.toFixed(4)} ${sin.toFixed(4)} ${(-sin).toFixed(4)} ${cos.toFixed(4)} 0 0 cm`,
        );
        ops.push(`1 0 0 1 ${(-cx).toFixed(4)} ${(-cy).toFixed(4)} cm`);
      } else {
        ops.push(
          `${cos.toFixed(4)} ${sin.toFixed(4)} ${(-sin).toFixed(4)} ${cos.toFixed(4)} 0 0 cm`,
        );
      }
    } else if (t.type === "matrix") {
      const [a, b, c, d, e, f] = t.props;
      ops.push(
        `${a!.toFixed(4)} ${b!.toFixed(4)} ${c!.toFixed(4)} ${d!.toFixed(4)} ${e!.toFixed(4)} ${f!.toFixed(4)} cm`,
      );
    }
  }
  return ops.join("\n");
}
