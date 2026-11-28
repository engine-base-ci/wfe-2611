"use client";
// 依頼を出す画面の値と動き（K-912）。書く間に分身に聞く（askPortalRequestQuestions）・添付（uploadPortalAttachment）・出す（createPortalRequest）。
//   聞くのは欄を離れたとき、中身が空でなく前回と違うときだけ 1 回。担当の PC が閉じていると分かったら、その後は聞き直さない（D-155.11）。
//   添付は 1 つずつ口を呼ぶ。700KB を超えるファイルは口を呼ばずに断る（口が最後の砦）。5 つまで。
//   出すのは 1 回ずつ（押している間は押し直せない）。失敗しても書いた内容と添付は残す。401 は期限切れの形を出す（自動で移さない）
import { useMemo, useRef, useState } from "react";
import { errorCodeOf, errorText, PAGE_ERROR, type SelectOption } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import type { AttachedFile, BadFile, FormError, Question } from "./request";

const SCREEN = "portal";
/** 1 つの添付の中身の上限（バイト・K-909 の 700000） */
export const ATTACH_MAX_BYTES = 700_000;
/** 1 依頼の添付の数の上限（K-909） */
export const ATTACH_MAX_COUNT = 5;
const NO_DUE = "none";
const TZ = "Asia/Tokyo";
const DAY_MS = 86_400_000;
const BODY_EMPTY = "何をしてほしいかを書いてください";
const CREATE_FAILED: FormError = {
  title: "依頼を出せませんでした",
  body: "もう一度押してください。書いた内容は、この画面に残っています。",
};

/** 今日（日本時間）から数えた選び肢。値は YYYY-MM-DD・「決めない」は none */
export function dueOptions(now: Date = new Date()): SelectOption[] {
  const [y, m, d] = now.toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  const today = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const at = (n: number) => {
    const t = new Date(today + n * DAY_MS);
    return { value: t.toISOString().slice(0, 10), md: `${t.getUTCMonth() + 1}/${t.getUTCDate()}` };
  };
  const one = at(1);
  const three = at(3);
  const week = at(7);
  return [
    { value: NO_DUE, label: "決めない" },
    { value: one.value, label: `明日（${one.md}）` },
    { value: three.value, label: `3 日後（${three.md}）` },
    { value: week.value, label: `1 週間後（${week.md}）` },
  ];
}

