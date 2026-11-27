// 会社の項目の値を読むときの字（K-1153・純粋な関数）。詳細の右のパネル（ItemsPanel）の値のボタンの字：
//   日付＝mmddWeek（0 で埋める「12/01（火）」）／数＝3 桁区切り（ja-JP）／1 つ選ぶ＝選択肢の名前／
//   複数選ぶ＝選択肢の並びで名前を「、」でつなぐ／今の選択肢に無い id は出さない／長い文章は改行を字のまま／空は空白
import { mmddWeek } from "@/features/F4/due/dates";
import type { FieldValue, TicketField } from "./field-values";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 読むときの見せ方の字（値が無い・形が合わないときは空） */
export function show(f: TicketField, v: FieldValue | undefined): string {
  if (v === undefined || v === null) return "";
  switch (f.field_type) {
    case "date":
      return typeof v === "string" && YMD_RE.test(v) ? mmddWeek(v) : "";
    case "number":
      return typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("ja-JP") : "";
    case "select":
      return typeof v === "string" ? (f.options.find((o) => o.id === v)?.name ?? "") : "";
    case "multi_select": {
      if (!Array.isArray(v)) return "";
      const chosen = new Set(v);
      return [...f.options]
        .sort((a, b) => a.position - b.position)
        .filter((o) => chosen.has(o.id))
        .map((o) => o.name)
        .join("、");
    }
    case "check":
      return "";
    default:
      return typeof v === "string" ? v : "";
  }
}
