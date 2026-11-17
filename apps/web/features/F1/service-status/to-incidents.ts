// いまの様子（誰でも読める稼働状況の口 getServiceStatus・K-307）の答えを、画面の部品の値（ServiceIncident の並び）に読み替える 1 か所（K-315）。
//   困ったとき（/help）とログインの画面のいまの様子の帯（K-317）が同じものを使う（同じ読み替えを 2 つ作らない）。
//   口の答えは外から来た値として形を確かめ、1 か所でも違えば「読めない」にする（契約の生成した型は incidents を string[] に写すが、実際は {state, title, started_at} の並び）。
//   ・障害（直っていない物だけを口が返す）→ 「<M/D H:MM> から」（started_at）
//   ・メンテナンスはメンテナンス中だけ出す。予定は出さない（answer=88f98638a534）。口は今のメンテナンスだけを返すので、ongoing が無ければ中とみなし、
//     ongoing が false なら出さない → 「メンテナンス中です。この間は使えません」「<M/D H:MM> まで」（to）
//   時刻は日本時間で書く（ブラウザの時間帯に依らない）
import type { ServiceIncident } from "@/components/k/auth-parts";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const MAINTENANCE_TITLE = "メンテナンス中です。この間は使えません";

/** ISO の時刻を日本時間の「M/D H:MM」にする。読めなければ null */
export function jstShort(iso: unknown): string | null {
  if (typeof iso !== "string" || iso === "") return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t + JST_OFFSET_MS);
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}:${mm}`;
}

const asRecord = (x: unknown): Record<string, unknown> | null =>
  x !== null && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

function incidentOf(x: unknown): ServiceIncident | null {
  const o = asRecord(x);
  const title = o?.["title"];
  const when = jstShort(o?.["started_at"]);
  if (typeof title !== "string" || title === "" || when === null) return null;
  return { kind: "incident", title, when: `${when} から` };
}

/** メンテナンス：null は無し・"planned" は予定（出さない）・"bad" は形が違う（読めない） */
function maintenanceOf(x: unknown): ServiceIncident | null | "planned" | "bad" {
  if (x === null || x === undefined) return null;
  const o = asRecord(x);
  if (!o) return "bad";
  if (o["ongoing"] === false) return "planned";
  const until = jstShort(o["to"]);
  if (until === null) return "bad";
  return { kind: "maintenance", title: MAINTENANCE_TITLE, when: `${until} まで` };
}

/** 口の答え（data）を画面の並びにする（障害 → メンテナンスの順）。
 *  形が 1 か所でも違えば null（読めない）。読めないのに「ふつう」と言わない（G-15）。捨てるのは予定のメンテナンスだけ */
export function toIncidents(data: unknown): ServiceIncident[] | null {
  const o = asRecord(data);
  const raw = o?.["incidents"];
  if (!o || !Array.isArray(raw)) return null;
  const incidents = raw.map(incidentOf);
  if (incidents.some((x) => x === null)) return null;
  const m = maintenanceOf(o["maintenance"]);
  if (m === "bad") return null;
  const ok = incidents as ServiceIncident[];
  return m === null || m === "planned" ? ok : [...ok, m];
}
