// 照合が使えなかった登録の口（K-1019）：一覧 listOpsPwned（GET /api/v1/ops/pwned・K-995）と
//   確かめた ackOpsPwned（POST /api/v1/ops/workspaces/:id/pwned/ack・K-995）／ackOpsPwnedPending（POST /api/v1/ops/pwned/pending/ack・K-1110）。
//   印の取り方は外枠の口（lib/ops-shell-api.ts・K-946）と同じ Bearer。顧客の画面の共通の口は通さない（D-128.172）。
//   生の fetch は関門 C1 の決まりで apps/web/lib の中だけに置く
import { apiBase, getToken } from "@/lib/api/client";

export const OPS_PWNED_PATH = "/api/v1/ops/pwned";
/** 確定前の 1 行の鍵（features/F12/ops/pwned-shape.ts の PENDING_ID と同じ） */
const PENDING = "pending";

/** 読む・書くの結果：読めた（data はそのまま・形は画面が確かめる）／もう確かめてあった（409）／それ以外の失敗（503・網の切れ ほか） */
export type OpsPwnedResult = { kind: "ok"; data: unknown } | { kind: "conflict"; code: string } | { kind: "failed" };

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;

async function send(method: "GET" | "POST", path: string): Promise<OpsPwnedResult> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        accept: "application/json",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(method === "POST" ? { body: "{}" } : {}),
      credentials: "omit",
    });
  } catch {
    return { kind: "failed" }; // 網が切れた
  }
  const body = obj(await res.json().catch(() => null));
  if (res.ok) return { kind: "ok", data: body?.["data"] };
  if (res.status === 409) {
    const c = body?.["code"];
    return { kind: "conflict", code: typeof c === "string" ? c : "" };
  }
  return { kind: "failed" };
}

/** 一覧（小窓を開いたときだけ） */
export const fetchOpsPwned = (): Promise<OpsPwnedResult> => send("GET", OPS_PWNED_PATH);

/** 確かめた（id は会社の id・確定前の 1 行は pending でまとめて確かめる口） */
export const ackOpsPwned = (id: string): Promise<OpsPwnedResult> =>
  send(
    "POST",
    id === PENDING ? `${OPS_PWNED_PATH}/pending/ack` : `/api/v1/ops/workspaces/${encodeURIComponent(id)}/pwned/ack`,
  );
