"use client";
// 分身の部屋「話す」の部品（K-762・キャンバス AiChat・MbTalk）と、チケットの右のパネルの会話（K-764）が同じに使う会話の部品。
//   会話の形（D-104・D-111〜D-115）：言った言葉は右・AI の返事は左の吹き出し・作業中の 1 行と［止める］・止まった理由・下に書く欄。
//   添付・許可に答える・会話の星と探す は後のフェーズ（聞くこと 14）なので、キャンバスどおり出して押せない形にする（D-145.9）。
//   スマホ（767 以下）：会話の一覧と会話は別の画面（mview）。一覧は「＋ 新しく話す」と全幅の会話カード、会話は頭に「‹」（一覧へ戻る）と題・書く欄は下のタブの上に貼り付く。
//   PC の幅では mview は効かず、左に一覧・右に会話が並ぶ
//   前の会話の「記憶に使わない」「覚えたいこと」「業務の型」は段 10 で物が無くなったので出さない。値を受け取って描くだけ
import { ph } from "./phrase";
import { ChevronLeft } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Button, Callout } from "@/components/k";
import { ProposalCard, type Proposal } from "./proposal";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import "./room.css";

export interface Msg {
  id: string;
  who: "me" | "ai";
  time: string;
  body: ReactNode;
  /** 順番の案などの箇条 */
  list?: readonly string[];
  /** 「見たもの：…」の 1 行（AI の返事の下に小さく） */
  took?: string;
  /** 人の言葉の上に小さく出す「題名・本文（直した）を AI に渡しました」（人が欄を直したことを AI に伝えた印） */
  passed?: string;
}
export type Entry =
  | { kind: "day"; label: string }
  | { kind: "msg"; msg: Msg }
  | { kind: "work"; text: string }
  | { kind: "sys"; text: string }
  /** 書きながら返している途中の AI の返事（末尾に点滅する印） */
  | { kind: "stream"; text: string }
  /** 欄に入れられる AI の案（全部使う／選んで使う） */
  | { kind: "proposal"; proposal: Proposal };

