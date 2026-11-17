// いまの様子（誰でも読める稼働状況の口 getServiceStatus・K-307）の答えを、画面の部品の値（ServiceIncident の並び）に読み替える 1 か所（K-315）。
//   困ったとき（/help）とログインの画面のいまの様子の帯（K-317）が同じものを使う（同じ読み替えを 2 つ作らない）。
//   口の答えは外から来た値として形を確かめる（契約の生成した型は incidents を string[] に写すが、実際は {state, title, started_at} の並び）。
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

function maintenanceOf(x: unknown): ServiceIncident | null {
  const o = asRecord(x);
  if (!o || o["ongoing"] === false) return null;
  const until = jstShort(o["to"]);
  if (until === null) return null;
  return { kind: "maintenance", title: MAINTENANCE_TITLE, when: `${until} まで` };
}

/** 口の答え（data）を画面の並びにする（障害 → メンテナンスの順）。data の形が違えば null（読めない） */
export function toIncidents(data: unknown): ServiceIncident[] | null {
  const o = asRecord(data);
  if (!o) return null;
  const raw = o["incidents"] ?? [];
  if (!Array.isArray(raw)) return null;
  const incidents = raw.map(incidentOf).filter((x): x is ServiceIncident => x !== null);
  const maintenance = maintenanceOf(o["maintenance"]);
  return maintenance ? [...incidents, maintenance] : incidents;
}
