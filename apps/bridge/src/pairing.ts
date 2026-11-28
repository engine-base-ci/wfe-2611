// PC をつなぐ（K-57）の Bridge 側の小さな決まり。引き取りの返事の読み方と、Kaname に名乗る印・この PC の印（machine_id）・PC の名前の既定
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { version as VERSION } from "../package.json";

/** Kaname に名乗る印（端末が変わったかの判定に使う・D-128.120）。版が上がっても「Bridge／OS」は変わらない */
export const BRIDGE_UA = `Kaname-Bridge/${VERSION} (${process.platform === "darwin" ? "Macintosh; Mac OS X" : process.platform === "win32" ? "Windows NT 10.0" : process.platform})`;
/** PC の印の形（Kaname が返す "kpc_…"） */
export const DEVICE_TOKEN_RE = /^kpc_[A-Za-z0-9_-]{43}$/;

/** この PC の印を置くファイル（userData の中・bridge.json とは別なので、PC の印を捨ててもこの印は変わらない・D-128.174） */
export const MACHINE_ID_FILE = "machine-id";
/** 正式な uuid の形（K-145）。Bridge は workspace の部品を持たないので、DB の層の正本（packages/db/src/id.ts の UUID_RE）と同じ文字列をここに 1 つ置く。
 *  契約の isUuid（zod 4 の z.uuid()）と同じ決まり：版と variant の桁を見る・nil と max は通す・大文字は通す（K144-SHAPE-019 が文字列の一致を見る） */
export const UUID_RE =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
/** PC の名前の既定（D-128.174）：この PC のホスト名そのもの。前後の空白は落とし、空なら「この PC」 */
export const DEFAULT_LABEL = "この PC";
export function defaultDeviceLabel(host: string = hostname()): string {
  return host.trim() || DEFAULT_LABEL;
}

/** この PC の印（D-128.174）。初めて呼んだときに乱数の UUID を 1 回だけ作って置き場（userData）に残し、あとはそれを読む。
 *  中身が UUID の形でなければ作り直す（形の違う印を Kaname に送らない） */
export function loadMachineId(dir: string): string {
  const file = join(dir, MACHINE_ID_FILE);
  try {
    const v = readFileSync(file, "utf8").trim().toLowerCase();
    if (UUID_RE.test(v)) return v;
  } catch {
    // 無ければ作る
  }
  const id = randomUUID();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `${id}\n`, "utf8");
  return id;
}

export type ClaimReply = { ok: true; token: string } | { ok: false; message: string };
/** 引き取りの返事を読む。コードが使えない（E-CONN-013）・形が違う（422 の欄の理由）・多すぎる（429）を、そのまま窓に出せる文にする */
export function claimReply(status: number, body: unknown): ClaimReply {
  const j = (body ?? {}) as {
    data?: { device_token?: unknown };
    message?: unknown;
    details?: { message?: unknown }[];
    retry_after_sec?: unknown;
  };
  if (status === 201) {
    const t = j.data?.device_token;
    if (typeof t === "string" && DEVICE_TOKEN_RE.test(t)) return { ok: true, token: t };
    return { ok: false, message: "Kaname の返事が読めませんでした。もう一度押してください" };
  }
  if (status === 429)
    return {
      ok: false,
      message: `続けて間違えたので、${Number(j.retry_after_sec) || 60} 秒待ってからもう一度入れてください`,
    };
  const detail = j.details?.[0]?.message;
  if (typeof detail === "string" && detail) return { ok: false, message: detail };
  if (typeof j.message === "string" && j.message) return { ok: false, message: j.message };
  return { ok: false, message: `うまくいきませんでした（${status}）` };
}

/** 接続コードを Kaname に渡す（POST /api/v1/bridge/claim）。届かないときは「Kaname につながりません」で、コードは捨てない（もう一度押せる） */
export async function claimCode(
  apiBase: string,
  code: string,
  pc: { label: string; machineId: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ClaimReply> {
  const res = await fetchImpl(`${apiBase}/api/v1/bridge/claim`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "user-agent": BRIDGE_UA },
    body: JSON.stringify({ code, device_label: pc.label, machine_id: pc.machineId }),
    signal: AbortSignal.timeout(15_000),
  }).catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))));
  if (res instanceof Error)
    return { ok: false, message: `Kaname につながりません（${res.message}）。もう一度押してください` };
  return claimReply(res.status, await res.json().catch(() => ({})));
}
