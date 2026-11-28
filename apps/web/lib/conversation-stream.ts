// 分身の部屋「話す」の流れ（K-762）を開く口：Kaname 自身の API（apiBase()）の streamConversation だけを読む。
//   外へ出る口（fetch）は関門 C1 の例外 X-010（apps/web/lib）の中に置く（宛先は apiBase() だけ・G16b が検査）
import { apiBase } from "@/lib/api/client";

/** 契約の道（`/api/v1/...`・id を入れた後）の流れを開く。トークンは見出しに付ける（URL に載せない） */
export function openConversationStream(
  path: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(`${apiBase()}${path}`, { headers, signal });
}
