"use client";
// 確認項目の口の道具（K-450）。詳細の欄が「開く」を押したとき 1 回だけ listTestSpecs を読み、行の版（version）を覚える。
//   足す（createTestSpec）・付け外す／直す（updateTestSpec）・外す（deleteTestSpec）は 1 回ずつ。送っている間は同じ行の操作を止める。
//   断りの振り分け（D-148.30〜38 の分け方）：行の操作は 5 秒で消える小さな知らせ。409 E-SPEC-020・021・022 と 404 のときだけ一覧を 1 回読み直す。
//   直した後の行は答えの行で更新する（読み直しの口を増やさない）
import { useCallback, useRef, useState } from "react";
import { useNotify } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { refusalText } from "./spec-text";

export interface SpecRowData {
  id: string;
  title: string;
  checked: boolean;
  position: number;
  source: string;
  version: number;
  /** 必ず守るから入った行の出どころのページ（今も必ず守るで生きている行だけ・K-726）。前の答えには無い */
  source_page?: { id: string; title: string } | null;
}
export type ListState = "idle" | "loading" | "ok" | "error";
/** 足した結果：通った／欄の下の字（422）／小窓の上の赤い箱 */
export type AddResult = { ok: true; row: SpecRowData | null } | { ok: false; field?: string; box?: string };
/** 文を直した結果：通った／入力を開いたまま／入力を閉じる／欄の下の字 */
export type EditResult = "ok" | "keep" | "close" | { field: string };

const SCREEN = "tickets";
/** 断られたあと一覧を読み直す番号（行が変わった・消えた） */
const RELOAD_CODES = new Set(["E-SPEC-020", "E-SPEC-021", "E-SPEC-022"]);
const needsReload = (r: CallErr): boolean => r.status === 404 || (r.status === 409 && RELOAD_CODES.has(r.code));

/** 出どころのページ（id と題名が文字のときだけ）。鍵が無い前の答えは鍵を付けない（K-703） */
function sourcePageOf(o: Record<string, unknown>): Pick<SpecRowData, "source_page"> {
  if (!("source_page" in o)) return {};
  const p = o["source_page"] as { id?: unknown; title?: unknown } | null;
  return {
    source_page: p && typeof p.id === "string" && typeof p.title === "string" ? { id: p.id, title: p.title } : null,
  };
}

function toRow(v: unknown): SpecRowData {
  const o = (v ?? {}) as Partial<SpecRowData>;
  return {
    ...sourcePageOf(o as Record<string, unknown>),
    id: String(o.id ?? ""),
    title: String(o.title ?? ""),
    checked: o.checked === true,
    position: Number(o.position ?? 0),
    source: String(o.source ?? "manual"),
    version: Number(o.version ?? 1),
  };
}

/** 足す（詳細・小窓だけの形の両方が使う）。422 は欄の下、ほかは小窓の上の箱 */
export async function createSpec(ticketId: string, title: string): Promise<AddResult> {
  const r = await call("createTestSpec", { params: { id: ticketId }, body: { title }, screenId: SCREEN });
  if (r.ok) return { ok: true, row: toRow(r.data) };
  if (r.status === 422) return { ok: false, field: r.fields["title"] ?? r.message ?? refusalText(r) };
  return { ok: false, box: refusalText(r) };
}

export function useTestSpecs(ticketId: string | undefined) {
  const notify = useNotify();
  const [state, setState] = useState<ListState>("idle");
  const [rows, setRows] = useState<SpecRowData[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const busyRef = useRef<Set<string>>(new Set());

  const load = useCallback(async (): Promise<void> => {
    if (!ticketId) return;
    setState("loading");
    const r = await call("listTestSpecs", { params: { id: ticketId }, screenId: SCREEN });
    if (!r.ok) {
      setState("error");
      return;
    }
    const list = (Array.isArray(r.data) ? r.data : []).map(toRow).sort((a, b) => a.position - b.position);
    setRows(list);
    setCanEdit(r.meta["can_edit"] === true);
    setState("ok");
  }, [ticketId]);

  /** 同じ行の操作を 1 つずつ。走っていれば false */
  const begin = (id: string): boolean => {
    if (busyRef.current.has(id)) return false;
    busyRef.current = new Set(busyRef.current).add(id);
    setBusy(busyRef.current);
    return true;
  };
  const end = (id: string): void => {
    const next = new Set(busyRef.current);
    next.delete(id);
    busyRef.current = next;
    setBusy(next);
  };
  const replace = (row: SpecRowData): void => setRows((rs) => rs.map((s) => (s.id === row.id ? row : s)));

  /** 行の操作の断り：知らせを出し、要れば一覧を読み直す */
  const refuse = async (r: CallErr): Promise<void> => {
    notify(refusalText(r));
    if (needsReload(r)) await load();
  };

  const add = async (title: string): Promise<AddResult> => {
    if (!ticketId) return { ok: false, box: refusalText({ kind: "not_found", code: "E-PAGE-001", status: 404 }) };
    const res = await createSpec(ticketId, title);
    if (res.ok && res.row) {
      const row = res.row;
      setRows((rs) => [...rs, row]);
    }
    return res;
  };

  /** チェックを付け外す。箱はすぐ替え（押した手応え）、断られたら元に戻す */
  const check = (row: SpecRowData, checked: boolean): void => {
    if (!begin(row.id)) return;
    replace({ ...row, checked });
    void (async () => {
      const r = await call("updateTestSpec", {
        params: { id: row.id },
        body: { version: row.version, checked },
        screenId: SCREEN,
      });
      if (r.ok) replace(toRow(r.data));
      else {
        replace(row);
        await refuse(r);
      }
      end(row.id);
    })();
  };

  const edit = async (row: SpecRowData, title: string): Promise<EditResult> => {
    if (!begin(row.id)) return "keep";
    try {
      const r = await call("updateTestSpec", {
        params: { id: row.id },
        body: { version: row.version, title },
        screenId: SCREEN,
      });
      if (r.ok) {
        replace(toRow(r.data));
        return "ok";
      }
      if (r.status === 422) return { field: r.fields["title"] ?? r.message ?? refusalText(r) };
      await refuse(r);
      // 020 と 503 は行がまだ直せるので入力を残す。021・022・001・403・404 は閉じる
      return (r.status === 409 && r.code === "E-SPEC-020") || r.kind === "failed" ? "keep" : "close";
    } finally {
      end(row.id);
    }
  };

  const remove = (row: SpecRowData): void => {
    if (!begin(row.id)) return;
    void (async () => {
      const r = await call("deleteTestSpec", { params: { id: row.id }, screenId: SCREEN });
      if (r.ok) setRows((rs) => rs.filter((s) => s.id !== row.id));
      else await refuse(r);
      end(row.id);
    })();
  };

  return { state, rows, canEdit, busy, load, add, check, edit, remove };
}
