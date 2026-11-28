// 探す（F7・段 8）の表示部品の入口。本番では葉（K-471）がここの部品に本物の値と動きをつなぐ。
export { HitMark } from "./hit-mark";
export { SearchGroup, type SearchGroupProps } from "./search-group";
export { SearchHit, type SearchHitProps } from "./search-hit";
export { SearchKindTabs } from "./search-kind-tabs";
export { SearchPanel, type SearchPanelProps } from "./search-panel";
export {
  HITS_PER_KIND,
  KIND_LABEL,
  KIND_ORDER,
  splitTerms,
  type HitKind,
  type SearchGroupView,
  type SearchHitView,
  type SearchKind,
  type SearchStatus,
} from "./search-types";
