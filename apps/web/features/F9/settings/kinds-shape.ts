// チケットの設定「種別」の形（K-707）：口 listTicketKinds の答え → 部品の値（KindRow）と、保存するときの差分の体。
//   画面の外の純粋な関数（@/ を読まない・単体の試験 k707-settings-kinds-shape.test.ts が見る）

/** 正本の見分けの色 8 つ（views.tsx の Tone と同じ） */
export const TONE_KEYS = ["indigo", "teal", "amber", "coral", "sage", "plum", "lavender", "teal-light"] as const;
export type ToneKey = (typeof TONE_KEYS)[number];
const DEFAULT_TONE: ToneKey = "indigo";

/** 本文のひな形（段 5 の文書の木） */
export interface TemplateDoc {
  type: "doc";
  content: unknown[];
}

/** 口の答えの 1 件（契約 TicketKindChoice の、この画面が読む所） */
export interface KindAnswer {
  id: string;
  name: string;
  color?: string | null;
  color_key?: string | null;
  position?: number;
  is_builtin?: boolean;
  body_template?: Record<string, unknown> | null;
  fields?: unknown[];
}

export interface KindRowShape {
  id: string;
  name: string;
  tone: ToneKey;
  hasTemplate: boolean;
}

/** 右の欄で直している値 */
export interface KindDraft {
  name: string;
  tone: ToneKey;
  template: TemplateDoc | null;
}

/** 保存の体（変えた欄だけ） */
export interface KindPatch {
  name?: string;
  color_key?: string;
  body_template?: TemplateDoc | null;
}

const isTone = (v: unknown): v is ToneKey => typeof v === "string" && (TONE_KEYS as readonly string[]).includes(v);
export const toneOf = (key: string | null | undefined): ToneKey => (isTone(key) ? key : DEFAULT_TONE);

/** 文書の木の中に字が 1 つも無い（段落だけ・空）か */
function hasText(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: unknown; text?: unknown; content?: unknown };
  if (n.type === "text") return typeof n.text === "string" && n.text.trim() !== "";
  return Array.isArray(n.content) && n.content.some(hasText);
}
export const isEmptyDoc = (doc: TemplateDoc | Record<string, unknown> | null | undefined): boolean => !hasText(doc);

const asDoc = (v: Record<string, unknown> | null | undefined): TemplateDoc | null =>
  v && v["type"] === "doc" && Array.isArray(v["content"]) ? (v as unknown as TemplateDoc) : null;

export function shapeKinds(answer: readonly KindAnswer[]): KindRowShape[] {
  return [...answer]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((k) => ({ id: k.id, name: k.name, tone: toneOf(k.color_key), hasTemplate: !isEmptyDoc(k.body_template) }));
}

export const kindDraftOf = (kind: KindAnswer): KindDraft => ({
  name: kind.name,
  tone: toneOf(kind.color_key),
  template: asDoc(kind.body_template),
});

/** 前後の空白（全角・タブ・改行も。JS の \s は全角の空白を含む）を落とす */
export const trimName = (name: string): string => name.replace(/^\s+|\s+$/g, "");

const sameDoc = (a: TemplateDoc | null, b: TemplateDoc | null): boolean => {
  const ea = isEmptyDoc(a);
  const eb = isEmptyDoc(b);
  if (ea || eb) return ea === eb;
  return JSON.stringify(a) === JSON.stringify(b);
};

export function kindPatch(base: KindAnswer, draft: KindDraft): KindPatch {
  const name = trimName(draft.name);
  const baseTemplate = asDoc(base.body_template);
  return {
    ...(name !== trimName(base.name) ? { name } : {}),
    ...(draft.tone !== toneOf(base.color_key) ? { color_key: draft.tone } : {}),
    ...(sameDoc(draft.template, baseTemplate)
      ? {}
      : { body_template: isEmptyDoc(draft.template) ? null : draft.template }),
  };
}

export function nameProblem(name: string, max: number): string | null {
  const t = trimName(name);
  if (t === "") return "名前を入れてください";
  if (Array.from(t).length > max) return `名前は ${max} 字までです`;
  return null;
}

export function pickKind<T extends { id: string }>(rows: readonly T[], id: string | undefined): T | undefined {
  return rows.find((r) => r.id === id) ?? rows[0];
}
