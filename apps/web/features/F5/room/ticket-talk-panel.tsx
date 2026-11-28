"use client";
// チケットの右のパネル「〈名〉のAI」タブの中身（K-764・D-153.16）：そのチケットのことだけを自分の AI と話す。部品は ticket-talk.tsx の AiPanel（値で描く）。
//   開いて初めて会話を 1 回読む（use-ticket-talk.ts）。流れ（K-762 の talk-stream.ts）は区画を開いている間だけ会話の id で 1 本・閉じたら取り消す。
//   最初の ready では読み直さず、つなぎ直しの ready と change で getTicketAgentSession を読み直す。
//   言う口の断りは書く欄の上に出し、書いた字は欄に残す。「見たもの」の 1 行は出さない（D-153.34・toEntries が took を読まない）
//   K-767 が足す 1 か所：作る画面の会話をこのチケットへ移せなかったとき（道 ?ai=1&adopt=failed）、区画の中の知らせの先頭に 1 行（AdoptFailedNote）
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Callout, ErrorState, errorText } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import { takeComposerFocus } from "@/features/F5/more/fills/talk";
import { AiPanel, type PanelState } from "./ticket-talk";
import type { ComposerMode } from "./talk";
import { openTalkStream } from "./talk-stream";
import { jstDay, stopNotice, toEntries } from "./talk-words";
import { useCloneMe } from "./use-clone";
import { TalkError, useStop } from "./use-talk";
import { ticketSessionKey, useTicketSession, useTicketSay } from "./use-ticket-talk";
import { ADOPT_FAILED } from "./draft-words";

const DOWN = "E-PAGE-003";
const NO_RIGHT = "このチケットを直す権限が無いので、AI と話せません";
const NOT_FOUND = "このチケットは見られません";
const REGION = '[role="region"][aria-label="AI と話す"]';

const catalogCode = (code: string): string => (code in CATALOG ? code : DOWN);

/** 言う口・止める口の断りの出し分け */
type Notice =
  | { kind: "pc" }
  | { kind: "note"; code: string }
  | { kind: "text"; text: string }
  | { kind: "down"; code: string; title?: string };

function sayNoticeOf(e: CallErr): Notice | null {
  if (e.status === 401) return null; // 入り直しは call が送る
  if (e.code === "E-TALK-050") return { kind: "pc" };
  if (e.status === 409 && e.code === "E-TALK-012") return { kind: "note", code: e.code };
  if (e.status === 403) return { kind: "text", text: NO_RIGHT };
  if (e.status === 404) return { kind: "text", text: NOT_FOUND };
  return { kind: "down", code: catalogCode(e.code), title: "送れませんでした" };
}

function NoticeBox({ n }: { n: Notice }): ReactNode {
  if (n.kind === "pc")
    return (
      <Callout tone="warn" title="PC がまだつながっていません">
        話すにも PC が要ります。PC をつなぐと、このチケットのことを話せます
      </Callout>
    );
  if (n.kind === "text") return <Callout tone="danger">{n.text}</Callout>;
  const t = errorText(n.code);
  if (n.kind === "note")
    return (
      <Callout tone="warn" title={t.title}>
        {t.body}
      </Callout>
    );
  return (
    <Callout tone="danger" title={n.title ?? t.title}>
      {n.title ? t.entry.message : t.body}
    </Callout>
  );
}

/** 道の adopt=failed を 1 回読む（K-767・開いた後にタブを替えても道は書き換えない） */
function useAdoptFailed(): boolean {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(new URLSearchParams(window.location.search).get("adopt") === "failed");
  }, []);
  return failed;
}

/** 作る時の会話を移せなかった知らせ（K-767）：作ったチケットは在る・作る画面の会話は残っている */
function AdoptFailedNote(): ReactNode {
  const failed = useAdoptFailed();
  if (!failed) return null;
  return <Callout tone="warn">{ADOPT_FAILED}</Callout>;
}

