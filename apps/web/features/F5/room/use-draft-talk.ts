"use client";
// 作る画面の右の AI との会話の読みと書き（K-767）。
//   最初の一言のときだけ startDraftConversation（体なし）で始め、sendDraftMessage（体 { text, draft, edited }）で言う。
//   draft はその時の欄の中身、edited は「前に AI に渡した中身から、人が直した欄」（draft-words の editedOf）。
//   二度押しでも始める口・言う口は 1 回ずつ（描き直しを待たずに ref で止める）。201 で書く欄を空にし、会話を読み直す。
//   断り（正本の番号）：E-TALK-060＝PC がまだ（書けない）・E-TALK-062＝作る権限が無い（書けない）・E-TALK-061＝作る画面の会話でない
//   （［新しく話す］で次の一言から始め直す）・E-TALK-012＝書く欄の注（書けるまま）・ほか（503 など）＝答えを返せなかった帯。
//   どの断りでも、書いた言葉は書く欄に残す（吹き出しにはしない）。左の欄の中身には触らない。
//   流れは K-762 の talk-stream（会話ごとに 1 本）。字の行は K-762 の talk-words の toEntries（「見たもの」を読まない・D-153.34）。
//   作る画面の道 how=ai（作り方「AI と話して作る」）の出し入れも、ここの 1 か所（作る面の頭と本体が同じ値を読む）
//   AI の案の行（proposal が在る行・K-775）は、会話の並びのその場所に案のカードの行（kind proposal）として入れる（K-777）。
//   使った結果（欄に入りました・使っていません）はカードを置く側（create-talk-aside）が持つ。
//   案を欄に入れたら rebase で、入れた欄の「前に AI に渡した中身」を案の中身に替える（案のままの欄は edited に入れない・K-777）
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ConversationView, MessageView } from "@kaname/contracts";
import { call, type CallErr } from "@/lib/api/call";
import { catalogText, editedOf, passedText, type DraftNow } from "./draft-words";
import { itemsOf, type ProposalInput } from "./proposal-apply";
import type { ComposerMode, Entry } from "./talk";
import { openTalkStream } from "./talk-stream";
import { POLL_MS } from "./use-talk";
import { jstDay, toEntries, type MessageView as TalkMessage, type WorkView } from "./talk-words";

const SCREEN = "tickets";

/** 書く欄の上に出す断り */
export type TalkBlock =
  | { kind: "failed" }
  | { kind: "note"; text: string }
  | { kind: "no-pc" }
  | { kind: "locked"; text: string }
  | { kind: "gone"; text: string };

/** 作った後に会話を移した結果 */
export type AdoptResult = { kind: "none" } | { kind: "ok"; conversationId: string } | { kind: "failed" };

export interface DraftTalk {
  entries: readonly Entry[];
  text: string;
  setText: (t: string) => void;
  mode: ComposerMode;
  stopping: boolean;
  block: TalkBlock | null;
  /** 言葉を言う（空・空白だけは言わない） */
  send: (words: string, now: DraftNow) => Promise<void>;
  stop: () => Promise<void>;
  /** E-TALK-061 の後：次の一言で新しく始める */
  restart: () => void;
  /** 作る口の 201 の後に 1 回。会話が無ければ口を呼ばない */
  adopt: (ticketId: string) => Promise<AdoptResult>;
  /** 前に AI に渡した中身を、渡した欄だけ替える（AI の案を欄に入れたとき・K-777。edited に入れないため）。まだ何も渡していなければ何もしない */
  rebase: (patch: Partial<DraftNow>) => void;
}

function blockOf(r: CallErr): TalkBlock {
  const text = catalogText(r.code);
  if (r.code === "E-TALK-060") return { kind: "no-pc" };
  if (r.code === "E-TALK-062") return { kind: "locked", text: text ?? "" };
  if (r.code === "E-TALK-061") return { kind: "gone", text: text ?? "" };
  if (r.code === "E-TALK-012" && text) return { kind: "note", text };
  return { kind: "failed" };
}

