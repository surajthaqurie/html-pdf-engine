import { describe, it, expect } from "vitest";
import { compileSvgPathToPdf, tokenizePath } from "../../src/svg/svg-path.js";
import { SvgError } from "../../src/errors/pdf-error.js";

describe("SVG Path Parser", () => {
  it("tokenizes numbers and commands", () => {
    const tokens = tokenizePath("M 10 20 L 30 40");
    expect(tokens).toEqual(["M", 10, 20, "L", 30, 40]);
  });

  it("handles comma separators and repeated params", () => {
    const tokens = tokenizePath("M1,2 3,4");
    expect(tokens).toEqual(["M", 1, 2, 3, 4]);
  });

  it("handles negative and decimal numbers", () => {
    const tokens = tokenizePath("M -1.5 2.5e2");
    expect(tokens).toEqual(["M", -1.5, 250]);
  });

  it("compiles absolute moveto/lineto", () => {
    const out = compileSvgPathToPdf("M 10 20 L 30 40");
    expect(out).toContain("10.0000 20.0000 m");
    expect(out).toContain("30.0000 40.0000 l");
  });

  it("compiles relative moveto/lineto", () => {
    const out = compileSvgPathToPdf("M 10 20 l 5 5");
    expect(out).toContain("10.0000 20.0000 m");
    expect(out).toContain("15.0000 25.0000 l");
  });

  it("treats implicit repetition after M as L", () => {
    const out = compileSvgPathToPdf("M 10 20 30 40");
    expect(out).toContain("10.0000 20.0000 m");
    expect(out).toContain("30.0000 40.0000 l");
  });

  it("compiles H/h and V/v", () => {
    const out = compileSvgPathToPdf("M 0 0 H 10 V 10 h 5 v 5");
    expect(out).toContain("10.0000 0.0000 l");
    expect(out).toContain("10.0000 10.0000 l");
    expect(out).toContain("15.0000 10.0000 l");
    expect(out).toContain("15.0000 15.0000 l");
  });

  it("compiles absolute cubic C", () => {
    const out = compileSvgPathToPdf("M 0 0 C 10 10 20 10 30 0");
    expect(out).toContain("10.0000 10.0000 20.0000 10.0000 30.0000 0.0000 c");
  });

  it("compiles relative cubic c", () => {
    const out = compileSvgPathToPdf("M 0 0 c 10 10 20 10 30 0");
    expect(out).toContain("10.0000 10.0000 20.0000 10.0000 30.0000 0.0000 c");
  });

  it("compiles smooth cubic S reflecting previous control point", () => {
    const out = compileSvgPathToPdf("M 0 0 C 10 10 20 10 30 0 S 50 -10 60 0");
    // S after C: first control = reflection of (20,10) about (30,0) = (40,-10)
    expect(out).toContain("40.0000 -10.0000 50.0000 -10.0000 60.0000 0.0000 c");
  });

  it("compiles quadratic Q converted to cubic", () => {
    const out = compileSvgPathToPdf("M 0 0 Q 30 60 60 0");
    // Q control (30,60), end (60,0). Cubic controls:
    // c1 = (2/3*30, 2/3*60) = (20,40); c2 = (60 + 2/3*(30-60), 0 + 2/3*(60-0)) = (40,40)
    expect(out).toContain("20.0000 40.0000 40.0000 40.0000 60.0000 0.0000 c");
  });

  it("compiles smooth quadratic T reflecting previous control point", () => {
    const out = compileSvgPathToPdf("M 0 0 Q 30 60 60 0 T 120 0");
    // After Q (control 30,60, end 60,0): T end (120,0)
    // reflected control = 2*(60,0) - (30,60) = (90,-60)
    // cubic c1 = (60 + 2/3*(90-60), 0 + 2/3*(-60-0)) = (80,-40)
    // cubic c2 = (120 + 2/3*(90-120), 0 + 2/3*(-60-0)) = (100,-40)
    expect(out).toContain(
      "80.0000 -40.0000 100.0000 -40.0000 120.0000 0.0000 c",
    );
  });

  it("compiles close path Z/z", () => {
    const out = compileSvgPathToPdf("M 10 10 L 20 20 Z");
    expect(out).toContain("h");
  });

  it("resets to start point after Z", () => {
    const out = compileSvgPathToPdf("M 10 10 L 20 20 Z L 30 30");
    // After Z, current point returns to start (10,10). L 30 30 is absolute.
    expect(out).toContain("30.0000 30.0000 l");
  });

  it("returns empty string for empty path data", () => {
    expect(compileSvgPathToPdf("")).toBe("");
  });

  it("throws SvgError on leading coordinates without command", () => {
    expect(() => compileSvgPathToPdf("10 20")).toThrow(SvgError);
  });

  it("throws SvgError on unsupported command", () => {
    expect(() => compileSvgPathToPdf("A 10 10 0 0 1 20 20")).toThrow(SvgError);
  });

  it("throws SvgError on missing arguments", () => {
    expect(() => compileSvgPathToPdf("M 10")).toThrow(SvgError);
  });

  it("throws SvgError on malformed number", () => {
    expect(() => tokenizePath("M ..")).toThrow(SvgError);
  });
});
