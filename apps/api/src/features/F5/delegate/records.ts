// 途中の様子（reportJobProgress）で受ける中身の形（D-093.7・D-100）。前の道すじ /api/auth-ext/bridge/progress（ext.ts）の中身をそのまま移した。
//   中身の全文は受け取らない（D-100.3）。決めた欄だけを取り出し、長さも切る
export const PROGRESS_KINDS = [
  "init",
  "progress",
  "tool",
  "usage",
  "status",
  "plan",
  "limit",
  "reply",
  "blocked",
  "notice",
] as const;
export type ProgressKind = (typeof PROGRESS_KINDS)[number];
/** 返事（reply）の上限。finish の結果と同じ（会話の長い返事を切らない） */
export const REPLY_MAX = 200_000;
/** 途中の 1 行の上限 */
export const LINE_MAX = 400;

/** 片割れの字（孤立したサロゲート）。jsonb に入らない（Postgres が断って 500 になる）ので U+FFFD に置き換える */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
/** 文字の列を、片割れの字の無い形にする */
export const wellFormed = (s: string): string => s.replace(LONE_SURROGATE, "\uFFFD");
/** 字数を文字（コードポイント）で数える。契約の maxLength と同じ単位（K-144・K144-API-040） */
export const charLength = (s: string): number => [...s].length;
/** 文字（コードポイント）の単位で max 字に切る。切り目で片割れを作らない（テスター回 11 の #12） */
export const clip = (s: string, max: number): string => [...wellFormed(s)].slice(0, max).join("");

/** 道具の呼び出し 1 回（D-100.2）：名前・対象・成功／失敗・時間だけ。入力や返り値の全文は持たない */
export const toolRecord = (v: unknown) => {
  const t = (v ?? {}) as Record<string, unknown>;
  const ms = Number(t["ms"]);
  return {
    name: clip(String(t["name"] ?? ""), 60),
    target: clip(String(t["target"] ?? ""), 160),
    ok: t["ok"] === true,
    ms: Number.isFinite(ms) && ms >= 0 ? Math.round(ms) : null,
  };
};
/** 使った量（D-100.1）：数だけ。知らない欄は捨てる */
export const usageRecord = (v: unknown) => {
  const u = (v ?? {}) as Record<string, unknown>;
  const n = (k: string) => (Number.isFinite(Number(u[k])) && u[k] !== null && u[k] !== "" ? Number(u[k]) : null);
  return {
    turns: n("turns"),
    duration_ms: n("duration_ms"),
    api_ms: n("api_ms"),
    input_tokens: n("input_tokens"),
    output_tokens: n("output_tokens"),
    cache_read_tokens: n("cache_read_tokens"),
    cache_write_tokens: n("cache_write_tokens"),
    cost_usd: n("cost_usd"),
  };
};
/** 手順のチェックリスト（D-104.8）：中身・済んだか だけ */
export const planRecord = (v: unknown) => ({
  todos: (Array.isArray(v) ? v : []).slice(0, 30).map((x) => {
    const t = (x ?? {}) as Record<string, unknown>;
    const s = String(t["status"] ?? "pending");
    return {
      content: clip(String(t["content"] ?? t["activeForm"] ?? ""), 200),
      status: ["pending", "in_progress", "completed"].includes(s) ? s : "pending",
    };
  }),
});
/** 台帳で止めた道具（D-107.4・D-107.5）：道具の名前・宛先のドメイン・サービス・対象（切る） */
export const blockedRecord = (v: unknown) => {
  const x = (v ?? {}) as Record<string, unknown>;
  return {
    tool: clip(String(x["tool"] ?? ""), 80),
    domain: clip(String(x["domain"] ?? ""), 200),
    service: clip(String(x["service"] ?? ""), 120),
    target: clip(String(x["target"] ?? ""), 300),
  };
};
/** 使用量（D-104.16）：枠・割合・戻る時刻 だけ */
export const limitRecord = (v: unknown) => ({
  windows: (Array.isArray(v) ? v : []).slice(0, 4).flatMap((x) => {
    const w = (x ?? {}) as Record<string, unknown>;
    const win = String(w["window"] ?? "");
    const u = Number(w["utilization"]);
    const r = Number(w["resets_at"]);
    return ["five_hour", "week"].includes(win) && Number.isFinite(u) && Number.isFinite(r)
      ? [{ window: win, utilization: Math.max(0, Math.min(1, u)), resets_at: r }]
      : [];
  }),
});

/** 途中の様子の 1 件を、決めた欄だけの中身にする */
export function progressPayload(kind: ProgressKind, b: Record<string, unknown>): Record<string, unknown> {
  const text = typeof b["text"] === "string" ? b["text"] : String(b["text"] ?? "");
  switch (kind) {
    case "init":
      return {
        agent_session_id: typeof b["agent_session_id"] === "string" ? clip(b["agent_session_id"], 200) : null,
        model: typeof b["model"] === "string" && /^[a-z0-9.-]{1,60}$/i.test(b["model"]) ? b["model"] : null,
      };
    case "tool":
      return toolRecord(b["tool"]);
    case "usage":
      return usageRecord(b["usage"]);
    case "plan":
      return planRecord(b["todos"]);
    case "limit":
      return limitRecord(b["windows"]);
    case "reply":
      return { text: clip(text, REPLY_MAX) };
    case "blocked":
      return blockedRecord(b["blocked"]);
    default:
      return { text: clip(text, LINE_MAX) };
  }
}
