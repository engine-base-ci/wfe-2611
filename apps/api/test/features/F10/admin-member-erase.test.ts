// K-849「外す口の後ろ半分（DB の関数 app.member_erase：すぐ消える物を消す・セッションと PC を切る・外した印と 30 日の戻りの元を残す）」の試験
//   （本物の DB・本物の行の守り。口は無い関数なので、持ち主の接続（admin）で呼び、kaname_app から呼べないことは土台の f.pool で見る。土台 admin.harness.ts）。
//   行 ID（K849-DB-…）は 11_tickets/K-849.md の表と 1 対 1。関数の形は K-849.md の「実施事項」:
//     app.member_erase(p_member uuid, p_removed_by uuid) returns jsonb
//       → { memories, conversations, credentials, invitations, sessions, restorable_until }（鍵はちょうど 6・件数は数・restorable_until は外した時刻 + 30 日の ISO 8601）
//       → 外した人が今は外せない人（居ない・もう外した・別の会社・AI）なら { error: "member_gone" }（何も書かない）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupAdmin, type P, type World } from "./admin.harness.js";

const h = setupAdmin();
const KEYS = ["conversations", "credentials", "invitations", "memories", "restorable_until", "sessions"];
const DAY = 86_400_000;

type R = Record<string, unknown>;
const erase = async (w: World, p: P): Promise<R> =>
  (await h.one<{ v: R }>("select app.member_erase($1, $2) as v", [p.id, w.admin.id])).v;
const mem = (w: World, owner: P | null, visibility = "self") =>
  h.one<{ id: string }>(
    "insert into memories (tenant_id, scope_id, owner_member_id, title, body, visibility) values ($1, $2, $3, '記憶', '中身', $4) returning id",
    [w.tenantId, w.eg, owner?.id ?? null, visibility],
  );
const conv = (w: World, people: P[]) =>
  h.one<{ id: string }>(
    "insert into conversations (tenant_id, scope_id, title, participant_member_ids) values ($1, $2, '会話', $3) returning id",
    [w.tenantId, w.eg, people.map((x) => x.id)],
  );
const cred = (w: World, owner: P, revoked = false) =>
  h.one<{ id: string }>(
    "insert into credentials (tenant_id, scope_id, owner_member_id, vault_ref, revoked_at) values ($1, $2, $3, 'vault://k849', $4) returning id",
    [w.tenantId, w.eg, owner.id, revoked ? new Date() : null],
  );
const inv = (w: World, by: P, state: "waiting" | "used" | "expired" | "revoked") =>
  h.one<{ id: string }>(
    `insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, accepted_member_id, revoked_at, created_by)
     values ($1, $2, $3, 'member', $4, $5, $6, $7, $8) returning id`,
    [
      w.tenantId,
      `k849-${randomUUID().slice(0, 8)}@engine-base.example`,
      w.eg,
      randomUUID().replaceAll("-", ""),
      new Date(Date.now() + (state === "expired" ? -DAY : 7 * DAY)),
      state === "used" ? w.admin.id : null,
      state === "revoked" ? new Date() : null,
      by.id,
    ],
  );
const session = (p: P, kind: "web" | "bridge", revoked = false) =>
  h.one<{ id: string }>(
    "insert into sessions (tenant_id, member_id, kind_id, auth_session_id, revoked_at, revoke_reason_id) values ($1, $2, $3, $4, $5, $6) returning id",
    [p.tenantId, p.id, kind, randomUUID(), revoked ? new Date() : null, revoked ? "logout" : null],
  );
const alive = (p: P) => h.num("select count(*) as n from sessions where member_id = $1 and revoked_at is null", [p.id]);
const live = (sql: string, id: string) => h.num(sql, [id]);

