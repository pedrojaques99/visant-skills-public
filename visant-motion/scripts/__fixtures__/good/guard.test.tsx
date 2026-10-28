/* Fixture: a repo that GUARDS the motion rules with a test.
   The self-test asserts this file reports ZERO findings.

   Every string below is the rule's own pattern, quoted so the test can assert
   on it. Before `isTestFile`, the detector reported these as violations — so a
   repo was penalised precisely for defending the rule, and a repo with no test
   at all scored better. */
import { describe, it, expect } from "vitest";

describe("motion", () => {
  it("sem transition-all", () => {
    expect(fontes.filter((f) => f.txt.includes("transition-all"))).toEqual([]);
  });

  it("sem ease-in em UI (só ease-out / ease-in-out)", () => {
    expect(fontes.filter((f) => /(^|[\s:])ease-in(?!-out)/.test(f.txt))).toEqual([]);
  });

  it("sem curva crua", () => {
    expect(fontes.filter((f) => f.txt.includes("cubic-bezier("))).toEqual([]);
  });

  it("sem duração de UI acima de 300ms", () => {
    expect(fontes.filter((f) => f.txt.includes("duration-[900ms]"))).toEqual([]);
  });
});
