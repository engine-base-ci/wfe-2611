"use client";
// 詳細の本文（1 枚の読む形）と結果の場所（K-571・下絵 v2 の BodyView・Results）。
//   本文：body.doc に字のある節が在れば DocView（K-577・編集の部品を読まない・チェックの箱は押せない形）。
//     空で前の形の区画（sections・K-575 まで）に字が在れば、区画の見出しと字で描く。どちらも無ければ薄い字を 1 つ。
//   結果の場所：results の 成果物・決定ログ・申し送り を、在るものだけ本文の下に並べる（D-150.41）。
//     各場所は段 7 の F6.SectionSlot で 1 つずつ包む（鍵 artifacts・decisions・handoff・K-397 が描き分ける）。
//   字はどれも文字として描く（HTML を動かさない）
import type { ReactNode } from "react";
import type { Doc } from "@kaname/contracts";
import { Prose } from "@/components/k";
import { DocView } from "@/features/F4/doc/editor";
import * as F6 from "@/features/F6/detail-slots";
import { mmddTime } from "./detail-head";
import { BodySlot } from "./detail-entry-slots";
import type { SlotTicket } from "./detail-slots";
import type { Detail, DetailSection, ResultsOf } from "./detail-types";
import "@/features/F4/doc/doc.css";

export const BODY_EMPTY = "本文はまだ書かれていません";

interface DocNode {
  type?: string;
  text?: string;
  attrs?: { ghost?: boolean } | null;
  content?: DocNode[];
}

/** 薄い節（attrs.ghost）を除いて、字か箱・表などの中身が 1 つでも在るか */
export function hasBody(doc: unknown): boolean {
  const root = doc as DocNode | null | undefined;
  const live = (n: DocNode): boolean => {
    if (n.attrs?.ghost) return false;
    if (n.type === "text") return (n.text ?? "").trim() !== "";
    if (n.type && n.type !== "paragraph" && n.type !== "heading" && !n.content?.length) return true;
    return (n.content ?? []).some(live);
  };
  return (root?.content ?? []).some(live);
}

const legacyOf = (d: Detail): DetailSection[] => (d.sections ?? []).filter((s) => (s.body?.text ?? "").trim() !== "");

function LegacySections({ sections, st }: { sections: DetailSection[]; st: SlotTicket }) {
  return (
    <>
      {sections.map((s) => (
        <F6.SectionSlot key={s.key} ticket={st} section={s}>
          <section className="k-section" aria-label={s.label}>
            <h2 id={`sec-${s.key}`}>{s.label}</h2>
            <Prose>{s.body?.text ?? ""}</Prose>
          </section>
        </F6.SectionSlot>
      ))}
    </>
  );
}

/** 本文の場所（region「本文」）。本文を直す入口は BodySlot に K-447 が足す */
export function BodyBlock({ detail, st }: { detail: Detail; st: SlotTicket }) {
  const doc = detail.body?.doc;
  const written = hasBody(doc);
  const legacy = written ? [] : legacyOf(detail);
  let inner: ReactNode = null;
  if (written) inner = <DocView doc={doc as Doc} ariaLabel="本文の中身" />;
  else if (legacy.length) inner = <LegacySections sections={legacy} st={st} />;
  return (
    <BodySlot ticket={st}>
      <section className="k-f4d-body-wrap k-detail-body" aria-label="本文">
        <div className="k-detail-doc">{inner}</div>
        {written || legacy.length ? null : <p className="k-f4d-hint">{BODY_EMPTY}</p>}
      </section>
    </BodySlot>
  );
}

const by = (name: string | null): string => name ?? "AI";
const at = (iso: string | null): string => mmddTime(iso);
const join = (...xs: string[]): string => xs.filter(Boolean).join(" ・ ");

function Place({
  name,
  slotKey,
  body,
  st,
  children,
}: {
  name: string;
  slotKey: string;
  body: { text?: string; items?: unknown };
  st: SlotTicket;
  children: ReactNode;
}) {
  return (
    <F6.SectionSlot ticket={st} section={{ key: slotKey, label: name, body, version: 0 }}>
      <section className="k-f4d-result" aria-label={name}>
        <h2>{name}</h2>
        {children}
      </section>
    </F6.SectionSlot>
  );
}

/** 結果の場所（在るものだけ・無ければ場所ごと出さない） */
export function ResultBlocks({ results, st }: { results: ResultsOf | null | undefined; st: SlotTicket }) {
  const r = results ?? {};
  const decisions = r.decisions ?? [];
  return (
    <>
      {r.artifacts ? (
        <Place name="成果物" slotKey="artifacts" body={{ text: r.artifacts.text }} st={st}>
          <ul>
            <li className="k-f4d-file">
              <b>{r.artifacts.text}</b>
              <small>{at(r.artifacts.updated_at)}</small>
            </li>
          </ul>
        </Place>
      ) : null}
      {decisions.length ? (
        <Place name="決定ログ" slotKey="decisions" body={{ items: decisions }} st={st}>
          <ul>
            {decisions.map((x) => (
              <li key={x.id} className="k-f4d-log">
                <span>{x.text}</span>
                <small>{join(at(x.decided_at), by(x.decided_by_name))}</small>
              </li>
            ))}
          </ul>
        </Place>
      ) : null}
      {r.handoff ? (
        <Place name="申し送り" slotKey="handoff" body={{ text: r.handoff.text }} st={st}>
          <p className="k-f4d-handoff">
            {r.handoff.text}
            {r.handoff.at || r.handoff.by_name
              ? `（${[at(r.handoff.at).slice(0, 5), r.handoff.by_name ?? ""].filter(Boolean).join(" ")}）`
              : ""}
          </p>
        </Place>
      ) : null}
    </>
  );
}
