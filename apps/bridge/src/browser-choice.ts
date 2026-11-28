// Bridge の窓で選んだ「AI が使うブラウザ」を Kaname に送る（K-366・POST /api/v1/bridge/browser）。
//   Kaname が正本（D-120.1）。窓の値を変えるのは Kaname が受けた後だけ（呼ぶ側の main.ts が ok のときだけ書く）。
//   electron を読まずに試せるよう、窓の ipc（main.ts の bridge:set-browser）から外に出した（pairing.ts の claimCode と同じ形）
import { BRIDGE_UA } from "./pairing";

/** 選べる値（Kaname の sessions.browser と同じ 3 つ） */
export const CHOOSABLE_BROWSERS = ["chrome", "dedicated", "off"] as const;
export type ChoiceReply = { ok: true } | { ok: false; message?: string };

/** Kaname に届くまで待つ時間（窓を長く止めない） */
const TIMEOUT_MS = 5_000;

export async function chooseBrowserOnKaname(
  apiBase: string,
  token: string | null | undefined,
  browser: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ChoiceReply> {
  if (!(CHOOSABLE_BROWSERS as readonly string[]).includes(browser)) return { ok: false };
  if (!token) return { ok: false, message: "Kaname につないでから選んでください" };
  let status: number;
  try {
    const r = await fetchImpl(`${apiBase}/api/v1/bridge/browser`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-session": token, "user-agent": BRIDGE_UA },
      body: JSON.stringify({ browser }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = r.status;
  } catch {
    return { ok: false, message: "Kaname に届きませんでした" };
  }
  if (status >= 200 && status < 300) return { ok: true };
  if (status === 401) return { ok: false, message: "この PC のつながりが切れています。つなぎ直してください" };
  return { ok: false, message: `Kaname に届きませんでした（${status}）` };
}