const isWorking = (v: ConversationView | null): boolean => Boolean(v && (v.running_job_id || v.work));
const isStopping = (v: ConversationView | null): boolean =>
  Boolean(v?.work && (v.work as Record<string, unknown>)["stopping"]);

/** 案の行の中身（K-775 の proposal）を、字の欄だけの形に（形の違う物は捨てる・字は書かれたとおり） */
function proposalInput(raw: unknown): ProposalInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: { title?: string; body?: string; checks?: string[] } = {};
  if (typeof o["title"] === "string") out.title = o["title"];
  if (typeof o["body"] === "string") out.body = o["body"];
  if (Array.isArray(o["checks"])) out.checks = o["checks"].filter((c): c is string => typeof c === "string");
  return itemsOf(out).length ? out : null;
}

/** 案のカードの行（使った結果はまだ持たない＝まだ欄に入っていない形） */
function proposalEntry(m: MessageView, i: number, input: ProposalInput): Entry {
  return {
    kind: "proposal",
    proposal: { id: m.id || `p${i}`, input, mode: "open", items: itemsOf(input) },
  };
}

/** 会話の答えを行に。人の言葉の上に「…（直した）を AI に渡しました」を足し、案の行はその場所にカードとして入れる */
function entriesOf(v: ConversationView | null): Entry[] {
  if (!v) return [];
  const msgs = (v.messages ?? []) as unknown as MessageView[];
  const passed = new Map(msgs.map((m) => [m.id ?? "", passedText(m.passed)] as const));
  const work = (v.work ?? null) as unknown as WorkView | null;
  const base = toEntries(msgs as unknown as TalkMessage[], work, jstDay(new Date().toISOString())).map((e: Entry) => {
    if (e.kind !== "msg") return e;
    const p = passed.get(e.msg.id);
    return p ? { ...e, msg: { ...e.msg, passed: p } } : e;
  });
  // 案の行は、その前のふつうの行の後ろに（前にふつうの行が無ければ頭に）。作業中の行は最後のまま
  const after = new Map<string, Entry[]>();
  const head: Entry[] = [];
  let last: string | null = null;
  msgs.forEach((m, i) => {
    const input = m.proposal ? proposalInput(m.proposal) : null;
    if (!m.proposal) {
      last = m.id ?? null;
      return;
    }
    if (!input) return;
    const e = proposalEntry(m, i, input);
    if (last === null) head.push(e);
    else after.set(last, [...(after.get(last) ?? []), e]);
  });
  const out: Entry[] = [...head];
  for (const e of base) {
    out.push(e);
    if (e.kind === "msg") out.push(...(after.get(e.msg.id) ?? []));
  }
  return out;
}

