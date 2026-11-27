// K-815「外す前の下見の口（previewMemberRemoval）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン。土台 admin.harness.ts）。
//   行 ID（K815-API-…）は 11_tickets/K-815.md の表と 1 対 1。入力と答えの形は K-815 の契約（05_flow/screen_api.d/K-815.py）:
//     previewMemberRemoval GET /members/:id/remove-preview → 200 { data: {
//       member: { id, name }, blocked_by: null | "self" | "last_admin",
//       tickets: [{ id, number, title, stage, handing }], handovers_cancelled: [{ id, ticket_id, number, side: "from" | "to" }],
//       approvals_reassigned: [{ ticket_id, number }], sole_approver: [{ scope_id, name }],
//       deleted: [{ key: memories | conversations | credentials | pc | invitations, count }], kept: [{ key }], restorable_until } }
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupAdmin, type J, type P, type World } from "./admin.harness.js";

const h = setupAdmin();
const KEYS = [
  "approvals_reassigned",
  "blocked_by",
  "deleted",
  "handovers_cancelled",
  "kept",
  "member",
  "restorable_until",
  "sole_approver",
  "tickets",
];
const preview = (p: P, id: string) => h.call(p, "GET", `/members/${id}/remove-preview`);
const data = async (r: Response) => (await h.json(r)).data as Record<string, unknown>;
let seq = 0;
async function ticket(
  w: World,
  assignee: P | null,
  o: { scope?: string; done?: boolean; deleted?: boolean; stage?: string } = {},
): Promise<{ id: string; number: string }> {
  const kind = await h.one<{ id: string }>(
    "select id from ticket_kinds where tenant_id = $1 and deleted_at is null limit 1",
    [w.tenantId],
  );
  const stage = await h.one<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = $2", [
    w.tenantId,
    o.stage ?? "doing",
  ]);
  const number = `EG-${(seq += 1)}`;
  const r = await h.one<{ id: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, completed_at, deleted_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
    [
      w.tenantId,
      o.scope ?? w.eg,
      number,
      kind.id,
      stage.id,
      `${number} の仕事`,
      assignee?.id ?? null,
      w.admin.id,
      o.done ? new Date() : null,
      o.deleted ? new Date() : null,
    ],
  );
  return { id: r.id, number };
}
const handover = (
  w: World,
  t: { id: string },
  from: P,
  to: P | null,
  state = "waiting",
  toScope: string | null = null,
) =>
  h.one<{ id: string }>(
    `insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id, to_scope_id, state, decided_at)
     values ($1, $2, 'pass', $3, $4, $5, $6, $7) returning id`,
    [w.tenantId, t.id, from.id, to?.id ?? null, toScope, state, state === "waiting" ? null : new Date()],
  );
