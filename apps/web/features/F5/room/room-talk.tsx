"use client";
// 分身の部屋「話す」の入れ物（K-762・clone-chat・/ai/talk）：道の状態・一覧・会話・書く欄・帯の出し分け。部品は talk.tsx（値で描く）。
//   道の状態（URL as state）：?c=<会話の id>＝開いている会話・?new=1＝新しく話す。どちらも無ければ、PC の幅では一覧のいちばん新しい会話を開いて ?c を付け、
//   スマホ（767 以下）では会話の一覧だけの画面（いちばん新しい会話に選んだ印・?c は付けない）。会話が 1 つも無いときと ?new=1 はスマホでも会話の画面。
//   流れ（talk-stream.ts）は開いている会話ごとに 1 本。流れが使えない間は、作業中の間だけ 5 秒ごとに見に行く（use-talk.ts の useConv）。
//   PC がまだ・閉じて止まった・言う口の断りは書く欄の上に出す。書いた字は断られても欄に残す
import { useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { errorText } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import { PcNone, RoomFailed, RoomLoading } from "./overview";
import { RoomFrame } from "./room-frame";
import { roomName } from "./room-words";
import { TalkBody, TalkNotice, type ComposerMode } from "./talk";
import { openTalkStream } from "./talk-stream";
import { jstDay, stopNotice, toConvItems, toEntries, type MessageView } from "./talk-words";
import { useCloneMe } from "./use-clone";
import { CONVS_KEY, TalkError, convKey, useConv, useConvs, useOlder, useSay, useStop } from "./use-talk";

const TALK = "/ai/talk";
const BRIDGE_HREF = "/setup/bridge";
const MOBILE = "(max-width: 767px)";
const DOWN = "E-PAGE-003";

const go = (q: string): Route => `${TALK}${q}` as Route;
const catalogCode = (code: string): string => (code in CATALOG ? code : DOWN);

/** 言う口の断りの出し分け（K-758 の E-TALK-010〜012・ほかは帯） */
type SayNotice = { kind: "pc" } | { kind: "note"; code: string } | { kind: "down"; code: string };
function sayNoticeOf(e: CallErr): SayNotice | null {
  if (e.status === 401) return null; // 入り直しは call が送る
  if (e.code === "E-TALK-010") return { kind: "pc" };
  if (e.status === 409 && (e.code === "E-TALK-011" || e.code === "E-TALK-012")) return { kind: "note", code: e.code };
  return { kind: "down", code: catalogCode(e.code) };
}

function CatalogNotice({ code, title }: { code: string; title?: string }) {
  const t = errorText(code);
  return (
    <TalkNotice tone="danger" title={title ?? t.title}>
      {title ? t.entry.message : t.body}
    </TalkNotice>
  );
}

/** 開いた時は頁を一番下（新しい行）へ。古い行を上に足したときは巻いた位置を保つ */
function useScrollKeeper(openId: string | null, loaded: boolean, olderCount: number) {
  const before = useRef<number | null>(null);
  useEffect(() => {
    if (openId && loaded) window.scrollTo(0, document.documentElement.scrollHeight);
  }, [openId, loaded]);
  useLayoutEffect(() => {
    if (before.current === null) return;
    window.scrollBy(0, document.documentElement.scrollHeight - before.current);
    before.current = null;
  }, [olderCount]);
  return () => {
    before.current = document.documentElement.scrollHeight;
  };
}

export function RoomTalkPage() {
  const sp = useSearchParams();
  const c = sp.get("c");
  const isNew = sp.get("new") === "1";
  const convs = useConvs();
  const rows = convs.data ?? [];
  // スマホで ?c も ?new も無く、会話が在る（読み中を含む）→ 一覧だけの画面
  const mview = !c && !isNew && (convs.isPending || rows.length > 0) ? "list" : "chat";
  return (
    <RoomFrame tab="talk" mobileChat={mview === "chat"}>
      <RoomTalk c={c} isNew={isNew} mview={mview} />
    </RoomFrame>
  );
}

function RoomTalk({ c, isNew, mview }: { c: string | null; isNew: boolean; mview: "list" | "chat" }) {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useCloneMe();
  const name = roomName(me.isSuccess ? me.data : undefined);
  const pc = me.isSuccess ? me.data.pc : undefined;
  const convs = useConvs();
  const rows = convs.data ?? [];
  const today = jstDay(new Date().toISOString());

  // PC の幅で何も選んでいなければ、いちばん新しい会話を開く（スマホは一覧のまま）
  const newest = rows[0]?.id ?? null;
  useEffect(() => {
    if (c || isNew || !newest || window.matchMedia(MOBILE).matches) return;
    router.replace(go(`?c=${newest}`), { scroll: false });
  }, [c, isNew, newest, router]);

  const openId = c;
  const current = c ?? (isNew ? null : newest);
  const [poll, setPoll] = useState(false);
  const conv = useConv(openId, poll);
  const view = conv.data;
  const older = useOlder(openId);

  // 読み直しをまとめる：読み直し中に来た分は 1 回だけ後ろに積む
  const refetch = useRef(conv.refetch);
  refetch.current = conv.refetch;
  // 読んでいる最中に来た知らせは、その読みに相乗りすると変わる前の答えのまま終わる。読み終えた後にもう 1 回読む（K762-UI-013）
  //   読み中かは、描いた時の値（isFetching）ではなく、呼んだ瞬間の読みの箱の状態で見る。読み終えてから描き直すまでの間に
  //   知らせが来ると、描いた時の値は「読み中」のままで、読み終えた後に 2 回読んでしまう
  const convId = useRef(openId);
  convId.current = openId;
  const inflight = useRef(false);
  const again = useRef(false);
  const reread = useCallback(async () => {
    if (inflight.current) {
      again.current = true;
      return;
    }
    inflight.current = true;
    try {
      do {
        again.current = false;
        const id = convId.current;
        const joined = id !== null && qc.isFetching({ queryKey: convKey(id), exact: true }) > 0;
        await refetch.current({ cancelRefetch: false });
        if (joined) await refetch.current({ cancelRefetch: false });
      } while (again.current);
    } finally {
      inflight.current = false;
    }
  }, [qc]);

  // 流れは会話ごとに 1 本。StrictMode の付け外しで 2 本開かないよう、次の番に開く
  useEffect(() => {
    if (!openId) return;
    setPoll(false);
    let close: (() => void) | null = null;
    const t = setTimeout(() => {
      close = openTalkStream(openId, {
        onRefresh: () => void reread(),
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
  }, [openId, reread]);

  const markOlder = useScrollKeeper(openId, view !== undefined, older.rows.length);

  const [text, setText] = useState("");
  const [sayNote, setSayNote] = useState<SayNotice | null>(null);
  const [stopCode, setStopCode] = useState<string | null>(null);
  useEffect(() => {
    setSayNote(null);
    setStopCode(null);
  }, [openId, isNew]);
  const say = useSay();
  const stop = useStop();

  // 二度押しの守り：isPending は次の描き直しまで偽のままなので、同じ瞬間の 2 回目は印（ref）で止める（K762-UI-008）
  const sending = useRef(false);
  const send = async () => {
    if (sending.current || say.isPending || text.trim() === "") return;
    sending.current = true;
    const r = await say.mutateAsync({ current: isNew ? null : (openId ?? null), text }).finally(() => {
      sending.current = false;
    });
    if (!r.ok) return setSayNote(sayNoticeOf(r.err));
    setSayNote(null);
    setText("");
    void qc.invalidateQueries({ queryKey: CONVS_KEY, exact: true });
    if (r.created) router.replace(go(`?c=${r.id}`), { scroll: false });
    else void qc.refetchQueries({ queryKey: convKey(r.id), exact: true });
  };

  const work = view?.work ?? null;
  const stopping = Boolean(work?.stopping) || stop.isPending;
  const doStop = async () => {
    if (!openId || stopping) return;
    const r = await stop.mutateAsync(openId);
    setStopCode(r.ok || r.status === 401 ? null : catalogCode(r.code));
    void reread();
  };

  const stopped = view ? stopNotice(view.stopped, pc) : null;
  const noPc = pc?.state === "none";
  const mode: ComposerMode = noPc || stopped?.off ? "no-pc" : work ? "working" : say.isPending ? "sending" : "idle";

  const notices: ReactNode[] = [];
  if (noPc || sayNote?.kind === "pc") notices.push(<PcNone key="pc" href={BRIDGE_HREF} />);
  if (sayNote?.kind === "note") notices.push(<CatalogNotice key="say" code={sayNote.code} />);
  if (sayNote?.kind === "down") notices.push(<CatalogNotice key="say" code={sayNote.code} title="送れませんでした" />);
  if (stopCode) notices.push(<CatalogNotice key="stop" code={stopCode} />);
  if (stopped && !work)
    notices.push(
      <TalkNotice key="stopped" tone={stopped.tone} title={stopped.title}>
        {stopped.text}
      </TalkNotice>,
    );

  const err = conv.error instanceof TalkError ? conv.error : null;
  const notFound = err?.status === 404;
  const main =
    openId && !notFound && conv.isError ? (
      <RoomFailed onRetry={() => void conv.refetch()} />
    ) : openId && conv.isPending ? (
      <RoomLoading />
    ) : undefined;

  const ids = new Set(view?.messages.map((m) => m.id));
  const messages: MessageView[] = [...older.rows.filter((m) => !ids.has(m.id)), ...(view?.messages ?? [])];
  const hasMore = older.more ?? view?.has_more ?? false;
  const onTop =
    view && hasMore
      ? () => {
          markOlder();
          void older.load(messages[0]);
        }
      : undefined;

  return (
    <TalkBody
      name={name}
      convs={toConvItems(rows, today)}
      current={current}
      entries={view ? toEntries(messages, work, today) : []}
      mview={mview}
      notFound={notFound}
      {...(main ? { main } : {})}
      {...(notices.length ? { notice: <>{notices}</> } : {})}
      {...(onTop ? { onTop } : {})}
      onPick={(id) => router.push(go(`?c=${id}`), { scroll: false })}
      onNew={() => router.push(go("?new=1"), { scroll: false })}
      onBack={() => router.push(go(""), { scroll: false })}
      composer={{
        text,
        mode,
        label: `${name} に話す`,
        offPlaceholder: stopped?.off ? "PC を開くと話せます" : "PC をつなぐと話せます",
        onText: setText,
        onSend: () => void send(),
        onStop: () => void doStop(),
        stopping,
      }}
    />
  );
}
