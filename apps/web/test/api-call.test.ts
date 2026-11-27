// 新しい画面の API の呼び手（K-27）：口の名前で呼び、答えの扱いをそろえる
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call, pathOf } from "../lib/api/call";

type Seen = { url: string; init: RequestInit };
let seen: Seen[] = [];
const reply = (status: number, body: unknown) =>
  vi.fn(async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  });

beforeEach(() => {
  seen = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("口の名前で呼ぶ（K-27）", () => {
  it("道すじとメソッドは契約から引き、:id は値で埋める", async () => {
    vi.stubGlobal("fetch", reply(200, { data: { id: "t1" } }));
    const r = await call("getTicket", { params: { id: "a/b" } });
    expect(r.ok).toBe(true);
    expect(seen[0]!.url).toMatch(/\/api\/v1\/tickets\/a%2Fb$/);
    expect(seen[0]!.init.method).toBe("GET");
  });
  it("問い合わせは空の値を落とす。書き込みは冪等キーと JSON の本文を付ける", async () => {
    vi.stubGlobal("fetch", reply(201, { data: { id: "c1" } }));
    await call("listConversations", { query: { cursor: "", limit: 20 } }); // q は K-757（D-153.16）で外したので、空の値は cursor で見る
    expect(seen[0]!.url).toMatch(/\/api\/v1\/conversations\?limit=20$/);
    await call("createConversation", { body: { title: "相談" } });
    const h = seen[1]!.init.headers as Record<string, string>;
    expect(seen[1]!.init.method).toBe("POST");
    expect(h["idempotency-key"]).toBeTruthy();
    expect(JSON.parse(String(seen[1]!.init.body))).toEqual({ title: "相談" });
  });
  it("道すじの値が無ければ呼ぶ前に止める", () => {
    expect(() => pathOf("/api/v1/tickets/:id", {})).toThrow(/道すじの値が無い/);
  });
});

describe("答えの扱いをそろえる", () => {
  const cases: [number, Record<string, unknown>, string][] = [
    [403, { error: "forbidden", code: "FORBIDDEN" }, "forbidden"],
    [403, { error: "step_up_required", code: "STEP_UP_REQUIRED" }, "step_up"],
    [404, { error: "not_found", code: "NOT_FOUND" }, "not_found"],
    [409, { error: "conflict", code: "CONFLICT" }, "conflict"],
    [501, { error: "not_implemented", code: "NOT_IMPLEMENTED" }, "not_built"],
    [502, { error: "external_failed", code: "EXTERNAL_FAILED" }, "failed"],
  ];
  it.each(cases)("%i %j は %s", async (status, body, kind) => {
    vi.stubGlobal("fetch", reply(status, body));
    const r = await call("getTicket", { params: { id: "x" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe(kind);
  });
  it("422 は項目ごとの理由を返す", async () => {
    vi.stubGlobal(
      "fetch",
      reply(422, {
        error: "validation_failed",
        code: "VALIDATION_ERROR",
        details: [{ field: "title", message: "空" }],
      }),
    );
    const r = await call("createConversation", { body: {} });
    expect(r.ok === false && r.fields).toEqual({ title: "空" });
  });
  it("429 は待つ秒数を返す", async () => {
    vi.stubGlobal("fetch", reply(429, { error: "rate_limited", code: "RATE_LIMITED", retry_after_sec: 60 }));
    const r = await call("listConversations");
    expect(r.ok === false && r.retryAfterSec).toBe(60);
  });
});
