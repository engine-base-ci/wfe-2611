"use client";
// 自分の設定 › プロフィール（K-839・画面 account・行為 A74）。外枠 MeShell の中に部品 ProfileBody（K-801）。
//   開くと口 getMe を 1 回（use-me.ts）。名前・呼ばれ方は欄を離れたとき・Enter で updateMe（直した欄だけ）・見え方は選んだ欄だけ・
//   顔は uploadAvatar（multipart の file・文字に戻すは reset=true だけ）。書いた答えで差し替え、読み直さない。
//   401 は call が入り直しへ送る。読めないときは ErrorState と「もう一度読む」
import { useEffect, useRef, useState } from "react";
import { Button, Callout, ErrorState, Loading, PAGE_ERROR, applyTheme, errorCodeOf, errorText } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import {
  PHOTO_MAX_BYTES,
  PHOTO_TOO_BIG,
  SAVE_FAILED,
  cleanText,
  clockText,
  nameProblem,
  nickProblem,
  toProfileState,
  toWsRows,
  type MeAnswer,
  type MeAvatar,
  type MeSaved,
  type MeTheme,
  type MeWeek,
  type MeZone,
} from "./me-shape";
import { MeShell } from "./me-shell";
import { ProfileBody } from "./profile";
import { inertDialogs, useOpenDialog } from "./profile-dialogs";
import { setLeaveNote, useLeaveNote } from "./use-leave";
import { ME_SCREEN, useMe, useMeCache } from "./use-me";

/** 口へ送る体（自分の欄だけ） */
type MePatch = Partial<{
  name: string;
  call_name: string | null;
  theme: MeTheme;
  week_start: MeWeek;
  timezone: MeZone;
}>;
interface View {
  theme: MeTheme;
  week: MeWeek;
  zone: MeZone;
}

/** 調子が悪い（503・網の切れ）の字 */
const downText = (): string => errorText(PAGE_ERROR.down).entry.message;
/** 口の断りの字（口の文が無ければ正本の 1 件） */
const refusalText = (r: CallErr): string =>
  r.status === 503 ? downText() : (r.message ?? errorText(errorCodeOf(r)).entry.message);

async function patchMe(body: MePatch): Promise<{ ok: true; saved: MeSaved } | { ok: false; err: CallErr | null }> {
  try {
    const r = await call("updateMe", { body, screenId: ME_SCREEN });
    return r.ok ? { ok: true, saved: r.data as unknown as MeSaved } : { ok: false, err: r };
  } catch {
    return { ok: false, err: null }; // 網が切れた
  }
}

/** 名前・呼ばれ方の保存（同じ値・誤り・処理中は送らない） */
function useTextSave(me: MeAnswer | undefined, replace: ReturnType<typeof useMeCache>["replaceMe"]) {
  const busy = useRef(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [savedAt, setSavedAt] = useState<string | undefined>();
  const [fieldErr, setFieldErr] = useState<{ name?: string; call_name?: string }>({});
  const save = async (field: "name" | "call_name", text: string) => {
    if (!me || busy.current) return;
    const clean = cleanText(text);
    if (field === "name" ? nameProblem(clean) : nickProblem(clean)) return;
    const value = field === "call_name" && clean === "" ? null : clean;
    const now = field === "name" ? me.member.name : me.member.call_name;
    if (value === now) return;
    busy.current = true;
    const r = await patchMe(field === "name" ? { name: clean } : { call_name: value });
    busy.current = false;
    if (r.ok) {
      replace((a) => ({ ...a, member: r.saved.member }));
      setSavedAt(clockText(r.saved.saved_at));
      setNotice(undefined);
      setFieldErr({});
      return;
    }
    if (r.err?.kind === "unauthenticated") return; // call が入り直しへ送る
    setSavedAt(undefined);
    if (r.err?.kind === "invalid") {
      setFieldErr({ [field]: r.err.fields[field] ?? r.err.message ?? SAVE_FAILED });
      return;
    }
    setNotice(SAVE_FAILED);
  };
  return { save, notice, savedAt, fieldErr };
}

/** 見え方の保存（選びはすぐ変え、失敗したら前に戻す） */
function useViewSave(me: MeAnswer | undefined, replace: ReturnType<typeof useMeCache>["replaceMe"]) {
  const [picked, setPicked] = useState<Partial<View>>({});
  const [notice, setNotice] = useState<string | undefined>();
  const view: View | undefined = me
    ? {
        theme: picked.theme ?? me.member.theme,
        week: picked.week ?? me.member.week_start,
        zone: picked.zone ?? me.member.timezone,
      }
    : undefined;
  const pick = async <K extends keyof View>(key: K, value: View[K]) => {
    if (!me || view?.[key] === value) return;
    setPicked((p) => ({ ...p, [key]: value }));
    const body: MePatch =
      key === "theme"
        ? { theme: value as MeTheme }
        : key === "week"
          ? { week_start: value as MeWeek }
          : { timezone: value as MeZone };
    const r = await patchMe(body);
    setPicked((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== key)) as Partial<View>);
    if (r.ok) {
      replace((a) => ({ ...a, member: r.saved.member }));
      if (key === "theme") applyTheme(r.saved.member.theme);
      setNotice(undefined);
      return;
    }
    if (r.err?.kind === "unauthenticated") return;
    setNotice(r.err ? refusalText(r.err) : downText());
  };
  return { view, pick, notice };
}

