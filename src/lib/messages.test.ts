import { describe, expect, it } from "vitest";
import messages from "@/messages/km.json";
import { ERROR_CODES } from "./error-codes";
import { ROLES } from "./roles";

// A missing translation would show an empty button, so we check the files stay complete.
describe("Khmer messages", () => {
  it("has text for every API error code", () => {
    expect(Object.keys(messages.Errors).sort()).toEqual([...ERROR_CODES].sort());
  });

  it("has a name for every role", () => {
    expect(Object.keys(messages.Roles).sort()).toEqual([...ROLES].sort());
  });
});
