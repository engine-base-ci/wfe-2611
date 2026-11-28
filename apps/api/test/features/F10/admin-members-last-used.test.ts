// K-808「メンバーの並びに『最後に使った日』を足す（getWorkspaceMembers）」の口の試験（本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン。土台 admin.harness.ts）。
//   行 ID（K808-API-…）は 11_tickets/K-808.md の表と 1 対 1。K-419 の並びの形（apps/api/test/features/F10/invite-create.test.ts の K419-API-001〜006）に、人ごとに 2 つの鍵を足す：
//     groups[].members[] に last_used_at（ISO 8601・時差つき）と last_used_days（日本の「何日前」＝切り捨て）。画面を使った（sessions の web）ことが 1 度も無い人は両方 null。
//   「使った」＝sessions の kind が web（画面）の行の last_seen_at のいちばん新しい物（失効した行も数える・消した行は数えない）。PC（bridge）の様子とは別物。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { describe, expect, it } from "vitest";
import { setupAdmin, type Person, type World } from "./admin.harness.js";

const h = setupAdmin();
type M = Record<string, unknown>;
const list = async (w: World, p: Person = w.admin) => {
  const r = await h.call(p, "GET", "/workspace/members");
  expect(r.status, await r.clone().text()).toBe(200);
  const d = (await h.json(r)).data as { groups: { id: string; members: M[] }[] };
  return d.groups.flatMap((g) => g.members);
};
const find = (all: M[], id: string) => all.find((m) => m["id"] === id)!;
const session = (w: World, memberId: string, o: { kind?: string; ago: string; revoked?: boolean; deleted?: boolean }) =>
  h.f.admin.query(
    `insert into sessions (tenant_id, member_id, kind_id, device_label, last_seen_at, revoked_at, deleted_at)
     values ($1, $2, $3, 'テスト', now() - ($4::text)::interval, $5, $6)`,
    [w.tenantId, memberId, o.kind ?? "web", o.ago, o.revoked ? new Date() : null, o.deleted ? new Date() : null],
  );

