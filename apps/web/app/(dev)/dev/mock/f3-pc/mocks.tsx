"use client";
// 段 4 の「PC と使った量」の PC の行に足す部品の下絵（部品先行・枝 c/段4）。本番と同じ部品（features/F3/connect-pc/pc-row-parts.tsx・components/k）を、決めた値で並べる。
//   1 つの id ＝ 1 つの状態。チケット：K-361（Claude Code）・K-373（スマホ）・K-368（AI が使うブラウザ）・K-363（PC を外す）・K-374（OS の警告の越え方）・K-375（Bridge を入れ直す）
//   行（MockRow）は pc-cards.tsx の Row と同じクラスと並び。本番では K-361 が PcList に作る差す所（renderExtra）に部品が入り、
//   「…」は K-363 が PcMoreMenu に替える。下絵では今の Row を変えないので、ここで同じ形を組む
//   pc-phone（代表の決め 2026-11-19）：スマホ（Bridge を入れられない端末）で開いた画面。「＋ PC をつなぐ」は押せない形で、すぐ下に理由。行の操作（ブラウザを選ぶ・「…」）は使える
//   本番（connect-pc.tsx・pc-cards.tsx の PcList）と同じ並び（2026-11-19 下絵の OK の形に合わせた）：
//     ・見出しの行の「＋ PC をつなぐ」は、つながっている PC があれば出す（本番は onAdd があれば出す）
//     ・眠っている行は直し方の箱の中に「Bridge を起こす」
//     ・AI が使うブラウザを選ぶ欄は PC ごとにいつも出す（代表の答え A-2）。Claude Code が無い・ログインしていない行には出さない（A-3）
//   代表の答え answer=7cf148a79dc9（2026-11-19）で足した 7 つ：
//     pc-os-warning*（K-374）… つなぐ小窓（ConnectDialog）の受け取る段に、受け取った後だけ OS の警告の越え方（OsWarning）。受け取る前の小窓は今の絵（キャンバス EdPC）のまま
//     pc-bridge-*（K-375）… Bridge が古い PC の行は、入れ直す区画（BridgeReinstall）だけを出す（先に直す物だけ・A-3 と同じ考え）。スマホでは受け取るボタンを出さず開く場所だけ
import type { ReactNode } from "react";
import { Button, Shell, MeSub, Toaster, Callout } from "@/components/k";
import { errorText } from "@/components/k/error-of";
import "@/features/F3/connect-pc/connect-pc.css";
import { ConnectDialog, type Os } from "@/features/F3/connect-pc/connect-dialog";
import {
  AddPcButton,
  AddPcReason,
  BridgeReinstall,
  BrowserChoice,
  BrowserFix,
  ClaudeCodeFix,
  OsWarning,
  PcMoreMenu,
  REMOVED_PC_TEXT,
  REMOVE_PC_STEP_UP_REASON,
  RemovePcConfirm,
  type AgentBrowser,
} from "@/features/F3/connect-pc/pc-row-parts";
import { StepUpDialog } from "@/features/F1/security/views";
import type { Theme } from "@/lib/theme";

export interface MockEntry {
  id: string;
  screen: "bridge-setup";
  label: string;
  ticket: string;
}

