"use client";
// PC をつなぐ（K-57・画面 bridge-setup・道 /setup/bridge）。キャンバスの EdPC（①常駐アプリを入れる ②アプリにこのコードを入れる ③試しに動かす）と MePC（つないでいる PC）。
//   出し分け（D-089）：①ブラウザで Bridge が入っていない＝受け取る道＋コード ②ブラウザで Bridge が入っている＝ボタン 1 つで渡す ③Bridge の窓の中＝開いた時点で自分でつながる
//   「つながっています」は、最初の生きている知らせが届いてから（D-090）。眠っていれば「切れています」（E-CONN-001）と起こすボタン
//   外枠（K-220・D-144.6）：新しい外枠（TicketShell）の中に、自分の設定の第 2 ナビ（MeSub）と本文の箱を並べる（キャンバス MePC）。どの状態も外枠の中に出す。
//     見出しはキャンバスどおり「PC と使った量」。左のメニューの PC の状態は、この画面が読み続ける一覧の答えを渡す（外枠は読み直さない）。
//     PC の一覧を読み終えるまでは、見出しの行の下に読み込み中（3 秒たっても終わらないときだけ文・D-144.8）
//   中身（K-230・キャンバス EdPC・MePC・MePCInstalled）：PC が無いときは開いた最初の 1 回だけ「PC をつなぐ」の小窓（580px・3 段・コードの箱）を開き、
//     つないだ PC は白いカードの行で出す（成功を青い知らせで出さない）。この PC に Bridge が入っていれば「この PC の Bridge」のカード
//   口は契約の口だけ（createPairingCode・listMyDevices・downloadBridgeRelease）。文言は正本（errors.json）から
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Callout, ErrorState, Loading, MeSub, NoAccess } from "@/components/k";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { getInstaller, pairViaLocal, useWhere, wake } from "@/lib/bridge-presence";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { pollDevices, type Device } from "./devices";
import { ConnectDialog, type Os } from "./connect-dialog";
import { codeWait } from "./code-wait";
import { PcList, ThisPcCard, Usage } from "./pc-cards";
import "./connect-pc.css";
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

export function ConnectPc({ from }: { from: string | null }) {
  const back = safeFrom(from);
  const here = back ? `${SELF}?from=${encodeURIComponent(back)}` : SELF;
  const [ready, setReady] = useState(false);
  const { where, bridge } = useWhere();
  const [code, setCode] = useState<Code | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  /** 小窓の中の知らせ（受け取りの結果）と、本文の知らせ（この PC の Bridge に渡した結果） */
  const [dialogNote, setDialogNote] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [received, setReceived] = useState(false);
  const [otherAccount, setOtherAccount] = useState(false);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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
  const known = devices?.some((d) => d.state === "live" || d.state === "asleep") ?? false;

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

  // 開いた最初の 1 回：ブラウザ（Bridge なし）で、つながっている・切れている PC が無ければ、つなぐ小窓を開いてコードを出す。
  //   Bridge の窓の中は開いた時点で自分でつながる。「あとで」と × で閉じたら、読み直しても開き直さない
  useEffect(() => {
    if (!ready || autoTried.current || devices === null || where === "loading") return;
    autoTried.current = true;
    if (where === "web" && !known) {
      setDialogOpen(true);
      void newCode();
    } else if (where === "app" && !live) void connectLocal();
  }, [ready, where, devices, known, live, newCode, connectLocal]);

  // 小窓を閉じたら（「あとで」・×・Esc・つながって自分で閉じた）コードを消す。閉じている間は使える鍵を作らない
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setCode(null);
  }, []);

  // つながった・この PC で Bridge が見つかったら、小窓は自分で閉じる（後ろの「つながっています」・この PC の Bridge のカードに戻る）
  useEffect(() => {
    if (dialogOpen && (live || where === "installed" || where === "app")) closeDialog();
  }, [dialogOpen, live, where, closeDialog]);

  // 期限が来たら、画面が自分で新しいコードに替える（10 分・1 回だけ）。替えるのは小窓が開いている間だけ。
  //   待ちは setTimeout の上限で頭打ち（口が遠い期限を返しても、すぐ取り直しを繰り返さない）
  useEffect(() => {
    if (!code || !dialogOpen || where !== "web") return;
    const t = setTimeout(() => void newCode(), codeWait(code.expiresAt, Date.now()));
    return () => clearTimeout(t);
  }, [code, dialogOpen, where, newCode]);

  // 開き直したら、前のコードを出さずに新しいコードを取る
  const openDialog = () => {
    setCode(null);
    setDialogOpen(true);
    void newCode();
  };

  const download = async (os: Os) => {
    setDialogNote(null);
    // 置き場が外なら署名 URL を普通のリンクとして開く・手元なら中身を保存させる（D-128.153）
    const r = await getInstaller(os);
    if (!r.ok) {
      if (r.status === 401) return setProblem({ kind: "expired" });
      return setDialogNote(errorText(r.code in CATALOG_IDS ? r.code : PAGE_ERROR.loadFailed).entry.message);
    }
    // 受け取りに成功したときだけ 1 段目を済にする（失敗で ✓ にしない）
    setReceived(true);
    setDialogNote("ダウンロードを始めました。入れて開くと、この画面が自分で気づきます");
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
              <a className="k-link" href={back} data-act="back">
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

  const installed = !live && where === "installed";
  const problemNote =
    problem?.kind === "wait" ? (
      <Callout tone="warn" title="少し待ってください">
        続けて押されました。{problem.sec} 秒たってから、もう一度押してください。
      </Callout>
    ) : problem?.kind === "code" ? (
      <ErrorState code={problem.code} acts={[() => void newCode()]} />
    ) : null;

  return frame(
    <>
      {installed ? (
        <ThisPcCard
          version={bridge?.version ?? null}
          busy={busy}
          otherAccount={otherAccount}
          onConnect={() => void connectLocal(false)}
          onSwitch={() => void connectLocal(true)}
        />
      ) : null}
      {!live && where === "app" ? <p role="status">この PC の Bridge とつないでいます…</p> : null}
      {/* 小窓の外の失敗（この PC の Bridge に渡すとき）は本文に出す */}
      {!dialogOpen ? problemNote : null}

      <PcList devices={devices ?? []} onAdd={installed ? undefined : openDialog} onWake={() => wake()} />
      {live ? <Usage /> : null}

      {/* 前の画面への導線（D-128.164）：Claude Code を入れてログインする・AI が使うブラウザを選ぶ・端末を外すは、
          それぞれのチケット（K-89・K-90・K-91）が新しい画面へ移すまで前の画面にある */}
      <p className="k-pc-legacy">
        Claude Code を入れてログインする・AI が使うブラウザを選ぶ・PC を外すは、
        <a className="k-link" href={LEGACY} data-act="legacy">
          前の設定の画面
        </a>
        で行えます。
      </p>
      {note ? (
        <p role="status" className="k-pc-note">
          {note}
        </p>
      ) : null}

      <ConnectDialog
        open={dialogOpen && where === "web"}
        onOpenChange={(o) => (o ? setDialogOpen(true) : closeDialog())}
        code={code?.code ?? null}
        busy={busy}
        received={received}
        onTake={(os) => void download(os)}
        onNewCode={() => void newCode()}
        notice={
          <>
            {problemNote}
            {dialogNote ? (
              <p role="status" className="k-pc-dialog-note">
                {dialogNote}
              </p>
            ) : null}
          </>
        }
      />
    </>,
  );
}
