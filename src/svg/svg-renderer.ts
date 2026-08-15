import { SvgElementNode } from "./svg-node.js";
import { BaseNode } from "../html/dom/node.js";
import { CSSRule, CSSParser } from "../css/parser.js";
import { parseSvgTransform, transformToPdfCommands } from "./svg-transform.js";
import { compileSvgPathToPdf } from "./svg-path.js";
import { PDFDocument } from "../pdf/pdf-document.js";
import { SvgError } from "../errors/pdf-error.js";
import {
  ComputedStyle,
  createDefaultComputedStyle,
} from "../css/computed-style.js";
import { parseCssUnit, parseCssColor } from "../css/values/units.js";
import { compareSpecificity } from "../css/specificity.js";

function matchesSelector(node: SvgElementNode, selector: string): boolean {
  const sel = selector.trim().toLowerCase();
  if (sel === "*") return true;
  if (sel.startsWith(".")) {
    const cls = sel.slice(1);
    return node.classList.includes(cls);
  }
  if (sel.startsWith("#")) {
    const id = sel.slice(1);
    return node.id === id;
  }
  if (sel === node.tagName) return true;

  const dotIdx = sel.indexOf(".");
  const hashIdx = sel.indexOf("#");
  if (dotIdx > 0) {
    const tag = sel.slice(0, dotIdx);
    const cls = sel.slice(dotIdx + 1);
    return node.tagName === tag && node.classList.includes(cls);
  }
  if (hashIdx > 0) {
    const tag = sel.slice(0, hashIdx);
    const id = sel.slice(hashIdx + 1);
    return node.tagName === tag && node.id === id;
  }
  return false;
}

class SvgRenderContext {
  public readonly ops: string[] = [];

  constructor(
    private readonly doc: PDFDocument,
    private readonly cssRules: CSSRule[],
    private readonly cssParser: CSSParser,
  ) {}

  public cascadeStyle(
    node: SvgElementNode,
    parentStyle: ComputedStyle,
  ): ComputedStyle {
    const computed = createDefaultComputedStyle(parentStyle);
    const presDecls: Record<string, string> = {};
    for (const [attr, val] of Object.entries(node.attributes)) {
      if (
        attr === "fill" ||
        attr === "stroke" ||
        attr === "stroke-width" ||
        attr === "stroke-linecap" ||
        attr === "stroke-linejoin" ||
        attr === "stroke-dasharray" ||
        attr === "fill-opacity" ||
        attr === "stroke-opacity" ||
        attr === "opacity" ||
        attr === "display" ||
        attr === "visibility"
      ) {
        presDecls[attr] = val;
      }
    }
    this.applySvgDeclarations(computed, presDecls);

    const matchingRules = this.cssRules.filter((rule) =>
      matchesSelector(node, rule.selector),
    );
    matchingRules.sort((a, b) =>
      compareSpecificity(a.specificity, b.specificity),
    );
    for (const rule of matchingRules) {
      this.applySvgDeclarations(computed, rule.declarations);
    }

    const inlineStyle = node.getAttribute("style");
    if (inlineStyle) {
      const inlineDecls = this.cssParser.parseDeclarations(inlineStyle);
      this.applySvgDeclarations(computed, inlineDecls);
    }

    return computed;
  }

  private applySvgDeclarations(
    computed: ComputedStyle,
    decls: Record<string, string>,
  ) {
    for (const [prop, val] of Object.entries(decls)) {
      const key = prop.toLowerCase().trim();
      const v = val.trim();
      switch (key) {
        case "fill":
          computed.fill = v;
          break;
        case "stroke":
          computed.stroke = v;
          break;
        case "stroke-width":
          computed.strokeWidth = v;
          break;
        case "stroke-linecap":
          computed.strokeLinecap = v;
          break;
        case "stroke-linejoin":
          computed.strokeLinejoin = v;
          break;
        case "stroke-dasharray":
          computed.strokeDasharray = v;
          break;
        case "fill-opacity":
          computed.fillOpacity = Number.parseFloat(v);
          break;
        case "stroke-opacity":
          computed.strokeOpacity = Number.parseFloat(v);
          break;
        case "opacity":
          computed.customProperties["--svg-opacity"] = v;
          break;
        case "display": {
          const vLower = v.toLowerCase();
          if (
            vLower === "block" || vLower === "inline" || vLower === "none" ||
            vLower === "table" || vLower === "table-row" || vLower === "table-cell" ||
            vLower === "flex" || vLower === "inline-flex" || vLower === "grid" || vLower === "inline-grid" ||
            vLower === "table-header-group" || vLower === "table-row-group" || vLower === "table-footer-group"
          ) {
            computed.display = vLower;
          }
          break;
        }
        case "visibility": {
          const vLower = v.toLowerCase();
          if (vLower === "visible" || vLower === "hidden") {
            computed.visibility = vLower;
          }
          break;
        }
      }
    }
  }

