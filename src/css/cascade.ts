import { ElementNode } from "../html/dom/node.js";
import { CSSParser, CSSRule } from "./parser.js";
import { compareSpecificity } from "./specificity.js";
import {
  ComputedStyle,
  createDefaultComputedStyle,
} from "./computed-style.js";
import { parseCssUnit, parseCssColor, ParsedColor } from "./values/units.js";
import { DEFAULT_ELEMENT_STYLES, NAMED_COLORS } from "../constants/css.js";
import { FontManager } from "../fonts/font.js";
import {
  PageSizeName,
  PageOrientation,
  PageMargins,
  PageSize,
  STANDARD_PAGE_SIZES,
} from "../pdf/pdf-page.js";

export interface PageRuleConfig {
  pageSize?: PageSizeName | PageSize;
  orientation?: PageOrientation;
  margins?: Partial<PageMargins>;
}

function applyPageSizeRule(config: PageRuleConfig, val: string): void {
  const parts = val.trim().split(/\s+/);
  if (parts.length === 1) {
    const first = parts[0] ?? "";
    const lower = first.toLowerCase();
    if (lower === "landscape" || lower === "portrait") {
      config.orientation = lower as PageOrientation;
    } else if (STANDARD_PAGE_SIZES[first as PageSizeName]) {
      config.pageSize = first as PageSizeName;
    } else if (/^\d+(pt|px|mm|cm|in)?$/.exec(first)) {
      const w = parseCssUnit(first);
      config.pageSize = { width: w, height: w };
    }
  } else if (parts.length >= 2) {
    const first = parts[0] ?? "";
    const second = parts[1] ?? "";
    const lowerSecond = second.toLowerCase();
    if (STANDARD_PAGE_SIZES[first as PageSizeName]) {
      config.pageSize = first as PageSizeName;
      if (lowerSecond === "landscape" || lowerSecond === "portrait") {
        config.orientation = lowerSecond as PageOrientation;
      }
    } else if (/^\d+/.exec(first) && /^\d+/.exec(second)) {
      config.pageSize = {
        width: parseCssUnit(first),
        height: parseCssUnit(second),
      };
    }
  }
}

function applyPageMarginRule(config: PageRuleConfig, key: string, val: string): void {
  config.margins ??= {};
  if (key === "margin-top") config.margins.top = parseCssUnit(val);
  else if (key === "margin-right") config.margins.right = parseCssUnit(val);
  else if (key === "margin-bottom") config.margins.bottom = parseCssUnit(val);
  else if (key === "margin-left") config.margins.left = parseCssUnit(val);
  else if (key === "margin") {
    const m = parseCssUnit(val);
    config.margins = { top: m, right: m, bottom: m, left: m };
  }
}

export function parsePageRules(rules: CSSRule[]): PageRuleConfig {
  const config: PageRuleConfig = {};
  const pageRules = rules.filter((r) => r.selector.startsWith("@page"));
  for (const rule of pageRules) {
    for (const [key, val] of Object.entries(rule.declarations)) {
      if (key === "size") {
        applyPageSizeRule(config, val);
      } else if (
        key === "margin-top" ||
        key === "margin-right" ||
        key === "margin-bottom" ||
        key === "margin-left" ||
        key === "margin"
      ) {
        applyPageMarginRule(config, key, val);
      }
    }
  }
  return config;
}
/**
 * CascadeEngine applies CSS rules to DOM elements in specificity order,
 * producing a resolved `ComputedStyle` for each element.
 *
 * CSS Custom Property (variable) resolution:
 *   - Global variables are extracted from `:root`, `*`, `html`, and `body` rules once
 *     per render and seeded into every element's computed style.
 *   - Variables are resolved via `var(--name, fallback)` at property-application time.
 *   - Cycle detection uses a visited-set per resolution chain to terminate safely
 *     without throwing. A circular reference (`--a: var(--b); --b: var(--a)`) resolves
 *     to the provided fallback, or to empty string if no fallback is given.
 *   - Custom properties are inherited through the DOM: child elements receive their
 *     parent's resolved variable map via `createDefaultComputedStyle(parentStyle)`.
 *
 * Media query evaluation:
 *   - `@media print` and `@media all` are always applied (PDF = print context).
 *   - `@media screen` is always excluded.
 *   - `@media (min-width: X)` / `@media (max-width: X)` are evaluated against the
 *     containerWidth passed to `computeStyle()`, which corresponds to the page content width.
 *   - Media query evaluation is static — no dynamic viewport changes during layout.
 *
 * Selector matching is intentionally a subset of CSS:
 *   - Pseudo-classes (`:hover`, `:focus`, `:nth-child`) are stripped at match time,
 *     so their rules apply unconditionally in the static PDF context.
 */
export class CascadeEngine {
  private readonly parser = new CSSParser();
  private readonly fontManager: FontManager;

