// 問い合わせる小窓（K-953）の口：ファイルを付ける（上げる先の口 → 上げる先へ PUT → 上げ終わりへ POST）と、問い合わせを送る（createInquiry）。
//   体は口を通さず、関門 C4 が大きさと種類を署名した置き場へ直に送る（K-950・口の体の上限を通らない）。
//   送った後は自分の問い合わせ（鍵 ["k956","inquiries"]）を読み直す（別 GET で画面と答えを合わせる）
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Ops } from "@kaname/contracts";
import { errorCodeOf, PAGE_ERROR } from "@/components/k";
import { call } from "@/lib/api/call";
import { postUploadDone, putSignedUpload, type UploadTarget } from "@/lib/upload-net";
import { FILE_TEXT, type AskContext } from "./ask-shape";
import { INQUIRIES_KEY } from "./use-help";

const SCREEN = "inquiry";

/** 付けた結果：付いた（id を持つ）か、行に出す理由の字 */
export type UploadResult = { ok: true; id: string } | { ok: false; text: string };

const isTarget = (v: unknown): v is UploadTarget => {
  const t = v as Partial<UploadTarget> | null;
  return !!t && typeof t.id === "string" && typeof t.upload_url === "string" && typeof t.done_url === "string";
};

/** 上げ終わりの断り → 行の字（415 種類・413 大きさ。ほかは付けられなかった） */
async function doneText(r: Response): Promise<string> {
  const j = (await r.json().catch(() => ({}))) as { code?: unknown };
  if (r.status === 415 || j.code === "E-INQ-003") return FILE_TEXT.type;
  if (r.status === 413 || j.code === "E-INQ-004") return FILE_TEXT.big;
  return FILE_TEXT.failed;
}

/** 1 つのファイルを付ける。どこで失敗しても投げずに理由の字を返す（送る体に入れない） */
export async function uploadAttachment(file: File): Promise<UploadResult> {
  try {
    const body = { name: file.name, content_type: file.type, size: file.size };
    const r = await call("uploadInquiryAttachment", {
      body: body as unknown as Ops["uploadInquiryAttachment"]["body"],
      screenId: SCREEN,
    });
    if (!r.ok || !isTarget(r.data)) return { ok: false, text: FILE_TEXT.failed };
    const target = r.data;
    const put = await putSignedUpload(target, file);
    if (!put.ok) return { ok: false, text: FILE_TEXT.failed };
    const done = await postUploadDone(target);
    if (done.status !== 200) return { ok: false, text: await doneText(done) };
    return { ok: true, id: target.id };
  } catch {
    return { ok: false, text: FILE_TEXT.failed };
  }
}

export interface InquiryDraft {
  topic: "usage" | "trouble" | "billing" | "other";
  title: string;
  body: string;
  attachmentIds: readonly string[];
  context: AskContext | null;
}

/** 口が断った番号（正本の id）。網の切れは E-PAGE-007 */
export class AskSendError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** 問い合わせを送る。答えを待つ間は押し直しを止めるのは呼ぶ側（isPending）。済んだら自分の問い合わせを読み直す */
export function useCreateInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: InquiryDraft): Promise<{ id: string }> => {
      const body: Record<string, unknown> = { topic: d.topic, title: d.title, body: d.body };
      if (d.attachmentIds.length) body["attachment_ids"] = [...d.attachmentIds];
      if (d.context) body["context"] = d.context;
      let r: Awaited<ReturnType<typeof call<"createInquiry">>>;
      try {
        r = await call("createInquiry", {
          body: body as unknown as Ops["createInquiry"]["body"],
          screenId: SCREEN,
        });
      } catch {
        throw new AskSendError(PAGE_ERROR.loadFailed);
      }
      if (!r.ok) throw new AskSendError(r.status === 503 ? PAGE_ERROR.down : errorCodeOf(r));
      const id = (r.data as { id?: unknown } | null)?.id;
      return { id: typeof id === "string" ? id : "" };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: INQUIRIES_KEY }),
  });
}
