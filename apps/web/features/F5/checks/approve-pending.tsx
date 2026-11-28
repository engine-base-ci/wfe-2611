"use client";
// 承認の確かめの小窓の注意（K-740・下絵 /dev/mock/f5/checks-approve-modal・D-153.5）。チェックの無い確認項目があれば、
//   「チェックの無い確認項目が N 件あります」・説明・行ごとの四角を「成果物を目で見た」の前に出す。付けなくても承認できる。
//   並ぶ行は小窓を開いたときのチェックの無い行（付けても小窓の中から消さない）。開いただけでは口を呼ばない。
//   四角を押すと：最初の 1 回だけ確認項目の一覧（listTestSpecs）を読んで行の版を覚え、付け外しの口（updateTestSpec）を 1 回。
//   答えの版で持ち直し、承認の 1 件（["k63","approval",id]）を読み直させる（帯の要約の数が替わる）。
//   断られたら四角を戻し、fieldset の中に正本の文。409 E-SPEC-020〜022 と 404 は一覧と承認の 1 件を読み直す（K-450 と同じ振り分け）
import { CATALOG } from "@kaname/errors/catalog";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { errorCodeOf, errorText } from "@/components/k/error-of";
import { useApprovalDetail } from "@/features/F5/approve-complete/decide";
import { call, type CallErr } from "@/lib/api/call";
import { checkLines, type ApprovalChecks, type CheckLine } from "./checks-section";

const SCREEN = "tickets";
const TEXT = {
  head: (n: number) => `チェックの無い確認項目が ${n} 件あります`,
  detail: "見て確かめた物は、ここでチェックを付けられます。付けなくても承認できます",
} as const;
const RELOAD_CODES = new Set(["E-SPEC-020", "E-SPEC-021", "E-SPEC-022"]);
const needsReload = (r: Pick<CallErr, "status" | "code">): boolean =>
  r.status === 404 || (r.status === 409 && RELOAD_CODES.has(r.code));
type Refusal = Pick<CallErr, "kind" | "code" | "status">;
const NOT_FOUND: Refusal = { kind: "not_found", code: "E-PAGE-001", status: 404 };

/** 断りの文：正本に在る番号はその文、無ければ答えの種類で共通の 1 件 */
export function refusalText(r: Refusal): string {
  return CATALOG[r.code]?.message ?? errorText(errorCodeOf(r)).entry.message;
}

const approvalKey = (id: string) => ["k63", "approval", id] as const;

/** 付け外しの道具。版は最初の 1 回だけ一覧から読み、その後は答えの版で持つ */
export function useSpecToggle(ticketId: string | undefined, approvalId: string) {
  const qc = useQueryClient();
  const versions = useRef<ReadonlyMap<string, number> | null>(null);
  const busyRef = useRef<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const setBusyOf = (id: string, on: boolean): void => {
    const next = new Set(busyRef.current);
    if (on) next.add(id);
    else next.delete(id);
    busyRef.current = next;
    setBusy(next);
  };
  const reloadApproval = (): Promise<void> => qc.invalidateQueries({ queryKey: approvalKey(approvalId) });

  const loadVersions = async (): Promise<Refusal | null> => {
    if (!ticketId) return NOT_FOUND;
    const r = await call("listTestSpecs", { params: { id: ticketId }, screenId: SCREEN });
    if (!r.ok) return r;
    const list = Array.isArray(r.data) ? (r.data as unknown[]) : [];
    versions.current = new Map(
      list.map((v) => {
        const o = (v ?? {}) as { id?: unknown; version?: unknown };
        return [String(o.id ?? ""), Number(o.version ?? 1)] as const;
      }),
    );
    return null;
  };

  /** 付け外す。通れば true、断られたら false（文は error に出る） */
  const toggle = async (id: string, checked: boolean): Promise<boolean> => {
    if (busyRef.current.has(id)) return false;
    setBusyOf(id, true);
    setError(null);
    try {
      const failedList = versions.current ? null : await loadVersions();
      if (failedList) {
        setError(refusalText(failedList));
        return false;
      }
      const version = versions.current?.get(id);
      if (version === undefined) {
        setError(refusalText(NOT_FOUND));
        await Promise.all([loadVersions(), reloadApproval()]);
        return false;
      }
      const r = await call("updateTestSpec", { params: { id }, body: { version, checked }, screenId: SCREEN });
      if (r.ok) {
        const v = Number((r.data as { version?: unknown } | null)?.version ?? version + 1);
        versions.current = new Map(versions.current ?? []).set(id, v);
        await reloadApproval();
        return true;
      }
      setError(refusalText(r));
      if (needsReload(r)) await Promise.all([loadVersions(), reloadApproval()]);
      return false;
    } finally {
      setBusyOf(id, false);
    }
  };

  return { busy, error, toggle };
}

interface Props {
  approvalId?: string;
}

/** 小窓を開いたときのチェックの無い行（開いている間は替えない） */
function usePendingAtOpen(d: ApprovalChecks | null | undefined): CheckLine[] | null {
  const [rows, setRows] = useState<CheckLine[] | null>(null);
  useEffect(() => {
    if (rows === null && d) setRows((checkLines(d.checks) ?? []).filter((r) => !r.checked));
  }, [d, rows]);
  return rows;
}

export function ApprovePending({ approvalId }: Props): ReactNode {
  const detail = useApprovalDetail(approvalId ?? null);
  const d = detail.data as ApprovalChecks | null | undefined;
  const rows = usePendingAtOpen(d);
  const tool = useSpecToggle(d?.ticket?.id ?? undefined, approvalId ?? "");
  const [on, setOn] = useState<Readonly<Record<string, boolean>>>({});

  if (!approvalId || !rows || rows.length === 0) return null;

  const press = (id: string, checked: boolean): void => {
    setOn((s) => ({ ...s, [id]: checked }));
    void tool.toggle(id, checked).then((ok) => {
      if (!ok) setOn((s) => ({ ...s, [id]: !checked }));
    });
  };

  return (
    <fieldset className="k-more-pending">
      <p>{TEXT.head(rows.length)}</p>
      <p className="k-more-detail">{TEXT.detail}</p>
      {rows.map((r, i) => (
        <label key={`${r.id}-${i}`} className="k-dialog-check k-more-choice">
          <input
            type="checkbox"
            checked={on[r.id] ?? false}
            disabled={tool.busy.has(r.id)}
            onChange={(e) => press(r.id, e.target.checked)}
          />
          <span>{r.text}</span>
        </label>
      ))}
      {tool.error ? (
        <p className="k-err" role="alert">
          {tool.error}
        </p>
      ) : null}
    </fieldset>
  );
}
