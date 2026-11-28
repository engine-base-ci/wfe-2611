"use client";
// 検索条件を保存する小窓（キャンバス LsSave・D-151.9）と、その入口のボタン（K-479）。
//   SaveViewDialog：値を受け取って描く（口は呼ばない）。onName・onSubmit が無ければ読むだけ（モックの見本）。
//   見える人は 自分だけ／グループの全員。「左のメニューに出す」「増えたら知らせる」は機能がまだなので押せない形（D-151.9・D-145.9）。
//   失敗は、欄の下の赤い字（名前が空・長い・同じ名前・制御文字）と小窓の上の赤い箱（それ以外）。書いた中身は消さない。文は正本の 1 件（D-142.2）
//   SaveViewButton：今の URL（K-478 の「URL が状態」）から保存の体を作り、口 createSavedView に 1 回送る。グループを選んでいない一覧では押せない形
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Button, Dialog, NoticeBox, TextField, errorText, notify } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import { filtersOf, lookNow, paramsOfSearch } from "./open-view";
import { Seg, SwitchRow } from "./parts";
import { summaryOf, type NamedItem } from "./summary";
import { useListNames, useStageNames } from "./use-list-names";
import { useSavedViewWrites, useSavedViews, useUrlSearch } from "./use-saved-views";

/** 名前の上限（K-475 の入口と同じ） */
export const VIEW_NAME_MAX = 60;

export interface SaveViewDialogProps {
  open: boolean;
  name: string;
  /** 名前の欄の下の赤い字（名前が空・同じ名前） */
  nameError?: string | undefined;
  /** 条件の要約（1 行ずつ。「担当者：鈴木」など） */
  conditions: readonly string[];
  share: "self" | "group";
  /** 「営業グループの全員」の「営業」 */
  groupName: string;
  /** 口が断ったとき（上限・調子が悪い）の赤い箱 */
  notice?: string | undefined;
  /** 保存している間（押し直せない） */
  busy?: boolean;
  onName?: (name: string) => void;
  onShare?: (share: "self" | "group") => void;
  onSubmit?: () => void;
  onClose?: () => void;
}

