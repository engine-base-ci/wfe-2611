// 会話と記憶を書く操作の本体。画面の口（/api/auth-ext/agent/*）と契約の口（/api/v1/conversations・/api/v1/memories）が
// 同じここを通る。書き込みは DB の関数（security definer）の中で本人かどうかを判定するので、口が 2 つでも道は 1 本
import type pg from "pg";

const one = async <T>(pool: pg.Pool, sql: string, args: unknown[]): Promise<T | null> =>
  ((await pool.query(sql, args)).rows[0] as T | undefined) ?? null;

/** 新しく話す（D-104.1）。本人でなければ null */
export async function newConversation(pool: pg.Pool, userId: string, incognito: boolean): Promise<string | null> {
  return (
    (await one<{ id: string | null }>(pool, "select app.agent_new_conversation($1, $2) as id", [userId, incognito]))
      ?.id ?? null
  );
}

/** 名前・星・記憶に使わない を変える。null は「変えない」。自分の会話でなければ false */
export async function setConversation(
  pool: pg.Pool,
  userId: string,
  id: string,
  v: { title: string | null; starred: boolean | null; incognito: boolean | null },
): Promise<boolean> {
  const r = await one<{ ok: boolean }>(pool, "select app.agent_conversation_set($1, $2, $3, $4, $5) as ok", [
    userId,
    id,
    v.title,
    v.starred,
    v.incognito,
  ]);
  return r?.ok === true;
}

/** 会話を消す。自分の会話でなければ false */
export async function deleteConversation(pool: pg.Pool, userId: string, id: string): Promise<boolean> {
  return (
    (await one<{ ok: boolean }>(pool, "select app.agent_conversation_delete($1, $2) as ok", [userId, id]))?.ok === true
  );
}

/** 記憶を直す（自分の記憶だけ）。直せなければ false */
export async function editMemory(
  pool: pg.Pool,
  userId: string,
  id: string,
  title: string | null,
  body: string,
): Promise<boolean> {
  return (
    (await one<{ ok: boolean }>(pool, "select app.agent_memory_edit($1, $2, $3, $4) as ok", [userId, id, title, body]))
      ?.ok === true
  );
}
