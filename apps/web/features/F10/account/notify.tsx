"use client";
// 自分の設定 › 知らせ（キャンバス MeNotify）。知らせの受け方はワークスペースごとに決める。値を受け取って描くだけ。
//   メールは受け箱で読んでいないものを 30 分ごとにまとめて送る（キャンバスの文）。デスクトップとスマホへの知らせは後のフェーズ
import {
  Band,
  Button,
  Callout,
  Dialog,
  ErrorState,
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
  PAGE_ERROR,
  Tabs,
} from "@/components/k";
import { RowButton, SettingCard, SettingNote, SettingRow } from "@/components/k/setting-parts";
import "./account.css";

interface Ev {
  name: string;
  detail: string;
  bell: boolean;
  mail: boolean;
  /** 止められない */
  fixed?: boolean;
}
const EVENTS: readonly Ev[] = [
  { name: "承認を待っている", detail: "自分が承認する人のとき", bell: true, mail: true },
  { name: "@ で呼ばれた・やり取りで知らせる人にされた", detail: "", bell: true, mail: true },
  { name: "渡された・配られた", detail: "返事の期限つき", bell: true, mail: true },
  { name: "分身が止まった・落ちて直せない", detail: "PC が切れた・ログイン情報が切れた など", bell: true, mail: true },
  { name: "分身が実行を終えた", detail: "やったことは分身の部屋でも見られる", bell: true, mail: false },
  { name: "自分が担当・承認するチケットが動いた", detail: "状態・期限の変化", bell: true, mail: false },
  { name: "新しい端末で入った", detail: "安全のため止められない", bell: true, mail: true, fixed: true },
];
const WS = ["株式会社ENGINE BASE", "高本 聖斗（個人）", "京蟻システム"];

function EventRows({ saveFailed }: { saveFailed?: boolean | undefined }) {
  return (
    <SettingCard title="出来事" aside="受け箱（ベル）とメール（まとめて）" labelledBy="nt-events">
      {EVENTS.map((e, i) => (
        <SettingRow
          key={e.name}
          name={e.name}
          detail={i === 1 && saveFailed ? "保存できませんでした。もう一度、押してください" : e.detail}
          actions={
            <span className="k-f10a-ev">
              <label>
                <input type="checkbox" defaultChecked={e.bell} disabled={e.fixed} /> ベル
              </label>
              <label>
                <input type="checkbox" defaultChecked={e.mail} disabled={e.fixed} /> メール
              </label>
            </span>
          }
        />
      ))}
      <SettingNote>
        メールは、受け箱で読んでいないものを 30 分ごとにまとめて送る。デスクトップとスマホへの知らせは後のフェーズ
      </SettingNote>
    </SettingCard>
  );
}

const QUIET_ITEMS = ["平日 20:00〜8:00 ・ 土日", "毎日 20:00〜8:00", "土日だけ", "使わない"];

function QuietCard({ menuOpen, stopped }: { menuOpen?: boolean | undefined; stopped?: boolean | undefined }) {
  return (
    <SettingCard title="静かにする時間" labelledBy="nt-quiet">
      <SettingRow
        name="夜と休みの日"
        detail="このあいだはメールを送らない（受け箱にはたまる）"
        actions={
          <Menu defaultOpen={menuOpen ?? false}>
            <MenuTrigger className="k-btn k-f10a-quiet" label="静かにする時間を選ぶ">
              {QUIET_ITEMS[0]} ▾
            </MenuTrigger>
            <MenuPopup align="end">
              {QUIET_ITEMS.map((t) => (
                <MenuItem key={t} className="k-select-item">
                  {t}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
        }
      />
      <li className="k-set-row">
        <span className="k-set-main">
          <span className="k-set-name">いま止める</span>
          {stopped ? (
            <Band
              tone="wait"
              title="いま止めています ・ 今日いっぱい"
              sub="メールは止まっています。受け箱にはたまります"
              acts={
                <Button variant="outlined" size="sm">
                  止めるのをやめる
                </Button>
              }
            />
          ) : null}
        </span>
        <span className="k-f10a-times">
          {["1 時間", "今日いっぱい", "明日の朝まで"].map((t) => (
            <RowButton key={t}>{t}</RowButton>
          ))}
        </span>
      </li>
      <SettingRow
        name="止めていても知らせる"
        detail="急ぎのものだけ"
        actions={
          <span className="k-f10a-ev">
            <label>
              <input type="checkbox" defaultChecked /> 承認を待っている（期限が今日）
            </label>
            <label>
              <input type="checkbox" defaultChecked /> 分身が止まった
            </label>
          </span>
        }
      />
    </SettingCard>
  );
}

export interface NotifyState {
  menuOpen?: boolean;
  stopped?: boolean;
  /** 1 行が保存できなかった */
  saveFailed?: boolean;
}

function Panel({ s }: { s: NotifyState }) {
  return (
    <>
      {s.saveFailed ? (
        <Callout tone="danger">保存できませんでした。通信を確かめて、もう一度押してください</Callout>
      ) : null}
      <EventRows saveFailed={s.saveFailed} />
      <QuietCard menuOpen={s.menuOpen} stopped={s.stopped} />
    </>
  );
}

/** 知らせの本文。ワークスペースごとのタブ。保存できなかったときは、3 つめのタブで「読めない」の形も見られる */
export function NotifyBody({ s }: { s: NotifyState }) {
  const unreadable = s.saveFailed;
  return (
    <section className="k-page k-me-page" aria-labelledby="notify-title">
      <header className="k-page-head">
        <h1 id="notify-title">知らせ</h1>
        <p className="k-desc">ワークスペースごとに決める</p>
        <div className="k-page-acts">
          <Button variant="outlined" size="sm">
            この設定をほかのワークスペースにも写す
          </Button>
        </div>
      </header>
      <Tabs
        label="ワークスペースごとの知らせ"
        items={WS.map((w, i) => ({
          value: String(i),
          label: w,
          panel:
            unreadable && i === 2 ? (
              <ErrorState code={PAGE_ERROR.down} acts={[() => undefined]} />
            ) : (
              <Panel s={i === 0 ? s : {}} />
            ),
        }))}
      />
    </section>
  );
}

/** ほかのワークスペースにも写す小窓（仮） */
export function CopyDialog() {
  return (
    <Dialog
      open
      onOpenChange={() => undefined}
      title="この設定をほかのワークスペースにも写す"
      subtitle="いま開いている「株式会社ENGINE BASE」の知らせの受け方を、選んだ場所に写します"
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>写す</Button>
        </>
      }
    >
      <label className="k-f10a-choices">
        <input type="checkbox" defaultChecked /> 高本 聖斗（個人）
      </label>
      <label className="k-f10a-choices">
        <input type="checkbox" /> 京蟻システム
      </label>
      <p className="k-f10a-note">写すと、向こうの今の受け方は置き換わります。静かにする時間も一緒に写ります</p>
    </Dialog>
  );
}
