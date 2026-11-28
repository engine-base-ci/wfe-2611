import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { kanameError, CATALOG } from "@kaname/errors";

describe("エラーの応答（D-069）", () => {
  it("正本のエラーは class の状態と文言・次の一手をそのまま返す", async () => {
    const app = createApp("test");
    app.get("/boom", () => {
      throw kanameError("E-AUTH-001", { remaining: 3 });
    });
    const res = await app.request("/boom");
    expect(res.status).toBe(401);
    const b = (await res.json()) as {
      code: string;
      message: string;
      action: string;
      detail: { remaining: number };
      event_id: string | null;
    };
    expect(b.code).toBe("E-AUTH-001");
    expect(b.message).toBe(CATALOG["E-AUTH-001"]!.message);
    expect(b.action).toBe(CATALOG["E-AUTH-001"]!.action);
    expect(b.detail.remaining).toBe(3);
    expect(b.event_id).toBeNull(); // 文脈が無ければ記録しない
  });
  it("正本に無い例外は 500・文言を作らない", async () => {
    const app = createApp("test");
    app.get("/crash", () => {
      throw new Error("x");
    });
    const res = await app.request("/crash", { headers: { "x-request-id": "req-1" } });
    expect(res.status).toBe(500);
    const b = (await res.json()) as { error: string; message: null; support_code: string };
    expect(b.error).toBe("internal");
    expect(b.message).toBeNull();
    expect(b.support_code).toBe("req-1");
  });
});
