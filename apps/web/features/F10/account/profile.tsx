"use client";
// 自分の設定 › プロフィール（キャンバス MeProfile・MeProfileEdit）。変えたらすぐ保存される（保存のボタンは無い）。
//   値を受け取って描くだけ（口は呼ばない）。画面の字のうち、キャンバスに無い物（入力の誤り・写真の誤り・確かめ待ち）は仮
//   本番（K-839）は任意の props（ProfileActions）で操作を受け取る。渡さない呼び方（モック）は今の見た目のまま
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, Callout, Select, TextField } from "@/components/k";
import { Pill, RowButton, SettingCard, SettingNote, SettingRow } from "@/components/k/setting-parts";
import {
  NAME_EMPTY,
  NAME_LONG,
  NAME_MAX,
  NICK_MAX,
  PHOTO_ACCEPT,
  PHOTO_TOO_BIG,
  nameProblem,
  nickProblem,
  type MeTheme,
  type MeWeek,
  type MeZone,
} from "./me-shape";
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
  /** 顔の 1 文字（口の avatar.initial）。無ければ呼ばれ方の 1 文字目 */
  initial?: string;
  /** 顔の写真の url（face が photo のとき img で出す） */
  photoUrl?: string;
}

/** 本番の操作（K-839）。どれも任意で、渡さなければモックの見た目と動きのまま */
export interface ProfileActions {
  /** 名前の欄を離れた・Enter（打った字のまま渡す） */
  onName?: (text: string) => void;
  onNick?: (text: string) => void;
  onTheme?: (t: MeTheme) => void;
  onWeek?: (n: MeWeek) => void;
  onZone?: (z: MeZone) => void;
  onFile?: (file: File) => void;
  onResetFace?: () => void;
  onEmail?: () => void;
  /** 確かめ待ちの［送り直す］（K-840） */
  onResend?: () => void;
  /** ［送り直す］の結果の字（メールの行に出す・K-840） */
  resendNotice?: ReactNode;
  onLeave?: (id: string) => void;
  /** 自分のカードの上の赤い箱 */
  notice?: ReactNode;
  /** 見え方のカードの上の赤い箱 */
  viewNotice?: ReactNode;
  /** 顔の下の赤い箱 */
  faceNotice?: ReactNode;
  /** 口が欄ごとに返した理由（422） */
  nameError?: string;
  nickError?: string;
  /** 保存した時刻（HH:mm） */
  savedAt?: string;
  /** 押せない形にするボタン（小窓の登録が無い間） */
  inertButtons?: readonly ("email" | "leave" | "cancelEmail")[];
  workspaces?: readonly WsRow[];
  theme?: MeTheme;
  week?: MeWeek;
  zone?: MeZone;
}

const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;

const NAME_ERROR: Record<string, string> = {
  empty: NAME_EMPTY,
  long: NAME_LONG,
  failed: "保存できませんでした。もう一度、入れ直してください",
};

function Face({ p, a }: { p: ProfileState; a: ProfileActions }) {
  const first = p.initial ?? p.nick.slice(0, 1);
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="k-f10a-face">
      {p.face === "photo" && p.photoUrl ? (
        // 口が期限つきで作る url をそのまま出す（next/image の置き場の設定に載らない）
        <img className="k-f10a-photo" src={p.photoUrl} alt="顔の写真" />
      ) : p.face === "photo" ? (
        <span className="k-f10a-photo" aria-label="選んだ写真（見本）">
          写
        </span>
      ) : (
        <span className="k-f10a-avatar" aria-hidden="true">
          {first}
        </span>
      )}
      <div className="k-f10a-choices">
        <Button variant="outlined" size="sm" onClick={a.onFile ? () => file.current?.click() : undefined}>
          写真を選ぶ
        </Button>
        <Button variant="ghost" size="sm" disabled={p.face !== "photo"} onClick={a.onResetFace}>
          文字に戻す
        </Button>
        {a.onFile ? (
          <input
            ref={file}
            type="file"
            hidden
            accept={PHOTO_ACCEPT}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) a.onFile?.(f);
            }}
          />
        ) : null}
      </div>
      <p className="k-f10a-note">写真がなければ、呼ばれ方の 1 文字目を出す</p>
      {p.faceError ? <Callout tone="danger">{PHOTO_TOO_BIG}</Callout> : null}
      {a.faceNotice ? <Callout tone="danger">{a.faceNotice}</Callout> : null}
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
/** 欄を離れたとき・Enter で渡す（Enter は欄に残ったまま） */
const commitOn = (fn: ((text: string) => void) | undefined) =>
  fn
    ? {
        onBlur: (e: { currentTarget: HTMLInputElement }) => fn(e.currentTarget.value),
        onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) fn(e.currentTarget.value);
        },
      }
    : {};

