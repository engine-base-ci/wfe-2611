// ログインしていない人の「困ったとき」（/help・D-128.146・段 2 の新しい画面・枝 c/段2）。キャンバスは無いので、ログイン後の MeHelp の
//   「いまの稼働状況」と入口の部品で組んだ（聞くこと 1 の勧め (a)：よくある困りごと・いまの稼働状況・運営へのメール。新しい口は作らない）。
//   動きは持たない。稼働状況は誰でも読める口（getServiceStatus）の答えを呼ぶ側が渡す。運営の宛先は設定（@kaname/config の operator.email）から
import Link from "next/link";
import { KeyRound, Lock, Mail, Smartphone } from "lucide-react";
import { ChoiceCard, NoteBox, type ServiceIncident } from "@/components/k/auth-parts";
import { Pill } from "@/components/k/setting-parts";
import { Loading } from "@/components/k/states";
import { AuthFrame } from "../sign-up/frame";
import "../login/views.css";
import "./help.css";

/** 稼働状況。一覧（空なら「ふつう」）・null は読めなかった（その区画だけ「いまは読めません」・ほかは出す）・
 *  "loading" は答えを待っている（区画の中だけ。3 秒より長いときだけ「読み込んでいます…」・D-144.8） */
export type HelpStatus = readonly ServiceIncident[] | null | "loading";

export interface HelpViewProps {
  status: HelpStatus;
  opsEmail: string;
}

export function HelpView({ status, opsEmail }: HelpViewProps) {
  return (
    <AuthFrame foot="all">
      <div className="k-auth-form k-help" data-auth="help">
        <Link href="/login" className="k-login-back">
          ← ログインに戻る
        </Link>
        <h1 className="k-help-h">困ったとき</h1>
        <section aria-labelledby="help-common" className="k-help-sec">
          <h2 id="help-common">よくある困りごと</h2>
          <ChoiceCard
            icon={<KeyRound size={16} />}
            title="パスワードを忘れた"
            desc="登録したメールに作り直しのリンクを送る（30 分・1 回だけ）"
            href="/password-reset"
          />
          <ChoiceCard
            icon={<Smartphone size={16} />}
            title="パスキーの端末や認証アプリをなくした"
            desc="バックアップコードで入るか、ワークスペースの管理者に戻してもらう"
            href="/login?step=recover"
          />
          <ChoiceCard
            icon={<Mail size={16} />}
            title="確認のメールが届かない"
            desc="迷惑メールのフォルダとアドレスを確かめて、登録の画面から送り直す"
            href="/signup"
          />
          <ChoiceCard
            icon={<Lock size={16} />}
            title="ログインできない（ロックされた）"
            desc="パスワードを 5 回違えると 15 分止まる。15 分たってから入るか、パスワードを作り直す"
            href="/password-reset"
          />
        </section>
        <section aria-labelledby="help-status" className="k-help-sec" id="status">
          <h2 id="help-status">いまの稼働状況</h2>
          {status === "loading" ? (
            <Loading />
          ) : status === null ? (
            <NoteBox>いまは稼働状況を読めません。少したってから開き直してください</NoteBox>
          ) : status.length === 0 ? (
            <p className="k-help-row">
              <span>Kaname</span>
              <Pill tone="success">ふつう</Pill>
            </p>
          ) : (
            <ul className="k-help-list">
              {status.map((s) => (
                <li key={`${s.kind}-${s.title}`} className="k-help-row">
                  <span className="k-help-main">
                    <b>{s.title}</b>
                    <span className="k-help-when">{s.when}</span>
                  </span>
                  <Pill tone="warning">{s.kind === "incident" ? "障害" : "メンテナンス"}</Pill>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="help-ask" className="k-help-sec">
          <h2 id="help-ask">運営に聞く</h2>
          <NoteBox>
            上で解けないときは、メールで運営に聞いてください：<a href={`mailto:${opsEmail}`}>{opsEmail}</a>
            <br />
            登録したメールアドレスから送ると、早く確かめられます。パスワードやコードは書かないでください
          </NoteBox>
        </section>
      </div>
    </AuthFrame>
  );
}
