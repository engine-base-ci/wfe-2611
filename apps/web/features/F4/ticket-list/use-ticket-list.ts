"use client";
// チケットの一覧の画面が読む口（K-251）。一覧の口（K-92）・はじめにやることの口（K-250）・承認待ちの口（K-161）。
//   一覧：1 回 50 件。見え方を切り替えたら、遅れて届いた前の答えでは描かない（問い合わせごとの印で見分ける）（K251-UI-004）。
//     「もっと見る」は押している間は押せない（2 回押しても口は 1 回・G-16）。失敗したら読んだ行を残して「もう一度」
//   401 は共通の決まり（lib/api/query の入り直し）に任せる。ほかの失敗は正本のエラーの 1 件（errorCodeOf・D-142.2）
//   はじめにやること：閉じる・飛ばすの口は押している間は押せず、失敗したら箱とその項目をそのまま残す（K251-UI-028）
//   K-252：一覧（全部）とグループの一覧は、言葉（q・打った字のまま）とグループ（scope_id）を口に渡す。言葉を替えたときは
//     読んだ行を残したまま読み直し（言葉の欄を消さない）、遅れて届いた前の言葉の答えでは描かない。言葉かグループで 0 件なら はじめて にしない
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallResult } from "@/lib/api/call";
import type { OpName } from "@kaname/contracts";
import { APPROVALS_KEY, ONCE, readApprovals, type ApprovalsAnswer } from "../create-ticket/ticket-shell";

export type ListView = "mine" | "all" | "overview" | "calendar" | "gantt";

/** 一覧の口の問い合わせにそのまま足す欄の組（URL の問い合わせから読む・K-600。名前は K-472・K-473 の欄の表の名前だけ） */
export type ListExtra = Readonly<Record<string, string>>;

/** 自分に関わるものの数（一覧の答えの meta.counts・K-474 の形） */
export interface Counts {
  overdue: number;
  today: number;
  assigned: number;
  ai: number;
  approve: number;
}

const COUNT_KEYS = ["overdue", "today", "assigned", "ai", "approve"] as const;
/** 答えの meta.counts が 5 つの整数の組ならその組、それ以外（無い・形が違う）は null */
function countsOf(meta: Record<string, unknown>): Counts | null {
  const c = meta["counts"];
  if (typeof c !== "object" || c === null) return null;
  const rec = c as Record<string, unknown>;
  if (!COUNT_KEYS.every((k) => Number.isInteger(rec[k]))) return null;
  return {
    overdue: rec["overdue"] as number,
    today: rec["today"] as number,
    assigned: rec["assigned"] as number,
    ai: rec["ai"] as number,
    approve: rec["approve"] as number,
  };
}

/** 一覧の口の 1 件（K-92 の答えの形） */
export interface ListItem {
  id: string;
  number: string;
  title: string;
  kind: { id: string; name: string } | null;
  stage: { id: string; name: string; key: string | null } | null;
  assignee: { id: string; display_name: string } | null;
  delegated_to_clone: boolean;
  due_on: string | null;
  overdue: boolean;
  updated_at: string;
}

export const PAGE_SIZE = 50;

export type ListState =
  | { state: "loading" }
  | { state: "error"; code: string }
  /** first：会社にチケットが 1 枚も無い（はじめて・キャンバス OnHome） */
  | { state: "ok"; rows: ListItem[]; next: string | null; first: boolean };

/** 口を呼び、届かなかった（ネットが切れた）ときも答えの形にする */
async function safeCall<K extends OpName>(run: () => Promise<CallResult<K>>): Promise<CallResult<K> | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

const codeOf = <K extends OpName>(r: CallResult<K> | null): string =>
  r === null || r.ok ? PAGE_ERROR.loadFailed : errorCodeOf(r);

const listOf = (data: unknown): ListItem[] => (Array.isArray(data) ? (data as ListItem[]) : []);
const nextOf = (meta: Record<string, unknown>): string | null =>
  typeof meta["next_cursor"] === "string" && meta["next_cursor"] ? meta["next_cursor"] : null;

