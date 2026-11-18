// パスキーの部品の口（/api/auth/passkey/*）を呼ぶ網の口（K-318）。画面が Kaname 自身の API を呼ぶ道なので lib/ に置く（関門 C1 の例外 X-010・宛先は apiBase() だけ）。
//   Cookie は使わない（Bearer だけ・D-051.2）。チャレンジは答えの JSON の challenge_token を、確かめの要求の頭 x-passkey-challenge で返す（K-304・K-309）
import { apiBase, getToken } from "@/lib/api/client";

export const PASSKEY_CHALLENGE_HEADER = "x-passkey-challenge";

export interface PasskeyNetReply {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

const bearer = (): Record<string, string> => {
  const t = getToken();
  return t ? { authorization: `Bearer ${t}` } : {};
};
async function reply(res: Response): Promise<PasskeyNetReply> {
  const v: unknown = await res.json().catch(() => ({}));
  const body = typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  return { ok: res.ok, status: res.status, body };
}

/** 始めの口（部品 1.7.15 は GET）。道は /api/auth/passkey/ の下だけ */
export async function passkeyGet(path: `/api/auth/passkey/${string}`): Promise<PasskeyNetReply> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { accept: "application/json", ...bearer() },
    credentials: "omit",
  });
  return reply(res);
}

/** 確かめの口（POST・頭にチャレンジ） */
export async function passkeyPost(
  path: `/api/auth/passkey/${string}`,
  body: unknown,
  challenge: string,
): Promise<PasskeyNetReply> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      [PASSKEY_CHALLENGE_HEADER]: challenge,
      ...bearer(),
    },
    credentials: "omit",
    body: JSON.stringify(body),
  });
  return reply(res);
}
