// チケットを作る（K-60）の入力の形の確かめ。同じ会社か・書けるか・必須の区画は DB（app.ticket_create）が確かめる。
//   表記ゆらぎ（全角半角・前後の空白）は入口（op.ts の normalize）が揃えた後。前後の空白だけの題名は空
export const TITLE_MAX = 200;
export const SECTION_MAX = 20_000;
export const NOTIFY_MAX = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface Detail {
  field: string;
  message: string;
  code?: string;
}
export type Checked = { ok: true; value: Record<string, unknown> } | { ok: false; details: Detail[] };

/** 日本時間の今日（期限は日付だけ・時差でずれない・D-128.130） */
export function todayJst(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}
const isDate = (v: unknown): v is string =>
  typeof v === "string" &&
  DATE.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

export function checkCreate(input: Record<string, unknown>, today: string): Checked {
  const d: Detail[] = [];
  const title = typeof input["title"] === "string" ? input["title"].trim() : "";
  if (!title) d.push({ field: "title", message: "題名を入れてください" });
  else if ([...title].length > TITLE_MAX) d.push({ field: "title", message: `題名は ${TITLE_MAX} 文字までです` });
  for (const [f, label] of [
    ["scope_id", "グループを選んでください"],
    ["kind_id", "種別を選んでください"],
    ["assignee_member_id", "担当者を選んでください"],
  ] as const)
    if (typeof input[f] !== "string" || !UUID.test(input[f] as string)) d.push({ field: f, message: label });
  const due = input["due_on"];
  if (due === undefined || due === "") d.push({ field: "due_on", message: "期限を入れてください" });
  else if (!isDate(due)) d.push({ field: "due_on", message: "期限は日付で入れてください" });
  else if (due < today)
    d.push({ field: "due_on", message: "期限は今日か、それより後の日にしてください", code: "E-VAL-012" });
  const start = input["start_on"];
  if (start !== undefined && start !== "" && !isDate(start))
    d.push({ field: "start_on", message: "開始は日付で入れてください" });
  else if (isDate(start) && isDate(due) && start > due)
    d.push({ field: "start_on", message: "開始は期限より前の日にしてください" });
  const priority = input["priority"] === undefined || input["priority"] === "" ? "mid" : input["priority"];
  if (priority !== "mid" && priority !== "high") d.push({ field: "priority", message: "優先度は 中 か 高 です" });
  const reason = typeof input["priority_reason"] === "string" ? input["priority_reason"].trim() : "";
  if (priority === "high" && !reason)
    d.push({ field: "priority_reason", message: "優先度を高にする理由を書いてください" });
  let estimate: number | null = null;
  const est = input["estimate_minutes"];
  if (est !== undefined && est !== null && est !== "") {
    const n = typeof est === "number" ? est : typeof est === "string" && /^\d+$/.test(est) ? Number(est) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > 100_000)
      d.push({ field: "estimate_minutes", message: "見込み時間は 0 以上の分で入れてください" });
    else estimate = n;
  }
  const parent = input["parent_ticket_id"];
  if (parent !== undefined && parent !== "" && (typeof parent !== "string" || !UUID.test(parent)))
    d.push({ field: "parent_ticket_id", message: "親のチケットを選び直してください" });
  const sections: Record<string, string> = {};
  const raw = input["sections"] ?? {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    d.push({ field: "sections", message: "区画の形が違います" });
  else
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!/^[a-z][a-z0-9_]{0,40}$/.test(k)) d.push({ field: `sections.${k}`, message: "区画の名前が違います" });
      else if (typeof v !== "string") d.push({ field: `sections.${k}`, message: "区画は文字で書いてください" });
      else if (v.length > SECTION_MAX)
        d.push({ field: `sections.${k}`, message: `区画は ${SECTION_MAX} 文字までです` });
      else sections[k] = v.trim();
    }
  const notify = input["notify_member_ids"] ?? [];
  if (
    !Array.isArray(notify) ||
    notify.length > NOTIFY_MAX ||
    notify.some((x) => typeof x !== "string" || !UUID.test(x))
  )
    d.push({ field: "notify_member_ids", message: `知らせる人は ${NOTIFY_MAX} 人まで選べます` });
  const draft = input["draft_id"];
  if (draft !== undefined && draft !== "" && (typeof draft !== "string" || !UUID.test(draft)))
    d.push({ field: "draft_id", message: "uuid" });
  // 続きとして出した元の下書き（別のタブ・別の端末で書いていたもの）。作ったら同じ処理で消す（本人の分だけ・K-60）
  const source = input["source_draft_id"];
  if (source !== undefined && source !== "" && (typeof source !== "string" || !UUID.test(source)))
    d.push({ field: "source_draft_id", message: "uuid" });
  if (d.length) return { ok: false, details: d };
  return {
    ok: true,
    value: {
      scope_id: input["scope_id"],
      kind_id: input["kind_id"],
      title,
      assignee_member_id: input["assignee_member_id"],
      due_on: due,
      start_on: isDate(start) ? start : null,
      priority,
      priority_reason: reason || null,
      estimate_minutes: estimate,
      parent_ticket_id: parent || null,
      sections,
      notify_member_ids: notify,
      draft_id: draft || null,
      source_draft_id: source || null,
    },
  };
}
