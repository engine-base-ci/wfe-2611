"use client";
// PC をつなぐ（K-57・画面 bridge-setup・道 /setup/bridge）。キャンバスの EdPC（①常駐アプリを入れる ②アプリにこのコードを入れる ③試しに動かす）と MePC（つないでいる PC）。
//   出し分け（D-089）：①ブラウザで Bridge が入っていない＝受け取る道＋コード ②ブラウザで Bridge が入っている＝ボタン 1 つで渡す ③Bridge の窓の中＝開いた時点で自分でつながる
//   「つながっています」は、最初の生きている知らせが届いてから（D-090）。眠っていれば「切れています」（E-CONN-001）と起こすボタン
//   外枠（K-220・D-144.6）：新しい外枠（TicketShell）の中に、自分の設定の第 2 ナビ（MeSub）と本文の箱を並べる（キャンバス MePC）。どの状態も外枠の中に出す。
//     見出しはキャンバスどおり「PC と使った量」。左のメニューの PC の状態は、この画面が読み続ける一覧の答えを渡す（外枠は読み直さない）。
//     PC の一覧を読み終えるまでは、見出しの行の下に読み込み中（3 秒たっても終わらないときだけ文・D-144.8）
//   口は契約の口だけ（createPairingCode・listMyDevices・downloadBridgeRelease）。文言は正本（errors.json）から
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Badge, Button, Callout, ErrorState, Loading, MeSub, NoAccess } from "@/components/k";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { getInstaller, pairViaLocal, useWhere, wake } from "@/lib/bridge-presence";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { pollDevices, type Device } from "./devices";
import { CATALOG } from "@kaname/errors/catalog";

const CATALOG_IDS: Record<string, unknown> = CATALOG;

const SELF = "/setup/bridge";
/** 前の画面（D-128.150・D-128.164）。K-89・K-90・K-91 が新しい画面へ移し終えたら消す */
const LEGACY = "/setup/bridge/legacy";
/** 戻る先は中の道だけ（外の道は捨てる・TP-AUTH-08）。ブラウザと同じ読み方（new URL(v, 今の origin)）で読み、
 *  同じ origin のときだけ使う（タブ・改行を落とすと "//外" になる・"/\\外"・"//外" も外として捨てる）。返すのは道・問い・#だけ */
