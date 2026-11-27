"use client";
// チケットを作る面（K-60 → K-442 で下絵 v2 の並びに作り直した）。並び：親 → 種別 → 題名 → 本文 1 枚（種別のひな形）→ つながり →
//   項目の表（K-569・確認項目 K-450 を含む）→ ファイルを置く枠（押せない）→ 知らせる人。頭（create-head）の右に「下書きのまま閉じる」と「作る」。
//   必須は 題名・種別・担当者・期限 と会社が必須にした項目・優先度「高」の理由。本文は空でも作れる（D-150.49）。期限は今日より前は不可。
//   ブラウザ標準の検証は使わない（noValidate・G-01）。断りは create-errors の決めで欄の下か赤い箱に出し、書いた物は残す。
//   本文の持ち方は create-body、下書きの形は draft-shape、親・期限・つながりは差し込み口（create-slots・中身は K-443・K-444・K-580）
//   作り方「AI と話して作る」（道 how=ai）のときは、欄の右に AI との会話（features/F5/room/create-talk-aside・K-767）。作ったら会話をチケットへ移して詳細の AI のタブへ
//   会話の AI の案（K-777）：［全部使う］［選んで使う］で題名・本文・確認項目に入れる（題名・本文は案の字に替え・本文のひな形の薄い節は消す・確認項目は後ろに足す）。
//   入れた欄の名前の横に「AI の案」、その後に人が直すと「直しました」（印は画面の中だけ・作る口に送らない）
import "./create-ticket.css";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { isUuid, type Doc } from "@kaname/contracts";
import { CATALOG } from "@kaname/errors/catalog";
import { Badge, Button, Callout, ErrorState, Loading, Select, TextField } from "@/components/k";
import { PAGE_ERROR, errorText } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { DocEditor } from "@/features/F4/doc/editor";
import { ItemsTable } from "@/features/F4/items/items-table";
import { toLinksPayload } from "@/features/F4/links/create-links-model";
import { checkFields, parseNumber, toPayload, type FieldValue } from "@/features/F4/items/field-values";
import { useTicketFields, useTicketKinds } from "@/features/F4/items/use-ticket-fields";
import { SpecsItem } from "@/features/F4/specs/specs-item";
import {
  bodyOnKindChange,
  dismissTemplate,
  hasGhost,
  initialBody,
  onBodyEdit,
  toCreateBody,
  type BodyState,
} from "./create-body";
import { placeCreateError } from "./create-errors";
import { CreateHead, jstClock, type SaveView } from "./create-head";
import { DueSlot, LinksSlot, ParentSlot } from "./create-slots";
import { DraftStore, loadDraft, tabDraftId, type DraftBody, type DraftList, type SaveState } from "./draft";
import { NotifyPicker } from "./notify-picker";
import { CreateTalkFrame, type ApplyProposal } from "@/features/F5/room/create-talk-aside";
import { draftOf, type DraftKey, type DraftNow } from "@/features/F5/room/draft-words";
import { useDraftTalk } from "@/features/F5/room/use-draft-talk";

