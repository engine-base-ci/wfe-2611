"use client";
// 版と差分の頁の状態と口（K-449）。
//   開くとき：getTicket と listTicketVersions を同時に始める（直列の段 1）。項目の変更（listTicketItemChanges）は「項目の変更」を選んだときだけ読む。
//   比べ方（of・from・to）は URL に持ち、選び直しは履歴を積まずに URL を替える。選び直すたびに、その口を 1 回読み直す（読んだ組を覚えない）。
//   同じ口を同時に 2 回呼ばない：読む口は問い合わせの器（fetchQuery）を通す（React の二度の実行でも口は 1 回）。
//   戻す（本文だけ）：確かめの小窓を挟まず送る。current_version は一覧の今の版。失敗は戻すボタンの下の赤い箱（押し直せる）。
//     409 E-SEC-004 は口の文そのまま＋一覧を読み直す／E-SEC-005 は詳細を読み直して戻すを押せない形に／401 は入り直しへ
//   画面は役の名前で出し分けず、口の答え（meta.can_restore・completed）で出し分ける
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { isUuid } from "@kaname/contracts";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k/error-of";
import { useNotify } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { readTicket, ticketKey } from "@/features/F5/approve-complete/band";
import { FORBIDDEN_TEXT } from "@/features/F4/items/use-field-save";
import { diffLines, itemDiffLines, type DiffField, type DiffLine, type ItemDiffRow } from "./diff-lines";
import { versionsHref } from "./versions-href";

const SCREEN = "tickets";
export type Of = "body" | "items";
export const FIELD_OF: Record<Of, DiffField> = { body: "本文", items: "項目の変更" };

export interface Sel {
  readonly of: Of;
  readonly from: number | null;
  readonly to: number | null;
}
/** 版の一覧の 1 行（本文の版も項目の変更の点も同じ形にする） */
export interface Ver {
  readonly n: number;
  /** 直した人の名前（AI が直した版は「AI」） */
  readonly by: string;
  readonly at: string;
  readonly summary: string;
  readonly current: boolean;
}
export interface View {
  readonly of: Of;
  readonly versions: readonly Ver[];
  readonly from: number | null;
  readonly to: number | null;
  readonly lines: readonly DiffLine[];
  /** 見ている人が戻せるか（本文の口の meta.can_restore。項目の変更は K-576 まで false） */
  readonly canRestore: boolean;
}
export type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "ok"; readonly view: View }
  | { readonly state: "error"; readonly code: string; readonly retry: boolean };
export interface TicketHead {
  readonly number: string;
  readonly title: string;
  readonly completed: boolean;
}
export type TicketState =
  | { readonly state: "loading" }
  | { readonly state: "ok"; readonly ticket: TicketHead }
  | { readonly state: "error"; readonly code: string };

/** 道の問い合わせの番号（1 以上の整数の字。違う形は口に渡して 404 にしてもらう） */
const numOf = (raw: string | null): number | null => {
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};
export const selOf = (of: string | null, from: string | null, to: string | null): Sel => ({
  of: of === "items" ? "items" : "body",
  from: numOf(from),
  to: numOf(to),
});

const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);
const nameOf = (who: unknown, ai: unknown): string => (ai === true ? "AI" : String(obj(who)["name"] ?? ""));

class ReadError extends Error {
  constructor(readonly result: CallErr) {
    super(result.code);
  }
}

