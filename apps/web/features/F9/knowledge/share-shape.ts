// K-693「グループを選んで共有」と「写して直す」の決まった形（画面の外の純粋な関数・@/ を読まない）。
//   口 getKnowledgeShares・setKnowledgeShares（K-689）の groups を小窓の行に直す・選びの差分・送る体・ボタンの字・外す注意・お知らせの字、
//   共有された側の帯の「直せる人」・写しの帯の元の字。元の配列や集合は変えない（新しい値を返す）

export type ShareState = "shared" | "waiting" | "declined" | null;

/** 口の groups の 1 行（K-689：manager_name は「・」でつないだ名前・いなければ空の文字） */
export interface ShareGroupAnswer {
  group_id: string;
  name: string;
  manager_name: string;
  checked: boolean;
  state: ShareState;
}

/** 小窓の 1 行（ShareDialog の groups） */
export interface ShareRow {
  code: string;
  name: string;
  manager: string;
  checked: boolean;
  /** 状態の札の字（無ければ札を出さない） */
  state: string | undefined;
  /** 選べない（マネージャーがいず、共有も頼みも無い） */
  locked: boolean;
}

const STATE_TEXT: Readonly<Record<Exclude<ShareState, null>, string>> = {
  shared: "共有している",
  waiting: "承認待ち",
  declined: "断られた",
};
const NO_MANAGER = "まだいません";
const JOIN = "・";

const splitNames = (names: string): string[] =>
  names
    .split(JOIN)
    .map((n) => n.trim())
    .filter(Boolean);
const san = (names: readonly string[]): string => names.map((n) => `${n}さん`).join(JOIN);

/** 承認する人の字（「田中 美咲さん」・複数は「・」・いなければ「まだいません」） */
export function managerText(managerName: string): string {
  const names = splitNames(managerName);
  return names.length ? san(names) : NO_MANAGER;
}

const isLive = (g: ShareGroupAnswer): boolean => g.state === "shared" || g.state === "waiting";
const isLocked = (g: ShareGroupAnswer): boolean => !splitNames(g.manager_name).length && !isLive(g);

/** 口の並びのまま小窓の行にする。チェックは選び（selected）で決まる */
export function shareRows(groups: readonly ShareGroupAnswer[], selected: ReadonlySet<string>): ShareRow[] {
  return groups.map((g) => ({
    code: g.group_id,
    name: g.name,
    manager: managerText(g.manager_name),
    checked: selected.has(g.group_id),
    state: g.state ? STATE_TEXT[g.state] : undefined,
    locked: isLocked(g),
  }));
}

/** 開いたときの選び（口の checked＝共有中と承認待ち） */
export function initialSelection(groups: readonly ShareGroupAnswer[]): Set<string> {
  return new Set(groups.filter((g) => g.checked).map((g) => g.group_id));
}

/** 開いたときの checked との差（足す＝選んだが元は外れ・外す＝元は付いていたが外した）。グループの並びの順 */
export function shareDiff(
  groups: readonly ShareGroupAnswer[],
  selected: ReadonlySet<string>,
): { added: string[]; removed: string[] } {
  return {
    added: groups.filter((g) => !g.checked && selected.has(g.group_id)).map((g) => g.group_id),
    removed: groups.filter((g) => g.checked && !selected.has(g.group_id)).map((g) => g.group_id),
  };
}

/** 決める口の体（group_ids は選んだ全部をグループの並びで・空でもよい） */
export function shareBody(
  pageId: string,
  groups: readonly ShareGroupAnswer[],
  selected: ReadonlySet<string>,
): { page_id: string; group_ids: string[] } {
  return { page_id: pageId, group_ids: groups.filter((g) => selected.has(g.group_id)).map((g) => g.group_id) };
}

/** ボタンの字（足す数・足さず外すだけ・差が無い） */
export function shareSubmitLabel(added: number, removed: number): string {
  if (added > 0) return `${added} つのグループに共有を頼む`;
  if (removed > 0) return "共有を変える";
  return "共有を頼む";
}

/** 外すときの注意（外した行の名前の順・無ければ null） */
export function removeNote(names: readonly string[]): string | null {
  if (!names.length) return null;
  return `外すと、${names.join(JOIN)}への共有をやめます（承認待ちの頼みは取り下げます）。`;
}

/** 決めた後のお知らせ（前と後の状態を比べる・共有しました → 頼みました → やめました → 取り下げました の順） */
export function shareDoneText(before: readonly ShareGroupAnswer[], after: readonly ShareGroupAnswer[]): string {
  const prev = new Map(before.map((g) => [g.group_id, g.state]));
  const pick = (test: (was: ShareState, now: ShareState) => boolean): string[] =>
    after.filter((g) => test(prev.get(g.group_id) ?? null, g.state)).map((g) => g.name);
  const parts: [string, string[]][] = [
    ["共有しました", pick((was, now) => now === "shared" && was !== "shared")],
    ["共有を頼みました", pick((was, now) => now === "waiting" && was !== "waiting")],
    ["共有をやめました", pick((was, now) => was === "shared" && now !== "shared")],
    ["頼みを取り下げました", pick((was, now) => was === "waiting" && now !== "waiting" && now !== "shared")],
  ];
  return parts
    .filter(([, names]) => names.length)
    .map(([head, names]) => `${head}（${names.join(JOIN)}）。`)
    .join("");
}

/** 共有された側の帯の「直せるのは …」（いなければ括弧なし） */
export function sharedWriter(groupName: string, managerNames: readonly string[]): string {
  const names = managerNames.map((n) => n.trim()).filter(Boolean);
  return names.length ? `${groupName}のマネージャー（${san(names)}）` : `${groupName}のマネージャー`;
}

/** 口の copied_from（K-690・folders は棚の直下から） */
export interface CopiedFrom {
  page_id: string | null;
  title: string;
  shelf_name: string;
  folders?: readonly string[] | undefined;
  must: boolean;
  gone: boolean;
}

/** 写しの帯の元の字（「会社 › 経理 の「請求書の送り方」」・元が消えた・見えないときは null） */
export function copyFromText(from: CopiedFrom): string | null {
  if (from.gone) return null;
  const place = [from.shelf_name, ...(from.folders ?? [])].join(" › ");
  return `${place} の「${from.title}」`;
}
