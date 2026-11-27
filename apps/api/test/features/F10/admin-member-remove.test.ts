// K-848「外す口（removeMember）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン。土台 admin.harness.ts）。
//   行 ID（K848-API-…）は 11_tickets/K-848.md の表と 1 対 1。入力と答えの形は K-800 の契約（K-800 の土台の名前）：
//     removeMember POST /members/:id/remove ← { transfer_to_member_id?: uuid, transfers?: [{ ticket_id, to_member_id }]（〜500） }
//       → 200 { data: { member_id, tickets_moved, handovers_cancelled, restorable_until } }（鍵はちょうど 4）
//     断る番号：404 E-MEM-002（相手が居ない）・409 E-MEM-004（最後の管理者）・409 E-MEM-005（自分）・
//               409 E-MEM-020（引き継ぎ先が決まっていない・下見のあとで担当が変わった）・404 E-MEM-021（引き継ぎ先が居ない）・
//               409 E-MEM-022（引き継ぎ先が止まっている・外す本人・detail { 名前, 訳 }）・409 E-MEM-023（引き継ぎ先が閲覧のみ・依頼する側・detail { 名前 }）
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupAdmin, type J, type P, type World } from "./admin.harness.js";

const h = setupAdmin();
const KEYS = ["handovers_cancelled", "member_id", "restorable_until", "tickets_moved"];
const remove = (p: P, id: string, body: Record<string, unknown> = {}, o: { su?: number; key?: string } = {}) =>
  h.call(p, "POST", `/members/${id}/remove`, { body, su: o.su ?? h.suNow(), ...(o.key ? { key: o.key } : {}) });
