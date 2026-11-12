import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markRecent, MAX_RECENT } from "@/hooks/useAppPrefs";
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "qa-user" } }) }));
describe("optional recent preferences", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());
  it.each(["QuotaExceededError", "SecurityError"])("does not interrupt access on %s", (name) => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Unavailable", name); });
    const changed = vi.fn();
    window.addEventListener("ax-hub-prefs", changed);
    try {
      expect(() => markRecent("qa-user", "vision")).not.toThrow();
      expect(changed).not.toHaveBeenCalled();
    } finally { window.removeEventListener("ax-hub-prefs", changed); }
  });
  it("keeps order, uniqueness and limit when storage works", () => {
    for (let n = 0; n < 7; n++) markRecent("qa-user", `app-${n}`);
    markRecent("qa-user", "app-4");
    const recent = JSON.parse(localStorage.getItem("ax_hub_recent:qa-user")!);
    expect(recent).toEqual(["app-4", "app-6", "app-5", "app-3", "app-2"]);
    expect(recent).toHaveLength(MAX_RECENT);
    expect(localStorage.getItem("ax_hub_recent:other-user")).toBeNull();
  });
  it("notifies listeners only after persistence succeeds", () => {
    const changed = vi.fn(); window.addEventListener("ax-hub-prefs", changed);
    try { markRecent("qa-user", "ads"); expect(changed).toHaveBeenCalledTimes(1); }
    finally { window.removeEventListener("ax-hub-prefs", changed); }
  });
});
