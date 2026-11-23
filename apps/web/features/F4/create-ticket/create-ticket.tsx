"use client";
// チケットを作る面（K-60・器は K-224・キャンバスの Create）。帯（create-head）の下に、白い箱 3 つ（グループ・種別・題名／本文／振り分け）と
//   ファイルを置く枠・知らせる人を縦に並べ、右に「作る前に」と「〈名前〉のAI から」、画面の下に足元の帯（下書きのまま閉じる・作る）。
//   必須は 題名・種別・担当者・期限 と、その種別の必須の区画（種別のマスタ kind_sections.mode = required）。期限は今日より前は不可（D-128.138）
//   ブラウザ標準の検証は使わない（noValidate）：理由は欄の下に、正本の文言か入口の理由で出す（G-01・G-08）
//   書きかけはサーバーとこの PC に残す（draft.ts）。ログインが切れても・戻っても・再読み込みしても続きから書ける
//   本文の箱の中（区画の見出し・欄・道具の帯）は create-sections（K-225）
//   キャンバスに在って機能がまだの物（AI に任せる など 6 欄・ファイル・AI のひとこと）は出すが押せない・値は空（D-145.6・D-145.7・D-145.9）
import "./create-ticket.css";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button, Callout, ErrorState, Loading, Select, TextField } from "@/components/k";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { jstClock, type SaveView } from "./create-head";
import { CreateSections } from "./create-sections";
import { DraftStore, loadDraft, tabDraftId, type DraftBody, type DraftList, type SaveState } from "./draft";
import { NotifyPicker } from "./notify-picker";
import { ParentPicker } from "./parent-picker";

export interface KindChoice {
  id: string;
  name: string;
  sections: { key: string; label: string; mode: string; hint: string | null }[];
}
export interface Choices {
  /** 本人の会社の id（下書きの写しの鍵・グループが 1 つも無くても決まる） */
  workspace: string;
  /** 本人（member の id）。下書きの写しの鍵は本人ごと（共有の PC で別の人に見せない・H1） */
  member: string;
  /** 最初の読み込みで先に呼んでおいた書きかけの一覧の口（無ければ作る面が呼ぶ・K-235） */
  drafts?: Promise<DraftList>;
  scopes: { id: string; name: string }[];
  kinds: KindChoice[];
  members: { id: string; display_name: string }[];
}
type Fields = Record<string, string>;
const TITLE_MAX = 200;
/** 送る内容が 1MB を超えたときの文（入口の 413 の message と同じ・D-130.1・D-130.5） */
const TOO_LARGE = "送る内容が大きすぎます";
const FORM_ID = "k-create-form";
/** キャンバスの振り分けに在って、まだ使えない欄（D-145.9）。並びはキャンバスの順 */
const OFF_BEFORE_DUE = ["AI に任せる", "業務の型"] as const;
const OFF_AFTER_START = ["予定", "分類", "節目", "取引先"] as const;
const todayJst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const EMPTY: DraftBody = { priority: "mid", sections: {}, notify_member_ids: [] };

/** 入口と同じ形の確かめ（画面でも先に止める。サーバーが最後の砦） */
export function checkForm(d: DraftBody, kind: KindChoice | undefined, today = todayJst()): Fields {
  const f: Fields = {};
  const title = (d.title ?? "").normalize("NFKC").trim();
  if (!title) f["title"] = "題名を入れてください";
  else if ([...title].length > TITLE_MAX) f["title"] = `題名は ${TITLE_MAX} 文字までです`;
  if (!d.scope_id) f["scope_id"] = "グループを選んでください";
  if (!d.kind_id) f["kind_id"] = "種別を選んでください";
  if (!d.assignee_member_id) f["assignee_member_id"] = "担当者を選んでください";
  if (!d.due_on) f["due_on"] = "期限を入れてください";
  else if (d.due_on < today) f["due_on"] = errorText("E-VAL-012").entry.message;
  if (d.start_on && d.due_on && d.start_on > d.due_on) f["start_on"] = "開始は期限より前の日にしてください";
  if (d.priority === "high" && !(d.priority_reason ?? "").trim())
    f["priority_reason"] = "優先度を高にする理由を書いてください";
  for (const s of kind?.sections ?? [])
    if (s.mode === "required" && !(d.sections?.[s.key] ?? "").trim())
      f[`sections.${s.key}`] = errorText("E-VAL-013").entry.message;
  return f;
}

/** まだ使えない欄：在るが押せない・値も「選ぶ」の字も無い（▾ は飾り）・グレー */
function OffField({ label }: { label: string }) {
  const id = useId();
  return (
    <div className="k-create-assign-row">
      <div className="k-field">
        <span className="k-label" id={id}>
          {label}
        </span>
        <div
          className="k-select-trigger k-create-off"
          role="combobox"
          aria-labelledby={id}
          aria-disabled="true"
          aria-expanded="false"
          title={`${label}（準備中）`}
        >
          <span aria-hidden="true">▾</span>
        </div>
      </div>
    </div>
  );
}

