// K-833「自分を読む・直す」の口の試験（本物の DB・本物の行の守り・偽の画面のログイン。土台 me.harness.ts）。行 ID（K833-API-…）は 11_tickets/K-833.md の表と 1 対 1。
//   getMe    GET   /me → 200 { data: { member, workspaces, workspace_name } }
//   updateMe PATCH /me → 200 { data: { member, saved_at } }（名前・呼ばれ方・言語・見た目・週のはじめ・時間帯をその場で保存。同じログインの全部のワークスペースの行に書く）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { msg, setupMe, type MeWorld, type P } from "./me.harness.js";

const h = setupMe("me-profile.ts");
/** /me の答え（試験で読む欄だけ型にする） */
type Member = { name: unknown; avatar: { kind: unknown; url: unknown; initial: unknown } };
type Ws = Record<string, unknown> & {
  tenant_id: string;
  name: string;
  last_admin: unknown;
  assigned_total: unknown;
  assigned: [{ title: unknown }, ...{ title: unknown }[]];
};
const get = (p: P) => h.call(p, "GET", "/me");
const patch = (p: P, body: unknown, key?: string) => h.call(p, "PATCH", "/me", { body, ...(key ? { key } : {}) });
const row = (id: string) =>
  h.one<Record<string, unknown>>(
    "select display_name, call_name, language, theme, week_start, timezone, avatar_ref from members where id = $1",
    [id],
  );
/** 同じログインを別の会社にも入れる。会社と、そこでの人を返す */
async function second(w: MeWorld, p: P, role = "member", name = "別の会社") {
  const co = await h.f.company(`${name}-${randomUUID().slice(0, 4)}`, "ZZ");
  const other = await h.f.alsoIn(p, co.tenantId, co.rootScope);
  await h.f.admin.query("update tenant_memberships set role = $2 where member_id = $1", [other.id, role]);
  void w;
  return { co, other };
}

