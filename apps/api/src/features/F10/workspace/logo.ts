// 会社のロゴを変える口（K-828）：uploadWorkspaceLogo（POST /api/v1/workspace/logo・multipart の欄 file 1 つ・D-154.4）。
//   入口（op.ts）が先に確かめる：送る量（2 MB ＋ 余白を超えたら 413・E-WS-010）・ログイン（401）・権限（管理者の束・403）・上限・
//   multipart でない体（422・欄 body）。体は入口が FormData に読んで a.form で渡す（c.req.parseBody() は使わない）。順：
//   ① file の欄がファイルでなければ 422（欄 file）② ファイルの大きさが 2 MB を超えれば 413・E-WS-010（種類より先に見る）
//   ③ 中身の先頭の印で種類を見る（content-type と名前は信じない）。PNG・JPEG・WebP でなければ 422・E-WS-011
//   ④ 置き場に置く（関門 C4・objects.put）。置けなければ 502・E-WS-012（logo_ref は変えない）
//   ⑤ 1 つの取引（app.workspace_logo_set）で logo_ref を新しい ref に・記録 workspace.logo_changed。落ちたら新しい実体を消してから 503・E-PAGE-003
//   ⑥ 前の実体を消す後片付け（失敗してもログ 1 行・201 のまま）⑦ 201 { data: { logo: { kind: "image", url } } }
//   ログには場所と例外の種類だけ（ref・宛ての値・中身を出さない）
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookDeps } from "../../../hooks/registry.js";
import { contentTypeOf, IMAGE_HEAD_BYTES, imageKind } from "../image-kind.js";

/** ロゴの大きさの上限（2 MB・D-154.4・下絵 st-logo の字） */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
/** 答えの url の期限（秒・読む口 K-827 と同じ） */
const URL_TTL_SEC = 600;

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const known = (code: string, status: number): HookReply => {
  const { detail: _detail, ...body } = kanameError(code).toJSON();
  void _detail;
  return { status, body };
};
/** 413・E-WS-010（入口の余白を超えた体と、口のファイルの大きさで同じ答え） */
export const logoTooLarge = (): HookReply => known("E-WS-010", 413);
const badFile = (): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field: "file", message: "ファイル" }] },
});

export function createUploadWorkspaceLogo(d: Pick<HookDeps, "appPool" | "objects">) {
  return async (a: HookArgs): Promise<HookReply> => {
    const file = a.form?.get("file");
    if (!(file instanceof File)) return badFile();
    if (file.size > LOGO_MAX_BYTES) return logoTooLarge();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = imageKind(bytes.subarray(0, IMAGE_HEAD_BYTES));
    if (!kind) return known("E-WS-011", 422);

    const put = await d.objects.put(a.ctx, bytes, { contentType: contentTypeOf(kind), retentionDays: null });
    if (put.status !== "done") return known("E-WS-012", 502);
    const ref = put.value.ref;

    let prev: string | null;
    try {
      prev = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ prev: string | null }>("select app.workspace_logo_set($1) as prev", [ref]);
        return r.rows[0]?.prev ?? null;
      });
    } catch (e) {
      await removeQuietly(d, a, ref, "置いたロゴを消せなかった");
      if (kindOf(e) === "42501") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
      console.error(`[workspace-logo] ロゴを書く取引が落ちた（${kindOf(e)}）`);
      return known("E-PAGE-003", 503);
    }
    if (prev && prev !== ref) await removeQuietly(d, a, prev, "前のロゴを消せなかった");

    const signed = await d.objects.signUrl(a.ctx, ref, URL_TTL_SEC);
    const logo = signed.status === "done" ? { kind: "image", url: signed.value.url } : { kind: "text", url: null };
    return { status: 201, body: { data: { logo } } };
  };
}

/** 後片付け：実体を消す。消せなくても答えは変えず、ログに 1 行（ref は出さない） */
async function removeQuietly(d: Pick<HookDeps, "objects">, a: HookArgs, ref: string, what: string): Promise<void> {
  try {
    const r = await d.objects.delete(a.ctx, ref);
    if (r.status !== "done") console.error(`[workspace-logo] ${what}（${r.status}）`);
  } catch (e) {
    console.error(`[workspace-logo] ${what}（${kindOf(e)}）`);
  }
}
