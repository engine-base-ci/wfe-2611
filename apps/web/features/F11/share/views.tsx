"use client";
// ゲストに見せる（2026-11-23 代表の決め answer=6ba09f587792）：チケットは普通のチケット。新しいのは「見せる相手を選ぶ」だけ。
//   小窓（見せる相手を選ぶ）・右のパネルの区画（見せている相手）・やり取り（チャット）の頭の印・見せるのをやめる確かめ。
//   値を受け取って描くだけ（口は呼ばない）。キャンバスに絵が無いので、画面に出る字は仮
import { Badge, Button, Callout, Confirm, Dialog } from "@/components/k";
import { Avatar } from "@/features/F11/clients/parts";
import "@/features/F11/clients/clients.css";
import "../choice.css";
import "./share.css";

const noop = () => undefined;

/** ゲストのグループ 1 つ（見せる相手はグループ単位・1 人ずつは選ばない）。summary は口が組む人の要約（K-881） */
export interface ShareGroup {
  id: string;
  name: string;
  summary: string;
}
/** 下絵の見本の値（モックが props を渡さないときだけ使う・本番の画面は口の答えを渡す） */
const SAMPLE_GROUPS: readonly ShareGroup[] = [
  { id: "seiko", name: "セイコー株式会社（ゲスト）", summary: "山田 花子 様・鈴木 健太 様 ほか（3 人・招待中 1）" },
  { id: "kyogi", name: "京蟻システム株式会社（ゲスト）", summary: "大橋 誠 様（1 人）" },
  { id: "minato", name: "合同会社ミナト（ゲスト）", summary: "小林 様（1 人）" },
];
const SEIKO = "セイコー株式会社（ゲスト）";
const TARGET = "EG-128 セイコー様へ 11月分の請求書を送る";

/** ゲストに見える物と見えない物（小窓と右のパネルで同じ字を使う） */
export function VisibleNotes() {
  return (
    <>
      <h3 className="k-f11v-vis-head">ゲストに見えるもの</h3>
      <ul className="k-f11v-notes">
        <li>題・本文・詳細・チャット</li>
        <li>段の札（作っている・確認中・完了）</li>
      </ul>
      <p className="k-f11v-vis-never">
        <Badge tone="danger">見せない</Badge>
        <span className="k-f11c-sub-text">担当・期限などの社内の欄・確認項目・決定ログ・分身の記録</span>
      </p>
    </>
  );
}

export type SharePhase = "input" | "saving" | "failed" | "none";

export interface ShareDialogProps {
  phase?: SharePhase;
  /** 候補の全部（見せている物とまだ見せていない物） */
  groups?: readonly ShareGroup[];
  /** 印の付いている id */
  picked?: readonly string[];
  /** 頭の下の対象の行（番号と題） */
  target?: string;
  /** 失敗の知らせ（題と続き）。phase が failed のときに出す */
  error?: { title: string; body?: string };
  /** 選びが変わったか（変わるまで「決める」は押せない） */
  changed?: boolean;
  onToggle?: (id: string, on: boolean) => void;
  onDecide?: () => void;
  onCancel?: () => void;
}

