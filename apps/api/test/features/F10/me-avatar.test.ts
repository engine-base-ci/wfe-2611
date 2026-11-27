// K-834「顔の写真」の口の試験（本物の DB・置き場は本物のローカルの置き場を包んだ偽（置けない・消せないを 1 回ずつ起こせる）・口の入口は createApp と契約の op・偽の画面のログイン。土台 me.harness.ts）。
//   行 ID（K834-API-…）は 11_tickets/K-834.md の表と 1 対 1。
//   uploadAvatar POST /me/avatar（multipart・欄 file か reset=true）→ 201 { data: { avatar: { kind: "image"|"text", initial, url } } }
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import type { TenantContext } from "@kaname/db/context";
import { describe, expect, it } from "vitest";
import { image, msg, setupMe, type P } from "./me.harness.js";

const h = setupMe("me-avatar.ts", { extraHooks: ["me-profile.ts"] }); // 読み直す GET /me は K-833 の hooks
const MB5 = 5 * 1024 * 1024;
const ctxOf = (p: P): TenantContext => ({ tenantId: p.tenantId, userId: p.id, role: "member", stepUpAt: null });
const form = (bytes: Uint8Array | string | null, type = "image/png", name = "face.png", reset?: string) => {
  const fd = new FormData();
  if (bytes !== null) fd.set("file", new File([bytes], name, { type }));
  if (reset !== undefined) fd.set("reset", reset);
  return fd;
};
const up = (p: P, fd: FormData, key?: string) => h.call(p, "POST", "/me/avatar", { form: fd, ...(key ? { key } : {}) });
const ref = async (p: P) =>
  (await h.one<{ r: string | null }>("select avatar_ref as r from members where id = $1", [p.id])).r;
const present = async (p: P, r: string) => (await h.store().get(ctxOf(p), r)).status === "done";