export function useDraftTalk({ noPc = false }: { noPc?: boolean } = {}): DraftTalk {
  const [convId, setConvId] = useState<string | null>(null);
  const [view, setView] = useState<ConversationView | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [stopAsked, setStopAsked] = useState(false);
  const [block, setBlock] = useState<TalkBlock | null>(null);
  const idRef = useRef<string | null>(null);
  const busy = useRef(false);
  const prev = useRef<DraftNow | null>(null);

  const read = useCallback(async (id: string) => {
    const r = await call("getConversation", { params: { id }, screenId: SCREEN }).catch(() => null);
    if (r?.ok && idRef.current === id) setView(r.data);
  }, []);

  // 流れ：開いている会話ごとに 1 本（最初の ready では読み直さない・2 回目からの ready と change は onRefresh・K-762 の talk-stream の形）
  //   流れが使えない間（503・落ちた）は、部屋の会話（room-talk の useConv）と同じく、作業中だけ POLL_MS ごとに見に行く（G-16・DATABASE_LISTEN_URL が空のとき）
  const [poll, setPoll] = useState(false);
  useEffect(() => {
    if (!convId) return;
    setPoll(false);
    return openTalkStream(convId, {
      onRefresh: () => void read(convId),
      onDown: () => {
        setPoll(true);
        void read(convId);
      },
      onLive: () => setPoll(false),
      onSignedOut: () => undefined,
    });
  }, [convId, read]);
  const working = isWorking(view);
  useEffect(() => {
    if (!convId || !poll || !working) return;
    const t = window.setInterval(() => void read(convId), POLL_MS);
    return () => window.clearInterval(t);
  }, [convId, poll, working, read]);

  const send = useCallback(
    async (words: string, now: DraftNow) => {
      if (busy.current || words.trim() === "") return;
      if (noPc || block?.kind === "no-pc" || block?.kind === "locked") return;
      busy.current = true;
      setSending(true);
      setBlock(null);
      try {
        let id = idRef.current;
        if (!id) {
          const s = await call("startDraftConversation", { body: {}, screenId: SCREEN });
          if (!s.ok) return setBlock(blockOf(s));
          id = String(s.data.id ?? "");
          idRef.current = id;
          setConvId(id);
        }
        const r = await call("sendDraftMessage", {
          params: { id },
          body: { text: words, draft: { ...now }, edited: editedOf(prev.current, now) },
          screenId: SCREEN,
        });
        if (!r.ok) return setBlock(blockOf(r));
        prev.current = now;
        setText("");
        setStopAsked(false);
        await read(id);
      } finally {
        busy.current = false;
        setSending(false);
      }
    },
    [block, noPc, read],
  );

  const stop = useCallback(async () => {
    const id = idRef.current;
    if (!id) return;
    setStopAsked(true);
    await call("stopConversation", { params: { id }, body: {}, screenId: SCREEN }).catch(() => null);
    await read(id);
  }, [read]);

  const restart = useCallback(() => {
    idRef.current = null;
    prev.current = null;
    setConvId(null);
    setView(null);
    setBlock(null);
  }, []);

  const adopt = useCallback(async (ticketId: string): Promise<AdoptResult> => {
    const id = idRef.current;
    if (!id) return { kind: "none" };
    const r = await call("adoptDraftConversation", {
      params: { id },
      body: { ticket_id: ticketId },
      screenId: SCREEN,
    }).catch(() => null);
    if (!r?.ok) return { kind: "failed" };
    return { kind: "ok", conversationId: String((r.data as { conversation_id?: string }).conversation_id ?? "") };
  }, []);

  const rebase = useCallback((patch: Partial<DraftNow>) => {
    if (prev.current) prev.current = { ...prev.current, ...patch };
  }, []);

  const entries = useMemo(() => entriesOf(view), [view]);
  const off = noPc || block?.kind === "no-pc" || block?.kind === "locked";
  const mode: ComposerMode = off ? "no-pc" : sending ? "sending" : isWorking(view) ? "working" : "idle";
  return {
    entries,
    text,
    setText,
    mode,
    stopping: stopAsked || isStopping(view),
    block,
    send,
    stop,
    restart,
    adopt,
    rebase,
  };
}

// ---- 作る画面の道 how=ai（作り方「AI と話して作る」） ----
const HOW_EVENT = "kaname:create-how";
const readHow = (): boolean =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("how") === "ai";
const subHow = (cb: () => void): (() => void) => {
  window.addEventListener(HOW_EVENT, cb);
  window.addEventListener("popstate", cb);
  return () => {
    window.removeEventListener(HOW_EVENT, cb);
    window.removeEventListener("popstate", cb);
  };
};

/** 道に how=ai を付ける／外す（ほかの印 new=1 などはそのまま） */
export function setHowAi(on: boolean): void {
  const u = new URL(window.location.href);
  if (on) u.searchParams.set("how", "ai");
  else u.searchParams.delete("how");
  window.history.replaceState(window.history.state, "", u);
  window.dispatchEvent(new Event(HOW_EVENT));
}

export function useHowAi(): boolean {
  return useSyncExternalStore(subHow, readHow, () => false);
}

// ---- スマホの幅（767 以下は欄と会話が別の画面） ----
const MOBILE = "(max-width: 767px)";
const readMobile = (): boolean => typeof window !== "undefined" && window.matchMedia(MOBILE).matches;
const subMobile = (cb: () => void): (() => void) => {
  const q = window.matchMedia(MOBILE);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};
export function useMobile(): boolean {
  return useSyncExternalStore(subMobile, readMobile, () => false);
}
