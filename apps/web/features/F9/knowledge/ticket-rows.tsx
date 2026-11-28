"use client";
// チケットのやり取りに出るナレッジの 3 つの行（K-702）を、段 7 の部品が描く 1 行（ThreadItem）にする。
//   値を読むのは ticket-rows-shape.ts だけ。字は下絵（/dev/mock/f9 の tk-guard・tk-opened）が正で、下絵の描き手もここの部品を使う。
//   作者の無い行なので名前も顔も「AI」（K-574・D-150.40）。口は呼ばない。題名・場所・理由は字として描く
import type { ReactNode } from "react";
import { Avatar, type Person, type ThreadItem } from "@/features/F6/thread/views";
import { GuardList, OpenedText, type GuardPage } from "./ticket-views";
import {
  guardCounts,
  knowledgeFieldOf,
  pageHref,
  readBreach,
  readGuard,
  readOpened,
  type BreachKind,
} from "./ticket-rows-shape";

/** 作者の無い行の名前と顔（K-392 の personOf(null) と同じ） */
export const AI_PERSON: Person = { name: "AI", initial: "AI" };

const hrefOfPage = (p: GuardPage): string | null => pageHref(p.id);

export interface GuardPostProps {
  time: string;
  must: readonly GuardPage[];
  opened: readonly GuardPage[];
  /** ページの開く先（渡さなければ下絵の「#id」） */
  hrefOf?: (p: GuardPage) => string | null;
}

/** AI の書き込み：このチケットで守る物（いちばん新しい行のとき広げる・下絵 tk-guard） */
export function GuardPost({ time, must, opened, hrefOf }: GuardPostProps) {
  return (
    <article className="k-talk-post" aria-label={`${AI_PERSON.name} ${time}`}>
      <Avatar who={AI_PERSON} />
      <div className="k-talk-post-main">
        <div className="k-talk-post-head">
          <b>{AI_PERSON.name}</b>
          <time className="k-talk-sub">{time}</time>
        </div>
        <GuardList must={must} opened={opened} {...(hrefOf ? { hrefOf } : {})} />
      </div>
    </article>
  );
}

/** 畳んだ 1 行の字（後ろに行があるとき・下絵 tk-opened） */
export function GuardLineText({ must, opened }: { must: readonly unknown[]; opened: readonly unknown[] }) {
  return (
    <>
      <b>{AI_PERSON.name}</b> が、このチケットで守る物を並べた（{guardCounts({ must, opened })}）
    </>
  );
}

/** 出来事の種類ごとの括弧の字（ai_self_reported は理由。ほかの 2 つは仮の字・代表に確認中） */
const BREACH_NOTE: Readonly<Record<Exclude<BreachKind, "ai_self_reported">, string>> = {
  ai_unchecked: "AI が終わりを知らせたのに、チェックが付いていなかった",
  human_unchecked: "AI が付けたチェックが外された",
};

/** 守れていなかった決まりの 1 行の字 */
export function BreachText({ kind, title, note }: { kind: BreachKind; title: string; note: string }) {
  const paren = kind === "ai_self_reported" ? note : BREACH_NOTE[kind];
  return (
    <>
      守れていなかった決まりが 1 つ：<b>{title}</b>
      {paren ? `（${paren}）` : null}
      {kind === "ai_self_reported" ? (
        <>
          。<b>{AI_PERSON.name}</b> が直した
        </>
      ) : null}
    </>
  );
}

const line = (text: ReactNode, time: string): ThreadItem => ({ kind: "line", who: AI_PERSON, text, time });

/** やり取りの変更の 1 行の changes を、3 つの行のどれかにする。どれでもなければ null（段 5・段 7 の字に任せる） */
export function knowledgeRowOf(changes: unknown, o: { time: string; expanded: boolean }): ThreadItem | null {
  const field = knowledgeFieldOf(changes);
  if (field === null) return null;
  const first: unknown = (changes as readonly unknown[])[0];
  switch (field) {
    case "guard_list": {
      const g = readGuard(first);
      if (!g) return null;
      return o.expanded
        ? {
            kind: "node",
            node: <GuardPost time={o.time} must={g.must} opened={g.opened} hrefOf={hrefOfPage} />,
          }
        : line(<GuardLineText must={g.must} opened={g.opened} />, o.time);
    }
    case "knowledge_open": {
      const p = readOpened(first);
      if (!p) return null;
      return line(
        <OpenedText ai={AI_PERSON.name} title={p.title} place={p.place} href={pageHref(p.page_id)} />,
        o.time,
      );
    }
    case "knowledge_breach": {
      const b = readBreach(first);
      if (!b) return null;
      return line(<BreachText kind={b.kind} title={b.title} note={b.note} />, o.time);
    }
  }
}