/** ファイルを置く枠（まだ使えない・D-145.7）。落としてもブラウザがファイルを開いて画面を離れないよう、既定の動きだけ止める */
function DropOff() {
  const stop = (e: DragEvent) => e.preventDefault();
  return (
    <div
      className="k-create-drop"
      role="group"
      aria-label="ファイルを置く"
      aria-disabled="true"
      onDragOver={stop}
      onDrop={stop}
    >
      ファイルをここに置くか、貼り付ける
      <Button variant="outlined" size="sm" disabled title="ファイルを選ぶ（準備中）">
        ファイルを選ぶ
      </Button>
    </div>
  );
}

export function CreateTicket({
  choices,
  onCreated,
  onClose,
  onExpired,
  onSave,
}: {
  choices: Choices;
  onCreated: (id: string) => void;
  onClose: () => void;
  onExpired: () => void;
  /** 帯の下書きの保存の状態（帯は作る面の外で描く。読み込みの前後で同じ帯を使い続ける） */
  onSave: (v: SaveView) => void;
}) {
  const owner = useMemo(
    () => ({ workspace: choices.workspace, member: choices.member }),
    [choices.workspace, choices.member],
  );
  const [d, setD] = useState<DraftBody>(EMPTY);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const alive = useRef(true);
  /** まだサーバーに残していない書きかけがある（閉じる前に残す） */
  const dirty = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const onState = useCallback(
    (st: SaveState, savedAt?: string | null) => {
      if (!alive.current) return;
      setSaveState(st);
      if (st === "failed" || st === "too_large") return onSave({ kind: "failed" });
      if (st !== "saved") return;
      dirty.current = false;
      // 時刻は保存の口の答えの saved_at（サーバーが残した時刻）。答えに無ければ時刻を出さない
      const at = savedAt ? jstClock(savedAt) : null;
      if (at) onSave({ kind: "saved", at });
    },
    [onSave],
  );
  const store = useMemo(() => new DraftStore(owner, onState), [owner, onState]);
  useEffect(() => () => store.dispose(), [store]);
  /** 続きとして出した別のタブの下書きの id（作る口に source_draft_id で渡して消す・H2） */
  const source = useRef<string | null>(null);
  /** 作る口を呼んでいる間（2 回押しを、描き直しを待たずに止める） */
  const sending = useRef(false);
  const [fields, setFields] = useState<Fields>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  /** 作る口が 413（送る内容が 1MB を超えた・D-130.1）を返したときの答えの文。書いたものは残す */
  const [tooLarge, setTooLarge] = useState<string | null>(null);
  const loaded = useRef(false);
  /** 続きの下書きを読み終えたか。読み終えるまで欄を出さない（読み終えた中身で、先に書いた欄を上書きしない・K-60） */
  const [ready, setReady] = useState(false);
  const kind = choices.kinds.find((k) => k.id === d.kind_id);
  const myName = choices.members.find((m) => m.id === choices.member)?.display_name ?? "自分";

  // 続きから書く（サーバー → この PC の写し）。無ければ既定（種別はタスク・グループは書ける最初のグループ）
  useEffect(() => {
    let on = true;
    // 読めなくても（網が切れた・口が落ちた）、空の作る面を開く（D-128.62：書けないままにしない）
    void loadDraft(owner, choices.drafts)
      .catch(() => null)
      .then((got) => {
        if (!on) return;
        source.current = got?.sourceId ?? null;
        const task = choices.kinds.find((k) => k.name === "タスク") ?? choices.kinds[0];
        setD({
          ...EMPTY,
          kind_id: task?.id ?? null,
          scope_id: choices.scopes[0]?.id ?? null,
          ...(got?.body ?? {}),
        });
        loaded.current = true;
        setReady(true);
      });
    return () => {
      on = false;
    };
  }, [owner, choices.drafts, choices.kinds, choices.scopes]);

  const set = (patch: Partial<DraftBody>) => {
    setD((cur) => {
      const next = { ...cur, ...patch };
      if (loaded.current) {
        dirty.current = true;
        store.save(next);
      }
      return next;
    });
  };
  const setSection = (key: string, v: string) => set({ sections: { ...(d.sections ?? {}), [key]: v } });

  const checks = useMemo(() => {
    const f = checkForm(d, kind);
    return [
      { label: "題名", ok: !f["title"] },
      { label: "種別", ok: !f["kind_id"] },
      { label: "担当者", ok: !f["assignee_member_id"] },
      { label: "期限", ok: !f["due_on"] },
      ...(kind?.sections ?? [])
        .filter((s) => s.mode === "required")
        .map((s) => ({ label: s.label, ok: !f[`sections.${s.key}`] })),
    ];
  }, [d, kind]);

  const fromServer = (r: CallErr) => {
    if (r.kind === "unauthenticated") return onExpired();
    if (r.kind === "rate_limited") return setWait(r.retryAfterSec ?? 60);
    if (r.kind === "too_large") return setTooLarge(r.message ?? TOO_LARGE);
    const code = r.code;
    if (code === "E-VAL-015" || code === "E-VAL-012" || code === "E-VAL-013" || r.kind === "invalid") {
      const f: Fields = {};
      for (const [k, v] of Object.entries(r.fields)) f[k] = v;
      setFields(f);
      if (code.startsWith("E-")) setProblem(code);
      return;
    }
    if (r.kind === "not_found") return setProblem(PAGE_ERROR.notFound);
    if (r.kind === "forbidden") return setProblem(PAGE_ERROR.forbidden);
    setProblem(PAGE_ERROR.loadFailed);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending.current) return;
    setProblem(null);
    setWait(null);
    setTooLarge(null);
    const f = checkForm(d, kind);
    setFields(f);
    if (Object.keys(f).length) return;
    sending.current = true;
    setBusy(true);
    try {
      // 作る前に、今の中身をサーバーの下書きへすぐ残し、答えを待つ（作る口でログインが切れても、入り直すと続きが出る・H1）
      const saved = await store.flush(d);
      if (saved === "expired") return onExpired();
      // ここから先の保存は送らない（作った後に届く保存で下書きが生えない・H2）
      store.seal();
      const sections = Object.fromEntries(
        Object.entries(d.sections ?? {}).filter(([k, v]) => v.trim() && kind?.sections.some((s) => s.key === k)),
      );
      const r = await call("createTicket", {
        body: {
          scope_id: d.scope_id!,
          kind_id: d.kind_id!,
          title: d.title!,
          assignee_member_id: d.assignee_member_id!,
          due_on: d.due_on!,
          ...(d.start_on ? { start_on: d.start_on } : {}),
          priority: d.priority ?? "mid",
          ...(d.priority === "high" ? { priority_reason: d.priority_reason ?? "" } : {}),
          ...(d.parent_ticket_id ? { parent_ticket_id: d.parent_ticket_id } : {}),
          sections,
          notify_member_ids: d.notify_member_ids ?? [],
          draft_id: tabDraftId(owner),
          ...(source.current ? { source_draft_id: source.current } : {}),
        },
        screenId: "tickets",
      });
      if (!r.ok) {
        store.reopen(); // 作れなかった：書き続けられるよう、保存を戻す
        return fromServer(r);
      }
      store.clear();
      onCreated(String((r.data as { id: string }).id));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  /** 下書きのまま閉じる：まだ残していない書きかけをサーバーへ送ってから閉じる（下書きは消さない）。
   *  「残していない」は待っている保存の有無で決める（前の保存の答えを待つ間に続けて打った字も落とさない） */
  const closeKeep = () => {
    if (store.pending || dirty.current) void store.flush(d);
    onClose();
  };

  return (
    <>
      <section className="k-create-body" aria-label="チケットを作る">
        {!ready ? <Loading label="書きかけを読み込んでいます…" /> : null}
        <form id={FORM_ID} className="k-create-cards" noValidate onSubmit={(e) => void submit(e)} hidden={!ready}>
          <section className="k-create-card" aria-label="グループ・種別・題名">
            <div className="k-create-pick">
              <Select
                label="グループ"
                name="scope_id"
                required
                value={d.scope_id ?? null}
                options={choices.scopes.map((s) => ({ value: s.id, label: s.name }))}
                onValueChange={(v) => set({ scope_id: v })}
                error={fields["scope_id"]}
              />
              <Select
                label="種別"
                name="kind_id"
                required
                value={d.kind_id ?? null}
                options={choices.kinds.map((k) => ({ value: k.id, label: k.name }))}
                onValueChange={(v) => set({ kind_id: v })}
                error={fields["kind_id"]}
              />
              <span className="k-create-number">番号は作ったときに付く</span>
            </div>
            <div className="k-create-title">
              <TextField
                label="題名"
                name="title"
                required
                value={d.title ?? ""}
                onChange={(e) => set({ title: e.target.value })}
                error={fields["title"]}
              />
            </div>
          </section>
          <section className="k-create-card k-create-card-doc" aria-label="本文">
            <CreateSections
              kindName={kind?.name ?? ""}
              sections={kind?.sections ?? []}
              values={d.sections ?? {}}
              errors={Object.fromEntries((kind?.sections ?? []).map((s) => [s.key, fields[`sections.${s.key}`]]))}
              onChange={setSection}
            />
          </section>
          <section className="k-create-card" aria-labelledby="k-create-assign-title">
            <h2 id="k-create-assign-title">振り分け</h2>
            <div className="k-create-assign">
              <div className="k-create-assign-row">
                <Select
                  label="担当者"
                  name="assignee_member_id"
                  required
                  value={d.assignee_member_id ?? null}
                  options={choices.members.map((m) => ({ value: m.id, label: m.display_name }))}
                  onValueChange={(v) => set({ assignee_member_id: v })}
                  error={fields["assignee_member_id"]}
                />
                <Button variant="outlined" size="sm" onClick={() => set({ assignee_member_id: choices.member })}>
                  自分
                </Button>
              </div>
              {OFF_BEFORE_DUE.map((l) => (
                <OffField key={l} label={l} />
              ))}
              <div className="k-create-assign-row">
                <TextField
                  label="期限"
                  name="due_on"
                  type="date"
                  required
                  value={d.due_on ?? ""}
                  onChange={(e) => set({ due_on: e.target.value })}
                  error={fields["due_on"]}
                />
              </div>
              <div className="k-create-assign-row">
                <TextField
                  label="開始日"
                  name="start_on"
                  type="date"
                  value={d.start_on ?? ""}
                  onChange={(e) => set({ start_on: e.target.value })}
                  error={fields["start_on"]}
                />
              </div>
              {OFF_AFTER_START.map((l) => (
                <OffField key={l} label={l} />
              ))}
              <div className="k-create-assign-row">
                <Select
                  label="優先度"
                  name="priority"
                  value={d.priority ?? "mid"}
                  options={[
                    { value: "mid", label: "中" },
                    { value: "high", label: "高" },
                  ]}
                  onValueChange={(v) => set({ priority: v === "high" ? "high" : "mid" })}
                />
              </div>
              {d.priority === "high" ? (
                <div className="k-create-assign-row">
                  <TextField
                    label="高にする理由"
                    name="priority_reason"
                    required
                    value={d.priority_reason ?? ""}
                    onChange={(e) => set({ priority_reason: e.target.value })}
                    error={fields["priority_reason"]}
                  />
                </div>
              ) : null}
              <ParentPicker
                value={d.parent_ticket_id ?? null}
                error={fields["parent_ticket_id"]}
                onChange={(id) => set({ parent_ticket_id: id })}
              />
            </div>
          </section>
          <DropOff />
          <NotifyPicker
            people={choices.members}
            chosen={d.notify_member_ids ?? []}
            onChange={(ids) => set({ notify_member_ids: ids })}
          />
          {wait !== null ? (
            <Callout tone="warn" title="少し待ってください">
              続けて作りました。{wait} 秒たってから、もう一度押してください。書いたものは残っています。
            </Callout>
          ) : null}
          {tooLarge !== null ? (
            <Callout tone="danger" title={tooLarge}>
              書いたものはこの画面に残っています。区画を短くしてから、もう一度「作る」を押してください。
            </Callout>
          ) : null}
          {saveState === "too_large" ? (
            <Callout tone="warn" title={TOO_LARGE}>
              下書きをサーバーに残せませんでした。書いたものはこの画面に残っています。区画を短くすると、もう一度残します。
            </Callout>
          ) : null}
          {saveState === "failed" ? (
            // 帯は短く「下書きを残せませんでした」、ここは今までどおりの見出しと説明（同じ文を 2 か所に出さない・answer=d4790d24d5e2）
            <Callout tone="warn" title="下書きをサーバーに残せませんでした">
              書いたものはこの画面に残っています。このまま書き続けると、もう一度残します。閉じる前に「作る」を押すか、時間をおいて開き直してください。
            </Callout>
          ) : null}
          {problem ? <ErrorState code={problem} /> : null}
        </form>
        <aside className="k-create-aside" hidden={!ready}>
          <section aria-labelledby="k-create-before-title">
            <h2 id="k-create-before-title">作る前に</h2>
            <ul className="k-create-checks">
              {checks.map((c) => (
                <li key={c.label} data-ok={c.ok}>
                  {c.ok ? "✓" : "×"} {c.label}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="k-create-ai-title">
            <h2 id="k-create-ai-title">{myName}のAI から</h2>
          </section>
        </aside>
      </section>
      <div className="k-create-foot">
        <p>作るとチケットになり、担当者に知らせが届きます</p>
        <div className="k-create-foot-acts">
          <Button variant="outlined" onClick={closeKeep}>
            下書きのまま閉じる
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy} disabled={!ready}>
            作る
          </Button>
        </div>
      </div>
    </>
  );
}