export const MOCKS: readonly MockEntry[] = [
  {
    id: "pc-claude-missing",
    screen: "bridge-setup",
    label: "Claude Code が入っていない（この PC）",
    ticket: "K-361 UI-001",
  },
  { id: "pc-claude-installing", screen: "bridge-setup", label: "Claude Code を入れている途中", ticket: "K-361 UI-002" },
  { id: "pc-claude-install-error", screen: "bridge-setup", label: "入れられなかった", ticket: "K-361 UI-004・017" },
  {
    id: "pc-claude-broken",
    screen: "bridge-setup",
    label: "本体が落ちてきていない（取り直す）",
    ticket: "K-361 UI-003",
  },
  { id: "pc-claude-login", screen: "bridge-setup", label: "ログインしていない", ticket: "K-361 UI-005" },
  {
    id: "pc-claude-code",
    screen: "bridge-setup",
    label: "ログインの途中：入口とコードの欄",
    ticket: "K-361 UI-005・008",
  },
  { id: "pc-claude-code-error", screen: "bridge-setup", label: "コードが違った", ticket: "K-361 UI-007" },
  { id: "pc-claude-done", screen: "bridge-setup", label: "ログインできた", ticket: "K-361 UI-006" },
  {
    id: "pc-claude-other-device",
    screen: "bridge-setup",
    label: "ほかの PC の行：理由と開く場所だけ",
    ticket: "K-361 UI-010・011・014",
  },
  { id: "pc-asleep", screen: "bridge-setup", label: "眠っている PC：報告の時刻", ticket: "K-361 UI-012" },
  {
    id: "pc-browser-pick",
    screen: "bridge-setup",
    label: "AI が使うブラウザを選ぶ（自分の Chrome・既定）",
    ticket: "K-90 画面 UI-002",
  },
  { id: "pc-browser-saved", screen: "bridge-setup", label: "選んだ：変えました", ticket: "K-90 画面 UI-003" },
  {
    id: "pc-browser-fix",
    screen: "bridge-setup",
    label: "Chrome とつながらない：その場の一手",
    ticket: "K-90 画面 UI-010",
  },
  { id: "pc-browser-checking", screen: "bridge-setup", label: "もう一度確かめている", ticket: "K-90 画面 UI-011・015" },
  { id: "pc-browser-ok", screen: "bridge-setup", label: "確かめた：つながった", ticket: "K-90 画面 UI-011" },
  {
    id: "pc-browser-still",
    screen: "bridge-setup",
    label: "確かめた：まだつながっていない",
    ticket: "K-90 画面 UI-012",
  },
  {
    id: "pc-browser-timeout",
    screen: "bridge-setup",
    label: "確かめた：結果が返ってこない",
    ticket: "K-90 画面 UI-013",
  },
  {
    id: "pc-browser-asleep",
    screen: "bridge-setup",
    label: "眠っている PC で確かめた",
    ticket: "K-90 画面 UI-014・K-365 API-004",
  },
  { id: "pc-menu", screen: "bridge-setup", label: "行の「…」：この PC を外す", ticket: "K-363 UI-001" },
  { id: "pc-remove", screen: "bridge-setup", label: "外す確かめの小窓", ticket: "K-363 UI-002" },
  { id: "pc-remove-stepup", screen: "bridge-setup", label: "外す前の本人確認の取り直し", ticket: "K-363 UI-006" },
  { id: "pc-removed", screen: "bridge-setup", label: "外した", ticket: "K-363 UI-004" },
  {
    id: "pc-remove-error",
    screen: "bridge-setup",
    label: "外せなかった（Kaname の調子が悪い）",
    ticket: "K-363 UI-012",
  },
  {
    id: "pc-phone",
    screen: "bridge-setup",
    label: "スマホで開いた：PC をつなぐは押せず理由の 1 行・行の操作は使える",
    ticket: "K-373",
  },
  {
    id: "pc-os-warning",
    screen: "bridge-setup",
    label: "つなぐ小窓：Mac 用を受け取った後（越え方は閉じた形）",
    ticket: "K-374",
  },
  { id: "pc-os-warning-mac", screen: "bridge-setup", label: "つなぐ小窓：Mac の越え方を開いた", ticket: "K-374" },
  {
    id: "pc-os-warning-win",
    screen: "bridge-setup",
    label: "つなぐ小窓：Windows の越え方を開いた",
    ticket: "K-374",
  },
  { id: "pc-bridge-outdated", screen: "bridge-setup", label: "Bridge が古い：入れ直す一手", ticket: "K-375" },
  {
    id: "pc-bridge-reinstalling",
    screen: "bridge-setup",
    label: "入れ直し：Mac 用を受け取った（越え方つき）",
    ticket: "K-375",
  },
  {
    id: "pc-bridge-reinstall-error",
    screen: "bridge-setup",
    label: "入れ直し：受け取れなかった（まだ配布していない）",
    ticket: "K-375",
  },
  {
    id: "pc-bridge-outdated-phone",
    screen: "bridge-setup",
    label: "Bridge が古い：スマホで開いた（開く場所だけ）",
    ticket: "K-375",
  },
];

interface MockPc {
  id: string;
  name: string;
  state: "live" | "asleep";
  detail: string;
}
const MAC: MockPc = {
  id: "d1",
  name: "高本の MacBook",
  state: "live",
  detail: "11/02 につないだ ・ Kaname の常駐アプリ v0.9.4",
};
const MINI: MockPc = { id: "d2", name: "事務所の Mac mini", state: "asleep", detail: "最後に見えた 11/15 09:02" };
/** 生きているほかの PC の行（ほかの PC の今の報告を出す状態で使う。眠っている行は報告の時刻を出す・pc-asleep） */
const MINI_LIVE: MockPc = { ...MINI, state: "live", detail: "10/28 につないだ ・ Kaname の常駐アプリ v0.9.4" };

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

