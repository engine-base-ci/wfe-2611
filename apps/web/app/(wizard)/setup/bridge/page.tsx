"use client";
// 自分のPCをつなぐ（T-U-09・A09）。状態：接続中（n）／入っている（ins）／アプリの中（inapp）／つながった（ok）／
// 切れている（slp）／つながらない（ng）／運用中（s）。接続コードは API が発行し、Bridge が引き取る（T-B-02）。
// 「つながりました」は、記録があるだけでは出さない。最後の知らせが来ていて、仕事を渡せる状態のときだけ（G-12）。
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Section, Table, Td, Th, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ago, useBridge } from "@/lib/agent";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { WIZARD_EXISTING } from "@/components/wizard/existing";
import { RequireSession } from "@/lib/auth/session";
import { apiBase, useList } from "@/lib/api";
import { agentRevokeBridge, AuthExtError, bridgePair } from "@/lib/auth/ext";
import { useMarkStep } from "@/lib/onboarding";
import { download, everSeen, installClaude, localChecks, loginClaude, loginCode, pairViaLocal, useWhere, wake, type Check } from "@/lib/bridge-presence";
import { Download, Globe, Power, TriangleAlert, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { confirmDialog } from "@/components/ui/confirm";
import { toast } from "sonner";
import { BrowserFix, CHROME_CHECK } from "@/components/ai/browser-fix";
import { BrowserPick } from "@/components/bridge/browser-pick";
import type { Sessions } from "@kaname/contracts";

const WHAT = [
  "あなたのPCで、あなたのブラウザ・あなたのログイン済みセッションを使って動く。だから CAPTCHA や bot 検知に到達しない（本人の環境・本人のペース）",
  "PCが閉じている間は動きません。起きたときに溜まった分を順に片づけます（サーバー経路は段階2）",
  "資格情報を読まない（預かり先の番号だけを受け取る）",
  "銀行をブラウザで触らない",
  "利用規約で自動操作を禁じるサービスは操作しない",
];
/** 手順の番号（1・2・3）。どこまで来たかが目で分かる */
function Num({ n }: { n: number }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[12px] font-bold text-white">
      {n}
    </span>
  );
}
/** いまやること 1 つだけを出す。入っていないなら入れる道、入っているなら開く道（D-089.10） */
function Open({
  now,
  device,
  found,
  known,
  onInstall,
}: {
  now: boolean;
  device: string | null;
  /** 口座にこの端末の登録がある（＝入れてあるはず）。別のブラウザで開いた人にも「起こす」を出す */
  known?: boolean;
  /** いまこの PC に Bridge が居るか（居れば自動でつながるので、この部品は出ない） */
  found: boolean;
  onInstall: () => void;
}) {
  const [ever, setEver] = useState(false);
  const [tried, setTried] = useState<null | "waiting" | "failed">(null);
  useEffect(() => setEver(everSeen() || !!known), [known]);
  useEffect(() => {
    if (tried !== "waiting") return;
    // 起こしたのに出てこない＝この PC に入っていない（ブラウザは「入っていない」を教えてくれないので、待って判断する）
    const t = setTimeout(() => setTried((x) => (x === "waiting" ? "failed" : x)), 6000);
    return () => clearTimeout(t);
  }, [tried]);
  useEffect(() => {
    if (found) setTried(null);
  }, [found]);
  if (now)
    return (
      <p className="text-[13.5px]" data-open="running">
        この PC で Bridge が見つかりました。<b>つないでいます…</b>
      </p>
    );
  return (
    <div data-open="start">
      <p className="text-[13.5px] leading-[1.9]">
        {device ? `つないだ端末は「${device}」です。` : ""}
        {ever ? (
          <>
            <b>下のボタンで Bridge を起こせます。</b>起きたら、この画面が自分で気づいてつながります。
          </>
        ) : (
          <>
            <b>この PC には Bridge がまだ入っていません。</b>入れて開けば、あとは自動です。
          </>
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ever ? (
          <Button
            onClick={() => {
              setTried("waiting");
              wake();
            }}
            data-wake
          >
            <Power className="size-4" />
            Bridge を起こす
          </Button>
        ) : null}
        <Button variant={ever ? "outline" : "primary"} onClick={onInstall} data-go-install>
          <Download className="size-4" />
          この PC に入れる
        </Button>
        {tried ? (
          <span className="text-[12.5px] text-[var(--on-sv)]" role="status" data-wake-msg>
            {tried === "waiting"
              ? "起こしています…"
              : "起こせませんでした。この PC に入っていないようです。右の「この PC に入れる」から入れてください"}
          </span>
        ) : null}
      </div>
      {ever ? (
        <p className="mt-3 text-[12.5px] text-[var(--on-sv)]">
          ふだんは PC を立ち上げると Bridge も一緒に立ち上がるので、この操作は要りません。
        </p>
      ) : null}
    </div>
  );
}
/** 見張っていることを見せる（押しても何も起きない、と思わせない） */
function Watching({ checking, checkedAt, found }: { checking: boolean; checkedAt: number | null; found: boolean }) {
  if (found) return null;
  return (
    <span className="text-[12.5px] text-[var(--on-sv)]" role="status" data-watching>
      {checking
        ? "この PC を見ています…"
        : checkedAt
          ? `${new Date(checkedAt).toLocaleTimeString("ja-JP")} 時点で、この PC に Bridge は見つかりません（数秒ごとに見ています）`
          : ""}
    </span>
  );
}

export default function BridgeSetupPage() {
  return (
    <RequireSession
      fallback={
        <WizardLayout title="自分のPCをつなぐ" purpose="確かめています" existing={WIZARD_EXISTING}>
          <p className="text-[13.5px] text-[var(--on-sv)]">ログインを確かめています</p>
        </WizardLayout>
      }
    >
      <Bridge />
    </RequireSession>
  );
}
/** 生きていると見なす幅。DB 側（app.bridge_state）と同じ値にする */
const LIVE_SEC = 75;
/** 端末の一覧。行ごとに「最後の応答」と「いま」を出す。
 *  以前は全行にこの PC の値を出し、「いま」を緑で決め打っていた（列見出しだけの実装・G-07） */
function Devices({ rows, st }: { rows: Sessions[]; st: ReturnType<typeof useBridge>["bridge"] }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  // この端末を外す（2026-10-01：モックにあって実装に無かった）。外した Bridge は仕事を取りに来なくなる。つなぎ直しはこの画面から
  const revoke = async (b: Sessions) => {
    const ok = await confirmDialog({
      title: `「${b.device_label ?? "この PC"}」を外しますか`,
      body: "外すと、この PC の Bridge は Kaname に仕事を取りに来なくなります。溜まっている仕事は消えません。もう一度つなぐときは、この画面からつなぎ直します。",
      ok: "外す",
      danger: true,
    });
    if (!ok) return;
    setMsg(null);
    try {
      await agentRevokeBridge(b.id);
      // 外すと画面は「つながっていない」に切り替わり、この表ごと消える。知らせは画面全体に出す
      toast("外しました。もう一度つなぐときは、この画面からつなぎ直してください");
      await qc.invalidateQueries();
    } catch (e) {
      setMsg(e instanceof AuthExtError ? e.message : "外せませんでした");
    }
  };
  return (
    <Section title="接続">
      <Table>
        <thead>
          <tr>
            <Th>端末</Th>
            <Th>登録</Th>
            <Th>最後の応答</Th>
            <Th>いま</Th>
            <Th>
              <span className="sr-only">操作</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const mine = !!st?.device_label && b.device_label === st.device_label;
            const sec =
              mine && typeof st?.last_seen_sec === "number"
                ? st.last_seen_sec
                : b.last_seen_at
                  ? (Date.now() - new Date(b.last_seen_at).getTime()) / 1000
                  : null;
            const live = sec !== null && sec < LIVE_SEC;
            return (
              <tr key={b.id} data-live={live ? "1" : "0"}>
                <Td>{b.device_label ?? "この PC"}</Td>
                <Td>{b.issued_at ? new Date(b.issued_at).toLocaleDateString("ja-JP") : ""}</Td>
                <Td>{sec === null ? "—" : ago(sec)}</Td>
                <Td>
                  <Pill tone={live ? "success" : "neutral"}>{live ? "仕事を渡せる" : "止まっています"}</Pill>
                </Td>
                <Td>
                  <Button variant="ghost" size="sm" icon={<X />} onClick={() => void revoke(b)} data-bridge-revoke={b.id}>
                    この端末を外す
                  </Button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {msg ? (
        <p className="mt-2 text-[12.5px] text-[var(--on-sv)]" role="status" data-bridge-revoke-msg>
          {msg}
        </p>
      ) : null}
    </Section>
  );
}

function Bridge() {
  const sessions = useList<Sessions>("sessions", { limit: 50 }, "bridge-setup");
  const bridges = (sessions.data?.data ?? []).filter((s) => s.kind_id === "bridge" && !s.revoked_at);
  // つないだ記録だけでは足りない。いま知らせが来ているか（live）で「渡せる／渡せない」を分ける（G-12）
  const { bridge: st, loading: stLoading, usable, asleep, refetch: refetchState } = useBridge();
  const [code, setCode] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [pairError, setPairError] = useState<string | null>(null);
  const [devMsg, setDevMsg] = useState<string | null>(null);
  /** この PC の Bridge が別のアカウントでつながっている（黙って切り替えない・本人が押したら切り替える） */
  const [otherAccount, setOtherAccount] = useState(false);
  const markStep = useMarkStep();
  const { where, bridge, checking, checkedAt, recheck: recheckWhere } = useWhere(); // app（アプリの中）／installed（入っている）／web（未インストール）
  // この PC の Bridge が確かめた結果。Claude Code が無ければ、入れるところまで Bridge にやらせる（D-091）
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [ccBusy, setCcBusy] = useState(false);
  const [ccMsg, setCcMsg] = useState<string | null>(null);
  const [dlMsg, setDlMsg] = useState<string | null>(null);
  const getInstaller = async (os: "mac" | "win") => {
    setDlMsg(null);
    const r = await download(os, apiBase());
    if (!r.ok) setDlMsg(r.message);
  };
  // 2 つの検査はどちらも名前に「Claude Code」が入る。名前ではなく「何をすれば直るか」で選ぶ
  const needInstall = checks?.find((c) => c.fix === "install" || c.fix === "repair") ?? null;
  const needInstallFirst = checks?.find((c) => c.fix === "install" || c.fix === "repair") ?? null;
  // 入っていないのにログインは押せない。押せないボタンを出さない（1 画面 1 主アクション）
  const needLogin = needInstallFirst ? null : (checks?.find((c) => c.fix === "login") ?? null);
  useEffect(() => {
    if (where === "installed" || where === "app") void localChecks().then(setChecks);
  }, [where]);
  const doInstall = async () => {
    setCcBusy(true);
    setCcMsg("入れています（1〜2 分）。この画面は閉じないでください");
    const r = await installClaude();
    setCcMsg(r.message);
    setChecks(await localChecks());
    setCcBusy(false);
  };
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loginCodeText, setLoginCodeText] = useState("");
  const doLogin = async () => {
    setCcMsg("ブラウザを開いています…");
    const r = await loginClaude();
    setLoginUrl(r.url ?? null);
    setCcMsg(r.message);
    if (r.ok && !r.url) setChecks(await localChecks()); // もう入れていた
  };
  const doLoginCode = async () => {
    setCcBusy(true);
    setCcMsg("確かめています（30 秒ほどかかります）…");
    const r = await loginCode(loginCodeText);
    setCcBusy(false);
    setCcMsg(r.message);
    if (r.ok) {
      setLoginUrl(null);
      setLoginCodeText("");
    }
    setChecks(await localChecks());
  };
  useEffect(() => {
    if (sessions.isPending || stLoading || usable || asleep) return; // 手順を出すときだけ番号を出す
    if (code || pairError) return;
    bridgePair().then(
      (r) => setCode(r.code),
      (e: Error) => setPairError(e.message),
    );
  }, [sessions.isPending, stLoading, usable, asleep, code, pairError]);
  // この PC で Bridge が動いているか（ローカルの返事）。サーバーの記録より、こちらが先。
  // サーバーは「最後の応答から 75 秒」で生きていると見なすので、落ちた直後も「つながっています」と言ってしまう（G-12）
  const hereLive = where === "app" || where === "installed";
  // Bridge が「AI が Chrome を使えない」と返したか（D-119.4）
  const chromeOff = !!st?.health?.some((h) => h.name === CHROME_CHECK && !h.ok);
  // Bridge が古い（自己診断の fix=update・E-CONN-012）。古い Bridge には仕事を渡さないので、その場で入れ直す口を出す（2026-10-01）
  const outdated = !!st?.health?.some((h) => h.fix === "update" && !h.ok);
  // ダウンロードの口（未インストールの手順と、Bridge が古いときの入れ直しで同じものを使う）
  const downloads = (
    <>
    <div className="mt-1 flex flex-wrap gap-2">
                              {(
                                [
                                  ["mac", "macOS 版", "Apple Silicon / Intel"],
                                  ["win", "Windows 版", "10 以降"],
                                ] as const
                              ).map(([os, label, note]) => (
                                <Button
                                  key={os}
                                  variant={os === "mac" ? "primary" : "outline"}
                                  onClick={() => void getInstaller(os)}
                                  data-download={os}
                                >
                                  <Download className="size-4" />
                                  {label}
                                  <span className="ml-1 text-[11.5px] opacity-70">{note}</span>
                                </Button>
                              ))}
                            </div>
                            {dlMsg ? (
                              <p className="mt-2 text-[12.5px] text-[var(--st-warning)]" role="status" data-download-msg>
                                {dlMsg}
                              </p>
                            ) : null}
    </>
  );
  const state =
    sessions.isPending || stLoading || checkedAt === null
      ? "loading"
      : usable && hereLive
        ? "ok"
        : usable && !hereLive
          ? "other" // サーバーは生きていると言うが、この PC では動いていない（別の端末 か 落ちた直後）
          : asleep
            ? "slp"
            : tries > 0
              ? "ng"
              : "n";
  const recheck = async () => {
    setTries((t) => t + 1);
    recheckWhere(); // ★この PC に Bridge が居るかを見直す（これが無いと、起動しても押しても何も変わらない）
    const r = await sessions.refetch();
    refetchState();
    const live = (r.data?.data ?? []).some((x) => x.kind_id === "bridge" && !x.revoked_at);
    if (live) await markStep(1); // 通した段を記録する（D-089）
  };
  /** Bridge が動いているなら、この画面から直接つなぐ（人がコードを打ち直さない・D-089.8） */
  const connectHere = async (allowSwitch = false) => {
    setDevMsg(null);
    setOtherAccount(false);
    // 番号がまだ出ていないうちに押されても動くようにする（出てから押す、を人に強いない）
    const c = code ?? (await bridgePair().then((r) => r.code).catch(() => null));
    if (!c) return setDevMsg("接続の番号を出せませんでした。もう一度押してください");
    if (!code) setCode(c);
    const r = await pairViaLocal(c, allowSwitch);
    if (!r.ok) {
      if (r.otherAccount) setOtherAccount(true);
      return setDevMsg(r.message);
    }
    await sessions.refetch();
    refetchState();
    await markStep(1);
    recheckWhere();
  };
  // この PC に Bridge が居ると分かった瞬間につなぐ（D-089.10）。
  // 起動しただけで先へ進む。人が「もう一度確かめる」を押し続ける画面にしない
  const tried = useRef(false);
  useEffect(() => {
    if (where !== "app" && where !== "installed") return;
    if (usable || tried.current) return;
    tried.current = true;
    void connectHere();
  }, [where, usable]);
  // つなごうとした結果（別のアカウントでつながっている・つなげなかった）。どの状態の画面にも出す
  // （以前は「まだつないだことが無い」画面にしか無く、切れている人は「つないでいます…」のまま止まっていた・2026-09-28 実例）
  const pairNotice =
    devMsg || otherAccount ? (
      <div className="mt-3" data-pair-notice>
        {devMsg ? (
          <p className="text-[13px] text-[var(--error)]" role="status" data-pair-msg>
            {devMsg}
          </p>
        ) : null}
        {otherAccount ? (
          <div className="mt-2">
            <Button onClick={() => void connectHere(true)} data-switch-account>
              このアカウントに切り替える
            </Button>
          </div>
        ) : null}
      </div>
    ) : null;
  // 足りないもの（入れる／取り直す／ログイン）は、つながった後でも出す。
  // 以前は「まだつながっていない」画面にしか置いておらず、つながった後にログインが必要でも何も出なかった
  const needBlock = (
    <>
              {/* 足りないものだけを出す。入れる／取り直す と ログイン は別の用事（D-091） */}
    {needInstall || needLogin ? (
      <div
        className="mt-5 rounded-[var(--r-md)] border border-[var(--st-warning)] bg-[var(--st-warning-container)] px-3.5 py-3 text-[13px]"
        data-need-claude
        role="status"
      >
        <b className="text-[var(--st-warning)]">
          {needInstall
            ? needInstall.fix === "repair"
              ? "Claude Code の本体が落ちてきていません。"
              : "この PC に Claude Code がありません。"
            : "Claude Code にまだログインしていません。"}
        </b>
        <p className="mt-1 leading-[1.8]">
          自分のAIもAI社員も、<b>あなたのサブスクの Claude Code</b> で動きます。
          {needInstall
            ? "これが無いと 1 件も動きません。下のボタンで入れられます（ターミナルは触りません）。"
            : "ブラウザで 1 回だけ承認すると動き出します（ターミナルは開きません）。"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {needInstall ? (
            <Button onClick={doInstall} disabled={ccBusy} data-install-claude>
              {ccBusy ? "入れています" : needInstall.fix === "repair" ? "Claude Code を取り直す" : "Claude Code を入れる"}
            </Button>
          ) : null}
          {needLogin ? (
            <Button variant={needInstall ? "outline" : "primary"} onClick={doLogin} data-login-claude>
              ログインする
            </Button>
          ) : null}
        </div>
        {loginUrl ? (
          <div className="mt-3 border-t border-[var(--line)] pt-3" data-login-step>
            <ol className="ml-4 list-decimal text-[12.5px] leading-[1.9] text-[var(--on-sv)]">
              <li>
                ブラウザが開きます。開かないときは{" "}
                <a className="font-semibold text-[var(--primary)]" href={loginUrl} target="_blank" rel="noreferrer">
                  この入口
                </a>{" "}
                を押してください
              </li>
              <li>承認すると画面にコードが出ます。それを下に貼って「決定」</li>
            </ol>
            <div className="mt-2 flex gap-2">
              <input
                className="h-10 flex-1 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--card)] px-3 text-[15px]"
                placeholder="コードを貼る"
                aria-label="ブラウザに出たコード"
                value={loginCodeText}
                onChange={(e) => setLoginCodeText(e.target.value)}
              />
              <Button onClick={doLoginCode} disabled={ccBusy || !loginCodeText.trim()}>
                決定
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    ) : null}
    </>
  );
  return (
    <WizardLayout
      title="自分のPCをつなぐ"
      purpose="自分のAIもAI社員も、あなたのPCで・あなたのサブスクで動きます。つながるまで自分のAIは話せません。API は使いません。"
      existing={WIZARD_EXISTING}
    >
      {state === "loading" ? (
        // 確かめ終わる前に「手順」を出すと、一瞬それが見えてから別の画面に変わる（チラつき）。
        // 出すのは 1 回だけにする（D-072：画面は変わる前に変わると言う）
        <div data-state="loading">
          <p className="text-[13.5px] text-[var(--on-sv)]">この PC のつなぎ具合を確かめています</p>
        </div>
      ) : state === "ok" ? (
        <div data-state="ok" data-requires="bridge">
          {/* 古い Bridge には仕事を渡さない（D-109）。つながっていても「渡せます」とは言わない */}
          <p
            className={cn("text-[15px] font-semibold", outdated ? "text-[var(--st-danger)]" : "text-[var(--st-success)]")}
            data-connected
          >
            {outdated ? "つながっていますが、Bridge が古いので仕事を渡せません。" : "つながりました。いま仕事を渡せます"}
          </p>
          <Devices rows={bridges} st={st} />
          {needBlock}
          {/* Bridge の中で完結させず、確かめた結果をこの画面に返す（D-090）。渡せない項目はそのまま見せる */}
          <Section title="Bridge が自分で確かめた結果">
            {st?.health?.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>確かめたこと</Th>
                    <Th>結果</Th>
                  </tr>
                </thead>
                <tbody>
                  {st.health.map((h) => (
                    <tr key={h.name} data-check={h.ok ? "ok" : "ng"}>
                      <Td>{h.name}</Td>
                      <Td>
                        <Pill tone={h.ok ? "success" : "danger"}>{h.ok ? "できる" : "できません"}</Pill>
                        <span className="ml-2 text-[12.5px] text-[var(--on-sv)]">{h.detail}</span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="text-[13px] text-[var(--on-sv)]" data-no-health>
                まだ報告が来ていません。Bridge は 30 秒ごとに、確かめた結果をここへ返します。
              </p>
            )}
            {outdated ? (
              <div className="kc mt-4" data-bridge-reinstall>
                <div className="stopline" role="status">
                  <TriangleAlert />
                  <div>
                    <b>この PC の Bridge が古いので、自分のAI に仕事を渡せません。</b>入れ直してください。書いたことは溜めておき、入れ直した後に順に片づけます。
                    <div className="mt-2">{downloads}</div>
                  </div>
                </div>
              </div>
            ) : null}
            {/* Chrome とつながっていないときは、文だけにせずその場でやる一手を出す（D-120.2〜4） */}
            {chromeOff ? (
              <div className="kc mt-4" data-browser-off>
                <div className="stopline" role="status">
                  <Globe />
                  <div>
                    <b>AI が Chrome を使えません。</b>拡張機能「Claude in Chrome」とつながっていません。ブラウザを使わない仕事はそのまま動きます。
                    <BrowserFix open />
                  </div>
                </div>
              </div>
            ) : null}
          </Section>
          <Section title="AI が使うブラウザ">
            <p className="mb-2 text-[12px] text-[var(--on-sv)]">この PC の分。変えると次の仕事から使います（Bridge の窓でも同じ値を変えられます）</p>
            <BrowserPick value={st?.browser ?? "chrome"} />
          </Section>
          <div className="mt-6">
            <Link href="/onboard/interview">
              <Button>自分のAIと話すへ</Button>
            </Link>
          </div>
        </div>
      ) : state === "other" ? (
        // サーバーには応答の記録があるが、この PC の Bridge は返事をしない。
        // 落とした直後（記録は 75 秒残る）か、別の端末で動いている。どちらも「この PC では渡せない」
        <div data-state="other" data-requires="nobridge">
          <p className="text-[15px] font-semibold text-[var(--st-warning)]" data-disconnected>
            この PC では動いていません
          </p>
          <p className="mt-2 max-w-[62ch] text-[13.5px] text-[var(--on-sv)]">
            {st?.last_seen_sec !== undefined ? `記録では ${ago(st.last_seen_sec)} に応答があります。` : ""}
            いまこの PC の Bridge に聞くと返事がありません。閉じた直後か、別の端末で動いています。
          </p>
          <Devices rows={bridges} st={st} />
          <Section title="やること">
            {/* この PC の Bridge は動いていて、別のアカウントにつながっているだけ。起こす・入れるは出さない */}
            {otherAccount ? null : (
              <Open
                now={(where === "installed" || where === "app") && !devMsg}
                device={st?.device_label ?? null}
                known={!!st?.device_label}
                found={where === "installed" || where === "app"}
                onInstall={() => setTries(0)}
              />
            )}
            {pairNotice}
          </Section>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={recheck} disabled={checking}>
              {checking ? "確かめています" : "接続を確かめる"}
            </Button>
            <Watching checking={checking} checkedAt={checkedAt} found={where !== "web"} />
          </div>
        </div>
      ) : state === "slp" ? (
        // つないだ記録はあるが、知らせが来ていない。やることは 1 つ ──「その PC で Bridge を開く」
        <div data-state="slp" data-requires="nobridge">
          <p className="text-[15px] font-semibold text-[var(--st-warning)]" data-disconnected>
            切れています。いまは仕事を渡せません
          </p>
          <p className="mt-2 max-w-[62ch] text-[13.5px] text-[var(--on-sv)]">
            {st?.device_label ?? "この PC"} とはつながっていますが、
            {st?.last_seen_sec !== undefined ? `最後の知らせは ${ago(st.last_seen_sec)} です。` : ""}
            PC が閉じているか、Bridge を終了しています。溜まった分は消えません。
          </p>
          <Section title="やること">
            {/* この PC の Bridge は動いていて、別のアカウントにつながっているだけ。起こす・入れるは出さない */}
            {otherAccount ? null : (
              <Open
                now={(where === "installed" || where === "app") && !devMsg}
                device={st?.device_label ?? null}
                known={!!st?.device_label}
                found={where === "installed" || where === "app"}
                onInstall={() => setTries(0)}
              />
            )}
            {pairNotice}
          </Section>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={recheck} disabled={checking}>
              {checking ? "確かめています" : "接続を確かめる"}
            </Button>
            <Watching checking={checking} checkedAt={checkedAt} found={where !== "web"} />
          </div>
        </div>
      ) : (
        <div data-state={state}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Section title="やること">
              {/* この PC に Bridge が居るかで、やること 1 つだけを出す（D-089.8・D-089.10） */}
              {where === "web" ? (
                // ブラウザで、この PC に Bridge が無い人だけ。アプリの中の人にはここは 1 行も出さない（D-089.8）
                <div data-where="web">
                  <p className="text-[13.5px] leading-[1.9]">
                    <b>この PC に Bridge がまだありません。</b>下の 3 つだけです。
                    <b>接続コードを打つ必要も、コマンドを打つ必要もありません。</b>
                  </p>
                  <ol className="mt-4 space-y-4" data-install-lead>
                    <li className="flex gap-3">
                      <Num n={1} />
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold">受け取る</div>
                        {downloads}
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <Num n={2} />
                      <div>
                        <div className="text-[14px] font-semibold">開く</div>
                        <p className="mt-1 text-[13px] leading-[1.9] text-[var(--on-sv)]">
                          ダウンロードフォルダの <b>Kaname Bridge</b> をダブルクリックします。
                          Mac は出てきた窓で Kaname Bridge を「アプリケーション」へドラッグしてから開きます。
                        </p>
                        {/* 署名（Apple の公証・Windows のコード署名）が済むまでは OS が止める。越え方だけ案内し、手順は変えない（D-015.7・T-B-06）。
                            いまの macOS では「右クリック → 開く」では越えられない */}
                        <details className="mt-2" data-os-warning>
                          <summary className="cursor-pointer text-[13px] font-semibold text-[var(--primary)]">
                            「開いていません」「PC が保護されました」と出たとき
                          </summary>
                          <div className="mt-2 space-y-2 text-[13px] leading-[1.9] text-[var(--on-sv)]">
                            <p>
                              いまは Apple と Microsoft の署名の手続き中のため、初回に OS が止めます。
                              <b>中身の問題ではありません。</b>1 回越えれば次からは出ません。
                            </p>
                            <p data-os-warning="mac">
                              <b>Mac（「"Kaname Bridge" は開いていません」）</b>
                              <br />① <b>「完了」</b>を押す（「ゴミ箱に入れる」は押さない）
                              <br />② 画面左上のアップルメニュー → <b>システム設定</b> → <b>プライバシーとセキュリティ</b>
                              <br />③ 下の方の「"Kaname Bridge" は…ブロックされました」の横の <b>「このまま開く」</b>を押し、パスワードか Touch ID
                              <br />④ もう一度 Kaname Bridge を開き、出てきた確認で <b>「開く」</b>
                            </p>
                            <p data-os-warning="win">
                              <b>Windows（「Windows によって PC が保護されました」）</b>
                              <br />① <b>「詳細情報」</b>を押す → ② <b>「実行」</b>を押す
                            </p>
                          </div>
                        </details>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <Num n={3} />
                      <div>
                        <div className="text-[14px] font-semibold">初回だけ「許可」を押す</div>
                        <p className="mt-1 text-[13px] leading-[1.9] text-[var(--on-sv)]">
                          OS が「Bridge が Chrome を操作してよいか」を聞きます。「許可」を押してください。1 回だけです。
                        </p>
                      </div>
                    </li>
                  </ol>
                  <p className="mt-4 rounded-[var(--r-md)] bg-[var(--sv)] px-3.5 py-2.5 text-[13px]">
                    開いたら、<b>この画面が自分で気づいてつながります。</b>あなたは何も押さなくて大丈夫です。
                  </p>
                  <details className="mt-4">
                    <summary className="cursor-pointer text-[13px] text-[var(--on-sv)]">
                      うまくつながらないとき（接続コードを手で入れる）
                    </summary>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <code
                        className="num rounded-[var(--r-md)] bg-[var(--sv)] px-3 py-1.5 font-[var(--font-code)] text-[20px] tracking-[0.12em]"
                        data-pair-code
                      >
                        {code ?? (pairError ? "発行できませんでした" : "…")}
                      </code>
                      <span className="text-[13px] text-[var(--on-sv)]">
                        Bridge の最初の画面に入れます。10 分で失効します
                      </span>
                    </div>
                  </details>
                </div>
              ) : (
                <div data-where={where}>
                  <p className="text-[13.5px] leading-[1.9]" role="status">
                    <b>
                      {where === "app"
                        ? "Kaname のアプリ（Bridge）の中で開いています。"
                        : "この PC で Bridge が動いています。"}
                    </b>
                    入れる作業も接続コードの入力も要りません。<b>このままつなぎます。</b>
                    {bridge?.device_label ? `（${bridge.device_label}）` : ""}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => void connectHere()} data-connect-here>
                      つながらないときは、ここを押す
                    </Button>
                  </div>
                </div>
              )}
              {needBlock}
              {ccMsg ? (
                <p className="mt-2 text-[12.5px] text-[var(--on-sv)]" data-install-msg role="status">
                  {ccMsg}
                </p>
              ) : null}
              {pairNotice}
              {state === "ng" ? (
                <p
                  className="mt-4 rounded-[var(--r-md)] bg-[#fbebd6] px-3 py-2 text-[13px] text-[var(--st-warning)]"
                  role="status"
                >
                  <b>まだつながっていません。</b>Bridge を開いたら、この画面が自分で気づきます。急がなくて大丈夫です。
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button variant={where === "web" ? "primary" : "outline"} onClick={recheck} disabled={checking}>
                  {checking ? "確かめています" : "接続を確かめる"}
                </Button>
                <Watching checking={checking} checkedAt={checkedAt} found={where !== "web"} />
              </div>
            </Section>
            <Section title="Bridge が何をするか・しないか">
              <ul className="list-disc space-y-1.5 pl-5 text-[13px]">
                {WHAT.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      )}
    </WizardLayout>
  );
}
