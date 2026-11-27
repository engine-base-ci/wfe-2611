"use client";
// 自分の設定 › ログインと安全（キャンバス MeLogin）。入り方・2 段階認証・パスキーの区画は段 2 の F1 の SecurityBody と同じ見た目（同じ部品）。
//   この束で新しく押せる形にするのは「入っている端末」と「最近の安全の記録」の 2 区画だけ（F1 の物は書き換えない）
//   DevicesCard・EventsCard は本番（K-842 の sessions-area.tsx）も使う：任意の props で答えの値を渡す。渡さない呼び方（モック）は下の見本の値
import { Laptop, Monitor, Smartphone } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Pill, RowButton, SecuritySummary, SettingCard, SettingNote, SettingRow } from "@/components/k/setting-parts";
import { RevokeConfirm } from "./dialogs";
import "./account.css";

export interface Device {
  id: string;
  name: string;
  where: string;
  last: string;
  here?: boolean;
  doubt?: boolean;
  /** 絵（無ければ見本の決め方：iphone は電話・この端末は PC・ほかは画面） */
  icon?: "laptop" | "phone" | "monitor";
}
const DEVICES: readonly Device[] = [
  { id: "mac", name: "MacBook Pro ・ Chrome", where: "東京", last: "いま", here: true },
  { id: "iphone", name: "iPhone ・ Kaname アプリ", where: "東京", last: "2 時間前" },
  { id: "win", name: "Windows ・ Edge", where: "大阪", last: "10/30", doubt: true },
];
const EVENTS: readonly [string, string][] = [
  ["今日 09:30", "MacBook Pro でパスキーで入った"],
  ["11/02 10:51", "まとめて承認の前に本人確認を取り直した"],
  ["10/30 18:02", "新しい端末（Windows ・ 大阪）で入った → メールで知らせた"],
  ["10/28 14:00", "ログイン情報 GMAIL_WORK を上書きした"],
];

function DeviceIcon({ d }: { d: Device }) {
  const icon = d.icon ?? (d.id === "iphone" ? "phone" : d.here ? "laptop" : "monitor");
  if (icon === "phone") return <Smartphone size={16} />;
  return icon === "laptop" ? <Laptop size={16} /> : <Monitor size={16} />;
}

export interface DevicesCardProps {
  /** 端末の行（無ければ見本の値） */
  devices?: readonly Device[];
  /** 「この端末以外をすべて切る」を押せない形にする（ほかの端末が無い） */
  allDisabled?: boolean;
  /** 行の代わりに出す物（読めなかったときの形など） */
  notice?: ReactNode;
  /** 押すと確かめの小窓（端末の id・all はこの端末以外をすべて） */
  onRevoke?: (id: string | "all") => void;
}

/** 入っている端末の区画 */
export function DevicesCard({ devices = DEVICES, allDisabled = false, notice, onRevoke }: DevicesCardProps) {
  return (
    <SettingCard
      title="入っている端末"
      labelledBy="lg-sessions"
      aside={
        <RowButton
          aria-disabled={allDisabled || undefined}
          title={allDisabled ? "ほかの端末はありません" : undefined}
          onClick={allDisabled ? undefined : () => onRevoke?.("all")}
        >
          この端末以外をすべて切る
        </RowButton>
      }
    >
      {notice ? <li>{notice}</li> : null}
      {(notice ? [] : devices).map((d) => (
        <SettingRow
          key={d.id}
          icon={<DeviceIcon d={d} />}
          name={d.name}
          detail={`${d.where} ・ ${d.last}${d.doubt ? " ・ 覚えがなければ切る" : ""}`}
          pill={
            d.here ? <Pill tone="success">この端末</Pill> : d.doubt ? <Pill tone="warning">見覚えは？</Pill> : undefined
          }
          actions={d.here ? undefined : <RowButton onClick={() => onRevoke?.(d.id)}>切る</RowButton>}
        />
      ))}
      <SettingNote>
        操作がないと 12 時間で切れ、長くても 7 日で入り直す。場所や端末が急に変わったときも入り直す
      </SettingNote>
    </SettingCard>
  );
}