  constructor(fontManager?: FontManager) {
    this.fontManager = fontManager ?? new FontManager();
  }

  /**
   * Extracts all CSS custom properties (--var) defined in :root and * selectors
   * as a global seed. These are inherited by every element's computed style.
   */
  extractGlobalCustomProperties(rules: CSSRule[]): Record<string, string> {
    const globals: Record<string, string> = {};
    for (const rule of rules) {
      const sel = rule.selector.trim().toLowerCase();
      const isGlobal =
        sel === ":root" || sel === "*" || sel === "html" || sel === "body";
      if (!isGlobal) continue;
      for (const [prop, val] of Object.entries(rule.declarations)) {
        if (prop.startsWith("--")) {
          globals[prop] = val;
        }
      }
    }
    // Resolve any nested variable references within the globals themselves
    const resolved: Record<string, string> = {};
    for (const [prop, val] of Object.entries(globals)) {
      resolved[prop] = this.resolveCssVariables(val, globals);
    }
    return resolved;
  }

  computeStyle(
    element: ElementNode,
    rules: CSSRule[],
    parentStyle?: ComputedStyle,
    containerWidth: number = 595.28,
  ): ComputedStyle {
    const computed = createDefaultComputedStyle(parentStyle);

    // Seed global CSS custom properties from :root / * if parent doesn't already carry them
    if (
      !parentStyle ||
      Object.keys(parentStyle.customProperties).length === 0
    ) {
      const globals = this.extractGlobalCustomProperties(rules);
      Object.assign(computed.customProperties, globals);
    }

    // 1. Apply User-Agent Default Element Styles
    const defaultDecls = DEFAULT_ELEMENT_STYLES[element.tagName];
    if (defaultDecls) {
      this.applyDeclarations(computed, defaultDecls, containerWidth);
    }

    // 2. Filter & Sort Matching Stylesheet Rules by Specificity and Media Query
    const matchingRules = rules.filter((rule) => {
      if (
        rule.mediaQuery &&
        !this.evaluateMediaQuery(rule.mediaQuery, containerWidth)
      ) {
        return false;
      }
      return this.matchesSelector(element, rule.selector);
    });
    matchingRules.sort((a, b) =>
      compareSpecificity(a.specificity, b.specificity),
    );

    for (const rule of matchingRules) {
      this.applyDeclarations(computed, rule.declarations, containerWidth);
    }

    // 3. Apply Element Inline Style Attribute (style="...")
    const inlineStyle = element.getAttribute("style");
    if (inlineStyle) {
      const inlineDecls = this.parser.parseDeclarations(inlineStyle);
      this.applyDeclarations(computed, inlineDecls, containerWidth);
    }

    // Pre-warm font resolution cache for this family, weight, and style
    this.fontManager.resolveFont(
      computed.fontFamily,
      computed.fontWeight,
      computed.fontStyle,
    );

    return computed;
  }

  private matchesDescendantSelector(element: ElementNode, parts: string[]): boolean {
    const lastPart = parts.at(-1);
    if (!lastPart || !this.matchesSelector(element, lastPart)) return false;
    let currentParent = element.parent;
    let targetIdx = parts.length - 2;
    while (currentParent && targetIdx >= 0) {
      const targetSel = parts[targetIdx];
      if (
        targetSel &&
        currentParent instanceof ElementNode &&
        this.matchesSelector(currentParent, targetSel)
      ) {
        targetIdx--;
      }
      currentParent = currentParent.parent;
    }
    return targetIdx < 0;
  }

