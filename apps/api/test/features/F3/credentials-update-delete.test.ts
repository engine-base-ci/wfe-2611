// K-353「上書きの口（updateCredential）と消す口（deleteCredential）」の単体の試験（口と DB・本物の Postgres・本物の秘密の関門）。
// テストの名前の頭の行 ID（K353-API-…）は 11_tickets/K-353.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py と 05_flow/screen_api.d/K-353.py で直す）:
//   updateCredential  PATCH /api/v1/credentials/:id（本人・取り直しか、ログインから 15 分の内）
//     体 { login?, password?, value?, two_factor?, totp_secret?, destinations?, expires_on?, description?, reason? }（strict。name・layer・kind は変えられない）
//     200 { data: Credential }（一覧と同じ形）・Cache-Control: private, no-store
//     中身を変えるとき：login は login と password を両方（totp なら totp_secret も）、key は value。欠け → 422・E-CRED-005
//       順：新しい中身を金庫に入れる［残る］→ 行の vault_ref を「前の参照のままなら」新しい参照に替える（ほかが先に替えていたら 409・E-CRED-009）
//           → 前の参照を失効させる → login なら上書きした人の PC に確かめの仕事を積む
//       ワークスペースの物を中身ごと上書きした人が、その物の持ち主（預けた人）になる
//     中身を変えないとき（使える場所・期限・説明・2 段階の種類）：金庫に触らず、確かめも積まない
//     変える物が無い（{} か reason だけ）→ 422・E-CRED-008
//     他人の個人・別の会社・消した物・無い id → 404（有ることも漏らさない）／ワークスペースの物で edit が無い → 403・E-CRED-007
//     証跡 credential.update：変えた欄の名前・value_replaced・reason（値は書かない）
//   deleteCredential  DELETE /api/v1/credentials/:id（本人。本人確認の取り直しは要らない）
//     200 { data: { id } }
//     順：DB の関数で 行に deleted_at と revoked_at を立て、その資格情報の確かめの途中の仕事（queued・running・asking）を cancelled にする（1 つの取引）
//         → 金庫の物を失効させる（失敗しても 200・行はもう使えない・ログに参照と「後片付け」）
//     他人の個人・別の会社・消した物・無い id → 404／ワークスペースの物で edit が無い → 403・E-CRED-007
//     証跡 credential.delete
//   中身を替える上書きは、前の値で動いている確かめの仕事（queued・running・asking）を、行を替える取引の中で cancelled にしてから新しい仕事を積む
//     止めるのは DB の関数 app.credential_cancel_checks（行の守りの外）。ワークスペースの物を別の管理者が替えるとき、前の持ち主の仕事も止まる
//     （bridge_jobs の行の守りは自分の仕事だけを直せるので、素の update では 0 行になり黙って止まらない）
//     止めた後に新しい仕事を積めなかった回は、行は stopped のまま残る（0065 の引き金が止めた時に写す）
//   失効しただけ（revoked_at あり・消していない）の物は、上書きも消すも 404（一覧に出ない物・代表の答え answer=449e72553c59）
import { beforeAll, describe, expect, it } from "vitest";
import { kanameError } from "@kaname/errors";
import { RateLimited } from "@kaname/secrets";
import { setupCredentials, type Person } from "./credentials.harness.js";
// 作り物の秘密の値は _fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import {
  K353_NEW_PW,
  K353_NEW_VALUE,
  K353_OLD_PW,
  K353_OLD_VALUE,
  K353_RACE_VALUE_1,
  K353_RACE_VALUE_2,
} from "../../_fake/secrets.js";

const h = setupCredentials();
const OLD_PW = K353_OLD_PW;
const NEW_PW = K353_NEW_PW;
const NEW_VALUE = K353_NEW_VALUE;

let A: { tenantId: string; rootScope: string };
let B: { tenantId: string; rootScope: string };
let boss: Person;
let staff: Person;
let other: Person;
beforeAll(async () => {
  A = await h.company("K353 会社 A");
  B = await h.company("K353 会社 B");
  boss = await h.person(A.tenantId, A.rootScope, { name: "管理者", admin: true });
  staff = await h.person(A.tenantId, A.rootScope, { name: "担当者" });
  other = await h.person(B.tenantId, B.rootScope, { name: "別の会社", admin: true });
});

