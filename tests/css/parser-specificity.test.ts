import { describe, it, expect } from "vitest";
import { CSSParser } from "../../src/css/parser.js";
import { calculateSpecificity } from "../../src/css/specificity.js";
import { parseCssUnit, parseCssColor } from "../../src/css/values/units.js";

describe("CSS Parser & Specificity", () => {
  it("should parse CSS rules correctly", () => {
    const css = `
      h1 { color: #ff0000; font-size: 24px; }
      .card { margin: 10px; padding: 20px; }
    `;
    const parser = new CSSParser();
    const rules = parser.parse(css);

    expect(rules.length).toBe(2);
    expect(rules[0]?.selector).toContain("h1");
    expect(rules[0]?.declarations["color"]).toBe("#ff0000");
  });

  it("should calculate CSS selector specificity correctly", () => {
    const specTag = calculateSpecificity("div");
    const specClass = calculateSpecificity(".title");
    const specId = calculateSpecificity("#header");
    const specCombined = calculateSpecificity("div.title#header");

    expect(specTag).toEqual([0, 0, 0, 1]);
    expect(specClass).toEqual([0, 0, 1, 0]);
    expect(specId).toEqual([0, 1, 0, 0]);
    expect(specCombined).toEqual([0, 1, 1, 1]);
  });

  it("should convert units correctly to points (pt)", () => {
    expect(parseCssUnit("72pt")).toBe(72);
    expect(parseCssUnit("1in")).toBe(72);
    expect(parseCssUnit("25.4mm")).toBeCloseTo(72, 0);
    expect(parseCssUnit("2.54cm")).toBeCloseTo(72, 0);
    expect(parseCssUnit("96px")).toBeCloseTo(72, 0);
    expect(parseCssUnit(50)).toBe(50);
  });

  it("should parse CSS colors (hex, rgb, named) to normalized RGB floats", () => {
    const redHex = parseCssColor("#ff0000");
    expect(redHex).toEqual({ r: 1, g: 0, b: 0 });

    const greenRgb = parseCssColor("rgb(0, 255, 0)");
    expect(greenRgb).toEqual({ r: 0, g: 1, b: 0 });

    const blueNamed = parseCssColor("blue");
    expect(blueNamed).toEqual({ r: 0, g: 0, b: 1 });
  });
});
