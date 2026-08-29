import { describe, expect, it } from "vitest";
import { businessDate } from "../src/time";

describe("Asia/Singapore business date", () => {
  it.each([
    ["2026-08-13T15:59:59.999Z", "2026-08-13"],
    ["2026-08-13T16:00:00.000Z", "2026-08-14"],
    ["2026-08-31T15:59:59.999Z", "2026-08-31"],
    ["2026-08-31T16:00:00.000Z", "2026-09-01"],
    ["2026-12-31T15:59:59.999Z", "2026-12-31"],
    ["2026-12-31T16:00:00.000Z", "2027-01-01"],
  ])("maps %s to %s", (instant, expected) => {
    expect(businessDate(new Date(instant))).toBe(expected);
  });
});
