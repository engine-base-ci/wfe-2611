"use client";
// ワークスペースの管理 › 設定（キャンバス WsSettings）。名前はその場で直してすぐ保存（保存のボタンは無い・自分の設定のプロフィールと同じ形）。
//   プランと支払いは段 13 の口につなぐ差し込み口 planRow を持ち、無いときは押せない形の 1 行（D-154.22・D-145.9）。取引先の区画は作らない。値を受け取って描くだけ（口は呼ばない）。
//   キャンバスに無い状態の字（名前の誤り・ロゴの誤り・消す手続き中）は仮
//   K-831：口につなぐための任意の props（誰ができるか・名前・ロゴ・決まっている物・消す手続き・読むだけ）を足した。渡さない呼び方（下絵）は前の見た目のまま
//   K-832：消す手続き中の帯を口の値で描く任意の props（あと N 日・始めた人と日時・取り消す・押せない形・処理中・赤い箱）を足した。渡さない呼び方は s.deletingDaysLeft（下絵）のまま
import { useRef, useState, type ReactNode } from "react";
import { Band, BandLine, Button, Callout, Menu, MenuItem, MenuPopup, MenuTrigger, TextField } from "@/components/k";
import { Pill, RowButton, SettingCard, SettingNote, SettingRow } from "@/components/k/setting-parts";
import {
  LOGO_ACCEPT,
  LOGO_TOO_BIG,
  NAME_MAX,
  nameCount,
  nameProblem,
  type PermKey,
  type PermValue,
  type WhoRow,
} from "./settings-shape";
import "./ws.css";

const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;
const locked = { "aria-disabled": true, tabIndex: -1 } as const;
const SAVE_FAILED = "保存できませんでした。もう一度、入れ直してください";

export interface SettingsState {
  name: string;
  /** 名前の欄：保存した（時刻つき）・保存できなかった */
  nameStatus?: "saved" | "failed";
  /** 保存した時刻（HH:mm）。無ければ下絵の時刻 */
  nameSavedAt?: string;
  /** 打つたびに名前の誤り（空・長すぎる）を出す */
  live?: boolean;
  /** ロゴ：文字（既定）・選んだ画像 */
  logo?: "text" | "image";
  /** ロゴが文字のときの頭文字（無ければ下絵の字） */
  initial?: string;
  /** 選び直した画像が大きすぎた */
  logoError?: boolean;
  /** 開いておく「誰ができるか」の ▾（行の番号 0〜2） */
  permOpen?: number;
  /** 消す手続き中（あと N 日） */
  deletingDaysLeft?: number;
}

const OPTIONS: WhoRow["options"] = [
  { value: "admin", label: "管理者" },
  { value: "admin_manager", label: "管理者とマネージャー" },
];
const WHO: readonly WhoRow[] = [
  { key: "billing", name: "プランと支払い", detail: "プランを変える・請求書を見る", value: "admin", options: OPTIONS },
  {
    key: "delete_workspace",
    name: "ワークスペースを消す",
    detail: "消す手続きを始める",
    value: "admin",
    options: OPTIONS,
  },
];
const FIXED_NOTE =
  "ログインはパスキーを勧めます。2 段階認証はそれぞれが自分の設定で付けられ、パスキーを持たずパスワードだけで入る人は必須です。操作がないと 12 時間で切れます。PC が閉じている間に承認した仕事は、承認から 24 時間を過ぎると実行の前にもう一度聞きます（どちらも決まっていて、変えられません）";

const labelOf = (row: WhoRow): string => row.options.find((o) => o.value === row.value)?.label ?? row.value;

