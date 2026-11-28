"use client";
// 運営のお知らせを書く・書き直す・出す（/ops/notices/new・/ops/notices/<id>/edit・K-1015）の入れ物。
//   外枠の caps に notice が無ければ本文は NoAccess（お知らせの口を呼ばない）。書き直すは 1 件（K-980 の鍵）を読んで欄に入れる。
//   書くは 2 回の口：［下書きにする］＝作るだけ／［出す］＝作る（まだなら・書き直す頁で変えた欄があれば直す）→ 確かめ → 出す。
//   送っている間は 2 回目を送らない。断り・落ちたは赤い箱で、書いた字は残る（G-15）
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { ErrorState, NoAccess, PageBody, PageHeader } from "@/components/k";
import { errorCodeOf, PAGE_ERROR } from "@/components/k/error-of";
import type { CallErr } from "@/lib/api/call";
import {
  editBody,
  emptyForm,
  formOf,
  lockedOf,
  noticeBody,
  PLAN_KEYS,
  PLAN_LABEL,
  publishBullets,
  publishDescription,
  shortLocal,
  type NoticeDetail,
  type NoticeForm,
} from "./notice-form";
import { useNoticeWrites, useOpsCaps, useOpsNotice, useWsPicks, type WriteResult } from "./use-ops-notices";
import { NoticeNewPage, NoticePublishConfirm } from "./views-notices";

const PLAN_OPTIONS = PLAN_KEYS.map((k) => ({ value: k, label: PLAN_LABEL[k] ?? k }));
const noticePath = (id: string) => `/ops/notices/${encodeURIComponent(id)}` as Route;

/** 口の失敗 → 赤い箱の字（正本の 1 件。網の切れ・形が違うは読み込めなかった） */
function failText(err: CallErr | null): string {
  const code = err ? errorCodeOf(err) : PAGE_ERROR.loadFailed;
  return CATALOG[code]?.message ?? CATALOG[PAGE_ERROR.loadFailed]?.message ?? "";
}

/** 読めない・見えないときの頁（見出しと中身だけ） */
function Fallback({
  edit,
  kind,
  retry,
}: {
  edit: boolean;
  kind: "forbidden" | "missing" | "failed";
  retry?: () => void;
}) {
  return (
    <PageBody labelledBy="oq-notice-new-title">
      <PageHeader id="oq-notice-new-title" title={edit ? "お知らせを書き直す" : "お知らせを書く"} />
      {kind === "forbidden" ? (
        <NoAccess />
      ) : kind === "missing" ? (
        <ErrorState code={PAGE_ERROR.notFound} acts={["/ops/notices"]} />
      ) : (
        <ErrorState code={PAGE_ERROR.loadFailed} acts={retry ? [retry] : []} />
      )}
    </PageBody>
  );
}

export function NoticeWriteScreen({ id }: { id?: string }) {
  const edit = id !== undefined;
  const router = useRouter();
  const pathname = usePathname();
  const { pending, caps } = useOpsCaps();
  const allowed = caps.includes("notice");
  const one = useOpsNotice(allowed && edit ? id : null);
  const login = one.data?.kind === "login";
  useEffect(() => {
    if (login) router.replace(`/ops/login?next=${encodeURIComponent(pathname)}` as Route);
  }, [login, router, pathname]);

  if (pending) return null;
  if (!allowed) return <Fallback edit={edit} kind="forbidden" />;
  if (!edit) return <WriteBody detail={null} />;
  if (one.isPending || login) return null;
  const r = one.data;
  if (r?.kind === "forbidden") return <Fallback edit kind="forbidden" />;
  if (r?.kind === "missing") return <Fallback edit kind="missing" />;
  if (r?.kind !== "ok") return <Fallback edit kind="failed" retry={() => void one.refetch()} />;
  return <WriteBody key={r.data.id} detail={r.data} />;
}

function WriteBody({ detail }: { detail: NoticeDetail | null }) {
  const router = useRouter();
  const edit = detail !== null;
  const locked = detail ? lockedOf(detail) : false;
  const [form, setForm] = useState<NoticeForm>(() => (detail ? formOf(detail) : emptyForm()));
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<NoticeDetail | null>(detail);
  const [confirm, setConfirm] = useState<NoticeDetail | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const picks = useWsPicks(form.audience === "workspaces");
  const { create, update, publish } = useNoticeWrites();

  /** 1 回だけ送る（送っている間の押し直しは捨てる） */
  const once = async (job: () => Promise<void>) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await job();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  /** 今の欄を口に残す：まだ作っていなければ作る・作った物は変えた欄だけ直す。残した 1 件（断られたら null） */
  const save = async (): Promise<NoticeDetail | null> => {
    let r: WriteResult;
    if (made) {
      const body = editBody(made, form);
      if (Object.keys(body).length === 0) return made;
      r = await update.mutateAsync({ id: made.id, body });
    } else {
      const body = noticeBody(form);
      if (!body) return null;
      r = await create.mutateAsync(body);
    }
    if (!r.ok) {
      setError(failText(r.err));
      return null;
    }
    setError(null);
    setMade(r.data);
    return r.data;
  };

  const onDraft = () =>
    void once(async () => {
      const saved = await save();
      if (saved) router.push(noticePath(saved.id));
    });
  const onPublish = () =>
    void once(async () => {
      const saved = await save();
      if (!saved) return;
      setConfirmError(null);
      setConfirm(saved);
    });
  const onConfirm = () =>
    void once(async () => {
      if (!confirm) return;
      const r = await publish.mutateAsync(confirm.id);
      if (!r.ok) {
        setConfirmError(failText(r.err));
        return;
      }
      router.push(noticePath(confirm.id));
    });

  const workspaces = picks.data ?? [];
  return (
    <>
      <NoticeNewPage
        edit={edit}
        form={form}
        onForm={setForm}
        locked={locked}
        plans={PLAN_OPTIONS}
        workspaces={workspaces}
        onDraft={onDraft}
        onPublish={onPublish}
        {...(detail ? { onCancel: () => router.push(noticePath(detail.id)) } : {})}
        publishLabel={form.when === "date" && form.at ? `${shortLocal(form.at)} に出す` : "出す"}
        busy={busy}
        error={error}
        workspacesError={picks.isError ? failText(null) : null}
        onRetryWorkspaces={() => void picks.refetch()}
      />
      {confirm ? (
        <NoticePublishConfirm
          open
          onClose={() => setConfirm(null)}
          onConfirm={onConfirm}
          bullets={publishBullets(confirm)}
          description={publishDescription(confirm)}
          error={confirmError}
          busy={busy}
        />
      ) : null}
    </>
  );
}