/** 会社にチケットが 1 枚も無いか（一覧の口を全部の見え方で 1 件だけ読む・口は足さない）。
 *  読めない（500・届かない）ときは「在る」とみなす（はじめて にしない）。401 は入り直しに任せて答えを返さない（null） */
async function companyIsEmpty(): Promise<boolean | null> {
  const r = await safeCall(() => call("listTickets", { query: { view: "all", limit: 1 }, screenId: "tickets" }));
  if (r?.ok) return listOf(r.data).length === 0;
  return r?.kind === "unauthenticated" ? null : false;
}

export interface TicketList {
  list: ListState;
  /** 次の分を読んでいる間 */
  loadingMore: boolean;
  /** 次の分が読めなかった（正本のエラーの ID） */
  moreError: string | null;
  /** 読んだ行を残したまま読み直している（言葉を替えた直後。この間は「もっと見る」を受けない・K252-UI-020） */
  reloading: boolean;
  reload: () => void;
  loadMore: () => void;
  /** 一覧の答えの meta.counts（最初の答えで決める・次の分では持ち直さない）。無ければ null */
  counts: Counts | null;
}

/** 一覧の口に足す絞り（K-252）。q は打った字のまま（そろえるのは口・K-92） */
export interface ListFilter {
  q?: string;
  scopeId?: string | null;
  /** 問い合わせにそのまま足す欄の組（値は文字のまま。誤りは口が 422 で返す・画面で捨てない） */
  extra?: Readonly<Record<string, string>>;
}

/** 口に渡す見え方（一覧の口が知るのは mine と all だけ。概要・カレンダー・ガントのときは一覧の口を読まない） */
type ApiView = "mine" | "all";
const apiViewOf = (view: ListView): ApiView => (view === "all" ? "all" : "mine");

type ListQuery = Record<string, string | number> & { view: ApiView; limit: number };
const queryOf = (view: ListView, f: ListFilter): ListQuery => ({
  ...(f.extra ?? {}),
  view: apiViewOf(view),
  limit: PAGE_SIZE,
  ...(f.q ? { q: f.q } : {}),
  ...(f.scopeId ? { scope_id: f.scopeId } : {}),
});
/** 絞りの組の印（問い合わせの印に含める。並びが違っても同じ組なら同じ印） */
const extraKey = (extra: ListExtra | undefined): string =>
  extra
    ? Object.keys(extra)
        .sort()
        .map((k) => `${k}=${extra[k]}`)
        .map(encodeURIComponent)
        .join("&")
    : "";
/** 印から組に戻す（印の組は空なら undefined） */
const extraOf = (sig: string): ListExtra | undefined => {
  if (!sig) return undefined;
  return Object.fromEntries(
    sig.split("&").map((part) => {
      const kv = decodeURIComponent(part);
      const at = kv.indexOf("=");
      return [kv.slice(0, at), kv.slice(at + 1)];
    }),
  );
};