  private matchTagAndClass(element: ElementNode, sel: string, dotIdx: number): boolean {
    const tag = dotIdx > 0 ? sel.slice(0, dotIdx).toLowerCase() : "";
    const cls = sel.slice(dotIdx + 1).split(/[.#:]/)[0];
    if (tag && tag !== element.tagName) return false;
    return cls ? element.classList.includes(cls) : false;
  }

  private matchTagAndId(element: ElementNode, sel: string, hashIdx: number): boolean {
    const tag = sel.slice(0, hashIdx).toLowerCase();
    const id = sel.slice(hashIdx + 1).split(/[.#:]/)[0];
    if (tag && tag !== element.tagName) return false;
    return id ? element.id === id : false;
  }

  private matchesCompoundSelector(element: ElementNode, sel: string): boolean {
    if (sel.startsWith(".")) return element.classList.includes(sel.slice(1));
    if (sel.startsWith("#")) return element.id === sel.slice(1);
    const dotIdx = sel.indexOf(".");
    const hashIdx = sel.indexOf("#");
    if (dotIdx !== -1 && (hashIdx === -1 || dotIdx < hashIdx)) {
      return this.matchTagAndClass(element, sel, dotIdx);
    }
    if (hashIdx > 0) {
      return this.matchTagAndId(element, sel, hashIdx);
    }
    return false;
  }

  private matchesSelector(element: ElementNode, selector: string): boolean {
    const sel = selector.trim();
    if (sel === "*") return true;
    if (sel === ":root") return element.tagName === "html" || element.parent == null;
    const strippedSel = sel.replace(/::?[a-z-]+(?:\([^)]*\))?/g, "").trim();
    if (strippedSel !== sel && strippedSel) {
      return this.matchesSelector(element, strippedSel);
    }
    if (sel.includes(" ")) {
      return this.matchesDescendantSelector(element, sel.split(/\s+/));
    }
    if (sel.toLowerCase() === element.tagName) return true;
    return this.matchesCompoundSelector(element, sel);
  }
  public evaluateMediaQuery(query: string, containerWidth: number): boolean {
    const clean = query.toLowerCase().trim();
    if (clean === "print" || clean === "all") return true;
    if (clean === "screen" || clean === "speech") return false;

    // Check min-width feature
    const minMatch = /\(min-width:\s*([\d.]+(?:px|pt|mm|cm|in)?)\)/.exec(clean);
    if (minMatch?.[1]) {
      const minW = parseCssUnit(minMatch[1]);
      if (containerWidth < minW) return false;
    }

    // Check max-width feature
    const maxMatch = /\(max-width:\s*([\d.]+(?:px|pt|mm|cm|in)?)\)/.exec(clean);
    if (maxMatch?.[1]) {
      const maxW = parseCssUnit(maxMatch[1]);
      if (containerWidth > maxW) return false;
    }

    return true;
  }

  public resolveCssVariables(
    val: string,
    variables: Record<string, string>,
    visited: Set<string> = new Set(),
  ): string {
    if (!val?.includes("var(")) return val;

    return val.replace(
      /var\(\s*(--[\w-]+)(?:,([^)]*))?\)/g,
      (_fullMatch, varName: string, fallback?: string) => {
        if (visited.has(varName)) {
          // Cycle detected! Stop recursion safely.
          return fallback
            ? this.resolveCssVariables(fallback.trim(), variables, visited)
            : "";
        }

        const varValue = variables[varName];
        if (varValue !== undefined) {
          const nextVisited = new Set(visited);
          nextVisited.add(varName);
          return this.resolveCssVariables(
            varValue.trim(),
            variables,
            nextVisited,
          );
        }

        if (fallback !== undefined) {
          return this.resolveCssVariables(fallback.trim(), variables, visited);
        }

        return "";
      },
    );
  }

  private parseFontWeight(val: string): number | string {
    const fw = val.toLowerCase().trim();
    if (fw === "bold") return 700;
    if (fw === "normal") return 400;
    const num = Number.parseInt(fw, 10);
    return Number.isNaN(num) ? fw : num;
  }

  private parseLineHeight(val: string): number {
    const v = val.toLowerCase().trim();
    if (v === "normal") return 1.2;
    const parsed = Number.parseFloat(v);
    const hasUnit = v.endsWith("px") || v.endsWith("pt") || v.endsWith("mm") || v.endsWith("cm") || v.endsWith("in") || v.endsWith("%");
    if (!Number.isNaN(parsed) && !hasUnit) return parsed;
    return parseCssUnit(val);
  }

  private applyFont(computed: ComputedStyle, prop: string, val: string): boolean {
    switch (prop) {
      case "color": computed.color = parseCssColor(val); return true;
      case "font-size": computed.fontSize = parseCssUnit(val, computed.fontSize); return true;
      case "font-family": computed.fontFamily = val.trim(); return true;
      case "font-weight": computed.fontWeight = this.parseFontWeight(val); return true;
      case "font-style": computed.fontStyle = val.includes("italic") || val.includes("oblique") ? "italic" : "normal"; return true;
      case "line-height": computed.lineHeight = this.parseLineHeight(val); return true;
      default: return false;
    }
  }

  private applyTextSpacing(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    switch (prop) {
      case "letter-spacing":
        computed.letterSpacing = val.toLowerCase().trim() === "normal" ? 0 : parseCssUnit(val);
        return true;
      case "word-spacing":
        computed.wordSpacing = val.toLowerCase().trim() === "normal" ? 0 : parseCssUnit(val);
        return true;
      case "text-indent":
        computed.textIndent = parseCssUnit(val, containerWidth);
        return true;
      case "vertical-align": {
        const v = val.toLowerCase().trim();
        if (v === "baseline" || v === "top" || v === "middle" || v === "bottom") computed.verticalAlign = v as any;
        else computed.verticalAlign = parseCssUnit(val);
        return true;
      }
      default: return false;
    }
  }

  private applyTextFormatting(computed: ComputedStyle, prop: string, val: string): boolean {
    const v = val.toLowerCase().trim();
    switch (prop) {
      case "text-transform":
        if (v === "none" || v === "uppercase" || v === "lowercase" || v === "capitalize") computed.textTransform = v as any;
        return true;
      case "text-overflow":
        if (v === "clip" || v === "ellipsis") computed.textOverflow = v as any;
        return true;
      case "text-decoration":
        if (v === "none" || v === "underline" || v === "line-through" || v === "overline") computed.textDecoration = v as any;
        return true;
      case "white-space":
        if (v === "normal" || v === "nowrap" || v === "pre" || v === "pre-wrap" || v === "pre-line") computed.whiteSpace = v as any;
        return true;
      case "text-align":
        computed.textAlign = val as any;
        return true;
      default: return false;
    }
  }

  private applyText(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    if (this.applyTextSpacing(computed, prop, val, containerWidth)) return true;
    return this.applyTextFormatting(computed, prop, val);
  }

  private applyTypography(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    if (this.applyFont(computed, prop, val)) return true;
    return this.applyText(computed, prop, val, containerWidth);
  }

  private applyDimensions(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    switch (prop) {
      case "width": computed.width = val === "auto" ? "auto" : parseCssUnit(val, containerWidth); return true;
      case "height": computed.height = val === "auto" ? "auto" : parseCssUnit(val); return true;
      case "min-width": {
        const v = val.toLowerCase().trim();
        computed.minWidth = v === "none" || v === "auto" ? "none" : parseCssUnit(val, containerWidth);
        return true;
      }
      case "max-width": {
        const v = val.toLowerCase().trim();
        computed.maxWidth = v === "none" || v === "auto" ? "none" : parseCssUnit(val, containerWidth);
        return true;
      }
      case "min-height": {
        const v = val.toLowerCase().trim();
        computed.minHeight = v === "none" || v === "auto" ? "none" : parseCssUnit(val);
        return true;
      }
      case "max-height": {
        const v = val.toLowerCase().trim();
        computed.maxHeight = v === "none" || v === "auto" ? "none" : parseCssUnit(val);
        return true;
      }
      default: return false;
    }
  }

  private applySpacingAndDisplay(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    switch (prop) {
      case "margin-top": computed.marginTop = parseCssUnit(val, containerWidth); return true;
      case "margin-right": computed.marginRight = parseCssUnit(val, containerWidth); return true;
      case "margin-bottom": computed.marginBottom = parseCssUnit(val, containerWidth); return true;
      case "margin-left": computed.marginLeft = parseCssUnit(val, containerWidth); return true;
      case "padding-top": computed.paddingTop = parseCssUnit(val, containerWidth); return true;
      case "padding-right": computed.paddingRight = parseCssUnit(val, containerWidth); return true;
      case "padding-bottom": computed.paddingBottom = parseCssUnit(val, containerWidth); return true;
      case "padding-left": computed.paddingLeft = parseCssUnit(val, containerWidth); return true;
      case "overflow":
      case "overflow-x":
      case "overflow-y": {
        const v = val.toLowerCase().trim();
        if (v === "visible" || v === "hidden" || v === "auto") {
          if (prop === "overflow") { computed.overflow = v as any; computed.overflowX = v as any; computed.overflowY = v as any; }
          else if (prop === "overflow-x") computed.overflowX = v as any;
          else computed.overflowY = v as any;
        }
        return true;
      }
      case "display": computed.display = val.toLowerCase() as any; return true;
      case "visibility": {
        const v = val.toLowerCase().trim();
        if (v === "visible" || v === "hidden") computed.visibility = v as any;
        return true;
      }
      default: return false;
    }
  }

  private applyBoxModel(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    if (this.applyDimensions(computed, prop, val, containerWidth)) return true;
    return this.applySpacingAndDisplay(computed, prop, val, containerWidth);
  }

  private applyBackground(computed: ComputedStyle, prop: string, val: string, _containerWidth: number): boolean {
    switch (prop) {
      case "background-color": computed.backgroundColor = parseCssColor(val); return true;
      case "background-image": computed.backgroundImage = parseImageUrl(val); return true;
      case "background-position": computed.backgroundPosition = val.trim(); return true;
      case "background-size": computed.backgroundSize = val.trim(); return true;
      case "background-repeat": {
        const v = val.toLowerCase().trim();
        if (v === "repeat" || v === "repeat-x" || v === "repeat-y" || v === "no-repeat") computed.backgroundRepeat = v;
        return true;
      }
      case "background": parseAndApplyBackgroundShorthand(computed, val); return true;
      default: return false;
    }
  }

  private setBorderSide(computed: ComputedStyle, side: "Top" | "Right" | "Bottom" | "Left" | "All", parsed: { width?: number; style?: string; color?: ParsedColor }) {
    if (side === "All") {
      this.setBorderSide(computed, "Top", parsed);
      this.setBorderSide(computed, "Right", parsed);
      this.setBorderSide(computed, "Bottom", parsed);
      this.setBorderSide(computed, "Left", parsed);
      return;
    }
    if (parsed.width !== undefined) (computed as any)[`border${side}Width`] = parsed.width;
    if (parsed.style !== undefined) (computed as any)[`border${side}Style`] = parsed.style;
    if (parsed.color !== undefined) (computed as any)[`border${side}Color`] = parsed.color;
  }

  private applyBorderSides(computed: ComputedStyle, prop: string, val: string): boolean {
    const sideMap: Record<string, "Top" | "Right" | "Bottom" | "Left" | "All"> = {
      "border": "All",
      "border-top": "Top",
      "border-right": "Right",
      "border-bottom": "Bottom",
      "border-left": "Left"
    };
    const side = sideMap[prop];
    if (!side) return false;
    this.setBorderSide(computed, side, parseBorderShorthand(val));
    return true;
  }

  private applyBorderProperties(computed: ComputedStyle, prop: string, val: string): boolean {
    switch (prop) {
      case "border-width": {
        const [t, r, b, l] = parse4Values(val, (v) => parseCssUnit(v));
        computed.borderTopWidth = t; computed.borderRightWidth = r; computed.borderBottomWidth = b; computed.borderLeftWidth = l;
        return true;
      }
      case "border-top-width": computed.borderTopWidth = parseCssUnit(val); return true;
      case "border-right-width": computed.borderRightWidth = parseCssUnit(val); return true;
      case "border-bottom-width": computed.borderBottomWidth = parseCssUnit(val); return true;
      case "border-left-width": computed.borderLeftWidth = parseCssUnit(val); return true;
      case "border-color": {
        const [t, r, b, l] = parse4Values(val, (v) => parseCssColor(v));
        computed.borderTopColor = t; computed.borderRightColor = r; computed.borderBottomColor = b; computed.borderLeftColor = l;
        return true;
      }
      case "border-top-color": computed.borderTopColor = parseCssColor(val); return true;
      case "border-right-color": computed.borderRightColor = parseCssColor(val); return true;
      case "border-bottom-color": computed.borderBottomColor = parseCssColor(val); return true;
      case "border-left-color": computed.borderLeftColor = parseCssColor(val); return true;
      case "border-style": {
        const [t, r, b, l] = parse4Values(val, (v) => v.toLowerCase().trim());
        computed.borderTopStyle = t; computed.borderRightStyle = r; computed.borderBottomStyle = b; computed.borderLeftStyle = l;
        return true;
      }
      case "border-top-style": computed.borderTopStyle = val.toLowerCase().trim(); return true;
      case "border-right-style": computed.borderRightStyle = val.toLowerCase().trim(); return true;
      case "border-bottom-style": computed.borderBottomStyle = val.toLowerCase().trim(); return true;
      case "border-left-style": computed.borderLeftStyle = val.toLowerCase().trim(); return true;
      case "border-radius": {
        const [tl, tr, br, bl] = parse4Values(val, (v) => parseCssUnit(v));
        computed.borderTopLeftRadius = tl; computed.borderTopRightRadius = tr; computed.borderBottomRightRadius = br; computed.borderBottomLeftRadius = bl;
        return true;
      }
      case "border-top-left-radius": computed.borderTopLeftRadius = parseCssUnit(val); return true;
      case "border-top-right-radius": computed.borderTopRightRadius = parseCssUnit(val); return true;
      case "border-bottom-right-radius": computed.borderBottomRightRadius = parseCssUnit(val); return true;
      case "border-bottom-left-radius": computed.borderBottomLeftRadius = parseCssUnit(val); return true;
      default: return false;
    }
  }

  private applyBorder(computed: ComputedStyle, prop: string, val: string, _containerWidth: number): boolean {
    if (this.applyBorderSides(computed, prop, val)) return true;
    return this.applyBorderProperties(computed, prop, val);
  }

  private applyFlexBox(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    switch (prop) {
      case "flex-direction": computed.flexDirection = val.toLowerCase() as any; return true;
      case "flex-wrap": {
        const v = val.toLowerCase();
        if (v === "wrap" || v === "wrap-reverse" || v === "nowrap") computed.flexWrap = v as any;
        return true;
      }
      case "flex-flow": {
        const parts = val.trim().toLowerCase().split(/\s+/);
        for (const part of parts) {
          if (part === "row" || part === "column" || part === "row-reverse" || part === "column-reverse") computed.flexDirection = part as any;
          else if (part === "nowrap" || part === "wrap" || part === "wrap-reverse") computed.flexWrap = part as any;
        }
        return true;
      }
      case "justify-content": computed.justifyContent = val.toLowerCase() as any; return true;
      case "align-items": computed.alignItems = val.toLowerCase() as any; return true;
      case "flex-grow": {
        const p = Number.parseFloat(val);
        if (!Number.isNaN(p)) computed.flexGrow = p;
        return true;
      }
      case "flex-shrink": {
        const p = Number.parseFloat(val);
        if (!Number.isNaN(p)) computed.flexShrink = p;
        return true;
      }
      case "flex-basis": computed.flexBasis = val === "auto" ? "auto" : parseCssUnit(val, containerWidth); return true;
      case "flex": this.applyFlexShorthand(computed, val, containerWidth); return true;
      default: return false;
    }
  }

  private applyGridSystem(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    switch (prop) {
      case "gap":
      case "grid-gap": {
        const parts = val.trim().split(/\s+/);
        if (parts.length === 2 && parts[0] && parts[1]) { computed.rowGap = parseCssUnit(parts[0], containerWidth); computed.columnGap = parseCssUnit(parts[1], containerWidth); }
        else if (parts[0]) { const g = parseCssUnit(parts[0], containerWidth); computed.rowGap = g; computed.columnGap = g; }
        return true;
      }
      case "row-gap":
      case "grid-row-gap": computed.rowGap = parseCssUnit(val, containerWidth); return true;
      case "column-gap":
      case "grid-column-gap": computed.columnGap = parseCssUnit(val, containerWidth); return true;
      case "grid-template-columns": computed.gridTemplateColumns = val.trim(); return true;
      case "grid-template-rows": computed.gridTemplateRows = val.trim(); return true;
      case "grid-column": {
        const res = applyGridLineShorthand(val);
        computed.gridColumnStart = res.start; computed.gridColumnEnd = res.end;
        return true;
      }
      case "grid-row": {
        const res = applyGridLineShorthand(val);
        computed.gridRowStart = res.start; computed.gridRowEnd = res.end;
        return true;
      }
      case "grid-column-start": computed.gridColumnStart = parseGridLineVal(val); return true;
      case "grid-column-end": computed.gridColumnEnd = parseGridLineVal(val); return true;
      case "grid-row-start": computed.gridRowStart = parseGridLineVal(val); return true;
      case "grid-row-end": computed.gridRowEnd = parseGridLineVal(val); return true;
      case "justify-items": computed.justifyItems = val.toLowerCase() as any; return true;
      case "justify-self": computed.justifySelf = val.toLowerCase() as any; return true;
      case "align-self": computed.alignSelf = val.toLowerCase() as any; return true;
      default: return false;
    }
  }

  private applyFlexGrid(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    if (this.applyFlexBox(computed, prop, val, containerWidth)) return true;
    return this.applyGridSystem(computed, prop, val, containerWidth);
  }

  private applyPositioning(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    switch (prop) {
      case "position": {
        const v = val.toLowerCase().trim();
        if (v === "static" || v === "relative" || v === "absolute" || v === "fixed") computed.position = v as any;
        return true;
      }
      case "z-index": {
        const v = val.toLowerCase().trim();
        if (v === "auto") computed.zIndex = "auto";
        else {
          const parsed = Number.parseInt(v, 10);
          computed.zIndex = Number.isNaN(parsed) ? "auto" : parsed;
        }
        return true;
      }
      case "float": {
        const v = val.toLowerCase().trim();
        if (v === "none" || v === "left" || v === "right") computed.float = v as any;
        return true;
      }
      case "clear": {
        const v = val.toLowerCase().trim();
        if (v === "none" || v === "left" || v === "right" || v === "both") computed.clear = v as any;
        return true;
      }
      case "top": computed.top = parsePositionOffset(val, containerWidth); return true;
      case "right": computed.right = parsePositionOffset(val, containerWidth); return true;
      case "bottom": computed.bottom = parsePositionOffset(val, containerWidth); return true;
      case "left": computed.left = parsePositionOffset(val, containerWidth); return true;
      default: return false;
    }
  }

  private applyPagination(computed: ComputedStyle, prop: string, val: string): boolean {
    switch (prop) {
      case "break-before":
      case "page-break-before": {
        const v = val.toLowerCase().trim();
        if (v === "page" || v === "always") { computed.breakBefore = "page"; computed.pageBreakBefore = "always"; }
        else if (v === "auto") { computed.breakBefore = "auto"; computed.pageBreakBefore = "auto"; }
        return true;
      }
      case "break-after":
      case "page-break-after": {
        const v = val.toLowerCase().trim();
        if (v === "page" || v === "always") { computed.breakAfter = "page"; computed.pageBreakAfter = "always"; }
        else if (v === "auto") { computed.breakAfter = "auto"; computed.pageBreakAfter = "auto"; }
        return true;
      }
      case "break-inside":
      case "page-break-inside": {
        const v = val.toLowerCase().trim();
        if (v === "avoid") { computed.breakInside = "avoid"; computed.pageBreakInside = "avoid"; }
        else if (v === "auto") { computed.breakInside = "auto"; computed.pageBreakInside = "auto"; }
        return true;
      }
      default: return false;
    }
  }

  private applyLayoutPage(computed: ComputedStyle, prop: string, val: string, containerWidth: number): boolean {
    if (this.applyPositioning(computed, prop, val, containerWidth)) return true;
    return this.applyPagination(computed, prop, val);
  }

  private applyDeclaration(computed: ComputedStyle, prop: string, rawVal: string, containerWidth: number): void {
    if (prop.startsWith("--")) return;

    try {
      const val = this.resolveCssVariables(rawVal, computed.customProperties);
      if (this.applyTypography(computed, prop, val, containerWidth)) return;
      if (this.applyBoxModel(computed, prop, val, containerWidth)) return;
      if (this.applyBackground(computed, prop, val, containerWidth)) return;
      if (this.applyBorder(computed, prop, val, containerWidth)) return;
      if (this.applyFlexGrid(computed, prop, val, containerWidth)) return;
      this.applyLayoutPage(computed, prop, val, containerWidth);
    } catch {
      // Ignore invalid declaration and preserve default
    }
  }

  private applyDeclarations(
    computed: ComputedStyle,
    decls: Record<string, string>,
    containerWidth: number,
  ): void {
    for (const [prop, rawVal] of Object.entries(decls)) {
      if (prop.startsWith("--")) {
        computed.customProperties[prop] = this.resolveCssVariables(
          rawVal,
          computed.customProperties,
        );
      }
    }

    for (const [prop, rawVal] of Object.entries(decls)) {
      this.applyDeclaration(computed, prop, rawVal, containerWidth);
    }
  }

  private applyFlexKeyword(computed: ComputedStyle, keyword: string): boolean {
    if (keyword === "none") {
      computed.flexGrow = 0;
      computed.flexShrink = 0;
      computed.flexBasis = "auto";
      return true;
    }
    if (keyword === "auto") {
      computed.flexGrow = 1;
      computed.flexShrink = 1;
      computed.flexBasis = "auto";
      return true;
    }
    if (keyword === "initial") {
      computed.flexGrow = 0;
      computed.flexShrink = 1;
      computed.flexBasis = "auto";
      return true;
    }
    return false;
  }

  private applyFlexOnePart(computed: ComputedStyle, p0: string, containerWidth: number): void {
    const num = Number.parseFloat(p0);
    if (!Number.isNaN(num) && !/[a-z%]/i.exec(p0)) {
      computed.flexGrow = num;
      computed.flexShrink = 1;
      computed.flexBasis = 0;
    } else {
      computed.flexBasis = parseCssUnit(p0, containerWidth);
    }
  }

  private applyFlexTwoParts(computed: ComputedStyle, p0: string, p1: string, containerWidth: number): void {
    const g = Number.parseFloat(p0);
    if (!Number.isNaN(g)) computed.flexGrow = g;
    const num2 = Number.parseFloat(p1);
    if (!Number.isNaN(num2) && !/[a-z%]/i.exec(p1)) computed.flexShrink = num2;
    else computed.flexBasis = parseCssUnit(p1, containerWidth);
  }

  private applyFlexThreeParts(computed: ComputedStyle, p0: string, p1: string, p2: string, containerWidth: number): void {
    const g = Number.parseFloat(p0);
    const s = Number.parseFloat(p1);
    if (!Number.isNaN(g)) computed.flexGrow = g;
    if (!Number.isNaN(s)) computed.flexShrink = s;
    computed.flexBasis = p2 === "auto" ? "auto" : parseCssUnit(p2, containerWidth);
  }

  private applyFlexParts(computed: ComputedStyle, parts: string[], containerWidth: number): void {
    const [p0, p1, p2] = parts;
    if (parts.length === 1 && p0) {
      this.applyFlexOnePart(computed, p0, containerWidth);
    } else if (parts.length === 2 && p0 && p1) {
      this.applyFlexTwoParts(computed, p0, p1, containerWidth);
    } else if (parts.length >= 3 && p0 && p1 && p2) {
      this.applyFlexThreeParts(computed, p0, p1, p2, containerWidth);
    }
  }

  private applyFlexShorthand(
    computed: ComputedStyle,
    val: string,
    containerWidth: number,
  ): void {
    const trimmed = val.trim().toLowerCase();
    if (this.applyFlexKeyword(computed, trimmed)) return;
    this.applyFlexParts(computed, trimmed.split(/\s+/), containerWidth);
  }
}

function parseGridLineVal(val: string): string | number {
  const trimmed = val.trim().toLowerCase();
  if (trimmed.startsWith("span")) return trimmed;
  const num = Number.parseInt(trimmed, 10);
  return Number.isNaN(num) ? "auto" : num;
}

function applyGridLineShorthand(val: string): {
  start: string | number;
  end: string | number;
} {
  const parts = val.split("/").map((s) => s.trim());
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      start: parseGridLineVal(parts[0]),
      end: parseGridLineVal(parts[1]),
    };
  } else if (parts[0]) {
    const parsed = parseGridLineVal(parts[0]);
    if (typeof parsed === "string" && parsed.startsWith("span")) {
      return { start: "auto", end: parsed };
    }
    return { start: parsed, end: "auto" };
  }
  return { start: "auto", end: "auto" };
}

