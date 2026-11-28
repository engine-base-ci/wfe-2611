// 層の口（K-803 createLayer・updateLayer・listLayers）が共に使う入力の整えと答えの鍵。
//   入口（contract/op.ts）が先に全角を半角にし前後の空白を落とし、契約の VALUE_RANGES・INPUT_RULES で形を確かめる。ここは整えた後の値の後ろ盾

/** 層の名前の長さ・1 つの会社の層の数（D-154.8） */
export const LIMITS = { labelMax: 40, layers: 8 } as const;

/** 答えの鍵（ちょうど 6・この順）。LayerCreated・LayerUpdated・listLayers の 1 件で同じ */
export const LAYER_KEYS = ["id", "key", "label", "order_no", "group_count", "created_at"] as const;

/** 層の名前：整えて 1〜40 文字。合わなければ null */
export function cleanLabel(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFKC").trim();
  const n = Array.from(s).length;
  return n >= 1 && n <= LIMITS.labelMax ? s : null;
}

/** 並びの番号：1 以上の整数。合わなければ null。大きすぎる値は層の上限＋1 に丸める（関数の「層の数を超えれば最後」でそのまま最後になる・DB の int をあふれさせない） */
export function cleanOrder(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return null;
  return Math.min(v, LIMITS.layers + 1);
}
