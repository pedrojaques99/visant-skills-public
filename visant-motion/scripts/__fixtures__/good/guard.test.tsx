/* Fixture: a repo that GUARDS the motion rules with a test.
   The self-test asserts this file reports ZERO findings.

   Every string below is the rule's own pattern, quoted so the test can assert
   on it. Before `isTestFile`, the detector reported these as violations — so a
   repo was penalised precisely for defending the rule, and a repo with no test
   at all scored better. */
import { describe, it, expect } from "vitest";

describe("motion", () => {
  it("no transition-all", () => {
    expect(sources.filter((f) => f.txt.includes("transition-all"))).toEqual([]);
  });

  it("no ease-in on UI (only ease-out / ease-in-out)", () => {
    expect(sources.filter((f) => /(^|[\s:])ease-in(?!-out)/.test(f.txt))).toEqual([]);
  });

  it("no raw curve", () => {
    expect(sources.filter((f) => f.txt.includes("cubic-bezier("))).toEqual([]);
  });

  it("no UI duration above 300ms", () => {
    expect(sources.filter((f) => f.txt.includes("duration-[900ms]"))).toEqual([]);
  });
});