  private buildRectPath(
    x: number,
    y: number,
    w: number,
    h: number,
    rx = 0,
    ry = 0,
  ): string {
    if (rx <= 0 && ry <= 0) {
      return `${x.toFixed(4)} ${y.toFixed(4)} ${w.toFixed(4)} ${h.toFixed(4)} re`;
    }
    const rX = Math.min(rx || ry, w / 2);
    const rY = Math.min(ry || rx, h / 2);
    const k = 0.55228475;
    const ox = rX * k;
    const oy = rY * k;
    return [
      `${(x + rX).toFixed(4)} ${y.toFixed(4)} m`,
      `${(x + w - rX).toFixed(4)} ${y.toFixed(4)} l`,
      `${(x + w - rX + ox).toFixed(4)} ${y.toFixed(4)} ${(x + w).toFixed(4)} ${(y + oy).toFixed(4)} ${(x + w).toFixed(4)} ${(y + rY).toFixed(4)} c`,
      `${(x + w).toFixed(4)} ${(y + h - rY).toFixed(4)} l`,
      `${(x + w).toFixed(4)} ${(y + h - rY + oy).toFixed(4)} ${(x + w - rX + ox).toFixed(4)} ${(y + h).toFixed(4)} ${(x + w - rX).toFixed(4)} ${(y + h).toFixed(4)} c`,
      `${(x + rX).toFixed(4)} ${(y + h).toFixed(4)} l`,
      `${(x + rX - ox).toFixed(4)} ${(y + h).toFixed(4)} ${x.toFixed(4)} ${(y + h - oy).toFixed(4)} ${x.toFixed(4)} ${(y + h - rY).toFixed(4)} c`,
      `${x.toFixed(4)} ${(y + rY).toFixed(4)} l`,
      `${x.toFixed(4)} ${(y + rY - oy).toFixed(4)} ${(x + rX - ox).toFixed(4)} ${y.toFixed(4)} ${(x + rX).toFixed(4)} ${y.toFixed(4)} c`,
      "h",
    ].join("\n");
  }

  private buildEllipsePath(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
  ): string {
    const k = 0.55228475;
    const ox = rx * k;
    const oy = ry * k;
    return [
      `${(cx + rx).toFixed(4)} ${cy.toFixed(4)} m`,
      `${(cx + rx).toFixed(4)} ${(cy + oy).toFixed(4)} ${(cx + ox).toFixed(4)} ${(cy + ry).toFixed(4)} ${cx.toFixed(4)} ${(cy + ry).toFixed(4)} c`,
      `${(cx - ox).toFixed(4)} ${(cy + ry).toFixed(4)} ${(cx - rx).toFixed(4)} ${(cy + oy).toFixed(4)} ${(cx - rx).toFixed(4)} ${cy.toFixed(4)} c`,
      `${(cx - rx).toFixed(4)} ${(cy - oy).toFixed(4)} ${(cx - ox).toFixed(4)} ${(cy - ry).toFixed(4)} ${cx.toFixed(4)} ${(cy - ry).toFixed(4)} c`,
      `${(cx + ox).toFixed(4)} ${(cy - ry).toFixed(4)} ${(cx + rx).toFixed(4)} ${(cy - oy).toFixed(4)} ${(cx + rx).toFixed(4)} ${cy.toFixed(4)} c`,
      "h",
    ].join("\n");
  }

  private buildPaintSetup(
    computed: ComputedStyle,
  ): { setup: string[]; hasFill: boolean; hasStroke: boolean } {
    const setup: string[] = [];
    const swStr = computed.strokeWidth !== undefined ? String(computed.strokeWidth) : "1";
    setup.push(`${parseCssUnit(swStr).toFixed(4)} w`);

    if (computed.strokeLinecap) {
      const map: Record<string, number> = { butt: 0, round: 1, square: 2 };
      setup.push(`${map[computed.strokeLinecap.trim().toLowerCase()] ?? 0} J`);
    }

    if (computed.strokeLinejoin) {
      const map: Record<string, number> = { miter: 0, round: 1, bevel: 2 };
      setup.push(`${map[computed.strokeLinejoin.trim().toLowerCase()] ?? 0} j`);
    }

    this.applyDashArraySetup(computed, setup);

    let hasFill = true;
    if (computed.fill === "none") {
      hasFill = false;
    } else if (computed.fill) {
      const c = parseCssColor(computed.fill);
      setup.push(`${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)} rg`);
    } else {
      setup.push("0.0000 0.0000 0.0000 rg");
    }

    let hasStroke = false;
    if (computed.stroke && computed.stroke !== "none") {
      hasStroke = true;
      const c = parseCssColor(computed.stroke);
      setup.push(`${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)} RG`);
    }

    return { setup, hasFill, hasStroke };
  }

