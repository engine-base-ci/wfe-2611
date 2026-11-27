"use client";
// 分身の部屋の頭（K-755・キャンバス Room・RoomDone・AiChat）：顔・名前（見出し）・ひとこと・タブ。
//   タブは「ようす・話す・やったこと」の 3 つ。「知っていること」はナレッジ（左のメニュー）へのリンク（聞くこと 12・段 10 でナレッジになった）。
//   下絵では押しても動かない（値を受け取って描くだけ）。本番は links（タブごとの道）と knowledgeHref を渡すとリンクになる（K-755）。画面の名前は「〈名〉のAI」
//   スマホ（767 以下）：ひとことは短い 1 行・タブは 1 段に収める。会話の画面（mobileChat）では頭を畳み、会話の頭（‹ と題）が代わりに立つ（見出しは読み上げ用に残す）
import { Bot, ExternalLink } from "lucide-react";
import Link from "next/link";
import "./room.css";

export type RoomTab = "now" | "talk" | "done";
const TABS: readonly (readonly [RoomTab, string])[] = [
  ["now", "ようす"],
  ["talk", "話す"],
  ["done", "やったこと"],
];

export function RoomHead({
  name,
  initial,
  sub,
  subShort,
  active,
  mobileChat = false,
  links,
  knowledgeHref,
}: {
  name: string;
  initial: string;
  sub: string;
  /** スマホのひとこと（短い 1 行）。無ければ sub のまま */
  subShort?: string;
  active: RoomTab;
  /** スマホで会話の画面を開いている（頭を畳む） */
  mobileChat?: boolean;
  /** タブごとの道（本番）。無ければ押しても動かないボタン（下絵） */
  links?: Record<RoomTab, string>;
  /** 「知っていること」の行き先（ナレッジ）。無ければボタン（下絵） */
  knowledgeHref?: string;
}) {
  return (
    <header className="k-page-head k-room-head" {...(mobileChat ? { "data-mchat": "" } : {})}>
      <div className="k-room-who">
        <span className="k-room-avatar" aria-hidden="true">
          {initial}
          <span className="k-room-avatar-bot">
            <Bot size={10} />
          </span>
        </span>
        <div>
          <h1 id="room-title">{name}</h1>
          <p className="k-room-sub">
            <span className="k-room-sub-long">{sub}</span>
            <span className="k-room-sub-short">{subShort ?? sub}</span>
          </p>
        </div>
      </div>
      <nav aria-label="部屋のタブ" className="k-room-tabs">
        {TABS.map(([key, label]) =>
          links ? (
            <Link key={key} href={links[key]} aria-current={active === key ? "page" : undefined}>
              {label}
            </Link>
          ) : (
            <button type="button" key={key} aria-current={active === key ? "page" : undefined}>
              {label}
            </button>
          ),
        )}
        {knowledgeHref ? (
          <Link href={knowledgeHref} title="ナレッジへ行きます">
            知っていること
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
        ) : (
          <button type="button" title="ナレッジへ行きます">
            知っていること
            <ExternalLink size={12} aria-hidden="true" />
          </button>
        )}
      </nav>
    </header>
  );
}
