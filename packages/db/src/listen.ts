// 会話のいまが変わった知らせを受ける 1 本の専用接続（関門 C2 の中・台帳 X-008・D-113）。
//   DB の pg_notify('kaname_agent', <member id>) を受け、その人の画面の流れ（/agent/stream）にだけ「変わった」と渡す。
//   API 1 台につき 1 本。人ごと・画面ごとには持たない（G-16：同時の数を接続の数に比例させない）。
//   Transaction pooler（6543）では LISTEN が効かないので、直の接続か Session pooler の URL を使う。
//   黙って止まらない（G-15）：自分宛ての知らせを定期的に打って戻ってくるか確かめ、戻らなければ落ちたことにして
//   全部の流れに伝える（画面は見に行く形に戻る）。次に誰かが流れを開いたらつなぎ直す。
import pg from "pg";
import { UUID_RE } from "./id.js";

export const AGENT_CHANNEL = "kaname_agent";
/** DB の側から見分ける名前（見張り・試験で「知らせの接続」だけを指す） */
export const LISTEN_APP_NAME = "kaname-listen";

export interface MemberListener {
  /** その人の会話が変わった */
  change: () => void;
  /** 知らせの接続が落ちた。この流れは閉じる（画面は見に行く形に戻り、あとでつなぎ直す） */
  down: () => void;
}
export interface MemberHub {
  /** その人の知らせを受け始める。LISTEN が効くまで待つ。つながらなければ例外 */
  subscribe: (member: string, l: MemberListener) => Promise<() => void>;
  /** 受けている人の数（試験と見張り用） */
  size: () => number;
  close: () => Promise<void>;
}
export interface HubOptions {
  url: string;
  channel?: string;
  /** 自分宛ての確かめの間隔（既定 20 秒）と、戻ってくるまで待つ長さ（既定 5 秒） */
  pingMs?: number;
  pongMs?: number;
  /** 誰も受けていない間、接続を持ち続ける長さ（既定 60 秒）。過ぎたら閉じる */
  idleMs?: number;
  connectTimeoutMs?: number;
}

const UUID = UUID_RE; // 正式な uuid の正本（id.ts・K-145）

export function createMemberHub(o: HubOptions): MemberHub {
  const channel = o.channel ?? AGENT_CHANNEL;
  const pingMs = o.pingMs ?? 20_000;
  const pongMs = o.pongMs ?? 5_000;
  const idleMs = o.idleMs ?? 60_000;
  const subs = new Map<string, Set<MemberListener>>();
  let client: pg.Client | null = null;
  let ready: Promise<pg.Client> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let pongTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let waitingPong: string | null = null;
  let seq = 0;

  const count = () => [...subs.values()].reduce((n, s) => n + s.size, 0);

  const stopTimers = () => {
    if (pingTimer) clearInterval(pingTimer);
    if (pongTimer) clearTimeout(pongTimer);
    if (idleTimer) clearTimeout(idleTimer);
    pingTimer = pongTimer = idleTimer = null;
    waitingPong = null;
  };

  /** 落ちた：受けている全員に伝えて手放す。次の subscribe でつなぎ直す */
  const fail = (why: string) => {
    const c = client;
    client = null;
    ready = null;
    stopTimers();
    if (c) {
      c.removeAllListeners("notification");
      c.on("error", () => undefined);
      void c.end().catch(() => undefined);
    }
    const all = [...subs.values()].flatMap((s) => [...s]);
    subs.clear();
    if (all.length) console.error(`[db listen] 知らせの接続が落ちました（${why}）。${all.length} 本の流れを閉じます`);
    for (const l of all) l.down();
  };

  const ping = () => {
    if (!client || waitingPong) return;
    const token = `ping:${++seq}`;
    waitingPong = token;
    pongTimer = setTimeout(() => fail("確かめの知らせが戻りません"), pongMs);
    client.query("select pg_notify($1, $2)", [channel, token]).catch((e: Error) => fail(e.message));
  };

  const connect = (): Promise<pg.Client> => {
    ready ??= (async () => {
      const c = new pg.Client({
        connectionString: o.url,
        connectionTimeoutMillis: o.connectTimeoutMs ?? 5_000,
        application_name: LISTEN_APP_NAME,
      });
      c.on("error", (e) => fail(e.message));
      c.on("end", () => {
        if (client === c) fail("接続が切れました");
      });
      c.on("notification", (m) => {
        if (m.channel !== channel || !m.payload) return;
        if (m.payload === waitingPong) {
          waitingPong = null;
          if (pongTimer) clearTimeout(pongTimer);
          pongTimer = null;
          return;
        }
        if (!UUID.test(m.payload)) return;
        for (const l of subs.get(m.payload.toLowerCase()) ?? []) l.change();
      });
      try {
        await c.connect();
        await c.query(`listen ${channel}`);
      } catch (e) {
        c.on("error", () => undefined);
        void c.end().catch(() => undefined);
        ready = null;
        throw e;
      }
      client = c;
      pingTimer = setInterval(ping, pingMs);
      return c;
    })();
    return ready;
  };

  const idleCheck = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    if (count() > 0 || !ready) return;
    idleTimer = setTimeout(() => {
      if (count() > 0) return;
      const c = client;
      client = null;
      ready = null;
      stopTimers();
      if (c) void c.end().catch(() => undefined);
    }, idleMs);
  };

  return {
    async subscribe(member, l) {
      if (!UUID.test(member)) throw new Error("member id の形が違います");
      const key = member.toLowerCase();
      await connect();
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
      const set = subs.get(key) ?? new Set<MemberListener>();
      set.add(l);
      subs.set(key, set);
      let on = true;
      return () => {
        if (!on) return;
        on = false;
        const s = subs.get(key);
        s?.delete(l);
        if (s && !s.size) subs.delete(key);
        idleCheck();
      };
    },
    size: count,
    async close() {
      const c = client;
      client = null;
      ready = null;
      stopTimers();
      subs.clear();
      if (c) await c.end().catch(() => undefined);
    },
  };
}
