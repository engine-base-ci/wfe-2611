// 種類の札（すべて・チケット・ナレッジ・決定・会話）。押すとその種類だけ。札に件数は出さない（口が総数を返さない・P10）。
//   ナレッジは 0 件でも札は出す。選んでいる札は aria-pressed。
import { KIND_LABEL, KIND_ORDER, type SearchKind } from "./search-types";

export function SearchKindTabs({ kind, onKind }: { kind: SearchKind; onKind?: ((k: SearchKind) => void) | undefined }) {
  return (
    <div className="k-f7-search-tabs" role="group" aria-label="探す種類">
      {KIND_ORDER.map((k) => (
        <button key={k} type="button" className="k-f7-search-tab" aria-pressed={kind === k} onClick={() => onKind?.(k)}>
          {KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );
}