export function parsePositionOffset(
  val: string,
  containerWidth?: number,
): number | string {
  const trimmed = val.trim().toLowerCase();
  if (trimmed === "auto" || trimmed === "initial") return "auto";
  if (trimmed.endsWith("%")) return trimmed;
  return parseCssUnit(val, containerWidth);
}

export function resolveOffset(
  offset: number | string,
  containerSize: number,
): number | "auto" {
  if (offset === "auto") return "auto";
  if (typeof offset === "number") return offset;
  if (typeof offset === "string" && offset.endsWith("%")) {
    const pct = Number.parseFloat(offset.slice(0, -1));
    return Number.isNaN(pct) ? 0 : (pct / 100) * containerSize;
  }
  if (typeof offset === "string") {
    return parseCssUnit(offset, containerSize);
  }
  return "auto";
}

function parseImageUrl(val: string): string | null {
  const trimmed = val.trim();
  if (trimmed === "none" || !trimmed) return null;
  const match = /url\(([^)]+)\)/i.exec(trimmed);
  if (match?.[1]) {
    let url = match[1].trim();
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
      url = url.slice(1, -1);
    }
    return url.trim();
  }
  return null;
}

function extractBackgroundSize(computed: ComputedStyle, val: string): void {
  if (val.includes("/")) {
    const slashParts = val.split("/");
    if (slashParts[1]) {
      const sizeToken = slashParts[1].trim().split(/\s+/)[0]?.replace(/;$/, "");
      if (sizeToken) computed.backgroundSize = sizeToken;
    }
  }
}