export function Thread({ entries }: { entries: readonly Entry[] }) {
  return (
    <ol className="k-room-thread" aria-label="会話">
      {entries.map((e, i) => {
        if (e.kind === "day")
          return (
            <li key={`d${i}`} className="k-room-day-sep">
              {e.label}
            </li>
          );
        if (e.kind === "sys")
          return (
            <li key={`s${i}`} className="k-room-sys">
              {e.text}
            </li>
          );
        if (e.kind === "work")
          return (
            <li key={`w${i}`}>
              <p className="k-room-work" role="status">
                <span className="k-spin" aria-hidden="true" />
                {e.text}
              </p>
            </li>
          );
        if (e.kind === "stream")
          return (
            <li key={`t${i}`} className="k-room-msg" data-who="ai">
              <div className="k-room-bubble" aria-live="polite">
                <p>
                  {e.text}
                  <span className="k-room-caret" aria-hidden="true" />
                </p>
              </div>
              <p className="k-room-took" role="status">
                書いています…
              </p>
            </li>
          );
        if (e.kind === "proposal")
          return (
            <li key={`p${i}`} className="k-room-msg" data-who="ai">
              <ProposalCard proposal={e.proposal} />
            </li>
          );
        const m = e.msg;
        return (
          <li key={m.id} className="k-room-msg" data-who={m.who}>
            {m.passed ? <p className="k-room-passed">{m.passed}</p> : null}
            <div className="k-room-bubble">
              <p>{m.body}</p>
              {m.list ? (
                <ol>
                  {m.list.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ol>
              ) : null}
            </div>
            {m.took ? <p className="k-room-took">{m.took}</p> : null}
            <span className="k-room-msg-time">{m.time}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** 書く欄の状態：idle＝書ける／working＝AI が作業中（送れない・止める）／sending＝送っている／no-pc＝PC がまだで書けない */
export type ComposerMode = "idle" | "working" | "sending" | "no-pc";

export function ChatComposer({
  text = "",
  mode = "idle",
  placeholder = "高本のAI に話す",
  offPlaceholder = "PC をつなぐと話せます",
  quota,
}: {
  text?: string;
  mode?: ComposerMode;
  placeholder?: string;
  /** 書けないとき（no-pc）の案内（PC がまだ／PC が閉じている） */
  offPlaceholder?: string;
  /** 「5 時間の枠 32%」（使い方の数・K-73 の物なので出すが押せない形） */
  quota?: string;
}) {
  const off = mode === "no-pc";
  return (
    <div className="k-room-composer">
      <textarea
        aria-label="高本のAI に話す"
        readOnly
        disabled={off}
        value={text}
        placeholder={off ? offPlaceholder : placeholder}
      />
      <div className="k-room-composer-row">
        <InertButton size="sm">＋ 添付</InertButton>
        <InertButton size="sm">許可：毎回聞く ▾</InertButton>
        {quota ? (
          <span className="k-room-quota" aria-disabled="true" title="まだ使えません">
            {quota}
          </span>
        ) : null}
        <span className="k-room-composer-end">
          {mode === "working" ? (
            <Button variant="outlined" size="sm" className="k-room-send">
              止める
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="k-room-send"
              loading={mode === "sending"}
              disabled={off || (mode === "idle" && text === "")}
            >
              送る
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}

export interface ConvItem {
  id: string;
  title: string;
  sub: string;
  /** 日付のまとまり（「今日」「それ以前」）。前の行と違うところに見出しを出す */
  group?: string;
}

/** 左の会話の一覧。「＋ 新しく話す」は押せる・星と探すは押せない形。current が null なら新しい会話を始めた状態 */
export function ConvList({ items, current }: { items: readonly ConvItem[]; current: string | null }) {
  return (
    <nav aria-label="会話の一覧" className="k-room-convs">
      <Button variant="primary" size="sm">
        ＋ 新しく話す
      </Button>
      <div className="k-room-convs-tools">
        <InertButton size="sm">星をつけた会話</InertButton>
        <InertButton size="sm">会話を探す</InertButton>
      </div>
      {current === null ? (
        <button type="button" className="k-room-conv" aria-current="true">
          <b>新しい会話</b>
          <span>まだ何も話していません</span>
        </button>
      ) : null}
      {items.map((c, i) => (
        <Fragment key={c.id}>
          {c.group && c.group !== items[i - 1]?.group ? <p className="k-room-conv-group">{c.group}</p> : null}
          <button type="button" className="k-room-conv" {...(c.id === current ? { "aria-current": "true" } : {})}>
            <b>{c.title}</b>
            <span>{c.sub}</span>
          </button>
        </Fragment>
      ))}
    </nav>
  );
}

const ROOM_ONLY = "チケットの中での相談は、そのチケットの右のパネルで続きます（ここには出ません）。";

/** 新しい会話（まだ何も話していない） */
export function TalkStart({ name, noPc = false }: { name: string; noPc?: boolean }) {
  // PC がまだの時点では AI は話せない（時点の決まり）。話せるように見せない
  if (noPc) {
    return (
      <div className="k-room-empty">
        <h2>{ph("PC を", "つなぐと、", `${name}と`, "話せます")}</h2>
        <p>つなぐまでは話せません。つないだ後は、考えの整理・段取り・文章の下書きなどを一緒に考えます</p>
      </div>
    );
  }
  return (
    <div className="k-room-empty">
      <h2>{ph(`${name}に、`, "何でも", "話せます")}</h2>
      <p>考えを整理したいこと・段取り・文章の下書きなど。言葉にすると、AI が一緒に考えます</p>
    </div>
  );
}

/** スマホの会話の頭：「‹」（一覧へ戻る）と会話の題。PC の幅では出さない */
function ChatBar({ title, name }: { title: string; name: string }) {
  return (
    <div className="k-room-chat-bar">
      <button type="button" className="k-room-back" aria-label="会話の一覧へ戻る">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <div className="k-room-chat-title">
        <b>{title}</b>
        <span>{`${name}との会話`}</span>
      </div>
    </div>
  );
}

/** 話すタブの本体。entries が空なら新しい会話。mview はスマホでどちらの画面を出すか（list＝会話の一覧・chat＝会話） */
export function TalkBody({
  name,
  convs,
  current,
  entries,
  composer,
  notice,
  mview = "chat",
}: {
  name: string;
  convs: readonly ConvItem[];
  current: string | null;
  entries: readonly Entry[];
  composer: Parameters<typeof ChatComposer>[0];
  /** 止まった理由・PC がまだ などの帯（書く欄の上） */
  notice?: ReactNode;
  mview?: "list" | "chat";
}) {
  const title = current === null ? "新しい会話" : (convs.find((c) => c.id === current)?.title ?? "会話");
  return (
    <div className="k-room-talk" data-mview={mview}>
      <ConvList items={convs} current={current} />
      <section className="k-room-chat" aria-label="会話">
        <ChatBar title={title} name={name} />
        <p className="k-room-aside">{ROOM_ONLY}</p>
        {entries.length === 0 ? (
          <TalkStart name={name} noPc={composer.mode === "no-pc"} />
        ) : (
          <Thread entries={entries} />
        )}
        {notice}
        <ChatComposer {...composer} />
      </section>
    </div>
  );
}

/** 止まった理由・つながっていない などの帯 */
export function TalkNotice({
  tone,
  title,
  children,
}: {
  tone: "warn" | "danger" | "info";
  title: string;
  children: ReactNode;
}) {
  return (
    <Callout tone={tone} title={title}>
      {children}
    </Callout>
  );
}