/** pc-cards.tsx の Row と同じ形（切れている行の直し方の箱も同じ文）。extra が差す所、more が「…」 */
function MockRow({ pc, first, extra, more }: { pc: MockPc; first: boolean; extra?: ReactNode; more?: ReactNode }) {
  const pill =
    pc.state === "live" ? (
      <span className="k-pc-pill" data-tone="success">
        つながっている
      </span>
    ) : (
      <span className="k-pc-pill" data-tone="warning">
        切れている
      </span>
    );
  return (
    <li className="k-pc-row" data-state={pc.state} data-device={pc.id}>
      <PcIcon />
      <section className="k-pc-main" aria-label={pc.name}>
        <span className="k-pc-name">
          <span className="k-pc-label">{pc.name}</span> {pill}
          {first ? (
            <>
              {" "}
              <span className="k-pc-pill k-pc-pill-off" data-tone="neutral" aria-disabled="true">
                いつも使う
              </span>
            </>
          ) : null}
        </span>
        <span className="k-pc-detail">{pc.detail}</span>
        {pc.state === "asleep" ? (
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
            <Button variant="outlined" className="k-pc-btn k-pc-wake" data-act="wake">
              Bridge を起こす
            </Button>
          </span>
        ) : null}
        {extra}
      </section>
      {more ?? (
        <button
          type="button"
          className="k-pc-more"
          aria-disabled="true"
          tabIndex={-1}
          aria-label={`…（${pc.name} の操作）`}
        >
          …
        </button>
      )}
    </li>
  );
}

interface RowSpec {
  pc: MockPc;
  extra?: ReactNode;
  more?: ReactNode;
}

/** add：見出しの行の「＋ PC をつなぐ」。既定は本番と同じで、つながっている PC があれば押せる形で出す。canPair＝false で押せない形と理由 */
function Page({
  theme,
  rows,
  above,
  dialog,
  add,
}: {
  theme: Theme;
  rows: readonly RowSpec[];
  above?: ReactNode;
  dialog?: ReactNode;
  add?: { canPair: boolean };
}) {
  const addPc = add ?? (rows.some((r) => r.pc.state === "live") ? { canPair: true } : null);
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="bridge-setup"
        crumbs={[{ label: "自分の設定", disabled: true }, { label: "PC と使った量" }]}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: "高本", initial: "高" }}
        bridgeConnected
        theme={theme}
      >
        <div className="k-me-wrap">
          <MeSub current="bridge" />
          <section className="k-page k-me-page" aria-labelledby="connect-pc-title">
            <header className="k-page-head">
              <h1 id="connect-pc-title">PC と使った量</h1>
              <p className="k-desc">分身はあなたの PC で動く。どのワークスペースの分身も同じ PC を使う</p>
            </header>
            {above}
            <section className="k-pc-card" aria-labelledby="pc-list-title">
              <div className="k-pc-card-head">
                <h2 id="pc-list-title">つないでいる PC</h2>
                {addPc ? <AddPcButton canPair={addPc.canPair} /> : null}
              </div>
              {addPc ? <AddPcReason canPair={addPc.canPair} /> : null}
              {rows.length ? (
                <ul className="k-pc-list">
                  {rows.map((r, i) => (
                    <MockRow key={r.pc.id} pc={r.pc} first={i === 0} extra={r.extra} more={r.more} />
                  ))}
                </ul>
              ) : (
                <p className="k-pc-empty">まだありません</p>
              )}
            </section>
          </section>
        </div>
      </Shell>
      {dialog}
    </Toaster>
  );
}

const LOGIN_URL = "https://claude.ai/oauth/authorize?code=true&state=K361STATE";
const pick = (value: AgentBrowser = "chrome", note?: { tone: "ok" | "danger"; text: string }) => (
  <BrowserChoice deviceId={MAC.id} value={value} note={note ?? null} />
);
/** 2 行目（事務所の Mac mini）の選ぶ欄。Claude Code に足りない物が無い行は、どの状態でも選ぶ欄を出す（A-2） */
const miniPick = <BrowserChoice deviceId={MINI.id} value="chrome" />;
const withFix = (fix: ReactNode) => (
  <>
    {pick()}
    {fix}
  </>
);
const menu = (open = false) => <PcMoreMenu name={MAC.name} defaultOpen={open} />;
/** Bridge が古い PC（約束の版より前の v0.8.1）。行の補足の版も古い */
const OLD_MAC: MockPc = { ...MAC, detail: "11/02 につないだ ・ Kaname の常駐アプリ v0.8.1" };
/** 接続コード（モックの決めた値・本物のコードではない） */
const MOCK_CODE = "K7Q2MX";