/** ファイルの中身を base64 にする */
async function base64Of(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const CHUNK = 0x8000;
  let bin = "";
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

const titleOf = (r: Pick<CallErr, "kind" | "code" | "status">): string => errorText(errorCodeOf(r)).title;

export interface NewRequestState {
  body: string;
  setBody: (v: string) => void;
  onBlurBody: () => void;
  bodyError: string | null;
  questions: Question[] | null;
  pcOpen: boolean | null;
  due: string;
  setDue: (v: string) => void;
  dueChoices: SelectOption[];
  dueError: string | null;
  files: AttachedFile[];
  badFiles: BadFile[];
  attachFull: string | null;
  addFiles: (list: File[]) => void;
  removeFile: (id: string) => void;
  busy: boolean;
  error: FormError | null;
  submit: () => void;
  sent: boolean;
  expired: boolean;
}

export function useNewRequest(): NewRequestState {
  const [body, setBody] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [pcOpen, setPcOpen] = useState<boolean | null>(null);
  const asked = useRef<string | null>(null);
  const closed = useRef(false);
  const [due, setDue] = useState(NO_DUE);
  const [dueError, setDueError] = useState<string | null>(null);
  const dueChoices = useMemo(() => dueOptions(), []);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [badFiles, setBadFiles] = useState<BadFile[]>([]);
  const taken = useRef(0); // 足せた添付と口を呼んでいる添付の数（同時に選んだ物も数える）
  const badSeq = useRef(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<FormError | null>(null);
  const [sent, setSent] = useState(false);
  const [expired, setExpired] = useState(false);

  const onBlurBody = () => {
    if (closed.current || body.trim() === "" || body === asked.current) return;
    asked.current = body;
    void call("askPortalRequestQuestions", { body: { body }, keepOn401: true, screenId: SCREEN })
      .then((r) => {
        if (!r.ok) {
          if (r.kind === "unauthenticated") setExpired(true);
          return; // 聞けなくても出せる（質問は出さない）
        }
        const d = (r.data ?? {}) as { available?: unknown; questions?: unknown };
        if (d.available !== true) {
          closed.current = true;
          setPcOpen(false);
          setQuestions([]);
          return;
        }
        const list = Array.isArray(d.questions) ? d.questions : [];
        setPcOpen(true);
        setQuestions(
          list
            .filter((q): q is { id: unknown; text: unknown } => !!q && typeof q === "object")
            .map((q) => ({ id: String(q.id ?? ""), text: typeof q.text === "string" ? q.text : "" }))
            .filter((q) => q.text !== ""),
        );
      })
      .catch(() => undefined); // 網が切れても聞けないだけ（質問は出さない・そのまま出せる）
  };

  const markBad = (name: string, reason: string) => {
    badSeq.current += 1;
    const key = `bad-${badSeq.current}`;
    setBadFiles((prev) => [...prev, { key, name, reason }]);
  };

  const uploadOne = async (file: File): Promise<void> => {
    if (file.size > ATTACH_MAX_BYTES) {
      taken.current -= 1;
      markBad(file.name, errorText("E-GST-181").title);
      return;
    }
    const data = await base64Of(file);
    const r = await call("uploadPortalAttachment", {
      body: { name: file.name, content_type: file.type || "application/octet-stream", data },
      keepOn401: true,
      screenId: SCREEN,
    });
    if (r.ok) {
      const id = String((r.data as { id?: unknown } | undefined)?.id ?? "");
      setFiles((prev) => [...prev, { id, name: file.name }]);
      return;
    }
    taken.current -= 1;
    if (r.kind === "unauthenticated") {
      setExpired(true);
      return;
    }
    markBad(file.name, titleOf(r));
  };

  const addFiles = (list: File[]) => {
    const room = Math.max(0, ATTACH_MAX_COUNT - taken.current);
    const take = list.slice(0, room);
    taken.current += take.length;
    void (async () => {
      for (const f of take) {
        try {
          await uploadOne(f);
        } catch {
          taken.current -= 1; // 網が切れた：その 1 つは足せなかった
          markBad(f.name, errorText(PAGE_ERROR.loadFailed).title);
        }
      }
    })();
  };

  const removeFile = (id: string) => {
    taken.current -= 1;
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const failWith = (r: CallErr) => {
    if (r.kind === "unauthenticated") return setExpired(true);
    if (r.code === "E-GST-160") return setError({ title: errorText("E-GST-160").title });
    if (r.kind === "invalid" && ("due_on" in r.fields || "body" in r.fields)) {
      if ("due_on" in r.fields) setDueError(errorText("E-VAL-012").title);
      if ("body" in r.fields) setBodyError(r.fields["body"] || BODY_EMPTY);
      return;
    }
    if (r.kind === "forbidden") {
      const t = errorText(PAGE_ERROR.forbidden);
      return setError({ title: t.title, body: t.body });
    }
    setError(CREATE_FAILED);
  };

  const submit = () => {
    if (busyRef.current) return;
    setError(null);
    setDueError(null);
    if (body.trim() === "") {
      setBodyError(BODY_EMPTY);
      return;
    }
    setBodyError(null);
    busyRef.current = true;
    setBusy(true);
    void call("createPortalRequest", {
      body: { body, due_on: due === NO_DUE ? null : due, attachment_ids: files.map((f) => f.id) },
      keepOn401: true,
      screenId: SCREEN,
    })
      .then((r) => {
        if (r.ok) {
          setSent(true);
          setBody("");
          setFiles([]);
          setBadFiles([]);
          taken.current = 0;
          return;
        }
        failWith(r);
      })
      .catch(() => setError(CREATE_FAILED))
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  };

  const attachFull = files.length >= ATTACH_MAX_COUNT ? errorText("E-GST-183").title : null;

  return {
    body,
    setBody,
    onBlurBody,
    bodyError,
    questions,
    pcOpen,
    due,
    setDue,
    dueChoices,
    dueError,
    files,
    badFiles,
    attachFull,
    addFiles,
    removeFile,
    busy,
    error,
    submit,
    sent,
    expired,
  };
}
