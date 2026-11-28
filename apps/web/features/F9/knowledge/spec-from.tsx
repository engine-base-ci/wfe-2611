"use client";
// 確認項目の出どころの印「ナレッジ：ページの名前」（K-703・下絵 tk-blocked）。下絵の SpecList と本番の確認項目の行（F4 の spec-row）が同じ部品を使う。
//   見た目だけ（口を呼ばない）。字は字として描く。道があれば新しいタブで開くリンクにする
import { ShieldCheck } from "lucide-react";
import { specMark } from "./spec-guard-shape";
import "./ticket.css";

export interface SpecFromProps {
  /** ページの題名（印の字は「ナレッジ：<題名>」） */
  title: string;
  /** ページの道。無ければ字だけ */
  href?: string | null;
}

/** 印の見た目（字と、道があればリンク） */
function Mark({ label, href }: { label: string; href?: string | null }) {
  return (
    <small className="k-f9-spec-from">
      <ShieldCheck size={11} aria-hidden="true" />
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        label
      )}
    </small>
  );
}

export function SpecFrom({ title, href }: SpecFromProps) {
  return <Mark label={`ナレッジ：${title}`} href={href ?? null} />;
}

/** 確認項目の 1 行（listTestSpecs の行）から印を出す。必ず守るから入った行でなければ何も出さない */
export function SpecFromOf({ line }: { line: unknown }) {
  const mark = specMark(line);
  if (!mark) return null;
  return <Mark label={mark.label} href={mark.href} />;
}
