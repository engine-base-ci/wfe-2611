"use client";
// 作る画面の右の AI との会話（K-767・D-153.17）。作り方「AI と話して作る」（道 how=ai）のとき、欄の右に会話を置く。
//   PC の幅：欄と会話を横に並べる（room.css の .k-room-ct の格子）。スマホ（767 以下）：欄の画面の頭にいつも［AI と話して作る］
//   （.k-room-cf-ask）を出し、押すと how=ai と会話の全画面（data-mview="chat"）・「‹」で欄の画面に戻り how=ai を外す。
//   言うたびに欄の今の中身と、前に渡したときから人が直した欄を渡す（use-draft-talk）。「見たもの」は出さない（D-153.34）。
//   PC がまだ（getMyClone の pc.state が none）なら PC の案内・例と書く欄は押せない（左の欄はそのまま書ける）。
//   作る権限が無い（E-TALK-062・D-153.35）なら正本の文・例と書く欄は押せない形
//   AI の案のカード（K-777）：［全部使う］［選んで使う］で onApply に新しい欄の値を渡す（口は呼ばない）。使った結果はここが覚える
//   （読み直しでもそのまま）。覚えていない案（開き直し）は、欄の今の中身と案を比べて出す。後から別のカードを使ったら、前に使ったカードの行は欄の字と比べ直す
import { Sparkles } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { Button, Callout } from "@/components/k";
import { CreateChat } from "./create-talk";
import { STARTERS, SEND_FAILED, type DraftNow } from "./draft-words";
import type { Proposal } from "./proposal";
import {
  applyProposal,
  keysOf,
  resultOf,
  type ProposalForm,
  type ProposalInput,
  type ProposalKey,
  type ProposalOutcome,
} from "./proposal-apply";
import type { Entry } from "./talk";
import { PcNone } from "./overview";
import { TalkNotice } from "./talk";
import { useCloneMe } from "./use-clone";
import { roomName } from "./room-words";
import { setHowAi, useHowAi, useMobile, type DraftTalk } from "./use-draft-talk";

/** 作り方の並びの「AI と話して作る」（作る面の頭・今のとき aria-current） */
export function AiHowButton(): ReactNode {
  const on = useHowAi();
  return (
    <button type="button" aria-current={on ? "true" : undefined} onClick={() => setHowAi(true)}>
      AI と話して作る
    </button>
  );
}

/** 作り方の並びの「自分で書く」（押すと how=ai を外す） */
export function SelfHowButton(): ReactNode {
  const on = useHowAi();
  return (
    <button type="button" aria-current={on ? undefined : "true"} onClick={() => setHowAi(false)}>
      自分で書く
    </button>
  );
}

function Notice({ talk }: { talk: DraftTalk }): ReactNode {
  const b = talk.block;
  if (!b) return null;
  if (b.kind === "no-pc") return <PcNone />;
  if (b.kind === "failed")
    return (
      <TalkNotice tone="danger" title={SEND_FAILED.title}>
        {SEND_FAILED.body}
      </TalkNotice>
    );
  if (b.kind === "gone")
    return (
      <TalkNotice tone="warn" title={b.text}>
        <Button variant="outlined" size="sm" onClick={talk.restart}>
          新しく話す
        </Button>
      </TalkNotice>
    );
  if (b.kind === "locked") return <Callout tone="warn">{b.text}</Callout>;
  return <p className="k-room-note">{b.text}</p>;
}

/** 案を欄に入れたときに作る面へ渡す物：入れた後の欄の値と、入れた欄 */
export type ApplyProposal = (next: ProposalForm, keys: readonly ProposalKey[]) => void;

/** 使った後の形（選んだ欄は入った・ほかは使っていない） */
function usedOutcome(p: ProposalInput, keys: readonly ProposalKey[]): ProposalOutcome {
  const all = keysOf(p);
  const results = Object.fromEntries(all.map((k) => [k, keys.includes(k) ? "in" : "skipped"] as const));
  return { mode: all.every((k) => keys.includes(k)) ? "all" : "some", results };
}

/** 前に使ったカードを、欄の今の中身と比べ直す（使ったカードなので、どれも違っても「使っていません」の形のまま） */
function recheck(form: ProposalForm, p: ProposalInput): ProposalOutcome {
  const r = resultOf(form, p);
  return { mode: r.mode === "all" ? "all" : "some", results: r.results };
}

