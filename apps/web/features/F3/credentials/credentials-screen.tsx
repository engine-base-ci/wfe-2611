"use client";
// 預けたログイン情報（K-356・画面 credentials・道 /settings/credentials）。外枠（TicketShell）の中に、自分の設定の第 2 ナビ（MeSub・「預けたログイン情報」）と本文。
//   見た目はモック /dev/mock/f3/cred-* と同じ部品（views.tsx）。動き：開くと一覧の口 listCredentials を 1 回 → 値の直し方（to-item.ts）→ 層でタブに分ける。
//   タブを替えても口を呼ばない。401 はログインへ（next はこの道）・ほかの失敗と網の切れは部品の「読めない」（赤の箱）。
//   「預ける」は小窓（add-credential.tsx・K-372）。預けたら一覧を読み直し（別 GET）、自分だけに預けたら「自分だけ」のタブへ。
//   はじめの設定の途中（段が 4 より小さい）の人が 1 件預けたら段 4 を通す（D-089・段を通す口を 1 回）。失敗しても預けたことは成功のまま（知らせを出さない）。
//   行の操作（K-357）：上書き（edit-credential.tsx）・消す（remove-credential.tsx）・コードを入れる／もう一度確かめる（check-credential.tsx）。押したら入れ物が一覧を読み直す（別 GET）。
//   確かめている（checking）かコード待ち（needs_code）の行がある間だけ、答えが来てから 3 秒後に一覧を読み直す（同時に 2 本出さない・読み直しの失敗は前の行のまま次でまた読む・頁を離れたら止める）
//   会社名と名前は外枠と同じ問い合わせ（鍵 ["me"]）の答え。口は増えない
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loading, MeSub, useNotify } from "@/components/k";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { me } from "@/lib/auth/ext";
import { useMarkStep, useSetupStep } from "@/lib/onboarding";
import { ONCE, TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { useAddCredential } from "./add-credential";
import { useCheckCredential } from "./check-credential";
import { useEditCredential } from "./edit-credential";
import { useRemoveCredential } from "./remove-credential";
import { toItem, type CredentialAnswer, type CredentialRow, type Layer } from "./to-item";
import { CredentialsBody, CredentialsHead } from "./views";

const SCREEN = "credentials";
/** 預けると通す段（はじめの設定の「4. ログイン情報」・D-089） */
const CREDENTIAL_STEP = 4;
const PATH = "/settings/credentials";
const loginUrl = (): string => `/login?next=${encodeURIComponent(PATH)}`;
/** 確かめている・コード待ちの間の読み直しの間（答えが来てから数える） */
const POLL_MS = 3_000;

/** 一覧の読み：null は読んでいる途中・"failed" は読めなかった */
type ListState = CredentialRow[] | "failed" | null;

/** 読み直しが要る（PC がログインして確かめている・コードを待っている行がある） */
const needsPolling = (list: ListState): boolean =>
  Array.isArray(list) && list.some((it) => it.state === "checking" || it.state === "needs_code");

function useCredentialList(): { list: ListState; load: (quiet?: boolean) => Promise<void> } {
  const [list, setList] = useState<ListState>(null);
  const inflight = useRef(false);
  /** quiet：読み直しの失敗は前の行のまま（赤の箱にしない） */
  const load = useCallback(async (quiet = false) => {
    inflight.current = true;
    try {
      const r = await call("listCredentials", { screenId: SCREEN });
      if (r.ok) {
        const now = new Date();
        setList((r.data as CredentialAnswer[]).map((c) => toItem(c, now)));
        return;
      }
      if (r.kind === "unauthenticated") {
        window.location.replace(loginUrl());
        return;
      }
      if (!quiet) setList("failed");
    } catch {
      if (!quiet) setList("failed"); // 網が切れた（口に届かない）
    } finally {
      inflight.current = false;
    }
  }, []);
  const polling = needsPolling(list);
  useEffect(() => {
    if (!polling) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      timer = setTimeout(async () => {
        if (!inflight.current) await load(true);
        if (!stopped) next();
      }, POLL_MS);
    };
    next();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [polling, load]);
  return { list, load };
}

/** 外枠と同じ鍵の自分の情報（会社名は workspace_name・K-253） */
type Me = Awaited<ReturnType<typeof me>> & { workspace_name?: string | null };

export function CredentialsScreen() {
  const { list, load } = useCredentialList();
  const [tab, setTab] = useState<Layer>("workspace");
  const started = useRef(false);
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const mine = who.isSuccess ? (who.data as Me) : null;
  const workspaceName = mine?.workspace_name?.trim() ?? "";
  const setup = useSetupStep();
  const markStep = useMarkStep();

  /** はじめの設定の途中の人なら段 4 を通す。失敗しても預けたことは成功のまま（次に預けたときにもう一度通す） */
  const passStep = async () => {
    try {
      const step = setup.step ?? (await setup.refetch()).data?.step ?? null;
      if (step !== null && step < CREDENTIAL_STEP) await markStep(CREDENTIAL_STEP);
    } catch {
      // 段の記録だけが失敗した：知らせない
    }
  };
  const notify = useNotify();
  const notifyError = (text: string) => notify(text, { type: "error" });
  const reload = () => load();
  const edit = useEditCredential({ onChanged: reload, notifyError });
  const remove = useRemoveCredential(reload);
  const check = useCheckCredential({ onChanged: reload, notifyError });
  const add = useAddCredential({
    workspaceName,
    onCreated: async (layer) => {
      if (layer === "personal") setTab("personal");
      await Promise.all([load(), passStep()]);
    },
  });

  // ログインしていなければ、口を呼ばずにログインへ（戻り先はこの道）
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!getToken()) {
      window.location.replace(loginUrl());
      return;
    }
    void load();
  }, [load]);

  const rows = Array.isArray(list) ? list : [];
  const items = rows.filter((it) => it.layer === tab);
  const rowOf = (id: string) => rows.find((it) => it.id === id);
  return (
    <TicketShell screen={SCREEN} crumbs={[{ label: "自分の設定", disabled: true }, { label: "預けたログイン情報" }]}>
      <div className="k-me-wrap">
        <MeSub current="credentials" />
        <section className="k-page k-me-page" aria-labelledby="credentials-title">
          <CredentialsHead addReady onAdd={add.open} />
          {list === null ? (
            <Loading />
          ) : (
            <CredentialsBody
              workspaceName={workspaceName}
              personalName={mine?.display_name ?? ""}
              tab={tab}
              onTab={setTab}
              items={items}
              failed={list === "failed"}
              rowActionsReady
              recheckingId={check.rechecking}
              onEdit={(id) => {
                const it = rowOf(id);
                if (it) edit.open(it);
              }}
              onRemove={(id) => {
                const it = rowOf(id);
                if (it) remove.open(it.id, it.name);
              }}
              onRecheck={check.recheck}
              onCode={(id) => {
                const it = rowOf(id);
                if (it) check.openCode(it);
              }}
            />
          )}
        </section>
      </div>
      {add.ui}
      {edit.ui}
      {remove.ui}
      {check.ui}
    </TicketShell>
  );
}