export function useTicketList(view: ListView, enabled: boolean, filter: ListFilter = {}): TicketList {
  const q = filter.q ?? "";
  const scopeId = filter.scopeId ?? null;
  // 絞りの組は印で見る（呼ぶ側が毎回新しい組を渡しても、同じ組なら読み直さない）
  const extraSig = extraKey(filter.extra);
  const extra = useMemo(() => extraOf(extraSig), [extraSig]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [list, setList] = useState<ListState>({ state: "loading" });
  /** 今の見え方とグループ（言葉だけを替えたときは、読んだ行を残して読み直す） */
  const shown = useRef<string | null>(null);
  const okNow = useRef(false);
  const [reloading, setReloading] = useState(false);
  /** 今の問い合わせ（見え方・言葉・グループ）。続きの答えは、始めた時と今が同じときだけ描く */
  const asked = useRef("");
  asked.current = `${view}|${q}|${scopeId ?? ""}|${extraSig}`;
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const seq = useRef(0);
  const busy = useRef(false);

  const reload = useCallback(() => {
    const mine = ++seq.current;
    const place = `${view}|${scopeId ?? ""}`;
    const keep = shown.current === place && okNow.current;
    shown.current = place;
    busy.current = false;
    setLoadingMore(false);
    setMoreError(null);
    if (!keep) setList({ state: "loading" });
    setReloading(keep);
    void (async () => {
      const r = await safeCall(() =>
        call("listTickets", { query: queryOf(view, { q, scopeId, ...(extra ? { extra } : {}) }), screenId: "tickets" }),
      );
      if (mine !== seq.current) return; // 後から切り替えた見え方の答えだけを描く
      setReloading(false);
      if (!r?.ok) {
        if (r?.kind !== "unauthenticated") setList({ state: "error", code: codeOf(r) });
        return;
      }
      const rows = listOf(r.data);
      const next = nextOf(r.meta);
      setCounts(countsOf(r.meta));
      // 0 件なら、会社にチケットが在るかを確かめる（はじめては会社に 0 件のときだけ・PM の決め 2026-11-17）
      //   言葉かグループで絞ったときは、0 件でも はじめて にしない（条件に合うものが無いだけ・K252-UI-014）
      const filtered = q !== "" || scopeId !== null || extraSig !== "";
      const first = rows.length === 0 && !filtered && (view === "all" || (await companyIsEmpty()));
      if (mine !== seq.current || first === null) return;
      setList({ state: "ok", rows, next, first });
    })();
  }, [view, q, scopeId, extra, extraSig]);

  useEffect(() => {
    okNow.current = list.state === "ok";
  }, [list.state]);

  useEffect(() => {
    if (enabled) reload();
    // 画面を離れたら、届いた答えを描かない（印を進める）。見え方・グループが替われば読み込み中から
    return () => {
      seq.current += 1;
    };
  }, [enabled, reload]);

  const loadMore = useCallback(() => {
    if (busy.current || reloading || list.state !== "ok" || !list.next) return;
    busy.current = true;
    const mine = seq.current;
    const startedFor = asked.current;
    const cursor = list.next;
    setLoadingMore(true);
    setMoreError(null);
    void safeCall(() =>
      call("listTickets", {
        query: { ...queryOf(view, { q, scopeId, ...(extra ? { extra } : {}) }), cursor },
        screenId: "tickets",
      }),
    ).then((r) => {
      // 読み直した後・言葉かグループを替えた後に届いた続きは描かない（前の言葉の行を新しい一覧に混ぜない）
      if (mine !== seq.current || startedFor !== asked.current) return;
      busy.current = false;
      setLoadingMore(false);
      if (r?.ok) {
        const more = listOf(r.data);
        setList((cur) => (cur.state === "ok" ? { ...cur, rows: [...cur.rows, ...more], next: nextOf(r.meta) } : cur));
      } else if (r?.kind !== "unauthenticated") setMoreError(codeOf(r));
    });
  }, [list, reloading, view, q, scopeId, extra]);

  return { list, loadingMore, moreError, reloading, reload, loadMore, counts };
}

/** はじめにやることの 1 件（K-250 の答えの形） */
export interface SetupTask {
  key: string;
  label: string;
  desc: string;
  done: boolean;
  href: string | null;
  available: boolean;
  optional: boolean;
  skipped: boolean;
}

export interface SetupTasks {
  /** 箱を出すか（読めた・閉じていない・使える項目が残っている） */
  show: boolean;
  tasks: SetupTask[];
  /** 済みか飛ばした数 ／ 使える項目の数（パスキーは数に入れない・D-145.15） */
  done: number;
  total: number;
  /** 押している口（閉じる＝"close"・飛ばす＝項目の key） */
  pending: string | null;
  close: () => void;
  skip: (key: string) => void;
}

const settled = (t: SetupTask): boolean => t.done || t.skipped;

export function useSetupTasks(enabled: boolean): SetupTasks {
  const [tasks, setTasks] = useState<SetupTask[] | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void safeCall(() => call("listSetupTasks", { screenId: "tickets" })).then((r) => {
      if (!live) return;
      // 読めないときは箱を出さない（K251-UI-029）
      if (!r?.ok) return setTasks(null);
      setTasks(Array.isArray(r.data) ? (r.data as SetupTask[]) : []);
      setDismissed(r.meta["dismissed"] === true);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  const send = useCallback((which: string, body: { key?: string }) => {
    if (busy.current) return; // 押している間は押せない（2 回押しても口は 1 回）
    busy.current = true;
    setPending(which);
    void safeCall(() => call("dismissSetupTasks", { body, screenId: "tickets" })).then((r) => {
      busy.current = false;
      setPending(null);
      if (!r?.ok) return; // 失敗したら箱とその項目をそのまま残し、また押せる
      const data = r.data as { dismissed?: boolean; skipped?: string[] };
      if (data.dismissed === true) setDismissed(true);
      const skipped = new Set(data.skipped ?? []);
      setTasks((cur) => cur?.map((t) => (skipped.has(t.key) ? { ...t, skipped: true } : t)) ?? cur);
    });
  }, []);

  const usable = (tasks ?? []).filter((t) => t.available);
  const done = usable.filter(settled).length;
  return {
    show: tasks !== null && !dismissed && usable.length > 0 && done < usable.length,
    tasks: tasks ?? [],
    done,
    total: usable.length,
    pending,
    close: () => send("close", {}),
    skip: (key: string) => send(key, { key }),
  };
}

/** 承認待ちの口の 1 件（契約 ApprovalQueueItem の使う所だけ） */
export interface Waiting {
  id: string;
  ticket_id: string | null;
  ticket_number: string;
  title: string;
}

export type Approvals = { state: "loading" } | { state: "error" } | { state: "ok"; rows: Waiting[] };

const waitingOf = (a: ApprovalsAnswer): Waiting[] =>
  (a.rows as Partial<Waiting>[]).map((w) => ({
    id: String(w.id ?? ""),
    ticket_id: w.ticket_id ?? null,
    ticket_number: String(w.ticket_number ?? ""),
    title: String(w.title ?? ""),
  }));

/** 自分の承認を待っているもの（チケットが在る画面の右の列）。外枠の数と同じ問い合わせ（5 件・APPROVALS_KEY）を分け合い、
 *  一覧の答えを待たずに最初に読む（口は 1 本・K-235） */
export function useApprovals(enabled: boolean): Approvals {
  const q = useQuery({
    queryKey: APPROVALS_KEY,
    enabled,
    ...ONCE,
    queryFn: () => readApprovals("tickets"),
    select: waitingOf,
  });
  if (q.isError) return { state: "error" };
  if (q.isSuccess) return { state: "ok", rows: q.data };
  return { state: "loading" };
}

export type OpenLookup = { state: "loading" } | { state: "found"; id: string } | { state: "missing" };

/** ?open=<番号> を直に開いたとき：一覧の口を q=<番号>・view=all で引き、番号がちょうど合う行の id を得る（K252-UI-011）。
 *  known は行を押して分かっている id（そのときは口を呼ばない） */
export function useOpenLookup(number: string | null, known: { number: string; id: string } | null): OpenLookup | null {
  const [found, setFound] = useState<{ number: string; result: OpenLookup } | null>(null);
  const hit = number !== null && known?.number === number;
  useEffect(() => {
    if (number === null || hit) return;
    let live = true;
    setFound({ number, result: { state: "loading" } });
    void safeCall(() =>
      call("listTickets", { query: { view: "all", q: number, limit: PAGE_SIZE }, screenId: "tickets" }),
    ).then((r) => {
      if (!live) return;
      const row = r?.ok ? listOf(r.data).find((x) => x.number === number) : undefined;
      setFound({ number, result: row ? { state: "found", id: row.id } : { state: "missing" } });
    });
    return () => {
      live = false;
    };
  }, [number, hit]);
  if (number === null) return null;
  if (hit) return { state: "found", id: known!.id };
  return found?.number === number ? found.result : { state: "loading" };
}
