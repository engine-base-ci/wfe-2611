// 書きかけの下書き（K-60・D-128.138・D-128.62）。サーバーに残し（どの端末でも続きが書ける）、この PC にも写しを置く（ログインが切れても消えない）。
//   タブごとに下書きの id を持つ（sessionStorage）。2 つのタブで上書きし合わない。ワークスペースごとに分けて残し、作れたら消す
import { call } from "@/lib/api/call";

export interface DraftBody {
  scope_id?: string | null;
  kind_id?: string | null;
  title?: string;
  assignee_member_id?: string | null;
  due_on?: string;
  start_on?: string;
  priority?: "mid" | "high";
  priority_reason?: string;
  parent_ticket_id?: string | null;
  sections?: Record<string, string>;
  notify_member_ids?: string[];
}
const TAB_KEY = (ws: string) => `kaname.ticket-draft-id:${ws}`;
const COPY_KEY = (ws: string) => `kaname.ticket-draft:${ws}`;
const uuid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
      );

const read = (k: string, store: Storage): string | null => {
  try {
    return store.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null, store: Storage): void => {
  try {
    if (v === null) store.removeItem(k);
    else store.setItem(k, v);
  } catch {
    /* 残せない環境（非公開の窓）でも、サーバーの下書きは残る */
  }
};

/** このタブの下書きの id（無ければ作る） */
export function tabDraftId(ws: string): string {
  const have = read(TAB_KEY(ws), window.sessionStorage);
  if (have) return have;
  const id = uuid();
  write(TAB_KEY(ws), id, window.sessionStorage);
  return id;
}

/** 続きの下書き：このタブの id の写し → サーバーのこのタブの id → サーバーの一番新しいもの（新しいタブで開いたとき） */
export async function loadDraft(ws: string): Promise<{ id: string; body: DraftBody } | null> {
  const id = tabDraftId(ws);
  const copy = read(COPY_KEY(ws), window.localStorage);
  const local = copy ? (JSON.parse(copy) as { id: string; body: DraftBody }) : null;
  const r = await call("listMyTicketDrafts", { screenId: "tickets" });
  const list = r.ok ? (r.data as unknown as { draft_id: string; body: DraftBody }[]) : [];
  const mine = list.find((d) => d.draft_id === id);
  if (mine) return { id, body: mine.body };
  if (local && local.id === id) return local;
  // 別のタブ・別の端末で書いていたもの：このタブはまだ何も書いていなければ、それを続きとして出す（id はこのタブのまま・上書きし合わない）
  const latest = list[0];
  return latest ? { id, body: latest.body } : local ? { id, body: local.body } : null;
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** 書くたびに残す（この PC にはすぐ・サーバーには少し待ってから） */
export function saveDraft(ws: string, body: DraftBody, waitMs = 600): void {
  const id = tabDraftId(ws);
  write(COPY_KEY(ws), JSON.stringify({ id, body }), window.localStorage);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void call("saveMyTicketDraft", {
      body: { draft_id: id, body: body as Record<string, unknown> },
      screenId: "tickets",
    });
  }, waitMs);
}

/** 作れたら消す（サーバーの下書きは作る口が同じ処理で消す） */
export function clearDraft(ws: string): void {
  if (timer) clearTimeout(timer);
  write(COPY_KEY(ws), null, window.localStorage);
  write(TAB_KEY(ws), null, window.sessionStorage);
}
