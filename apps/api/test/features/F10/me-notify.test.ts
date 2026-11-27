// K-837「知らせの設定」の口の試験（本物の DB・偽の画面のログイン。土台 me.harness.ts）。行 ID（K837-API-…）は 11_tickets/K-837.md の表と 1 対 1。
//   getNotificationSettings    GET   /me/notification-settings[?workspace_id]       → 200 { data: { workspace_id, email_digest, quiet_hours: { preset }, paused_until, urgent_override, events } }
//   updateNotificationSettings PATCH /me/notification-settings { workspace_id?, email_digest?, quiet_hours?, pause?, urgent_override?, events? } → 200（同じ形）
//   copyNotificationSettings   POST  /me/notification-settings/copy { from_workspace_id, to_workspace_ids }                   → 201 { data: { copied_to } }
//   知らせの受け方はワークスペースごと（同じログインの会社ごとの notification_settings と notification_preferences の行）。保存だけ作る（読んで送る側は F7・K-67・D-154.24）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { setupMe, type MeWorld, type P } from "./me.harness.js";

const h = setupMe("me-notify.ts");
const EVENTS = [
  "approval_waiting",
  "mentioned",
  "handed_over",
  "clone_stopped",
  "clone_finished",
  "ticket_changed",
  "new_device",
];
const get = (p: P, ws?: string) => h.call(p, "GET", `/me/notification-settings${ws ? `?workspace_id=${ws}` : ""}`);
const patch = (p: P, body: unknown, key?: string) =>
  h.call(p, "PATCH", "/me/notification-settings", { body, ...(key ? { key } : {}) });
const copy = (p: P, from: string, to: unknown, key?: string) =>
  h.call(p, "POST", "/me/notification-settings/copy", {
    body: { from_workspace_id: from, to_workspace_ids: to },
    ...(key ? { key } : {}),
  });
const data = async (r: Response) => (await h.json(r)).data as Record<string, unknown>;
const ev = (d: Record<string, unknown>, key: string) =>
  (d["events"] as Record<string, unknown>[]).find((e) => e.key === key);
const saved = (p: P) =>
  h.one<Record<string, unknown>>("select * from notification_settings where member_id = $1", [p.id]);
const prefs = (p: P) =>
  h.rows<Record<string, unknown>>(
    "select event_kind_id, channel_id, enabled from notification_preferences where member_id = $1 and deleted_at is null order by 1, 2",
    [p.id],
  );
/** 同じログインを別の会社にも入れる。その会社での人を返す */
async function second(w: MeWorld) {
  const co = await h.f.company(`別の会社-${randomUUID().slice(0, 4)}`, "ZZ");
  const there = await h.f.alsoIn(w.member, co.tenantId, co.rootScope);
  return { co, there };
}
const hhmm = (iso: string, tz: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });

