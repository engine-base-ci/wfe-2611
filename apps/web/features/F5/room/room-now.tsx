"use client";
// 分身の部屋「ようす」の中身（K-755・/ai）：3 本の答え（getMyClone・getCloneNow・getCloneGrowth）を部品の値に直して並べる。
//   どれかが答える前は読み込み中・どれかが落ちたら読めない箱（［もう一度］で落ちた口だけ読み直す）。401 は入り直し（共通の扱い）。
//   PC がまだ（none）：PC をつなぐ案内と はじめての区画（いま・このあとは出さない）。閉じている（asleep）：閉じている箱と お休み中。
//   つながっている（live）：ようすとスマホの下の入口（入口は 767 以下だけ見える）
import type { GrowthView, NextRow, NowView, RoomNow as RoomNowValues } from "./overview";
import { PcClosed, PcNone, RoomFailed, RoomFirst, RoomLoading, RoomOverview, TalkEntry } from "./overview";
import { ROOM_LINKS } from "./room-frame";
import { roomName, sinceText, stateText, workTime } from "./room-words";
import { useCloneGrowth, useCloneMe, useCloneNow, type CloneGrowthAnswer, type CloneNowAnswer } from "./use-clone";

const BRIDGE_HREF = "/setup/bridge";
const CREATE_HREF = "/tickets?new=1";

function nowView(a: CloneNowAnswer, at: Date): NowView | null {
  if (!a.current) return null;
  const c = a.current;
  return {
    ticket: c.ticket_number,
    title: c.progress ?? c.title,
    since: sinceText(c.started_at, at),
    href: `/tickets/${c.ticket_id}`,
  };
}

function nextRows(a: CloneNowAnswer): NextRow[] {
  return a.next.map((n) => {
    const s = stateText(n.state);
    return { ticket: n.ticket_number, title: n.title, state: s.text, ...(s.warn ? { warn: true } : {}) };
  });
}

function growthView(g: CloneGrowthAnswer): GrowthView {
  return {
    assigned: g.assigned,
    passRate: g.pass_rate,
    ...(g.pass_rate_last_week !== null ? { lastWeek: g.pass_rate_last_week } : {}),
    workTime: workTime(g.work_seconds),
  };
}

export function toRoomNow(a: CloneNowAnswer, g: CloneGrowthAnswer, at: Date): RoomNowValues {
  return {
    now: nowView(a, at),
    next: nextRows(a),
    waiting: { approvals: a.waiting_approvals, stopped: a.stopped },
    growth: growthView(g),
    asleep: a.pc.state === "asleep",
  };
}

export function RoomNow() {
  const me = useCloneMe();
  const now = useCloneNow();
  const growth = useCloneGrowth();
  const all = [me, now, growth];
  if (all.some((q) => q.isError)) {
    const retry = () => {
      for (const q of all) if (q.isError) void q.refetch();
    };
    return <RoomFailed onRetry={retry} />;
  }
  if (!me.data || !now.data || !growth.data) return <RoomLoading />;
  const name = roomName(me.data);
  const pc = now.data.pc;
  if (pc.state === "none")
    return (
      <>
        <PcNone href={BRIDGE_HREF} />
        <RoomFirst name={name} createHref={CREATE_HREF} />
      </>
    );
  const values = toRoomNow(now.data, growth.data, new Date());
  if (pc.state === "asleep")
    return (
      <>
        <PcClosed href={BRIDGE_HREF} {...(pc.label ? { label: pc.label } : {})} />
        <RoomOverview {...values} />
      </>
    );
  return (
    <>
      <RoomOverview {...values} />
      <TalkEntry name={name} href={ROOM_LINKS.talk} />
    </>
  );
}
