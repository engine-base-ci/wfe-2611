"use client";
// 詳細の「…」から消す・消した直後に元に戻す（K-590・F7・段 8・A116・D-151.14〜16）。小窓の状態と口（下見・消す・戻す）をまとめる。
//   下見は「消す」を押した時に 1 回だけ読む（「…」を開いただけでは読まない・K590-UI-024）。消せる人は画面で決めず、口の答えで出し分ける（D-125.62）。
//   断りの置き場（D-148.31）：移す先の断り（E-DEL-011・012・014）は親を探す欄の下の赤い字／ほかの断り（E-DEL-001・013・010）は小窓の上の橙の箱／
//   送れない（5xx・つながらない）は赤い箱で E-PAGE-007 の 1 文目。どれも書いた理由・選んだ扱いを消さない。404（もう無い）は小窓を閉じて詳細を読み直す。
//   消せたら「元に戻す」つきのお知らせを先に出してから一覧へ移る（お知らせは頁の外の Toaster・K-466）。戻す関数は番号と id を閉じ込め、消えた画面の状態に頼らない
import type { Ops } from "@kaname/contracts";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { PAGE_ERROR, errorCodeOf, errorText, notify } from "@/components/k";
import type { SlotTicket } from "@/features/F4/create-ticket/detail-slots";
import { call, type CallErr } from "@/lib/api/call";
import { REASON_MAX, type ChildChoice, type DeletePreviewData } from "./delete-body";
import { showUndoToast } from "./undo-toast";

type Preview = Ops["previewTicketDelete"]["data"];
type Tone = "warn" | "danger";
type Router = ReturnType<typeof useRouter>;

/** 戻せる日数（D-151.16・30 日） */
const RESTORABLE_DAYS = 30;
const SCREEN = "tickets";
/** 移す先の断り（親を探す欄の下に出す） */
const PARENT_CODES = new Set(["E-DEL-011", "E-DEL-012", "E-DEL-014"]);
/** 子・孫が足された（下見を読み直して扱いを選ぶ小窓に替える） */
const NEED_CHOICE = "E-DEL-010";
/** 題名の行の「…」（K-458 の箱）。閉じた後に焦点を戻す */
const MORE_BTN = ".k-f4-more-btn";

export type DeleteView =
  | { kind: "closed" }
  | { kind: "refused"; target: string; notice: string; tone: Tone }
  | { kind: "ready"; target: string; data: DeletePreviewData; hasChildren: boolean };

export interface DeleteForm {
  choice: ChildChoice;
  parentId: string | null;
  reason: string;
  notice?: { text: string; tone: Tone } | undefined;
  parentError?: string | undefined;
  busy: boolean;
}

interface Info {
  id: string;
  number: string;
  title: string;
  approver: string | undefined;
}