export function safeFrom(
  v: string | null,
  origin: string = typeof window === "undefined" ? "" : window.location.origin,
): string | null {
  if (!v || !origin || !v.startsWith("/")) return null;
  let out: string;
  try {
    const u = new URL(v, origin);
    if (u.origin !== origin) return null;
    out = `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
  // 道を整えると "//外" "/\\外" になるもの（/.//外・/..//外・/a/..//外・/%2e//外・/./\\外）は、href に置くと外の origin になる。捨てる
  if (out.startsWith("//") || out.startsWith("/\\")) return null;
  // 返す値そのものを、もう一度同じ読み方で読み直して同じ origin か確かめる
  try {
    return new URL(out, origin).origin === origin ? out : null;
  } catch {
    return null;
  }
}

type Code = { code: string; expiresAt: number };
type Problem =
  { kind: "expired" } | { kind: "forbidden" } | { kind: "wait"; sec: number } | { kind: "code"; code: string };

const lastSeen = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

export function ConnectPc({ from }: { from: string | null }) {
  const back = safeFrom(from);
  const here = back ? `${SELF}?from=${encodeURIComponent(back)}` : SELF;
  const [ready, setReady] = useState(false);
  const { where, bridge } = useWhere();
  const [code, setCode] = useState<Code | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [otherAccount, setOtherAccount] = useState(false);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const autoTried = useRef(false);

  // ログインしていなければログインへ。入ったらこの画面に戻る（戻す先は中の道だけ）
  useEffect(() => {
    if (!getToken()) window.location.replace(`/login?next=${encodeURIComponent(here)}`);
    else setReady(true);
  }, [here]);

  const fail = useCallback((r: CallErr) => {
    if (r.kind === "unauthenticated") setProblem({ kind: "expired" });
    else if (r.kind === "forbidden") setProblem({ kind: "forbidden" });
    else if (r.kind === "rate_limited") setProblem({ kind: "wait", sec: r.retryAfterSec ?? 60 });
    else setProblem({ kind: "code", code: r.code in CATALOG_IDS ? r.code : PAGE_ERROR.loadFailed });
  }, []);

  const newCode = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const r = await call("createPairingCode", { body: {}, screenId: "bridge-setup" });
      if (!r.ok) {
        fail(r);
        return null;
      }
      setProblem(null);
      setCode({ code: r.data.code ?? "", expiresAt: new Date(r.data.expires_at ?? Date.now()).getTime() });
      return r.data.code ?? null;
    } finally {
      setBusy(false);
    }
  }, [fail]);

  // 生きている知らせを見続ける（眠っている PC が起きたら、画面が自分で「つながっています」に戻る）
  useEffect(() => {
    if (!ready) return;
    return pollDevices(
      (d) => setDevices(d),
      (r) => fail(r),
    );
  }, [ready, fail]);

  const live = devices?.find((d) => d.state === "live") ?? null;
  const waiting = devices?.find((d) => d.state === "waiting") ?? null;
  const asleep = !live && !waiting ? (devices?.find((d) => d.state === "asleep") ?? null) : null;

  const connectLocal = useCallback(
    async (allowSwitch = false) => {
      const c = await newCode();
      if (!c) return;
      const r = await pairViaLocal(c, allowSwitch);
      if (r.ok) {
        setOtherAccount(false);
        setNote("この PC の Bridge にコードを渡しました。アプリからの返事を待っています…");
      } else {
        setOtherAccount(Boolean(r.otherAccount));
        setNote(r.message);
      }
    },
    [newCode],
  );

  // ブラウザ（Bridge なし）は開いたらコードを出す。Bridge の窓の中は開いた時点で自分でつながる
  useEffect(() => {
    if (!ready || autoTried.current || devices === null || live) return;
    if (where === "web") {
      autoTried.current = true;
      void newCode();
    } else if (where === "app") {
      autoTried.current = true;
      void connectLocal();
    }
  }, [ready, where, devices, live, newCode, connectLocal]);

  // 期限が来たら、画面が自分で新しいコードに替える（10 分・1 回だけ）
  useEffect(() => {
    if (!code || where !== "web") return;
    const t = setTimeout(() => void newCode(), Math.max(0, code.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [code, where, newCode]);

  const download = async (os: "mac" | "win") => {
    setNote(null);
    // 置き場が外なら署名 URL を普通のリンクとして開く・手元なら中身を保存させる（D-128.153）
    const r = await getInstaller(os);
    if (!r.ok) {
      if (r.status === 401) return setProblem({ kind: "expired" });
      return setNote(errorText(r.code in CATALOG_IDS ? r.code : PAGE_ERROR.loadFailed).entry.message);
    }
    setNote("ダウンロードを始めました。入れて開くと、この画面が自分で気づきます");
  };

  // 外枠・第 2 ナビ・本文の箱と見出しの行は、どの状態でも同じ（中身だけを替える）
  const frame = (body: ReactNode) => (
    <TicketShell
      screen="bridge-setup"
      crumbs={[{ label: "自分の設定", disabled: true }, { label: "PC と使った量" }]}
      bridgeConnected={devices === null ? null : live !== null}
    >
      <div className="k-me-wrap">
        <MeSub current="bridge" />
        <section className="k-page k-me-page" aria-labelledby="connect-pc-title">
          <header className="k-page-head">
            {back ? (
              <a className="k-link" href={back}>
                戻る
              </a>
            ) : null}
            <h1 id="connect-pc-title">PC と使った量</h1>
            <p className="k-desc">分身はあなたの PC で動く。どのワークスペースの分身も同じ PC を使う</p>
          </header>
          {body}
        </section>
      </div>
    </TicketShell>
  );

  if (!ready) return frame(<Loading />);
  if (problem?.kind === "forbidden") return frame(<NoAccess acts={[back ?? "/"]} />);
  if (problem?.kind === "expired")
    return frame(<ErrorState code={PAGE_ERROR.sessionExpired} acts={[`/login?next=${encodeURIComponent(here)}`]} />);
  // PC の一覧を読み終えるまで（失敗の知らせが無いあいだ）は読み込み中
  if (devices === null && !problem) return frame(<Loading />);

  return frame(
    <>
      {live ? (
        <Callout tone="info" title="つながっています">
          {live.device_label ?? "この PC"}・最後に見えた {lastSeen(live.last_seen_at)}
          {live.version ? `・Bridge ${live.version}` : ""}
        </Callout>
      ) : waiting ? (
        <Callout tone="info" title="アプリからの返事を待っています…">
          {waiting.device_label ?? "この PC"}{" "}
          はつながりました。最初の知らせが届くと「つながっています」に変わります（つながっただけでは、まだ仕事は流れません）。
        </Callout>
      ) : asleep ? (
        <section aria-label="切れています" className="k-section">
          <Callout tone="warn" title="切れています">
            {errorText("E-CONN-001").entry.message}（{asleep.device_label ?? "この PC"}・最後に見えた{" "}
            {lastSeen(asleep.last_seen_at)}）
          </Callout>
          <Button variant="secondary" onClick={() => wake()}>
            Bridge を起こす
          </Button>
        </section>
      ) : null}

      {!live && where === "web" ? (
        <ol className="k-steps">
          <li>
            <h2>① 常駐アプリ（Bridge）を入れる</h2>
            <div className="k-row">
              <Button variant="outlined" onClick={() => void download("mac")}>
                Mac 用を受け取る
              </Button>
              <Button variant="outlined" onClick={() => void download("win")}>
                Windows 用を受け取る
              </Button>
            </div>
          </li>
          <li>
            <h2>② アプリにこのコードを入れる</h2>
            {code ? (
              <p className="k-code" aria-label="接続コード" data-testid="pairing-code">
                {code.code}
              </p>
            ) : null}
            <p className="k-desc">10 分・1 回だけ使えます。期限が来たら、この画面が自分で新しいコードに替えます。</p>
            <Button variant="secondary" loading={busy} onClick={() => void newCode()}>
              新しいコード
            </Button>
            {!waiting ? <p role="status">アプリからの返事を待っています…</p> : null}
          </li>
          <li>
            <h2>③ 試しに動かす</h2>
            <p className="k-desc">つながったら、自分の AI に話しかけて試せます。</p>
          </li>
        </ol>
      ) : null}

      {!live && where === "installed" ? (
        <section className="k-section" aria-label="この PC の Bridge">
          <p>
            この PC に Bridge が入っています（{bridge?.version ?? ""}）。コードを打たずに、ボタン 1 つでつなげます。
          </p>
          <Button loading={busy} onClick={() => void connectLocal(false)}>
            この PC の Bridge につなぐ
          </Button>
          {otherAccount ? (
            <Button variant="danger" onClick={() => void connectLocal(true)}>
              このアカウントに切り替える
            </Button>
          ) : null}
        </section>
      ) : null}

      {!live && where === "app" ? <p role="status">この PC の Bridge とつないでいます…</p> : null}

      {problem?.kind === "wait" ? (
        <Callout tone="warn" title="少し待ってください">
          続けて押されました。{problem.sec} 秒たってから、もう一度押してください。
        </Callout>
      ) : null}
      {problem?.kind === "code" ? <ErrorState code={problem.code} acts={[() => void newCode()]} /> : null}
      {note ? <p role="status">{note}</p> : null}

      {devices && devices.length ? (
        <section className="k-section" aria-label="つないでいる PC">
          <h2>つないでいる PC</h2>
          <ul>
            {devices.map((d) => (
              <li key={d.id}>
                {d.device_label ?? "この PC"}{" "}
                <Badge tone={d.state === "live" ? "success" : d.state === "asleep" ? "warning" : "neutral"}>
                  {d.state === "live"
                    ? "つながっています"
                    : d.state === "asleep"
                      ? "切れています"
                      : "返事を待っています"}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 前の画面への導線（D-128.164）：Claude Code を入れてログインする・AI が使うブラウザを選ぶ・端末を外すは、
          それぞれのチケット（K-89・K-90・K-91）が新しい画面へ移すまで前の画面にある */}
      <section className="k-section" aria-label="ほかの設定">
        <p className="k-desc">
          Claude Code を入れてログインする・AI が使うブラウザを選ぶ・PC を外すは、
          <a className="k-link" href={LEGACY}>
            前の設定の画面
          </a>
          で行えます。
        </p>
      </section>
    </>,
  );
}