describe("K-849 外す口の後ろ半分（app.member_erase）", () => {
  it("K849-DB-001 個人の記憶：鈴木の記憶 2（自分だけ）・鈴木が勧めた記憶 1・会社の記憶（持ち主なし）1・佐藤の記憶 1 → 鈴木の「自分だけ」の 2 つだけ deleted_at が入る・勧めた記憶・会社の記憶・佐藤の記憶は触らない・答えの memories は 2", async () => {
    await h.ready();
    const w = await h.world();
    const a = await mem(w, w.member);
    const b = await mem(w, w.member);
    const rec = await mem(w, w.member, "recommended");
    const co = await mem(w, null);
    const sa = await mem(w, w.mgr);
    const r = await erase(w, w.member);
    expect(r["memories"]).toBe(2);
    const gone = (id: string) =>
      live("select count(*) as n from memories where id = $1 and deleted_at is not null", id);
    expect([await gone(a.id), await gone(b.id)]).toEqual([1, 1]);
    expect([await gone(rec.id), await gone(co.id), await gone(sa.id)]).toEqual([0, 0, 0]);
  });

  it("K849-DB-002 個人の会話：鈴木だけの会話 1・鈴木と佐藤の会話 1・佐藤だけの会話 1 → 鈴木だけの会話だけ消える・ほかの人が入っている会話は残る（参加者の並びも変えない）・答えの conversations は 1", async () => {
    await h.ready();
    const w = await h.world();
    const solo = await conv(w, [w.member]);
    const both = await conv(w, [w.member, w.mgr]);
    const other = await conv(w, [w.mgr]);
    const r = await erase(w, w.member);
    expect(r["conversations"]).toBe(1);
    const gone = (id: string) =>
      live("select count(*) as n from conversations where id = $1 and deleted_at is not null", id);
    expect([await gone(solo.id), await gone(both.id), await gone(other.id)]).toEqual([1, 0, 0]);
    const parts = await h.one<{ p: string[] }>("select participant_member_ids as p from conversations where id = $1", [
      both.id,
    ]);
    expect(parts.p.sort()).toEqual([w.member.id, w.mgr.id].sort());
  });

  it("K849-DB-003 預けたログイン情報：鈴木の 2 つ（1 つは前から失効）・佐藤の 1 つ → 鈴木の 2 つに revoked_at と deleted_at が入り vault_ref が空になる・前から失効の物の revoked_at は変わらない・佐藤の物は触らない・答えの credentials は 1（前から失効は数えない）", async () => {
    await h.ready();
    const w = await h.world();
    const live1 = await cred(w, w.member);
    const old = await cred(w, w.member, true);
    const oldAt = (await h.one<{ t: Date }>("select revoked_at as t from credentials where id = $1", [old.id])).t;
    const other = await cred(w, w.mgr);
    const r = await erase(w, w.member);
    expect(r["credentials"]).toBe(1);
    const row = (id: string) =>
      h.one<{ revoked_at: Date | null; deleted_at: Date | null; vault_ref: string | null }>(
        "select revoked_at, deleted_at, vault_ref from credentials where id = $1",
        [id],
      );
    const a = await row(live1.id);
    expect(a.revoked_at).not.toBeNull();
    expect(a.deleted_at).not.toBeNull();
    expect(a.vault_ref).toBeNull();
    const o = await row(old.id);
    expect(o.revoked_at?.getTime()).toBe(oldAt.getTime());
    expect(o.vault_ref).toBeNull();
    const c = await row(other.id);
    expect([c.revoked_at, c.deleted_at, c.vault_ref]).toEqual([null, null, "vault://k849"]);
  });

  it("K849-DB-004 出した招待：鈴木が出した招待（待っている 1・使われた 1・期限切れ 1・取り消し済み 1）と佐藤が出した待っている招待 1 → 鈴木の待っている招待だけ revoked_at が入る・ほかは変えない・答えの invitations は 1", async () => {
    await h.ready();
    const w = await h.world();
    const wait = await inv(w, w.member, "waiting");
    const used = await inv(w, w.member, "used");
    const exp = await inv(w, w.member, "expired");
    const rev = await inv(w, w.member, "revoked");
    const other = await inv(w, w.mgr, "waiting");
    const r = await erase(w, w.member);
    expect(r["invitations"]).toBe(1);
    const revoked = (id: string) =>
      live("select count(*) as n from invitations where id = $1 and revoked_at is not null", id);
    expect([
      await revoked(wait.id),
      await revoked(used.id),
      await revoked(exp.id),
      await revoked(rev.id),
      await revoked(other.id),
    ]).toEqual([1, 0, 0, 1, 0]);
    expect(
      await live("select count(*) as n from invitations where id = $1 and accepted_member_id is not null", used.id),
    ).toBe(1);
  });

  it("K849-DB-005 セッションと PC（G-14）：鈴木の画面 2・PC 1・前から切れている 1 と佐藤の画面 1 → 鈴木の生きている 3 つが全部 revoked・理由 member_left・答えの sessions は 3・佐藤の画面は生きたまま", async () => {
    await h.ready();
    const w = await h.world();
    await session(w.member, "web");
    await session(w.member, "web");
    await session(w.member, "bridge");
    await session(w.member, "web", true);
    await session(w.mgr, "web");
    expect(await alive(w.member)).toBe(3);
    const r = await erase(w, w.member);
    expect(r["sessions"]).toBe(3);
    expect(await alive(w.member)).toBe(0);
    expect(
      await h.num("select count(*) as n from sessions where member_id = $1 and revoke_reason_id = 'member_left'", [
        w.member.id,
      ]),
    ).toBe(3);
    expect(await alive(w.mgr)).toBe(1);
  });

  it("K849-DB-006 所属・権限・会社の役割：鈴木（営業のメンバー・個別に付けた権限 1）→ 所属の行は deleted_at・個別の権限の行は revoked_at・束の権限の行は引き金で消える・tenant_memberships は status left・members は deleted_at が入り、4 つの時刻が同じ（1 つの取引）・別の人の所属は変えない", async () => {
    await h.ready();
    const w = await h.world();
    await h.rows(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'invite')",
      [w.tenantId, w.member.id],
    );
    await erase(w, w.member);
    const m = await h.one<{ deleted_at: Date }>("select deleted_at from members where id = $1", [w.member.id]);
    expect(m.deleted_at).toBeInstanceOf(Date);
    const tm = await h.one<{ status: string; role: string }>(
      "select status, role from tenant_memberships where member_id = $1",
      [w.member.id],
    );
    expect(tm).toEqual({ status: "left", role: "member" });
    const sm = await h.rows<{ deleted_at: Date }>("select deleted_at from scope_memberships where member_id = $1", [
      w.member.id,
    ]);
    expect(sm).toHaveLength(1);
    expect(sm[0]!.deleted_at.getTime()).toBe(m.deleted_at.getTime());
    const pm = await h.one<{ revoked_at: Date | null }>(
      "select revoked_at from permissions where grantee_member_id = $1 and bundle_role is null",
      [w.member.id],
    );
    expect(pm.revoked_at).not.toBeNull();
    expect(
      await live(
        "select count(*) as n from permissions where grantee_member_id = $1 and bundle_role is not null",
        w.member.id,
      ),
    ).toBe(0);
    expect(
      await live("select count(*) as n from scope_memberships where member_id = $1 and deleted_at is null", w.mgr.id),
    ).toBe(1);
  });

  it("K849-DB-007 30 日の戻りの元（D-154.26）：鈴木（営業の主・受託開発を兼ねてマネージャー）を外す → 主・兼務の 2 行の role と is_primary はそのまま残る・deleted_at は members と同じ時刻・答えの restorable_until は deleted_at の 30 日後（1 分の誤差）・個人の物は 1 つも書き戻さない", async () => {
    await h.ready();
    const w = await h.world();
    await h.rows(
      "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $2, $3, false, 'manager')",
      [w.tenantId, w.jd, w.member.id],
    );
    const r = await erase(w, w.member);
    const at = (await h.one<{ deleted_at: Date }>("select deleted_at from members where id = $1", [w.member.id]))
      .deleted_at;
    const rows = await h.rows<{ scope_id: string; role: string; is_primary: boolean; deleted_at: Date }>(
      "select scope_id, role, is_primary, deleted_at from scope_memberships where member_id = $1 order by is_primary desc",
      [w.member.id],
    );
    expect(rows.map((x) => [x.scope_id, x.role, x.is_primary])).toEqual([
      [w.eg, "member", true],
      [w.jd, "manager", false],
    ]);
    expect(rows.every((x) => x.deleted_at.getTime() === at.getTime())).toBe(true);
    expect(Math.abs(new Date(String(r["restorable_until"])).getTime() - (at.getTime() + 30 * DAY))).toBeLessThan(
      60_000,
    );
  });

  it("K849-DB-008 残る物（D-128.96）：鈴木の書いたやり取り・作ったチケット・作った成果物・会社の記憶と、members の名前 → どれも消さず・名前（display_name）もそのまま読める", async () => {
    await h.ready();
    const w = await h.world();
    const kind = await h.one<{ id: string }>(
      "select id from ticket_kinds where tenant_id = $1 and deleted_at is null limit 1",
      [w.tenantId],
    );
    const stage = await h.one<{ id: string }>("select id from ticket_stages where tenant_id = $1 limit 1", [
      w.tenantId,
    ]);
    const t = await h.one<{ id: string }>(
      "insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, created_by, completed_at) values ($1, $2, 'EG-849', $3, $4, '作ったチケット', $5, now()) returning id",
      [w.tenantId, w.eg, kind.id, stage.id, w.member.id],
    );
    const msgRow = await h.one<{ id: string }>(
      "insert into ticket_messages (tenant_id, ticket_id, author_member_id, body) values ($1, $2, $3, '書いたやり取り') returning id",
      [w.tenantId, t.id, w.member.id],
    );
    const co = await mem(w, null);
    await erase(w, w.member);
    expect(await live("select count(*) as n from tickets where id = $1 and deleted_at is null", t.id)).toBe(1);
    expect(
      await live("select count(*) as n from ticket_messages where id = $1 and deleted_at is null", msgRow.id),
    ).toBe(1);
    expect(await live("select count(*) as n from memories where id = $1 and deleted_at is null", co.id)).toBe(1);
    expect((await h.one<{ n: string }>("select display_name as n from members where id = $1", [w.member.id])).n).toBe(
      "鈴木 一郎",
    );
  });

  it("K849-DB-009 二度目：もう外した人にもう一度 → { error: member_gone }・件数も時刻も変わらない（deleted_at は 1 度目のまま・所属の行は増えない）", async () => {
    await h.ready();
    const w = await h.world();
    await erase(w, w.member);
    const first = (await h.one<{ deleted_at: Date }>("select deleted_at from members where id = $1", [w.member.id]))
      .deleted_at;
    const again = await erase(w, w.member);
    expect(again).toEqual({ error: "member_gone" });
    const now = (await h.one<{ deleted_at: Date }>("select deleted_at from members where id = $1", [w.member.id]))
      .deleted_at;
    expect(now.getTime()).toBe(first.getTime());
    expect(await live("select count(*) as n from scope_memberships where member_id = $1", w.member.id)).toBe(1);
  });

  it("K849-DB-010 守り：kaname_app から直に呼ぶ → permission denied（画面の口の接続からは呼べない）・居ない人・別の会社の人・AI は member_gone・何も書かない", async () => {
    await h.ready();
    const w = await h.world();
    await expect(h.f.pool.query("select app.member_erase($1, $2)", [w.member.id, w.admin.id])).rejects.toThrow(
      /permission denied/,
    );
    expect(await live("select count(*) as n from members where id = $1 and deleted_at is null", w.member.id)).toBe(1);
    expect(await erase(w, { ...w.member, id: randomUUID() })).toEqual({ error: "member_gone" });
    expect(await erase(w, w.outsider)).toEqual({ error: "member_gone" });
    expect(await live("select count(*) as n from members where id = $1 and deleted_at is null", w.outsider.id)).toBe(1);
  });

  it("K849-DB-011 全部か無しか（手順の失敗）：鈴木の記憶・会話・預けたログイン情報・セッションを用意し、credentials の更新で例外を起こす → 例外・記憶も会話もセッションも所属も何も変わらない（members は有効のまま）", async () => {
    await h.ready();
    const w = await h.world();
    const m = await mem(w, w.member);
    const c = await conv(w, [w.member]);
    await cred(w, w.member);
    await session(w.member, "web");
    await h.breakOn("credentials", w.tenantId, "update", async () => {
      await expect(h.rows("select app.member_erase($1, $2)", [w.member.id, w.admin.id])).rejects.toThrow(
        /K800 試験の失敗/,
      );
    });
    expect(await live("select count(*) as n from memories where id = $1 and deleted_at is null", m.id)).toBe(1);
    expect(await live("select count(*) as n from conversations where id = $1 and deleted_at is null", c.id)).toBe(1);
    expect(await alive(w.member)).toBe(1);
    expect(await live("select count(*) as n from members where id = $1 and deleted_at is null", w.member.id)).toBe(1);
    expect(
      (await h.one<{ status: string }>("select status from tenant_memberships where member_id = $1", [w.member.id]))
        .status,
    ).toBe("active");
  });

  it("K849-DB-012 兼務（D-154.15）：営業のメンバー（主）・受託開発のマネージャー（兼務）・経理のマネージャー（兼務・別の層）を兼ねる人 → 3 行とも deleted_at・主は 1 つのまま残る・ほかの人の同じグループの所属は変えない", async () => {
    await h.ready();
    const w = await h.world();
    const multi = await h.make(w, "multi", "兼務の人", { groupRole: "member" });
    for (const sc of [w.jd, w.ac])
      await h.rows(
        "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $2, $3, false, 'manager')",
        [w.tenantId, sc, multi.id],
      );
    await erase(w, multi);
    expect(
      await live(
        "select count(*) as n from scope_memberships where member_id = $1 and deleted_at is not null",
        multi.id,
      ),
    ).toBe(3);
    expect(
      await live("select count(*) as n from scope_memberships where member_id = $1 and is_primary", multi.id),
    ).toBe(1);
    expect(
      await live("select count(*) as n from scope_memberships where member_id = $1 and deleted_at is null", w.mgr.id),
    ).toBe(1);
  });

  it("K849-DB-013 止めた人・会社を作った人でも：止めた人は消せる（status は suspended から left）・owner の印の人も消せる（最後の管理者の判定は口の側の K-848）・答えの鍵がそろう", async () => {
    await h.ready();
    const w = await h.world();
    const r = await erase(w, w.stopped);
    expect(Object.keys(r).sort()).toEqual(KEYS);
    expect(
      (await h.one<{ status: string }>("select status from tenant_memberships where member_id = $1", [w.stopped.id]))
        .status,
    ).toBe("left");
    const r2 = await erase(w, w.admin);
    expect(Object.keys(r2).sort()).toEqual(KEYS);
    expect(await live("select count(*) as n from members where id = $1 and deleted_at is not null", w.admin.id)).toBe(
      1,
    );
  });

  it("K849-DB-014 答えの形：鍵はちょうど 6（conversations・credentials・invitations・memories・restorable_until・sessions）・件数は数・メール・名前・id は 1 つも入らない・何も無い人は件数が全部 0", async () => {
    await h.ready();
    const w = await h.world();
    const r = await erase(w, w.member);
    expect(Object.keys(r).sort()).toEqual(KEYS);
    for (const k of KEYS.filter((x) => x !== "restorable_until")) expect(r[k]).toBe(0);
    expect(JSON.stringify(r)).not.toContain(w.member.email);
    expect(JSON.stringify(r)).not.toContain(w.member.id);
    expect(typeof r["restorable_until"]).toBe("string");
  });

  it("K849-DB-015 別のワークスペースの所属は変えない：同じログインの人が 2 つの会社に入っている → 片方で外しても、もう片方の members・所属・セッションはそのまま（アカウントは消えない）", async () => {
    await h.ready();
    const w = await h.world();
    const there = await h.f.alsoIn(w.member, w.other.tenantId, w.other.rootScope);
    await session(there, "web");
    await erase(w, w.member);
    expect(await live("select count(*) as n from members where id = $1 and deleted_at is null", there.id)).toBe(1);
    expect(await alive(there)).toBe(1);
    expect(
      await h.num(
        'select count(*) as n from kaname_auth."user" where id = (select auth_user_id from members where id = $1)',
        [w.member.id],
      ),
    ).toBe(1);
  });

  it("K849-DB-016 ほかの人の物は触らない：鈴木を外す前後で、佐藤の記憶・会話・預けたログイン情報・出した招待・セッションの数が 1 つも変わらない", async () => {
    await h.ready();
    const w = await h.world();
    await mem(w, w.mgr);
    await conv(w, [w.mgr]);
    await cred(w, w.mgr);
    await inv(w, w.mgr, "waiting");
    await session(w.mgr, "bridge");
    const snap = async () => [
      await h.num("select count(*) as n from memories where owner_member_id = $1 and deleted_at is null", [w.mgr.id]),
      await h.num(
        "select count(*) as n from conversations where $1 = any(participant_member_ids) and deleted_at is null",
        [w.mgr.id],
      ),
      await h.num("select count(*) as n from credentials where owner_member_id = $1 and revoked_at is null", [
        w.mgr.id,
      ]),
      await h.num("select count(*) as n from invitations where created_by = $1 and revoked_at is null", [w.mgr.id]),
      await alive(w.mgr),
    ];
    const before = await snap();
    await erase(w, w.member);
    expect(await snap()).toEqual(before);
  });
});
