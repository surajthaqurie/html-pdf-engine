import { describe, it, expect } from "vitest";
import {
  parseSvgTransform,
  transformToPdfCommands,
} from "../../src/svg/svg-transform.js";
import { SvgError } from "../../src/errors/pdf-error.js";

describe("SVG Transform Parser", () => {
  it("parses translate", () => {
    const t = parseSvgTransform("translate(10,20)")[0]!;
    expect(t.type).toBe("translate");
    expect(t.props).toEqual([10, 20]);
  });

  it("parses translate with single arg (ty defaults to 0)", () => {
    const t = parseSvgTransform("translate(5)")[0]!;
    expect(t.props).toEqual([5, 0]);
  });

  it("parses scale with single arg (sy defaults to sx)", () => {
    const t = parseSvgTransform("scale(2)")[0]!;
    expect(t.props).toEqual([2, 2]);
  });

  it("parses scale with two args", () => {
    const t = parseSvgTransform("scale(2,3)")[0]!;
    expect(t.props).toEqual([2, 3]);
  });

  it("parses rotate without center", () => {
    const t = parseSvgTransform("rotate(45)")[0]!;
    expect(t.type).toBe("rotate");
    expect(t.props).toEqual([45, 0, 0]);
  });

  it("parses rotate with center", () => {
    const t = parseSvgTransform("rotate(45 10 20)")[0]!;
    expect(t.props).toEqual([45, 10, 20]);
  });

  it("parses matrix", () => {
    const t = parseSvgTransform("matrix(1 2 3 4 5 6)")[0]!;
    expect(t.type).toBe("matrix");
    expect(t.props).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("parses chained transforms", () => {
    const ts = parseSvgTransform("translate(1,2) scale(2) rotate(90)");
    expect(ts).toHaveLength(3);
    expect(ts[0]!.type).toBe("translate");
    expect(ts[1]!.type).toBe("scale");
    expect(ts[2]!.type).toBe("rotate");
  });

  it("returns empty array for null/empty input", () => {
    expect(parseSvgTransform(null)).toEqual([]);
    expect(parseSvgTransform("")).toEqual([]);
  });

  it("emits translate cm command", () => {
    const out = transformToPdfCommands(parseSvgTransform("translate(10,20)"));
    expect(out).toContain("1 0 0 1 10.0000 20.0000 cm");
  });

  it("emits scale cm command", () => {
    const out = transformToPdfCommands(parseSvgTransform("scale(2,3)"));
    expect(out).toContain("2.0000 0 0 3.0000 0 0 cm");
  });

  it("emits rotate cm command", () => {
    const out = transformToPdfCommands(parseSvgTransform("rotate(90)"));
    // cos(90)≈0, sin(90)=1
    expect(out).toContain("0.0000 1.0000 -1.0000 0.0000 0 0 cm");
  });

  it("emits rotate-around-center as translate+rotate+translate", () => {
    const out = transformToPdfCommands(parseSvgTransform("rotate(90 5 5)"));
    expect(out).toContain("1 0 0 1 5.0000 5.0000 cm");
    expect(out).toContain("1 0 0 1 -5.0000 -5.0000 cm");
  });

  it("throws SvgError on invalid translate", () => {
    expect(() => parseSvgTransform("translate()")).toThrow(SvgError);
  });

  it("throws SvgError on invalid matrix", () => {
    expect(() => parseSvgTransform("matrix(1 2 3)")).toThrow(SvgError);
  });

  it("throws SvgError on unsupported transform type", () => {
    expect(() => parseSvgTransform("skew(10)")).toThrow(SvgError);
  });
});
