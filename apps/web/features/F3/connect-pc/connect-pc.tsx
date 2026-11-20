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
//   区画（K-349）：状態と処理は use-connect-pc.ts・外枠は pc-frame.tsx・本文の下は pc-foot.tsx・行と小窓に差す物は pc-row-extra.tsx・pc-row-more.tsx・take-help.tsx。ここは並べるだけ
import { Callout, ErrorState, Loading, NoAccess } from "@/components/k";
import { PAGE_ERROR } from "@/components/k/error-of";
import { wake } from "@/lib/bridge-presence";
import { waitText } from "@/features/F1/sign-up/wait-text";
import { ConnectDialog } from "./connect-dialog";
import { PcList, ThisPcCard, Usage } from "./pc-cards";
import { PcFrame } from "./pc-frame";
import { PcFoot } from "./pc-foot";
import { usePcRowExtra } from "./pc-row-extra";
import { usePcRowMore } from "./pc-row-more";
import { useTakeHelp } from "./take-help";
import { useConnectPc } from "./use-connect-pc";
import "./connect-pc.css";

export { safeFrom } from "./safe-from";

export function ConnectPc({ from }: { from: string | null }) {
  const takeHelp = useTakeHelp();
  const s = useConnectPc(from, { onTaken: takeHelp.onTaken });
  const rowExtra = usePcRowExtra({ devices: s.devices ?? [], where: s.where, bridge: s.bridge, reload: s.reload });
  const rowMore = usePcRowMore({ reload: s.reload });

  if (!s.ready)
    return (
      <PcFrame back={s.back} bridgeConnected={s.devices === null ? null : s.live !== null}>
        <Loading />
      </PcFrame>
    );
  if (s.problem?.kind === "forbidden")
    return (
      <PcFrame back={s.back} bridgeConnected={s.devices === null ? null : s.live !== null}>
        <NoAccess acts={[s.back ?? "/"]} />
      </PcFrame>
    );
  if (s.problem?.kind === "expired")
    return (
      <PcFrame back={s.back} bridgeConnected={s.devices === null ? null : s.live !== null}>
        <ErrorState code={PAGE_ERROR.sessionExpired} acts={[`/login?next=${encodeURIComponent(s.here)}`]} />
      </PcFrame>
    );
  // PC の一覧を読み終えるまで（失敗の知らせが無いあいだ）は読み込み中
  if (s.devices === null && !s.problem)
    return (
      <PcFrame back={s.back} bridgeConnected={s.devices === null ? null : s.live !== null}>
        <Loading />
      </PcFrame>
    );

  const installed = !s.live && s.where === "installed";
  const problemNote =
    s.problem?.kind === "wait" ? (
      <Callout tone="warn" title="少し待ってください">
        {waitText(s.problem.sec)}
      </Callout>
    ) : s.problem?.kind === "code" ? (
      <ErrorState code={s.problem.code} acts={[() => void s.newCode()]} />
    ) : null;

  return (
    <PcFrame back={s.back} bridgeConnected={s.devices === null ? null : s.live !== null}>
      {installed ? (
        <ThisPcCard
          version={s.bridge?.version ?? null}
          busy={s.busy}
          otherAccount={s.otherAccount}
          onConnect={() => void s.connectLocal(false)}
          onSwitch={() => void s.connectLocal(true)}
        />
      ) : null}
      {!s.live && s.where === "app" ? <p role="status">この PC の Bridge とつないでいます…</p> : null}
      {/* 小窓の外の失敗（この PC の Bridge に渡すとき）は本文に出す */}
      {!s.dialogOpen ? problemNote : null}

      {/* 行が消えた後も出す物（K-363 の帯など）は、つないでいる PC のカードのすぐ上（K-349・pc-row-more.tsx） */}
      {rowMore.above}
      <PcList
        devices={s.devices ?? []}
        onAdd={installed ? undefined : s.openDialog}
        onWake={() => wake()}
        renderExtra={rowExtra}
        renderMore={rowMore.more}
      />
      {s.live ? <Usage /> : null}

      <PcFoot note={s.note} />

      <ConnectDialog
        open={s.dialogOpen && s.where === "web"}
        onOpenChange={(o) => (o ? s.setDialogOpen(true) : s.closeDialog())}
        code={s.code?.code ?? null}
        busy={s.busy}
        received={s.received}
        onTake={(os) => void s.download(os)}
        onNewCode={() => void s.newCode()}
        notice={
          <>
            {problemNote}
            {s.dialogNote ? (
              <p role="status" className="k-pc-dialog-note">
                {s.dialogNote}
              </p>
            ) : null}
          </>
        }
        takeHelp={takeHelp.node}
      />
    </PcFrame>
  );
}
