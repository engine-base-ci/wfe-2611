"use client";
// 見せてもらったチケットの 1 件（題・本文・詳細・やり取りと段の札）・見られない画面・招待を受けた直後の画面・ログインの有効期限切れ。
//   どれもキャンバスに絵が無いので、画面に出る字は仮
import { useState, type ChangeEvent } from "react";
import { Badge, Button, Empty, ErrorState, PAGE_ERROR, TextArea } from "@/components/k";
import { SAMPLE_GROUP, usePortalCompany } from "./frame";
import { Msg } from "./request";
import "./portal.css";

const noop = () => undefined;

/** 段の札（3 つだけ）：いまの段を目立たせる */
export const STAGES = ["作っている", "確認中", "完了"] as const;
export type WorkStage = (typeof STAGES)[number];
/** 3 つ以外の字（社内の段が紛れ込んだ等）は「作っている」にする */
export const stageOf = (s: string): WorkStage =>
  (STAGES as readonly string[]).includes(s) ? (s as WorkStage) : "作っている";

/** 部品が出すチケットの値（題・段・本文・詳細の 4 つだけ。やり取りは messages） */
export interface WorkTicket {
  title: string;
  stage: string;
  body: string;
  detail: string;
}
/** やり取りの 1 行。from_request は依頼から来た書き込み（頭の連続した行にだけ付く・K-882） */
export interface WorkMessage {
  id: string;
  side: "they" | "we";
  name: string;
  at: string;
  text: string;
  from_request?: boolean;
}

const SAMPLE: Record<"plain" | "request", WorkTicket> = {
  plain: {
    title: "11月分の請求書を送る",
    stage: "確認中",
    body: "セイコー様に 11 月分の保守費を請求し、11/30 までに入金していただく。",
    detail: "請求書は 11 月分の保守費（1,500,000 円）と追加対応 2 回分（60,000 円）。宛名は経理部 山田様。",
  },
  request: {
    title: "12 月分の作業報告書を作って送る",
    stage: "確認中",
    body: "12 月分の作業報告書を作り、セイコー様の経理部 山田様にお送りする。",
    detail: "報告書は 12 月の作業の一覧と時間の合計。12/26 までに PDF でお送りする。",
  },
};
const SAMPLE_REQUEST_MSGS: WorkMessage[] = [
  {
    id: "s-r1",
    side: "they",
    name: "鈴木 健太 様",
    at: "10/29 10:20",
    text: "12 月分の作業報告書もほしいです。",
    from_request: true,
  },
  {
    id: "s-r2",
    side: "we",
    name: "高本さん（ENGINE BASE）",
    at: "10/29 10:42",
    text: "12/26 までにお送りします。宛先は山田様でよろしいですか？",
    from_request: true,
  },
  {
    id: "s-r3",
    side: "they",
    name: "鈴木 健太 様",
    at: "10/29 11:05",
    text: "はい、山田宛でお願いします。",
    from_request: true,
  },
];
const SAMPLE_MSGS: WorkMessage[] = [
  {
    id: "s-c1",
    side: "we",
    name: "高本さん（ENGINE BASE）",
    at: "10/30 17:50",
    text: "作業を始めました。できたらここでお知らせします。",
  },
  { id: "s-c2", side: "they", name: "山田 花子 様", at: "10/31 09:12", text: "はい、お願いします。" },
];

export interface WorkDetailProps {
  /** 見本（モック）で依頼から作ったチケットの形にする。ticket を渡したときは messages の from_request で決まる */
  fromRequest?: boolean;
  /** 口の値（題・段・本文・詳細）。無ければ見本 */
  ticket?: WorkTicket;
  /** やり取り（古い順）。無ければ見本 */
  messages?: WorkMessage[];
  /** 「送る」。空の字では呼ばない。true を返したら欄を空にする */
  onSend?: (text: string) => Promise<boolean> | boolean;
  /** 「← 戻る」 */
  onBack?: () => void;
  /** 送っている間（押せない） */
  busy?: boolean;
  /** 送れなかったときの文（欄の下に出る・書いた内容は残す） */
  error?: string | null;
}

/** 依頼から来た頭の連続した行と、そのあとの行に分ける（区切りは from_request の鍵だけで引く） */
function splitHead(messages: WorkMessage[]): { head: WorkMessage[]; rest: WorkMessage[] } {
  const n = messages.findIndex((m) => m.from_request !== true);
  const cut = n < 0 ? messages.length : n;
  return { head: messages.slice(0, cut), rest: messages.slice(cut) };
}

/** 見せてもらったチケットの 1 件（2026-11-23 代表の決め answer=6ba09f587792・answer=be6242a6c71a）：見えるのは題・本文・詳細・チャットと、段の札 3 つだけ。
 *  担当・期限・確認項目・決定ログ・分身の記録は出さない（受ける値にもその欄が無い）。依頼から作ったときは、チャットの頭に依頼のやり取りが残っている（違いはそれだけ）。
 *  部品は口を呼ばない：値と動きは props で受ける（K-913）。渡さなければ見本のまま */
