"use client";
// PC と使った量の本文のカード（K-230・キャンバス MePC・MePCInstalled）。
//   つないでいる PC：白いカードの行（PC の絵・名前・札・11px の補足・「…」）。切れている行は直し方の箱と「Bridge を起こす」。
//   この PC の Bridge：この PC で Bridge が動いているときのカード。使った量：箱は出し、本当の値が無いので数は出さない（D-145.9）。
//   値の無い物（どの PC をいつも使うか・PC の操作のメニュー）はキャンバスどおり出し、グレーで押せない形にする（D-145.9）
import type { ReactNode } from "react";
import { Button } from "@/components/k";
import { errorText } from "@/components/k/error-of";
import type { Device } from "./devices";

const JST: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit" };

/** 日本時間の MM/DD（time＝true なら MM/DD HH:MM）。読めない日時は null（嘘の日時を出さない） */
export function jstStamp(iso: string | null | undefined, time = false): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("ja-JP", {
    ...JST,
    ...(time ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  }).formatToParts(d);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return time ? `${v("month")}/${v("day")} ${v("hour")}:${v("minute")}` : `${v("month")}/${v("day")}`;
}

/** 一覧の口は、つないだ日（connected_at）も返す（契約 BridgeDevice）。devices.ts の型に無いので、ここで足して読む */
type Dev = Device & { connected_at?: string | null };

const nameOf = (d: Dev) => d.device_label ?? "この PC";

function PcIcon() {
  return (
    <span className="k-pc-icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    </span>
  );
}

/** 「…」（PC の操作のメニュー）。メニューはまだ前の設定の画面にあるので、押せない形で出す */
function More({ name }: { name: string }) {
  return (
    <button type="button" className="k-pc-more" aria-disabled="true" tabIndex={-1} aria-label={`…（${name} の操作）`}>
      …
    </button>
  );
}