/** 打った字（親が値を差し替えたら合わせる） */
function useTyped(value: string): [string, (v: string) => void] {
  const [typed, setTyped] = useState(value);
  useEffect(() => setTyped(value), [value]);
  return [typed, setTyped];
}

function SelfCard({ p, a }: { p: ProfileState; a: ProfileActions }) {
  const [typed, setTyped] = useTyped(p.name);
  const [nick, setNick] = useTyped(p.nick);
  const count = Array.from(typed).length;
  const live = p.live || Boolean(a.onName);
  const err = live
    ? (nameProblem(typed) ?? a.nameError)
    : p.nameStatus && p.nameStatus !== "saved"
      ? NAME_ERROR[p.nameStatus]
      : undefined;
  const saved = p.nameStatus === "saved" ? "11:20" : !err ? a.savedAt : undefined;
  const nickErr = a.onNick ? (nickProblem(nick) ?? a.nickError) : undefined;
  const emailInert = a.inertButtons?.includes("email") ? { ...inert, disabled: true } : {};
  const cancelInert = a.inertButtons?.includes("cancelEmail") ? { ...inert, disabled: true } : {};
  const mailDetail = p.emailPending
    ? `確かめのメールを ${p.emailPending} に送りました。リンクを押すと変わります。それまでは ${p.email} で入れます`
    : "ログインと知らせに使う。変えると新しいアドレスに確かめのメールが届く";
  return (
    <SettingCard title="自分" aside="変えたらすぐ保存される（保存のボタンはない）" labelledBy="pf-self">
      <li className="k-f10a-fieldrow">
        <b>顔</b>
        <span className="k-f10a-note">ワークスペースのみんなと、自分の分身の部屋に出る</span>
        <Face p={p} a={a} />
      </li>
      {a.notice ? (
        <li className="k-f10a-fieldrow">
          <Callout tone="danger">{a.notice}</Callout>
        </li>
      ) : p.live ? (
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
          {...commitOn(a.onName)}
        />
        <div className="k-f10a-meta">
          {saved ? <span className="k-f10a-ok">✓ 保存しました ・ {saved}</span> : null}
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
          {...(a.onNick
            ? { value: nick, onChange: (e: { target: HTMLInputElement }) => setNick(e.target.value) }
            : { defaultValue: p.nick })}
          error={nickErr}
          {...commitOn(a.onNick)}
        />
      </li>
      <SettingRow
        name="メール"
        detail={
          a.resendNotice ? (
            <>
              {mailDetail}
              <br />
              {a.resendNotice}
            </>
          ) : (
            mailDetail
          )
        }
        pill={p.emailPending ? <Pill tone="warning">確かめ待ち</Pill> : <Pill>{p.email}</Pill>}
        actions={
          p.emailPending ? (
            <>
              <RowButton onClick={a.onResend}>送り直す</RowButton>
              <RowButton {...cancelInert}>やめる</RowButton>
            </>
          ) : (
            <RowButton {...emailInert} onClick={a.onEmail}>
              変える
            </RowButton>
          )
        }
      />
    </SettingCard>
  );
}

const THEME_CHOICES: readonly { value: MeTheme; label: string }[] = [
  { value: "light", label: "明るい" },
  { value: "dark", label: "暗い" },
  { value: "system", label: "PC に合わせる" },
];
const WEEK_CHOICES: readonly { value: MeWeek; label: string }[] = [
  { value: 0, label: "日曜" },
  { value: 1, label: "月曜" },
];

/** 選ぶ欄：値を渡されたら値のとおり（本番）、無ければ最初を選んだ形（モック） */
const checkedOf = <T,>(now: T | undefined, v: T, i: number) =>
  now === undefined ? { defaultChecked: i === 0 } : { checked: now === v };

function ViewCard({ a }: { a: ProfileActions }) {
  return (
    <SettingCard title="見え方" labelledBy="pf-view">
      {a.viewNotice ? (
        <li className="k-f10a-fieldrow">
          <Callout tone="danger">{a.viewNotice}</Callout>
        </li>
      ) : null}
      <SettingRow
        name="言語"
        detail="いまは日本語だけ。ほかの言語はあとで足せる作りにしてある"
        pill={<Pill>日本語</Pill>}
      />
      <li className="k-f10a-fieldrow">
        <b>見た目</b>
        <fieldset className="k-f10a-choices">
          <legend className="sr-only">見た目</legend>
          {THEME_CHOICES.map((t, i) => (
            <label key={t.value}>
              <input
                type="radio"
                name="pf-theme"
                value={t.value}
                {...checkedOf(a.theme, t.value, i)}
                onChange={() => a.onTheme?.(t.value)}
              />{" "}
              {t.label}
            </label>
          ))}
        </fieldset>
      </li>
      <li className="k-f10a-fieldrow">
        <b>週のはじめ</b>
        <span className="k-f10a-note">カレンダーとガント</span>
        <fieldset className="k-f10a-choices">
          <legend className="sr-only">週のはじめ</legend>
          {WEEK_CHOICES.map((t, i) => (
            <label key={t.value}>
              <input
                type="radio"
                name="pf-week"
                value={t.value}
                {...checkedOf(a.week, t.value, i)}
                onChange={() => a.onWeek?.(t.value)}
              />{" "}
              {t.label}
            </label>
          ))}
        </fieldset>
      </li>
      <li className="k-f10a-fieldrow">
        <Select
          label="時間帯"
          name="tz"
          {...(a.zone !== undefined ? { value: a.zone } : { defaultValue: "Asia/Tokyo" })}
          onValueChange={(v) => {
            if (v === "Asia/Tokyo" || v === "UTC") a.onZone?.(v);
          }}
          options={[
            { value: "Asia/Tokyo", label: "東京（UTC+9）" },
            { value: "UTC", label: "世界標準（UTC）" },
          ]}
        />
      </li>
    </SettingCard>
  );
}

export interface WsRow {
  /** ワークスペースの id（抜けるで渡す・本番だけ） */
  id?: string;
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

function WorkspacesCard({ a }: { a: ProfileActions }) {
  const rows = a.workspaces ?? WORKSPACES;
  const leaveInert = a.inertButtons?.includes("leave") ?? false;
  return (
    <SettingCard title="入っているワークスペース" labelledBy="pf-ws">
      {rows.map((w) => (
        <SettingRow
          key={w.id ?? w.name}
          icon={<span className="k-f10a-mark">{w.mark}</span>}
          name={w.name}
          detail={w.group ? `${w.role} ・ ${w.group}` : w.role}
          actions={
            w.canLeave && !leaveInert ? (
              <RowButton onClick={() => a.onLeave?.(w.id ?? w.name)}>抜ける</RowButton>
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
export function ProfileBody({ p, ...a }: { p: ProfileState } & ProfileActions) {
  return (
    <section className="k-page k-me-page" aria-labelledby="profile-title">
      <header className="k-page-head">
        <h1 id="profile-title">プロフィール</h1>
        <p className="k-desc">アカウント全体に効く</p>
      </header>
      <SelfCard p={p} a={a} />
      {p.showPreview ? <Preview p={p} /> : null}
      <ViewCard a={a} />
      <WorkspacesCard a={a} />
    </section>
  );
}