describe("K-834 顔の写真（uploadAvatar）", () => {
  it("K834-API-001 PNG を置く：201・avatar は image と期限つき url・avatar_ref が今の会社の ref になり実体が置かれる・読み直しても image・同じ会社のほかの人と同じログインの別の会社の行は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const co = await h.f.company(`別の会社-${randomUUID().slice(0, 4)}`, "ZZ");
    const other = await h.f.alsoIn(w.member, co.tenantId, co.rootScope);
    const r = await up(w.member, form(image("png")));
    expect(r.status, await r.clone().text()).toBe(201);
    const a = (await h.json(r)).data!["avatar"] as Record<string, unknown>;
    expect(a).toMatchObject({ kind: "image", initial: "鈴" });
    expect(typeof a.url).toBe("string");
    const rf = (await ref(w.member))!;
    expect(rf).toContain(w.tenantId);
    expect(await present(w.member, rf)).toBe(true);
    expect(
      ((await h.json(await h.call(w.member, "GET", "/me"))).data!["member"] as Record<string, unknown>).avatar.kind,
    ).toBe("image");
    expect(await ref(w.admin)).toBeNull();
    expect(
      (await h.one<{ r: string | null }>("select avatar_ref as r from members where id = $1", [other.id])).r,
    ).toBeNull();
  });

  it("K834-API-002 JPEG・WebP も置ける（中身の先頭の印で見る）", async () => {
    await h.ready();
    const w = await h.world();
    for (const [kind, type] of [
      ["jpeg", "image/jpeg"],
      ["webp", "image/webp"],
    ] as const)
      expect((await up(w.member, form(image(kind), type, `f.${kind}`))).status, kind).toBe(201);
  });

  it("K834-API-003 大きさ：5 MB ちょうどは 201・5 MB + 1 バイトは 413・E-ME-010（写真は 5 MB まで）・顔は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    expect((await up(w.member, form(image("png", MB5)))).status).toBe(201);
    const keep = await ref(w.member);
    const r = await up(w.member, form(image("png", MB5 + 1)));
    expect(r.status).toBe(413);
    expect((await h.json(r)).code).toBe("E-ME-010");
    expect(await ref(w.member)).toBe(keep);
    expect(msg("E-ME-010")).toContain("5 MB");
  });

  it("K834-API-004 種類が違う：中身が画像でない（名前と content-type だけ png）・SVG・GIF・空のファイルは 422・E-ME-011・顔は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const keep = await ref(w.member);
    const cases: [Uint8Array | string, string, string][] = [
      ["これは画像ではありません", "image/png", "a.png"],
      ['<svg xmlns="http://www.w3.org/2000/svg"/>', "image/svg+xml", "a.svg"],
      [image("gif"), "image/gif", "a.gif"],
      [new Uint8Array(0), "image/png", "empty.png"],
    ];
    for (const [b, t, nm] of cases) {
      const r = await up(w.member, form(b, t, nm));
      expect(r.status, nm).toBe(422);
      expect((await h.json(r)).code, nm).toBe("E-ME-011");
    }
    expect(await ref(w.member)).toBe(keep);
  });

  it("K834-API-005 content-type が嘘でも中身が PNG なら通る（content-type は信じない）・ファイルの名前は ref に使わない", async () => {
    await h.ready();
    const w = await h.world();
    expect((await up(w.member, form(image("png"), "text/plain", "../../etc/x.txt"))).status).toBe(201);
    expect(await ref(w.member)).not.toContain("etc");
  });

  it("K834-API-006 体の形：file も reset も無い体・file と reset の両方・reset が true 以外は 422（欄 file）・顔は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    await up(w.member, form(image("png")));
    const keep = await ref(w.member);
    for (const fd of [
      form(null),
      form(image("png"), "image/png", "f.png", "true"),
      form(null, "image/png", "f.png", "yes"),
    ]) {
      const r = await up(w.member, fd);
      expect(r.status).toBe(422);
      expect((await h.json(r)).details?.[0]?.field).toBe("file");
    }
    expect(await ref(w.member)).toBe(keep);
  });

  it("K834-API-007 置き換え：前の実体が置き場から消え、新しい ref になる", async () => {
    await h.ready();
    const w = await h.world();
    await up(w.member, form(image("png")));
    const old = (await ref(w.member))!;
    expect((await up(w.member, form(image("jpeg"), "image/jpeg", "b.jpg"))).status).toBe(201);
    const now = (await ref(w.member))!;
    expect(now).not.toBe(old);
    expect(await present(w.member, old)).toBe(false);
    expect(await present(w.member, now)).toBe(true);
  });

  it("K834-API-008 文字に戻す（reset=true・file なし）：201・avatar は kind text・url null・avatar_ref が空・前の実体が消える・写真が無いときも 201", async () => {
    await h.ready();
    const w = await h.world();
    await up(w.member, form(image("png")));
    const old = (await ref(w.member))!;
    const r = await up(w.member, form(null, "image/png", "x", "true"));
    expect(r.status, await r.clone().text()).toBe(201);
    expect((await h.json(r)).data!["avatar"]).toEqual({ kind: "text", initial: "鈴", url: null });
    expect(await ref(w.member)).toBeNull();
    expect(await present(w.member, old)).toBe(false);
    expect((await up(w.member, form(null, "image/png", "x", "true"))).status).toBe(201);
  });

  it("K834-API-009 手順 1（置き場に置く）の失敗：502・E-ME-012・avatar_ref は前のまま・前の実体は残る", async () => {
    await h.ready();
    const w = await h.world();
    await up(w.member, form(image("png")));
    const keep = (await ref(w.member))!;
    h.driverFail.put = true;
    try {
      const r = await up(w.member, form(image("png")));
      expect(r.status).toBe(502);
      expect((await h.json(r)).code).toBe("E-ME-012");
    } finally {
      h.driverFail.put = false;
    }
    expect(await ref(w.member)).toBe(keep);
    expect(await present(w.member, keep)).toBe(true);
  });

  it("K834-API-010 手順 2（DB に書く）の失敗：503・E-PAGE-003・avatar_ref は前のまま・先に置いた新しい実体は消す／文字に戻すの DB の失敗も 503 で顔と実体はそのまま", async () => {
    await h.ready();
    const w = await h.world();
    await up(w.member, form(image("png")));
    const keep = (await ref(w.member))!;
    await h.captureLogs(async () => {
      await h.breakOn("members", w.tenantId, "update", async () => {
        const r = await up(w.member, form(image("webp"), "image/webp", "c.webp"));
        expect(r.status).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
        const r2 = await up(w.member, form(null, "image/png", "x", "true"));
        expect(r2.status).toBe(503);
      });
    });
    expect(await ref(w.member)).toBe(keep);
    expect(await present(w.member, keep)).toBe(true);
  });

  it("K834-API-011 手順 3（前の実体を消す後片付け）の失敗 [残る]：201 のまま・新しい ref・ログに [me-avatar] の行が 1 つ・前の実体は残る", async () => {
    await h.ready();
    const w = await h.world();
    await up(w.member, form(image("png")));
    const old = (await ref(w.member))!;
    h.driverFail.del = true;
    let logs: string;
    try {
      logs = await h.captureLogs(async () => {
        expect((await up(w.member, form(image("jpeg"), "image/jpeg", "d.jpg"))).status).toBe(201);
      });
    } finally {
      h.driverFail.del = false;
    }
    expect(logs.split("\n").filter((l) => l.includes("[me-avatar]")).length).toBe(1);
    expect(await ref(w.member)).not.toBe(old);
    expect(await present(w.member, old)).toBe(true);
  });

  it("K834-API-012 守り：ログインなし 401・止めた人は 401／403・別の会社の人が置いても自分の行だけ・本人以外の顔は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    expect(
      (await h.call(w.member, "POST", "/me/avatar", { form: form(image("png")), headers: { authorization: "" } }))
        .status,
    ).toBe(401);
    expect([401, 403]).toContain((await up(w.stopped, form(image("png")))).status);
    expect((await up(w.outsider, form(image("png")))).status).toBe(201);
    expect(await ref(w.outsider)).toContain(w.other.tenantId);
    expect(await ref(w.admin)).toBeNull();
    expect(await ref(w.member)).toBeNull();
  });

  it("K834-API-013 二度押し（同じ Idempotency-Key）：2 回とも 201・同じ答え・実体は 1 つ", async () => {
    await h.ready();
    const w = await h.world();
    const key = randomUUID();
    const r1 = await up(w.member, form(image("png")), key);
    const r2 = await up(w.member, form(image("png")), key);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect((await h.json(r2)).data).toEqual((await h.json(r1)).data);
    expect(await present(w.member, (await ref(w.member))!)).toBe(true);
  });

  it("K834-API-014 同時に 2 回置く：どちらも 201・残るのは片方の ref で実体がある", async () => {
    await h.ready();
    const w = await h.world();
    const [a, b] = await Promise.all([
      up(w.member, form(image("png"))),
      up(w.member, form(image("jpeg"), "image/jpeg", "e.jpg")),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await present(w.member, (await ref(w.member))!)).toBe(true);
  });
});