describe("K-808 メンバーの並びの『最後に使った日』", () => {
  it("K808-API-001 最後に使った日：画面（web）の行のいちばん新しい last_seen_at。3 日前の人は days 3・今日の人は 0・1 度も無い人は両方 null・値は ISO 8601（時差つき）", async () => {
    await h.ready();
    const w = await h.world();
    await session(w, w.member.id, { ago: "3 days 2 hours" });
    await session(w, w.admin.id, { ago: "5 minutes" });
    const all = await list(w);
    expect(find(all, w.member.id)).toMatchObject({ last_used_days: 3 });
    expect(find(all, w.admin.id)).toMatchObject({ last_used_days: 0 });
    expect(find(all, w.mgr.id)).toMatchObject({ last_used_at: null, last_used_days: null });
    const at = String(find(all, w.member.id)["last_used_at"]);
    expect(at).toMatch(/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/);
    expect(Math.abs(new Date(at).getTime() - (Date.now() - (3 * 24 + 2) * 3_600_000))).toBeLessThan(120_000);
  });

  it("K808-API-002 数え方：複数の行はいちばん新しい物・失効した行も数える・消した行は数えない・PC（bridge）の行は数えない（PC の様子 pc とは別）", async () => {
    await h.ready();
    const w = await h.world();
    await session(w, w.member.id, { ago: "10 days" });
    await session(w, w.member.id, { ago: "4 days", revoked: true });
    await session(w, w.member.id, { ago: "1 hour", deleted: true });
    await session(w, w.member.id, { kind: "bridge", ago: "1 minute" });
    await session(w, w.mgr.id, { kind: "bridge", ago: "1 minute" });
    const all = await list(w);
    expect(find(all, w.member.id)).toMatchObject({ last_used_days: 4, pc: "ok" });
    expect(find(all, w.mgr.id)).toMatchObject({ last_used_at: null, last_used_days: null, pc: "ok" });
  });

  it("K808-API-003 時間の境：23 時間 59 分前は 0 日・24 時間前は 1 日・47 時間前は 1 日・48 時間前は 2 日（切り捨て）", async () => {
    await h.ready();
    const w = await h.world();
    const who = [w.member, w.mgr, w.admin2, w.viewer];
    const agos = ["23 hours 59 minutes", "24 hours 1 minute", "47 hours", "48 hours 1 minute"];
    for (const [i, p] of who.entries()) await session(w, p.id, { ago: agos[i]! });
    const all = await list(w);
    expect(who.map((p) => find(all, p.id)["last_used_days"])).toEqual([0, 1, 1, 2]);
  });

  it("K808-API-004 形：人ごとの鍵は K-419 の 11 個に last_used_at・last_used_days の 2 つを足した 13 個ちょうど。兼ねる人は両方のグループの行に同じ値が出る。止めた人・閲覧のみにも出る", async () => {
    await h.ready();
    const w = await h.world();
    await h.f.admin.query(
      "insert into scope_memberships (tenant_id, scope_id, member_id, role) values ($1, $2, $3, 'member')",
      [w.tenantId, w.jd, w.member.id],
    );
    await session(w, w.member.id, { ago: "2 days" });
    await session(w, w.stopped.id, { ago: "9 days" });
    await session(w, w.viewer.id, { ago: "1 day 3 hours" });
    const r = await h.call(w.admin, "GET", "/workspace/members");
    const groups = ((await h.json(r)).data as { groups: { id: string; members: M[] }[] }).groups;
    const rows = groups.flatMap((g) => g.members);
    for (const m of rows)
      expect(Object.keys(m).sort()).toEqual(
        [
          "email",
          "group_role",
          "id",
          "last_used_at",
          "last_used_days",
          "name",
          "other_groups",
          "pc",
          "pc_days_away",
          "primary",
          "role",
          "self",
          "suspended",
        ].sort(),
      );
    const both = rows.filter((m) => m["id"] === w.member.id);
    expect(both.length).toBe(2);
    expect(both[0]!["last_used_at"]).toBe(both[1]!["last_used_at"]);
    expect(find(rows, w.stopped.id)).toMatchObject({ suspended: true, last_used_days: 9 });
    expect(find(rows, w.viewer.id)).toMatchObject({ last_used_days: 1 });
  });

  it("K808-API-005 別の会社の人の使った日は出ない・同じ人が別の会社にも入っていても、この会社の分（この会社の members の sessions）だけを数える", async () => {
    await h.ready();
    const w = await h.world();
    const twin = await h.f.alsoIn(w.member, w.other.tenantId, w.other.rootScope);
    await session({ ...w, tenantId: w.other.tenantId }, twin.id, { ago: "1 minute" });
    await session(w, w.member.id, { ago: "6 days" });
    expect(find(await list(w), w.member.id)).toMatchObject({ last_used_days: 6 });
    const theirs = await list(w, w.outsider);
    expect(theirs.map((m) => m["id"])).not.toContain(w.member.id);
  });

  it("K808-API-006 権限は前のまま：メンバー・閲覧のみは 403（並びも使った日も返さない）・ログインしていない 401・K-419 の鍵（groups・invitations・alerts・count）は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    for (const p of [w.member, w.viewer]) {
      const r = await h.call(p, "GET", "/workspace/members");
      expect(r.status).toBe(403);
      expect(JSON.stringify(await h.json(r))).not.toContain("last_used");
    }
    expect((await h.f.req("GET", "/workspace/members")).status).toBe(401);
    const d = (await h.json(await h.call(w.admin, "GET", "/workspace/members"))).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["alerts", "count", "groups", "invitations"]);
  });

  it("K808-API-007 時間の流れ（G-12）：画面を使った直後に読み直すと 0 日・すぐ後に別の画面の行（新しい last_seen_at）が入ると日が縮む", async () => {
    await h.ready();
    const w = await h.world();
    await session(w, w.member.id, { ago: "5 days" });
    expect(find(await list(w), w.member.id)).toMatchObject({ last_used_days: 5 });
    await h.f.admin.query("update sessions set last_seen_at = now() where member_id = $1 and kind_id = 'web'", [
      w.member.id,
    ]);
    expect(find(await list(w), w.member.id)).toMatchObject({ last_used_days: 0 });
  });

  it("K808-DB-008 守り：app.workspace_members は前のまま kaname_app に渡してあり、会社の文脈が無いと 42501（K-419 の守りを変えない）", async () => {
    await h.ready();
    const w = await h.world();
    await expect(h.f.pool.query("select app.workspace_members()")).rejects.toThrow();
    const v = (await h.asOwner<{ v: { groups: unknown[] } }>(w.admin, "select app.workspace_members() as v"))[0]!.v;
    expect(Array.isArray(v.groups)).toBe(true);
  });
});