export function WorkDetail({
  fromRequest = false,
  ticket,
  messages,
  onSend,
  onBack = noop,
  busy = false,
  error = null,
}: WorkDetailProps) {
  const [draft, setDraft] = useState("");
  const t = ticket ?? SAMPLE[fromRequest ? "request" : "plain"];
  const msgs = messages ?? (fromRequest ? [...SAMPLE_REQUEST_MSGS, ...SAMPLE_MSGS] : SAMPLE_MSGS);
  const { head, rest } = splitHead(msgs);
  const stage = stageOf(t.stage);
  const requester = head.find((m) => m.side === "they")?.name;
  const send = async () => {
    const text = draft.trim();
    if (!text || busy || !onSend) return;
    if (await onSend(text)) setDraft("");
  };
  const row = (m: WorkMessage) => (
    <Msg key={m.id} from={m.side} name={m.name} when={m.at}>
      {m.text}
    </Msg>
  );
  return (
    <>
      <Button variant="ghost" size="sm" className="k-f11p-back" onClick={onBack}>
        ← 戻る
      </Button>
      <div className="k-f11p-titlebar">
        <h1>{t.title}</h1>
        <span className="k-f11p-stages" role="group" aria-label="いまの段">
          {STAGES.map((st) => (
            <Badge key={st} tone={st === stage ? "progress" : "neutral"}>
              {st}
            </Badge>
          ))}
        </span>
      </div>
      <p className="k-f11p-sub">ここに出るのは、このチケットの題・本文・詳細・やり取りと、段の札だけです</p>
      <section className="k-f11p-card" aria-label="本文">
        <div className="k-f11p-card-head">
          <b>本文</b>
        </div>
        <div className="k-f11p-body">
          <p>{t.body}</p>
        </div>
      </section>
      <section className="k-f11p-card" aria-label="詳細">
        <div className="k-f11p-card-head">
          <b>詳細</b>
        </div>
        <div className="k-f11p-body">
          <p>{t.detail.trim() ? t.detail : "詳細はまだありません"}</p>
        </div>
      </section>
      <section className="k-f11p-card" aria-label="このチケットのやり取り">
        <div className="k-f11p-card-head">
          <b>やり取り</b>
        </div>
        <div className="k-f11p-thread">
          {head.length ? (
            <>
              <p className="k-f11p-row-meta">
                <Badge tone="ai">依頼のやり取り</Badge>
                {requester ? ` ${requester}が出した依頼から` : null}
              </p>
              {head.map(row)}
              <p className="k-f11p-row-meta">ここからチケットのやり取り</p>
            </>
          ) : null}
          {rest.map(row)}
        </div>
        <div className="k-f11p-form">
          <TextArea
            name="ticket-reply"
            label="やり取りに書く"
            rows={3}
            value={draft}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value)}
            error={error}
          />
          <div className="k-f11p-acts">
            <Button variant="primary" disabled={busy} onClick={() => void send()}>
              送る
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

/** 見られない：見せられていない依頼や仕事を直接開いたとき。あるかどうかも伝えない。
 *  groupName が空の字（見られない人にはゲストのグループが分からない）なら、見られる物の一文は出さない（K-911） */
export function NotVisible({
  what = "このページ",
  groupName = SAMPLE_GROUP,
  onBack = noop,
}: {
  what?: string;
  groupName?: string;
  onBack?: () => void;
}) {
  const company = usePortalCompany();
  return (
    <Empty
      title={`${what}は見られません`}
      action={
        <Button variant="primary" onClick={onBack}>
          やり取りに戻る
        </Button>
      }
    >
      {groupName && company
        ? `この場所で見られるのは、${groupName}の依頼と、${company} が見せると決めたものだけです。`
        : null}
      リンクが正しいか、もう一度確かめてください。
    </Empty>
  );
}

/** 招待を受けた直後（ゲストの文）。名前とパスワードを決めたあとの最初の画面。
 *  name は本人の名前（口の me.name・呼ぶのは名字＝空白の前）。inviter は招いた人（口が返さなければ出さない・K-911） */
export function Welcome({
  name = "山田 花子",
  inviter = "高本 聖斗",
  onStart = noop,
}: {
  name?: string;
  inviter?: string | null;
  onStart?: () => void;
}) {
  const company = usePortalCompany();
  const call = name.split(/[\s\u3000]+/)[0] || name;
  return (
    <div className="k-f11p-center">
      <section className="k-f11p-welcome" aria-labelledby="k-f11p-welcome-h">
        <h1 id="k-f11p-welcome-h" className="k-f11p-h1">
          ようこそ、{call}さん
        </h1>
        <p className="k-f11p-sub">
          {inviter
            ? `${inviter} さんが、${company} とのやり取りに招きました。`
            : `${company} とのやり取りに招かれました。`}
          あなたの権限：ゲスト
        </p>
        <ul className="k-f11p-list">
          <li>{company} にお願いしたいことを、依頼として出せます</li>
          <li>見せてもらったチケットの進みを見て、やり取りできます</li>
        </ul>
        <div className="k-f11p-acts">
          <Button variant="primary" size="lg" onClick={onStart}>
            やり取りを始める
          </Button>
        </div>
      </section>
    </div>
  );
}

/** ログインの有効期限切れ（共通の 1 件）。「入り直す」で onRelogin（自動では移さない） */
export function SessionExpired({ onRelogin = noop }: { onRelogin?: () => void }) {
  return <ErrorState code={PAGE_ERROR.sessionExpired} acts={[onRelogin]} />;
}
