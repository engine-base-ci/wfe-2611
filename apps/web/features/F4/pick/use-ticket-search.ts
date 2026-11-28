"use client";
// 探して選ぶ道具（K-443 が置く・K-446・K-452 も使う）：親・複製元・つながりの小窓が同じ物を使う。打った字で一覧の口（listTickets・K-92）を
//   q と view=all と limit で引き、候補の行を返す。打ち終わってから 300ms 待って 1 回だけ引く（打つたびに口を呼ばない・G-16）。
//   後から打った字の答えを優先する（遅れて届いた前の字の答えでは描かない）。字が空なら何もしない（idle）。
//   入口の q の上限に合わせて、探す字は 100 字で切る。口を呼ぶのはこの道具だけで、見た目の部品（views.tsx）は呼ばない
import { useCallback, useEffect, useRef, useState } from "react";
import { call } from "@/lib/api/call";

const WAIT_MS = 300;
const Q_MAX = 100;
const DEFAULT_LIMIT = 20;

/** 候補の 1 行（一覧の口の答えの 1 件） */
export interface TicketSearchRow {
  id: string;
  number: string;
  title: string;
  depth: number;
  due_on: string | null;
  assignee: { id: string; display_name: string } | null;
  stage?: { id: string; name: string; key: string | null };
  /** 一覧の行の scope は K-560 が足すので任意 */
  scope?: { id: string; name: string };
}

export type TicketSearchState = "idle" | "ok" | "failed";

export interface TicketSearch {
  /** 探す字（100 字まで） */
  text: string;
  setText: (text: string) => void;
  state: TicketSearchState;
  rows: TicketSearchRow[];
  /** 字と候補を空に戻す（待っていた引きも取り消す） */
  reset: () => void;
}

const cut = (s: string): string => [...s].slice(0, Q_MAX).join("");

function rowOf(x: Partial<TicketSearchRow>): TicketSearchRow {
  return {
    id: String(x.id),
    number: String(x.number ?? ""),
    title: String(x.title ?? ""),
    depth: Number(x.depth ?? 1),
    due_on: x.due_on ?? null,
    assignee: x.assignee ?? null,
    ...(x.stage ? { stage: x.stage } : {}),
    ...(x.scope ? { scope: x.scope } : {}),
  };
}

export function useTicketSearch(opts?: { limit?: number; wait?: number }): TicketSearch {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const wait = opts?.wait ?? WAIT_MS;
  const [text, setRaw] = useState("");
  const [state, setState] = useState<TicketSearchState>("idle");
  const [rows, setRows] = useState<TicketSearchRow[]>([]);
  /** 引きの通し番号（後から打った字の答えを優先する） */
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim();
    const mine = ++seq.current;
    if (!q) {
      setState("idle");
      setRows([]);
      return;
    }
    const timer = setTimeout(() => {
      void call("listTickets", { query: { q, view: "all", limit }, screenId: "tickets" })
        .catch(() => null)
        .then((r) => {
          if (mine !== seq.current) return;
          if (!r || !r.ok) {
            setRows([]);
            return setState("failed");
          }
          setRows((r.data as unknown as Partial<TicketSearchRow>[]).map(rowOf));
          setState("ok");
        });
    }, wait);
    return () => clearTimeout(timer);
  }, [text, limit, wait]);

  const setText = useCallback((next: string) => setRaw(cut(next)), []);
  const reset = useCallback(() => {
    seq.current++;
    setRaw("");
    setState("idle");
    setRows([]);
  }, []);
  return { text, setText, state, rows, reset };
}
