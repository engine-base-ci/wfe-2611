"use client";
// 「PC と使った量」の画面の状態と処理（K-349 で connect-pc.tsx から書いた順のまま移した）。
//   状態・effect・処理の順は移す前の ConnectPc と同じ。足したのは、受け取りに成功した所で onTaken を呼ぶ 1 行と、一覧を 1 回読み直す reload だけ
import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { getInstaller, pairViaLocal, useWhere } from "@/lib/bridge-presence";
import { pollDevices, type Device } from "./devices";
import type { Os } from "./connect-dialog";
import { codeWait } from "./code-wait";
import { canPairHere, pairHintsOf } from "./pair-device";
import { safeFrom } from "./safe-from";
import { CATALOG } from "@kaname/errors/catalog";

const CATALOG_IDS: Record<string, unknown> = CATALOG;

const SELF = "/setup/bridge";

type Code = { code: string; expiresAt: number };
export type Problem =
  { kind: "expired" } | { kind: "forbidden" } | { kind: "wait"; sec: number } | { kind: "code"; code: string };

export function useConnectPc(from: string | null, opts: { onTaken?: (os: Os) => void } = {}) {
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
  /** この端末に Bridge を入れられるか（K-373・開いたとき 1 回だけ読む・null＝まだ読んでいない）。読む所はここだけ（行の区画にも渡す） */
  const [pairable, setPairable] = useState<boolean | null>(null);
  useEffect(() => {
    setPairable(canPairHere(pairHintsOf(navigator)));
  }, []);

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
  //   Bridge の窓の中は開いた時点で自分でつながる。「あとで」と × で閉じたら、読み直しても開き直さない。
  //   Bridge を入れられない端末（スマホ・タブレット・K-373）では小窓を開かず、コードも作らない。見分けを読み終えてから決める
  useEffect(() => {
    if (!ready || autoTried.current || devices === null || where === "loading" || pairable === null) return;
    autoTried.current = true;
    if (where === "web" && !known) {
      if (!pairable) return;
      setDialogOpen(true);
      void newCode();
    } else if (where === "app" && !live) void connectLocal();
  }, [ready, where, devices, known, live, pairable, newCode, connectLocal]);

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
    opts.onTaken?.(os);
    setDialogNote("ダウンロードを始めました。入れて開くと、この画面が自分で気づきます");
  };

  // 一覧を 1 回だけ読み直す（K-349・後の葉が、PC を外した後などに呼ぶ）。失敗は何もしない（次の 5 秒の読みで追いつく）。時計は挟まない
  const reload = useCallback(async (): Promise<void> => {
    const r = await call("listMyDevices", { screenId: "bridge-setup" });
    if (r.ok) setDevices(r.data as unknown as Device[]);
  }, []);

  return {
    back,
    here,
    ready,
    where,
    bridge,
    code,
    busy,
    problem,
    dialogNote,
    note,
    received,
    otherAccount,
    devices,
    dialogOpen,
    live,
    /** 読むまでは true（描き直しの食い違いを出さない） */
    canPair: pairable ?? true,
    newCode,
    connectLocal,
    openDialog,
    closeDialog,
    setDialogOpen,
    download,
    reload,
  };
}