export function SaveViewDialog({
  open,
  name,
  nameError,
  conditions,
  share,
  groupName,
  notice,
  busy = false,
  onName,
  onShare,
  onSubmit,
  onClose,
}: SaveViewDialogProps) {
  const formId = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) onSubmit?.();
  };
  return (
    <Dialog
      title="検索条件を保存"
      subtitle="いまの条件と見え方に名前をつけて、あとから 1 回で開く"
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onClose?.();
      }}
      actions={
        <>
          <Button variant="outlined" disabled={busy} onClick={onClose}>
            やめる
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            保存する
          </Button>
        </>
      }
    >
      {/* 手元の確かめは JS で出す（ブラウザの必須の確かめに奪わせない・G-01） */}
      <form id={formId} className="k-dialog-stack" noValidate onSubmit={submit}>
        {notice ? <NoticeBox>{notice}</NoticeBox> : null}
        <TextField
          label="名前"
          name="view-name"
          value={name}
          required
          maxLength={VIEW_NAME_MAX}
          error={nameError}
          aria-invalid={nameError ? true : undefined}
          {...(onName ? { onChange: (e) => onName(e.target.value) } : { readOnly: true })}
        />
        <div className="k-field">
          <span className="k-label">条件</span>
          <ul className="k-f7-saved-chips" aria-label="条件">
            {conditions.map((c) => (
              <li key={c} className="k-f7-saved-chip">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="k-field">
          <span className="k-label">見える人</span>
          <Seg
            label="見える人"
            value={share}
            items={[
              { value: "self", label: "自分だけ" },
              { value: "group", label: `${groupName}グループの全員` },
            ]}
            {...(onShare ? { onChange: (v: string) => onShare(v === "group" ? "group" : "self") } : {})}
          />
        </div>
        <div className="k-f7-saved-switches">
          <SwitchRow label="左のメニューに出す" sub="グループの下に並ぶ" pending />
          <SwitchRow label="当てはまるチケットが増えたら知らせる" sub="1 日 1 回まとめて" pending />
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------- 入口と保存の流れ
/** 名前の欄の下に出す番号（ほかは小窓の上の赤い箱） */
const NAME_CODES = new Set(["E-VWS-001", "E-VWS-002", "E-VWS-005", "E-VWS-008"]);
const NO_NAME = "E-VWS-001";
const LOAD_FAILED = "E-PAGE-007";

const messageOf = (code: string): string => errorText(code).entry.message;
/** 口の失敗 → 欄の下の字か赤い箱の字（4xx は正本の文・それ以外は E-PAGE-007 の 1 文目） */
export function failText(err: CallErr | null): { field?: string; box?: string } {
  if (err && NAME_CODES.has(err.code)) return { field: messageOf(err.code) };
  if (err && err.status >= 400 && err.status < 500) {
    try {
      return { box: messageOf(err.code) };
    } catch {
      return { box: errorText(LOAD_FAILED).title };
    }
  }
  return { box: errorText(LOAD_FAILED).title };
}
/** 名前が空か（NFKC と前後の空白をそろえて） */
export const isBlankName = (v: string): boolean => v.normalize("NFKC").trim() === "";

const newKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/** K-478 の名前の答えを { id, name } に（形の外れた物は捨てる） */
function named(list: unknown): NamedItem[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((x) => {
    const r = x as Record<string, unknown> | null;
    return r && typeof r["id"] === "string" && typeof r["name"] === "string" ? [{ id: r["id"], name: r["name"] }] : [];
  });
}

export interface SaveViewButtonProps {
  className?: string;
  /** 言葉の欄の今の字 */
  q?: string;
}

/** 「検索条件を保存」。グループの一覧（?scope=）でだけ押せる。押すと小窓を開き、今の URL の絞り・列・行の高さを保存する */
export function SaveViewButton({ className = "k-list-tool", q = "" }: SaveViewButtonProps) {
  const search = useUrlSearch();
  const scopeId = search.get("scope");
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  if (!scopeId)
    return (
      <button
        type="button"
        className={className}
        aria-disabled="true"
        title="グループの一覧で保存できます"
        onClick={(e) => e.preventDefault()}
      >
        検索条件を保存
      </button>
    );
  return (
    <>
      <button ref={btn} type="button" className={className} onClick={() => setOpen(true)}>
        検索条件を保存
      </button>
      {open ? (
        <SaveFlow
          scopeId={scopeId}
          search={search}
          q={q}
          onDone={() => {
            setOpen(false);
            window.setTimeout(() => btn.current?.focus(), 0);
          }}
        />
      ) : null}
    </>
  );
}

function SaveFlow({
  scopeId,
  search,
  q,
  onDone,
}: {
  scopeId: string;
  search: URLSearchParams;
  q: string;
  onDone: () => void;
}) {
  const { groups } = useSavedViews(true);
  const names = useListNames() as { people?: unknown; kinds?: unknown };
  const stageNames = useStageNames(true) as { stages?: unknown };
  const { createView } = useSavedViewWrites();
  const [name, setName] = useState("");
  const [share, setShare] = useState<"self" | "group">("self");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const sending = useRef(false);
  // 開いたときの絞り・列・行の高さ（開いている間は替えない）
  const [snap] = useState(() => ({ extra: paramsOfSearch(search), view: "all" as const, ...lookNow() }));
  const groupName = groups.find((g) => g.id === scopeId)?.name ?? "";
  const stages = useMemo(
    () => (Array.isArray(stageNames.stages) ? named(stageNames.stages) : null),
    [stageNames.stages],
  );
  const conditions = useMemo(
    () =>
      summaryOf({
        extra: snap.extra,
        q,
        people: named(names.people),
        kinds: named(names.kinds),
        stages,
        columns: snap.columns,
        density: snap.density,
      }),
    [snap, q, names.people, names.kinds, stages],
  );
  const submit = async () => {
    if (sending.current) return;
    if (isBlankName(name)) {
      setNameError(messageOf(NO_NAME));
      return;
    }
    sending.current = true;
    setBusy(true);
    setNameError(undefined);
    setNotice(undefined);
    const r = await createView(
      {
        name,
        share,
        scope_id: scopeId,
        filters: filtersOf({ view: snap.view, q, extra: snap.extra }),
        columns: snap.columns,
        density: snap.density,
      },
      key.current,
    );
    sending.current = false;
    setBusy(false);
    if (r.ok) {
      notify(`「${name.trim()}」を保存しました`);
      onDone();
      return;
    }
    // 断られた（4xx）なら次は別の送り（体が変わる）。落ちた・つながらないなら同じ鍵で送り直す
    if (r.err && r.err.status >= 400 && r.err.status < 500) key.current = newKey();
    const t = failText(r.err);
    setNameError(t.field);
    setNotice(t.box);
  };

  return (
    <SaveViewDialog
      open
      name={name}
      nameError={nameError}
      notice={notice}
      conditions={conditions}
      share={share}
      groupName={groupName}
      busy={busy}
      onName={(v) => setName([...v].slice(0, VIEW_NAME_MAX).join(""))}
      onShare={setShare}
      onSubmit={() => void submit()}
      onClose={onDone}
    />
  );
}