describe("K-837 知らせの設定（getNotificationSettings・updateNotificationSettings・copyNotificationSettings）", () => {
  it("K837-API-001 読む（まだ保存が無い）：200・no-store・鍵は workspace_id・email_digest・quiet_hours・paused_until・urgent_override・events だけ・既定は digest 真・静かにする時間 weekdays_night_weekend・止めていない・急ぎ 2 つ・出来事は 7 つ（覚えたいことの知らせ learning_suggested は無い・D-154.60。ベルとメールの既定は下絵のとおり・new_device だけ fixed）", async () => {
    await h.ready();
    const w = await h.world();
    const r = await get(w.member);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control")).toContain("no-store");
    const d = await data(r);
    expect(Object.keys(d).sort()).toEqual([
      "email_digest",
      "events",
      "paused_until",
      "quiet_hours",
      "urgent_override",
      "workspace_id",
    ]);
    expect(d).toMatchObject({
      workspace_id: w.tenantId,
      email_digest: true,
      quiet_hours: { preset: "weekdays_night_weekend" },
      paused_until: null,
    });
    expect([...d["urgent_override"]].sort()).toEqual(["approval_due_today", "clone_stopped"]);
    expect((d["events"] as Record<string, unknown>[]).map((e) => e.key)).toEqual(EVENTS);
    expect(Object.keys(d["events"][0]).sort()).toEqual(["bell", "fixed", "key", "mail"]);
    expect(ev(d, "approval_waiting")).toMatchObject({ bell: true, mail: true, fixed: false });
    expect(ev(d, "clone_finished")).toMatchObject({ bell: true, mail: false, fixed: false });
    expect(ev(d, "new_device")).toMatchObject({ bell: true, mail: true, fixed: true });
    expect(await h.num("select count(*) as n from notification_settings where member_id = $1", [w.member.id])).toBe(0);
  });

  it("K837-API-002 ワークスペースを指す（workspace_id）：入っている会社（今いない会社も）は読める・入っていない・抜けた・別の人の会社は 404（欄・details なし）・uuid でなければ 422・指さなければ今の会社", async () => {
    await h.ready();
    const w = await h.world();
    const { co } = await second(w);
    expect((await data(await get(w.member, co.tenantId)))["workspace_id"]).toBe(co.tenantId);
    expect((await data(await get(w.member)))["workspace_id"]).toBe(w.tenantId);
    for (const id of [w.other.tenantId, randomUUID()]) {
      const r = await get(w.member, id);
      expect(r.status, id).toBe(404);
      const b = await h.json(r);
      expect(b.field).toBeUndefined();
      expect(b.details).toBeUndefined();
    }
    expect((await get(w.member, "not-a-uuid")).status).toBe(422);
    await h.f.admin.query(
      "update tenant_memberships set status = 'left' where tenant_id = $1 and auth_user_id = (select auth_user_id from tenant_memberships where member_id = $2 limit 1)",
      [co.tenantId, w.member.id],
    );
    expect((await get(w.member, co.tenantId)).status).toBe(404);
  });

  it("K837-API-003 保存して読み直す：メールのまとめ・静かにする時間・急ぎの出来事を保存すると 200（同じ形の答え）・読み直しにも出る・行は 1 つだけ（2 回目は更新）", async () => {
    await h.ready();
    const w = await h.world();
    const r = await patch(w.member, {
      email_digest: false,
      quiet_hours: { preset: "every_night" },
      urgent_override: ["clone_stopped"],
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = await data(r);
    expect(d).toMatchObject({
      workspace_id: w.tenantId,
      email_digest: false,
      quiet_hours: { preset: "every_night" },
      urgent_override: ["clone_stopped"],
    });
    expect(await data(await get(w.member))).toMatchObject({
      email_digest: false,
      quiet_hours: { preset: "every_night" },
    });
    expect((await patch(w.member, { quiet_hours: { preset: "off" } })).status).toBe(200);
    expect(await h.num("select count(*) as n from notification_settings where member_id = $1", [w.member.id])).toBe(1);
    expect((await saved(w.member))["email_digest"]).toBe(false);
  });

  it("K837-API-004 出来事の 1 行（ベル・メール）：変えた行だけ保存され読み直しに出る・送らなかった出来事は既定のまま・同じ出来事は 1 行ずつ（重ならない）", async () => {
    await h.ready();
    const w = await h.world();
    const r = await patch(w.member, {
      events: [
        { key: "mentioned", mail: false },
        { key: "clone_finished", mail: true },
      ],
    });
    expect(r.status, await r.clone().text()).toBe(200);
    const d = await data(r);
    expect(ev(d, "mentioned")).toMatchObject({ bell: true, mail: false });
    expect(ev(d, "clone_finished")).toMatchObject({ bell: true, mail: true });
    expect(ev(d, "approval_waiting")).toMatchObject({ bell: true, mail: true });
    expect((await patch(w.member, { events: [{ key: "mentioned", mail: false, bell: false }] })).status).toBe(200);
    const rows = await prefs(w.member);
    expect(rows.filter((x) => x.event_kind_id === "mentioned" && x.channel_id === "mail").length).toBe(1);
    expect(ev(await data(await get(w.member)), "mentioned")).toMatchObject({ bell: false, mail: false });
  });

  it("K837-API-005 止められない出来事：new_device のベルかメールを切る体は 409・E-ME-040（安全のため止められません）・同じ体の中のほかの変更も入らない（全部か無しか）・入れ直す（真）は通る", async () => {
    await h.ready();
    const w = await h.world();
    for (const e of [
      { key: "new_device", bell: false },
      { key: "new_device", mail: false },
    ]) {
      const r = await patch(w.member, { email_digest: false, events: [{ key: "mentioned", mail: false }, e] });
      expect(r.status).toBe(409);
      expect((await h.json(r)).code).toBe("E-ME-040");
    }
    expect(await saved(w.member)).toBeUndefined();
    expect(await prefs(w.member)).toEqual([]);
    expect((await patch(w.member, { events: [{ key: "new_device", bell: true, mail: true }] })).status).toBe(200);
  });

  it("K837-API-006 出来事・急ぎ・静かにする時間の誤り：知らない出来事（作らない learning_suggested を含む）・8 つ以上・ベルもメールも無い行・真偽でない値・知らない急ぎ・静かにする時間が 4 つ以外は 422（欄の名前つき）で何も保存されない・急ぎを空にするのは通る", async () => {
    await h.ready();
    const w = await h.world();
    for (const [field, body] of [
      ["events", { events: [{ key: "nope", bell: true }] }],
      ["events", { events: Array.from({ length: 8 }, (_, i) => ({ key: EVENTS[i % 7], bell: true })) }],
      ["events", { events: [{ key: "learning_suggested", bell: true }] }],
      ["events", { events: [{ key: "mentioned" }] }],
      ["events", { events: [{ key: "mentioned", bell: "yes" }] }],
      ["urgent_override", { urgent_override: ["nope"] }],
      ["quiet_hours", { quiet_hours: { preset: "always" } }],
    ] as const) {
      const r = await patch(w.member, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
      expect((await h.json(r)).details?.[0]?.field, JSON.stringify(body)).toContain(field);
    }
    expect(await saved(w.member)).toBeUndefined();
    expect((await patch(w.member, { urgent_override: [] })).status).toBe(200);
    expect((await data(await get(w.member)))["urgent_override"]).toEqual([]);
  });

  it("K837-API-007 いま止める：1 時間（今から 1 時間）・今日いっぱい（今日の終わり＝次の 0 時）・明日の朝まで（明日の 8 時）を、その人の時間帯で paused_until に入れる・null で止めるのをやめる・知らない値は 422", async () => {
    await h.ready();
    const w = await h.world();
    const t0 = Date.now();
    const a = await data(await patch(w.member, { pause: "1h" }));
    expect(Math.abs(Date.parse(a["paused_until"]) - (t0 + 3600_000))).toBeLessThan(120_000);
    const b = await data(await patch(w.member, { pause: "today" }));
    expect(hhmm(b["paused_until"], "Asia/Tokyo")).toBe("00:00");
    expect(Date.parse(b["paused_until"])).toBeGreaterThan(t0);
    expect(Date.parse(b["paused_until"])).toBeLessThanOrEqual(t0 + 24 * 3600_000);
    const c = await data(await patch(w.member, { pause: "tomorrow_morning" }));
    expect(hhmm(c["paused_until"], "Asia/Tokyo")).toBe("08:00");
    expect(Date.parse(c["paused_until"])).toBeGreaterThan(t0 + 8 * 3600_000);
    await h.f.admin.query("update members set timezone = 'UTC' where id = $1", [w.member.id]);
    expect(hhmm((await data(await patch(w.member, { pause: "today" })))["paused_until"], "UTC")).toBe("00:00");
    expect((await data(await patch(w.member, { pause: null })))["paused_until"]).toBeNull();
    expect((await patch(w.member, { pause: "forever" })).status).toBe(422);
  });

  it("K837-API-008 体の形：空の体・知らない欄・member_id・tenant_id を送る体は 422（strict）・ほかの人は変わらない", async () => {
    await h.ready();
    const w = await h.world();
    for (const body of [
      {},
      { nope: 1 },
      { member_id: w.admin.id },
      { tenant_id: w.tenantId },
      { paused_until: "2030-01-01T00:00:00Z" },
    ])
      expect((await patch(w.member, body)).status, JSON.stringify(body)).toBe(422);
    expect(await saved(w.admin)).toBeUndefined();
  });

  it("K837-API-009 別のワークスペースの設定を変える（workspace_id）：その会社の行だけ変わる・今の会社の行は変わらない・入っていない会社は 404 で何も作らない", async () => {
    await h.ready();
    const w = await h.world();
    const { co, there } = await second(w);
    const r = await patch(w.member, {
      workspace_id: co.tenantId,
      email_digest: false,
      events: [{ key: "mentioned", mail: false }],
    });
    expect(r.status, await r.clone().text()).toBe(200);
    expect((await data(r))["workspace_id"]).toBe(co.tenantId);
    expect((await saved(there))["email_digest"]).toBe(false);
    expect(await saved(w.member)).toBeUndefined();
    expect(await prefs(w.member)).toEqual([]);
    expect((await patch(w.member, { workspace_id: w.other.tenantId, email_digest: false })).status).toBe(404);
    expect(
      await h.num("select count(*) as n from notification_settings where tenant_id = $1", [w.other.tenantId]),
    ).toBe(0);
  });

  it("K837-API-010 ほかのワークスペースに写す：メールのまとめ・静かにする時間・急ぎ・出来事（ベル・メール）が写し先に置き換わる・止めている印（paused_until）は写さない・写し元は変わらない・201 と copied_to", async () => {
    await h.ready();
    const w = await h.world();
    const { co, there } = await second(w);
    const { co: co2, there: there2 } = await second(w);
    await patch(w.member, {
      email_digest: false,
      quiet_hours: { preset: "weekend_only" },
      urgent_override: ["approval_due_today"],
      events: [{ key: "mentioned", mail: false }],
      pause: "1h",
    });
    await patch(w.member, { workspace_id: co2.tenantId, quiet_hours: { preset: "off" } });
    const r = await copy(w.member, w.tenantId, [co.tenantId, co2.tenantId]);
    expect(r.status, await r.clone().text()).toBe(201);
    expect([...((await data(r))["copied_to"] as string[])].sort()).toEqual([co.tenantId, co2.tenantId].sort());
    for (const [ws, p] of [
      [co.tenantId, there],
      [co2.tenantId, there2],
    ] as const) {
      const d = await data(await get(w.member, ws));
      expect(d, ws).toMatchObject({
        email_digest: false,
        quiet_hours: { preset: "weekend_only" },
        urgent_override: ["approval_due_today"],
        paused_until: null,
      });
      expect(ev(d, "mentioned")).toMatchObject({ mail: false });
      void p;
    }
    expect((await data(await get(w.member)))["paused_until"]).not.toBeNull();
  });

  it("K837-API-011 写すの誤り：写し先に写し元を含める・写し先が入っていない会社・抜けた会社は 409・E-ME-041／404（欄・details なし）で 1 つも写さない（全部か無しか）・写し先が 0 か 21 以上・uuid でない値は 422", async () => {
    await h.ready();
    const w = await h.world();
    const { co, there } = await second(w);
    await patch(w.member, { email_digest: false });
    const own = await copy(w.member, w.tenantId, [w.tenantId, co.tenantId]);
    expect(own.status).toBe(409);
    expect((await h.json(own)).code).toBe("E-ME-041");
    const out = await copy(w.member, w.tenantId, [co.tenantId, w.other.tenantId]);
    expect(out.status).toBe(404);
    expect((await h.json(out)).details).toBeUndefined();
    expect(await saved(there)).toBeUndefined();
    expect((await copy(w.member, w.other.tenantId, [co.tenantId])).status).toBe(404);
    for (const to of [[], Array.from({ length: 21 }, () => randomUUID()), ["not-a-uuid"], "x"])
      expect((await copy(w.member, w.tenantId, to)).status, JSON.stringify(to)).toBe(422);
    expect(await saved(there)).toBeUndefined();
  });

  it("K837-API-012 保存だけ：設定を保存・写してもお知らせ（受け箱）の行・メールの送出・会社の記録は増えない（読んで送るのは F7）", async () => {
    await h.ready();
    const w = await h.world();
    const { co } = await second(w);
    const n = await h.num("select count(*) as n from notifications where tenant_id = any($1::uuid[])", [
      [w.tenantId, co.tenantId],
    ]);
    const a = await h.num("select count(*) as n from audit_events where tenant_id = any($1::uuid[])", [
      [w.tenantId, co.tenantId],
    ]);
    await patch(w.member, { email_digest: false, events: [{ key: "mentioned", mail: false }] });
    await copy(w.member, w.tenantId, [co.tenantId]);
    expect(
      await h.num("select count(*) as n from notifications where tenant_id = any($1::uuid[])", [
        [w.tenantId, co.tenantId],
      ]),
    ).toBe(n);
    expect(
      await h.num("select count(*) as n from audit_events where tenant_id = any($1::uuid[])", [
        [w.tenantId, co.tenantId],
      ]),
    ).toBe(a);
    expect(h.mails.length).toBe(0);
  });

  it("K837-API-013 守り：ログインなし 401・止めた人は 401／403・別の人の設定は読めず変わらない・別の会社の人は自分の設定だけ", async () => {
    await h.ready();
    const w = await h.world();
    expect(
      (await h.call(w.member, "GET", "/me/notification-settings", { headers: { authorization: "" } })).status,
    ).toBe(401);
    expect([401, 403]).toContain((await get(w.stopped)).status);
    expect([401, 403]).toContain((await patch(w.stopped, { email_digest: false })).status);
    await patch(w.member, { email_digest: false });
    expect((await data(await get(w.admin)))["email_digest"]).toBe(true);
    expect((await patch(w.outsider, { email_digest: false })).status).toBe(200);
    expect(await saved(w.admin)).toBeUndefined();
  });

  it("K837-API-014 手順 1（DB に書く）の失敗：保存・写すは 503・E-PAGE-003・何も残らない／読む口の DB の失敗も 503", async () => {
    await h.ready();
    const w = await h.world();
    const { co, there } = await second(w);
    await patch(w.member, { email_digest: false });
    await h.captureLogs(async () => {
      await h.breakOn("notification_settings", w.tenantId, "update", async () => {
        const r = await patch(w.member, { email_digest: true });
        expect(r.status).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
      await h.breakPool(["getNotificationSettings"], async () => {
        const r = await get(w.member);
        expect(r.status).toBe(503);
        expect((await h.json(r)).code).toBe("E-PAGE-003");
      });
      await h.breakOn("notification_settings", co.tenantId, "insert", async () => {
        const r = await copy(w.member, w.tenantId, [co.tenantId]);
        expect(r.status).toBe(503);
      });
    });
    expect((await saved(w.member))["email_digest"]).toBe(false);
    expect(await saved(there)).toBeUndefined();
  });

  it("K837-API-015 写すの途中の失敗：2 つ目の写し先で DB が落ちると 503 で 1 つ目も写らない（全部か無しか）", async () => {
    await h.ready();
    const w = await h.world();
    const { co, there } = await second(w);
    const { co: co2, there: there2 } = await second(w);
    await patch(w.member, { email_digest: false });
    await h.captureLogs(async () => {
      await h.breakOn("notification_settings", co2.tenantId, "insert", async () => {
        const r = await copy(w.member, w.tenantId, [co.tenantId, co2.tenantId]);
        expect(r.status).toBe(503);
      });
    });
    expect(await saved(there)).toBeUndefined();
    expect(await saved(there2)).toBeUndefined();
    void co;
  });

  it("K837-API-016 二度押し（同じ Idempotency-Key）：保存も写すも 2 回とも同じ状態・同じ答え・行は増えない", async () => {
    await h.ready();
    const w = await h.world();
    const { co } = await second(w);
    const k = randomUUID();
    const a = await patch(w.member, { email_digest: false }, k);
    const b = await patch(w.member, { email_digest: false }, k);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((await h.json(b)).data).toEqual((await h.json(a)).data);
    const k2 = randomUUID();
    const c = await copy(w.member, w.tenantId, [co.tenantId], k2);
    const d = await copy(w.member, w.tenantId, [co.tenantId], k2);
    expect([c.status, d.status]).toEqual([201, 201]);
    expect(await h.num("select count(*) as n from notification_settings where tenant_id = $1", [co.tenantId])).toBe(1);
  });

  it("K837-API-017 同時に別の出来事を直す：どちらも残る・同じ出来事は後に通った方が残り行は重ならない", async () => {
    await h.ready();
    const w = await h.world();
    const [a, b] = await Promise.all([
      patch(w.member, { events: [{ key: "mentioned", mail: false }] }),
      patch(w.member, { events: [{ key: "handed_over", bell: false }] }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const d = await data(await get(w.member));
    expect(ev(d, "mentioned").mail).toBe(false);
    expect(ev(d, "handed_over").bell).toBe(false);
    const [c, e] = await Promise.all([
      patch(w.member, { events: [{ key: "ticket_changed", mail: true }] }),
      patch(w.member, { events: [{ key: "ticket_changed", mail: false }] }),
    ]);
    expect([c.status, e.status]).toEqual([200, 200]);
    expect(
      (await prefs(w.member)).filter((x) => x.event_kind_id === "ticket_changed" && x.channel_id === "mail").length,
    ).toBe(1);
  });
});
