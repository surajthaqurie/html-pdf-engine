import { describe, it, expect } from "vitest";
import { CSSParser } from "../../src/css/parser.js";
import { CascadeEngine } from "../../src/css/cascade.js";
import { ElementNode } from "../../src/html/dom/node.js";
import { parseCssColor, parseCssUnit } from "../../src/css/values/units.js";

describe("Phase 3 — CSS Properties, Specificity & Cascade", () => {
  const cssParser = new CSSParser();
  const cascadeEngine = new CascadeEngine();

  it("should support complex selectors and descendant matching", () => {
    const css = `
      div.container p.title { color: red; }
      #main p { font-size: 16pt; }
    `;
    const rules = cssParser.parse(css);
    expect(rules.length).toBe(2);

    const containerDiv = new ElementNode("div", { class: "container", id: "main" });
    const p = new ElementNode("p", { class: "title" });
    containerDiv.appendChild(p);

    const style = cascadeEngine.computeStyle(p, rules);
    expect(style.color).toEqual({ r: 1, g: 0, b: 0 });
    expect(style.fontSize).toBe(16);
  });

  it("should prioritize inline styles over stylesheet rules regardless of specificity", () => {
    const css = `#main-title { color: blue; }`;
    const rules = cssParser.parse(css);

    const elem = new ElementNode("h1", {
      id: "main-title",
      style: "color: red;",
    });

    const style = cascadeEngine.computeStyle(elem, rules);
    expect(style.color).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("should correctly parse colors (Hex, RGB, Named)", () => {
    expect(parseCssColor("#00ff00")).toEqual({ r: 0, g: 1, b: 0 });
    expect(parseCssColor("#0f0")).toEqual({ r: 0, g: 1, b: 0 });
    expect(parseCssColor("rgb(255, 0, 0)")).toEqual({ r: 1, g: 0, b: 0 });
    expect(parseCssColor("green")).toEqual({ r: 0, g: 0.5, b: 0 });
  });

  it("should correctly expand margin, padding, and border shorthands", () => {
    const decls = cssParser.parseDeclarations(
      "margin: 10px 20px; padding: 5px; border: 2px solid #333333; border-top-width: 4px;",
    );

    expect(decls["margin-top"]).toBe("10px");
    expect(decls["margin-right"]).toBe("20px");
    expect(decls["margin-bottom"]).toBe("10px");
    expect(decls["margin-left"]).toBe("20px");
    expect(decls["padding-top"]).toBe("5px");
    expect(decls["border-width"]).toBe("2px");
    expect(decls["border-style"]).toBe("solid");
    expect(decls["border-top-width"]).toBe("4px");
  });

  it("should inherit font and color properties from parent element", () => {
    const parent = new ElementNode("div", {
      style: "color: blue; font-family: Times-Roman; font-size: 14pt;",
    });
    const child = new ElementNode("span");
    parent.appendChild(child);

    const parentStyle = cascadeEngine.computeStyle(parent, []);
    const childStyle = cascadeEngine.computeStyle(child, [], parentStyle);

    expect(childStyle.color).toEqual({ r: 0, g: 0, b: 1 });
    expect(childStyle.fontFamily).toBe("Times-Roman");
    expect(childStyle.fontSize).toBe(14);
  });

  it("should parse page-break CSS properties", () => {
    const elem = new ElementNode("div", {
      style: "page-break-before: always; page-break-after: auto; page-break-inside: avoid;",
    });
    const style = cascadeEngine.computeStyle(elem, []);

    expect(style.pageBreakBefore).toBe("always");
    expect(style.pageBreakAfter).toBe("auto");
    expect(style.pageBreakInside).toBe("avoid");
  });
});
