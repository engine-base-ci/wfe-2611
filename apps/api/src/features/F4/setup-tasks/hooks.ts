// はじめにやることの口（K-250）：listSetupTasks・dismissSetupTasks。項目は決定どおり 3 つ（D-125.146）。
//   passkey：パスキーの機能ができるまで使えない（available false・行き先 null）・済みにしない（2 段階認証でも済みにしない・D-145.11）
//   pc：知らせが一度でも届き、外していない PC が在れば済み。全部外したら済んでいないに戻す・電源を切っただけなら済み（D-145.12・answer=20e64d6fae6d）。アカウント全体で数える（D-128.137・app.setup_pc_done）
//   credentials：任意（D-145.13）。今の会社で自分が預け、取り消し・消していない物が 1 つ以上で済み（PM の決め）。「あとで」で飛ばせる（skipped）
//   閉じる・飛ばすは自分の今の会社の members の行だけを書く（関門 C2・security definer の関数 app.setup_dismiss・app.setup_skip）。
//   セッションの人が今の会社のメンバーでなければ、どちらの口も 403 で何も書かない（K250-API-014）。
//   答えに預けた物の参照・PC の印を入れない。ログに本人の値を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Row } from "@kaname/db/repository";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";

/** 「あとで」で飛ばせる任意の項目 */
export const OPTIONAL_KEYS: readonly string[] = ["credentials"];

const ITEMS = {
  passkey: { label: "パスキーを付ける", desc: "まだ付けられません。数には入れていません", href: null },
  pc: {
    label: "PC をつなぐ",
    desc: "分身はあなたの PC で動く。つなぐまで、分身は話すだけで実行はしない",
    href: "/setup/bridge",
  },
  credentials: {
    label: "ログイン情報を預ける",
    desc: "分身に使わせるメール・サービスのログイン。値は誰にも見せない",
    href: "/settings/credentials",
  },
} as const;

interface StateRow {
  dismissed: boolean;
  skipped: string[];
  pc_done: boolean;
  credentials_done: boolean;
}

// 自分の今の会社の行（行の守りの中で読む）と 3 つの済みを 1 本の select で。行が無ければ 0 行（＝今の会社のメンバーでない）
const STATE_SQL = `
select m.setup_dismissed_at is not null as dismissed,
       m.setup_skipped_keys as skipped,
       app.setup_pc_done(m.id) as pc_done,
       exists (select 1 from credentials c
                where c.tenant_id = app.tenant_id() and c.owner_member_id = m.id
                  and c.revoked_at is null and c.deleted_at is null) as credentials_done
  from members m
 where m.id = app.user_id() and m.tenant_id = app.tenant_id() and m.deleted_at is null`;

const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };

const invalidKey = (message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field: "key", message }] },
});

const toItems = (s: StateRow) => {
  const skipped = new Set(s.skipped);
  return [
    { key: "passkey", ...ITEMS.passkey, done: false, available: false, optional: false, skipped: false },
    { key: "pc", ...ITEMS.pc, done: s.pc_done, available: true, optional: false, skipped: false },
    {
      key: "credentials",
      ...ITEMS.credentials,
      done: s.credentials_done,
      available: true,
      optional: true,
      skipped: skipped.has("credentials"),
    },
  ];
};

/** 飛ばす key を表記ゆらぎをそろえて読む（入口が NFKC と前後の空白を済ませている。ここでも同じにしてから小文字にする） */
export function normalizeKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  return v.normalize("NFKC").trim().toLowerCase();
}

export function createSetupTaskHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    listSetupTasks: {
      before: async (a: HookArgs) => {
        const rows = await withTenant(appPool, a.ctx, async (cl) => (await cl.query<StateRow>(STATE_SQL)).rows);
        const s = rows[0];
        if (!s) return FORBIDDEN;
        return { status: 200, body: { data: toItems(s), meta: { dismissed: s.dismissed } } };
      },
    },
    dismissSetupTasks: {
      // 知らない欄はその欄の名前で 422（入口の strict な形は欄の名前を出さないので、ここで先に断る）。形の確かめは入口が続けてする
      input: (raw: unknown) => {
        if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { input: raw as Row };
        const unknown = Object.keys(raw).filter((k) => k !== "key");
        if (unknown.length === 0) return { input: raw as Row };
        return {
          reply: {
            status: 422,
            body: {
              error: "validation_failed",
              code: "VALIDATION_ERROR",
              details: unknown.map((field) => ({ field, message: "知らない欄です" })),
            },
          },
        };
      },
      before: async (a: HookArgs) => {
        const hasKey = Object.prototype.hasOwnProperty.call(a.input, "key") && a.input["key"] !== undefined;
        const key = hasKey ? normalizeKey(a.input["key"]) : null;
        return withTenant(appPool, a.ctx, async (cl) => {
          const me = await cl.query<{ ok: boolean }>(
            "select true as ok from members where id = app.user_id() and tenant_id = app.tenant_id() and deleted_at is null",
          );
          if (me.rowCount === 0) return FORBIDDEN;
          if (hasKey) {
            if (!key) return invalidKey("空です");
            if (!OPTIONAL_KEYS.includes(key)) return invalidKey("あとでにできる項目ではありません");
            const r = await cl.query<{ ok: boolean }>("select app.setup_skip(app.user_id(), $1) as ok", [key]);
            if (!r.rows[0]?.ok) return FORBIDDEN;
          } else {
            const r = await cl.query<{ ok: boolean }>("select app.setup_dismiss(app.user_id()) as ok");
            if (!r.rows[0]?.ok) return FORBIDDEN;
          }
          const now = await cl.query<{ dismissed: boolean; skipped: string[] }>(
            "select setup_dismissed_at is not null as dismissed, setup_skipped_keys as skipped from members where id = app.user_id() and tenant_id = app.tenant_id()",
          );
          const row = now.rows[0]!;
          return { status: 201, body: { data: { dismissed: row.dismissed, skipped: row.skipped } } };
        });
      },
    },
  };
}
