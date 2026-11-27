"use client";
// ワークスペースの管理 › 設定（キャンバス WsSettings）。名前はその場で直してすぐ保存（保存のボタンは無い・自分の設定のプロフィールと同じ形）。
//   プランと支払いは段 13 の口につなぐ差し込み口 planRow を持ち、無いときは押せない形の 1 行（D-154.22・D-145.9）。取引先の区画は作らない。値を受け取って描くだけ（口は呼ばない）。
//   キャンバスに無い状態の字（名前の誤り・ロゴの誤り・消す手続き中）は仮
import { useState, type ReactNode } from "react";
import { Band, BandLine, Button, Callout, Menu, MenuItem, MenuPopup, MenuTrigger, TextField } from "@/components/k";
import { Pill, RowButton, SettingCard, SettingNote, SettingRow } from "@/components/k/setting-parts";
import "./ws.css";

const inert = { "aria-disabled": true, tabIndex: -1, title: "まだ使えません" } as const;
const NAME_MAX = 100;

export interface SettingsState {
  name: string;
  /** 名前の欄：保存した（時刻つき）・保存できなかった */
  nameStatus?: "saved" | "failed";
  /** 打つたびに名前の誤り（空・長すぎる）を出す */
  live?: boolean;
  /** ロゴ：文字（既定）・選んだ画像 */
  logo?: "text" | "image";
  /** 選び直した画像が大きすぎた */
  logoError?: boolean;
  /** 開いておく「誰ができるか」の ▾（行の番号 0〜2） */
  permOpen?: number;
  /** 消す手続き中（あと N 日） */
  deletingDaysLeft?: number;
}

const WHO: readonly { name: string; detail: string; value: string; options: readonly string[] }[] = [
  {
    name: "プランと支払い",
    detail: "プランを変える・請求書を見る",
    value: "管理者",
    options: ["管理者", "管理者とマネージャー"],
  },
  {
    name: "ワークスペースを消す",
    detail: "消す手続きを始める",
    value: "管理者",
    options: ["管理者", "管理者とマネージャー"],
  },
];

function Pick({ value, options, open }: { value: string; options: readonly string[]; open: boolean }) {
  return (
    <Menu defaultOpen={open}>
      <MenuTrigger className="k-f10w-pick" label={`${value}（選び直す）`}>
        {value} ▾
      </MenuTrigger>
      <MenuPopup align="end" className="k-f10w-pick-menu">
        <div className="k-f10w-pick-title">本人確認を取り直して変える</div>
        {options.map((o) => (
          <MenuItem key={o}>
            <span className="k-f10w-check">{o === value ? "✓" : ""}</span>
            {o}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

function NameRow({ s }: { s: SettingsState }) {
  const [typed, setTyped] = useState(s.name);
  const count = Array.from(typed).length;
  const live =
    count === 0
      ? "名前を入れてください"
      : count > NAME_MAX
        ? `名前は ${NAME_MAX} 文字までです。短くしてください`
        : undefined;
  const err = s.live
    ? live
    : s.nameStatus === "failed"
      ? "保存できませんでした。もう一度、入れ直してください"
      : undefined;
  return (
    <li className="k-f10w-fieldrow">
      <TextField
        label="名前"
        name="ws-name"
        description="会社名・チーム名・自分の名前など。変えたらすぐ保存される"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        error={err}
      />
      <div className="k-f10w-meta">
        {s.nameStatus === "saved" ? <span className="k-f10w-ok">✓ 保存しました ・ 11:20</span> : null}
        <span>
          {count} ／ {NAME_MAX}
        </span>
      </div>
    </li>
  );
}

function LogoRow({ s }: { s: SettingsState }) {
  return (
    <>
      <SettingRow
        icon={
          <span className="k-f10w-mark" aria-hidden="true">
            {s.logo === "image" ? "写" : "E"}
          </span>
        }
        name="ロゴ"
        detail={s.logo === "image" ? "選んだ画像に変えました（見本）" : "左上と招待のメールに出る"}
        actions={<RowButton>変える</RowButton>}
      />
      {s.logoError ? (
        <li className="k-f10w-fieldrow">
          <Callout tone="danger">ロゴは 2 MB までです。小さい画像を選んでください</Callout>
        </li>
      ) : null}
    </>
  );
}

/** 設定の本文（ワークスペースの管理の外枠の中） */
export function SettingsPage({ s, planRow }: { s: SettingsState; planRow?: ReactNode }) {
  const deleting = s.deletingDaysLeft !== undefined;
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-labelledby="wset-title">
      <header className="k-page-head">
        <h1 id="wset-title">設定</h1>
        <p className="k-page-sub">変えることがあるものだけ</p>
      </header>
      {deleting ? (
        <Band
          tone="danger"
          title={`このワークスペースは、消す手続き中です（あと ${s.deletingDaysLeft} 日）`}
          sub="いまのうちは取り消せます。そのあと、チケット・記録・分身の記憶がすべて消えます"
          acts={<Button variant="outlined">本人確認して取り消す</Button>}
        >
          <BandLine>手続きを始めた人：高本 聖斗 ・ 11/09 10:12</BandLine>
        </Band>
      ) : null}
      <SettingCard title="このワークスペース" labelledBy="ws-card">
        <NameRow s={s} />
        <LogoRow s={s} />
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
        {WHO.map((w, i) => (
          <SettingRow
            key={w.name}
            name={w.name}
            detail={w.detail}
            actions={<Pick value={w.value} options={w.options} open={s.permOpen === i} />}
          />
        ))}
        <SettingNote>
          ログインはパスキーを勧めます。2
          段階認証はそれぞれが自分の設定で付けられ、パスキーを持たずパスワードだけで入る人は必須です。操作がないと 12
          時間で切れます。PC が閉じている間に承認した仕事は、承認から 24
          時間を過ぎると実行の前にもう一度聞きます（どちらも決まっていて、変えられません）
        </SettingNote>
      </SettingCard>
      <SettingCard title="ワークスペースを消す" labelledBy="ws-del">
        <SettingRow
          name="ワークスペースを消す"
          detail="チケット・記録・分身の記憶をすべて消す。消すと戻せません"
          actions={
            deleting ? (
              <Pill tone="warning">手続き中</Pill>
            ) : (
              <Button variant="outlined" size="sm" className="k-f10w-danger">
                消す手続き
              </Button>
            )
          }
        />
      </SettingCard>
    </section>
  );
}