/** 見せる相手を選ぶ小窓：ゲストのグループを複数選べる */
export function ShareDialog({
  phase = "input",
  groups = SAMPLE_GROUPS,
  picked = ["seiko"],
  target = TARGET,
  error = {
    title: "見せる相手を決められませんでした",
    body: "もう一度押してください。選んだ相手は、この小窓に残っています。",
  },
  changed = true,
  onToggle = noop,
  onDecide = noop,
  onCancel = noop,
}: ShareDialogProps) {
  const none = phase === "none";
  const saving = phase === "saving";
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !saving) onCancel();
      }}
      title="ゲストに見せる"
      target={target}
      actions={
        <>
          <Button variant="outlined" disabled={saving} onClick={onCancel}>
            やめる
          </Button>
          <Button
            loading={saving}
            disabled={none || !changed}
            onClick={() => {
              if (!saving && !none && changed) onDecide();
            }}
          >
            決める
          </Button>
        </>
      }
    >
      {phase === "failed" ? (
        <Callout tone="danger" title={error.title}>
          {error.body ?? ""}
        </Callout>
      ) : null}
      {none ? (
        <Callout tone="warn" title="ゲストのグループがまだありません">
          メンバーの画面の「ゲスト」のタブで、ゲストのグループを作ってから、もう一度開いてください。
        </Callout>
      ) : (
        <>
          <p className="k-f11c-sub-text">
            見せる相手のゲストのグループを選ぶ（複数選べる）。選んだグループのゲスト全員に見える
          </p>
          <ul className="k-f11v-vis" aria-label="見せる相手">
            {groups.map((g) => (
              <li key={g.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={picked.includes(g.id)}
                    disabled={saving}
                    onChange={(e) => onToggle(g.id, e.currentTarget.checked)}
                  />
                  <span>
                    {g.name}
                    <span className="k-f11c-sub-text">{g.summary}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <VisibleNotes />
        </>
      )}
    </Dialog>
  );
}

/** 右のパネルの区画。見せていなければ「社内だけ」、見せていれば相手の名前 */
export function SharePanel({
  shown = [],
  canChange = true,
  onShare = noop,
  onUnshare = noop,
}: {
  shown?: readonly string[];
  canChange?: boolean;
  /** 「ゲストに見せる」「相手を選ぶ」（小窓を開く） */
  onShare?: () => void;
  /** 「見せるのをやめる」（確かめを開く） */
  onUnshare?: () => void;
}) {
  const act = (f: () => void) => () => {
    if (canChange) f();
  };
  const lock = canChange
    ? {}
    : { "aria-disabled": "true" as const, tabIndex: -1, title: "見せる相手を変えられるのは、書ける人だけです" };
  return (
    <section aria-label="ゲストに見せる" className="k-detail-panel-sec">
      <h2>ゲストに見せる</h2>
      {shown.length === 0 ? (
        <>
          <p className="k-f11v-shown">
            <Badge>社内だけ</Badge>
            <span className="k-f11c-sub-text">ゲストには見えません</span>
          </p>
          <div className="k-f11v-shown-acts">
            <Button size="sm" variant="outlined" {...lock} onClick={act(onShare)}>
              ゲストに見せる
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="k-f11c-sub-text">見せている相手</p>
          <ul className="k-f11v-vis" aria-label="見せている相手">
            {shown.map((n) => (
              <li key={n}>
                <Badge tone="progress">{n}</Badge>
              </li>
            ))}
          </ul>
          <div className="k-f11v-shown-acts">
            <Button size="sm" variant="outlined" {...lock} onClick={act(onShare)}>
              相手を選ぶ
            </Button>
            <Button size="sm" variant="ghost" {...lock} onClick={act(onUnshare)}>
              見せるのをやめる
            </Button>
          </div>
          <VisibleNotes />
        </>
      )}
      {!canChange ? (
        <p className="k-f11c-sub-text k-f11v-lock-note">見せる相手を変えられるのは、書ける人だけです。</p>
      ) : null}
    </section>
  );
}

type Msg = { initial: string; name: string; when: string; text: string; tone?: "indigo" | "teal" | "amber" | "plum" };
const THREAD: Msg[] = [
  {
    initial: "高",
    name: "高本 聖斗",
    when: "10/30 17:50",
    text: "請求書を作ります。宛名は経理部の山田様でよいか、先方に聞きます。",
    tone: "indigo",
  },
  { initial: "山", name: "山田 花子 様", when: "10/31 09:12", text: "はい、山田宛でお願いします。", tone: "plum" },
];
const FROM_REQUEST: Msg[] = [
  {
    initial: "鈴",
    name: "鈴木 健太 様",
    when: "10/29 10:20",
    text: "11 月分の請求書もいただけますか。宛先は経理部でお願いします。",
    tone: "plum",
  },
  {
    initial: "高",
    name: "高本 聖斗",
    when: "10/29 10:42",
    text: "承知しました。11/01 までにお送りします。宛先は山田様でよろしいですか？",
    tone: "indigo",
  },
  { initial: "鈴", name: "鈴木 健太 様", when: "10/29 11:05", text: "はい、山田宛でお願いします。", tone: "plum" },
];

function Line({ m }: { m: Msg }) {
  return (
    <li className="k-f11v-chat-msg">
      <Avatar initial={m.initial} tone={m.tone ?? "indigo"} />
      <div>
        <span className="k-f11v-chat-name">
          {m.name} ・ {m.when}
        </span>
        <p>{m.text}</p>
      </div>
    </li>
  );
}

/** やり取り（チャット）。見せているチケットは、頭に「ゲストに見えるやり取り」の印が付く。
 *  依頼から作ったチケットは、チャットの頭に依頼のやり取りが残る（違いはそれだけ） */
export function ChatPanel({ shared = false, fromRequest = false }: { shared?: boolean; fromRequest?: boolean }) {
  return (
    <section aria-label="やり取り" className="k-detail-panel-sec">
      <h2>やり取り</h2>
      <ul className="k-f11v-chat">
        {shared ? (
          <li className="k-f11v-chat-mark">
            <Badge tone="progress">ゲストに見えるやり取り</Badge>
            <span className="k-f11c-sub-text">{SEIKO}</span>
          </li>
        ) : null}
        {fromRequest ? (
          <>
            <li className="k-f11v-chat-mark">
              <Badge tone="ai">依頼のやり取り</Badge>
              <span className="k-f11c-sub-text">鈴木 健太 様が出した依頼から</span>
            </li>
            {FROM_REQUEST.map((m) => (
              <Line key={m.when} m={m} />
            ))}
            <li className="k-f11v-chat-mark k-f11v-chat-line">ここからチケットのやり取り</li>
          </>
        ) : null}
        {THREAD.map((m) => (
          <Line key={m.when} m={m} />
        ))}
      </ul>
    </section>
  );
}

/** 見せるのをやめる確かめ（今見せている全部を外す。1 つなら題にその名前、複数なら数） */
export function UnshareConfirm({
  names = [SEIKO],
  busy = false,
  error,
  onConfirm = noop,
  onCancel = noop,
}: {
  names?: readonly string[];
  busy?: boolean;
  /** 外せなかったときの知らせ */
  error?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const title =
    names.length === 1
      ? `${names[0]}に見せるのをやめますか`
      : `${names.length} つのゲストのグループに見せるのをやめますか`;
  return (
    <Confirm
      open
      busy={busy}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      onConfirm={onConfirm}
      title={title}
      caution={["ゲストの画面から、このチケットは消えます。"]}
      description="チケットは残ります。もう一度見せるときは「ゲストに見せる」から選びます。"
      confirmLabel="見せるのをやめる"
    >
      {error ? <Callout tone="danger">{error}</Callout> : null}
    </Confirm>
  );
}