  private applyDashArraySetup(computed: ComputedStyle, setup: string[]) {
    if (computed.strokeDasharray && computed.strokeDasharray !== "none") {
      const vals = computed.strokeDasharray
        .trim()
        .split(/[\s,]+/)
        .map((s: string) => Number.parseFloat(s))
        .filter((n: number) => !Number.isNaN(n));
      if (vals.length > 0) {
        const cmd = vals.length % 2 === 1
          ? `[${vals.concat(vals).map((v: number) => v.toFixed(4)).join(" ")}] 0 d`
          : `[${vals.map((v: number) => v.toFixed(4)).join(" ")}] 0 d`;
        setup.push(cmd);
        return;
      }
    }
    setup.push("[] 0 d");
  }

  private selectPaintOp(hasFill: boolean, hasStroke: boolean): string {
    if (hasFill && hasStroke) return "B";
    if (hasFill) return "f";
    if (hasStroke) return "S";
    return "n";
  }

  private renderShape(pathCode: string, computed: ComputedStyle) {
    const { setup, hasFill, hasStroke } = this.buildPaintSetup(computed);
    const paintOp = this.selectPaintOp(hasFill, hasStroke);

    const setupLines = setup.length > 0 ? [setup.join("\n")] : [];
    this.ops.push("q", ...setupLines, pathCode, paintOp, "Q");
  }

  private applyOpacity(computed: ComputedStyle): string {
    const opacityStr = computed.customProperties["--svg-opacity"];
    const generalOpacity = opacityStr ? Number.parseFloat(opacityStr) : 1;
    const fillOpacity = (computed.fillOpacity ?? 1) * generalOpacity;
    const strokeOpacity = (computed.strokeOpacity ?? 1) * generalOpacity;
    const hasOpacity = fillOpacity < 1 || strokeOpacity < 1;
    if (hasOpacity) {
      const alias = this.doc.registerExtGState(fillOpacity, strokeOpacity);
      this.ops.push("q", `/${alias} gs`);
      return "Q";
    }
    return "";
  }

  private applyTransform(node: SvgElementNode): string {
    const transformStr = node.getAttribute("transform");
    if (transformStr) {
      const transforms = parseSvgTransform(transformStr);
      this.ops.push("q", transformToPdfCommands(transforms));
      return "Q";
    }
    return "";
  }

  private renderRect(node: SvgElementNode, computed: ComputedStyle) {
    const x = parseCssUnit(node.getAttribute("x") ?? "0");
    const y = parseCssUnit(node.getAttribute("y") ?? "0");
    const w = parseCssUnit(node.getAttribute("width") ?? "0");
    const h = parseCssUnit(node.getAttribute("height") ?? "0");
    const rx = parseCssUnit(node.getAttribute("rx") ?? "0");
    const ry = parseCssUnit(node.getAttribute("ry") ?? "0");
    if (w > 0 && h > 0) {
      this.renderShape(this.buildRectPath(x, y, w, h, rx, ry), computed);
    }
  }

  private renderCircle(node: SvgElementNode, computed: ComputedStyle) {
    const cx = parseCssUnit(node.getAttribute("cx") ?? "0");
    const cy = parseCssUnit(node.getAttribute("cy") ?? "0");
    const r = parseCssUnit(node.getAttribute("r") ?? "0");
    if (r > 0) {
      this.renderShape(this.buildEllipsePath(cx, cy, r, r), computed);
    }
  }

  private renderEllipse(node: SvgElementNode, computed: ComputedStyle) {
    const cx = parseCssUnit(node.getAttribute("cx") ?? "0");
    const cy = parseCssUnit(node.getAttribute("cy") ?? "0");
    const rx = parseCssUnit(node.getAttribute("rx") ?? "0");
    const ry = parseCssUnit(node.getAttribute("ry") ?? "0");
    if (rx > 0 && ry > 0) {
      this.renderShape(this.buildEllipsePath(cx, cy, rx, ry), computed);
    }
  }