async function readBody(id: string, s: Sel): Promise<View> {
  const r = await call("listTicketVersions", {
    params: { id },
    query: { ...(s.from !== null ? { from: s.from } : {}), ...(s.to !== null ? { to: s.to } : {}) },
    screenId: SCREEN,
  });
  if (!r.ok) throw new ReadError(r);
  const d = obj(r.data);
  const versions = arr(d["versions"]).map((v): Ver => ({
    n: Number(v["version"]),
    by: nameOf(v["edited_by"], v["edited_by_ai"]),
    at: String(v["edited_at"] ?? ""),
    summary: String(v["summary"] ?? ""),
    current: v["is_current"] === true,
  }));
  const from = d["from"] === null || d["from"] === undefined ? null : obj(d["from"]);
  const to = d["to"] === null || d["to"] === undefined ? null : obj(d["to"]);
  return {
    of: "body",
    versions,
    from: from ? Number(from["version"]) : null,
    to: to ? Number(to["version"]) : null,
    lines: from && to ? diffLines(String(from["text"] ?? ""), String(to["text"] ?? "")) : [],
    canRestore: r.meta["can_restore"] === true,
  };
}

async function readItems(id: string, s: Sel): Promise<View> {
  const r = await call("listTicketItemChanges", {
    params: { id },
    query: { ...(s.from !== null ? { from: s.from } : {}), ...(s.to !== null ? { to: s.to } : {}) },
    screenId: SCREEN,
  });
  if (!r.ok) throw new ReadError(r);
  const d = obj(r.data);
  const points = arr(d["points"]);
  const top = Math.max(0, ...points.map((p) => Number(p["n"])));
  const versions = points.map((p): Ver => ({
    n: Number(p["n"]),
    by: nameOf(p["by"], p["by_ai"]),
    at: String(p["at"] ?? ""),
    summary: String(p["summary"] ?? ""),
    current: Number(p["n"]) === top,
  }));
  const rows = arr(d["diff"]).map((x): ItemDiffRow => ({
    field: String(x["field"] ?? ""),
    name: String(x["name"] ?? ""),
    from: x["from"] === null || x["from"] === undefined ? null : String(x["from"]),
    to: x["to"] === null || x["to"] === undefined ? null : String(x["to"]),
  }));
  return {
    of: "items",
    versions,
    from: d["from"] === null || d["from"] === undefined ? null : Number(d["from"]),
    to: d["to"] === null || d["to"] === undefined ? null : Number(d["to"]),
    lines: itemDiffLines(rows),
    canRestore: false,
  };
}

const goLogin = (id: string): void => window.location.assign(`/login?next=${encodeURIComponent(versionsHref(id))}`);

/** 断りの答え → 赤い箱の文 */
function restoreErrorText(r: CallErr): string {
  if (r.code === "E-SEC-004" && r.message) return r.message;
  if (r.kind === "forbidden") return FORBIDDEN_TEXT;
  return errorText(errorCodeOf(r)).entry.message;
}

export interface Versions {
  readonly sel: Sel;
  readonly ticket: TicketState;
  readonly loaded: Loaded;
  /** 戻すを送っている間 */
  readonly sending: boolean;
  /** 戻すの失敗の文（戻すボタンの下の赤い箱） */
  readonly restoreError: string | null;
  choose: (next: Sel) => void;
  reload: () => void;
  restore: () => Promise<void>;
}

