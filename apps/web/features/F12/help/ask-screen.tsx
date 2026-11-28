"use client";
// 問い合わせる小窓（K-953・画面 inquiry・道 /inquiry）。困ったとき・お知らせのホーム（K-956 の HelpScreen）の上に小窓を開いた形。
//   見た目はモック /dev/mock/f12-user/uh-ask・uh-ask-invalid・uh-ask-file・uh-ask-sent と同じ部品（views.tsx の AskDialog）。
//   題と内容は JS が先に確かめる（口を呼ばない）。ファイルは付けた時に確かめ、通った物だけ上げる先へ送る（上げている間は送れない）。
//   送ったら /notices?sent=1 へ（ホームに「運営に届きました」）。口が断ったら小窓の上の赤い箱で、閉じずに中身を残す
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useQueryClient } from "@tanstack/react-query";
import { errorText } from "@/components/k";
import { askContext, askProblems, fileProblem, fileSize, tidy, TOPIC_OF } from "./ask-shape";
import { HelpScreen } from "./help-screen";
import { AskSendError, uploadAttachment, useCreateInquiry } from "./use-ask";
import { AskDialog, type AskFile, type AskNotice } from "./views";

const HOME = "/notices";
const ASK_PATH = "/inquiry";
const DEVICES_KEY = ["k138-shell", "devices"] as const;
const KIND_FIRST = "使い方";

interface FileRow extends AskFile {
  key: number;
  id?: string;
}

const noticeOf = (code: string): AskNotice => ({ code, text: errorText(code).entry.message });

export function AskScreen({ from }: { from?: string | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const create = useCreateInquiry();
  const [kind, setKind] = useState(KIND_FIRST);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [withScreen, setWithScreen] = useState(true);
  const [files, setFiles] = useState<readonly FileRow[]>([]);
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<AskNotice | null>(null);
  const nextKey = useRef(0);
  /** 今付いている（付けている途中も含む）数。続けて付けたときも数え違えないよう、描く前の値を持つ */
  const kept = useRef(0);

  const problems = tried ? askProblems({ title, body }) : {};
  const uploading = files.some((f) => f.pending);
  const sending = create.isPending || uploading;

  const patch = (key: number, next: Partial<FileRow>): void =>
    setFiles((rows) => rows.map((r) => (r.key === key ? { ...r, ...next } : r)));

  const pickFiles = (picked: File[]): void => {
    const rows: FileRow[] = [];
    const go: { key: number; file: File }[] = [];
    for (const file of picked) {
      const key = nextKey.current++;
      const why = fileProblem(file, kept.current);
      if (why) {
        rows.push({ key, name: file.name, size: fileSize(file.size), error: why });
        continue;
      }
      kept.current += 1;
      rows.push({ key, name: file.name, size: fileSize(file.size), pending: true });
      go.push({ key, file });
    }
    setFiles((now) => [...now, ...rows]);
    for (const { key, file } of go) {
      void uploadAttachment(file).then((r) => {
        if (r.ok) {
          patch(key, { pending: false, id: r.id });
          return;
        }
        kept.current -= 1;
        patch(key, { pending: false, error: r.text });
      });
    }
  };

  const cancel = (): void => router.replace(HOME as Route);

  const send = (): void => {
    if (sending) return;
    setTried(true);
    if (Object.keys(askProblems({ title, body })).length) return;
    setNotice(null);
    const pc = qc.getQueryData<boolean>(DEVICES_KEY);
    const context = withScreen
      ? askContext({ from, here: ASK_PATH, ua: navigator.userAgent, pc: pc ?? null, at: new Date() })
      : null;
    create.mutate(
      {
        topic: TOPIC_OF[kind] ?? "other",
        title: tidy(title),
        body: tidy(body),
        attachmentIds: files.flatMap((f) => (f.id && !f.error ? [f.id] : [])),
        context,
      },
      {
        onSuccess: () => router.push(`${HOME}?sent=1` as Route),
        onError: (e) => setNotice(noticeOf(e instanceof AskSendError ? e.code : "E-PAGE-007")),
      },
    );
  };

  return (
    <>
      <HelpScreen />
      <AskDialog
        kind={kind}
        title={title}
        body={body}
        files={files}
        withScreen={withScreen}
        errors={problems}
        onKind={setKind}
        onTitle={setTitle}
        onBody={setBody}
        onWithScreen={setWithScreen}
        onPickFiles={pickFiles}
        onSend={send}
        onCancel={cancel}
        sending={sending}
        notice={notice}
      />
    </>
  );
}