export interface EventsCardProps {
  /** 記録の行（[時刻, 字]・無ければ見本の値） */
  events?: readonly [string, string][];
  /** 記録が 0 件のときの字 */
  empty?: string;
}

/** 最近の安全の記録の区画（記録の画面へのリンクは置かない・D-154.2） */
export function EventsCard({ events = EVENTS, empty }: EventsCardProps) {
  return (
    <SettingCard title="最近の安全の記録" labelledBy="lg-events">
      {events.length === 0 && empty ? <SettingRow name={empty} /> : null}
      {events.map(([when, what], i) => (
        <SettingRow key={`${i}-${when}`} name={what} detail={when} />
      ))}
    </SettingCard>
  );
}

/** 本文：F1 の SecurityBody と同じ見た目の上 3 区画＋新しく押せる 2 区画 */
export function LoginBody({ onRevoke }: { onRevoke?: (id: string | "all") => void }) {
  return (
    <section className="k-page k-me-page" aria-labelledby="security-title">
      <header className="k-page-head">
        <h1 id="security-title">ログインと安全</h1>
        <p className="k-desc">大事な変更の前には、本人確認を取り直す</p>
      </header>
      <SecuritySummary
        tone="ok"
        title="安全な状態です"
        detail="パスキーで入っている ・ 知らない端末なし ・ 最後の確かめ 11/02"
      />
      <SettingCard title="入り方" labelledBy="lg-ways">
        <SettingRow
          name="パスキー"
          detail="指や顔で入る。フィッシングに強い（おすすめ）"
          pill={<Pill tone="success">2 つ</Pill>}
          actions={<RowButton>足す</RowButton>}
        />
        <SettingRow
          name="パスワード"
          detail="使うなら 12 文字以上。パスキーを持たずパスワードだけで入る人は、2 段階認証が必ず要る"
          pill={<Pill>使っていない</Pill>}
          actions={<RowButton>決める</RowButton>}
        />
      </SettingCard>
      <SettingCard
        title="2 段階認証"
        labelledBy="lg-2fa"
        aside="いまはパスキーで入っているので、付けなくても 2 段階になっている"
      >
        <SettingRow
          name="認証アプリ"
          detail="入るときに、パスキーやパスワードに加えて、スマホの認証アプリの 6 けたも打つ。付けるかどうかは自由（パスワードだけで入る人は必須）"
          pill={<Pill>付けていない</Pill>}
          actions={<RowButton variant="primary">付ける</RowButton>}
        />
      </SettingCard>
      <SettingCard title="パスキー" labelledBy="lg-passkeys">
        <SettingRow
          icon={<Laptop size={16} />}
          name="MacBook Pro（Touch ID）"
          detail="9/12 に作った ・ 最後に使った 今日 09:30"
          actions={<RowButton>取り消す</RowButton>}
        />
        <SettingRow
          icon={<Smartphone size={16} />}
          name="iPhone（Face ID）"
          detail="9/12 に作った ・ 最後に使った 11/01"
          actions={<RowButton>取り消す</RowButton>}
        />
      </SettingCard>
      <DevicesCard onRevoke={onRevoke} />
      <EventsCard />
    </section>
  );
}

/** 端末を切る確かめ：開くのは最初の 1 台。閉じたあと本文の「切る」「この端末以外をすべて切る」を押すと、もう一方も開く */
export function LoginWithRevoke({ start }: { start: string | "all" }) {
  const [target, setTarget] = useState<string | "all" | null>(start);
  return (
    <>
      <LoginBody onRevoke={setTarget} />
      <RevokeConfirm all={target === "all"} open={target !== null} onOpenChange={(o) => !o && setTarget(null)} />
    </>
  );
}
