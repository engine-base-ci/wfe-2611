"use client";
// チケットを作る面（K-60・キャンバスの Create）。グループ・種別・題名・担当者・期限・開始・優先度・親・種別の区画・知らせる人・「作る前に」の確かめ・作る。
//   必須は 題名・種別・担当者・期限 と、その種別の必須の区画（種別のマスタ kind_sections.mode = required）。期限は今日より前は不可（D-128.138）
//   ブラウザ標準の検証は使わない（noValidate）：理由は欄の下に、正本の文言か入口の理由で出す（G-01・G-08）
//   書きかけはサーバーとこの PC に残す（draft.ts）。ログインが切れても・戻っても・再読み込みしても続きから書ける
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button, Callout, ErrorState, Loading, Select, TextArea, TextField } from "@/components/k";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { DraftStore, loadDraft, tabDraftId, type DraftBody, type SaveState } from "./draft";

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
  scopes: { id: string; name: string }[];
  kinds: KindChoice[];
  members: { id: string; display_name: string }[];
  parents: { id: string; number: string; title: string }[];
}
type Fields = Record<string, string>;
const TITLE_MAX = 200;
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

export function CreateTicket({
  choices,
  onCreated,
  onClose,
  onExpired,
}: {
  choices: Choices;
  onCreated: (id: string) => void;
  onClose: () => void;
  onExpired: () => void;
}) {
  const owner = useMemo(
    () => ({ workspace: choices.workspace, member: choices.member }),
    [choices.workspace, choices.member],
  );
  const [d, setD] = useState<DraftBody>(EMPTY);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const store = useMemo(() => new DraftStore(owner, setSaveState), [owner]);
  useEffect(() => () => store.dispose(), [store]);
  /** 続きとして出した別のタブの下書きの id（作る口に source_draft_id で渡して消す・H2） */
  const source = useRef<string | null>(null);
  /** 作る口を呼んでいる間（2 回押しを、描き直しを待たずに止める） */
  const sending = useRef(false);
  const [fields, setFields] = useState<Fields>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [wait, setWait] = useState<number | null>(null);
  const loaded = useRef(false);
  /** 続きの下書きを読み終えたか。読み終えるまで欄を出さない（読み終えた中身で、先に書いた欄を上書きしない・K-60） */
  const [ready, setReady] = useState(false);
  const kind = choices.kinds.find((k) => k.id === d.kind_id);

  // 続きから書く（サーバー → この PC の写し）。無ければ既定（種別はタスク・グループは書ける最初のグループ）
  useEffect(() => {
    let alive = true;
    // 読めなくても（網が切れた・口が落ちた）、空の作る面を開く（D-128.62：書けないままにしない）
    void loadDraft(owner)
      .catch(() => null)
      .then((got) => {
        if (!alive) return;
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
      alive = false;
    };
  }, [owner, choices.kinds, choices.scopes]);

  const set = (patch: Partial<DraftBody>) => {
    setD((cur) => {
      const next = { ...cur, ...patch };
      if (loaded.current) store.save(next);
      return next;
    });
  };
  const setSection = (key: string, v: string) => set({ sections: { ...(d.sections ?? {}), [key]: v } });

  const checks = useMemo(() => {
    const f = checkForm(d, kind);
    const rows = [
      { label: "題名", ok: !f["title"] },
      { label: "種別", ok: !f["kind_id"] },
      { label: "担当者", ok: !f["assignee_member_id"] },
      { label: "期限", ok: !f["due_on"] },
      ...(kind?.sections ?? [])
        .filter((s) => s.mode === "required")
        .map((s) => ({ label: s.label, ok: !f[`sections.${s.key}`] })),
    ];
    return rows;
  }, [d, kind]);

  const fromServer = (r: CallErr) => {
    if (r.kind === "unauthenticated") return onExpired();
    if (r.kind === "rate_limited") return setWait(r.retryAfterSec ?? 60);
    const code = r.code;
    if (
      code === "E-VAL-014" ||
      code === "E-VAL-015" ||
      code === "E-VAL-012" ||
      code === "E-VAL-013" ||
      r.kind === "invalid"
    ) {
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

  const notify = new Set(d.notify_member_ids ?? []);
  return (
    <section className="k-panel" aria-labelledby="create-ticket-title">
      <h2 id="create-ticket-title">チケットを作る</h2>
      <p className="k-desc">
        書きかけは保存され、戻る・再読み込み・ログインが切れた後も、ほかの端末からも続きを書けます。
      </p>
      {!ready ? <Loading label="書きかけを読み込んでいます…" delayMs={0} /> : null}
      <form noValidate onSubmit={(e) => void submit(e)} hidden={!ready}>
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
        <TextField
          label="題名"
          name="title"
          required
          value={d.title ?? ""}
          onChange={(e) => set({ title: e.target.value })}
          error={fields["title"]}
          description={`${TITLE_MAX} 文字まで`}
        />
        <Select
          label="担当者"
          name="assignee_member_id"
          required
          value={d.assignee_member_id ?? null}
          options={choices.members.map((m) => ({ value: m.id, label: m.display_name }))}
          onValueChange={(v) => set({ assignee_member_id: v })}
          error={fields["assignee_member_id"]}
        />
        <TextField
          label="期限"
          name="due_on"
          type="date"
          required
          value={d.due_on ?? ""}
          onChange={(e) => set({ due_on: e.target.value })}
          error={fields["due_on"]}
          description="今日か、それより後の日"
        />
        <TextField
          label="開始"
          name="start_on"
          type="date"
          value={d.start_on ?? ""}
          onChange={(e) => set({ start_on: e.target.value })}
          error={fields["start_on"]}
        />
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
        {d.priority === "high" ? (
          <TextField
            label="高にする理由"
            name="priority_reason"
            required
            value={d.priority_reason ?? ""}
            onChange={(e) => set({ priority_reason: e.target.value })}
            error={fields["priority_reason"]}
          />
        ) : null}
        {choices.parents.length ? (
          <Select
            label="親のチケット"
            name="parent_ticket_id"
            value={d.parent_ticket_id ?? ""}
            options={[
              { value: "", label: "なし" },
              ...choices.parents.map((p) => ({ value: p.id, label: `${p.number} ${p.title}` })),
            ]}
            onValueChange={(v) => set({ parent_ticket_id: v || null })}
            error={fields["parent_ticket_id"]}
          />
        ) : null}
        {(kind?.sections ?? []).map((s) => (
          <TextArea
            key={`${kind?.id}-${s.key}`}
            label={s.label}
            name={`sections.${s.key}`}
            required={s.mode === "required"}
            value={d.sections?.[s.key] ?? ""}
            onChange={(e) => setSection(s.key, e.target.value)}
            error={fields[`sections.${s.key}`]}
            {...(s.hint ? { description: s.hint } : {})}
          />
        ))}
        <fieldset className="k-field">
          <legend className="k-label">作ったことを知らせる人</legend>
          {choices.members.map((m) => (
            <label key={m.id} className="k-check">
              <input
                type="checkbox"
                checked={notify.has(m.id)}
                onChange={(e) => {
                  const next = new Set(notify);
                  if (e.target.checked) next.add(m.id);
                  else next.delete(m.id);
                  set({ notify_member_ids: [...next] });
                }}
              />
              {m.display_name}
            </label>
          ))}
          <p className="k-desc">担当者にはいつも知らせます。</p>
        </fieldset>
        <section aria-label="作る前に" className="k-section">
          <h3>作る前に</h3>
          <ul>
            {checks.map((c) => (
              <li key={c.label} data-ok={c.ok}>
                {c.ok ? "✓" : "×"} {c.label}
              </li>
            ))}
          </ul>
        </section>
        {wait !== null ? (
          <Callout tone="warn" title="少し待ってください">
            続けて作りました。{wait} 秒たってから、もう一度押してください。書いたものは残っています。
          </Callout>
        ) : null}
        {saveState === "failed" ? (
          <Callout tone="warn" title="下書きをサーバーに残せませんでした">
            書いたものはこの画面に残っています。このまま書き続けると、もう一度残します。閉じる前に「作る」を押すか、時間をおいて開き直してください。
          </Callout>
        ) : null}
        {problem ? <ErrorState code={problem} /> : null}
        <div className="k-row">
          <Button type="submit" loading={busy}>
            作る
          </Button>
          <Button variant="ghost" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </form>
    </section>
  );
}