/** つなぐ小窓（本番の ConnectDialog）を、受け取った後の形で開く。越え方は受け取った OS の分だけ（K-374） */
function connectDialog(os: Os, open: boolean) {
  return (
    <ConnectDialog
      open
      onOpenChange={() => undefined}
      code={MOCK_CODE}
      busy={false}
      received
      onTake={() => undefined}
      onNewCode={() => undefined}
      takeHelp={<OsWarning os={os} defaultOpen={open} />}
      notice={
        <p role="status" className="k-pc-dialog-note">
          ダウンロードを始めました。入れて開くと、この画面が自分で気づきます
        </p>
      }
    />
  );
}

export function MockView({ id, theme }: { id: string; theme: Theme }) {
  const one = (extra: ReactNode, more?: ReactNode) => (
    <Page
      theme={theme}
      rows={[
        { pc: MAC, extra, more },
        { pc: MINI, extra: miniPick },
      ]}
    />
  );
  switch (id) {
    case "pc-claude-missing":
      return one(<ClaudeCodeFix fix="install" mine />);
    case "pc-claude-installing":
      return one(<ClaudeCodeFix fix="install" mine busy progress="Claude Code を入れています（1〜2 分）" />);
    case "pc-claude-install-error":
      return one(
        <ClaudeCodeFix
          fix="install"
          mine
          error="この PC の Bridge に届きませんでした。Bridge が開いているか確かめてから、もう一度押してください"
        />,
      );
    case "pc-claude-broken":
      return one(<ClaudeCodeFix fix="repair" mine />);
    case "pc-claude-login":
      return one(<ClaudeCodeFix fix="login" mine />);
    case "pc-claude-code":
      return one(<ClaudeCodeFix fix="login" mine login={{ url: LOGIN_URL, code: "" }} />);
    case "pc-claude-code-error":
      return one(
        <ClaudeCodeFix
          fix="login"
          mine
          login={{ url: LOGIN_URL, code: "K361-BAD-CODE" }}
          error="ログインできませんでした（OAuth error）。コードを貼り直してください"
        />,
      );
    case "pc-claude-done":
      return one(
        <>
          {pick()}
          <p className="k-pc-part-note" data-tone="ok" role="status">
            ログインできました。これで仕事を渡せます
          </p>
        </>,
      );
    case "pc-claude-other-device":
      return (
        <Page
          theme={theme}
          rows={[
            { pc: MAC, extra: pick() },
            { pc: MINI_LIVE, extra: <ClaudeCodeFix fix="install" mine={false} /> },
          ]}
        />
      );
    case "pc-asleep":
      return (
        <Page
          theme={theme}
          rows={[
            { pc: MAC, extra: pick() },
            { pc: MINI, extra: <ClaudeCodeFix fix="install" mine={false} reportedAt="11/15 09:00" /> },
          ]}
        />
      );
    case "pc-browser-pick":
      return one(pick());
    case "pc-browser-saved":
      return one(pick("dedicated", { tone: "ok", text: "変えました。次の仕事から使います" }));
    case "pc-browser-fix":
      return one(withFix(<BrowserFix openSteps />));
    case "pc-browser-checking":
      return one(withFix(<BrowserFix checking />));
    case "pc-browser-ok":
      return one(pick("chrome", { tone: "ok", text: "つながりました。AI は Chrome を使えます" }));
    case "pc-browser-still":
      return one(
        withFix(
          <BrowserFix
            result={{ tone: "danger", text: "まだつながっていません。上の手順を見直してから、もう一度押してください" }}
          />,
        ),
      );
    case "pc-browser-timeout":
      return one(
        withFix(
          <BrowserFix
            result={{ tone: "danger", text: "結果が返ってきませんでした。PC の Bridge が動いているか確かめてください" }}
          />,
        ),
      );
    case "pc-browser-asleep":
      return (
        <Page
          theme={theme}
          rows={[
            { pc: MAC, extra: pick() },
            {
              pc: MINI,
              extra: (
                <>
                  <BrowserChoice deviceId={MINI.id} value="chrome" />
                  <BrowserFix
                    result={{
                      tone: "danger",
                      text: "PC の Bridge が動いていないので確かめられません。Bridge を起こしてから押してください",
                    }}
                  />
                </>
              ),
            },
          ]}
        />
      );
    case "pc-menu":
      return one(pick(), menu(true));
    case "pc-remove":
      return (
        <Page
          theme={theme}
          rows={[
            { pc: MAC, extra: pick(), more: menu() },
            { pc: MINI, extra: miniPick, more: <PcMoreMenu name={MINI.name} /> },
          ]}
          dialog={<RemovePcConfirm open name={MAC.name} onOpenChange={() => undefined} onConfirm={() => undefined} />}
        />
      );
    case "pc-remove-stepup":
      return (
        <Page
          theme={theme}
          rows={[
            { pc: MAC, extra: pick(), more: menu() },
            { pc: MINI, extra: miniPick, more: <PcMoreMenu name={MINI.name} /> },
          ]}
          dialog={<StepUpDialog open reason={REMOVE_PC_STEP_UP_REASON} withCode={false} />}
        />
      );
    case "pc-removed":
      return (
        <Page
          theme={theme}
          rows={[{ pc: MINI, extra: miniPick, more: <PcMoreMenu name={MINI.name} /> }]}
          above={<Callout tone="info">{REMOVED_PC_TEXT}</Callout>}
        />
      );
    case "pc-remove-error":
      return (
        <Page
          theme={theme}
          rows={[
            { pc: MAC, extra: pick(), more: menu() },
            { pc: MINI, extra: miniPick, more: <PcMoreMenu name={MINI.name} /> },
          ]}
          above={<Callout tone="danger">{errorText("E-PAGE-003").entry.message}</Callout>}
        />
      );
    case "pc-phone":
      return (
        <Page
          theme={theme}
          add={{ canPair: false }}
          rows={[
            // 1 行目はログイン済み（選ぶ欄と「…」が使える）、2 行目はログインしていない（A-3：選ぶ欄は出さず、PC で開く場所だけ）。
            //   2 行目は生きている行（今の報告なので報告の時刻は出さない。眠っている行なら報告の時刻が要る・2 回目の精査 K-373）
            { pc: MAC, extra: pick(), more: menu() },
            {
              pc: MINI_LIVE,
              extra: <ClaudeCodeFix fix="login" mine={false} />,
              more: <PcMoreMenu name={MINI_LIVE.name} />,
            },
          ]}
        />
      );
    case "pc-os-warning":
    case "pc-os-warning-mac":
    case "pc-os-warning-win":
      // はじめて開いた人（つないだ PC が無い）：本番は小窓を自分で開く。後ろの一覧は空で「＋ PC をつなぐ」
      return (
        <Page
          theme={theme}
          add={{ canPair: true }}
          rows={[]}
          dialog={connectDialog(id === "pc-os-warning-win" ? "win" : "mac", id !== "pc-os-warning")}
        />
      );
    case "pc-bridge-outdated":
      return (
        <Page
          theme={theme}
          rows={[
            { pc: OLD_MAC, extra: <BridgeReinstall canInstall />, more: menu() },
            { pc: MINI, extra: miniPick },
          ]}
        />
      );
    case "pc-bridge-reinstalling":
      return (
        <Page
          theme={theme}
          rows={[
            { pc: OLD_MAC, extra: <BridgeReinstall canInstall taken="mac" />, more: menu() },
            { pc: MINI, extra: miniPick },
          ]}
        />
      );
    case "pc-bridge-reinstall-error":
      return (
        <Page
          theme={theme}
          rows={[
            {
              pc: OLD_MAC,
              extra: <BridgeReinstall canInstall error={errorText("E-CONN-014").entry.message} />,
              more: menu(),
            },
            { pc: MINI, extra: miniPick },
          ]}
        />
      );
    case "pc-bridge-outdated-phone":
      return (
        <Page
          theme={theme}
          add={{ canPair: false }}
          rows={[
            { pc: OLD_MAC, extra: <BridgeReinstall canInstall={false} />, more: menu() },
            { pc: MINI, extra: miniPick, more: <PcMoreMenu name={MINI.name} /> },
          ]}
        />
      );
    default:
      return <p>この状態はありません：{id}</p>;
  }
}