export function useVersions(id: string, initial: Sel): Versions {
  const qc = useQueryClient();
  const notify = useNotify();
  const [sel, setSel] = useState<Sel>(initial);
  const [nonce, setNonce] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [ticket, setTicket] = useState<TicketState>({ state: "loading" });
  const [sending, setSending] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const busy = useRef(false);
  const seenNonce = useRef(0);
  const valid = isUuid(id);

  const readHead = useCallback(
    () =>
      qc
        .fetchQuery({ queryKey: ticketKey(id), queryFn: () => readTicket<unknown>(id), retry: false, staleTime: 0 })
        .then(
          (raw) => {
            const d = obj(raw);
            const t = obj(d["ticket"]);
            const done = d["completed"] ?? t["completed"];
            setTicket({
              state: "ok",
              ticket: {
                number: String(t["number"] ?? ""),
                title: String(t["title"] ?? ""),
                completed: done !== null && done !== undefined && done !== false,
              },
            });
          },
          (e: unknown) => {
            const r = (e as { result?: CallErr }).result;
            if (r?.kind === "unauthenticated") return goLogin(id);
            setTicket({ state: "error", code: r ? errorCodeOf(r) : PAGE_ERROR.loadFailed });
          },
        ),
    [qc, id],
  );

  // チケットの頭は開くときに 1 回（戻すの完了後の断りのときだけ読み直す）
  useEffect(() => {
    if (!getToken()) return goLogin(id);
    if (!valid) {
      setTicket({ state: "error", code: PAGE_ERROR.notFound });
      return;
    }
    void readHead();
  }, [id, valid, readHead]);

  // 比べ方（と読み直しの合図）が変わるたびに、その口を 1 回読む
  useEffect(() => {
    if (!valid || !getToken()) return;
    let live = true;
    // 読み直しの合図（戻した後・先に直された後）では、読み終わるまで前の差分を残す（赤い箱と選びが消えない）
    const again = nonce !== seenNonce.current;
    seenNonce.current = nonce;
    setLoaded((prev) => (again && prev.state === "ok" && prev.view.of === sel.of ? prev : { state: "loading" }));
    const read = sel.of === "items" ? readItems : readBody;
    qc.fetchQuery({
      queryKey: ["k449", "versions", id, sel.of, sel.from, sel.to],
      queryFn: () => read(id, sel),
      retry: false,
      staleTime: 0,
      gcTime: 0,
    }).then(
      (view) => {
        if (live) setLoaded({ state: "ok", view });
      },
      (e: unknown) => {
        if (!live) return;
        const r = e instanceof ReadError ? e.result : null;
        if (r?.kind === "unauthenticated") return goLogin(id);
        const code = r ? errorCodeOf(r) : PAGE_ERROR.offline;
        setLoaded({ state: "error", code, retry: code !== PAGE_ERROR.notFound });
      },
    );
    return () => {
      live = false;
    };
  }, [qc, id, valid, sel, nonce]);

  const choose = useCallback(
    (next: Sel) => {
      setSel(next);
      setRestoreError(null);
      const href = versionsHref(id, {
        ...(next.of === "items" ? { of: "items" as const } : {}),
        ...(next.from !== null ? { from: next.from } : {}),
        ...(next.to !== null ? { to: next.to } : {}),
      });
      window.history.replaceState(window.history.state, "", href);
    },
    [id],
  );
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const restore = useCallback(async () => {
    if (busy.current || loaded.state !== "ok" || sel.of !== "body") return;
    const view = loaded.view;
    const current = view.versions.find((v) => v.current)?.n;
    if (view.from === null || current === undefined) return;
    busy.current = true;
    setSending(true);
    try {
      let r;
      try {
        r = await call("restoreTicketVersion", {
          params: { id, v: String(view.from) },
          body: { current_version: current },
          screenId: SCREEN,
        });
      } catch {
        setRestoreError(errorText(PAGE_ERROR.offline).entry.message);
        return;
      }
      if (r.ok) {
        const made = Number(obj(r.data)["version"]);
        setRestoreError(null);
        notify(`本文を版 ${view.from} の中身に戻しました（新しい版 ${made}）`);
        choose({ of: "body", from: null, to: null });
        reload();
        return;
      }
      if (r.kind === "unauthenticated") return goLogin(id);
      // 先に直された（409）：読み直しで口の既定の組に移らないよう、今見ている組を先に固定する。
      //   choose は赤い箱を消すので、固定してから断りの文を出す
      if (r.code === "E-SEC-004") choose({ of: "body", from: view.from, to: view.to });
      setRestoreError(restoreErrorText(r));
      if (r.code === "E-SEC-004") reload();
      if (r.code === "E-SEC-005") void readHead();
    } finally {
      busy.current = false;
      setSending(false);
    }
  }, [loaded, sel.of, id, notify, choose, reload, readHead]);

  return { sel, ticket, loaded, sending, restoreError, choose, reload, restore };
}
