// チケットの設定「状態」の形（K-708・口は K-705）：口 listTicketStages の答え → 部品の値（StageRowShape）・並べ替えの全部の id・保存の差分。
//   画面の外の純粋な関数（@/ を読まない・元の値を変えない・単体の試験 k708-settings-stages-shape.test.ts が見る）
import { nameProblem, toneOf, trimName, type ToneKey } from "./kinds-shape";

/** 名前の上限（口 K-705 と同じ 20 字） */
export const STAGE_NAME_MAX = 20;

export type StageLock = "start" | "end" | "system" | null;

/** 口の答えの 1 件（契約 TicketStageSetting の、この画面が読む所） */
export interface StageAnswer {
  id: string;
  key?: string | null;
  name: string;
  color_key?: string | null;
  position?: number;
  lock?: StageLock | string;
}

export interface StageRowShape {
  id: string;
  name: string;
  tone: ToneKey;
  /** 消せない訳（始め・終わり・仕組み） */
  locked?: string;
}

export interface StageDraft {
  name: string;
  tone: ToneKey;
}

export interface StagePatch {
  name?: string;
  color_key?: string;
}

const LOCK_TEXT: Readonly<Record<string, string>> = {
  start: "始めの状態なので消せません",
  end: "終わりの状態なので消せません",
  system: "仕組みが使う状態なので消せません",
};

export const lockText = (lock: StageLock | string | undefined): string | undefined =>
  lock ? LOCK_TEXT[lock] : undefined;

const byPosition = (answer: readonly StageAnswer[]): StageAnswer[] =>
  [...answer].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
const isSystem = (s: StageAnswer): boolean => s.lock === "system";
const isFixed = (s: StageAnswer): boolean => s.lock === "start" || s.lock === "end" || s.lock === "system";

/** 一覧の行（仕組みの状態は出さない・position の昇順） */
export function shapeStages(answer: readonly StageAnswer[]): StageRowShape[] {
  return byPosition(answer)
    .filter((s) => !isSystem(s))
    .map((s) => {
      const locked = lockText(s.lock);
      return { id: s.id, name: s.name, tone: toneOf(s.color_key), ...(locked ? { locked } : {}) };
    });
}

/** 仕組みの状態も含む全部の id（position の昇順） */
export const allIds = (answer: readonly StageAnswer[]): string[] => byPosition(answer).map((s) => s.id);

/** 動かした状態を一覧（仕組みの状態を除く）の行き先 toIndex に置いた全部の id。動かせない・動かない動きは null */
export function moveStage(answer: readonly StageAnswer[], id: string, toIndex: number): string[] | null {
  const all = byPosition(answer);
  const list = all.filter((s) => !isSystem(s));
  const from = list.findIndex((s) => s.id === id);
  if (from < 0 || isFixed(list[from]!)) return null;
  if (toIndex <= 0 || toIndex >= list.length - 1 || toIndex === from) return null;
  const rest = list.filter((s) => s.id !== id);
  const moved = [...rest.slice(0, toIndex), list[from]!, ...rest.slice(toIndex)];
  let k = 0;
  return all.map((s) => (isSystem(s) ? s.id : moved[k++]!.id));
}

/** 並べ替えた全部の id のとおりに position を付け直した答え（押した直後に見せる） */
export function reorderedAnswer(answer: readonly StageAnswer[], ids: readonly string[]): StageAnswer[] {
  const at = new Map(ids.map((id, i) => [id, (i + 1) * 10]));
  return answer.map((s) => ({ ...s, position: at.get(s.id) ?? s.position ?? 0 }));
}

export const stageDraftOf = (s: StageAnswer): StageDraft => ({ name: s.name, tone: toneOf(s.color_key) });

/** 保存の体（変えた欄だけ。名前は前後の空白〔全角も〕を落として比べる） */
export function stagePatch(base: StageAnswer, draft: StageDraft): StagePatch {
  const name = trimName(draft.name);
  return {
    ...(name !== trimName(base.name) ? { name } : {}),
    ...(draft.tone !== toneOf(base.color_key) ? { color_key: draft.tone } : {}),
  };
}

export const stageProblem = (name: string): string | null => nameProblem(name, STAGE_NAME_MAX);
