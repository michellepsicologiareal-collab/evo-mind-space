import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: any[]) => rpc(...a) } }));

import { fetchSessionByToken } from "./publicSessionToken";

describe("fetchSessionByToken", () => {
  beforeEach(() => { rpc.mockReset(); vi.useRealTimers(); });

  it("connection failure is never reported as an invalid link", async () => {
    rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    const res = await fetchSessionByToken("57f3c055-c325-4563-8dc5-2e0000670583", 1);
    expect(res.kind).toBe("network");
  });

  it("retries after a network failure and finds the session", async () => {
    rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ data: [{ id: "s1" }], error: null });
    const res = await fetchSessionByToken("t", 2);
    expect(res).toEqual({ kind: "found", row: { id: "s1" } });
  });

  it("unknown token is invalid", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await fetchSessionByToken("t", 1)).kind).toBe("not_found");
  });
});