function Row({ d, first, onWake }: { d: Dev; first: boolean; onWake: () => void }) {
  const name = nameOf(d);
  const pill =
    d.state === "live" ? (
      <span className="k-pc-pill" data-tone="success">
        つながっている
      </span>
    ) : d.state === "asleep" ? (
      <span className="k-pc-pill" data-tone="warning">
        切れている
      </span>
    ) : (
      <span className="k-pc-pill" data-tone="neutral">
        返事を待っています
      </span>
    );
  const head = (
    <span className="k-pc-name">
      <span className="k-pc-label">{name}</span> {pill}
      {first ? (
        <>
          {" "}
          <span className="k-pc-pill k-pc-pill-off" data-tone="neutral" aria-disabled="true">
            いつも使う
          </span>
        </>
      ) : null}
    </span>
  );
  const joined = jstStamp(d.connected_at);
  const app = d.version ? `Kaname の常駐アプリ v${d.version}` : null;
  let main: ReactNode;
  if (d.state === "asleep") {
    const seen = jstStamp(d.last_seen_at, true);
    main = (
      <section className="k-pc-main" aria-label="切れています">
        {head}
        <span className="k-pc-detail">{seen ? `最後に見えた ${seen}` : "最後に見えた時刻はまだありません"}</span>
        <span className="k-pc-fix">
          <b>直し方</b>
          <br />
          1. PC を起こして、Kaname の常駐アプリが開いているか見る
          <br />
          2. 「スリープしない」にしておくと、承認したあとすぐ実行される
          <br />
          <span className="k-pc-fix-note">
            いつも使う PC が閉じているときは、承認したものは「実行待ち」になり、開いたら動く
          </span>
          <span className="k-pc-fix-msg">{errorText("E-CONN-001").entry.message}</span>
          <Button variant="outlined" className="k-pc-btn k-pc-wake" data-act="wake" onClick={onWake}>
            Bridge を起こす
          </Button>
        </span>
      </section>
    );
  } else {
    const detail =
      d.state === "waiting"
        ? `${name} はつながりました。最初の知らせが届くと「つながっています」に変わります`
        : [joined ? `${joined} につないだ` : null, app].filter(Boolean).join(" ・ ");
    main = (
      <span className="k-pc-main">
        {head}
        <span className="k-pc-detail">{detail}</span>
        {d.state === "live" ? (
          <span role="status" className="sr-only">
            つながっています：{name}
            {d.version ? `・Bridge ${d.version}` : ""}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <li className="k-pc-row" data-state={d.state}>
      <PcIcon />
      {main}
      <More name={name} />
    </li>
  );
}

export interface PcListProps {
  devices: Device[];
  /** 「＋ PC をつなぐ」を押した（無ければボタンを出さない：この PC の Bridge のとき・キャンバス MePCInstalled） */
  onAdd?: (() => void) | undefined;
  onWake: () => void;
}
export function PcList({ devices, onAdd, onWake }: PcListProps) {
  return (
    <section className="k-pc-card" aria-labelledby="pc-list-title">
      <div className="k-pc-card-head">
        <h2 id="pc-list-title">つないでいる PC</h2>
        {onAdd ? (
          <Button variant="outlined" className="k-pc-btn" onClick={onAdd}>
            ＋ PC をつなぐ
          </Button>
        ) : null}
      </div>
      {devices.length ? (
        <ul className="k-pc-list">
          {devices.map((d, i) => (
            <Row key={d.id} d={d} first={i === 0} onWake={onWake} />
          ))}
        </ul>
      ) : (
        <p className="k-pc-empty">まだありません</p>
      )}
    </section>
  );
}

export interface ThisPcProps {
  version: string | null;
  busy: boolean;
  otherAccount: boolean;
  onConnect: () => void;
  onSwitch: () => void;
}
export function ThisPcCard({ version, busy, otherAccount, onConnect, onSwitch }: ThisPcProps) {
  return (
    <section className="k-pc-card k-pc-this" aria-labelledby="pc-this-title">
      <h2 id="pc-this-title">この PC の Bridge</h2>
      <p className="k-pc-this-text">
        この PC に Bridge が入っています（{version ? `v${version}` : "版はまだ分かりません"}）。コードを打たずに、ボタン
        1 つでつなげます。
      </p>
      <div className="k-pc-this-acts">
        <Button className="k-pc-btn" loading={busy} onClick={onConnect}>
          この PC の Bridge につなぐ
        </Button>
        {otherAccount ? (
          <Button variant="danger" className="k-pc-btn" data-act="switch-account" onClick={onSwitch}>
            このアカウントに切り替える
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** 使った量（5 時間の枠・今月）と、ワークスペースごとの内訳。返す口がまだ無いので数も帯の長さも出さない */
export function Usage() {
  const meter = (title: string) => (
    <div>
      <h2>{title}</h2>
      <div className="k-pc-usage-desc" />
      <span className="k-pc-bar">
        <span />
      </span>
    </div>
  );
  return (
    <>
      <section className="k-pc-card k-pc-usage" aria-label="使った量">
        {meter("5 時間の枠")}
        {meter("今月")}
      </section>
      <section className="k-pc-card" aria-labelledby="pc-per-ws-title">
        <div className="k-pc-card-head">
          <h2 id="pc-per-ws-title">ワークスペースごとの内訳（今月）</h2>
        </div>
      </section>
      <Limits />
    </>
  );
}

/** 超えそうなとき（キャンバス MePC）。設定を返す口・決める口がまだ無いので、中身は空で押せない形（D-145.9）。
 *  切り替えは「切」の形（今は知らせが出ないのが本当）・選ぶ欄は値の字を出さない */
function Limits() {
  return (
    <section className="k-pc-card" aria-labelledby="pc-limits-title">
      <div className="k-pc-card-head">
        <h2 id="pc-limits-title">超えそうなとき</h2>
      </div>
      <div className="k-pc-set-row">
        <span className="k-pc-set-label">80% を超えたら知らせる</span>
        <button
          type="button"
          role="switch"
          aria-checked="false"
          aria-disabled="true"
          tabIndex={-1}
          aria-label="80% を超えたら知らせる（まだ選べません）"
          className="k-pc-switch"
        >
          <span aria-hidden="true" />
        </button>
      </div>
      <div className="k-pc-set-row">
        <span className="k-pc-set-label">枠を使い切ったら</span>
        <button
          type="button"
          aria-disabled="true"
          tabIndex={-1}
          aria-label="枠を使い切ったら（まだ選べません）"
          className="k-pc-pick"
        >
          <span aria-hidden="true">▾</span>
        </button>
      </div>
    </section>
  );
}