let seq = 0;
async function ticket(w: World, assignee: P | null, o: { done?: boolean; deleted?: boolean; scope?: string } = {}) {
  const kind = await h.one<{ id: string }>(
    "select id from ticket_kinds where tenant_id = $1 and deleted_at is null limit 1",
    [w.tenantId],
  );
  const stage = await h.one<{ id: string }>("select id from ticket_stages where tenant_id = $1 and key = 'doing'", [
    w.tenantId,
  ]);
  const number = `EG-${(seq += 1)}`;
  const r = await h.one<{ id: string }>(
    `insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by, completed_at, deleted_at, delegated_to_clone)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
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
      !!assignee && !o.done,
    ],
  );
  return { id: r.id, number };
}
const handover = (w: World, t: { id: string }, from: P, to: P, state = "waiting") =>
  h.one<{ id: string }>(
    "insert into ticket_handovers (tenant_id, ticket_id, kind, from_member_id, to_member_id, state, decided_at) values ($1, $2, 'pass', $3, $4, $5, $6) returning id",
    [w.tenantId, t.id, from.id, to.id, state, state === "waiting" ? null : new Date()],
  );
const owner = (id: string) =>
  h.one<{ a: string | null; c: boolean }>(
    "select assignee_member_id as a, delegated_to_clone as c from tickets where id = $1",
    [id],
  );
const grantEdit = (w: World, p: P) =>
  h.rows(
    "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'members', null, 'edit')",
    [w.tenantId, p.id],
  );
const state = async (w: World, p: P) =>
  JSON.stringify([
    (await h.one<{ s: string }>("select status as s from tenant_memberships where member_id = $1", [p.id])).s,
    await h.num("select count(*) as n from members where id = $1 and deleted_at is not null", [p.id]),
    await h.num("select count(*) as n from tickets where assignee_member_id = $1", [p.id]),
    await h.num("select count(*) as n from ticket_handovers where tenant_id = $1 and state = 'waiting'", [w.tenantId]),
    await h.num("select count(*) as n from sessions where member_id = $1 and revoked_at is null", [p.id]),
    await h.audits(w.tenantId, "member.remove"),
    await h.num("select count(*) as n from notifications where tenant_id = $1 and event_kind_id like 'member.%'", [
      w.tenantId,
    ]),
  ]);
const session = (p: P, kind: "web" | "bridge" = "web") =>
  h.rows("insert into sessions (tenant_id, member_id, kind_id, auth_session_id) values ($1, $2, $3, $4)", [
    p.tenantId,
    p.id,
    kind,
    randomUUID(),
  ]);

describe("K-848 外す口（removeMember）", () => {
  it("K848-API-001 全部同じ人に：鈴木の担当 3 件（完了 1・消した 1 は別）→ 200・鍵がちょうど 4・tickets_moved 3・担当は佐藤に・完了と消したチケットの担当は鈴木のまま・分身に任せた印は下りる・鈴木は deleted_at と status left・restorable_until は 30 日後", async () => {
    await h.ready();
    const w = await h.world();
    const t = [await ticket(w, w.member), await ticket(w, w.member), await ticket(w, w.member)];
    const done = await ticket(w, w.member, { done: true });
    const del = await ticket(w, w.member, { deleted: true });
    const r = await remove(w.admin, w.member.id, { transfer_to_member_id: w.mgr.id });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toContain("no-store");
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(KEYS);
    expect(d).toMatchObject({ member_id: w.member.id, tickets_moved: 3, handovers_cancelled: 0 });
    expect(Math.abs(new Date(String(d["restorable_until"])).getTime() - (Date.now() + 30 * 86_400_000))).toBeLessThan(
      60_000,
    );
    for (const x of t) expect(await owner(x.id)).toEqual({ a: w.mgr.id, c: false });
    expect((await owner(done.id)).a).toBe(w.member.id);
    expect((await owner(del.id)).a).toBe(w.member.id);
    expect(
      (await h.one<{ s: string }>("select status as s from tenant_memberships where member_id = $1", [w.member.id])).s,
    ).toBe("left");
    expect(
      await h.num("select count(*) as n from members where id = $1 and deleted_at is not null", [w.member.id]),
    ).toBe(1);
  });

  it("K848-API-002 1 件ずつ：担当 3 件を 佐藤・2 人目の管理者・受託開発の別の部署のメンバー（別のグループの作業員）に分ける → それぞれの担当に移る・tickets_moved 3", async () => {
    await h.ready();
    const w = await h.world();
    const jdMember = await h.make(w, "jdm", "受託開発の作業員", { scope: w.jd, groupRole: "member" });
    const t = [await ticket(w, w.member), await ticket(w, w.member), await ticket(w, w.member)];
    const to = [w.mgr, w.admin2, jdMember];
    const r = await remove(w.admin, w.member.id, {
      transfers: t.map((x, i) => ({ ticket_id: x.id, to_member_id: to[i]!.id })),
    });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.json(r)).data?.["tickets_moved"]).toBe(3);
    for (let i = 0; i < 3; i++) expect((await owner(t[i]!.id)).a).toBe(to[i]!.id);
  });

  it("K848-API-003 担当 0 件：引き継ぎ先を付けずに外す → 200・tickets_moved 0・handovers_cancelled 0／引き継ぎ先を付けても（居る人なら）200・何も動かない", async () => {
    await h.ready();
    const w = await h.world();
    const r = await remove(w.admin, w.member.id);
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.json(r)).data).toMatchObject({ tickets_moved: 0, handovers_cancelled: 0 });
    const w2 = await h.world();
    expect((await remove(w2.admin, w2.member.id, { transfer_to_member_id: w2.mgr.id })).status).toBe(200);
  });

  it("K848-API-004 引き継ぎ先が決まっていない：担当 2 件があるのに 体が空・transfers が空・transfers が 1 件だけ → 409・E-MEM-020・欄と details を付けない・何も変わらない（鈴木は有効のまま・担当・セッション・証跡・受け箱）", async () => {
    await h.ready();
    const w = await h.world();
    const a = await ticket(w, w.member);
    await ticket(w, w.member);
    await session(w.member);
    const s0 = await state(w, w.member);
    for (const body of [{}, { transfers: [] }, { transfers: [{ ticket_id: a.id, to_member_id: w.mgr.id }] }]) {
      const r = await remove(w.admin, w.member.id, body);
      expect(r.status, JSON.stringify(body)).toBe(409);
      const j = await h.json(r);
      expect(j.code).toBe("E-MEM-020");
      expect([j.field, j.details]).toEqual([undefined, undefined]);
    }
    expect(await state(w, w.member)).toBe(s0);
  });

  it("K848-API-005 下見のあとで担当が変わった：下見のとき 2 件 → 外す前に 1 件増えた／1 件減った（別の人に渡った）→ どちらも 409・E-MEM-020・何も動かない（画面は下見を読み直す）", async () => {
    await h.ready();
    const w = await h.world();
    const a = await ticket(w, w.member);
    const b = await ticket(w, w.member);
    const list = [a, b].map((x) => ({ ticket_id: x.id, to_member_id: w.mgr.id }));
    await ticket(w, w.member);
    expect((await remove(w.admin, w.member.id, { transfers: list })).status).toBe(409);
    await h.rows("delete from tickets where assignee_member_id = $1 and id not in ($2, $3)", [w.member.id, a.id, b.id]);
    await h.rows("update tickets set assignee_member_id = $1 where id = $2", [w.admin2.id, b.id]);
    const r = await remove(w.admin, w.member.id, { transfers: list });
    expect(r.status).toBe(409);
    expect((await h.json(r)).code).toBe("E-MEM-020");
    expect((await owner(a.id)).a).toBe(w.member.id);
  });

  it("K848-API-006 引き継ぎ先が居ない：別の会社の人・在らない uuid・もう外した人・招待中の人 → 404・E-MEM-021・欄と details を付けない・何も動かない", async () => {
    await h.ready();
    const w = await h.world();
    await ticket(w, w.member);
    const gone = await h.make(w, "gone", "外した人", { status: "left" });
    const invited = await h.make(w, "inv", "招待中の人", { status: "invited" });
    const s0 = await state(w, w.member);
    for (const id of [w.outsider.id, randomUUID(), gone.id, invited.id]) {
      const r = await remove(w.admin, w.member.id, { transfer_to_member_id: id });
      expect(r.status, id).toBe(404);
      const j = await h.json(r);
      expect(j.code).toBe("E-MEM-021");
      expect([j.field, j.details, j.detail]).toEqual([undefined, undefined, undefined]);
    }
    expect(await state(w, w.member)).toBe(s0);
  });

  it("K848-API-007 引き継ぎ先にできない人：止めた人・外す本人 → 409・E-MEM-022・detail の 名前と訳（「止まっています」）／閲覧のみ・依頼する側 → 409・E-MEM-023・detail の 名前。1 件ずつの中の 1 件がそうでも全部断る（全部か無しか）", async () => {
    await h.ready();
    const w = await h.world();
    const a = await ticket(w, w.member);
    const b = await ticket(w, w.member);
    const req = await h.make(w, "req", "先方の人", { role: "requester" });
    const cases: [P, string, Record<string, unknown>][] = [
      [w.stopped, "E-MEM-022", { 名前: "止めた人", 訳: "止まっています" }],
      [w.member, "E-MEM-022", { 名前: "鈴木 一郎" }],
      [w.viewer, "E-MEM-023", { 名前: "山口 健" }],
      [req, "E-MEM-023", { 名前: "先方の人" }],
    ];
    for (const [p, code, detail] of cases) {
      const r = await remove(w.admin, w.member.id, { transfer_to_member_id: p.id });
      expect(r.status, code).toBe(409);
      const j = await h.json(r);
      expect(j.code).toBe(code);
      expect(j.detail).toMatchObject(detail);
      expect(j.field).toBeUndefined();
    }
    const r2 = await remove(w.admin, w.member.id, {
      transfers: [
        { ticket_id: a.id, to_member_id: w.mgr.id },
        { ticket_id: b.id, to_member_id: w.viewer.id },
      ],
    });
    expect(r2.status).toBe(409);
    expect((await owner(a.id)).a).toBe(w.member.id);
  });

  it("K848-API-008 渡し中を取り消す（D-154.6）：鈴木が渡した待っている 1・鈴木が受ける側の待っている 1・決まった（accepted）1 → 待っている 2 つが withdrawn（decided_at が入る）・決まった渡しは触らない・handovers_cancelled 2・相手（佐藤・渡した管理者）の受け箱に取り消しの行（payload の cause member_removed）", async () => {
    await h.ready();
    const w = await h.world();
    const t1 = await ticket(w, w.member);
    const t2 = await ticket(w, w.admin2);
    const t3 = await ticket(w, w.member);
    const h1 = await handover(w, t1, w.member, w.mgr);
    const h2 = await handover(w, t2, w.admin2, w.member);
    const h3 = await handover(w, t3, w.member, w.mgr, "accepted");
    const r = await remove(w.admin, w.member.id, { transfer_to_member_id: w.mgr.id });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await h.json(r)).data?.["handovers_cancelled"]).toBe(2);
    const st = (id: string) =>
      h.one<{ state: string; decided_at: Date | null }>(
        "select state, decided_at from ticket_handovers where id = $1",
        [id],
      );
    expect([(await st(h1.id)).state, (await st(h2.id)).state, (await st(h3.id)).state]).toEqual([
      "withdrawn",
      "withdrawn",
      "accepted",
    ]);
    expect((await st(h1.id)).decided_at).not.toBeNull();
    for (const [p, id] of [
      [w.mgr, h1.id],
      [w.admin2, h2.id],
    ] as const) {
      const n = await h.rows<{ payload: Record<string, unknown> }>(
        "select payload from notifications where member_id = $1 and event_kind_id like 'handover.%' and payload->>'handover_id' = $2",
        [p.id, id],
      );
      expect(n.length, p.name).toBe(1);
      expect(n[0]!.payload["cause"]).toBe("member_removed");
    }
  });

  it("K848-API-009 承認は担当者に従う（D-150.21）：鈴木の担当チケットに承認待ち 1 → 外した後、引き継ぎ先（佐藤）の承認待ちの並びにそのチケットが出る・鈴木の担当は無い", async () => {
    await h.ready();
    const w = await h.world();
    const t = await ticket(w, w.member);
    await h.rows("insert into approvals (tenant_id, scope_id, ticket_id, approver_member_id) values ($1, $2, $3, $4)", [
      w.tenantId,
      w.eg,
      t.id,
      w.member.id,
    ]);
    expect((await remove(w.admin, w.member.id, { transfer_to_member_id: w.mgr.id })).status).toBe(200);
    const q = await h.call(w.mgr, "GET", "/approvals/queue");
    expect(q.status).toBe(200);
    expect(JSON.stringify(await h.json(q))).toContain(t.number);
  });

  it("K848-API-010 すぐ消える物（D-128.96）：鈴木の個人の記憶・預けたログイン情報・出した待っている招待・画面と PC のセッション → 記憶と預けたログイン情報は消え・招待は取り消され・セッションは全部切れる（理由 member_left）・佐藤の物は残る", async () => {
    await h.ready();
    const w = await h.world();
    await h.rows(
      "insert into memories (tenant_id, scope_id, owner_member_id, title, body, visibility) values ($1, $2, $3, 'm', 'b', 'self'), ($1, $2, $4, 'm', 'b', 'self')",
      [w.tenantId, w.eg, w.member.id, w.mgr.id],
    );
    await h.rows("insert into credentials (tenant_id, scope_id, owner_member_id, vault_ref) values ($1, $2, $3, 'v')", [
      w.tenantId,
      w.eg,
      w.member.id,
    ]);
    await h.rows(
      "insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, created_by) values ($1, $2, $3, 'member', $4, now() + interval '7 days', $5)",
      [
        w.tenantId,
        `k848-${randomUUID().slice(0, 8)}@engine-base.example`,
        w.eg,
        randomUUID().replaceAll("-", ""),
        w.member.id,
      ],
    );
    await session(w.member);
    await session(w.member, "bridge");
    await session(w.mgr);
    expect((await remove(w.admin, w.member.id)).status).toBe(200);
    expect(
      await h.num("select count(*) as n from memories where owner_member_id = $1 and deleted_at is null", [
        w.member.id,
      ]),
    ).toBe(0);
    expect(
      await h.num("select count(*) as n from memories where owner_member_id = $1 and deleted_at is null", [w.mgr.id]),
    ).toBe(1);
    expect(
      await h.num("select count(*) as n from credentials where owner_member_id = $1 and revoked_at is null", [
        w.member.id,
      ]),
    ).toBe(0);
    expect(
      await h.num("select count(*) as n from invitations where created_by = $1 and revoked_at is null", [w.member.id]),
    ).toBe(0);
    expect(
      await h.num("select count(*) as n from sessions where member_id = $1 and revoked_at is null", [w.member.id]),
    ).toBe(0);
    expect(
      await h.num("select count(*) as n from sessions where member_id = $1 and revoke_reason_id = 'member_left'", [
        w.member.id,
      ]),
    ).toBe(2);
    expect(
      await h.num("select count(*) as n from sessions where member_id = $1 and revoked_at is null", [w.mgr.id]),
    ).toBe(1);
  });

  it("K848-API-011 外した直後に入れない（G-12・G-14）：外した直後の鈴木の次の操作（メンバーの並びを読む）→ 403・管理者のメンバーの並びから鈴木が消える（件数が 1 減る）・同じ宛てへ招き直せる（もう入っている人の 409 にならない）", async () => {
    await h.ready();
    const w = await h.world();
    const count0 = ((await h.json(await h.call(w.admin, "GET", "/workspace/members"))).data as { count: number }).count;
    expect((await remove(w.admin, w.member.id)).status).toBe(200);
    expect((await h.call(w.member, "GET", "/workspace/members")).status).toBe(403);
    const after = (await h.json(await h.call(w.admin, "GET", "/workspace/members"))).data as {
      count: number;
      groups: { members: { id: string }[] }[];
    };
    expect(after.count).toBe(count0 - 1);
    expect(JSON.stringify(after.groups)).not.toContain(w.member.id);
    const again = await h.call(w.admin, "POST", "/invitations", {
      body: { emails: [w.member.email], scope_id: w.eg, role_key: "member" },
    });
    expect(again.status, await again.clone().text()).toBe(201);
  });

  it("K848-API-012 引き継ぎ先に知らせる（D-154.6）：全部同じ人 → その人の受け箱に 1 行（種類 member.tickets_received・payload に 外した人の名前・件数・番号の並び）・1 件ずつで 2 人に分ける → 2 人にそれぞれ 1 行・外した本人には出ない・メールは出ない", async () => {
    await h.ready();
    const w = await h.world();
    const t = [await ticket(w, w.member), await ticket(w, w.member)];
    expect((await remove(w.admin, w.member.id, { transfer_to_member_id: w.mgr.id })).status).toBe(200);
    const n = await h.notes(w.mgr.id, "member.tickets_received");
    expect(n).toHaveLength(1);
    expect(n[0]!["payload"]).toMatchObject({ from_name: "鈴木 一郎", count: 2 });
    expect((n[0]!["payload"] as { numbers: string[] }).numbers.sort()).toEqual(t.map((x) => x.number).sort());
    expect(await h.notes(w.member.id, "member.tickets_received")).toHaveLength(0);
    expect(h.mails).toHaveLength(0);
    const w2 = await h.world();
    const u = [await ticket(w2, w2.member), await ticket(w2, w2.member)];
    await remove(w2.admin, w2.member.id, {
      transfers: [
        { ticket_id: u[0]!.id, to_member_id: w2.mgr.id },
        { ticket_id: u[1]!.id, to_member_id: w2.admin2.id },
      ],
    });
    expect(await h.notes(w2.mgr.id, "member.tickets_received")).toHaveLength(1);
    expect(await h.notes(w2.admin2.id, "member.tickets_received")).toHaveLength(1);
  });

  it("K848-API-013 記録に残る（D-154.25）：外すと証跡 member.remove が 1 行（対象は members の鈴木・payload は tickets_moved・handovers_cancelled・heirs の id の並びだけ）・メール・名前・理由の字は入らない・消せない直せない", async () => {
    await h.ready();
    const w = await h.world();
    await ticket(w, w.member);
    expect((await remove(w.admin, w.member.id, { transfer_to_member_id: w.mgr.id })).status).toBe(200);
    expect(await h.audits(w.tenantId, "member.remove")).toBe(1);
    const a = await h.one<{
      target_type: string;
      target_id: string;
      actor_member_id: string;
      payload: Record<string, unknown>;
    }>(
      "select target_type, target_id, actor_member_id, payload from audit_events where tenant_id = $1 and action = 'member.remove'",
      [w.tenantId],
    );
    expect(a.target_type).toBe("members");
    expect(a.target_id).toBe(w.member.id);
    expect(a.actor_member_id).toBe(w.admin.id);
    expect(a.payload).toEqual({ tickets_moved: 1, handovers_cancelled: 0, heirs: [w.mgr.id] });
    await expect(h.rows("update audit_events set action = 'x' where tenant_id = $1", [w.tenantId])).rejects.toThrow();
  });

  it("K848-API-014 最後の管理者（D-154.19）：会社のただ 1 人の管理者（2 人目は止めている）を、権限を個別に付けた人が外す → 409・E-MEM-004・欄と details なし・何も変わらない／管理者が 2 人なら外せる", async () => {
    await h.ready();
    const w = await h.world();
    await h.rows("update tenant_memberships set status = 'suspended' where member_id = $1", [w.admin2.id]);
    await grantEdit(w, w.member);
    const s0 = await state(w, w.admin);
    const r = await remove(w.member, w.admin.id);
    expect(r.status).toBe(409);
    const j = await h.json(r);
    expect([j.code, j.field, j.details]).toEqual(["E-MEM-004", undefined, undefined]);
    expect(await state(w, w.admin)).toBe(s0);
    const w2 = await h.world();
    expect((await remove(w2.admin, w2.admin2.id)).status).toBe(200);
  });

  it("K848-API-015 自分は外せない：管理者が自分を外す → 409・E-MEM-005・何も変わらない（最後の管理者でも自分の番号が先）", async () => {
    await h.ready();
    const w = await h.world();
    const s0 = await state(w, w.admin);
    for (const body of [{}, { transfer_to_member_id: w.mgr.id }]) {
      const r = await remove(w.admin, w.admin.id, body);
      expect(r.status).toBe(409);
      expect((await h.json(r)).code).toBe("E-MEM-005");
    }
    expect(await state(w, w.admin)).toBe(s0);
  });

  it("K848-API-016 相手が居ない：別の会社の人・在らない uuid・もう外した人・招待中の人 → 404・E-MEM-002・欄と details なし／止めた人は外せる（200）", async () => {
    await h.ready();
    const w = await h.world();
    const gone = await h.make(w, "gone", "外した人", { status: "left" });
    const invited = await h.make(w, "inv", "招待中の人", { status: "invited" });
    for (const id of [w.outsider.id, randomUUID(), gone.id, invited.id]) {
      const r = await remove(w.admin, id);
      expect(r.status, id).toBe(404);
      const j = await h.json(r);
      expect([j.code, j.field, j.details]).toEqual(["E-MEM-002", undefined, undefined]);
    }
    expect((await remove(w.admin, w.stopped.id)).status).toBe(200);
  });

  it("K848-API-017 権限（D-128.97）：マネージャー・メンバー・閲覧のみ・止めた人 → 403・何も変わらない／ログインしていない → 401／権限を個別に付けたメンバー → 200", async () => {
    await h.ready();
    const w = await h.world();
    const s0 = await state(w, w.member);
    for (const p of [w.mgr, w.member, w.viewer, w.stopped]) expect((await remove(p, w.viewer.id)).status).toBe(403);
    expect(
      (await h.call(w.admin, "POST", `/members/${w.member.id}/remove`, { body: {}, headers: { authorization: "" } }))
        .status,
    ).toBe(401);
    expect(await state(w, w.member)).toBe(s0);
    await grantEdit(w, w.member);
    expect((await remove(w.member, w.stopped.id)).status).toBe(200);
  });

  it("K848-API-018 本人確認の取り直し（D-154.18・D-125.139）：取り直し無し・16 分前 → 403・STEP_UP_REQUIRED・何も変わらない／1 分前 → 200", async () => {
    await h.ready();
    const w = await h.world();
    const s0 = await state(w, w.member);
    for (const su of [undefined, h.suAgo(16)]) {
      const r = await h.call(w.admin, "POST", `/members/${w.member.id}/remove`, {
        body: {},
        ...(su === undefined ? {} : { su }),
      });
      expect(r.status).toBe(403);
      expect(((await h.json(r)) as J).code).toBe("STEP_UP_REQUIRED");
    }
    expect(await state(w, w.member)).toBe(s0);
    expect((await remove(w.admin, w.member.id, {}, { su: h.suAgo(1) })).status).toBe(200);
  });

  it("K848-API-019 入力の形：両方指す（transfer_to_member_id と transfers）・transfers が 501 件・要素に ticket_id が無い・uuid でない・知らない欄・transfer_to_member_id が数 → 422・何も変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const id = randomUUID();
    const bad: Record<string, unknown>[] = [
      { transfer_to_member_id: w.mgr.id, transfers: [{ ticket_id: id, to_member_id: w.mgr.id }] },
      { transfers: Array.from({ length: 501 }, () => ({ ticket_id: randomUUID(), to_member_id: w.mgr.id })) },
      { transfers: [{ to_member_id: w.mgr.id }] },
      { transfers: [{ ticket_id: "x", to_member_id: w.mgr.id }] },
      { transfer_to_member_id: "x" },
      { transfer_to_member_id: 1 },
      { tenant_id: w.other.tenantId },
    ];
    const s0 = await state(w, w.member);
    for (const b of bad)
      expect((await remove(w.admin, w.member.id, b)).status, JSON.stringify(b).slice(0, 80)).toBe(422);
    expect(await state(w, w.member)).toBe(s0);
  });

  it("K848-API-020 二度押し：同じ Idempotency-Key で 2 回 → 2 回とも 200・同じ答え・証跡 1・受け箱 1（引き継ぎ先）・外すのは 1 回", async () => {
    await h.ready();
    const w = await h.world();
    await ticket(w, w.member);
    const key = randomUUID();
    const a = await remove(w.admin, w.member.id, { transfer_to_member_id: w.mgr.id }, { key });
    const b = await remove(w.admin, w.member.id, { transfer_to_member_id: w.mgr.id }, { key });
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await h.json(b)).toEqual(await h.json(a));
    expect(await h.audits(w.tenantId, "member.remove")).toBe(1);
    expect(await h.notes(w.mgr.id, "member.tickets_received")).toHaveLength(1);
  });

  it("K848-API-021 外した後にもう一度（別の鍵）：404・E-MEM-002・証跡も受け箱も増えない", async () => {
    await h.ready();
    const w = await h.world();
    expect((await remove(w.admin, w.member.id)).status).toBe(200);
    const r = await remove(w.admin, w.member.id);
    expect(r.status).toBe(404);
    expect((await h.json(r)).code).toBe("E-MEM-002");
    expect(await h.audits(w.tenantId, "member.remove")).toBe(1);
  });

  it("K848-API-022 同時に 2 人の管理者が互いを外す（G-16・D-154.21）：Promise.all で 2 つ → 200 がちょうど 1 つ・もう 1 つは 403 か 404 か 409・有効な管理者が 1 人は必ず残る（会社ごとの錠で順に通る）", async () => {
    await h.ready();
    const w = await h.world();
    const [a, b] = await Promise.all([remove(w.admin, w.admin2.id), remove(w.admin2, w.admin.id)]);
    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
    expect([a.status, b.status].filter((s) => s !== 200)[0]).toBeGreaterThanOrEqual(403);
    expect(
      await h.num(
        "select count(*) as n from tenant_memberships where tenant_id = $1 and role = 'admin' and status = 'active'",
        [w.tenantId],
      ),
    ).toBeGreaterThanOrEqual(1);
  });

  it("K848-API-023 手順の失敗（担当の付け替え）：tickets の更新で例外 → 503・E-PAGE-003・全部戻る（鈴木は有効・渡しは待ったまま・セッションは生きている・証跡も受け箱も無い）", async () => {
    await h.ready();
    const w = await h.world();
    const t = await ticket(w, w.member);
    await handover(w, await ticket(w, w.member), w.member, w.mgr);
    await session(w.member);
    const s0 = await state(w, w.member);
    await h.breakOn("tickets", w.tenantId, "update", async () => {
      const r = await remove(w.admin, w.member.id, { transfer_to_member_id: w.mgr.id });
      expect(r.status).toBe(503);
      expect((await h.json(r)).code).toBe("E-PAGE-003");
    });
    expect(await state(w, w.member)).toBe(s0);
    expect((await owner(t.id)).a).toBe(w.member.id);
  });

  it("K848-API-024 手順の失敗（渡しの取り消し・この葉の関数の中の取り消し）：ticket_handovers の更新で例外 → 503・E-PAGE-003・担当の付け替えも消す物も戻る（全部か無しか）", async () => {
    await h.ready();
    const w = await h.world();
    const t = await ticket(w, w.member);
    await handover(w, t, w.member, w.mgr);
    await h.rows(
      "insert into memories (tenant_id, scope_id, owner_member_id, title, body, visibility) values ($1, $2, $3, 'm', 'b', 'self')",
      [w.tenantId, w.eg, w.member.id],
    );
    await h.breakOn("ticket_handovers", w.tenantId, "update", async () => {
      expect((await remove(w.admin, w.member.id, { transfer_to_member_id: w.mgr.id })).status).toBe(503);
    });
    expect((await owner(t.id)).a).toBe(w.member.id);
    expect(
      await h.num("select count(*) as n from memories where owner_member_id = $1 and deleted_at is null", [
        w.member.id,
      ]),
    ).toBe(1);
    expect(
      await h.num("select count(*) as n from ticket_handovers where ticket_id = $1 and state = 'waiting'", [t.id]),
    ).toBe(1);
  });

  it("K848-API-025 手順の失敗（引き継ぎ先への受け箱の行）：notifications の挿入で例外 → 503・E-PAGE-003・担当も渡しも元のまま（受け箱の行だけ残って担当が動かない、を作らない）", async () => {
    await h.ready();
    const w = await h.world();
    const t = await ticket(w, w.member);
    await h.breakOn("notifications", w.tenantId, "insert", async () => {
      expect((await remove(w.admin, w.member.id, { transfer_to_member_id: w.mgr.id })).status).toBe(503);
    });
    expect((await owner(t.id)).a).toBe(w.member.id);
    expect(
      await h.num("select count(*) as n from members where id = $1 and deleted_at is not null", [w.member.id]),
    ).toBe(0);
  });

  it("K848-API-026 兼務（D-154.15）：営業の主・受託開発のマネージャー兼務・経理のマネージャー兼務（別の層）の人が担当 2 件（営業・受託開発のグループ）を持つ → 外すと所属の行 3 つとも消える・担当は引き継ぎ先に移る・ほかの人の同じグループの所属は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    const multi = await h.make(w, "multi", "兼務の人", { groupRole: "member" });
    for (const sc of [w.jd, w.ac])
      await h.rows(
        "insert into scope_memberships (tenant_id, scope_id, member_id, is_primary, role) values ($1, $2, $3, false, 'manager')",
        [w.tenantId, sc, multi.id],
      );
    const a = await ticket(w, multi);
    const b = await ticket(w, multi, { scope: w.jd });
    const r = await remove(w.admin, multi.id, { transfer_to_member_id: w.mgr.id });
    expect(r.status, await r.clone().text()).toBe(200);
    expect(
      await h.num("select count(*) as n from scope_memberships where member_id = $1 and deleted_at is null", [
        multi.id,
      ]),
    ).toBe(0);
    expect(
      await h.num("select count(*) as n from scope_memberships where member_id = $1 and deleted_at is not null", [
        multi.id,
      ]),
    ).toBe(3);
    expect([(await owner(a.id)).a, (await owner(b.id)).a]).toEqual([w.mgr.id, w.mgr.id]);
    expect(
      await h.num("select count(*) as n from scope_memberships where member_id = $1 and deleted_at is null", [
        w.mgr.id,
      ]),
    ).toBe(1);
  });

  it("K848-API-027 別の会社に触れない：別の会社の管理者がこの会社の人を外す → 404・E-MEM-002（この会社の担当・名前が答えに出ない）・何も変わらない／別の会社の人を引き継ぎ先にする → 404・E-MEM-021", async () => {
    await h.ready();
    const w = await h.world();
    await ticket(w, w.member);
    const s0 = await state(w, w.member);
    const r = await remove(w.outsider, w.member.id);
    expect(r.status).toBe(404);
    expect(JSON.stringify(await h.json(r))).not.toContain("鈴木");
    expect((await remove(w.admin, w.member.id, { transfer_to_member_id: w.outsider.id })).status).toBe(404);
    expect(await state(w, w.member)).toBe(s0);
  });

  it("K848-API-028 別のワークスペースの所属は変えない：同じログインの鈴木が別の会社にも入っている → この会社で外しても、別の会社の members・セッションはそのまま", async () => {
    await h.ready();
    const w = await h.world();
    const there = await h.f.alsoIn(w.member, w.other.tenantId, w.other.rootScope);
    await session(there);
    expect((await remove(w.admin, w.member.id)).status).toBe(200);
    expect(await h.num("select count(*) as n from members where id = $1 and deleted_at is null", [there.id])).toBe(1);
    expect(
      await h.num("select count(*) as n from sessions where member_id = $1 and revoked_at is null", [there.id]),
    ).toBe(1);
  });
});
