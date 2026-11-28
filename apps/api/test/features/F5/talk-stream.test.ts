// K-759「書きながらの返事を流す口（streamConversation：GET /api/v1/conversations/:id/stream）」の単体の試験（口・本物の DB・偽の知らせの接続）。
//   名前の頭の行 ID（K759-API-…）は 11_tickets/K-759.md の行の表と 1 対 1。
//   知らせの接続（MemberHub）と「ログインがまだ生きているか」の確かめは偽を差す（口の工場 register.make に hub・freshSession・talkStream を渡す）。
//   本物の接続は K759-API-013 の 1 行だけで通す。会話の置き場は K-757 の関数（app.conversation_messages）を使う。
// 流れが流すのは合図の名前だけ：ready（つながった・画面はここで会話を読み直す）・change（変わった）・down（知らせの接続が落ちた）・end（reconnect／unauthenticated）・コメント行 ": alive"。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMemberHub, type MemberHub, type MemberListener } from "@kaname/db/listen";
import type { HookDeps, HookModule } from "../../../src/hooks/registry.js";
import { makeFixture, type Fixture, type Person } from "../fixture.js";

const HOOKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src", "hooks");
const APP_URL = process.env["DATABASE_URL"]!.replace(/\/\/[^@]*@/, "//kaname_app:kaname_app@");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 偽の知らせの接続：人ごとの受け手を持ち、試験が change・down を打つ */
class FakeHub implements MemberHub {
  readonly subs = new Map<string, Set<MemberListener>>();
  calls = 0;
  failSubscribe = false;
  subscribe = async (member: string, l: MemberListener): Promise<() => void> => {
    this.calls += 1;
    if (this.failSubscribe) throw new Error("listen down");
    const set = this.subs.get(member) ?? new Set<MemberListener>();
    set.add(l);
    this.subs.set(member, set);
    return () => void set.delete(l);
  };
  size = (): number => [...this.subs.values()].reduce((n, s) => n + s.size, 0);
  close = async (): Promise<void> => undefined;
  emit(member: string): void {
    for (const l of [...(this.subs.get(member) ?? [])]) l.change();
  }
  drop(): void {
    for (const s of this.subs.values()) for (const l of [...s]) l.down();
  }
}

/** SSE を読む：届いた合図を順に貯める（event 名・data があれば "名:data"・コメント行は "alive"） */
function reader(res: Response) {
  const events: string[] = [];
  const dec = new TextDecoder();
  const r = res.body!.getReader();
  let buf = "";
  let done = false;
  void (async () => {
    for (;;) {
      const x = await r.read().catch(() => ({ done: true, value: undefined }));
      if (x.done) break;
      buf += dec.decode(x.value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const ev = /^event: ?(.*)$/m.exec(block)?.[1];
        const data = /^data: ?(.*)$/m.exec(block)?.[1] ?? "";
        if (ev) events.push(data ? `${ev}:${data}` : ev);
        else if (block.startsWith(":")) events.push("alive");
      }
    }
    done = true;
  })();
  const until = async (pred: (e: string[]) => boolean, ms = 3000) => {
    const t = Date.now() + ms;
    while (!pred(events) && Date.now() < t && !done) await sleep(20);
    return pred(events);
  };
  return { events, until, stop: async () => void (await r.cancel().catch(() => undefined)), ended: () => done };
}