describe("K-833 自分を読む・直す（getMe・updateMe）", () => {
  it("K833-API-001 読む：200・no-store・鍵は member・workspaces・workspace_name・member は id・name・call_name・email・avatar・language・theme・week_start・timezone・email_pending だけ（email_pending は null）", async () => {
    await h.ready();
    const w = await h.world();
    const r = await get(w.member);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    const d = (await h.json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["member", "workspace_name", "workspaces"]);
    expect(Object.keys(d["member"] as object).sort()).toEqual(
      [
        "avatar",
        "call_name",
        "email",
        "email_pending",
        "id",
        "language",
        "name",
        "theme",
        "timezone",
        "week_start",
      ].sort(),
    );
    expect(d["member"]).toMatchObject({
      id: w.member.id,
      name: "鈴木 一郎",
      call_name: null,
      email: w.member.email,
      language: "ja",
      theme: "system",
      week_start: 1,
      timezone: "Asia/Tokyo",
      email_pending: null,
    });
  });

  it("K833-API-002 顔：写真が無ければ kind text・initial は呼ばれ方の 1 文字目（無ければ名前の 1 文字目）・url は null／avatar_ref が在れば kind image と期限つき url", async () => {
    await h.ready();
    const w = await h.world();
    expect(((await h.json(await get(w.member))).data!["member"] as Member).avatar).toEqual({
      kind: "text",
      initial: "鈴",
      url: null,
    });
    await h.f.admin.query("update members set call_name = 'いち' where id = $1", [w.member.id]);
    expect(((await h.json(await get(w.member))).data!["member"] as Member).avatar.initial).toBe("い");
    const ref = `tenants/${w.tenantId}/${randomUUID()}`;
    await h.f.admin.query("update members set avatar_ref = $2 where id = $1", [w.member.id, ref]);
    const a = ((await h.json(await get(w.member))).data!["member"] as Member).avatar;
    expect(a.kind).toBe("image");
    expect(typeof a.url).toBe("string");
  });

  it("K833-API-003 入っているワークスペース：同じログインの全部（抜けていない物）・今いる会社に current・role・主のグループの名前・別のログインの会社は出ない", async () => {
    await h.ready();
    const w = await h.world();
    const { co } = await second(w, w.member, "manager");
    // 兼務：受託開発のマネージャーも兼ねる（主の所属は営業のまま・group は主だけ）
    await h.f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $3, $2, false, 'manager')",
      [w.tenantId, w.member.id, w.jd],
    );
    const ws = ((await h.json(await get(w.member))).data!["workspaces"] as Ws[]).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    expect(ws.length).toBe(2);
    const here = ws.find((x) => x.tenant_id === w.tenantId)!;
    const there = ws.find((x) => x.tenant_id === co.tenantId)!;
    expect(here).toMatchObject({ current: true, role: "member", group: "営業" }); // 兼務があっても主の所属だけ
    expect(there).toMatchObject({ current: false, role: "manager" });
    expect(ws.some((x) => x.tenant_id === w.other.tenantId)).toBe(false);
    await h.f.admin.query(
      "update tenant_memberships set status = 'left' where tenant_id = $1 and auth_user_id = (select auth_user_id from tenant_memberships where member_id = $2 limit 1)",
      [co.tenantId, w.member.id],
    );
    expect(((await h.json(await get(w.member))).data!["workspaces"] as Ws[]).length).toBe(1);
  });

  it("K833-API-004 抜けられるか：最後の管理者の会社は last_admin true・own は有効な人が自分だけの会社・ほかの管理者が居れば last_admin false・止めた管理者は数えない", async () => {
    await h.ready();
    const w = await h.world();
    const solo = await h.f.company(`自分だけ-${randomUUID().slice(0, 4)}`, "SO");
    const me = await h.f.alsoIn(w.member, solo.tenantId, solo.rootScope);
    await h.f.admin.query("update tenant_memberships set role = 'admin' where member_id = $1", [me.id]);
    let ws = (await h.json(await get(w.member))).data!["workspaces"] as Ws[];
    expect(ws.find((x) => x.tenant_id === solo.tenantId)).toMatchObject({ own: true, last_admin: true });
    expect(ws.find((x) => x.tenant_id === w.tenantId)).toMatchObject({ own: false, last_admin: false });
    await h.f.admin.query("update tenant_memberships set role = 'admin' where member_id = $1", [w.member.id]);
    await h.f.admin.query("update tenant_memberships set status = 'suspended' where member_id in ($1, $2)", [
      w.admin.id,
      w.admin2.id,
    ]);
    ws = (await h.json(await get(w.member))).data!["workspaces"] as Ws[];
    expect(ws.find((x) => x.tenant_id === w.tenantId)!.last_admin).toBe(true);
  });

  it("K833-API-005 担当が残っているか：その会社で自分が担当の終わっていないチケットの数 assigned_total と先頭 10 件 assigned（id・number・title）・終わった物は数えない・別の会社の物はその会社の欄", async () => {
    await h.ready();
    const w = await h.world();
    const { co, other } = await second(w, w.member);
    const mk = (tenant: string, scope: string, who: string, done: boolean, title: string) =>
      h.f.admin.query(
        `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, completed_at, completed_by)
         values ($1, $2, '', (select id from ticket_kinds where tenant_id = $1 and name = 'タスク' and deleted_at is null), (select id from ticket_stages where tenant_id = $1 and key = 'doing'), $4, $3, $3, case when $5 then now() end, case when $5 then $3::uuid end)`,
        [tenant, scope, who, title, done],
      );
    for (let i = 0; i < 12; i++) await mk(co.tenantId, co.rootScope, other.id, false, `残り ${i}`);
    await mk(co.tenantId, co.rootScope, other.id, true, "終わった");
    await mk(w.tenantId, w.eg, w.member.id, false, "こちらの会社の担当");
    const ws = (await h.json(await get(w.member))).data!["workspaces"] as Ws[];
    const there = ws.find((x) => x.tenant_id === co.tenantId)!;
    expect(there.assigned_total).toBe(12);
    expect(there.assigned.length).toBe(10);
    expect(Object.keys(there.assigned[0]).sort()).toEqual(["id", "number", "title"]);
    expect(there.assigned.some((t) => t.title === "終わった")).toBe(false);
    expect(ws.find((x) => x.tenant_id === w.tenantId)!.assigned_total).toBe(1);
  });

  it("K833-API-006 外枠の会社名 workspace_name：前後の空白（全角を含む）を取って返す・空白だけなら null・前からの欄（member の id・name）は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query("update tenants set name = $2 where id = $1", [w.tenantId, "　株式会社テスト　 "]);
    expect((await h.json(await get(w.member))).data!["workspace_name"]).toBe("株式会社テスト");
    await h.f.admin.query("update tenants set name = $2 where id = $1", [w.tenantId, " 　 "]);
    expect((await h.json(await get(w.member))).data!["workspace_name"]).toBeNull();
  });

  it("K833-API-007 直す：名前・呼ばれ方を変えると 200・前後の空白を削る・DB と読み直しに出る・saved_at が付く・変えない欄はそのまま", async () => {
    await h.ready();
    const w = await h.world();
    const r = await patch(w.member, { name: "　山田 太郎　", call_name: " たろう " });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data!;
    expect(Object.keys(d).sort()).toEqual(["member", "saved_at"]);
    expect(Number.isNaN(Date.parse(String(d["saved_at"])))).toBe(false);
    expect(d["member"]).toMatchObject({ name: "山田 太郎", call_name: "たろう", theme: "system" });
    expect(await row(w.member.id)).toMatchObject({ display_name: "山田 太郎", call_name: "たろう" });
    expect(((await h.json(await get(w.member))).data!["member"] as Member).name).toBe("山田 太郎");
  });

  it("K833-API-008 名前の長さ：100 字（サロゲート対を 1 字と数える）は 200・101 字は 422・E-ME-002・空・空白だけ・全角の空白だけは 422・E-ME-001・NUL は 422・名前は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    expect((await patch(w.member, { name: "𠮷".repeat(100) })).status).toBe(200);
    const keep = (await row(w.member.id)).display_name;
    const long = await patch(w.member, { name: "あ".repeat(101) });
    expect(long.status).toBe(422);
    expect((await h.json(long)).code).toBe("E-ME-002");
    expect(msg("E-ME-002")).toContain("100");
    for (const v of ["", " ", "　　"]) {
      const r = await patch(w.member, { name: v });
      expect(r.status, JSON.stringify(v)).toBe(422);
      expect((await h.json(r)).code).toBe("E-ME-001");
    }
    expect((await patch(w.member, { name: "名\u0000前" })).status).toBe(422);
    expect((await row(w.member.id)).display_name).toBe(keep);
  });

  it("K833-API-009 呼ばれ方：20 字は 200・21 字は 422・E-ME-003・空か null は 200 で消える（call_name が null に戻る）", async () => {
    await h.ready();
    const w = await h.world();
    expect((await patch(w.member, { call_name: "あ".repeat(20) })).status).toBe(200);
    const r = await patch(w.member, { call_name: "あ".repeat(21) });
    expect(r.status).toBe(422);
    expect((await h.json(r)).code).toBe("E-ME-003");
    expect((await row(w.member.id)).call_name).toBe("あ".repeat(20));
    expect((await patch(w.member, { call_name: "" })).status).toBe(200);
    expect((await row(w.member.id)).call_name).toBeNull();
    await patch(w.member, { call_name: "x" });
    expect((await patch(w.member, { call_name: null })).status).toBe(200);
    expect((await row(w.member.id)).call_name).toBeNull();
  });

  it("K833-API-010 見え方：言語 ja・見た目 light／dark／system・週のはじめ 0（日曜）／1（月曜）・時間帯 Asia/Tokyo／UTC はそれぞれ保存できる", async () => {
    await h.ready();
    const w = await h.world();
    const r = await patch(w.member, { language: "ja", theme: "dark", week_start: 0, timezone: "UTC" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(await row(w.member.id)).toMatchObject({ language: "ja", theme: "dark", week_start: 0, timezone: "UTC" });
    for (const body of [{ theme: "light" }, { theme: "system" }, { week_start: 1 }, { timezone: "Asia/Tokyo" }])
      expect((await patch(w.member, body)).status, JSON.stringify(body)).toBe(200);
  });

  it("K833-API-011 見え方の誤り：言語 en・見た目 blue・週のはじめ 2 と文字・時間帯 Mars/Base は 422（欄の名前つき）で、どれも変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const before = await row(w.member.id);
    for (const [field, body] of [
      ["language", { language: "en" }],
      ["theme", { theme: "blue" }],
      ["week_start", { week_start: 2 }],
      ["week_start", { week_start: "月" }],
      ["timezone", { timezone: "Mars/Base" }],
    ] as const) {
      const r = await patch(w.member, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      expect((await h.json(r)).details?.[0]?.field).toBe(field);
    }
    expect(await row(w.member.id)).toEqual(before);
  });

  it("K833-API-012 体の形：空の体・知らない欄・member_id・role_id・avatar_ref・email を送る体は 422（strict）・ほかの人は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const before = await row(w.admin.id);
    for (const body of [
      {},
      { nope: 1 },
      { member_id: w.admin.id },
      { role_id: "owner" },
      { avatar_ref: "x" },
      { email: "a@b.example" },
    ])
      expect((await patch(w.member, body)).status, JSON.stringify(body)).toBe(422);
    expect(await row(w.admin.id)).toEqual(before);
  });

  it("K833-API-013 アカウント全体：同じログインの全部のワークスペースの行に書く（名前・呼ばれ方・見た目）・抜けた会社の行と別のログインの人は変わらない・顔（avatar_ref）は今いる会社の行だけ", async () => {
    await h.ready();
    const w = await h.world();
    const { other } = await second(w, w.member);
    const { other: gone } = await second(w, w.member);
    await h.f.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [gone.id]);
    const r = await patch(w.member, { name: "新しい名前", theme: "dark" });
    expect(r.status).toBe(200);
    expect(await row(other.id)).toMatchObject({ display_name: "新しい名前", theme: "dark" });
    expect((await row(gone.id)).display_name).not.toBe("新しい名前");
    expect((await row(w.admin.id)).display_name).toBe("高本 聖斗");
    expect((await row(other.id)).avatar_ref).toBeNull();
  });

  it("K833-API-014 守り：ログインなし 401・止めた人 401／403・別の会社の人は自分の行だけ（この会社の人の名前は変わらず読めない）", async () => {
    await h.ready();
    const w = await h.world();
    expect((await h.call(w.member, "GET", "/me", { headers: { authorization: "" } })).status).toBe(401);
    expect([401, 403]).toContain((await get(w.stopped)).status);
    expect([401, 403]).toContain((await patch(w.stopped, { name: "x" })).status);
    expect((await patch(w.outsider, { name: "外の人" })).status).toBe(200);
    expect((await row(w.admin.id)).display_name).toBe("高本 聖斗");
    expect(((await h.json(await get(w.outsider))).data!["member"] as Member).name).toBe("外の人");
  });

  it("K833-API-015 手順 1（DB に書く）の失敗：503・E-PAGE-003・どの行も変わらない（全部か無しか）／読む口の DB の失敗も 503", async () => {
    await h.ready();
    const w = await h.world();
    const { other } = await second(w, w.member);
    const b1 = await row(w.member.id);
    const b2 = await row(other.id);
    const spy = await h.captureLogs(async () => {
      await h.breakOn("members", other.tenantId, "update", async () => {
        const r = await patch(w.member, { name: "落ちる" });
        expect(r.status).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
      await h.breakPool(["getMe"], async () => {
        const r = await get(w.member);
        expect(r.status).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
    });
    expect(spy).not.toContain(w.member.email);
    expect(await row(w.member.id)).toEqual(b1);
    expect(await row(other.id)).toEqual(b2);
  });

  it("K833-API-016 同時に別の欄を直す（名前と見た目）：どちらも残る・同じ欄は後に通った方が残る", async () => {
    await h.ready();
    const w = await h.world();
    const [a, b] = await Promise.all([patch(w.member, { name: "同時の名前" }), patch(w.member, { theme: "dark" })]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await row(w.member.id)).toMatchObject({ display_name: "同時の名前", theme: "dark" });
    const [c, d] = await Promise.all([
      patch(w.member, { call_name: "ひとつめ" }),
      patch(w.member, { call_name: "ふたつめ" }),
    ]);
    expect([c.status, d.status]).toEqual([200, 200]);
    expect(["ひとつめ", "ふたつめ"]).toContain((await row(w.member.id)).call_name);
  });

  it("K833-API-017 二度押し（同じ Idempotency-Key）：2 回とも 200・同じ答え・同じ名前への保存は変わらず 200", async () => {
    await h.ready();
    const w = await h.world();
    const key = randomUUID();
    const r1 = await patch(w.member, { name: "二度押し" }, key);
    const r2 = await patch(w.member, { name: "二度押し" }, key);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect((await h.json(r2)).data).toEqual((await h.json(r1)).data);
    expect((await patch(w.member, { name: "二度押し" })).status).toBe(200);
  });
});
