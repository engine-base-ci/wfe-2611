// 探した結果の 1 行。種類ごとに右端が違う（チケット＝段の札・決定／ナレッジ＝小さな字・会話＝日付と引用 1 行）。
//   行き先が無いもの（ナレッジの画面がまだ無い間。会話は /ai/chat?c=… へ行ける）は、出すが押せない形（aria-disabled・title に準備中・D-145.9）。
//   選んでいる行（↑↓ で動く）は淡い面と aria-current。
import { Badge } from "@/components/k";
import { HitMark } from "./hit-mark";
import { KIND_LABEL, type SearchHitView } from "./search-types";

export interface SearchHitProps {
  hit: SearchHitView;
  terms: readonly string[];
  active?: boolean | undefined;
  onOpen?: ((hit: SearchHitView) => void) | undefined;
}

export function SearchHit({ hit, terms, active, onOpen }: SearchHitProps) {
  const body = (
    <>
      {hit.lead ? <span className="k-f7-hit-lead">{hit.lead}</span> : null}
      <span className="k-f7-hit-main">
        <span className="k-f7-hit-title">
          <HitMark text={hit.title} terms={terms} />
        </span>
        {hit.snippet ? (
          <span className="k-f7-hit-snippet">
            <HitMark text={hit.snippet} terms={terms} />
          </span>
        ) : null}
      </span>
      {hit.tag ? <Badge tone={hit.tag.tone}>{hit.tag.label}</Badge> : null}
      {hit.meta ? <span className="k-f7-hit-meta">{hit.meta}</span> : null}
    </>
  );
  const common = { className: "k-f7-hit", "data-active": active || undefined, "data-kind": hit.kind };
  if (!hit.href)
    return (
      <span {...common} role="link" aria-disabled="true" tabIndex={0} title={`${KIND_LABEL[hit.kind]}（準備中）`}>
        {body}
      </span>
    );
  return (
    <a {...common} href={hit.href} aria-current={active ? "true" : undefined} onClick={() => onOpen?.(hit)}>
      {body}
    </a>
  );
}