const approval = (w: World, t: { id: string }, approver: P, o: { decided?: boolean } = {}) =>
  h.one<{ id: string }>(
    `insert into approvals (tenant_id, scope_id, ticket_id, approver_member_id, decision, decided_at)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [w.tenantId, w.eg, t.id, approver.id, o.decided ? "approve" : null, o.decided ? new Date() : null],
  );
const count = (d: Record<string, unknown>, key: string) =>
  (d["deleted"] as { key: string; count: number }[]).find((x) => x.key === key)?.count;
const before = (w: World) =>
  h.num(
    "select (select count(*) from audit_events where tenant_id = $1) + (select count(*) from notifications where tenant_id = $1) + (select count(*) from members where tenant_id = $1 and deleted_at is not null) as n",
    [w.tenantId],
  );

describe("K-815 外す前の下見（previewMemberRemoval）", () => {
  it("K815-API-001 担当している 3 件（進行中 2・渡し中 1）：200・no-store・鍵がちょうど 9・member は id と名前だけ・tickets は番号順で { id, number, title, stage, handing }・渡し中の 1 件だけ handing true・blocked_by は null", async () => {
    await h.ready();
    const w = await h.world();
    const a = await ticket(w, w.member);
    const b = await ticket(w, w.member);
    const c = await ticket(w, w.member);
    await handover(w, c, w.member, w.mgr);
    const r = await preview(w.admin, w.member.id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = await data(r);
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d["member"]).toEqual({ id: w.member.id, name: "鈴木 一郎" });
    expect(d["blocked_by"]).toBeNull();
    expect((d["tickets"] as Record<string, unknown>[]).map((x) => x.number)).toEqual([a.number, b.number, c.number]);
    expect(Object.keys(d["tickets"][0]).sort()).toEqual(["handing", "id", "number", "stage", "title"]);
    expect((d["tickets"] as Record<string, unknown>[]).map((x) => x.handing)).toEqual([false, false, true]);
    expect(d["tickets"][0].stage).toBe("進行中");
  });

  it("K815-API-002 担当 0 件：200・tickets・handovers_cancelled・approvals_reassigned は空・deleted と kept は出る", async () => {
    await h.ready();
    const w = await h.world();
    const d = await data(await preview(w.admin, w.member.id));
    expect([d["tickets"], d["handovers_cancelled"], d["approvals_reassigned"]]).toEqual([[], [], []]);
    expect((d["deleted"] as Record<string, unknown>[]).length).toBe(5);
    expect((d["kept"] as Record<string, unknown>[]).length).toBe(4);
  });

  it("K815-API-003 数えない担当：完了したチケット・消したチケット・担当の無いチケット・ほかの人のチケット → tickets に出ない", async () => {
    await h.ready();
    const w = await h.world();
    const mine = await ticket(w, w.member);
    await ticket(w, w.member, { done: true });
    await ticket(w, w.member, { deleted: true });
    await ticket(w, null);
    await ticket(w, w.mgr);
    const d = await data(await preview(w.admin, w.member.id));
    expect((d["tickets"] as Record<string, unknown>[]).map((x) => x.number)).toEqual([mine.number]);
  });

  it("K815-API-004 渡し中の整理：鈴木が渡した 1（相手は佐藤）・鈴木が受ける側の 1（渡したのは管理者）・鈴木がグループに配った 1（to_scope）→ handovers_cancelled は 3 つで side は from・to・from・番号つき", async () => {
    await h.ready();
    const w = await h.world();
    const t1 = await ticket(w, w.member);
    const t2 = await ticket(w, w.admin);
    const t3 = await ticket(w, w.member);
    const h1 = await handover(w, t1, w.member, w.mgr);
    const h2 = await handover(w, t2, w.admin, w.member);
    const h3 = await handover(w, t3, w.member, null, "waiting", w.jd);
    const d = await data(await preview(w.admin, w.member.id));
    const list = d["handovers_cancelled"] as { id: string; ticket_id: string; number: string; side: string }[];
    expect(list.map((x) => [x.id, x.side]).sort()).toEqual(
      [
        [h1.id, "from"],
        [h2.id, "to"],
        [h3.id, "from"],
      ].sort(),
    );
    expect(list.find((x) => x.id === h2.id)!.number).toBe(t2.number);
  });

  it("K815-API-005 決まった渡し・取り消し済みの渡し・ほかの人どうしの渡し → handovers_cancelled に出ない", async () => {
    await h.ready();
    const w = await h.world();
    const t = await ticket(w, w.member);
    await handover(w, t, w.member, w.mgr, "accepted");
    await handover(w, t, w.member, w.mgr, "withdrawn");
    await handover(w, t, w.admin, w.mgr);
    const d = await data(await preview(w.admin, w.member.id));
    expect(d["handovers_cancelled"]).toEqual([]);
  });

  it("K815-API-006 承認は担当者に従う（D-150.21）：鈴木が担当するチケットの承認待ち 2・決まった承認 1 → approvals_reassigned は承認待ちの 2 つ（番号つき）・決まった承認は出ない", async () => {
    await h.ready();
    const w = await h.world();
    const a = await ticket(w, w.member);
    const b = await ticket(w, w.member);
    await approval(w, a, w.member);
    await approval(w, b, w.member);
    await approval(w, b, w.member, { decided: true });
    const d = await data(await preview(w.admin, w.member.id));
    expect((d["approvals_reassigned"] as Record<string, unknown>[]).map((x) => x.number).sort()).toEqual(
      [a.number, b.number].sort(),
    );
  });

  it("K815-API-007 マネージャーが本人 1 人のグループ：佐藤は営業のマネージャーが 1 人 → 営業が sole_approver に出る・マネージャーが 2 人のグループは出ない・兼務（受託開発のマネージャーを兼ねる）で 2 つの層に出る", async () => {
    await h.ready();
    const w = await h.world();
    await h.rows(
      "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $2, $3, false, 'manager')",
      [w.tenantId, w.jd, w.mgr.id],
    );
    let d = await data(await preview(w.admin, w.mgr.id));
    expect((d["sole_approver"] as Record<string, unknown>[]).map((x) => x.scope_id).sort()).toEqual(
      [w.eg, w.jd].sort(),
    );
    expect((d["sole_approver"] as Record<string, unknown>[])[0]).toHaveProperty("name");
    const second = await h.make(w, "sato2", "二人目のマネージャー", {
      scope: w.jd,
      role: "manager",
      groupRole: "manager",
    });
    expect(second.id).toBeTruthy();
    d = await data(await preview(w.admin, w.mgr.id));
    expect((d["sole_approver"] as Record<string, unknown>[]).map((x) => x.scope_id)).toEqual([w.eg]);
  });

  it("K815-API-008 すぐ消える物の数：個人の記憶 2・個人の会話 1・預けたログイン情報 1・PC の接続 1・出した待っている招待 1 → deleted は 5 つ（memories・conversations・credentials・pc・invitations の順）で数が合う・勧めた記憶・ほかの人が入る会話・失効済みは数えない", async () => {
    await h.ready();
    const w = await h.world();
    const base = [w.tenantId, w.eg, w.member.id];
    for (let i = 0; i < 2; i++)
      await h.rows(
        "insert into memories (tenant_id, scope_id, owner_member_id, title, body, visibility) values ($1, $2, $3, 'm', 'b', 'self')",
        base,
      );
    await h.rows(
      "insert into memories (tenant_id, scope_id, owner_member_id, title, body, visibility) values ($1, $2, $3, 'm', 'b', 'recommended')",
      base,
    );
    await h.rows(
      "insert into conversations (tenant_id, scope_id, title, participant_member_ids) values ($1, $2, 'c', $3)",
      [w.tenantId, w.eg, [w.member.id]],
    );
    await h.rows(
      "insert into conversations (tenant_id, scope_id, title, participant_member_ids) values ($1, $2, 'c', $3)",
      [w.tenantId, w.eg, [w.member.id, w.mgr.id]],
    );
    await h.rows(
      "insert into credentials (tenant_id, scope_id, owner_member_id, vault_ref) values ($1, $2, $3, 'v')",
      base,
    );
    await h.rows(
      "insert into credentials (tenant_id, scope_id, owner_member_id, vault_ref, revoked_at) values ($1, $2, $3, 'v', now())",
      base,
    );
    await h.rows(
      "insert into sessions (tenant_id, member_id, kind_id, auth_session_id) values ($1, $2, 'bridge', $3)",
      [w.tenantId, w.member.id, randomUUID()],
    );
    await h.rows("insert into sessions (tenant_id, member_id, kind_id, auth_session_id) values ($1, $2, 'web', $3)", [
      w.tenantId,
      w.member.id,
      randomUUID(),
    ]);
    await h.rows(
      "insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, created_by) values ($1, $2, $3, 'member', $4, now() + interval '7 days', $5)",
      [
        w.tenantId,
        `k815-${randomUUID().slice(0, 8)}@engine-base.example`,
        w.eg,
        randomUUID().replaceAll("-", ""),
        w.member.id,
      ],
    );
    const d = await data(await preview(w.admin, w.member.id));
    expect((d["deleted"] as Record<string, unknown>[]).map((x) => x.key)).toEqual([
      "memories",
      "conversations",
      "credentials",
      "pc",
      "invitations",
    ]);
    expect(["memories", "conversations", "credentials", "pc", "invitations"].map((k) => count(d, k))).toEqual([
      2, 1, 1, 1, 1,
    ]);
  });

  it("K815-API-009 残る物と戻せる期限：kept は messages・decisions・artifacts・group_memories の 4 つ・restorable_until は呼んだ時刻の 30 日後（1 分の誤差・ISO 8601）", async () => {
    await h.ready();
    const w = await h.world();
    const t0 = Date.now();
    const d = await data(await preview(w.admin, w.member.id));
    expect((d["kept"] as Record<string, unknown>[]).map((x) => x.key)).toEqual([
      "messages",
      "decisions",
      "artifacts",
      "group_memories",
    ]);
    expect(Math.abs(new Date(d["restorable_until"]).getTime() - (t0 + 30 * 86_400_000))).toBeLessThan(60_000);
  });

  it("K815-API-010 自分と最後の管理者は断らず理由を返す：管理者が自分を開く → 200・blocked_by self／権限を個別に付けた人が会社のただ 1 人の管理者を開く → 200・blocked_by last_admin／管理者が 2 人いる管理者 → blocked_by null", async () => {
    await h.ready();
    const w = await h.world();
    expect((await data(await preview(w.admin, w.admin.id)))["blocked_by"]).toBe("self");
    expect((await data(await preview(w.admin, w.admin2.id)))["blocked_by"]).toBeNull();
    await h.rows("update tenant_memberships set role = 'member' where member_id = $1", [w.admin2.id]);
    await h.rows(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'edit')",
      [w.tenantId, w.member.id],
    );
    expect((await data(await preview(w.member, w.admin.id)))["blocked_by"]).toBe("last_admin");
  });

  it("K815-API-011 止めた人も下見できる：止めた人 → 200・member の名前が出る・止めた管理者は最後の管理者の数に入らない", async () => {
    await h.ready();
    const w = await h.world();
    const d = await data(await preview(w.admin, w.stopped.id));
    expect(d["member"]).toEqual({ id: w.stopped.id, name: "止めた人" });
    await h.rows("update tenant_memberships set status = 'suspended' where member_id = $1", [w.admin2.id]);
    await h.rows(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'edit')",
      [w.tenantId, w.member.id],
    );
    expect((await data(await preview(w.member, w.admin.id)))["blocked_by"]).toBe("last_admin");
  });

  it("K815-API-012 兼務（D-154.15）：営業の主・受託開発を兼ねてマネージャーの人が担当 2 件（営業・受託開発のグループ 1 件ずつ）→ tickets は 2 件とも出る・グループの違いで落ちない", async () => {
    await h.ready();
    const w = await h.world();
    await h.rows(
      "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $2, $3, false, 'manager')",
      [w.tenantId, w.jd, w.member.id],
    );
    const a = await ticket(w, w.member);
    const b = await ticket(w, w.member, { scope: w.jd });
    const d = await data(await preview(w.admin, w.member.id));
    expect((d["tickets"] as Record<string, unknown>[]).map((x) => x.number)).toEqual([a.number, b.number]);
  });

  it("K815-API-013 権限：マネージャー・メンバー・閲覧のみ・止めた人 → 403・data なし／ログインしていない → 401／権限を個別に付けたメンバー（members の edit）→ 200", async () => {
    await h.ready();
    const w = await h.world();
    for (const p of [w.mgr, w.member, w.viewer, w.stopped]) {
      const r = await preview(p, w.member.id);
      expect(r.status).toBe(403);
      expect(((await h.json(r)) as J).data).toBeUndefined();
    }
    const anon = await h.call(w.admin, "GET", `/members/${w.member.id}/remove-preview`, {
      headers: { authorization: "" },
    });
    expect(anon.status).toBe(401);
    await h.rows(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'edit')",
      [w.tenantId, w.member.id],
    );
    expect((await preview(w.member, w.viewer.id)).status).toBe(200);
  });

  it("K815-API-014 見えない人は 404（欄・details を付けない・在るかを漏らさない）：別の会社の人・在らない uuid・もう外した人・招待中の人・AI", async () => {
    await h.ready();
    const w = await h.world();
    const gone = await h.make(w, "gone", "外した人", { status: "left" });
    const invited = await h.make(w, "invited", "招待中の人", { status: "invited" });
    for (const id of [w.outsider.id, randomUUID(), gone.id, invited.id]) {
      const r = await preview(w.admin, id);
      expect(r.status, id).toBe(404);
      const j = await h.json(r);
      expect(j.code).toBe("E-MEM-002");
      expect([j.field, j.details, j.detail]).toEqual([undefined, undefined, undefined]);
    }
  });

  it("K815-API-015 別の会社の管理者は、この会社の人を開けない：404・この会社の担当の数も漏れない", async () => {
    await h.ready();
    const w = await h.world();
    await ticket(w, w.member);
    const r = await preview(w.outsider, w.member.id);
    expect(r.status).toBe(404);
    expect(JSON.stringify(await h.json(r))).not.toContain("EG-");
  });

  it("K815-API-016 読むだけ：下見を 3 回 → 証跡・受け箱・members の状態・渡しの state は 1 つも変わらない（前後で同じ）・同じ答え", async () => {
    await h.ready();
    const w = await h.world();
    const t = await ticket(w, w.member);
    const ho = await handover(w, t, w.member, w.mgr);
    const n0 = await before(w);
    const first = await data(await preview(w.admin, w.member.id));
    for (let i = 0; i < 2; i++)
      expect(await data(await preview(w.admin, w.member.id))).toEqual({
        ...first,
        restorable_until: expect.any(String),
      });
    expect(await before(w)).toBe(n0);
    expect((await h.one<{ state: string }>("select state from ticket_handovers where id = $1", [ho.id])).state).toBe(
      "waiting",
    );
  });

  it("K815-API-017 入力の形：道の値が uuid でない → 422（K-800 の k144 が受ける）／下見は体も問い合わせも受けない：知らない問い合わせ ?x=1 → 422", async () => {
    await h.ready();
    const w = await h.world();
    expect((await h.call(w.admin, "GET", "/members/not-a-uuid/remove-preview")).status).toBe(422);
    expect((await h.call(w.admin, "GET", `/members/${w.member.id}/remove-preview?x=1`)).status).toBe(422);
  });

  it("K815-API-018 失敗：読む関数が DB の例外 → 503・E-PAGE-003・中身は返さない（人の名前・番号が答えに出ない）", async () => {
    await h.ready();
    const w = await h.world();
    await ticket(w, w.member);
    // 読む関数の途中で必ず例外：渡しの表の名前を一時的に変えて読めなくする（この試験の間だけ・finally で戻す）
    await h.rows("alter table ticket_handovers rename to ticket_handovers_k815");
    try {
      const r = await preview(w.admin, w.member.id);
      expect(r.status).toBe(503);
      const j = await h.json(r);
      expect(j.code).toBe("E-PAGE-003");
      expect(JSON.stringify(j)).not.toContain("鈴木");
    } finally {
      await h.rows("alter table ticket_handovers_k815 rename to ticket_handovers");
    }
  });

  it("K815-API-019 上の言葉の読みを会社が変えても答えは変わらない：stage の名前を「作業中」に直した会社 → tickets の stage が「作業中」（番号と名前を段の表から読む）", async () => {
    await h.ready();
    const w = await h.world();
    await ticket(w, w.member);
    await h.rows("update ticket_stages set name = '作業中' where tenant_id = $1 and key = 'doing'", [w.tenantId]);
    const d = await data(await preview(w.admin, w.member.id));
    expect(d["tickets"][0].stage).toBe("作業中");
  });

  it("K815-API-020 大量：担当 120 件でも 200・全部出る・番号順（ページを持たない口・1 人の担当は多くても数百）", async () => {
    await h.ready();
    const w = await h.world();
    for (let i = 0; i < 120; i++) await ticket(w, w.member);
    const d = await data(await preview(w.admin, w.member.id));
    expect((d["tickets"] as Record<string, unknown>[]).length).toBe(120);
  });
});