let seq = 0;
const fresh = async (o: { admin?: boolean } = {}) =>
  h.person(A.tenantId, A.rootScope, { name: `人 ${++seq}`, ...(o.admin ? { admin: true } : {}) });
/** 預ける口（K-352）で 1 つ作り、id と参照を返す */
const make = async (
  p: Person,
  o: { kind?: "login" | "key"; layer?: "workspace" | "personal"; name?: string } = {},
): Promise<{ id: string; ref: string; name: string }> => {
  const name = o.name ?? `K353_${++seq}`;
  const body =
    (o.kind ?? "login") === "login"
      ? {
          layer: o.layer ?? "personal",
          kind: "login",
          name,
          login: "old@example.com",
          password: OLD_PW,
          destinations: ["old.example.com"],
        }
      : {
          layer: o.layer ?? "personal",
          kind: "key",
          name,
          value: K353_OLD_VALUE,
          destinations: ["api.old.example.com"],
        };
  const r = await h.req("POST", "/credentials", { body, headers: h.as(p) });
  expect(r.status, await r.clone().text()).toBe(201);
  const id = String(((await h.json(r)).data as Record<string, unknown>)["id"]);
  return { id, ref: String((await h.row(id))!["vault_ref"]), name };
};
const patch = (p: Person, id: string, body: unknown, o: Parameters<typeof h.as>[1] = {}) =>
  h.req("PATCH", `/credentials/${id}`, { body, headers: h.as(p, o) });
const del = (p: Person, id: string, o: Parameters<typeof h.as>[1] = {}) =>
  h.req("DELETE", `/credentials/${id}`, { headers: h.as(p, o) });
const jobs = async (credentialId: string) =>
  (
    await h.admin.query<{ member_id: string; state_id: string }>(
      "select member_id, state_id from bridge_jobs where credential_id = $1 and kind = 'login_check' order by created_at",
      [credentialId],
    )
  ).rows;
// 時刻や預けた物の状態で決まる断り：409・欄は付けない。本文全体（error・文）を正本の番号と照らす
const expect409 = async (r: Response, code: string) => {
  expect(r.status, await r.clone().text()).toBe(409);
  const j = await h.json(r);
  expect(j["error"]).toBe("conflict");
  expect(j["code"]).toBe(code);
  expect(j["message"]).toBe(kanameError(code).entry.message);
  expect(j["field"]).toBeUndefined();
  expect(j["details"]).toBeUndefined();
};
const expect422 = async (r: Response, code: string, field?: string) => {
  expect(r.status, await r.clone().text()).toBe(422);
  const j = await h.json(r);
  expect(j["code"]).toBe(code);
  if (field) expect(((j["details"] as { field?: string }[] | undefined) ?? []).map((d) => d.field)).toContain(field);
};
const block = async (table: string, col: string, p: Person, when: "insert" | "update") => {
  const fn = `k353_${when}_${table}_${p.id.replace(/-/g, "")}`;
  await h.admin.query(
    `create or replace function public.${fn}() returns trigger language plpgsql as $$ begin if new.${col} = '${p.id}' then raise exception 'k353 block'; end if; return new; end $$`,
  );
  await h.admin.query(`create trigger ${fn} before ${when} on ${table} for each row execute function public.${fn}()`);
  return async () => {
    await h.admin.query(`drop trigger if exists ${fn} on ${table}`);
    await h.admin.query(`drop function if exists public.${fn}()`);
  };
};
const audits = async (id: string, action: string) =>
  (
    await h.admin.query<{ payload: Record<string, unknown> }>(
      "select payload from audit_events where target_id = $1 and action = $2",
      [id, action],
    )
  ).rows;

