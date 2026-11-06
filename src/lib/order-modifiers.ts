// The rules for the options chosen when ordering an item ("Size: Large", "Extras: egg + cheese").
// Plain logic with no database, so the order screen and the server apply exactly the same rules.

export type SelectableGroup = {
  id: string;
  minSelect: number;
  maxSelect: number;
  /** The active options of the group. */
  optionIds: readonly string[];
};

export type SelectionProblem = "UNKNOWN_OPTION" | "DUPLICATE_OPTION" | "TOO_FEW" | "TOO_MANY";

export type SelectionResult = { ok: true } | { ok: false; problem: SelectionProblem; groupId?: string };

/**
 * Checks the chosen option ids against the groups that belong to the item.
 * - every chosen option must belong to one of the groups, and only once
 * - for each group the number chosen must be between its minimum and maximum
 * - a required group that has no active options cannot block the order (nothing could be chosen)
 */
export function checkModifierSelection(groups: readonly SelectableGroup[], selected: readonly string[]): SelectionResult {
  if (new Set(selected).size !== selected.length) return { ok: false, problem: "DUPLICATE_OPTION" };

  const known = new Set(groups.flatMap((group) => group.optionIds));
  if (selected.some((id) => !known.has(id))) return { ok: false, problem: "UNKNOWN_OPTION" };

  for (const group of groups) {
    const count = group.optionIds.filter((id) => selected.includes(id)).length;
    const minimum = Math.min(group.minSelect, group.optionIds.length);
    if (count < minimum) return { ok: false, problem: "TOO_FEW", groupId: group.id };
    if (count > group.maxSelect) return { ok: false, problem: "TOO_MANY", groupId: group.id };
  }
  return { ok: true };
}
