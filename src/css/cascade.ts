import { ElementNode } from "../html/dom/node.js";
import { CSSParser, CSSRule } from "./parser.js";
import { compareSpecificity } from "./specificity.js";
import {
  ComputedStyle,
  createDefaultComputedStyle,
  DisplayType,
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

export function parsePageRules(rules: CSSRule[]): PageRuleConfig {
  const config: PageRuleConfig = {};
  const pageRules = rules.filter((r) => r.selector.startsWith("@page"));
  for (const rule of pageRules) {
    for (const [key, val] of Object.entries(rule.declarations)) {
      if (key === "size") {
        const parts = val.trim().split(/\s+/);
        if (parts.length === 1) {
          const first = parts[0] ?? "";
          const lower = first.toLowerCase();
          if (lower === "landscape" || lower === "portrait") {
            config.orientation = lower as PageOrientation;
          } else if (STANDARD_PAGE_SIZES[first as PageSizeName]) {
            config.pageSize = first as PageSizeName;
          } else if (first.match(/^[0-9]+(pt|px|mm|cm|in)?$/)) {
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
          } else if (first.match(/^[0-9]+/) && second.match(/^[0-9]+/)) {
            config.pageSize = {
              width: parseCssUnit(first),
              height: parseCssUnit(second),
            };
          }
        }
      } else if (
        key === "margin-top" ||
        key === "margin-right" ||
        key === "margin-bottom" ||
        key === "margin-left" ||
        key === "margin"
      ) {
        if (!config.margins) config.margins = {};
        if (key === "margin-top") config.margins.top = parseCssUnit(val);
        if (key === "margin-right") config.margins.right = parseCssUnit(val);
        if (key === "margin-bottom") config.margins.bottom = parseCssUnit(val);
        if (key === "margin-left") config.margins.left = parseCssUnit(val);
        if (key === "margin") {
          const m = parseCssUnit(val);
          config.margins = { top: m, right: m, bottom: m, left: m };
        }
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
  private parser = new CSSParser();
  private fontManager: FontManager;

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

  private matchesSelector(element: ElementNode, selector: string): boolean {
    const sel = selector.trim();
    if (sel === "*") return true;

    // :root pseudo-class — matches the html element or any top-level root
    if (sel === ":root") {
      return element.tagName === "html" || element.parent == null;
    }

    // Pseudo-class stripping — strip :hover, :focus, :first-child, etc.
    // We accept the rule for PDF rendering (static document, no interaction)
    const strippedSel = sel.replace(/::?[a-z-]+(?:\([^)]*\))?/g, "").trim();
    if (strippedSel !== sel && strippedSel) {
      return this.matchesSelector(element, strippedSel);
    }

    // Descendant selector (e.g. "table td" or "div.container p.title")
    if (sel.includes(" ")) {
      const parts = sel.split(/\s+/);
      const lastPart = parts[parts.length - 1];
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

    // Single tag
    if (sel.toLowerCase() === element.tagName) return true;

    // Single class (.invoice)
    if (sel.startsWith(".")) {
      return element.classList.includes(sel.slice(1));
    }

    // Single ID (#title)
    if (sel.startsWith("#")) {
      return element.id === sel.slice(1);
    }

    // Compound selectors: tag.class or tag#id with optional pseudo-classes
    // Split on . or # but not inside brackets
    const dotIdx = sel.indexOf(".");
    const hashIdx = sel.indexOf("#");

    // Compound tag.class (div.invoice)
    if (dotIdx > 0 && (hashIdx === -1 || dotIdx < hashIdx)) {
      const tag = sel.slice(0, dotIdx).toLowerCase();
      const rest = sel.slice(dotIdx + 1);
      const cls = rest.split(/[.#:]/)[0];
      if (tag && tag !== element.tagName) return false;
      return cls ? element.classList.includes(cls) : false;
    }

    if (dotIdx === 0) {
      const cls = sel.slice(1).split(/[.#:]/)[0];
      return cls ? element.classList.includes(cls) : false;
    }

    // Compound tag#id (div#title)
    if (hashIdx > 0) {
      const tag = sel.slice(0, hashIdx).toLowerCase();
      const id = sel.slice(hashIdx + 1).split(/[.#:]/)[0];
      if (tag && tag !== element.tagName) return false;
      return id ? element.id === id : false;
    }

    return false;
  }

  public evaluateMediaQuery(query: string, containerWidth: number): boolean {
    const clean = query.toLowerCase().trim();
    if (clean === "print" || clean === "all") return true;
    if (clean === "screen" || clean === "speech") return false;

    // Check min-width feature
    const minMatch = clean.match(
      /\(min-width:\s*([0-9.]+(?:px|pt|mm|cm|in)?)\)/,
    );
    if (minMatch && minMatch[1]) {
      const minW = parseCssUnit(minMatch[1]);
      if (containerWidth < minW) return false;
    }

    // Check max-width feature
    const maxMatch = clean.match(
      /\(max-width:\s*([0-9.]+(?:px|pt|mm|cm|in)?)\)/,
    );
    if (maxMatch && maxMatch[1]) {
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
    if (!val || !val.includes("var(")) return val;

    return val.replace(
      /var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([\s\S]*?))?\)/g,
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

  private applyDeclarations(
    computed: ComputedStyle,
    decls: Record<string, string>,
    containerWidth: number,
  ): void {
    // 1. Collect and resolve custom CSS property definitions first (--custom-prop)
    for (const [prop, rawVal] of Object.entries(decls)) {
      if (prop.startsWith("--")) {
        const resolved = this.resolveCssVariables(
          rawVal,
          computed.customProperties,
        );
        computed.customProperties[prop] = resolved;
      }
    }

    // 2. Resolve CSS variables for standard properties
    for (const [prop, rawVal] of Object.entries(decls)) {
      if (prop.startsWith("--")) continue;

      const val = this.resolveCssVariables(rawVal, computed.customProperties);

      if (prop === "display") {
        computed.display = val.toLowerCase() as DisplayType;
      } else if (prop === "color") {
        computed.color = parseCssColor(val);
      } else if (prop === "background-color") {
        computed.backgroundColor = parseCssColor(val);
      } else if (prop === "background-image") {
        computed.backgroundImage = parseImageUrl(val);
      } else if (prop === "background-position") {
        computed.backgroundPosition = val.trim();
      } else if (prop === "background-size") {
        computed.backgroundSize = val.trim();
      } else if (prop === "background-repeat") {
        const v = val.toLowerCase().trim();
        if (
          v === "repeat" ||
          v === "repeat-x" ||
          v === "repeat-y" ||
          v === "no-repeat"
        ) {
          computed.backgroundRepeat = v;
        }
      } else if (prop === "background") {
        parseAndApplyBackgroundShorthand(computed, val);
      } else if (prop === "font-size") {
        computed.fontSize = parseCssUnit(val, computed.fontSize);
      } else if (prop === "font-family") {
        computed.fontFamily = val.trim();
      } else if (prop === "font-weight") {
        const fw = val.toLowerCase().trim();
        if (fw === "bold") computed.fontWeight = 700;
        else if (fw === "normal") computed.fontWeight = 400;
        else {
          const num = parseInt(fw, 10);
          computed.fontWeight = isNaN(num) ? fw : num;
        }
      } else if (prop === "font-style") {
        computed.fontStyle =
          val.includes("italic") || val.includes("oblique")
            ? "italic"
            : "normal";
      } else if (prop === "line-height") {
        const v = val.toLowerCase().trim();
        if (v === "normal") {
          computed.lineHeight = 1.2;
        } else {
          const parsed = parseFloat(v);
          const hasUnit =
            v.endsWith("px") ||
            v.endsWith("pt") ||
            v.endsWith("mm") ||
            v.endsWith("cm") ||
            v.endsWith("in") ||
            v.endsWith("%");
          if (!isNaN(parsed) && !hasUnit) {
            computed.lineHeight = parsed;
          } else {
            computed.lineHeight = parseCssUnit(val);
          }
        }
      } else if (prop === "letter-spacing") {
        const v = val.toLowerCase().trim();
        computed.letterSpacing = v === "normal" ? 0 : parseCssUnit(val);
      } else if (prop === "word-spacing") {
        const v = val.toLowerCase().trim();
        computed.wordSpacing = v === "normal" ? 0 : parseCssUnit(val);
      } else if (prop === "text-transform") {
        const v = val.toLowerCase().trim();
        if (
          v === "none" ||
          v === "uppercase" ||
          v === "lowercase" ||
          v === "capitalize"
        ) {
          computed.textTransform = v;
        }
      } else if (prop === "text-indent") {
        computed.textIndent = parseCssUnit(val, containerWidth);
      } else if (prop === "vertical-align") {
        const v = val.toLowerCase().trim();
        if (
          v === "baseline" ||
          v === "top" ||
          v === "middle" ||
          v === "bottom"
        ) {
          computed.verticalAlign = v;
        } else {
          computed.verticalAlign = parseCssUnit(val);
        }
      } else if (prop === "text-overflow") {
        const v = val.toLowerCase().trim();
        if (v === "clip" || v === "ellipsis") {
          computed.textOverflow = v;
        }
      } else if (prop === "text-decoration") {
        const v = val.toLowerCase().trim();
        if (
          v === "none" ||
          v === "underline" ||
          v === "line-through" ||
          v === "overline"
        ) {
          computed.textDecoration = v;
        }
      } else if (prop === "white-space") {
        const v = val.toLowerCase().trim();
        if (
          v === "normal" ||
          v === "nowrap" ||
          v === "pre" ||
          v === "pre-wrap" ||
          v === "pre-line"
        ) {
          computed.whiteSpace = v;
        }
      } else if (prop === "visibility") {
        const v = val.toLowerCase().trim();
        if (v === "visible" || v === "hidden") {
          computed.visibility = v;
        }
      } else if (prop === "text-align") {
        computed.textAlign = val as "left" | "center" | "right" | "justify";
      } else if (prop === "width") {
        computed.width =
          val === "auto" ? "auto" : parseCssUnit(val, containerWidth);
      } else if (prop === "height") {
        computed.height = val === "auto" ? "auto" : parseCssUnit(val);
      } else if (prop === "min-width") {
        const v = val.toLowerCase().trim();
        computed.minWidth =
          v === "none" || v === "auto"
            ? "none"
            : parseCssUnit(val, containerWidth);
      } else if (prop === "max-width") {
        const v = val.toLowerCase().trim();
        computed.maxWidth =
          v === "none" || v === "auto"
            ? "none"
            : parseCssUnit(val, containerWidth);
      } else if (prop === "min-height") {
        const v = val.toLowerCase().trim();
        computed.minHeight =
          v === "none" || v === "auto" ? "none" : parseCssUnit(val);
      } else if (prop === "max-height") {
        const v = val.toLowerCase().trim();
        computed.maxHeight =
          v === "none" || v === "auto" ? "none" : parseCssUnit(val);
      } else if (prop === "overflow") {
        const v = val.toLowerCase().trim();
        if (v === "visible" || v === "hidden" || v === "auto") {
          computed.overflow = v;
          computed.overflowX = v;
          computed.overflowY = v;
        }
      } else if (prop === "overflow-x") {
        const v = val.toLowerCase().trim();
        if (v === "visible" || v === "hidden" || v === "auto") {
          computed.overflowX = v;
        }
      } else if (prop === "overflow-y") {
        const v = val.toLowerCase().trim();
        if (v === "visible" || v === "hidden" || v === "auto") {
          computed.overflowY = v;
        }
      } else if (prop === "margin-top")
        computed.marginTop = parseCssUnit(val, containerWidth);
      else if (prop === "margin-right")
        computed.marginRight = parseCssUnit(val, containerWidth);
      else if (prop === "margin-bottom")
        computed.marginBottom = parseCssUnit(val, containerWidth);
      else if (prop === "margin-left")
        computed.marginLeft = parseCssUnit(val, containerWidth);
      else if (prop === "padding-top")
        computed.paddingTop = parseCssUnit(val, containerWidth);
      else if (prop === "padding-right")
        computed.paddingRight = parseCssUnit(val, containerWidth);
      else if (prop === "padding-bottom")
        computed.paddingBottom = parseCssUnit(val, containerWidth);
      else if (prop === "padding-left")
        computed.paddingLeft = parseCssUnit(val, containerWidth);
      else if (prop === "border") {
        const parsed = parseBorderShorthand(val);
        if (parsed.width !== undefined) {
          computed.borderTopWidth = parsed.width;
          computed.borderRightWidth = parsed.width;
          computed.borderBottomWidth = parsed.width;
          computed.borderLeftWidth = parsed.width;
        }
        if (parsed.style !== undefined) {
          computed.borderTopStyle = parsed.style;
          computed.borderRightStyle = parsed.style;
          computed.borderBottomStyle = parsed.style;
          computed.borderLeftStyle = parsed.style;
        }
        if (parsed.color !== undefined) {
          computed.borderTopColor = parsed.color;
          computed.borderRightColor = parsed.color;
          computed.borderBottomColor = parsed.color;
          computed.borderLeftColor = parsed.color;
        }
      } else if (prop === "border-top") {
        const parsed = parseBorderShorthand(val);
        if (parsed.width !== undefined) computed.borderTopWidth = parsed.width;
        if (parsed.style !== undefined) computed.borderTopStyle = parsed.style;
        if (parsed.color !== undefined) computed.borderTopColor = parsed.color;
      } else if (prop === "border-right") {
        const parsed = parseBorderShorthand(val);
        if (parsed.width !== undefined)
          computed.borderRightWidth = parsed.width;
        if (parsed.style !== undefined)
          computed.borderRightStyle = parsed.style;
        if (parsed.color !== undefined)
          computed.borderRightColor = parsed.color;
      } else if (prop === "border-bottom") {
        const parsed = parseBorderShorthand(val);
        if (parsed.width !== undefined)
          computed.borderBottomWidth = parsed.width;
        if (parsed.style !== undefined)
          computed.borderBottomStyle = parsed.style;
        if (parsed.color !== undefined)
          computed.borderBottomColor = parsed.color;
      } else if (prop === "border-left") {
        const parsed = parseBorderShorthand(val);
        if (parsed.width !== undefined) computed.borderLeftWidth = parsed.width;
        if (parsed.style !== undefined) computed.borderLeftStyle = parsed.style;
        if (parsed.color !== undefined) computed.borderLeftColor = parsed.color;
      } else if (prop === "border-width") {
        const [t, r, b, l] = parse4Values(val, (v) => parseCssUnit(v));
        computed.borderTopWidth = t;
        computed.borderRightWidth = r;
        computed.borderBottomWidth = b;
        computed.borderLeftWidth = l;
      } else if (prop === "border-top-width") {
        computed.borderTopWidth = parseCssUnit(val);
      } else if (prop === "border-right-width") {
        computed.borderRightWidth = parseCssUnit(val);
      } else if (prop === "border-bottom-width") {
        computed.borderBottomWidth = parseCssUnit(val);
      } else if (prop === "border-left-width") {
        computed.borderLeftWidth = parseCssUnit(val);
      } else if (prop === "border-color") {
        const [t, r, b, l] = parse4Values(val, (v) => parseCssColor(v));
        computed.borderTopColor = t;
        computed.borderRightColor = r;
        computed.borderBottomColor = b;
        computed.borderLeftColor = l;
      } else if (prop === "border-top-color") {
        computed.borderTopColor = parseCssColor(val);
      } else if (prop === "border-right-color") {
        computed.borderRightColor = parseCssColor(val);
      } else if (prop === "border-bottom-color") {
        computed.borderBottomColor = parseCssColor(val);
      } else if (prop === "border-left-color") {
        computed.borderLeftColor = parseCssColor(val);
      } else if (prop === "border-style") {
        const [t, r, b, l] = parse4Values(val, (v) => v.toLowerCase().trim());
        computed.borderTopStyle = t;
        computed.borderRightStyle = r;
        computed.borderBottomStyle = b;
        computed.borderLeftStyle = l;
      } else if (prop === "border-top-style") {
        computed.borderTopStyle = val.toLowerCase().trim();
      } else if (prop === "border-right-style") {
        computed.borderRightStyle = val.toLowerCase().trim();
      } else if (prop === "border-bottom-style") {
        computed.borderBottomStyle = val.toLowerCase().trim();
      } else if (prop === "border-left-style") {
        computed.borderLeftStyle = val.toLowerCase().trim();
      } else if (prop === "border-radius") {
        const [tl, tr, br, bl] = parse4Values(val, (v) => parseCssUnit(v));
        computed.borderTopLeftRadius = tl;
        computed.borderTopRightRadius = tr;
        computed.borderBottomRightRadius = br;
        computed.borderBottomLeftRadius = bl;
      } else if (prop === "border-top-left-radius") {
        computed.borderTopLeftRadius = parseCssUnit(val);
      } else if (prop === "border-top-right-radius") {
        computed.borderTopRightRadius = parseCssUnit(val);
      } else if (prop === "border-bottom-right-radius") {
        computed.borderBottomRightRadius = parseCssUnit(val);
      } else if (prop === "border-bottom-left-radius") {
        computed.borderBottomLeftRadius = parseCssUnit(val);
      } else if (prop === "break-before" || prop === "page-break-before") {
        const v = val.toLowerCase().trim();
        if (v === "page" || v === "always") {
          computed.breakBefore = "page";
          computed.pageBreakBefore = "always";
        } else if (v === "auto") {
          computed.breakBefore = "auto";
          computed.pageBreakBefore = "auto";
        }
      } else if (prop === "break-after" || prop === "page-break-after") {
        const v = val.toLowerCase().trim();
        if (v === "page" || v === "always") {
          computed.breakAfter = "page";
          computed.pageBreakAfter = "always";
        } else if (v === "auto") {
          computed.breakAfter = "auto";
          computed.pageBreakAfter = "auto";
        }
      } else if (prop === "break-inside" || prop === "page-break-inside") {
        const v = val.toLowerCase().trim();
        if (v === "avoid") {
          computed.breakInside = "avoid";
          computed.pageBreakInside = "avoid";
        } else if (v === "auto") {
          computed.breakInside = "auto";
          computed.pageBreakInside = "auto";
        }
      } else if (prop === "position") {
        const v = val.toLowerCase().trim();
        if (
          v === "static" ||
          v === "relative" ||
          v === "absolute" ||
          v === "fixed"
        ) {
          computed.position = v;
        }
      } else if (prop === "z-index") {
        const v = val.toLowerCase().trim();
        if (v === "auto") {
          computed.zIndex = "auto";
        } else {
          const parsed = parseInt(v, 10);
          computed.zIndex = isNaN(parsed) ? "auto" : parsed;
        }
      } else if (prop === "float") {
        const v = val.toLowerCase().trim();
        if (v === "none" || v === "left" || v === "right") {
          computed.float = v;
        }
      } else if (prop === "clear") {
        const v = val.toLowerCase().trim();
        if (v === "none" || v === "left" || v === "right" || v === "both") {
          computed.clear = v;
        }
      } else if (prop === "top") {
        computed.top = parsePositionOffset(val, containerWidth);
      } else if (prop === "right") {
        computed.right = parsePositionOffset(val, containerWidth);
      } else if (prop === "bottom") {
        computed.bottom = parsePositionOffset(val, containerWidth);
      } else if (prop === "left") {
        computed.left = parsePositionOffset(val, containerWidth);
      } else if (prop === "flex-direction")
        computed.flexDirection = val.toLowerCase() as any;
      else if (prop === "flex-wrap") {
        const v = val.toLowerCase();
        if (v === "wrap" || v === "wrap-reverse" || v === "nowrap") {
          computed.flexWrap = v as any;
        }
      } else if (prop === "flex-flow") {
        const parts = val.trim().toLowerCase().split(/\s+/);
        for (const part of parts) {
          if (
            part === "row" ||
            part === "column" ||
            part === "row-reverse" ||
            part === "column-reverse"
          ) {
            computed.flexDirection = part as any;
          } else if (
            part === "nowrap" ||
            part === "wrap" ||
            part === "wrap-reverse"
          ) {
            computed.flexWrap = part as any;
          }
        }
      } else if (prop === "justify-content")
        computed.justifyContent = val.toLowerCase() as any;
      else if (prop === "align-items")
        computed.alignItems = val.toLowerCase() as any;
      else if (prop === "gap" || prop === "grid-gap") {
        const parts = val.trim().split(/\s+/);
        if (parts.length === 2 && parts[0] && parts[1]) {
          computed.rowGap = parseCssUnit(parts[0], containerWidth);
          computed.columnGap = parseCssUnit(parts[1], containerWidth);
        } else if (parts[0]) {
          const g = parseCssUnit(parts[0], containerWidth);
          computed.rowGap = g;
          computed.columnGap = g;
        }
      } else if (prop === "row-gap" || prop === "grid-row-gap") {
        computed.rowGap = parseCssUnit(val, containerWidth);
      } else if (prop === "column-gap" || prop === "grid-column-gap") {
        computed.columnGap = parseCssUnit(val, containerWidth);
      } else if (prop === "flex-grow") {
        const p = parseFloat(val);
        if (!isNaN(p)) computed.flexGrow = p;
      } else if (prop === "flex-shrink") {
        const p = parseFloat(val);
        if (!isNaN(p)) computed.flexShrink = p;
      } else if (prop === "flex-basis") {
        computed.flexBasis =
          val === "auto" ? "auto" : parseCssUnit(val, containerWidth);
      } else if (prop === "flex") {
        this.applyFlexShorthand(computed, val, containerWidth);
      } else if (prop === "grid-template-columns") {
        computed.gridTemplateColumns = val.trim();
      } else if (prop === "grid-template-rows") {
        computed.gridTemplateRows = val.trim();
      } else if (prop === "grid-column") {
        const res = applyGridLineShorthand(val);
        computed.gridColumnStart = res.start;
        computed.gridColumnEnd = res.end;
      } else if (prop === "grid-row") {
        const res = applyGridLineShorthand(val);
        computed.gridRowStart = res.start;
        computed.gridRowEnd = res.end;
      } else if (prop === "grid-column-start") {
        computed.gridColumnStart = parseGridLineVal(val);
      } else if (prop === "grid-column-end") {
        computed.gridColumnEnd = parseGridLineVal(val);
      } else if (prop === "grid-row-start") {
        computed.gridRowStart = parseGridLineVal(val);
      } else if (prop === "grid-row-end") {
        computed.gridRowEnd = parseGridLineVal(val);
      } else if (prop === "justify-items") {
        computed.justifyItems = val.toLowerCase() as any;
      } else if (prop === "justify-self") {
        computed.justifySelf = val.toLowerCase() as any;
      } else if (prop === "align-self") {
        computed.alignSelf = val.toLowerCase() as any;
      }
    }
  }

  private applyFlexShorthand(
    computed: ComputedStyle,
    val: string,
    containerWidth: number,
  ): void {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === "none") {
      computed.flexGrow = 0;
      computed.flexShrink = 0;
      computed.flexBasis = "auto";
      return;
    }
    if (trimmed === "auto") {
      computed.flexGrow = 1;
      computed.flexShrink = 1;
      computed.flexBasis = "auto";
      return;
    }
    if (trimmed === "initial") {
      computed.flexGrow = 0;
      computed.flexShrink = 1;
      computed.flexBasis = "auto";
      return;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1 && parts[0]) {
      const num = parseFloat(parts[0]);
      if (!isNaN(num) && !parts[0].match(/[a-z%]/i)) {
        computed.flexGrow = num;
        computed.flexShrink = 1;
        computed.flexBasis = 0;
      } else {
        computed.flexBasis = parseCssUnit(parts[0], containerWidth);
      }
    } else if (parts.length === 2 && parts[0] && parts[1]) {
      const g = parseFloat(parts[0]);
      if (!isNaN(g)) computed.flexGrow = g;

      const num2 = parseFloat(parts[1]);
      if (!isNaN(num2) && !parts[1].match(/[a-z%]/i)) {
        computed.flexShrink = num2;
      } else {
        computed.flexBasis = parseCssUnit(parts[1], containerWidth);
      }
    } else if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
      const g = parseFloat(parts[0]);
      const s = parseFloat(parts[1]);
      if (!isNaN(g)) computed.flexGrow = g;
      if (!isNaN(s)) computed.flexShrink = s;
      computed.flexBasis =
        parts[2] === "auto" ? "auto" : parseCssUnit(parts[2], containerWidth);
    }
  }
}

function parseGridLineVal(val: string): string | number {
  const trimmed = val.trim().toLowerCase();
  if (trimmed.startsWith("span")) return trimmed;
  const num = parseInt(trimmed, 10);
  return isNaN(num) ? "auto" : num;
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
): number | string | "auto" {
  const trimmed = val.trim().toLowerCase();
  if (trimmed === "auto" || trimmed === "initial") return "auto";
  if (trimmed.endsWith("%")) return trimmed;
  return parseCssUnit(val, containerWidth);
}

export function resolveOffset(
  offset: number | string | "auto",
  containerSize: number,
): number | "auto" {
  if (offset === "auto") return "auto";
  if (typeof offset === "number") return offset;
  if (typeof offset === "string" && offset.endsWith("%")) {
    const pct = parseFloat(offset.slice(0, -1));
    return isNaN(pct) ? 0 : (pct / 100) * containerSize;
  }
  if (typeof offset === "string") {
    return parseCssUnit(offset, containerSize);
  }
  return "auto";
}

function parseImageUrl(val: string): string | null {
  const trimmed = val.trim();
  if (trimmed === "none" || !trimmed) return null;
  const match = trimmed.match(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/i);
  if (match && match[2]) {
    return match[2].trim();
  }
  return null;
}

function parseAndApplyBackgroundShorthand(
  computed: ComputedStyle,
  val: string,
): void {
  const img = parseImageUrl(val);
  if (img) {
    computed.backgroundImage = img;
  }

  if (val.includes("/")) {
    const slashParts = val.split("/");
    if (slashParts[1]) {
      const sizeToken = slashParts[1].trim().split(/\s+/)[0]?.replace(/;$/, "");
      if (sizeToken) computed.backgroundSize = sizeToken;
    }
  }

  const parts = val
    .replace(/url\s*\([^)]*\)/gi, "")
    .replace(/\/.*$/g, "")
    .split(/[\s,]+/)
    .map((p) => p.replace(/;$/, "").trim())
    .filter((p) => p.length > 0);

  for (const part of parts) {
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
  const styles = [
    "none",
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "inset",
    "outset",
  ];

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (styles.includes(lower)) {
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
      (!isNaN(parseFloat(lower)) &&
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
