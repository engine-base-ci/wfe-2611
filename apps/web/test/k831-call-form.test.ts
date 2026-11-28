// K-831：口の呼び手 call に、ファイルを送る形（multipart）を足す。ロゴ（K-831）・顔の写真（K-839）が使う。JSON の呼び方・答えの扱いは前のまま。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "../lib/api/call";

type Seen = { url: string; init: RequestInit };
let seen: Seen[] = [];
const reply = (status: number, body: unknown) =>
  vi.fn(async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  });
beforeEach(() => {
  seen = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ファイルを送る形（K-831）", () => {
  it("K831-UN-001 form を渡すと、その FormData をそのまま体にし、content-type は付けない（境の印は fetch が作る）。冪等キーと画面の印は付く", async () => {
    vi.stubGlobal("fetch", reply(201, { data: { logo: { kind: "image", url: "https://x/y.png" } } }));
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "logo.png");
    const r = await call("uploadWorkspaceLogo", { form: fd, screenId: "company-settings" } as never);
    expect(r.ok).toBe(true);
    const init = seen[0]!.init;
    const h = init.headers as Record<string, string>;
    expect(seen[0]!.url).toMatch(/\/api\/v1\/workspace\/logo$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(fd);
    expect(Object.keys(h).map((k) => k.toLowerCase())).not.toContain("content-type");
    expect(h["idempotency-key"]).toBeTruthy();
    expect(h["x-screen-id"]).toBe("company-settings");
  });

  it("K831-UN-002 form を渡さない呼び方は今のまま：JSON の本文と content-type: application/json", async () => {
    vi.stubGlobal("fetch", reply(200, { data: { workspace: { id: "w1" } } }));
    await call("updateWorkspace", { body: { name: "新しい名前" } });
    const h = seen[0]!.init.headers as Record<string, string>;
    expect(h["content-type"]).toBe("application/json");
    expect(JSON.parse(String(seen[0]!.init.body))).toEqual({ name: "新しい名前" });
  });

  it("K831-UN-003 form の呼び方も答えの扱いは同じ：413 は too_large・422 は項目ごとの理由・403 STEP_UP_REQUIRED は step_up", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array([1])]), "a.png");
    vi.stubGlobal(
      "fetch",
      reply(413, { error: "limit", code: "E-WS-010", message: "ロゴは 2 MB までです。小さい画像を選んでください" }),
    );
    const big = await call("uploadWorkspaceLogo", { form: fd } as never);
    expect(big.ok === false && big.kind).toBe("too_large");
    vi.stubGlobal(
      "fetch",
      reply(422, { error: "validation", code: "E-WS-011", details: [{ field: "file", message: "種類が違う" }] }),
    );
    const bad = await call("uploadWorkspaceLogo", { form: fd } as never);
    expect(bad.ok === false && bad.fields).toEqual({ file: "種類が違う" });
    vi.stubGlobal("fetch", reply(403, { error: "step_up_required", code: "STEP_UP_REQUIRED" }));
    const up = await call("uploadWorkspaceLogo", { form: fd } as never);
    expect(up.ok === false && up.kind).toBe("step_up");
  });
});