describe("K-353 上書きの口", () => {
  it("K353-API-001 鍵の値の上書き：200・答えは一覧の形。金庫の中身は新しい値・行の参照が替わり・前の参照は失効。証跡に value_replaced と理由（値は無い）", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    const r = await patch(me, c.id, { value: NEW_VALUE, reason: "会計ソフトで作り直したため" });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(d).toMatchObject({ id: c.id, name: c.name, kind: "key" });
    expect(JSON.stringify(d)).not.toContain(NEW_VALUE);
    const ref = String((await h.row(c.id))!["vault_ref"]);
    expect(ref).not.toBe(c.ref);
    expect(await h.plain(me, ref)).toEqual({ value: NEW_VALUE });
    expect(await h.vault.live(c.ref)).toBe(false);
    const ev = await audits(c.id, "credential.update");
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ value_replaced: true, reason: "会計ソフトで作り直したため" });
    expect(JSON.stringify(ev[0]!.payload)).not.toContain(NEW_VALUE);
  });

  it("K353-API-002 ログイン情報の上書き（PC あり）：login と password を両方で 200。中身が替わり、確かめの仕事がもう 1 つ積まれ state は pending", async () => {
    await h.ready();
    const me = await fresh();
    await h.bridgeOn(me);
    const c = await make(me);
    const before = (await jobs(c.id)).length;
    const r = await patch(me, c.id, { login: "new@example.com", password: NEW_PW });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect((d["login_check"] as Record<string, unknown>)["state"]).toBe("pending");
    expect(await h.plain(me, String((await h.row(c.id))!["vault_ref"]))).toEqual({
      login: "new@example.com",
      password: NEW_PW,
      totp_secret: null,
    });
    expect((await jobs(c.id)).length).toBe(before + 1);
  });

  it("K353-API-003 ワークスペースの物を別の管理者が中身ごと上書き：200・持ち主は上書きした人に替わり、確かめの仕事はその人に宛てる", async () => {
    await h.ready();
    const first = await fresh({ admin: true });
    const second = await fresh({ admin: true });
    await h.bridgeOn(second);
    const c = await make(first, { layer: "workspace" });
    const r = await patch(second, c.id, { login: "ws@example.com", password: NEW_PW });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.row(c.id))!["owner_member_id"]).toBe(second.id);
    expect((await jobs(c.id)).at(-1)?.member_id).toBe(second.id);
  });

  it("K353-API-004 中身を変えない上書き（使える場所・期限・説明・2 段階の種類）：200・金庫に触らず参照は同じ・確かめも積まない。期限 null で消え、説明は空で null", async () => {
    await h.ready();
    const me = await fresh();
    await h.bridgeOn(me);
    const c = await make(me);
    const puts = h.vault.puts.length;
    const before = (await jobs(c.id)).length;
    const r = await patch(me, c.id, {
      destinations: ["HTTPS://New.Example.com/x"],
      expires_on: "2027-12-31",
      description: "説明",
      two_factor: "email",
    });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.json(r)).data).toMatchObject({
      destinations: ["new.example.com"],
      expires_on: "2027-12-31",
      description: "説明",
      two_factor: "email",
    });
    const r2 = await patch(me, c.id, { expires_on: null, description: "  " });
    expect((await h.json(r2)).data).toMatchObject({ expires_on: null, description: null });
    expect(h.vault.puts.length).toBe(puts);
    expect((await h.row(c.id))!["vault_ref"]).toBe(c.ref);
    expect((await jobs(c.id)).length).toBe(before);
  });

  it("K353-API-005 中身の欠けと混ざり：login の物に password だけは 422・E-CRED-005（欄 login）。鍵の物に login・totp にするのに鍵が無いは預けた物の状態で決まるので 409・E-CRED-015（欄なし）。行も金庫も変わらない", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me);
    const k = await make(me, { kind: "key" });
    const puts = h.vault.puts.length;
    await expect422(await patch(me, c.id, { password: NEW_PW }), "E-CRED-005", "login");
    await expect409(await patch(me, k.id, { login: "x@example.com" }), "E-CRED-015");
    await expect409(
      await patch(me, c.id, { login: "a@example.com", password: NEW_PW, two_factor: "totp" }),
      "E-CRED-015",
    );
    expect(h.vault.puts.length).toBe(puts);
    expect((await h.row(c.id))!["vault_ref"]).toBe(c.ref);
  });

  it("K353-API-006 変える物が無い：{} と理由だけは 422・E-CRED-008。証跡は増えない", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    await expect422(await patch(me, c.id, {}), "E-CRED-008");
    await expect422(await patch(me, c.id, { reason: "なんとなく" }), "E-CRED-008");
    expect(await audits(c.id, "credential.update")).toHaveLength(0);
  });

  it("K353-API-007 名前・層・種類は変えられない：name・layer・kind の欄は 422 で、行は変わらない", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    for (const body of [{ name: "RENAMED" }, { layer: "workspace" }, { kind: "login" }]) {
      const r = await patch(me, c.id, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
    expect(await h.row(c.id)).toMatchObject({ name: c.name, layer: "personal", kind_id: "api_key" });
  });

  it("K353-API-008 使える場所と期限の形違い：空の並びは 422・E-CRED-003・形違いは 422・E-CRED-002・昨日は 409・E-CRED-004（欄なし）", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    await expect422(await patch(me, c.id, { destinations: [] }), "E-CRED-003", "destinations");
    await expect422(await patch(me, c.id, { destinations: ["localhost"] }), "E-CRED-002", "destinations");
    const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(
      new Date(Date.now() - 86_400_000),
    );
    await expect409(await patch(me, c.id, { expires_on: yesterday }), "E-CRED-004");
  });

  it("K353-API-009 本人確認：ログインから 16 分・取り直し無しは 403・STEP_UP_REQUIRED で何も変わらない。取り直し 14 分前なら 200", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    const puts = h.vault.puts.length;
    const r = await patch(me, c.id, { value: NEW_VALUE }, { loginAgoSec: 16 * 60 });
    expect(r.status).toBe(403);
    expect((await h.json(r))["code"]).toBe("STEP_UP_REQUIRED");
    expect(h.vault.puts.length).toBe(puts);
    expect((await h.row(c.id))!["vault_ref"]).toBe(c.ref);
    const ok = await patch(me, c.id, { value: NEW_VALUE }, { loginAgoSec: 16 * 60, stepUpAgoSec: 14 * 60 });
    expect(ok.status, await ok.clone().text()).toBe(200);
  });

  // 失効しただけの物（一覧に出ない）も 404（代表の答え answer=449e72553c59）
  it("K353-API-010 見えない物：他人の個人（管理者でも）・別の会社の物・消した物・失効しただけの物・無い id は 404 で、行も金庫も変わらない", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    const gone = await make(me, { kind: "key" });
    await h.admin.query("update credentials set deleted_at = now() where id = $1", [gone.id]);
    const revoked = await make(me, { kind: "key" });
    await h.admin.query("update credentials set revoked_at = now() where id = $1", [revoked.id]);
    const puts = h.vault.puts.length;
    for (const [who, id] of [
      [boss, c.id],
      [other, c.id],
      [me, gone.id],
      [me, revoked.id],
      [me, "00000000-0000-4000-8000-000000000000"],
    ] as const) {
      const r = await patch(who, id, { value: NEW_VALUE });
      expect(r.status, `${who.id} ${id}`).toBe(404);
    }
    expect(h.vault.puts.length).toBe(puts);
    expect((await h.row(c.id))!["vault_ref"]).toBe(c.ref);
  });

  it("K353-API-011 ワークスペースの物を edit の無い人が上書き：403・E-CRED-007 で変わらない", async () => {
    await h.ready();
    const c = await make(boss, { kind: "key", layer: "workspace" });
    const r = await patch(staff, c.id, { description: "担当者が直す" });
    expect(r.status).toBe(403);
    expect((await h.json(r))["code"]).toBe("E-CRED-007");
    expect((await h.row(c.id))!["description"]).toBeNull();
  });

  it("K353-API-012 手順 1 の失敗：新しい中身を金庫に置けないと 502・E-SEC-001、上限なら 503・E-SEC-003 と retry_after_sec。どちらも行は前の参照のままで、前の物は生きている", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    h.vault.failPut = new Error("置き場に届かない");
    try {
      const r = await patch(me, c.id, { value: NEW_VALUE });
      expect(r.status).toBe(502);
      expect((await h.json(r))["code"]).toBe("E-SEC-001");
      h.vault.failPut = new RateLimited(42);
      const r2 = await patch(me, c.id, { value: NEW_VALUE });
      expect(r2.status).toBe(503);
      const j = await h.json(r2);
      expect(j["code"]).toBe("E-SEC-003");
      expect(j["retry_after_sec"]).toBe(42);
    } finally {
      h.vault.failPut = null;
    }
    expect((await h.row(c.id))!["vault_ref"]).toBe(c.ref);
    expect(await h.vault.live(c.ref)).toBe(true);
  });

  it("K353-API-013 手順 2 の失敗：行を直せない（引き金で断る）と 503・E-PAGE-003。新しい物は失効し、行と前の物はそのまま", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    const undo = await block("credentials", "owner_member_id", me, "update");
    try {
      const puts = h.vault.puts.length;
      const r = await patch(me, c.id, { value: NEW_VALUE });
      expect(r.status).toBe(503);
      expect((await h.json(r))["code"]).toBe("E-PAGE-003");
      const placed = h.vault.puts.slice(puts);
      expect(placed).toHaveLength(1);
      expect(await h.vault.live(placed[0]!)).toBe(false);
    } finally {
      await undo();
    }
    expect((await h.row(c.id))!["vault_ref"]).toBe(c.ref);
    expect(await h.vault.live(c.ref)).toBe(true);
  });

  it("K353-API-014 手順 2 の失敗で後片付け（新しい物の失効）も失敗：503・E-PAGE-003。新しい物は残り、ログに参照と「後片付け」が出て値は出ない", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    const undo = await block("credentials", "owner_member_id", me, "update");
    h.vault.failRevoke = new Error("失効に届かない");
    const placed: string[] = [];
    try {
      const puts = h.vault.puts.length;
      const logs = await h.captureLogs(async () => {
        const r = await patch(me, c.id, { value: NEW_VALUE });
        expect(r.status).toBe(503);
      });
      placed.push(...h.vault.puts.slice(puts));
      expect(logs).toContain(placed[0]!);
      expect(logs).toContain("後片付け");
      expect(logs).not.toContain(NEW_VALUE);
    } finally {
      h.vault.failRevoke = null;
      await undo();
    }
    expect(await h.vault.live(placed[0]!)).toBe(true);
    expect((await h.row(c.id))!["vault_ref"]).toBe(c.ref);
  });

  it("K353-API-015 手順 3 の失敗：前の参照の失効が落ちても 200。行は新しい参照・前の物は残り、ログに前の参照と「後片付け」", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    h.vault.failRevoke = new Error("失効に届かない");
    try {
      const logs = await h.captureLogs(async () => {
        const r = await patch(me, c.id, { value: NEW_VALUE });
        expect(r.status, await r.clone().text()).toBe(200);
      });
      expect(logs).toContain(c.ref);
      expect(logs).toContain("後片付け");
    } finally {
      h.vault.failRevoke = null;
    }
    const ref = String((await h.row(c.id))!["vault_ref"]);
    expect(ref).not.toBe(c.ref);
    expect(await h.plain(me, ref)).toEqual({ value: NEW_VALUE });
    expect(await h.vault.live(c.ref)).toBe(true);
  });

  it("K353-API-016 同時に 2 回の中身の上書き：200 はちょうど 1 回・もう 1 回は 409・E-CRED-009。行の参照だけが生きていて、ほかの新しい物と前の物は失効", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    const puts = h.vault.puts.length;
    // 2 本とも前の参照を読み、金庫に置き終わるまで、行の錠で書き込みを止めてから放す（同時を作る）。
    //   錠が無いと、2 本目が入口で新しい接続を開く間に 1 本目が書き終わり、正しく順番の 2 回（200・200）になる回がある
    const lock = await h.admin.connect();
    const put = h.vault.put.bind(h.vault);
    let open = false;
    let rs: Response[];
    try {
      await lock.query("begin");
      open = true;
      await lock.query("select 1 from credentials where id = $1 for update", [c.id]);
      let release!: () => void;
      const bothPlaced = new Promise<void>((r) => (release = r));
      let n = 0;
      h.vault.put = async (ref, s) => {
        await put(ref, s);
        if (++n === 2) release();
      };
      const both = Promise.all([
        patch(me, c.id, { value: K353_RACE_VALUE_1 }),
        patch(me, c.id, { value: K353_RACE_VALUE_2 }),
      ]);
      // 2 本とも置く前に答えが返った（置く前に書く誤った実装など）ときも固まらず、下の期待で落とす
      await Promise.race([bothPlaced, both]);
      await lock.query("commit");
      open = false;
      rs = await both;
    } finally {
      h.vault.put = put;
      if (open) await lock.query("rollback");
      lock.release();
    }
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await h.json(rs.find((r) => r.status === 409)!))["code"]).toBe("E-CRED-009");
    const ref = String((await h.row(c.id))!["vault_ref"]);
    expect(await h.vault.live(ref)).toBe(true);
    for (const x of [...h.vault.puts.slice(puts), c.ref].filter((x) => x !== ref))
      expect(await h.vault.live(x)).toBe(false);
  });

  it("K353-API-017 上書きの値は、その間のログにも答えにも証跡にも出ない", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me);
    const logs = await h.captureLogs(async () => {
      const r = await patch(me, c.id, { login: "leak@example.com", password: NEW_PW });
      expect(r.status).toBe(200);
      expect(await r.text()).not.toContain(NEW_PW);
    });
    expect(logs).not.toContain(NEW_PW);
    expect(JSON.stringify(await audits(c.id, "credential.update"))).not.toContain(NEW_PW);
  });
  it("K353-API-027 上書きの手順 S4 の失敗：確かめの仕事を積めない（引き金で断る）と 200。行は新しい中身で、login_check.state は前のまま。ログに id と「確かめ」", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me);
    await h.bridgeOn(me);
    const stateBefore = (await h.row(c.id))!["login_check_state"];
    const undo = await block("bridge_jobs", "member_id", me, "insert");
    try {
      const logs = await h.captureLogs(async () => {
        const r = await patch(me, c.id, { login: "s4@example.com", password: NEW_PW });
        expect(r.status, await r.clone().text()).toBe(200);
      });
      expect(logs).toContain(c.id);
      expect(logs).toContain("確かめ");
      expect(logs).not.toContain(NEW_PW);
    } finally {
      await undo();
    }
    const row = (await h.row(c.id))!;
    expect(row["vault_ref"]).not.toBe(c.ref);
    expect((await h.plain(me, String(row["vault_ref"])))?.["password"]).toBe(NEW_PW);
    expect(row["login_check_state"]).toBe(stateBefore);

    // 前の確かめ（queued）を止めた回：止めた時に行は stopped になり、積めなかったのでそのまま残る。新しい仕事は無い
    const you = await fresh();
    await h.bridgeOn(you);
    const c2 = await make(you); // 預けた直後の確かめの仕事が 1 つ（queued）・行は pending
    expect((await jobs(c2.id)).map((j) => j.state_id)).toEqual(["queued"]);
    const undo2 = await block("bridge_jobs", "member_id", you, "insert");
    try {
      const logs = await h.captureLogs(async () => {
        const r = await patch(you, c2.id, { login: "s4b@example.com", password: NEW_PW });
        expect(r.status, await r.clone().text()).toBe(200);
      });
      expect(logs).toContain(c2.id);
      expect(logs).toContain("確かめ");
      expect(logs).not.toContain(NEW_PW);
    } finally {
      await undo2();
    }
    const row2 = (await h.row(c2.id))!;
    expect(row2["vault_ref"]).not.toBe(c2.ref);
    expect(row2["login_check_state"]).toBe("stopped");
    expect((await jobs(c2.id)).map((j) => j.state_id)).toEqual(["cancelled"]);
  });

  it("K353-API-029 ワークスペースの物で前の持ち主の確かめが途中（asking）のときに、別の管理者が中身を替える：200・state pending。前の持ち主の仕事は cancelled（finished_at あり）・新しい仕事は上書きした人宛てに 1 つだけ", async () => {
    await h.ready();
    const first = await fresh({ admin: true });
    const second = await fresh({ admin: true });
    await h.bridgeOn(first);
    await h.bridgeOn(second);
    const c = await make(first, { layer: "workspace" }); // 預けた直後の確かめの仕事が 1 つ（first 宛て・queued）
    // 前の持ち主の仕事を asking にしておく（コードを待っている途中）
    const moved = await h.admin.query(
      "update bridge_jobs set state_id = 'asking' where credential_id = $1 and kind = 'login_check' and member_id = $2 and state_id = 'queued'",
      [c.id, first.id],
    );
    expect(moved.rowCount).toBe(1);
    const r = await patch(second, c.id, { login: "ws2@example.com", password: NEW_PW });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(
      (((await h.json(r)).data as Record<string, unknown>)["login_check"] as Record<string, unknown>)["state"],
    ).toBe("pending");
    expect((await h.row(c.id))!["owner_member_id"]).toBe(second.id);
    const after = (
      await h.admin.query<{ member_id: string; state_id: string; finished_at: Date | null }>(
        "select member_id, state_id, finished_at from bridge_jobs where credential_id = $1 and kind = 'login_check' order by created_at",
        [c.id],
      )
    ).rows;
    // 前の持ち主の仕事は止まり、新しい仕事は上書きした人宛ての 1 つだけ（前の持ち主宛ての新しい仕事は無い）
    expect(after.map((x) => [x.member_id, x.state_id])).toEqual([
      [first.id, "cancelled"],
      [second.id, "queued"],
    ]);
    expect(after[0]!.finished_at).not.toBeNull();
  });
});

