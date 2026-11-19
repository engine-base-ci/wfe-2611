// K-351「預けたログイン情報の一覧の口（listCredentials）と、名前・説明・層の列・個人の物は持ち主だけが書ける行の守り」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K351-API-…）は 11_tickets/K-351.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py と 05_flow/screen_api.d/K-351.py で直す）:
//   listCredentials  GET /api/v1/credentials（本人・120 回／分／人）
//     200 { data: Credential[] }・Cache-Control: private, no-store
//     Credential = { id, name, description, layer, kind, two_factor, destinations, expires_on, use_count, last_used_at,
//                    login_check: { state, detail, at }, can_edit, created_at, updated_at }   ← vault_ref・owner_member_id は出さない（K-250・D-128.57）
//     並び：名前の昇順。同じ名前なら個人を先（近い層が勝つ・D-125.149）。消した物・失効した物は出さない
//     kind：kind_id が basic・password_totp・email_otp なら "login"、それ以外（api_key など）は "key"
//     expires_on：期限の日本の日付（YYYY-MM-DD）か null
//     can_edit：個人＝true（見えるのは自分の物だけ）／ワークスペース＝credentials のワークスペース全体の edit を持つ人だけ true
// DB（migration・番号は取り込む時点の次の空き）:
//   credentials に name（not null・既定は LOGIN_ と 16 進 8 けた・形は ^[A-Z][A-Z0-9_]{0,63}$）・description・layer（workspace／personal・既定 personal）
//   一意：ワークスペースは (tenant_id, name)・個人は (tenant_id, owner_member_id, name)。どちらも消していない物だけ
//   行の守り：読む＝同じ会社で（ワークスペースの物か、自分が持ち主の物）／個人を書く＝自分が持ち主の個人だけ／
//            ワークスペースを書く＝credentials のワークスペース全体の edit を持つ人だけ（前の「持ち主か edit の権限」の「または」をやめる・D-128.57 ①）
import { beforeAll, describe, expect, it } from "vitest";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { setupCredentials, type Person } from "./credentials.harness.js";

const h = setupCredentials();
const KEYS = [
  "can_edit",
  "created_at",
  "description",
  "destinations",
  "expires_on",
  "id",
  "kind",
  "last_used_at",
  "layer",
  "login_check",
  "name",
  "two_factor",
  "updated_at",
  "use_count",
];

let A: { tenantId: string; rootScope: string };
let B: { tenantId: string; rootScope: string };
let boss: Person; // 会社 A の管理者（credentials の edit あり）
let staff: Person; // 会社 A の担当者（edit なし）
let other: Person; // 会社 B の人

beforeAll(async () => {
  A = await h.company("K351 会社 A");
  B = await h.company("K351 会社 B");
  boss = await h.person(A.tenantId, A.rootScope, { name: "管理者", admin: true });
  staff = await h.person(A.tenantId, A.rootScope, { name: "担当者" });
  other = await h.person(B.tenantId, B.rootScope, { name: "別の会社の人", admin: true });
});