function Pick({
  row,
  open,
  disabled,
  onPick,
}: {
  row: WhoRow;
  open: boolean;
  disabled: boolean;
  onPick?: ((key: PermKey, value: PermValue) => void) | undefined;
}) {
  const value = labelOf(row);
  return (
    <Menu defaultOpen={open && !disabled}>
      <MenuTrigger className="k-f10w-pick" label={`${value}（選び直す）`} disabled={disabled}>
        {value} ▾
      </MenuTrigger>
      <MenuPopup align="end" className="k-f10w-pick-menu">
        <div className="k-f10w-pick-title">本人確認を取り直して変える</div>
        {row.options.map((o) => (
          <MenuItem key={o.value} onSelect={onPick ? () => onPick(row.key, o.value) : undefined}>
            <span className="k-f10w-check" aria-hidden="true">
              {o.value === row.value ? "✓" : ""}
            </span>
            {o.label}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

interface NameProps {
  s: SettingsState;
  readOnly: boolean;
  error?: string | undefined;
  onName?: ((text: string) => void) | undefined;
}

function NameRow({ s, readOnly, error, onName }: NameProps) {
  const [typed, setTyped] = useState(s.name);
  const count = nameCount(typed);
  const live = s.live || onName ? nameProblem(typed) : undefined;
  const err = live ?? error ?? (s.nameStatus === "failed" ? SAVE_FAILED : undefined);
  const commit = () => {
    if (!readOnly && onName) onName(typed);
  };
  return (
    <li className="k-f10w-fieldrow">
      <TextField
        label="名前"
        name="ws-name"
        description="会社名・チーム名・自分の名前など。変えたらすぐ保存される"
        value={typed}
        readOnly={readOnly}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          commit();
        }}
        error={err}
      />
      <div className="k-f10w-meta">
        {s.nameStatus === "saved" ? (
          <span className="k-f10w-ok">✓ 保存しました ・ {s.nameSavedAt ?? "11:20"}</span>
        ) : null}
        <span>
          {count} ／ {NAME_MAX}
        </span>
      </div>
    </li>
  );
}

interface LogoProps {
  s: SettingsState;
  readOnly: boolean;
  url?: string | null | undefined;
  notice?: string | undefined;
  onFile?: ((file: File) => void) | undefined;
}

function LogoRow({ s, readOnly, url, notice, onFile }: LogoProps) {
  const input = useRef<HTMLInputElement>(null);
  const image = s.logo === "image" || Boolean(url);
  const error = notice ?? (s.logoError ? LOGO_TOO_BIG : undefined);
  const live = Boolean(onFile) && !readOnly;
  return (
    <>
      <SettingRow
        icon={
          <span className="k-f10w-mark" aria-hidden="true">
            {url ? <img src={url} alt="" /> : image ? "写" : (s.initial ?? "E")}
          </span>
        }
        name="ロゴ"
        detail={image ? "選んだ画像に変えました" : "左上と招待のメールに出る"}
        actions={
          <>
            <RowButton {...(readOnly ? locked : {})} {...(live ? { onClick: () => input.current?.click() } : {})}>
              変える
            </RowButton>
            {live ? (
              <input
                ref={input}
                type="file"
                accept={LOGO_ACCEPT}
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = ""; // 同じファイルを選び直せるように
                  if (file && onFile) onFile(file);
                }}
              />
            ) : null}
          </>
        }
      />
      {error ? (
        <li className="k-f10w-fieldrow">
          <Callout tone="danger">{error}</Callout>
        </li>
      ) : null}
    </>
  );
}

export interface SettingsPageProps {
  s: SettingsState;
  /** 段 13 が差すプランと支払いの行。無ければ押せない形の 1 行 */
  planRow?: ReactNode;
  /** 誰ができるかの行（無ければ下絵の 2 行） */
  who?: readonly WhoRow[];
  /** ▾ で選び直した（今の値でも呼ぶ。送るかは呼ぶ側が決める） */
  onPerm?: (key: PermKey, value: PermValue) => void;
  /** 誰ができるかを送っている間（▾ を押せない形） */
  permBusy?: boolean;
  /** 誰ができるかの区画の上の赤い箱 */
  permNotice?: ReactNode;
  /** 名前の欄を離れた・Enter（打った字のまま渡す） */
  onName?: (text: string) => void;
  /** 名前の欄の下の誤り（口の断り・保存の失敗） */
  nameError?: string;
  /** ロゴの画像の url（あれば画像を出す） */
  logoUrl?: string | null;
  /** ロゴのファイルを選んだ */
  onLogoFile?: (file: File) => void;
  /** ロゴの赤い箱 */
  logoNotice?: string;
  /** 決まっていて変えられない物の字 */
  fixedNote?: string;
  /** 「消す手続き」を押せない形にする */
  deleteDisabled?: boolean;
  /** 押せない形のときの補足（無ければ「まだ使えません」） */
  deleteHint?: string;
  /** 「消す手続き」を押した */
  onDelete?: () => void;
  /** 読むだけ（access.admin が false）：名前は読むだけ・ロゴの「変える」と ▾ は押せない形 */
  readOnly?: boolean;
  /** 消す手続き中（口の値）。あれば s.deletingDaysLeft より先に使う。始めた人か日時が無ければ「手続きを始めた人」の行を出さない */
  deleting?: { daysLeft: number; by: string | null; at: string | null };
  /** 帯の「本人確認して取り消す」を押した */
  onCancelDeletion?: () => void;
  /** 「本人確認して取り消す」を押せない形にする（消すが可でない人） */
  cancelDisabled?: boolean;
  /** 取り消しの答えを待つ間 */
  cancelBusy?: boolean;
  /** 帯の下の赤い箱（取り消しの断り・失敗） */
  cancelNotice?: ReactNode;
}

/** 設定の本文（ワークスペースの管理の外枠の中） */
export function SettingsPage({
  s,
  planRow,
  who = WHO,
  onPerm,
  permBusy = false,
  permNotice,
  onName,
  nameError,
  logoUrl,
  onLogoFile,
  logoNotice,
  fixedNote = FIXED_NOTE,
  deleteDisabled = false,
  deleteHint,
  onDelete,
  readOnly = false,
  deleting: live,
  onCancelDeletion,
  cancelDisabled = false,
  cancelBusy = false,
  cancelNotice,
}: SettingsPageProps) {
  const band =
    live ??
    (s.deletingDaysLeft !== undefined
      ? { daysLeft: s.deletingDaysLeft, by: "高本 聖斗", at: "11/09 10:12" }
      : undefined);
  const deleting = band !== undefined;
  const deleteOff = deleteDisabled ? { ...locked, title: deleteHint ?? inert.title } : {};
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-labelledby="wset-title">
      <header className="k-page-head">
        <h1 id="wset-title">設定</h1>
        <p className="k-page-sub">変えることがあるものだけ</p>
      </header>
      {band ? (
        <Band
          tone="danger"
          title={`このワークスペースは、消す手続き中です（あと ${band.daysLeft} 日）`}
          sub="いまのうちは取り消せます。そのあと、チケット・記録・分身の記憶がすべて消えます"
          acts={
            <Button
              variant="outlined"
              loading={cancelBusy}
              {...(cancelDisabled ? locked : {})}
              {...(!cancelDisabled && onCancelDeletion ? { onClick: onCancelDeletion } : {})}
            >
              本人確認して取り消す
            </Button>
          }
        >
          {band.by && band.at ? <BandLine>{`手続きを始めた人：${band.by} ・ ${band.at}`}</BandLine> : null}
        </Band>
      ) : null}
      {cancelNotice ? <Callout tone="danger">{cancelNotice}</Callout> : null}
      <SettingCard title="このワークスペース" labelledBy="ws-card">
        <NameRow key={s.name} s={s} readOnly={readOnly} error={nameError} onName={onName} />
        <LogoRow s={s} readOnly={readOnly} url={logoUrl} notice={logoNotice} onFile={onLogoFile} />
      </SettingCard>
      <SettingCard title="プランと支払い" labelledBy="ws-plan">
        {planRow ?? (
          <SettingRow
            name="チーム"
            detail="10 人まで ・ いま 5 人 ・ 次の請求 12/01 ¥15,000"
            actions={
              <>
                <RowButton {...inert}>プランを変える</RowButton>
                <RowButton {...inert}>請求書</RowButton>
              </>
            }
            disabled
          />
        )}
      </SettingCard>
      <SettingCard title="誰ができるか" aside="変えられるのは管理者だけ" labelledBy="ws-who">
        {permNotice ? (
          <li className="k-f10w-fieldrow">
            <Callout tone="danger">{permNotice}</Callout>
          </li>
        ) : null}
        {who.map((w, i) => (
          <SettingRow
            key={w.key}
            name={w.name}
            detail={w.detail}
            actions={<Pick row={w} open={s.permOpen === i} disabled={readOnly || permBusy} onPick={onPerm} />}
          />
        ))}
        <SettingNote>{fixedNote}</SettingNote>
      </SettingCard>
      <SettingCard title="ワークスペースを消す" labelledBy="ws-del">
        <SettingRow
          name="ワークスペースを消す"
          detail="チケット・記録・分身の記憶をすべて消す。消すと戻せません"
          actions={
            deleting ? (
              <Pill tone="warning">手続き中</Pill>
            ) : (
              <Button
                variant="outlined"
                size="sm"
                className="k-f10w-danger"
                {...deleteOff}
                {...(!deleteDisabled && onDelete ? { onClick: onDelete } : {})}
              >
                消す手続き
              </Button>
            )
          }
        />
      </SettingCard>
    </section>
  );
}
