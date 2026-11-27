"use client";
// 自分の設定 › プロフィール（キャンバス MeProfile・MeProfileEdit）。変えたらすぐ保存される（保存のボタンは無い）。
//   値を受け取って描くだけ（口は呼ばない）。画面の字のうち、キャンバスに無い物（入力の誤り・写真の誤り・確かめ待ち）は仮
import { useState } from "react";
import { Button, Callout, Select, TextField } from "@/components/k";
import { Pill, RowButton, SettingCard, SettingNote, SettingRow } from "@/components/k/setting-parts";
import "./account.css";

export interface ProfileState {
  name: string;
  nick: string;
  email: string;
  /** 名前の欄の状態：保存した（時刻つき）・空・長すぎる・保存できなかった */
  nameStatus?: "saved" | "empty" | "long" | "failed";
  /** 写真：文字（既定）・選んだ */
  face?: "text" | "photo";
  /** 選び直した写真が大きすぎた */
  faceError?: boolean;
  /** 打つたびに名前の誤りを出す（空・長すぎる）。保存できなかった帯も出す */
  live?: boolean;
  /** 確かめのメールを送って待っている新しいアドレス */
  emailPending?: string;
  /** ほかの画面での見え方（長い名前の見本）を出す */
  showPreview?: boolean;
}

const NAME_MAX = 100;
const NICK_MAX = 20;
const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

const NAME_ERROR: Record<string, string> = {
  empty: "名前を入れてください",
  long: `名前は ${NAME_MAX} 文字までです。短くしてください`,
  failed: "保存できませんでした。もう一度、入れ直してください",
};

function Face({ p }: { p: ProfileState }) {
  const first = p.nick.slice(0, 1);
  return (
    <div className="k-f10a-face">
      {p.face === "photo" ? (
        <span className="k-f10a-photo" aria-label="選んだ写真（見本）">
          写
        </span>
      ) : (
        <span className="k-f10a-avatar" aria-hidden="true">
          {first}
        </span>
      )}
      <div className="k-f10a-choices">
        <Button variant="outlined" size="sm">
          写真を選ぶ
        </Button>
        <Button variant="ghost" size="sm" disabled={p.face !== "photo"}>
          文字に戻す
        </Button>
      </div>
      <p className="k-f10a-note">写真がなければ、呼ばれ方の 1 文字目を出す</p>
      {p.faceError ? <Callout tone="danger">写真は 5 MB までです。小さい写真を選んでください</Callout> : null}
    </div>
  );
}

function Preview({ p }: { p: ProfileState }) {
  const first = p.nick.slice(0, 1);
  return (
    <SettingCard title="ほかの画面での見え方" aside="長い名前でも崩れない" labelledBy="pf-preview">
      <li className="k-f10a-preview">
        <div>
          <span>右上の顔・アバター</span>
          <span className="k-f10a-avatar" aria-hidden="true">
            {first}
          </span>
          <span className="k-f10a-note">呼ばれ方の 1 文字目</span>
        </div>
        <div>
          <span>一覧の担当者（狭い）</span>
          <span className="k-f10a-cut">{p.nick}</span>
          <span className="k-f10a-note">狭い所は呼ばれ方。指を乗せると正式な名前が出る</span>
        </div>
        <div>
          <span>メンバーの一覧</span>
          <span className="k-f10a-cut">
            {p.name}
            {"\u3000"}
            {p.email}
          </span>
          <span className="k-f10a-note">入りきらないところは「…」で切り、全部は指を乗せると出る</span>
        </div>
        <div>
          <span>やり取り・プロフィール</span>
          <span className="k-f10a-wrap">{p.name}</span>
          <span className="k-f10a-note">折り返して全部出す</span>
        </div>
        <div>
          <span>@ で呼ぶ</span>
          <span>@{p.nick}</span>
          <span className="k-f10a-note">呼ばれ方を使う</span>
        </div>
      </li>
    </SettingCard>
  );
}