/** 顔の写真（5 MB を超える物は送らない） */
function useFaceSave(replace: ReturnType<typeof useMeCache>["replaceMe"]) {
  const busy = useRef(false);
  const [notice, setNotice] = useState<string | undefined>();
  const send = async (form: FormData) => {
    if (busy.current) return;
    busy.current = true;
    let r;
    try {
      r = await call("uploadAvatar", { form, screenId: ME_SCREEN });
    } catch {
      r = null; // 網が切れた
    } finally {
      busy.current = false;
    }
    if (r?.ok) {
      const avatar = (r.data as unknown as { avatar: MeAvatar }).avatar;
      replace((a) => ({ ...a, member: { ...a.member, avatar } }));
      setNotice(undefined);
      return;
    }
    if (r && !r.ok && r.kind === "unauthenticated") return;
    setNotice(r && !r.ok ? refusalText(r) : downText());
  };
  return {
    notice,
    onFile: (file: File) => {
      if (file.size > PHOTO_MAX_BYTES) {
        setNotice(PHOTO_TOO_BIG);
        return;
      }
      const form = new FormData();
      form.append("file", file);
      void send(form);
    },
    onReset: () => {
      const form = new FormData();
      form.append("reset", "true");
      void send(form);
    },
  };
}

/** 抜けたあと・会社が無いときの知らせ（K-841・小窓が閉じた後も残す） */
function LeaveNotice() {
  const note = useLeaveNote();
  useEffect(() => () => setLeaveNote(null), []); // 画面を離れたら消す
  if (!note) return null;
  return (
    <div className="k-me-page">
      <Callout tone={note.tone}>{note.text}</Callout>
    </div>
  );
}

function ReadFailed({ err, retry }: { err: CallErr | null; retry: () => void }) {
  const code = err ? errorCodeOf(err) : PAGE_ERROR.loadFailed;
  return (
    <section className="k-page k-me-page" aria-labelledby={`k-err-${code}`}>
      <ErrorState code={code} />
      <div className="k-state-actions">
        <Button variant="primary" onClick={retry}>
          もう一度読む
        </Button>
      </div>
    </section>
  );
}

export function ProfileScreen() {
  const q = useMe();
  const me = q.data;
  const { replaceMe, reloadMe } = useMeCache();
  const text = useTextSave(me, replaceMe);
  const look = useViewSave(me, replaceMe);
  const face = useFaceSave(replaceMe);
  const dialog = useOpenDialog(me, { replace: replaceMe, reload: reloadMe });
  const inert = inertDialogs();

  let body;
  if (q.isError) body = <ReadFailed err={q.error.err} retry={() => void q.refetch()} />;
  else if (!me || !look.view) body = <Loading />;
  else
    body = (
      <ProfileBody
        p={toProfileState(me)}
        onName={(t) => void text.save("name", t)}
        onNick={(t) => void text.save("call_name", t)}
        onTheme={(t) => void look.pick("theme", t)}
        onWeek={(n) => void look.pick("week", n)}
        onZone={(z) => void look.pick("zone", z)}
        onFile={face.onFile}
        onResetFace={face.onReset}
        onEmail={() => dialog.open("email")}
        onLeave={(id) =>
          dialog.open(
            "leave",
            me.workspaces.find((w) => w.tenant_id === id),
          )
        }
        notice={text.notice}
        viewNotice={look.notice}
        faceNotice={face.notice}
        {...(text.fieldErr.name ? { nameError: text.fieldErr.name } : {})}
        {...(text.fieldErr.call_name ? { nickError: text.fieldErr.call_name } : {})}
        {...(text.savedAt ? { savedAt: text.savedAt } : {})}
        inertButtons={inert}
        workspaces={toWsRows(me.workspaces)}
        theme={look.view.theme}
        week={look.view.week}
        zone={look.view.zone}
      />
    );
  return (
    <MeShell current="profile">
      <LeaveNotice />
      {body}
      {dialog.node}
    </MeShell>
  );
}
