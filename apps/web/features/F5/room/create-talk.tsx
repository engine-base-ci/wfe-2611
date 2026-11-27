"use client";
// チケットを作る画面の「左に欄・右に AI との会話」（K-767・K-777）。CreateChat の動き（onText・onSend・onStop・onStarter・onBack・locked）は K-767 が足した任意の props。人は欄に自分で書いてもよく、AI の案は右の会話のカードから欄に入れる。
//   左の欄の並びと字は段 5 の作る面と同じ（種別・題名・本文・つながり・項目・確認項目・ファイル・知らせる人）。値を受け取って描くだけ。
//   AI は人が書いた・直した欄の中身を毎回受け取ってから答える（会話の人の言葉の上に「…を AI に渡しました」の印）。
//   スマホ（767 以下）：欄と会話は別の画面。頭の［AI と話して作る］で会話が全画面で出る（mview＝form は欄・chat は会話）
import { ph } from "./phrase";
import { ChevronLeft, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button, Select, TextArea, TextField } from "@/components/k";
import { InertButton } from "@/features/F4/create-ticket/detail-head";
import { ChoiceRow } from "./proposal";
import { ChatComposer, Thread, type ComposerMode, type Entry } from "./talk";
import "./room.css";

export type FieldMark = "ai" | "edited";
export interface CreateValues {
  title: string;
  /** 本文（自由な 1 枚の文書・区画の欄は持たない D-153・drift 2026-11-21） */
  body: string;
  checks: readonly string[];
  /** 欄ごとの印：ai＝AI の案が入った／edited＝人が直した */
  marks?: Partial<Record<"title" | "body" | "checks", FieldMark>>;
}

export const EMPTY_VALUES: CreateValues = { title: "", body: "", checks: [] };

function Mark({ mark }: { mark: FieldMark | undefined }) {
  if (!mark) return null;
  return <Badge tone={mark === "ai" ? "ai" : "neutral"}>{mark === "ai" ? "AI の案" : "直しました"}</Badge>;
}

function Label({ text, mark }: { text: string; mark: FieldMark | undefined }) {
  return (
    <span className="k-room-cf-label">
      {text}
      <Mark mark={mark} />
    </span>
  );
}

const PEOPLE = [
  { value: "m1", label: "高本 聖斗" },
  { value: "m2", label: "鈴木 一郎" },
  { value: "m3", label: "佐藤 花子" },
];