let seq = 0;
/** 行を直に入れる（行の守りの外）。name を省くと既定の名前になる */
const cred = async (
  p: Person,
  o: {
    name?: string;
    layer?: "workspace" | "personal";
    kind?: string;
    description?: string | null;
    expires?: string | null;
    deleted?: boolean;
    revoked?: boolean;
    check?: [string, string | null] | null;
  } = {},
): Promise<{ id: string; vaultRef: string }> => {
  const vaultRef = `sec_k351_${Date.now().toString(36)}_${++seq}`;
  const cols: Record<string, unknown> = {
    tenant_id: p.tenantId,
    scope_id: p.scopeId,
    owner_member_id: p.id,
    vault_ref: vaultRef,
    kind_id: o.kind ?? "basic",
    two_factor_id: "none",
    destinations: ["example.com"],
    layer: o.layer ?? "personal",
    description: o.description ?? null,
    expires_at: o.expires ?? null,
    deleted_at: o.deleted ? new Date() : null,
    revoked_at: o.revoked ? new Date() : null,
    login_check_state: o.check ? o.check[0] : null,
    login_check_detail: o.check ? o.check[1] : null,
    login_check_at: o.check ? new Date("2026-11-19T01:02:03Z") : null,
  };
  if (o.name !== undefined) cols["name"] = o.name;
  const keys = Object.keys(cols);
  const r = await h.admin.query<{ id: string }>(
    `insert into credentials (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    keys.map((k) => cols[k]),
  );
  return { id: r.rows[0]!.id, vaultRef };
};
const list = async (p: Person) => {
  const r = await h.req("GET", "/credentials", { headers: h.as(p) });
  return { r, body: r.status === 200 ? ((await h.json(r)).data as Record<string, unknown>[]) : [] };
};
const ctxOf = (p: Person): TenantContext => ({ tenantId: p.tenantId, userId: p.id, role: "member", stepUpAt: null });
/** 行の守りの中（kaname_app・その人の文脈）で SQL を流す。断られたら "denied"、それ以外は動いた行の数 */
const asApp = async (p: Person, sql: string, params: unknown[]): Promise<number | "denied"> => {
  try {
    return await withTenant(h.pool, ctxOf(p), async (cl) => (await cl.query(sql, params)).rowCount ?? 0);
  } catch (e) {
    if (/row-level security|permission denied/.test(String(e))) return "denied";
    throw e;
  }
};
const freshPerson = async (o: { admin?: boolean } = {}) =>
  h.person(A.tenantId, A.rootScope, { name: `人 ${++seq}`, ...(o.admin ? { admin: true } : {}) });

describe("K-351 預けたログイン情報の一覧の口", () => {
  it("K351-API-001 一覧の形：個人 2 件とワークスペース 1 件が名前の順。鍵はちょうど 14 個で、vault_ref・持ち主の id・預けた値の参照の文字は答えに無い", async () => {
    await h.ready();
    const me = await freshPerson();
    const a = await cred(me, { name: "ZOOM_LOGIN" });
    const b = await cred(me, { name: "AWS_KEY", kind: "api_key" });
    const ws = await cred(boss, { name: "HACCHU_NAVI_LOGIN", layer: "workspace" });
    const { r, body } = await list(me);
    expect(r.status).toBe(200);
    const mine = body.filter((x) => [a.id, b.id, ws.id].includes(String(x["id"])));
    expect(mine.map((x) => x["name"])).toEqual(["AWS_KEY", "HACCHU_NAVI_LOGIN", "ZOOM_LOGIN"]);
    for (const x of mine) expect(Object.keys(x).sort()).toEqual(KEYS);
    const text = JSON.stringify(body);
    for (const ref of [a.vaultRef, b.vaultRef, ws.vaultRef]) expect(text).not.toContain(ref);
    expect(text).not.toContain("vault_ref");
    expect(text).not.toContain("owner_member_id");
  });

  it("K351-API-002 見える範囲：他人の個人の物は出ない。ワークスペースの物は同じ会社の別の人にも出る。同じ名前は個人が先", async () => {
    await h.ready();
    const me = await freshPerson();
    const you = await freshPerson();
    const yours = await cred(you, { name: "YOUR_SECRET" });
    const ws = await cred(boss, { name: "SHARED_LOGIN", layer: "workspace" });
    const mineSame = await cred(me, { name: "SHARED_LOGIN" });
    const { body } = await list(me);
    const ids = body.map((x) => String(x["id"]));
    expect(ids).not.toContain(yours.id);
    expect(ids).toContain(ws.id);
    const shared = body.filter((x) => x["name"] === "SHARED_LOGIN").map((x) => x["layer"]);
    expect(shared).toEqual(["personal", "workspace"]);
    expect(ids.indexOf(mineSame.id)).toBeLessThan(ids.indexOf(ws.id));
    const { body: yourList } = await list(you);
    expect(yourList.map((x) => String(x["id"]))).toContain(ws.id);
    expect(yourList.map((x) => String(x["id"]))).not.toContain(mineSame.id);
  });

  it("K351-API-003 別の会社：会社 B の人の一覧に会社 A の物（ワークスペース・個人）は 1 件も出ない", async () => {
    await h.ready();
    const ws = await cred(boss, { name: "A_ONLY_WS", layer: "workspace" });
    const mine = await cred(boss, { name: "A_ONLY_ME" });
    const { r, body } = await list(other);
    expect(r.status).toBe(200);
    const ids = body.map((x) => String(x["id"]));
    expect(ids).not.toContain(ws.id);
    expect(ids).not.toContain(mine.id);
  });

  it("K351-API-004 消した物（deleted_at）と失効した物（revoked_at）は出ない", async () => {
    await h.ready();
    const me = await freshPerson();
    const alive = await cred(me, { name: "ALIVE" });
    const gone = await cred(me, { name: "GONE", deleted: true });
    const revoked = await cred(me, { name: "REVOKED", revoked: true });
    const { body } = await list(me);
    const ids = body.map((x) => String(x["id"]));
    expect(ids).toContain(alive.id);
    expect(ids).not.toContain(gone.id);
    expect(ids).not.toContain(revoked.id);
  });

  it("K351-API-005 can_edit：自分の個人は true。ワークスペースの物は credentials の edit を持つ人だけ true、持たない人は false", async () => {
    await h.ready();
    const mine = await cred(staff, { name: "STAFF_OWN" });
    const ws = await cred(boss, { name: "WS_EDIT_CHECK", layer: "workspace" });
    const { body: staffList } = await list(staff);
    expect(staffList.find((x) => x["id"] === mine.id)?.["can_edit"]).toBe(true);
    expect(staffList.find((x) => x["id"] === ws.id)?.["can_edit"]).toBe(false);
    const { body: bossList } = await list(boss);
    expect(bossList.find((x) => x["id"] === ws.id)?.["can_edit"]).toBe(true);
  });

  it("K351-API-006 欄の値：種類（basic → login・api_key → key）・2 段階・使える場所・期限の日本の日付・使った数と最後の時刻・確かめの結果", async () => {
    await h.ready();
    const me = await freshPerson();
    const login = await cred(me, {
      name: "LOGIN_WITH_CHECK",
      description: "発注ナビのログイン",
      expires: "2027-01-31T23:59:59.999+09:00",
      check: ["bad_password", "ログイン名かパスワードが違うようです"],
    });
    const key = await cred(me, { name: "API_VALUE", kind: "api_key" });
    await h.admin.query(
      "update credentials set use_count = 3, last_used_at = '2026-11-18T09:00:00Z', two_factor_id = 'sms', destinations = '{hacchu-navi.example,*.hacchu-navi.example}' where id = $1",
      [login.id],
    );
    const { body } = await list(me);
    const l = body.find((x) => x["id"] === login.id)!;
    expect(l).toMatchObject({
      name: "LOGIN_WITH_CHECK",
      description: "発注ナビのログイン",
      layer: "personal",
      kind: "login",
      two_factor: "sms",
      destinations: ["hacchu-navi.example", "*.hacchu-navi.example"],
      expires_on: "2027-01-31",
      use_count: 3,
    });
    expect(new Date(String(l["last_used_at"])).toISOString()).toBe("2026-11-18T09:00:00.000Z");
    expect(l["login_check"]).toMatchObject({
      state: "bad_password",
      detail: "ログイン名かパスワードが違うようです",
      request_id: null,
    });
    expect(new Date(String((l["login_check"] as Record<string, unknown>)["at"])).toISOString()).toBe(
      "2026-11-19T01:02:03.000Z",
    );
    const k = body.find((x) => x["id"] === key.id)!;
    expect(k).toMatchObject({ kind: "key", description: null, expires_on: null, use_count: 0, last_used_at: null });
    expect(k["login_check"]).toEqual({ state: null, detail: null, at: null, request_id: null });
  });

  it("K351-API-019 コードを待っている確かめ：確かめの仕事が asking で、まだ答えていない頼み（bridge_job_events の ask）があれば login_check.state は asking（列は running のまま）・request_id はその頼みの id（いちばん新しい 1 つ）。答えた頼み・asking でない仕事の行は列の state のままで request_id は null", async () => {
    await h.ready();
    const me = await freshPerson();
    const asking = await cred(me, { name: "ASKING_LOGIN", check: ["running", null] });
    const answered = await cred(me, { name: "ANSWERED_LOGIN", check: ["running", null] });
    const running = await cred(me, { name: "RUNNING_LOGIN", check: ["running", null] });
    const job = async (credentialId: string, state: string) =>
      (
        await h.admin.query<{ id: string }>(
          "insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, credential_id, prompt) values ($1, $2, $3, 'login_check', $4, $5, 'https://example.com/') returning id",
          [me.tenantId, me.scopeId, me.id, state, credentialId],
        )
      ).rows[0]!.id;
    const event = async (jobId: string, kind: "ask" | "answer", requestId: string, seq: number) =>
      h.admin.query(
        "insert into bridge_job_events (tenant_id, scope_id, member_id, job_id, kind, request_id, seq, payload) values ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          me.tenantId,
          me.scopeId,
          me.id,
          jobId,
          kind,
          requestId,
          seq,
          { tool: "TwoFactorCode", summary: "SMS のコード" },
        ],
      );
    const j1 = await job(asking.id, "asking");
    await event(j1, "ask", "rq-old", 1);
    await event(j1, "answer", "rq-old", 2);
    await event(j1, "ask", "rq-new", 3);
    const j2 = await job(answered.id, "asking");
    await event(j2, "ask", "rq-done", 1);
    await event(j2, "answer", "rq-done", 2);
    const j3 = await job(running.id, "running");
    await event(j3, "ask", "rq-running", 1);
    const { body } = await list(me);
    const lc = (id: string) => body.find((x) => x["id"] === id)?.["login_check"] as Record<string, unknown>;
    expect(lc(asking.id)).toMatchObject({ state: "asking", request_id: "rq-new" });
    expect(lc(answered.id)).toMatchObject({ state: "running", request_id: null });
    expect(lc(running.id)).toMatchObject({ state: "running", request_id: null });
    expect(Object.keys(lc(asking.id)).sort()).toEqual(["at", "detail", "request_id", "state"]);
  });

  it("K351-API-007 1 件も無い人：200 と空の並び", async () => {
    await h.ready();
    const lonely = await h.company("K351 会社 C");
    const p = await h.person(lonely.tenantId, lonely.rootScope, { name: "ひとり" });
    const { r, body } = await list(p);
    expect(r.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("K351-API-008 ログインしていない：401 で、一覧を返さない", async () => {
    await h.ready();
    const r = await h.req("GET", "/credentials");
    expect(r.status).toBe(401);
    expect((await h.json(r))["data"]).toBeUndefined();
  });

  it("K351-API-009 上限：同じ人が上限を超えたら 429 と retry_after_sec（1〜60 の整数）", async () => {
    await h.ready();
    const p = await freshPerson();
    h.limits["listCredentials"] = 2;
    try {
      expect((await list(p)).r.status).toBe(200);
      expect((await list(p)).r.status).toBe(200);
      const r = await h.req("GET", "/credentials", { headers: h.as(p) });
      expect(r.status).toBe(429);
      const s = Number((await h.json(r))["retry_after_sec"]);
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
    } finally {
      delete h.limits["listCredentials"];
    }
  });

  it("K351-API-010 貯めない：答えの Cache-Control に private と no-store", async () => {
    await h.ready();
    const { r } = await list(boss);
    const cc = r.headers.get("cache-control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });
});

describe("K-351 名前・説明・層の列（migration）", () => {
  it("K351-API-011 前の道すじの形（名前も層も入れない行）：名前は LOGIN_ と 16 進 8 けた・層は personal で入る", async () => {
    const r = await h.admin.query<{ name: string; layer: string; description: string | null }>(
      "insert into credentials (tenant_id, scope_id, owner_member_id, vault_ref) values ($1, $2, $3, 'sec_k351_old') returning name, layer, description",
      [A.tenantId, A.rootScope, staff.id],
    );
    expect(r.rows[0]!.name).toMatch(/^LOGIN_[0-9A-F]{8}$/);
    expect(r.rows[0]!.layer).toBe("personal");
    expect(r.rows[0]!.description).toBeNull();
  });

  it("K351-API-012 名前の形：小文字・数字始まり・空・65 文字・層の知らない値は DB が断る（23514）", async () => {
    const me = await freshPerson();
    for (const bad of ["lower_case", "1ST_KEY", "", `A${"B".repeat(64)}`]) {
      await expect(cred(me, { name: bad }), bad).rejects.toMatchObject({ code: "23514" });
    }
    await expect(cred(me, { name: `A${"B".repeat(63)}` })).resolves.toMatchObject({ id: expect.any(String) });
    await expect(
      h.admin.query(
        "insert into credentials (tenant_id, scope_id, owner_member_id, vault_ref, name, layer) values ($1, $2, $3, 'sec_x', 'BAD_LAYER', 'group')",
        [A.tenantId, A.rootScope, me.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  // 失効しただけ（revoked_at あり・deleted_at なし）の物を名前の重なりから外す（代表の答え answer=449e72553c59）
  it("K351-API-013 同じ名前：ワークスペースで重なれば 23505。別の人の個人どうし・個人とワークスペース・消した物・失効しただけの物と同じ名前は入る。同じ人の個人で重なれば 23505", async () => {
    const me = await freshPerson();
    const you = await freshPerson();
    await cred(boss, { name: "DUP_WS", layer: "workspace" });
    await expect(cred(staff, { name: "DUP_WS", layer: "workspace" })).rejects.toMatchObject({ code: "23505" });
    await cred(me, { name: "DUP_WS" });
    await cred(me, { name: "DUP_ME" });
    await expect(cred(you, { name: "DUP_ME" })).resolves.toMatchObject({ id: expect.any(String) });
    await expect(cred(me, { name: "DUP_ME" })).rejects.toMatchObject({ code: "23505" });
    await cred(me, { name: "DUP_GONE", deleted: true });
    await expect(cred(me, { name: "DUP_GONE" })).resolves.toMatchObject({ id: expect.any(String) });
    // 会社を止めたときの一括失効などで、失効しただけで消えていない物（一覧に出ず、上書きも 404）は名前をふさがない
    await cred(me, { name: "DUP_REVOKED", revoked: true });
    await expect(cred(me, { name: "DUP_REVOKED" })).resolves.toMatchObject({ id: expect.any(String) });
    await cred(boss, { name: "DUP_WS_REVOKED", layer: "workspace", revoked: true });
    await expect(cred(boss, { name: "DUP_WS_REVOKED", layer: "workspace" })).resolves.toMatchObject({
      id: expect.any(String),
    });
    await cred(other, { name: "DUP_WS", layer: "workspace" }); // 別の会社なら同じ名前で入る
  });

  it("K351-API-020 上限：501 件ある人の一覧は 500 件で切り（名前の順の先頭 500 件）、ログに「一覧を 500 行で切った」が 1 行出る。ログに名前・値の参照は無い。500 件ちょうどの人はログに出ない", async () => {
    await h.ready();
    // 2 人は新しい会社に作る（会社 A には前の行が入れたワークスペースの物があり、それも一覧に出るので、件数と先頭の名前が決まらない）
    const D = await h.company("K351 会社 D（上限）");
    const many = await h.person(D.tenantId, D.rootScope, { name: "501 件の人" });
    const just = await h.person(D.tenantId, D.rootScope, { name: "500 件の人" });
    const fill = (p: Person, n: number, tag: string) =>
      h.admin.query(
        `insert into credentials (tenant_id, scope_id, owner_member_id, vault_ref, kind_id, two_factor_id, destinations, layer, name)
         select $1, $2, $3, 'sec_k351_' || $4 || '_' || g, 'api_key', 'none', array['example.com'], 'personal', $4 || '_' || lpad(g::text, 4, '0')
         from generate_series(1, $5) g`,
        [p.tenantId, p.scopeId, p.id, tag, n],
      );
    await fill(many, 501, "MANY");
    await fill(just, 500, "JUST");
    let body: Record<string, unknown>[] = [];
    const logs = await h.captureLogs(async () => {
      body = (await list(many)).body;
    });
    expect(body).toHaveLength(500);
    expect(body[0]!["name"]).toBe("MANY_0001");
    expect(body[499]!["name"]).toBe("MANY_0500");
    expect(logs.match(/一覧を 500 行で切った/g) ?? []).toHaveLength(1);
    expect(logs).not.toContain("MANY_");
    expect(logs).not.toContain("sec_k351_");
    let justBody: Record<string, unknown>[] = [];
    const quiet = await h.captureLogs(async () => {
      justBody = (await list(just)).body;
    });
    expect(justBody).toHaveLength(500);
    expect(quiet).not.toContain("一覧を 500 行で切った");
  });

  it("K351-API-014 行の守り（読む）：持ち主は自分の個人を読める。同じ会社のほかの人（管理者も）は他人の個人を 0 行。ワークスペースの物は誰でも読める", async () => {
    const me = await freshPerson();
    const mine = await cred(me, { name: "READ_MINE" });
    const ws = await cred(boss, { name: "READ_WS", layer: "workspace" });
    const q = "select id from credentials where id = $1";
    expect(await asApp(me, q, [mine.id])).toBe(1);
    expect(await asApp(boss, q, [mine.id])).toBe(0);
    expect(await asApp(staff, q, [mine.id])).toBe(0);
    expect(await asApp(staff, q, [ws.id])).toBe(1);
    expect(await asApp(me, q, [ws.id])).toBe(1);
  });

  it("K351-API-015 行の守り（個人を書く）：credentials の edit を持つ管理者でも、他人の個人の物は直せない・消せない（0 行・行は変わらない）", async () => {
    const me = await freshPerson();
    const mine = await cred(me, { name: "WRITE_MINE", description: "前" });
    expect(await asApp(boss, "update credentials set description = '書き換え' where id = $1", [mine.id])).toBe(0);
    expect(await asApp(boss, "delete from credentials where id = $1", [mine.id])).toBe(0);
    expect((await h.row(mine.id))?.["description"]).toBe("前");
    expect(await asApp(me, "update credentials set description = '自分で直す' where id = $1", [mine.id])).toBe(1);
    expect((await h.row(mine.id))?.["description"]).toBe("自分で直す");
  });

  it("K351-API-016 行の守り（ワークスペースを書く）：edit の無い人は自分を持ち主にしても作れない（断る）・直せない（0 行）。edit のある人は作れて直せる", async () => {
    const ins =
      "insert into credentials (tenant_id, scope_id, owner_member_id, vault_ref, name, layer) values ($1, $2, $3, 'sec_ws', $4, 'workspace')";
    expect(await asApp(staff, ins, [A.tenantId, A.rootScope, staff.id, "WS_BY_STAFF"])).toBe("denied");
    expect(await asApp(boss, ins, [A.tenantId, A.rootScope, boss.id, "WS_BY_BOSS"])).toBe(1);
    const ws = (
      await h.admin.query<{ id: string }>("select id from credentials where tenant_id = $1 and name = 'WS_BY_BOSS'", [
        A.tenantId,
      ])
    ).rows[0]!.id;
    expect(await asApp(staff, "update credentials set description = '担当者' where id = $1", [ws])).toBe(0);
    expect(await asApp(boss, "update credentials set description = '管理者' where id = $1", [ws])).toBe(1);
    expect((await h.row(ws))?.["description"]).toBe("管理者");
  });

  it("K351-API-017 行の守り（個人を作る）：他人を持ち主にした個人の物は、edit を持つ管理者でも作れない（断る）", async () => {
    const ins =
      "insert into credentials (tenant_id, scope_id, owner_member_id, vault_ref, name, layer) values ($1, $2, $3, 'sec_p', 'FOR_STAFF', 'personal')";
    expect(await asApp(boss, ins, [A.tenantId, A.rootScope, staff.id])).toBe("denied");
    expect(await asApp(staff, ins, [A.tenantId, A.rootScope, staff.id])).toBe(1);
  });

  it("K351-API-018 別の会社：会社 B の文脈では会社 A の物を読めない（0 行）・直せない（0 行）", async () => {
    const ws = await cred(boss, { name: "CROSS_WS", layer: "workspace" });
    expect(await asApp(other, "select id from credentials where id = $1", [ws.id])).toBe(0);
    expect(await asApp(other, "update credentials set description = '他社' where id = $1", [ws.id])).toBe(0);
    expect((await h.row(ws.id))?.["description"]).toBeNull();
  });
});