export interface KindChoice {
  id: string;
  name: string;
  body_template?: Doc | null;
  sections?: unknown[];
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
/** 道の印で開いたときの初期値（/tickets?new=1&title=…・&parent=<uuid>） */
export interface CreateSeed {
  title?: string;
  parent?: string;
}
type Fields = Record<string, string>;
const TITLE_MAX = 200;
/** 送る内容が 1MB を超えたときの文（入口の 413 の message と同じ・D-130.1・D-130.5） */
const TOO_LARGE = "送る内容が大きすぎます";
const FORM_ID = "k-create-form";
/** 誤りの欄にキーボードの場所を移す順（上から） */
const FOCUS_ORDER = ["scope_id", "kind_id", "title", "assignee_member_id", "start_on", "due_on", "priority_reason"];
const todayJst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const BASE: DraftBody = { priority: "mid", notify_member_ids: [], fields: {}, specs: [] };

/** 入口と同じ形の確かめ（画面でも先に止める。サーバーが最後の砦）。高の理由・予定時間・会社の項目は K-569 の checkFields が見る */
export function checkForm(d: DraftBody, today = todayJst()): Fields {
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
  return f;
}

/** 予定時間（時間の字）を作る口の分に直す。空・数でなければ送らない */
const toMinutes = (h: string | undefined): number | null => {
  const n = h ? parseNumber(h) : null;
  return n === null ? null : Math.round(n * 60);
};

/** 本文の字を、段落ごとの文書の木に（空の行は空の段落）。薄い節は持たない */
function docOfText(text: string): Doc {
  return {
    type: "doc",
    content: text
      .split("\n")
      .map((line) => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" })),
  } as unknown as Doc;
}

/** AI の案を入れた欄の印：入れたときの中身と今の中身が同じなら「AI の案」・違えば「直しました」（K-777） */
function FieldMark({ applied, now }: { applied: string | undefined; now: string }) {
  if (applied === undefined) return null;
  const ai = applied === now;
  return <Badge tone={ai ? "ai" : "neutral"}>{ai ? "AI の案" : "直しました"}</Badge>;
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
      <Button variant="outlined" size="sm" disabled title="ファイルを選ぶ（まだ使えません）">
        ファイルを選ぶ
      </Button>
    </div>
  );
}

interface CreateTicketProps {
  choices: Choices;
  seed?: CreateSeed;
  onCreated: (id: string) => void;
  onClose: () => void;
  onExpired: () => void;
}

export function CreateTicket({ choices, seed, onCreated, onClose, onExpired }: CreateTicketProps) {
  const owner = useMemo(
    () => ({ workspace: choices.workspace, member: choices.member }),
    [choices.workspace, choices.member],
  );
  const [d, setD] = useState<DraftBody>(BASE);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [save, setSave] = useState<SaveView>({ kind: "none" });
  const alive = useRef(true);
  /** まだサーバーに残していない書きかけがある（閉じる前に残す） */
  const dirty = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const onState = useCallback((st: SaveState, savedAt?: string | null) => {
    if (!alive.current) return;
    setSaveState(st);
    if (st === "failed" || st === "too_large") return setSave({ kind: "failed" });
    if (st !== "saved") return;
    dirty.current = false;
    // 時刻は保存の口の答えの saved_at（サーバーが残した時刻）。答えに無ければ時刻を出さない
    const at = savedAt ? jstClock(savedAt) : null;
    if (at) setSave({ kind: "saved", at });
  }, []);
  const store = useMemo(() => new DraftStore(owner, onState), [owner, onState]);
  useEffect(() => () => store.dispose(), [store]);
  /** 続きとして出した別のタブの下書きの id（作る口に source_draft_id で渡して消す・H2） */
  const source = useRef<string | null>(null);
  /** 作る口を呼んでいる間（2 回押しを、描き直しを待たずに止める） */
  const sending = useRef(false);
  const [errors, setErrors] = useState<Fields>({});
  const [box, setBox] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState<number | null>(null);
  /** 作る口が 413（送る内容が 1MB を超えた・D-130.1）を返したときの答えの文。書いたものは残す */
  const [tooLarge, setTooLarge] = useState<string | null>(null);
  const loaded = useRef(false);
  /** 続きの下書きを読み終えたか。読み終えるまで欄を出さない（読み終えた中身で、先に書いた欄を上書きしない・K-60） */
  const [ready, setReady] = useState(false);
  const { kinds: kindFields } = useTicketKinds();
  const { fields: master, state: customState, retry } = useTicketFields(d.kind_id ?? null);
  const kindOf = useCallback(
    (id: string | null | undefined) => choices.kinds.find((k) => k.id === id),
    [choices.kinds],
  );
  const kind = kindOf(d.kind_id);
  const body: BodyState = d.body ?? initialBody(kind);
  /** 右の AI との会話（K-767）。言うたびに渡すのは、その時の欄の中身 */
  const talk = useDraftTalk();
  const now = useRef(d);
  now.current = d;
  const draftNow = useCallback(() => draftOf(now.current as unknown as Parameters<typeof draftOf>[0]), []);
  /** AI の案を入れた欄と、入れたときの中身（K-777・印を出す元。画面の中だけ） */
  const [applied, setApplied] = useState<Partial<Record<DraftKey, string>>>({});

  // 続きから書く（サーバー → この PC の写し）。無ければ既定（種別はタスク・グループは書ける最初のグループ）。道の印の題名と親を足す
  useEffect(() => {
    let on = true;
    // 読めなくても（網が切れた・口が落ちた）、空の作る面を開く（D-128.62：書けないままにしない）
    void loadDraft(owner, choices.drafts)
      .catch(() => null)
      .then((got) => {
        if (!on) return;
        source.current = got?.sourceId ?? null;
        const task = choices.kinds.find((k) => k.name === "タスク") ?? choices.kinds[0];
        const next: DraftBody = {
          ...BASE,
          kind_id: task?.id ?? null,
          scope_id: choices.scopes[0]?.id ?? null,
          ...(got?.body ?? {}),
        };
        const seedTitle = seed?.title?.normalize("NFKC").trim();
        if (seedTitle && !(next.title ?? "").trim()) next.title = seedTitle;
        if (seed?.parent) next.parent_ticket_id = seed.parent;
        next.body = next.body ?? initialBody(choices.kinds.find((k) => k.id === next.kind_id));
        setD(next);
        loaded.current = true;
        setReady(true);
      });
    return () => {
      on = false;
    };
  }, [owner, choices.drafts, choices.kinds, choices.scopes, seed?.title, seed?.parent]);

  const update = (fn: (cur: DraftBody) => DraftBody) => {
    setD((cur) => {
      const next = fn(cur);
      if (loaded.current) {
        dirty.current = true;
        store.save(next);
      }
      return next;
    });
  };
  const set = (patch: Partial<DraftBody>) => update((cur) => ({ ...cur, ...patch }));
  const clearError = (key: string) =>
    setErrors((cur) => (key in cur ? Object.fromEntries(Object.entries(cur).filter(([k]) => k !== key)) : cur));

  const changeKind = (id: string | null) =>
    update((cur) => {
      // 出なくなった項目の入力は消す（新しい種別の項目だけ残す）
      const keep = new Set((kindFields.find((k) => k.id === id)?.fields ?? []).map((f) => f.id));
      const fields = Object.fromEntries(Object.entries(cur.fields ?? {}).filter(([k]) => keep.has(k)));
      return {
        ...cur,
        kind_id: id,
        fields,
        body: bodyOnKindChange(cur.body ?? initialBody(kindOf(cur.kind_id)), kindOf(id)),
      };
    });

  /** 項目の表の値（既定の行の優先度・理由・予定時間と、会社の項目） */
  const values: Record<string, FieldValue> = {
    ...(d.fields ?? {}),
    priority: d.priority ?? "mid",
    priority_reason: d.priority_reason ?? "",
    estimate: d.estimate ?? "",
  };
  const onItem = (key: string, v: FieldValue) => {
    clearError(key);
    if (key === "priority") return set({ priority: v === "high" ? "high" : "mid" });
    if (key === "priority_reason" || key === "estimate") return set({ [key]: typeof v === "string" ? v : "" });
    update((cur) => ({ ...cur, fields: { ...(cur.fields ?? {}), [key]: v } }));
  };

  const fromServer = (r: CallErr) => {
    if (r.kind === "unauthenticated") return onExpired();
    if (r.kind === "rate_limited") return setWait(r.retryAfterSec ?? 60);
    if (r.kind === "too_large") return setTooLarge(r.message ?? TOO_LARGE);
    if (r.kind === "forbidden") return setBox(PAGE_ERROR.forbidden);
    if (r.status === 409 || r.status === 404 || r.status === 422) {
      const placed = placeCreateError(r, { master, values: d.fields ?? {} });
      setErrors(placed.fields);
      return setBox(placed.box && placed.box in CATALOG ? placed.box : placed.box ? PAGE_ERROR.loadFailed : null);
    }
    setBox(PAGE_ERROR.loadFailed);
  };

  const focusFirst = (f: Fields) => {
    const key = FOCUS_ORDER.find((k) => f[k]) ?? Object.keys(f)[0];
    if (!key) return;
    document.querySelector<HTMLElement>(`#${FORM_ID} [name="${key}"]:not([aria-hidden="true"])`)?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending.current) return;
    setBox(null);
    setWait(null);
    setTooLarge(null);
    const f = {
      ...checkForm(d),
      ...checkFields(master, d.fields ?? {}, {
        priority: d.priority ?? "mid",
        priority_reason: d.priority_reason ?? "",
        estimate: d.estimate ?? "",
      }),
    };
    setErrors(f);
    if (Object.keys(f).length) return focusFirst(f);
    sending.current = true;
    setBusy(true);
    try {
      // 作る前に、今の中身をサーバーの下書きへすぐ残し、答えを待つ（作る口でログインが切れても、入り直すと続きが出る・H1）
      const saved = await store.flush(d);
      if (saved === "expired") return onExpired();
      // ここから先の保存は送らない（作った後に届く保存で下書きが生えない・H2）
      store.seal();
      const minutes = toMinutes(d.estimate);
      const links = toLinksPayload(d.links ?? []);
      const r = await call("createTicket", {
        body: {
          scope_id: d.scope_id!,
          kind_id: d.kind_id!,
          title: (d.title ?? "").trim(),
          assignee_member_id: d.assignee_member_id!,
          due_on: d.due_on!,
          ...(d.start_on ? { start_on: d.start_on } : {}),
          priority: d.priority ?? "mid",
          ...(d.priority === "high" ? { priority_reason: d.priority_reason ?? "" } : {}),
          ...(d.parent_ticket_id ? { parent_ticket_id: d.parent_ticket_id } : {}),
          ...(minutes !== null ? { estimate_minutes: minutes } : {}),
          body: toCreateBody(body) as unknown as Record<string, unknown>,
          fields: toPayload(master, d.fields ?? {}),
          specs: d.specs ?? [],
          notify_member_ids: d.notify_member_ids ?? [],
          draft_id: tabDraftId(owner),
          ...(source.current ? { source_draft_id: source.current } : {}),
          // 作るときにつなぐ相手（K-580・口は K-581）。契約の生成した型は links を string[] とするが、口は [{ kind, other_ticket_id }] を受ける
          ...(links ? { links: links as unknown as string[] } : {}),
        },
        screenId: "tickets",
      });
      if (!r.ok) {
        store.reopen(); // 作れなかった：書き続けられるよう、保存を戻す
        return fromServer(r);
      }
      store.clear();
      const id = String((r.data as { id: string }).id);
      // 作る時の会話があれば、このチケットへ移して右のパネルの AI のタブで開く（無ければ今までどおり・K-767・D-153.36）
      const adopted = await talk.adopt(id);
      if (adopted.kind === "none") return onCreated(id);
      window.location.assign(`/tickets/${id}?ai=1${adopted.kind === "failed" ? "&adopt=failed" : ""}`);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  /** 下書きのまま閉じる：まだ残していない書きかけをサーバーへ送ってから閉じる（下書きは消さない） */
  const closeKeep = () => {
    if (store.pending || dirty.current) void store.flush(d);
    onClose();
  };

  /** AI の案を欄に入れる（K-777）：題名・本文は案の字に替え（本文のひな形の薄い節も消す）・確認項目は案が足した後の並び。口は呼ばない */
  const applyProposal: ApplyProposal = (next, keys) => {
    const pick = new Set(keys);
    const cur = now.current;
    const nextD: DraftBody = {
      ...cur,
      ...(pick.has("title") ? { title: next.title } : {}),
      ...(pick.has("body") ? { body: { doc: docOfText(next.body), edited: true, dismissed: true } } : {}),
      ...(pick.has("checks") ? { specs: [...next.checks] } : {}),
    };
    for (const k of keys) clearError(k === "checks" ? "specs" : k);
    update(() => nextD);
    now.current = nextD;
    const passed: DraftNow = draftOf(nextD as unknown as Parameters<typeof draftOf>[0]);
    const patch: Partial<DraftNow> = {};
    const marks: Partial<Record<DraftKey, string>> = {};
    for (const k of keys) {
      if (k === "title") patch.title = passed.title;
      if (k === "body") patch.body = passed.body;
      if (k === "checks") patch.checks = passed.checks;
      marks[k] = markKey(passed, k);
    }
    // 案のままの欄は edited に入れない（次に言うとき、入れた後に人が直した欄だけが渡る・K777-UI-008・009）
    talk.rebase(patch);
    setApplied((m) => ({ ...m, ...marks }));
  };
  const nowDraft = draftOf(d as unknown as Parameters<typeof draftOf>[0]);

  const people = choices.members;
  const showNote = !body.dismissed && Boolean(kind?.body_template) && hasGhost(body.doc);
  const parentProps = {
    value: d.parent_ticket_id ?? null,
    onChange: (id: string | null) => set({ parent_ticket_id: id }),
    onCopy: (id: string) => set({ assignee_member_id: id }),
    due: d.due_on ?? null,
    ...(errors["parent_ticket_id"] ? { error: errors["parent_ticket_id"] } : {}),
  };
  const kindSelect = (
    <div className="k-f4d-kind">
      <Select
        label="種別"
        name="kind_id"
        required
        value={d.kind_id ?? null}
        options={choices.kinds.map((k) => ({ value: k.id, label: k.name }))}
        onValueChange={(v) => changeKind(v)}
        error={errors["kind_id"]}
      />
    </div>
  );

  return (
    <>
      <CreateHead
        save={save}
        action={
          <>
            <Button variant="outlined" type="button" onClick={closeKeep}>
              下書きのまま閉じる
            </Button>
            <Button type="submit" form={FORM_ID} loading={busy} disabled={!ready}>
              作る
            </Button>
          </>
        }
      />
      <CreateTalkFrame talk={talk} draft={draftNow} onApply={applyProposal}>
        <section className="k-create-wrap" aria-label="チケットを作る">
          {!ready ? <Loading label="書きかけを読み込んでいます…" /> : null}
          <form id={FORM_ID} className="k-f4d-page" noValidate onSubmit={(e) => void submit(e)} hidden={!ready}>
            <div className="k-f4d-parent">
              <ParentSlot place="top" {...parentProps} />
            </div>
            {choices.scopes.length >= 2 ? (
              <div className="k-f4d-kind-row">
                <div className="k-f4d-kind">
                  <Select
                    label="グループ"
                    name="scope_id"
                    required
                    value={d.scope_id ?? null}
                    options={choices.scopes.map((s) => ({ value: s.id, label: s.name }))}
                    onValueChange={(v) => set({ scope_id: v })}
                    error={errors["scope_id"]}
                  />
                </div>
                {kindSelect}
              </div>
            ) : (
              kindSelect
            )}
            <TextField
              label={
                applied.title === undefined ? (
                  "題名"
                ) : (
                  <span className="k-create-marked">
                    題名
                    <FieldMark applied={applied.title} now={markKey(nowDraft, "title")} />
                  </span>
                )
              }
              name="title"
              required
              placeholder="題名"
              value={d.title ?? ""}
              onChange={(e) => {
                clearError("title");
                set({ title: e.target.value });
              }}
              error={errors["title"]}
            />
            <section className="k-f4d-box" aria-label="本文">
              {showNote ? (
                <div className="k-f4d-tplnote">
                  <span>{`種別「${kind?.name ?? ""}」のひな形が入っています。消しても、自由に書き換えても構いません`}</span>
                  <Button variant="ghost" size="sm" type="button" onClick={() => set({ body: dismissTemplate(body) })}>
                    ひな形を消す
                  </Button>
                </div>
              ) : null}
              {applied.body !== undefined ? (
                <p className="k-create-marked">
                  本文
                  <FieldMark applied={applied.body} now={markKey(nowDraft, "body")} />
                </p>
              ) : null}
              <DocEditor
                doc={body.doc}
                onChange={(doc) => update((cur) => ({ ...cur, body: onBodyEdit(cur.body ?? body, doc) }))}
              />
              <LinksSlot value={d.links ?? []} onChange={(links) => set({ links })} busy={busy} title={d.title ?? ""} />
              <ItemsTable
                mode="create"
                fields={master}
                values={values}
                errors={errors}
                onChange={onItem}
                people={people}
                me={choices.member}
                customState={customState}
                onRetry={retry}
                slots={{
                  assignee: (
                    <div className="k-f4d-inline">
                      <Select
                        label="担当者"
                        name="assignee_member_id"
                        required
                        value={d.assignee_member_id ?? null}
                        options={people.map((p) => ({ value: p.id, label: p.display_name }))}
                        onValueChange={(v) => {
                          clearError("assignee_member_id");
                          set({ assignee_member_id: v });
                        }}
                        error={errors["assignee_member_id"]}
                      />
                      <Button
                        variant="outlined"
                        size="sm"
                        type="button"
                        onClick={() => {
                          clearError("assignee_member_id");
                          set({ assignee_member_id: choices.member });
                        }}
                      >
                        私が担当
                      </Button>
                    </div>
                  ),
                  start: (
                    <TextField
                      label="開始日"
                      name="start_on"
                      type="date"
                      value={d.start_on ?? ""}
                      onChange={(e) => {
                        clearError("start_on");
                        set({ start_on: e.target.value });
                      }}
                      error={errors["start_on"]}
                    />
                  ),
                  due: (
                    <DueSlot
                      value={d.due_on ?? ""}
                      onChange={(v) => {
                        clearError("due_on");
                        set({ due_on: v });
                      }}
                      {...(errors["due_on"] ? { error: errors["due_on"] } : {})}
                    />
                  ),
                  parent: <ParentSlot place="row" {...parentProps} />,
                  specs: (
                    <>
                      {applied.checks !== undefined ? (
                        <p className="k-create-marked">
                          確認項目
                          <FieldMark applied={applied.checks} now={markKey(nowDraft, "checks")} />
                        </p>
                      ) : null}
                      <SpecsItem mode="create" lines={d.specs ?? []} onChange={(specs) => set({ specs })} />
                    </>
                  ),
                }}
              />
            </section>
            <DropOff />
            <NotifyPicker
              people={people}
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
                書いたものはこの画面に残っています。本文を短くしてから、もう一度「作る」を押してください。
              </Callout>
            ) : null}
            {saveState === "too_large" ? (
              <Callout tone="warn" title={TOO_LARGE}>
                下書きをサーバーに残せませんでした。書いたものはこの画面に残っています。本文を短くすると、もう一度残します。
              </Callout>
            ) : null}
            {saveState === "failed" ? (
              // 帯は短く「下書きを残せませんでした」、ここは今までどおりの見出しと説明（同じ文を 2 か所に出さない・answer=d4790d24d5e2）
              <Callout tone="warn" title="下書きをサーバーに残せませんでした">
                書いたものはこの画面に残っています。このまま書き続けると、もう一度残します。閉じる前に「作る」を押すか、時間をおいて開き直してください。
              </Callout>
            ) : null}
            {box ? <ErrorState code={box} /> : null}
          </form>
        </section>
      </CreateTalkFrame>
    </>
  );
}

/** 欄の中身を比べる鍵（印を出す元・K-777） */
function markKey(v: DraftNow, k: DraftKey): string {
  return k === "checks" ? JSON.stringify(v.checks) : v[k];
}

/** 道の印（?parent=）の親の id：uuid の形のときだけ（形が違う・空は捨てる） */
export const seedParent = (values: readonly string[]): string | undefined =>
  values.length === 1 && isUuid(values[0]!) ? values[0] : undefined;