/** 自分のカード（顔・名前・呼ばれ方・メール） */
function SelfCard({ p }: { p: ProfileState }) {
  const [typed, setTyped] = useState(p.name);
  const count = Array.from(typed).length;
  const liveStatus = count === 0 ? "empty" : count > NAME_MAX ? "long" : undefined;
  const status = p.live ? liveStatus : p.nameStatus;
  const err = status && status !== "saved" ? NAME_ERROR[status] : undefined;
  return (
    <SettingCard title="自分" aside="変えたらすぐ保存される（保存のボタンはない）" labelledBy="pf-self">
      <li className="k-f10a-fieldrow">
        <b>顔</b>
        <span className="k-f10a-note">ワークスペースのみんなと、自分の分身の部屋に出る</span>
        <Face p={p} />
      </li>
      {p.live ? (
        <li className="k-f10a-fieldrow">
          <Callout tone="danger">保存できませんでした。通信を確かめて、もう一度入れ直してください</Callout>
        </li>
      ) : null}
      <li className="k-f10a-fieldrow">
        <TextField
          label="名前"
          name="name"
          description="正式な名前。長くてもよい（100 文字まで）"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          error={err}
        />
        <div className="k-f10a-meta">
          {status === "saved" ? <span className="k-f10a-ok">✓ 保存しました ・ 11:20</span> : null}
          <span>
            {count} ／ {NAME_MAX}
          </span>
        </div>
      </li>
      <li className="k-f10a-fieldrow">
        <TextField
          label="呼ばれ方"
          name="nick"
          description={`狭い所・@ で呼ぶとき・分身が呼ぶときに使う短い名前（${NICK_MAX} 文字まで）`}
          defaultValue={p.nick}
        />
      </li>
      <SettingRow
        name="メール"
        detail={
          p.emailPending
            ? `確かめのメールを ${p.emailPending} に送りました。リンクを押すと変わります。それまでは ${p.email} で入れます`
            : "ログインと知らせに使う。変えると新しいアドレスに確かめのメールが届く"
        }
        pill={p.emailPending ? <Pill tone="warning">確かめ待ち</Pill> : <Pill>{p.email}</Pill>}
        actions={
          p.emailPending ? (
            <>
              <RowButton>送り直す</RowButton>
              <RowButton>やめる</RowButton>
            </>
          ) : (
            <RowButton>変える</RowButton>
          )
        }
      />
    </SettingCard>
  );
}

function ViewCard() {
  return (
    <SettingCard title="見え方" labelledBy="pf-view">
      <SettingRow
        name="言語"
        detail="いまは日本語だけ。ほかの言語はあとで足せる作りにしてある"
        pill={<Pill>日本語</Pill>}
      />
      <li className="k-f10a-fieldrow">
        <b>見た目</b>
        <fieldset className="k-f10a-choices">
          <legend className="sr-only">見た目</legend>
          {["明るい", "暗い", "PC に合わせる"].map((t, i) => (
            <label key={t}>
              <input type="radio" name="pf-theme" defaultChecked={i === 0} /> {t}
            </label>
          ))}
        </fieldset>
      </li>
      <li className="k-f10a-fieldrow">
        <b>週のはじめ</b>
        <span className="k-f10a-note">カレンダーとガント</span>
        <fieldset className="k-f10a-choices">
          <legend className="sr-only">週のはじめ</legend>
          {["日曜", "月曜"].map((t, i) => (
            <label key={t}>
              <input type="radio" name="pf-week" defaultChecked={i === 0} /> {t}
            </label>
          ))}
        </fieldset>
      </li>
      <li className="k-f10a-fieldrow">
        <Select
          label="時間帯"
          name="tz"
          defaultValue="tokyo"
          options={[
            { value: "tokyo", label: "東京（UTC+9）" },
            { value: "osaka", label: "大阪（UTC+9）" },
            { value: "utc", label: "世界標準（UTC）" },
          ]}
        />
      </li>
    </SettingCard>
  );
}

export interface WsRow {
  mark: string;
  name: string;
  role: string;
  group?: string;
  /** 抜けるを出す（自分だけの場所は出さない） */
  canLeave?: boolean;
  own?: boolean;
}
export const WORKSPACES: readonly WsRow[] = [
  { mark: "E", name: "株式会社ENGINE BASE", role: "管理者", group: "営業" },
  { mark: "高", name: "高本 聖斗（個人）", role: "自分だけ", own: true },
  { mark: "京", name: "京蟻システム株式会社", role: "メンバー", canLeave: true },
];

function WorkspacesCard({ onLeave }: { onLeave?: () => void }) {
  return (
    <SettingCard title="入っているワークスペース" labelledBy="pf-ws">
      {WORKSPACES.map((w) => (
        <SettingRow
          key={w.name}
          icon={<span className="k-f10a-mark">{w.mark}</span>}
          name={w.name}
          detail={w.group ? `${w.role} ・ ${w.group}` : w.role}
          actions={
            w.canLeave ? (
              <RowButton onClick={onLeave}>抜ける</RowButton>
            ) : (
              <RowButton {...inert} disabled>
                抜ける
              </RowButton>
            )
          }
        />
      ))}
      <SettingNote>自分だけの場所と、最後の管理者になっている場所からは抜けられません</SettingNote>
    </SettingCard>
  );
}

/** プロフィールの本文（自分の設定の外枠の中） */
export function ProfileBody({ p, onLeave }: { p: ProfileState; onLeave?: () => void }) {
  return (
    <section className="k-page k-me-page" aria-labelledby="profile-title">
      <header className="k-page-head">
        <h1 id="profile-title">プロフィール</h1>
        <p className="k-desc">アカウント全体に効く</p>
      </header>
      <SelfCard p={p} />
      {p.showPreview ? <Preview p={p} /> : null}
      <ViewCard />
      <WorkspacesCard onLeave={onLeave} />
    </section>
  );
}
