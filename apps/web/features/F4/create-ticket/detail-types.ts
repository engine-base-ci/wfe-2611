// チケットの詳細の答えの型（getTicket・K-560）と、詳細の差し込み口の props の型（K-571）。
//   新しい形の鍵（body・fields・spec_count・results ほか）はどれも任意：前の形の答え（区画の並び sections で来る）でも読める。
//   差し込み口の props の名前は中身を持つ葉（K-446・K-449・K-447・K-443・K-452・K-572・K-573）が使う。1 字も変えない
import type { ReactNode } from "react";
import type { RunView } from "@/features/F5/delegate/use-run";
import type { SlotTicket } from "./detail-slots";

/** 会社の項目の型（K-563 の field_type） */
export type DetailFieldType = "short_text" | "long_text" | "number" | "date" | "select" | "multi_select" | "check";

/** 詳細の答えの会社の項目（鍵 8・並びの順・K-560） */
export interface DetailField {
  id: string;
  name: string;
  field_type: DetailFieldType;
  required: boolean;
  description: string | null;
  options: { id: string; name: string; position: number }[];
  position: number;
  value: unknown;
}

/** 前の形の区画（K-575 まで残る） */
export interface DetailSection {
  key: string;
  label: string;
  body: { text?: string } | null;
  version: number;
}

/** 結果の場所（在るものだけ・D-150.41） */
export interface ResultsOf {
  artifacts?: { text: string; version: number; updated_at: string | null } | null;
  decisions?:
    | {
        id: string;
        text: string;
        reason: string | null;
        decided_at: string | null;
        decided_by_name: string | null;
      }[]
    | null;
  handoff?: { text: string; by_name: string | null; at: string | null } | null;
}

export interface Detail {
  ticket: {
    id: string;
    number: string;
    title: string;
    due_on: string | null;
    start_on: string | null;
    priority: string;
    created_at?: string | null;
    scope_id?: string | null;
  };
  /** 前の形の区画の並び（新しい形では空・F5 の帯が読む） */
  sections: DetailSection[];
  /** 本文 1 枚（文書の木・字・版） */
  body?: { doc: unknown; text: string; version: number } | null;
  /** 会社の項目（並びの順） */
  fields?: DetailField[] | null;
  spec_count?: number | null;
  spec_unchecked?: number | null;
  no_spec_reason?: string | null;
  parent?: { id?: string; number: string; title?: string | null } | null;
  child_count?: number | null;
  link_count?: number | null;
  results?: ResultsOf | null;
  kind: { name: string; color?: string | null } | null;
  stage: { key?: string | null; name: string } | null;
  assignee: { display_name: string } | null;
  /** 見ている人ができること（K-62 が delegate を、K165 が complete を足す） */
  can?: { delegate?: boolean; complete?: boolean } | null;
  /** 完了の時刻と押した人の表示名（K165 が足す。完了していなければ null） */
  completed?: { at: string; by: string | null } | null;
  /** 承認待ちの承認（K-162 が足す）。can_decide＝見ている人が承認する人か */
  approval?: {
    id: string;
    can_decide: boolean;
    irreversible?: boolean;
    note?: string | null;
    approver_name?: string | null;
  } | null;
}

/** 題の行・パネル・カードの入口の差し込み口（複製・版と差分・親の行・子とつながり） */
export interface EntryProps {
  ticket: SlotTicket;
}

/** 本文を包む差し込み口（K-447 が「直す」の入口と編集の帯を足す） */
export interface BodySlotProps {
  ticket: SlotTicket;
  children: ReactNode;
}

/** 題の行の「AI に任せる」「完了にする」の差し込み口（帯が受けている物の和・K-573・K-572） */
export interface ActsProps {
  ticketId: string;
  ticket: Detail;
  run: RunView | null;
  runKnown: boolean;
  onTicket: (d: Detail) => void;
  onChanged: () => Promise<void>;
  onRun: (runId: string) => Promise<void>;
}
