import { calculateSpecificity, Specificity } from "./specificity.js";

export interface CSSRule {
  selector: string;
  declarations: Record<string, string>;
  specificity: Specificity;
  mediaQuery?: string;
}

export class CSSParser {
  parse(css: string): CSSRule[] {
    const rules: CSSRule[] = [];
    const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();

    this.parseBlockContent(cleanCss, rules);

    return rules;
  }

  private parseBlockContent(css: string, rules: CSSRule[], currentMedia?: string): void {
    let index = 0;
    const length = css.length;

    while (index < length) {
      // Skip whitespace
      while (index < length && /\s/.test(css[index]!)) {
        index++;
      }
      if (index >= length) break;

      // Find the first unquoted, unparenthesized '{' or ';' starting from index
      let braceOpenIdx = -1;
      let semiColonIdx = -1;
      let inSingleQuote = false;
      let inDoubleQuote = false;
      let parenDepth = 0;

      for (let i = index; i < length; i++) {
        const char = css[i];
        if (char === "'" && !inDoubleQuote) {
          inSingleQuote = !inSingleQuote;
        } else if (char === '"' && !inSingleQuote) {
          inDoubleQuote = !inDoubleQuote;
        } else if (!inSingleQuote && !inDoubleQuote) {
          if (char === "(") {
            parenDepth++;
          } else if (char === ")") {
            if (parenDepth > 0) parenDepth--;
          } else if (parenDepth === 0) {
            if (char === "{") {
              braceOpenIdx = i;
              break;
            } else if (char === ";" && semiColonIdx === -1) {
              semiColonIdx = i;
            }
          }
        }
      }

      if (semiColonIdx !== -1 && (braceOpenIdx === -1 || semiColonIdx < braceOpenIdx)) {
        // Found a statement ending with a semicolon before any block opening '{'
        index = semiColonIdx + 1;
        continue;
      }

      if (braceOpenIdx === -1) break;

      const header = css.slice(index, braceOpenIdx).trim();
      const contentStart = braceOpenIdx + 1;

      // Find matching closing brace '}' considering nesting
      let depth = 1;
      let contentEnd = contentStart;

      while (contentEnd < length && depth > 0) {
        const char = css[contentEnd];
        if (char === "{") depth++;
        else if (char === "}") depth--;
        if (depth > 0) contentEnd++;
      }

      const blockBody = css.slice(contentStart, contentEnd).trim();
      index = contentEnd + 1;

      if (!header || !blockBody) continue;

      if (header.toLowerCase().startsWith("@media")) {
        const mediaQuery = header.slice(6).trim();
        // Recursively parse inner rules for this media query
        this.parseBlockContent(blockBody, rules, mediaQuery);
      } else if (header.startsWith("@")) {
        // Handle @font-face or @page as a rule
        const declarations = this.parseDeclarations(blockBody);
        rules.push({
          selector: header,
          declarations,
          specificity: calculateSpecificity(header),
          ...(currentMedia ? { mediaQuery: currentMedia } : {}),
        });
      } else {
        // Standard rule selectors (e.g. "h1, h2, .title")
        const declarations = this.parseDeclarations(blockBody);
        const selectors = header.split(",").map((s) => s.trim());

        for (const sel of selectors) {
          if (!sel) continue;
          const rule: CSSRule = {
            selector: sel,
            declarations,
            specificity: calculateSpecificity(sel),
          };
          if (currentMedia) {
            rule.mediaQuery = currentMedia;
          }
          rules.push(rule);
        }
      }
    }
  }

  public parseDeclarations(str: string): Record<string, string> {
    const decls: Record<string, string> = {};
    const pairs = splitCssDeclarations(str);

    for (const pair of pairs) {
      const colonIdx = pair.indexOf(":");
      if (colonIdx === -1) continue;

      const rawKey = pair.slice(0, colonIdx).trim();
      let value = pair.slice(colonIdx + 1).trim();

      if (!rawKey || !value) continue;

      // Strip !important from value for unit/color parsing compatibility
      value = value.replace(/\s*!important\s*$/i, "");

      // Keep custom property names case-preserving (e.g. --primaryColor), standard properties lowercase
      const key = rawKey.startsWith("--") ? rawKey : rawKey.toLowerCase();

      this.expandShorthand(key, value, decls);
    }

    return decls;
  }

  private expandShorthand(
    key: string,
    value: string,
    decls: Record<string, string>,
  ): void {
    if (key.startsWith("--")) {
      decls[key] = value;
      return;
    }

    if (key === "margin" || key === "padding") {
      const parts = value.split(/\s+/);
      if (parts.length === 1) {
        decls[`${key}-top`] = parts[0] ?? "0";
        decls[`${key}-right`] = parts[0] ?? "0";
        decls[`${key}-bottom`] = parts[0] ?? "0";
        decls[`${key}-left`] = parts[0] ?? "0";
      } else if (parts.length === 2) {
        decls[`${key}-top`] = parts[0] ?? "0";
        decls[`${key}-bottom`] = parts[0] ?? "0";
        decls[`${key}-right`] = parts[1] ?? "0";
        decls[`${key}-left`] = parts[1] ?? "0";
      } else if (parts.length === 3) {
        decls[`${key}-top`] = parts[0] ?? "0";
        decls[`${key}-right`] = parts[1] ?? "0";
        decls[`${key}-left`] = parts[1] ?? "0";
        decls[`${key}-bottom`] = parts[2] ?? "0";
      } else if (parts.length >= 4) {
        decls[`${key}-top`] = parts[0] ?? "0";
        decls[`${key}-right`] = parts[1] ?? "0";
        decls[`${key}-bottom`] = parts[2] ?? "0";
        decls[`${key}-left`] = parts[3] ?? "0";
      }
    } else if (
      key === "border" ||
      key === "border-top" ||
      key === "border-bottom" ||
      key === "border-left" ||
      key === "border-right"
    ) {
      const parts = value.split(/\s+/);
      const prefix = key === "border" ? "border" : key;
      for (const part of parts) {
        if (part.match(/^[0-9]+(px|pt|mm|cm|in)?$/)) {
          decls[`${prefix}-width`] = part;
        } else if (
          ["solid", "dashed", "dotted", "double", "none"].includes(part)
        ) {
          decls[`${prefix}-style`] = part;
        } else {
          decls[`${prefix}-color`] = part;
        }
      }
    } else if (key === "background") {
      decls["background"] = value;
    } else {
      decls[key] = value;
    }
  }
}

function splitCssDeclarations(str: string): string[] {
  const result: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let parenDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "(" && !inSingleQuote && !inDoubleQuote) {
      parenDepth++;
    } else if (char === ")" && !inSingleQuote && !inDoubleQuote) {
      if (parenDepth > 0) parenDepth--;
    }

    if (char === ";" && !inSingleQuote && !inDoubleQuote && parenDepth === 0) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    result.push(current);
  }
  return result;
}
