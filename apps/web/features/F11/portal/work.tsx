"use client";
// 見せてもらったチケットの 1 件（題・本文・詳細・やり取りと段の札）・見られない画面・招待を受けた直後の画面・ログインの有効期限切れ。
//   どれもキャンバスに絵が無いので、画面に出る字は仮
import { Badge, Button, Empty, ErrorState, PAGE_ERROR, TextArea } from "@/components/k";
import { SAMPLE_GROUP, usePortalCompany } from "./frame";
import { Msg } from "./request";
import "./portal.css";

const noop = () => undefined;

/** 段の札（3 つだけ）：いまの段を目立たせる */
const STAGES = ["作っている", "確認中", "完了"] as const;

/** 見せてもらったチケットの 1 件（2026-11-23 代表の決め answer=6ba09f587792・answer=be6242a6c71a）：見えるのは題・本文・詳細・チャットと、段の札 3 つだけ。
 *  担当・期限・確認項目・決定ログ・分身の記録は出さない。fromRequest のときは、チャットの頭に依頼のやり取りが残っている（違いはそれだけ） */
export function WorkDetail({ fromRequest = false }: { fromRequest?: boolean }) {
  return (
    <>
      <Button variant="ghost" size="sm" className="k-f11p-back">
        ← 戻る
      </Button>
      <div className="k-f11p-titlebar">
        <h1>{fromRequest ? "12 月分の作業報告書を作って送る" : "11月分の請求書を送る"}</h1>
        <span className="k-f11p-stages" role="group" aria-label="いまの段">
          {STAGES.map((st) => (
            <Badge key={st} tone={st === "確認中" ? "progress" : "neutral"}>
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
          <p>
            {fromRequest
              ? "12 月分の作業報告書を作り、セイコー様の経理部 山田様にお送りする。"
              : "セイコー様に 11 月分の保守費を請求し、11/30 までに入金していただく。"}
          </p>
        </div>
      </section>
      <section className="k-f11p-card" aria-label="詳細">
        <div className="k-f11p-card-head">
          <b>詳細</b>
        </div>
        <div className="k-f11p-body">
          <p>
            {fromRequest
              ? "報告書は 12 月の作業の一覧と時間の合計。12/26 までに PDF でお送りする。"
              : "請求書は 11 月分の保守費（1,500,000 円）と追加対応 2 回分（60,000 円）。宛名は経理部 山田様。"}
          </p>
        </div>
      </section>
      <section className="k-f11p-card" aria-label="このチケットのやり取り">
        <div className="k-f11p-card-head">
          <b>やり取り</b>
        </div>
        <div className="k-f11p-thread">
          {fromRequest ? (
            <>
              <p className="k-f11p-row-meta">
                <Badge tone="ai">依頼のやり取り</Badge> 鈴木 健太 様が出した依頼から
              </p>
              <Msg from="they" name="鈴木 健太 様" when="10/29 10:20">
                12 月分の作業報告書もほしいです。
              </Msg>
              <Msg from="we" name="高本さん（ENGINE BASE）" when="10/29 10:42">
                12/26 までにお送りします。宛先は山田様でよろしいですか？
              </Msg>
              <Msg from="they" name="鈴木 健太 様" when="10/29 11:05">
                はい、山田宛でお願いします。
              </Msg>
              <p className="k-f11p-row-meta">ここからチケットのやり取り</p>
            </>
          ) : null}
          <Msg from="we" name="高本さん（ENGINE BASE）" when="10/30 17:50">
            作業を始めました。できたらここでお知らせします。
          </Msg>
          <Msg from="they" name="山田 花子 様" when="10/31 09:12">
            はい、お願いします。
          </Msg>
        </div>
        <div className="k-f11p-form">
          <TextArea name="ticket-reply" label="やり取りに書く" rows={3} />
          <div className="k-f11p-acts">
            <Button variant="primary">送る</Button>
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