/** カードの行に、使った結果と押したときの動きを足す */
function withOutcome(p: Proposal, o: ProposalOutcome, use: (keys: ProposalKey[]) => void): Proposal {
  const items = p.items.map((it) => {
    const r = o.results[it.key as ProposalKey];
    return r ? { ...it, result: r } : it;
  });
  if (o.mode !== "open") return { ...p, mode: o.mode, items };
  const keys = keysOf(p.input ?? {});
  return { ...p, mode: "open", items, onAll: () => use(keys), onPick: (k) => use(k as ProposalKey[]) };
}

/** 会話の行のうち案のカードに、使った結果（覚えている物・無ければ欄の今の中身と比べた物）と動きを足す */
function useProposalCards(
  entries: readonly Entry[],
  draft: () => DraftNow,
  onApply: ApplyProposal | undefined,
): readonly Entry[] {
  const [used, setUsed] = useState<Readonly<Record<string, ProposalOutcome>>>({});
  const use = useCallback(
    (id: string, input: ProposalInput, keys: readonly ProposalKey[]) => {
      if (!onApply || keys.length === 0) return;
      const next = applyProposal(draft(), input, keys);
      onApply(next, keys);
      setUsed((cur) => {
        const out: Record<string, ProposalOutcome> = {};
        for (const [k, o] of Object.entries(cur)) {
          const other = entries.find((e) => e.kind === "proposal" && e.proposal.id === k);
          out[k] = other?.kind === "proposal" && other.proposal.input ? recheck(next, other.proposal.input) : o;
        }
        out[id] = usedOutcome(input, keys);
        return out;
      });
    },
    [draft, entries, onApply],
  );
  if (!onApply) return entries;
  const form = draft();
  return entries.map((e) => {
    if (e.kind !== "proposal" || !e.proposal.input || !e.proposal.id) return e;
    const { id, input } = e.proposal;
    const o = used[id] ?? resultOf(form, input);
    return { ...e, proposal: withOutcome(e.proposal, o, (keys) => use(id, input, keys)) };
  });
}

export function CreateTalkAside({
  talk,
  draft,
  onApply,
}: {
  talk: DraftTalk;
  draft: () => DraftNow;
  /** AI の案を欄に入れる（K-777）。渡さなければカードは押せない形 */
  onApply?: ApplyProposal;
}): ReactNode {
  const me = useCloneMe();
  const noPc = me.data?.pc?.state === "none";
  const locked = talk.block?.kind === "locked";
  const entries = useProposalCards(talk.entries, draft, onApply);
  return (
    <CreateChat
      name={roomName(me.data)}
      entries={entries}
      starters={STARTERS}
      noPc={noPc}
      locked={locked}
      notice={noPc && !talk.block ? <PcNone /> : <Notice talk={talk} />}
      composer={{
        text: talk.text,
        mode: talk.mode,
        label: `${roomName(me.data)} に話す`,
        stopping: talk.stopping,
      }}
      onText={talk.setText}
      onSend={() => void talk.send(talk.text, draft())}
      onStop={() => void talk.stop()}
      onStarter={(s) => void talk.send(s, draft())}
      onBack={() => setHowAi(false)}
    />
  );
}

/** 欄（children）と右の会話の格子。how=ai でもスマホでもなければ、欄だけをそのまま出す */
export function CreateTalkFrame({
  talk,
  draft,
  onApply,
  children,
}: {
  talk: DraftTalk;
  draft: () => DraftNow;
  /** AI の案を欄に入れる（K-777） */
  onApply?: ApplyProposal;
  children: ReactNode;
}): ReactNode {
  const how = useHowAi();
  const mobile = useMobile();
  // 欄（children）は幅や作り方が替わっても木の同じ場所に置く（767 を跨ぐたびに欄が付け直され、開いた小窓・書いた中身が消えないように）。
  //   会話も「AI と話して作る」も無いときは、包む箱を display: contents にして今までの並びのまま（data-plain）
  const plain = !how && !mobile;
  return (
    <div className="k-room-ct" data-mview={how ? "chat" : "form"} data-plain={plain || undefined}>
      <div className="k-room-ct-form">
        {plain ? null : (
          <button type="button" className="k-room-cf-ask" onClick={() => setHowAi(true)}>
            <Sparkles size={16} aria-hidden="true" />
            AI と話して作る
          </button>
        )}
        {children}
      </div>
      {how ? <CreateTalkAside talk={talk} draft={draft} {...(onApply ? { onApply } : {})} /> : null}
    </div>
  );
}
