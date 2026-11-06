import { describe, expect, it } from "vitest";
import { checkModifierSelection, type SelectableGroup } from "./order-modifiers";

const size: SelectableGroup = { id: "size", minSelect: 1, maxSelect: 1, optionIds: ["s", "m", "l"] };
const extras: SelectableGroup = { id: "extras", minSelect: 0, maxSelect: 2, optionIds: ["egg", "cheese", "bacon"] };

describe("checkModifierSelection", () => {
  it("accepts a valid choice", () => {
    expect(checkModifierSelection([size, extras], ["m"])).toEqual({ ok: true });
    expect(checkModifierSelection([size, extras], ["l", "egg", "bacon"])).toEqual({ ok: true });
  });

  it("an item without groups accepts only an empty choice", () => {
    expect(checkModifierSelection([], [])).toEqual({ ok: true });
    expect(checkModifierSelection([], ["x"])).toEqual({ ok: false, problem: "UNKNOWN_OPTION" });
  });

  it("a required group must be answered", () => {
    expect(checkModifierSelection([size], [])).toEqual({ ok: false, problem: "TOO_FEW", groupId: "size" });
    expect(checkModifierSelection([size, extras], ["egg"])).toEqual({ ok: false, problem: "TOO_FEW", groupId: "size" });
  });

  it("an optional group may be skipped", () => {
    expect(checkModifierSelection([extras], [])).toEqual({ ok: true });
  });

  it("too many answers", () => {
    expect(checkModifierSelection([size], ["s", "m"])).toEqual({ ok: false, problem: "TOO_MANY", groupId: "size" });
    expect(checkModifierSelection([extras], ["egg", "cheese", "bacon"])).toEqual({ ok: false, problem: "TOO_MANY", groupId: "extras" });
  });

  it("rejects options that belong to no group of the item, and duplicates", () => {
    expect(checkModifierSelection([size], ["m", "from-another-item"])).toEqual({ ok: false, problem: "UNKNOWN_OPTION" });
    expect(checkModifierSelection([size, extras], ["m", "egg", "egg"])).toEqual({ ok: false, problem: "DUPLICATE_OPTION" });
  });

  it("a required group with no active options does not block the order", () => {
    const empty: SelectableGroup = { id: "empty", minSelect: 1, maxSelect: 1, optionIds: [] };
    expect(checkModifierSelection([empty], [])).toEqual({ ok: true });
  });

  it("a group asking for more than it has options only needs all of them", () => {
    const two: SelectableGroup = { id: "two", minSelect: 3, maxSelect: 3, optionIds: ["a", "b"] };
    expect(checkModifierSelection([two], ["a", "b"])).toEqual({ ok: true });
    expect(checkModifierSelection([two], ["a"])).toEqual({ ok: false, problem: "TOO_FEW", groupId: "two" });
  });
});
