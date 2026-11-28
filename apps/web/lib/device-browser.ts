// PC ごとの「AI が使うブラウザ」の口の呼び手（K-368）。PC の画面の行と会話の 1 行の一手が同じ処理を使う（L-008：同じ処理は 1 つ）。
//   口は契約の updateMyDevice（K-364）・checkMyDeviceBrowser（K-365）・listMyDevices。人に宛てる前の道すじは使わない
import { CATALOG } from "@kaname/errors/catalog";
import { call, type CallErr } from "@/lib/api/call";
import { errorText, PAGE_ERROR } from "@/components/k/error-of";
import { waitText } from "@/features/F1/sign-up/wait-text";

/** 自己診断の Chrome の行の名前（apps/bridge/src/browser.ts の browserCheck と同じ） */
export const CHROME_CHECK = "AI が Chrome を使える（Claude in Chrome）";

/** 確かめる仕事の結果を待つ上限（Claude Code の起動と Chrome への接続で 10〜40 秒） */
export const CHECK_WAIT_MS = 90_000;
export const CHECK_POLL_MS = 2_000;

export type AgentBrowserValue = "chrome" | "dedicated" | "off";

interface ListedDevice {
  id: string;
  state?: string;
  health?: unknown;
  health_at?: string | null;
}

export type CheckOutcome = { kind: "ok" } | { kind: "still" } | { kind: "timeout" } | { kind: "error"; err: CallErr };

/** その PC の使うブラウザを選ぶ。口の答えをそのまま返す（失敗の文は呼ぶ側が目録から引く） */
export function setDeviceBrowser(id: string, browser: AgentBrowserValue, screenId: string) {
  return call("updateMyDevice", { params: { id }, body: { browser }, screenId });
}

const chromeRow = (health: unknown): { ok?: boolean; detail?: string } | undefined =>
  Array.isArray(health)
    ? (health as { name?: string; ok?: boolean; detail?: string }[]).find((h) => h?.name === CHROME_CHECK)
    : undefined;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * その PC に「Chrome を使えるか」の確かめを頼み、自己診断が新しくなるのを待って結果を返す。
 * 待つのは 1 回の確かめにつき 1 本・上限は時刻で切る（固定の回数にしない）。「まだ使っていません」は結果に数えない。
 */
export async function checkDeviceBrowser(
  id: string,
  before: string | null | undefined,
  screenId: string,
): Promise<CheckOutcome> {
  const r = await call("checkMyDeviceBrowser", { params: { id }, body: {}, screenId });
  if (!r.ok) return { kind: "error", err: r };
  const until = Date.now() + CHECK_WAIT_MS;
  while (Date.now() < until) {
    await sleep(CHECK_POLL_MS);
    const l = await call("listMyDevices", { screenId });
    if (!l.ok) {
      if (l.kind === "unauthenticated") return { kind: "error", err: l };
      continue; // ほかの失敗は数えずに読み続ける
    }
    const row = (l.data as unknown as ListedDevice[]).find((d) => d.id === id);
    if (!row || (row.health_at ?? null) === (before ?? null)) continue;
    const c = chromeRow(row.health);
    if (!c || /まだ使っていません/.test(c.detail ?? "")) continue;
    return c.ok === true ? { kind: "ok" } : { kind: "still" };
  }
  return { kind: "timeout" };
}

/** 会話の一手が宛てる PC：一覧の最初の生きている PC（無ければ最初の行・どちらも無ければ null）。読めなければ err */
export async function firstDevice(
  screenId: string,
): Promise<{ device: { id: string; health_at: string | null } | null } | { err: CallErr }> {
  const l = await call("listMyDevices", { screenId });
  if (!l.ok) return { err: l };
  const rows = l.data as unknown as ListedDevice[];
  const d = rows.find((x) => x.state === "live") ?? rows[0];
  return { device: d ? { id: d.id, health_at: d.health_at ?? null } : null };
}

/** 口の失敗の文（目録から引く）：404＝E-PAGE-001・429＝待つ秒の文・目録にある 409 などはその文・ほかは E-PAGE-003。401 は入り直しなので呼ばない */
export function deviceBrowserErrorText(e: CallErr): string {
  if (e.kind === "not_found") return errorText(PAGE_ERROR.notFound).entry.message;
  if (e.kind === "rate_limited") return waitText(e.retryAfterSec);
  if (e.code in CATALOG) return errorText(e.code).entry.message;
  return errorText(PAGE_ERROR.down).entry.message;
}
