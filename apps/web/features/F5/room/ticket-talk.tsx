"use client";
// チケットの右のパネル「〈名〉のAI」タブ（K-764・キャンバス StAiPanel）と、帯の［AI と話す］（止まった帯の［直し方を AI に伝える］は代表の決め answer=4d049789b537 で無くした）。
//   そのチケットのことだけを話す（呼んだ人の権限の中だけ読む・やり取りの書き込みも読んでいる）。キャンバスの「区画」「確認をやり直す」「業務の型」
//   「本文を直す案」は古い物（段 5・10・K-59 の持ち物）なので出さない。会話の部品は talk.tsx と同じ（分身の部屋の「話す」と同じ形）
import { Bot, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Band, BandLine, Button, Callout, Loading } from "@/components/k";
import { ChatComposer, Thread, type ComposerMode, type Entry } from "./talk";
import "./room.css";

//   スマホ（767 以下・キャンバス MbTalk・MobileDetail）：パネルは詳細の下に積まず、「〈名〉のAI」タブを開いた全画面の別画面にする。
//   頭に「‹ 〈チケット〉」・タブは 本文／やり取り／〈名〉のAI・帯があればタブの下に・会話は下のタブの上に貼り付く書く欄まで 1 画面（本文は「本文」タブへ戻る）

/** スマホの頭：「‹」（詳細へ戻る）と チケットの番号・題。PC の幅では出さない */
export function TicketMobileBar({ ticket, title, onBack }: { ticket: string; title: string; onBack?: () => void }) {
  return (
    <div className="k-room-tbar">
      <button type="button" className="k-room-back" aria-label="チケットの詳細へ戻る" onClick={onBack}>
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <div className="k-room-chat-title">
        <b>{`${ticket} ${title}`}</b>
        <span>AI との相談</span>
      </div>
    </div>
  );
}

/** パネルのタブ（PC：項目・やり取り・〈名〉のAI／スマホ：本文・やり取り・〈名〉のAI）。ここでは「〈名〉のAI」が選ばれた形 */
export function AiPanelTabs({ me, count }: { me: string; count?: number }) {
  return (
    <nav aria-label="パネルのタブ" className="k-detail-tabs k-room-ptabs">
      <button type="button">
        <span className="k-room-tab-pc">項目</span>
        <span className="k-room-tab-mb">本文</span>
      </button>
      <button type="button">
        やり取り
        {count ? (
          <span className="k-talk-count" aria-label={`まだ読んでいない書き込み ${count} 件`}>
            {count}
          </span>
        ) : null}
      </button>
      <button type="button" aria-current="page">
        <Bot size={14} aria-hidden="true" />
        {`${me}のAI`}
      </button>
    </nav>
  );
}

/** 会話の場所の形（渡さなければ会話を描く）：読み中・読めない（［もう一度］は呼ぶ側の箱）・見られない */
export type PanelState = { kind: "loading" } | { kind: "notFound" } | { kind: "box"; box: ReactNode };

export interface PanelProps {
  /** 「EG-128」など。上の 1 行と「見ている：…」に出す */
  ticket: string;
  entries: readonly Entry[];
  composer: { text?: string; mode?: ComposerMode; quota?: string; label?: string };
  /** PC がまだ（PS0）：話せない案内を出す */
  noPc?: boolean;
  /** 止まった・失敗 などの帯（書く欄の上） */
  notice?: ReactNode;
  /** 動き（K-764）：渡さなければ今の見た目のまま（下絵） */
  onText?: (text: string) => void;
  onSend?: () => void;
  onStop?: () => void;
  stopping?: boolean;
  state?: PanelState;
}

const NOT_FOUND = "このチケットは見られません";

function PanelThread({ entries, noPc, state }: { entries: readonly Entry[]; noPc: boolean; state?: PanelState }) {
  if (state?.kind === "loading") return <Loading />;
  if (state?.kind === "notFound") return <p className="k-room-note">{NOT_FOUND}</p>;
  if (state?.kind === "box") return <>{state.box}</>;
  if (entries.length > 0) return <Thread entries={entries} />;
  return (
    <p className="k-room-note">
      {noPc ? "まだ話していません" : "まだ話していません。このチケットで困っていることや、直したいことを書いてください"}
    </p>
  );
}

export function AiPanel({
  ticket,
  entries,
  composer,
  noPc = false,
  notice,
  onText,
  onSend,
  onStop,
  stopping,
  state,
}: PanelProps) {
  return (
    <div className="k-room-panel" role="region" aria-label="AI と話す">
      <p className="k-room-aside">{`${ticket} のことを話します ・ やり取りの書き込みも読んでいます`}</p>
      <div className="k-room-panel-thread">
        <PanelThread entries={entries} noPc={noPc} {...(state ? { state } : {})} />
      </div>
      {noPc ? (
        <Callout tone="warn" title="PC がまだつながっていません">
          話すにも PC が要ります。PC をつなぐと、このチケットのことを話せます
        </Callout>
      ) : null}
      {notice}
      <p className="k-room-looking">{`見ている：${ticket} 本文`}</p>
      <ChatComposer
        {...composer}
        mode={noPc ? "no-pc" : (composer.mode ?? "idle")}
        placeholder="このチケットのことを話す"
        {...(onText ? { onText } : {})}
        {...(onSend ? { onSend } : {})}
        {...(onStop ? { onStop } : {})}
        {...(stopping !== undefined ? { stopping } : {})}
      />
    </div>
  );
}

/** 帯「AI に任せる」の作っています：［AI と話す］が押せる（止めるは K-734 の部品） */
export function RunningBandTalk({ name, sub, line }: { name: string; sub: string; line?: string }) {
  return (
    <Band
      tone="info"
      title={`${name}のAI が作っています`}
      sub={sub}
      acts={
        <>
          <Button variant="outlined">AI と話す</Button>
          <Button variant="outlined">止める</Button>
        </>
      }
    >
      {line ? <BandLine>{line}</BandLine> : null}
    </Band>
  );
}