describe("K-353 消す口", () => {
  it("K353-API-028 中身を替える上書きは、前の値で動いている確かめの仕事（queued・asking）を cancelled（finished_at あり）にしてから新しい仕事を 1 つ積む（state pending）。終わった仕事（done）は変えない。中身を替えない上書き（説明だけ）は仕事を止めない", async () => {
    await h.ready();
    const me = await fresh();
    await h.bridgeOn(me);
    const c = await make(me); // 預けた直後の確かめの仕事が 1 つ（queued）
    await h.admin.query(
      `insert into bridge_jobs (tenant_id, scope_id, member_id, prompt, created_by, browser, kind, credential_id, state_id)
       values ($1, $2, $3, '', $3, 'dedicated', 'login_check', $4, 'done')`,
      [me.tenantId, me.scopeId, me.id, c.id],
    );
    // 説明だけの上書きでは、前の確かめは止まらない
    expect((await patch(me, c.id, { description: "説明だけ" })).status).toBe(200);
    const kept = await jobs(c.id);
    expect(kept.filter((j) => j.state_id === "queued")).toHaveLength(1);
    // 前の仕事を asking にしておく（コードを待っている途中）
    await h.admin.query(
      "update bridge_jobs set state_id = 'asking' where credential_id = $1 and kind = 'login_check' and state_id = 'queued'",
      [c.id],
    );
    const r = await patch(me, c.id, { login: "new@example.com", password: NEW_PW });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(
      (((await h.json(r)).data as Record<string, unknown>)["login_check"] as Record<string, unknown>)["state"],
    ).toBe("pending");
    const after = (
      await h.admin.query<{ state_id: string; finished_at: Date | null }>(
        "select state_id, finished_at from bridge_jobs where credential_id = $1 and kind = 'login_check' order by created_at",
        [c.id],
      )
    ).rows;
    expect(after.map((x) => x.state_id).sort()).toEqual(["cancelled", "done", "queued"]);
    expect(after.find((x) => x.state_id === "cancelled")!.finished_at).not.toBeNull();
  });

  it("K353-API-018 自分の個人を消す：200 { id }。一覧から消え、行に deleted_at と revoked_at・金庫の物は失効・証跡 credential.delete", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    const r = await del(me, c.id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.json(r)).data).toEqual({ id: c.id });
    const l = await h.req("GET", "/credentials", { headers: h.as(me) });
    expect(((await h.json(l)).data as Record<string, unknown>[]).map((x) => x["id"])).not.toContain(c.id);
    const row = (await h.row(c.id))!;
    expect(row["deleted_at"]).not.toBeNull();
    expect(row["revoked_at"]).not.toBeNull();
    expect(await h.vault.live(c.ref)).toBe(false);
    expect(await audits(c.id, "credential.delete")).toHaveLength(1);
  });

  it("K353-API-019 確かめの途中の仕事：queued と asking の仕事は cancelled（finished_at あり）、終わった仕事（done）は変えない", async () => {
    await h.ready();
    const me = await fresh();
    await h.bridgeOn(me);
    const c = await make(me);
    await h.admin.query(
      `insert into bridge_jobs (tenant_id, scope_id, member_id, prompt, created_by, browser, kind, credential_id, state_id)
       values ($1, $2, $3, '', $3, 'dedicated', 'login_check', $4, 'asking'), ($1, $2, $3, '', $3, 'dedicated', 'login_check', $4, 'done')`,
      [me.tenantId, me.scopeId, me.id, c.id],
    );
    expect((await del(me, c.id)).status).toBe(200);
    const after = (
      await h.admin.query<{ state_id: string; finished_at: Date | null }>(
        "select state_id, finished_at from bridge_jobs where credential_id = $1 order by state_id",
        [c.id],
      )
    ).rows;
    expect(after.map((x) => x.state_id).sort()).toEqual(["cancelled", "cancelled", "done"]);
    for (const x of after.filter((y) => y.state_id === "cancelled")) expect(x.finished_at).not.toBeNull();
  });

  it("K353-API-020 ワークスペースの物：edit のある人は消せる。edit の無い人は 403・E-CRED-007 で消えない", async () => {
    await h.ready();
    const c = await make(boss, { kind: "key", layer: "workspace" });
    const r = await del(staff, c.id);
    expect(r.status).toBe(403);
    expect((await h.json(r))["code"]).toBe("E-CRED-007");
    expect((await h.row(c.id))!["deleted_at"]).toBeNull();
    const admin2 = await fresh({ admin: true });
    expect((await del(admin2, c.id)).status).toBe(200);
  });

  // 失効しただけの物（一覧に出ない）も 404（代表の答え answer=449e72553c59）
  it("K353-API-021 見えない物：他人の個人（管理者でも）・別の会社・消した物・失効しただけの物・無い id は 404 で、行も金庫も変わらない", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    const gone = await make(me, { kind: "key" });
    expect((await del(me, gone.id)).status).toBe(200);
    const revoked = await make(me, { kind: "key" });
    await h.admin.query("update credentials set revoked_at = now() where id = $1", [revoked.id]);
    for (const [who, id] of [
      [boss, c.id],
      [other, c.id],
      [me, gone.id],
      [me, revoked.id],
      [me, "00000000-0000-4000-8000-000000000000"],
    ] as const)
      expect((await del(who, id)).status, `${who.id} ${id}`).toBe(404);
    expect((await h.row(c.id))!["deleted_at"]).toBeNull();
    expect(await h.vault.live(c.ref)).toBe(true);
    expect((await h.row(revoked.id))!["deleted_at"]).toBeNull();
  });

  it("K353-API-022 消した後に同じ名前で預け直せる（201）", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key", name: "AGAIN_NAME" });
    expect((await del(me, c.id)).status).toBe(200);
    const again = await make(me, { kind: "key", name: "AGAIN_NAME" });
    expect(again.id).not.toBe(c.id);
  });

  it("K353-API-023 本人確認は要らない：ログインから 16 分・取り直し無しでも消せる（200）", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    expect((await del(me, c.id, { loginAgoSec: 16 * 60 })).status).toBe(200);
  });

  it("K353-API-024 手順 1 の失敗：行を消せない（引き金で断る）と 503・E-PAGE-003。行は残り、金庫の物は生きている", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    const undo = await block("credentials", "owner_member_id", me, "update");
    try {
      const r = await del(me, c.id);
      expect(r.status).toBe(503);
      expect((await h.json(r))["code"]).toBe("E-PAGE-003");
    } finally {
      await undo();
    }
    expect((await h.row(c.id))!["deleted_at"]).toBeNull();
    expect(await h.vault.live(c.ref)).toBe(true);
  });

  it("K353-API-025 手順 2 の失敗：金庫の失効が落ちても 200。行は消えて使えず、金庫の物は残る。ログに参照と「後片付け」", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    h.vault.failRevoke = new Error("失効に届かない");
    try {
      const logs = await h.captureLogs(async () => {
        const r = await del(me, c.id);
        expect(r.status, await r.clone().text()).toBe(200);
      });
      expect(logs).toContain(c.ref);
      expect(logs).toContain("後片付け");
    } finally {
      h.vault.failRevoke = null;
    }
    expect((await h.row(c.id))!["deleted_at"]).not.toBeNull();
    expect(await h.vault.live(c.ref)).toBe(true);
  });

  it("K353-API-026 ログインしていない：上書きも消すも 401 で、行は変わらない", async () => {
    await h.ready();
    const me = await fresh();
    const c = await make(me, { kind: "key" });
    expect((await h.req("PATCH", `/credentials/${c.id}`, { body: { value: NEW_VALUE } })).status).toBe(401);
    expect((await h.req("DELETE", `/credentials/${c.id}`)).status).toBe(401);
    expect(await h.row(c.id)).toMatchObject({ vault_ref: c.ref, deleted_at: null });
  });
});