/** 開いた時に流れを 1 本。閉じたら取り消す。使えない間は見に行く形（poll） */
function useSessionStream(convId: string | null, reread: () => void): boolean {
  const [poll, setPoll] = useState(false);
  useEffect(() => {
    if (!convId) return;
    let close: (() => void) | null = null;
    // 同じ描画の 2 回目（開発の StrictMode）で 2 本開かない：次の番で開く
    const t = setTimeout(() => {
      close = openTalkStream(convId, {
        onRefresh: reread,
        onDown: () => setPoll(true),
        onLive: () => setPoll(false),
        onSignedOut: () =>
          window.location.assign(
            `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
          ),
      });
    }, 0);
    return () => {
      clearTimeout(t);
      close?.();
    };
  }, [convId, reread]);
  return poll;
}

/** 帯のボタンから来たときは、書く欄が描かれてから焦点を置く */
function useComposerFocus(ready: boolean): void {
  useEffect(() => {
    if (!ready || !takeComposerFocus()) return;
    document.querySelector<HTMLTextAreaElement>(`${REGION} textarea`)?.focus();
  }, [ready]);
}

export interface TicketTalkPanelProps {
  ticketId: string;
  me: string;
  /** 詳細の答えの番号（EG-133 など） */
  number: string;
  title: string;
}

export function TicketTalkPanel({ ticketId, me, number }: TicketTalkPanelProps): ReactNode {
  const qc = useQueryClient();
  const [poll, setPoll] = useState(false);
  const s = useTicketSession(ticketId, true, poll);
  const clone = useCloneMe();
  const say = useTicketSay(ticketId);
  const stop = useStop();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const reread = useCallback(() => {
    void qc.refetchQueries({ queryKey: ticketSessionKey(ticketId), exact: true });
  }, [qc, ticketId]);
  const view = s.data ?? null;
  const convId = view?.conversation?.id ?? null;
  const down = useSessionStream(convId, reread);
  useEffect(() => setPoll(down), [down]);
  useComposerFocus(s.isSuccess || s.isError);

  const pc = clone.data?.pc;
  const noPc = pc?.state === "none";
  const stopped = view ? stopNotice(view.stopped, pc) : null;
  const work = view?.work ?? null;

  const onSend = async () => {
    if (!text.trim()) return;
    const r = await say.say(text);
    if (r === null) return;
    if (!r.ok) {
      setNotice(sayNoticeOf(r.err));
      return;
    }
    setNotice(null);
    setText("");
    reread();
  };
  const onStop = async () => {
    if (!convId) return;
    const r = await stop.mutateAsync(convId);
    setNotice(r.ok ? null : r.status === 401 ? null : { kind: "down", code: catalogCode(r.code) });
    reread();
  };

  const state = stateOf(s.isPending, s.error, () => void s.refetch());
  const mode: ComposerMode = stopped?.off ? "no-pc" : say.pending ? "sending" : work ? "working" : "idle";
  return (
    <AiPanel
      ticket={number}
      entries={view ? toEntries(view.messages, work, jstDay(new Date().toISOString())) : []}
      composer={{ text, mode, label: `${me}のAI に話す` }}
      noPc={noPc}
      notice={
        <>
          <AdoptFailedNote />
          {stopped ? (
            <Callout tone={stopped.tone} title={stopped.title}>
              {stopped.text}
            </Callout>
          ) : null}
          {notice ? <NoticeBox n={notice} /> : null}
        </>
      }
      onText={setText}
      onSend={() => void onSend()}
      onStop={() => void onStop()}
      stopping={stop.isPending || work?.stopping === true}
      {...(state ? { state } : {})}
    />
  );
}

/** 会話の場所の形：読み中・見られない（404）・読めない（503 ほか・［もう一度］） */
function stateOf(pending: boolean, error: unknown, retry: () => void): PanelState | null {
  if (pending) return { kind: "loading" };
  if (!error) return null;
  if (error instanceof TalkError && error.status === 404) return { kind: "notFound" };
  return { kind: "box", box: <ErrorState code={DOWN} acts={[retry]} /> };
}