function applyBackgroundPart(computed: ComputedStyle, part: string): void {
  const lower = part.toLowerCase();
  if (["repeat", "repeat-x", "repeat-y", "no-repeat"].includes(lower)) {
    computed.backgroundRepeat = lower as any;
  } else if (["left", "right", "center", "top", "bottom"].includes(lower)) {
    computed.backgroundPosition = lower;
  } else {
    const color = parseCssColor(part);
    if (
      color &&
      (part.startsWith("#") ||
        part.startsWith("rgb") ||
        part.startsWith("hsl") ||
        NAMED_COLORS[lower] ||
        lower === "transparent")
    ) {
      computed.backgroundColor = color;
    }
  }
}

function parseAndApplyBackgroundShorthand(
  computed: ComputedStyle,
  val: string,
): void {
  const img = parseImageUrl(val);
  if (img) computed.backgroundImage = img;

  extractBackgroundSize(computed, val);

  const parts = val
    .replace(/url\([^)]*\)/gi, "")
    .replace(/\/[^/]*$/g, "")
    .split(/[\s,]+/)
    .map((p) => p.replace(/;$/, "").trim())
    .filter((p) => p.length > 0);

  for (const part of parts) {
    applyBackgroundPart(computed, part);
  }
}
function parseBorderShorthand(val: string): {
  width?: number;
  style?: string;
  color?: ParsedColor;
} {
  const result: { width?: number; style?: string; color?: ParsedColor } = {};
  const parts = val
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  const styles = new Set([
    "none",
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "inset",
    "outset",
  ]);

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (styles.has(lower)) {
      result.style = lower;
    } else if (
      lower.endsWith("px") ||
      lower.endsWith("pt") ||
      lower.endsWith("em") ||
      lower.endsWith("cm") ||
      lower.endsWith("mm") ||
      lower === "thin" ||
      lower === "medium" ||
      lower === "thick" ||
      (!Number.isNaN(Number.parseFloat(lower)) &&
        !lower.startsWith("#") &&
        !lower.startsWith("rgb") &&
        !lower.startsWith("hsl"))
    ) {
      if (lower === "thin") result.width = 1;
      else if (lower === "medium") result.width = 2;
      else if (lower === "thick") result.width = 4;
      else result.width = parseCssUnit(part);
    } else {
      const parsed = parseCssColor(part);
      if (parsed) {
        result.color = parsed;
      }
    }
  }
  return result;
}

function parse4Values<T>(val: string, parser: (v: string) => T): [T, T, T, T] {
  const parts = val
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 1 && parts[0]) {
    const v = parser(parts[0]);
    return [v, v, v, v];
  } else if (parts.length === 2 && parts[0] && parts[1]) {
    const v1 = parser(parts[0]);
    const v2 = parser(parts[1]);
    return [v1, v2, v1, v2];
  } else if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const v1 = parser(parts[0]);
    const v2 = parser(parts[1]);
    const v3 = parser(parts[2]);
    return [v1, v2, v3, v2];
  } else if (
    parts.length >= 4 &&
    parts[0] &&
    parts[1] &&
    parts[2] &&
    parts[3]
  ) {
    return [
      parser(parts[0]),
      parser(parts[1]),
      parser(parts[2]),
      parser(parts[3]),
    ];
  }
  const fallback = parser(val);
  return [fallback, fallback, fallback, fallback];
}
