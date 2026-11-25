// 種類ごとのまとまり（見出し＋上位 5 件）。0 件のまとまりは emptyText があるときだけ見出しと一緒に 1 行出す（ナレッジは 0 件でも札は出す・P10）。
import { SearchHit } from "./search-hit";
import { HITS_PER_KIND, KIND_LABEL, type HitKind, type SearchHitView } from "./search-types";

export interface SearchGroupProps {
  kind: HitKind;
  hits: readonly SearchHitView[];
  terms: readonly string[];
  activeId?: string | undefined;
  emptyText?: string | undefined;
  onOpen?: ((hit: SearchHitView) => void) | undefined;
}

export function SearchGroup({ kind, hits, terms, activeId, emptyText, onOpen }: SearchGroupProps) {
  if (hits.length === 0 && !emptyText) return null;
  return (
    <section className="k-f7-search-group" aria-label={KIND_LABEL[kind]}>
      <h3 className="k-f7-search-group-head">{KIND_LABEL[kind]}</h3>
      {hits.length === 0 ? (
        <p className="k-f7-search-group-empty">{emptyText}</p>
      ) : (
        <ul className="k-f7-search-hits" role="list">
          {hits.slice(0, HITS_PER_KIND).map((h) => (
            <li key={h.id}>
              <SearchHit hit={h} terms={terms} active={h.id === activeId} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
