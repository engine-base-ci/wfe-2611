import { describe, expect, it } from "vitest";
import { createApp, health } from "../src/app.js";

describe("GET /health", () => {
  it("起動の存在確認が通れば 200", async () => {
    const res = await createApp("test").request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; version: string };
    expect(body.ok).toBe(true);
    expect(body.version).toBe("test");
  });
  it("health() は migration の並びを返す", () => {
    expect(health().migrations.order).toBe("ok");
  });
});