  private renderLine(node: SvgElementNode, computed: ComputedStyle) {
    const x1 = parseCssUnit(node.getAttribute("x1") ?? "0");
    const y1 = parseCssUnit(node.getAttribute("y1") ?? "0");
    const x2 = parseCssUnit(node.getAttribute("x2") ?? "0");
    const y2 = parseCssUnit(node.getAttribute("y2") ?? "0");
    const pathCode = `${x1.toFixed(4)} ${y1.toFixed(4)} m\n${x2.toFixed(4)} ${y2.toFixed(4)} l`;
    this.renderShape(pathCode, computed);
  }

  private renderPoly(
    node: SvgElementNode,
    computed: ComputedStyle,
    close: boolean,
  ) {
    const pointsStr = node.getAttribute("points");
    if (!pointsStr) return;
    const vals = pointsStr
      .trim()
      .split(/[\s,]+/)
      .map((p) => Number.parseFloat(p))
      .filter((n) => !Number.isNaN(n));
    if (vals.length < 4) return;
    const lines: string[] = [
      `${vals[0]!.toFixed(4)} ${vals[1]!.toFixed(4)} m`,
    ];
    for (let idx = 2; idx < vals.length - 1; idx += 2) {
      lines.push(`${vals[idx]!.toFixed(4)} ${vals[idx + 1]!.toFixed(4)} l`);
    }
    if (close) lines.push("h");
    this.renderShape(lines.join("\n"), computed);
  }

  private renderPath(node: SvgElementNode, computed: ComputedStyle) {
    const d = node.getAttribute("d");
    if (d) {
      const pathCode = compileSvgPathToPdf(d);
      this.renderShape(pathCode, computed);
    }
  }

  public compileNode(node: BaseNode, parentStyle: ComputedStyle): void {
    if (!(node instanceof SvgElementNode)) return;

    const computed = this.cascadeStyle(node, parentStyle);
    if (computed.display === "none" || computed.visibility === "hidden") {
      return;
    }

    const opacityCleanup = this.applyOpacity(computed);
    const transformCleanup = this.applyTransform(node);

    switch (node.tagName) {
      case "svg":
      case "g":
        for (const child of node.children) {
          this.compileNode(child, computed);
        }
        break;
      case "rect":
        this.renderRect(node, computed);
        break;
      case "circle":
        this.renderCircle(node, computed);
        break;
      case "ellipse":
        this.renderEllipse(node, computed);
        break;
      case "line":
        this.renderLine(node, computed);
        break;
      case "polyline":
        this.renderPoly(node, computed, false);
        break;
      case "polygon":
        this.renderPoly(node, computed, true);
        break;
      case "path":
        this.renderPath(node, computed);
        break;
      default:
        break;
    }

    if (transformCleanup) this.ops.push(transformCleanup);
    if (opacityCleanup) this.ops.push(opacityCleanup);
  }
}

export class SvgRenderer {
  private readonly cssParser = new CSSParser();

  render(
    root: SvgElementNode,
    doc: PDFDocument,
    width: number,
    height: number,
    cssRules: CSSRule[],
    pdfX: number,
    pdfY: number,
  ): string {
    const context = new SvgRenderContext(doc, cssRules, this.cssParser);
    
    const viewBoxStr = root.getAttribute("viewBox");
    let minX = 0;
    let minY = 0;
    let vbW = width;
    let vbH = height;

    if (viewBoxStr) {
      const parts = viewBoxStr
        .trim()
        .split(/[\s,]+/)
        .map((p) => Number.parseFloat(p))
        .filter((n) => !Number.isNaN(n));
      if (parts.length === 4) {
        minX = parts[0]!;
        minY = parts[1]!;
        vbW = parts[2]!;
        vbH = parts[3]!;
      } else {
        throw new SvgError("Invalid viewBox attribute in svg element");
      }
    } else {
      const wAttr = root.getAttribute("width");
      const hAttr = root.getAttribute("height");
      if (wAttr) vbW = parseCssUnit(wAttr);
      if (hAttr) vbH = parseCssUnit(hAttr);
    }

    if (vbW <= 0 || vbH <= 0 || width <= 0 || height <= 0) {
      return "";
    }

    const sx = width / vbW;
    const sy = -height / vbH;
    const tx = pdfX - minX * sx;
    const ty = pdfY + height + minY * -sy;

    context.ops.push(
      "q",
      `${sx.toFixed(4)} 0 0 ${sy.toFixed(4)} ${tx.toFixed(4)} ${ty.toFixed(4)} cm`,
    );

    const rootStyle = createDefaultComputedStyle();
    rootStyle.fill = "black";
    rootStyle.stroke = "none";
    rootStyle.strokeWidth = "1";

    context.compileNode(root, rootStyle);
    context.ops.push("Q");
    
    return context.ops.join("\n");
  }
}