/** 左の欄。段 5 の作る面と同じ並び。値は props・どの欄も readOnly（下絵では書き込まない） */
export function CreateFormView({
  values,
  saved = "下書きを保存しました 10:42",
  entry,
}: {
  values: CreateValues;
  saved?: string;
  entry?: boolean;
}) {
  const { marks = {} } = values;
  const required = (values.title ? 1 : 0) + (values.body ? 1 : 0);
  const blank = !values.body;
  return (
    <form className="k-room-cf" noValidate aria-label="チケットを作る">
      <header className="k-room-cf-head">
        <h1 id="create-ticket-title">チケットを作る</h1>
        <div className="k-room-cf-acts">
          <Button variant="outlined">下書きのまま閉じる</Button>
          <Button>作る</Button>
        </div>
        <p className="k-room-cf-saved" role="status">
          {saved}
          <span>{`必須 ${required} / 2`}</span>
        </p>
      </header>
      <div className="k-room-cf-how" role="group" aria-label="作り方">
        <span>自分で書く</span>
        <span aria-current="true">AI と話して作る</span>
        <span aria-disabled="true" title="まだ使えません">
          過去のチケットから複製
        </span>
      </div>
      {entry ? (
        <button type="button" className="k-room-cf-ask">
          <Sparkles size={16} aria-hidden="true" />
          AI と話して作る
        </button>
      ) : null}
      <div className="k-room-cf-parent">
        <span>親のチケット</span>
        <Button variant="outlined" size="sm">
          親を決める
        </Button>
        <small>なしでも作れます</small>
      </div>
      <div className="k-room-cf-trio">
        <Select
          label="グループ"
          name="group"
          required
          value="eg"
          options={[
            { value: "eg", label: "営業（EG）" },
            { value: "jd", label: "受託開発（JD）" },
          ]}
        />
        <Select label="種別" name="kind" required value="task" options={[{ value: "task", label: "タスク" }]} />
        <TextField
          label={<Label text="題名" mark={marks.title} />}
          name="title"
          required
          readOnly
          value={values.title}
          placeholder="題名"
        />
      </div>
      <section className="k-room-cf-box" aria-label="本文">
        {blank ? (
          <div className="k-room-cf-tpl">
            <span>種別「タスク」のひな形が入っています。消しても、自由に書き換えても構いません</span>
            <Button variant="ghost" size="sm">
              ひな形を消す
            </Button>
          </div>
        ) : null}
        <TextArea
          label={<Label text="本文" mark={marks.body} />}
          name="body"
          rows={6}
          readOnly
          value={values.body}
          placeholder="頼まれた経緯や、やること・送る物・送り先を、自由に書きます"
        />
        <button type="button" className="k-room-cf-add">
          ＋ つながりを足す<small>関連・派生元のチケットを足します</small>
        </button>
        <div className="k-room-cf-grid" role="group" aria-label="項目">
          <Select
            label="状態"
            name="stage"
            value="todo"
            options={[
              { value: "todo", label: "未着手" },
              { value: "doing", label: "作業中" },
            ]}
          />
          <Select label="担当者" name="assignee" required value="m1" options={PEOPLE} />
          <Select
            label="優先度"
            name="priority"
            value="mid"
            options={[
              { value: "mid", label: "中" },
              { value: "high", label: "高" },
            ]}
          />
          <Select label="節目" name="milestone" placeholder="選ぶ" options={[{ value: "m", label: "11 月の締め" }]} />
          <TextField label="開始日" name="start_on" type="date" value="2026-12-01" readOnly />
          <TextField label="期限" name="due_on" type="date" required value="2026-12-26" readOnly />
          <TextField label="予定時間" name="est" value="2" description="見込みの時間です。例：1、0.25、36" readOnly />
          <TextField label="実績時間" name="act" value="" description="かかった作業時間です" readOnly />
          <Select label="取引先" name="client" value="c1" options={[{ value: "c1", label: "セイコー商事" }]} />
          <TextField label="支払期日" name="c_due" type="date" value="" description="請求書に書く支払の期日" readOnly />
          <Select
            label="PJコード"
            name="c_pj"
            placeholder="選ぶ"
            options={[
              { value: "a", label: "SK-2026-11 セイコー商事 保守" },
              { value: "b", label: "SK-2026-12 セイコー商事 追加開発" },
            ]}
          />
          <TextField label="請求額" name="c_amt" inputMode="numeric" description="税込の金額（円）" value="" readOnly />
          <TextField label="先方の担当者名" name="t1" description="請求書の宛名に入れます" value="" readOnly />
          <Select label="分類" name="t4" placeholder="選ぶ" options={[{ value: "a", label: "請求" }]} />
          <fieldset className="k-room-cf-multi">
            <legend>送る書類</legend>
            <ChoiceRow label="請求書" />
            <ChoiceRow label="明細" />
            <ChoiceRow label="納品書" />
          </fieldset>
          <div className="k-room-cf-single">
            <span>原本の郵送</span>
            <ChoiceRow label="原本を郵送する" />
          </div>
          <TextArea label="社内メモ" name="t7" rows={2} description="社内だけで共有する補足" value="" readOnly />
        </div>
        <section className="k-room-cf-checks" aria-label="確認項目">
          <h2>
            <Label text="確認項目" mark={marks.checks} />
          </h2>
          {values.checks.length === 0 ? (
            <p className="k-room-note">確認項目はまだありません。足すと、終わったときに機械と人が確かめます</p>
          ) : (
            <ul>
              {values.checks.map((c) => (
                <li key={c}>
                  <ChoiceRow label={c} />
                  <Button variant="ghost" size="sm" aria-label={`${c}を外す`}>
                    外す
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="k-room-cf-checks-acts">
            <Button variant="outlined" size="sm">
              ＋ 確認項目を足す
            </Button>
            <InertButton size="sm">AI の案を出す</InertButton>
          </div>
        </section>
      </section>
      <div className="k-room-cf-drop" role="group" aria-label="ファイルを置く" aria-disabled="true">
        ファイルをここに置くか、貼り付ける
        <Button variant="outlined" size="sm" disabled title="ファイルを選ぶ（まだ使えません）">
          ファイルを選ぶ
        </Button>
      </div>
      <section className="k-room-cf-notify" aria-label="知らせる人">
        <TextField
          label="作ったことを知らせる人"
          name="notify_filter"
          placeholder="名前で絞り込む（担当者と承認する人には自動で届く）"
          value=""
          readOnly
        />
        <div className="k-room-cf-people" role="group" aria-label="知らせる人の候補">
          <ChoiceRow label="鈴木 一郎" />
          <ChoiceRow label="佐藤 花子" />
        </div>
      </section>
    </form>
  );
}

export interface ChatSideProps {
  entries: readonly Entry[];
  composer: ComposerProps;
  /** 話せない・止まった などの帯（書く欄の上） */
  notice?: ReactNode;
  /** 空のとき出す案内と例 */
  starters?: readonly string[];
  noPc?: boolean;
}
type ComposerProps = Parameters<typeof ChatComposer>[0];

/** 動きの任意の props（K-767・渡さなければ今の見た目のまま＝下絵） */
export interface ChatActs {
  onText?: (text: string) => void;
  onSend?: () => void;
  onStop?: () => void;
  /** 話しかける例を押した（その字で言う） */
  onStarter?: (text: string) => void;
  /** 「‹」（欄へ戻る・スマホ） */
  onBack?: () => void;
  /** 作る権限が無い（D-153.35）：例と書く欄を押せない形 */
  locked?: boolean;
}

/** 右の会話。頭に「高本のAI と話して作る」・案は左の欄に入る旨の 1 行・会話・書く欄 */
export function CreateChat({
  name,
  entries,
  composer,
  notice,
  starters,
  noPc = false,
  onText,
  onSend,
  onStop,
  onStarter,
  onBack,
  locked = false,
}: ChatSideProps & ChatActs & { name: string }) {
  const off = noPc || locked;
  const acts = {
    ...(onText ? { onText } : {}),
    ...(onSend ? { onSend } : {}),
    ...(onStop ? { onStop } : {}),
  };
  return (
    <section className="k-room-cc" aria-label="AI との会話">
      <div className="k-room-chat-bar k-room-cc-bar">
        <button type="button" className="k-room-back" aria-label="欄へ戻る" onClick={onBack}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <div className="k-room-chat-title">
          <b>{`${name}と話して作る`}</b>
          <span>案は左の欄に入ります。欄は自分で直せます</span>
        </div>
      </div>
      <p className="k-room-aside k-room-cc-aside">
        話した内容と、あなたが書いた欄の中身を、AI が毎回読んでから答えます
      </p>
      <div className="k-room-cc-thread">
        {entries.length === 0 ? (
          <div className="k-room-empty">
            {noPc ? (
              <>
                <h2>{ph("PC を", "つなぐと、", "AI と", "話して", "作れます")}</h2>
                <p>それまでは、左の欄に自分で書いて作れます</p>
              </>
            ) : (
              <>
                <h2>{ph("何を", "作りたいか、", "話しかけて", "ください")}</h2>
                <p>ざっくりで構いません。AI が題名・本文・確認項目の案を出します</p>
              </>
            )}
            {starters ? (
              <ul className="k-room-starters" aria-label="話しかける例">
                {starters.map((s) => (
                  <li key={s}>
                    <button type="button" disabled={off} onClick={onStarter ? () => onStarter(s) : undefined}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <Thread entries={entries} />
        )}
      </div>
      {notice}
      <ChatComposer
        {...composer}
        {...acts}
        mode={off ? "no-pc" : (composer.mode ?? "idle")}
        placeholder="何を作りたいか話す"
        offPlaceholder={locked ? "" : "PC をつなぐと話せます"}
      />
    </section>
  );
}

/** 作る画面の本体：左に欄・右に会話。mview はスマホでどちらの画面を出すか */
export function CreateTalk({
  values,
  name,
  mview = "chat",
  entry = false,
  saved,
  ...chat
}: { values: CreateValues; name: string; mview?: "form" | "chat"; entry?: boolean; saved?: string } & ChatSideProps) {
  return (
    <div className="k-room-ct" data-mview={mview}>
      <div className="k-room-ct-form">
        <CreateFormView values={values} entry={entry} {...(saved ? { saved } : {})} />
      </div>
      <CreateChat name={name} {...chat} />
    </div>
  );
}