const EMPTY: DeleteForm = { choice: "move", parentId: null, reason: "", busy: false };
const n = (v: number | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
/** 正本の字（全文） */
const textOf = (code: string): string => errorText(code).entry.message;
/** 送れない（5xx・つながらない）の字：E-PAGE-007 の 1 文目 */
const DOWN = (): string => errorText(PAGE_ERROR.loadFailed).title;

function infoOf(t: SlotTicket): Info {
  const d = t.detail as {
    ticket?: { number?: unknown; title?: unknown };
    approval?: { approver_name?: unknown } | null;
  };
  const name = d.approval?.approver_name;
  return {
    id: t.id,
    number: String(d.ticket?.number ?? ""),
    title: String(d.ticket?.title ?? ""),
    approver: typeof name === "string" && name ? name : undefined,
  };
}

/** 下見の件数を部品の形に写す。「一緒に消す」を選んでいる間だけ子・孫の承認待ち・走っている実行を足す（K-488） */
export function dataOf(p: Preview, info: Info, choice: ChildChoice | undefined): DeletePreviewData {
  const cascade = choice === "cascade";
  const addApprovals = cascade ? n(p.descendant_pending_approvals) : 0;
  const children = n(p.children);
  const grandchildren = Math.max(0, n(p.descendants) - children);
  return {
    number: info.number,
    title: info.title,
    approvals: n(p.pending_approvals) + addApprovals,
    approvalTo: addApprovals > 0 ? undefined : info.approver,
    children,
    grandchildren,
    links: n(p.links),
    attachments: n(p.attachments),
    artifacts: n(p.artifacts),
    runs: n(p.running_runs) + (cascade ? n(p.descendant_running_runs) : 0),
    restorableDays: RESTORABLE_DAYS,
  };
}

/** 理由：NFKC と前後の空白をそろえ、400 字で止める */
export function cleanReason(v: string): string {
  return [...v.normalize("NFKC").trim()].slice(0, REASON_MAX).join("");
}

function focusMore(): void {
  const go = () => document.querySelector<HTMLButtonElement>(MORE_BTN)?.focus();
  go();
  requestAnimationFrame(() => requestAnimationFrame(go));
}

/** お知らせの「元に戻す」。消えた画面に頼らず、番号と id だけで戻す口を 1 回呼ぶ */
function undoOf(info: Info, router: Router): () => void {
  return () => {
    void call("restoreTicket", { params: { id: info.id }, body: {}, screenId: SCREEN })
      .catch(() => null)
      .then((r) => {
        if (r?.ok) {
          router.push(`/tickets/${info.id}` as Route);
          notify(`${info.number} を元に戻しました`);
          return;
        }
        notify(r ? textOf(errorCodeOf(r)) : DOWN(), { type: "error" });
      });
  };
}

/** 消す口の問い合わせ（子・孫が無ければ children を付けない・理由が空なら付けない） */
function queryOf(hasChildren: boolean, f: DeleteForm): Ops["deleteTicket"]["query"] {
  const reason = cleanReason(f.reason);
  return {
    ...(hasChildren ? { children: f.choice } : {}),
    ...(hasChildren && f.choice === "move" && f.parentId ? { parent_id: f.parentId } : {}),
    ...(reason ? { reason } : {}),
  };
}

export function useTicketDelete(ticket: SlotTicket | undefined) {
  const router = useRouter();
  const [view, setView] = useState<DeleteView>({ kind: "closed" });
  const [form, setForm] = useState<DeleteForm>(EMPTY);
  const preview = useRef<Preview | null>(null);
  const sending = useRef(false);
  const info = ticket ? infoOf(ticket) : null;
  const target = info ? `${info.number} ${info.title}` : "";

  /** 下見を読んで小窓を出す（keep＝理由と知らせを残したまま扱いを選ぶ小窓に替える） */
  const readPreview = useCallback(
    async (keep?: Pick<DeleteForm, "reason" | "notice">) => {
      if (!ticket || !info) return;
      const r = await call("previewTicketDelete", { params: { id: ticket.id }, screenId: SCREEN }).catch(() => null);
      if (!r || !r.ok) {
        const code = r ? errorCodeOf(r) : PAGE_ERROR.loadFailed;
        const denied = code.startsWith("E-DEL-");
        setView({ kind: "refused", target, notice: denied ? textOf(code) : DOWN(), tone: denied ? "warn" : "danger" });
        return;
      }
      preview.current = r.data;
      const hasChildren = n(r.data.children) > 0;
      setForm({ ...EMPTY, ...(keep ?? {}) });
      setView({ kind: "ready", target, data: dataOf(r.data, info, hasChildren ? "move" : undefined), hasChildren });
    },
    [ticket, info, target],
  );

  const close = useCallback(() => {
    setView({ kind: "closed" });
    setForm(EMPTY);
    preview.current = null;
    focusMore();
  }, []);

  const onOpenChange = (open: boolean) => {
    if (!open && !form.busy) close();
  };

  const setChoice = (choice: ChildChoice) => {
    setForm((f) => ({ ...f, choice, parentError: undefined }));
    if (view.kind === "ready" && preview.current && info)
      setView({ ...view, data: dataOf(preview.current, info, choice) });
  };
  const setParent = (parentId: string | null) => setForm((f) => ({ ...f, parentId, parentError: undefined }));
  const setReason = (v: string) => setForm((f) => ({ ...f, reason: [...v].slice(0, REASON_MAX).join("") }));

  /** 消す口の断り・失敗の出し分け */
  const refused = async (r: CallErr | null) => {
    const code = r ? errorCodeOf(r) : PAGE_ERROR.loadFailed;
    if (r && PARENT_CODES.has(code)) return setForm((f) => ({ ...f, busy: false, parentError: textOf(code) }));
    if (r && code === NEED_CHOICE)
      return readPreview({ reason: form.reason, notice: { text: textOf(code), tone: "warn" } });
    if (r && r.status === 404) {
      close();
      return ticket?.reload();
    }
    const denied = !!r && code.startsWith("E-DEL-");
    setForm((f) => ({
      ...f,
      busy: false,
      notice: { text: denied ? textOf(code) : DOWN(), tone: denied ? "warn" : "danger" },
    }));
  };

  const confirm = async () => {
    if (!ticket || !info || view.kind !== "ready" || sending.current) return;
    if (view.hasChildren && form.choice === "move" && !form.parentId) return;
    sending.current = true;
    setForm((f) => ({ ...f, busy: true, notice: undefined, parentError: undefined }));
    const query = queryOf(view.hasChildren, form);
    const r = await call("deleteTicket", { params: { id: ticket.id }, query, screenId: SCREEN }).catch(() => null);
    sending.current = false;
    if (r?.ok) {
      showUndoToast(`${info.number} を消しました`, undoOf(info, router));
      setView({ kind: "closed" });
      setForm(EMPTY);
      router.push("/tickets" as Route);
      return;
    }
    await refused(r);
  };

  const start = () => {
    if (view.kind === "closed") void readPreview();
  };

  return { view, form, start, confirm, onOpenChange, setChoice, setParent, setReason };
}