let f: Fixture;
const hub = new FakeHub();
/** ログインを切った・別の人に替わった人（偽の確かめが見る） */
const revoked = new Set<string>();
const swapped = new Map<string, string>();
const fresh = async (h: Headers) => {
  const m = /^Bearer fake(?:-pending)?:(?:member|ops|client):([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(
    h.get("authorization") ?? "",
  );
  if (!m || revoked.has(m[2]!)) return null;
  return { ctx: { tenantId: m[1]!, userId: swapped.get(m[2]!) ?? m[2]! } };
};
type Timing = { keepaliveMs?: number; lifetimeMs?: number; settleMs?: number };

const load = async (file: string): Promise<HookModule> =>
  ((await import(join(HOOKS_DIR, `${file}.ts`))) as { register: HookModule }).register;
/** 流す口を差し込む（試験ごとに作り直す。hub・freshSession を null にすると「無い」状態） */
const use = async (
  o: { hub?: MemberHub | null; fresh?: typeof fresh | null; timing?: Timing; pool?: unknown } = {},
) => {
  const reg = await load("talk-stream");
  const deps = {
    appPool: o.pool ?? f.pool,
    hub: o.hub === undefined ? hub : o.hub,
    ...(o.fresh === null ? {} : { freshSession: o.fresh ?? fresh }),
    ...(o.timing ? { talkStream: o.timing } : {}),
  };
  Object.assign(f.hooks, reg.make(deps as unknown as HookDeps));
  f.limits["streamConversation"] = 100_000;
};

let me: Person;
let other: Person;
let outsider: Person;

const conv = async (p: Person, o: { deleted?: boolean } = {}): Promise<string> => {
  const id = (await f.admin.query<{ id: string }>("select app.agent_new_conversation($1, false) as id", [p.id]))
    .rows[0]!.id;
  if (o.deleted) await f.admin.query("update conversations set deleted_at = now() where id = $1", [id]);
  return id;
};
const say = (p: Person, c: string, body: string) =>
  f.admin.query("insert into messages (tenant_id, conversation_id, body, kind) values ($1, $2, $3, 'ai')", [
    p.tenantId,
    c,
    body,
  ]);
const open = (p: Person, c: string, headers: Record<string, string> = {}) =>
  f.req("GET", `/conversations/${c}/stream`, { headers: { ...p.auth, ...headers } });
const json = async (r: Response) => (await r.clone().json()) as Record<string, unknown>;

beforeAll(async () => {
  f = await makeFixture([]);
  const c = await f.company(`話す 流れ ${Math.random().toString(36).slice(2, 7)}`, "EG");
  const o = await f.company(`話す 流れ 別 ${Math.random().toString(36).slice(2, 7)}`, "OT");
  me = await f.person(c.tenantId, c.rootScope, { name: "高本 聖斗", ticketAbility: "edit" });
  other = await f.person(c.tenantId, c.rootScope, { name: "佐藤 花子", ticketAbility: "edit" });
  outsider = await f.person(o.tenantId, o.rootScope, { name: "鈴木 一郎", ticketAbility: "edit" });
}, 60_000);
afterAll(async () => {
  await f?.close();
});

describe("K-759 書きながらの返事の流れ：状態 × 入口 × 利用者の状態", () => {
  it("K759-API-001 自分の会話 × 流れを開く × 本人：200・text/event-stream・Cache-Control に private と no-store・x-accel-buffering が no。最初の合図は ready", async () => {
    await use();
    const c = await conv(me);
    const r = await open(me, c);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type") ?? "").toContain("text/event-stream");
    expect(r.headers.get("cache-control") ?? "").toMatch(/private/);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store/);
    expect(r.headers.get("x-accel-buffering")).toBe("no");
    const s = reader(r);
    expect(await s.until((e) => e.length > 0)).toBe(true);
    expect(s.events[0]).toBe("ready");
    expect(hub.subs.get(me.id)?.size).toBe(1);
    await s.stop();
  });

  it("K759-API-002 会話が変わると change が 1 秒以内に届く。流れに載るのは合図の名前だけで、会話の字は載らない", async () => {
    await use();
    const c = await conv(me);
    const s = reader(await open(me, c));
    await s.until((e) => e.includes("ready"));
    const t0 = Date.now();
    hub.emit(me.id);
    expect(await s.until((e) => e.includes("change"), 1000)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(s.events).toEqual(["ready", "change"]);
    await s.stop();
  });

  it("K759-API-003 ほかの人の会話が変わっても届かない（受け取るのは本人の分だけ）", async () => {
    await use({ timing: { settleMs: 50 } });
    const c = await conv(me);
    const s = reader(await open(me, c));
    await s.until((e) => e.includes("ready"));
    hub.emit(other.id);
    await sleep(50 * 8);
    expect(s.events.filter((e) => e === "change")).toEqual([]);
    await s.stop();
  });

  it("K759-API-004 同じ瞬間に続けて変わっても change は 1 回にまとまる（同じ合図が重なって届く）", async () => {
    await use({ timing: { settleMs: 300 } });
    const c = await conv(me);
    const s = reader(await open(me, c));
    await s.until((e) => e.includes("ready"));
    hub.emit(me.id);
    hub.emit(me.id);
    hub.emit(me.id);
    await sleep(300 * 4);
    expect(s.events.filter((e) => e === "change")).toHaveLength(1);
    await s.stop();
  });

  it("K759-API-005 1 本の長さを過ぎたら end:reconnect を送って閉じる。閉じたら知らせの受け取りも外れる（置き場の関数の上限 60 秒より前に区切る）", async () => {
    await use({ timing: { lifetimeMs: 300 } });
    const c = await conv(me);
    const before = hub.size();
    const s = reader(await open(me, c));
    expect(await s.until((e) => e.includes("end:reconnect"), 2000)).toBe(true);
    expect(await s.until(() => s.ended(), 1000)).toBe(true);
    expect(hub.size()).toBe(before);
  });

  it("K759-API-006 ログインが切れた・別の人に替わったら、次の確かめで end:unauthenticated を送って閉じる。閉じたら受け取りも外れる（G-14）", async () => {
    await use({ timing: { keepaliveMs: 150 } });
    const a = await conv(me);
    const before = hub.size();
    const s = reader(await open(me, a));
    expect(await s.until((e) => e.includes("alive"), 2000)).toBe(true);
    revoked.add(me.id);
    expect(await s.until((e) => e.includes("end:unauthenticated"), 2000)).toBe(true);
    expect(await s.until(() => s.ended(), 1000)).toBe(true);
    revoked.delete(me.id);
    expect(hub.size()).toBe(before);
    // 同じ頭のまま別の人のログインに替わった
    const b = await conv(other);
    swapped.set(other.id, me.id);
    const s2 = reader(await open(other, b));
    expect(await s2.until((e) => e.includes("end:unauthenticated"), 2000)).toBe(true);
    swapped.delete(other.id);
    await s2.stop();
  });

  it("K759-API-007 知らせの接続が落ちたら down を送って閉じる（画面は見に行く形に戻る・黙って止まらない・G-15）", async () => {
    await use();
    const c = await conv(me);
    const s = reader(await open(me, c));
    await s.until((e) => e.includes("ready"));
    hub.drop();
    expect(await s.until((e) => e.includes("down"), 1000)).toBe(true);
    expect(await s.until(() => s.ended(), 1000)).toBe(true);
  });

  it("K759-API-008 S1 の失敗：知らせの接続が無い・つなげない・ログインの確かめ手段が無い：どれも 503・E-TALK-020。流れを開かず、受け取りも作らない", async () => {
    const c = await conv(me);
    for (const how of ["no-hub", "subscribe-fails", "no-fresh"] as const) {
      const calls = hub.calls;
      if (how === "no-hub") await use({ hub: null });
      else if (how === "subscribe-fails") {
        hub.failSubscribe = true;
        await use();
      } else await use({ fresh: null });
      const errors = await captureErrors(async () => {
        const r = await open(me, c);
        expect(r.status, how).toBe(503);
        const b = await json(r);
        expect(b["code"], how).toBe("E-TALK-020");
        expect(r.headers.get("content-type") ?? "", how).not.toContain("text/event-stream");
      });
      hub.failSubscribe = false;
      expect(errors, "ログに会話の id を出さない").not.toContain(c);
      if (how !== "subscribe-fails") expect(hub.calls, how).toBe(calls);
    }
    await use();
  });

  it("K759-API-009 他人の会話・別の会社の会話・無い id・消した会話：どれも 404・NOT_FOUND（欄・details を付けない＝在るかを漏らさない）。受け取りも作らない", async () => {
    await use();
    const mine = await conv(me);
    const theirs = await conv(other);
    const gone = await conv(me, { deleted: true });
    const abroad = await conv(outsider);
    const calls = hub.calls;
    for (const [label, id] of [
      ["他人", theirs],
      ["別の会社", abroad],
      ["無い id", randomUUID()],
      ["消した", gone],
    ] as const) {
      const r = await open(me, id);
      expect(r.status, label).toBe(404);
      const b = await json(r);
      expect(b["code"], label).toBe("NOT_FOUND");
      expect(Object.keys(b).sort(), label).toEqual(["code", "error"]);
    }
    expect(hub.calls).toBe(calls);
    // 自分の会話は開ける（対照）
    const ok = await open(me, mine);
    expect(ok.status).toBe(200);
    await ok.body?.cancel();
  });

  it("K759-API-010 守り：ログインしていない 401。1 分に 121 回目は 429（retry_after_sec は 1〜60 の整数）", async () => {
    await use();
    f.limits["streamConversation"] = 120;
    const c = await conv(me);
    expect((await f.req("GET", `/conversations/${c}/stream`)).status).toBe(401);
    let last: Response | null = null;
    for (let i = 0; i < 121; i++) {
      last = await open(me, c);
      if (i < 120) {
        expect(last.status).toBe(200);
        await last.body?.cancel();
      }
    }
    expect(last!.status).toBe(429);
    const sec = (await json(last!))["retry_after_sec"] as number;
    expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    f.limits["streamConversation"] = 100_000;
  });

  it("K759-API-011 取りこぼし：流れが無い間に書かれた物は change では来ない。つないで ready を受けた後に会話を読み直せば読める（画面は ready のたびに読み直す）", async () => {
    await use();
    const reading = await load("talk-read");
    Object.assign(f.hooks, reading.make({ appPool: f.pool } as unknown as HookDeps));
    f.limits["listConversationMessages"] = 100_000;
    const c = await conv(me);
    await say(me, c, "流れが無い間に届いた返事");
    const s = reader(await open(me, c));
    expect(await s.until((e) => e.includes("ready"))).toBe(true);
    expect(s.events).toEqual(["ready"]);
    const got = await f.req("GET", `/conversations/${c}/messages`, { headers: me.auth });
    expect(got.status).toBe(200);
    const texts = ((await json(got))["data"] as { text: string }[]).map((m) => m.text);
    expect(texts).toContain("流れが無い間に届いた返事");
    await s.stop();
  });

  it("K759-API-012 同じ人が 2 本開いても、どちらにも届く。片方を閉じても、残りには届き、受け取りは 1 つ残る", async () => {
    await use();
    const c = await conv(me);
    const s1 = reader(await open(me, c));
    const s2 = reader(await open(me, c));
    await s1.until((e) => e.includes("ready"));
    await s2.until((e) => e.includes("ready"));
    hub.emit(me.id);
    expect(await s1.until((e) => e.includes("change"), 1000)).toBe(true);
    expect(await s2.until((e) => e.includes("change"), 1000)).toBe(true);
    await s1.stop();
    await vi.waitFor(() => expect(hub.subs.get(me.id)?.size).toBe(1), { timeout: 2000 });
    hub.emit(me.id);
    expect(await s2.until((e) => e.filter((x) => x === "change").length === 2, 1000)).toBe(true);
    await s2.stop();
  });

  it("K759-API-013 本物の知らせの接続（packages/db/listen）でも通る：会話に書くと DB の引き金が知らせを出し、change が届く。接続が切れたら down", async () => {
    const real = createMemberHub({ url: APP_URL });
    try {
      await use({ hub: real });
      const c = await conv(me);
      const s = reader(await open(me, c));
      expect(await s.until((e) => e.includes("ready"))).toBe(true);
      await say(me, c, "本物の接続で届く返事");
      expect(await s.until((e) => e.includes("change"), 3000)).toBe(true);
      await f.admin.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where application_name = 'kaname-listen' and datname = current_database()",
      );
      expect(await s.until((e) => e.includes("down"), 3000)).toBe(true);
    } finally {
      await real.close();
      await use();
    }
  });

  it("K759-API-014 資源（G-16）：流れを 20 本同時に開いても DB の接続は 1 本も持ち続けない（確かめの文は開くときの 1 回だけ）。閉じたら受け取りは全部外れる", async () => {
    await use();
    const c = await conv(me);
    const before = hub.size();
    const streams = [];
    for (let i = 0; i < 20; i++) streams.push(reader(await open(me, c)));
    for (const s of streams) await s.until((e) => e.includes("ready"));
    expect(hub.size() - before).toBe(20);
    await sleep(100);
    expect(f.pool.totalCount - f.pool.idleCount, "流れの間に使っている DB の接続").toBe(0);
    for (const s of streams) await s.stop();
    await vi.waitFor(() => expect(hub.size()).toBe(before), { timeout: 3000 });
  });

  it("K759-API-015 失敗：会話の持ち主を確かめる DB が落ちたら 503・E-PAGE-003。流れも受け取りも作らず、ログに会話の id を出さない。直ったら開ける", async () => {
    const c = await conv(me);
    const broken = {
      query: async () => {
        throw new Error("db down");
      },
    };
    await use({ pool: broken });
    const calls = hub.calls;
    const logs = await captureErrors(async () => {
      const r = await open(me, c);
      expect(r.status).toBe(503);
      expect((await json(r))["code"]).toBe("E-PAGE-003");
    });
    expect(logs).not.toContain(c);
    expect(hub.calls).toBe(calls);
    await use();
    const ok = await open(me, c);
    expect(ok.status).toBe(200);
    await ok.body?.cancel();
  });
});

/** fn の間の console.error を貯めて返す */
async function captureErrors(fn: () => Promise<void>): Promise<string> {
  const out: string[] = [];
  const spy = vi
    .spyOn(console, "error")
    .mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" ")));
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  return out.join("\n");
}
