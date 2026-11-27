// 自分の顔の写真の口（K-834）：uploadAvatar（POST /api/v1/me/avatar・D-154.50・D-154.55・D-154.56・D-154.57）。
//   体は入口（op.ts）の multipart の道（K-828）で読まれ、FormData が a.form で渡る（c.req.parseBody() は使わない）。
//   入口が先に確かめる：ログイン（401）・上限・体の先の長さ（5 MB ＋ 64 KB を超えれば hooks の tooLarge＝413・E-ME-010）。順：
//   ① 体の形：file か reset=true のどちらか 1 つ。どちらも無い・両方・reset が true 以外は 422（欄 file）
//   ② file.size が 5 MB を超えれば 413・E-ME-010（種類より先）
//   ③ reset なら DB（avatar_ref を空に）→ 前の実体を消す → 201 text
//   ④ 先頭 12 バイトを imageKind（K-828）で見る。PNG・JPEG・WebP でなければ 422・E-ME-011（content-type と名前は信じない）
//   ⑤ 置き場に置く（関門 C4）。置けなければ 502・E-ME-012（avatar_ref は変えない）
//   ⑥ DB（app.me_avatar_set）。落ちたら置いた新しい実体を消してから 503・E-PAGE-003
//   ⑦ 前の実体を消す（後片付け）。消せなくても 201 のまま・ログに 1 行（宛ての値は出さない）
//   ⑧ 201 { data: { avatar: { kind, initial, url } } }（getMe の member.avatar と同じ形）
//   顔の保存は会社の記録に載せない（D-154.55）。顔は今の会社の自分の行だけ（D-154.56）
import type { TenantContext } from "@kaname/db/context";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookDeps } from "../../../hooks/registry.js";
import { contentTypeOf, imageKind } from "../image-kind.js";

/** 顔の写真の上限（5 MB・D-154.57・下絵 me-avatar の字） */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
/** 種類を見る先頭のバイト数（WebP の RIFF ＋ 4 ＋ WEBP） */
const HEAD_BYTES = 12;
/** 期限つき URL の長さ（秒・K-833 の読む口と同じ） */
const URL_TTL_SEC = 600;

type Avatar = { kind: "image" | "text"; initial: string; url: string | null };
type Deps = Pick<HookDeps, "appPool" | "objects">;

const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};
const coded = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });
const badFile = (message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field: "file", message }] },
});
export const avatarTooLarge = (): HookReply => coded(413, "E-ME-010");
const unavailable = (where: string, e: unknown): HookReply => {
  console.error(`[me-avatar] ${where}（${kindOf(e)}）`);
  return coded(503, "E-PAGE-003");
};

/** 体の形：file か reset=true のどちらか 1 つ。合わなければ null */
function readForm(form: FormData | undefined): { file: File } | { reset: true } | null {
  if (!form) return null;
  const file = form.get("file");
  const reset = form.get("reset");
  const hasFile = file !== null;
  const hasReset = reset !== null;
  if (hasFile === hasReset) return null;
  if (hasReset) return reset === "true" ? { reset: true } : null;
  return file instanceof File ? { file } : null;
}

/** 呼ばれ方（無ければ名前）の 1 文字目 */
const initialOf = (callName: string | null, name: string): string =>
  Array.from((callName ?? "").trim() || name)[0] ?? "";

/** DB の取引：avatar_ref を新しい ref（null は文字に戻す）にし、前の ref と顔の頭文字を返す */
async function setRef(
  d: Deps,
  ctx: TenantContext,
  ref: string | null,
): Promise<{ old: string | null; initial: string }> {
  return withTenant(d.appPool, ctx, async (cl) => {
    const r = await cl.query<{ old: string | null }>("select app.me_avatar_set($1) as old", [ref]);
    const m = await cl.query<{ display_name: string; call_name: string | null }>(
      "select display_name, call_name from members where id = $1 and tenant_id = $2",
      [ctx.userId, ctx.tenantId],
    );
    const row = m.rows[0];
    return { old: r.rows[0]?.old ?? null, initial: row ? initialOf(row.call_name, row.display_name) : "" };
  });
}

/** 後片付け：前の実体を消す。消せなくても答えは変えず、ログに 1 行（宛ての値は出さない） */
async function dropOld(d: Deps, ctx: TenantContext, ref: string | null): Promise<void> {
  if (!ref) return;
  try {
    const r = await d.objects.delete(ctx, ref);
    if (r.status !== "done" || r.value === false) console.error("[me-avatar] 前の写真を消せなかった");
  } catch (e) {
    console.error(`[me-avatar] 前の写真を消せなかった（${kindOf(e)}）`);
  }
}

/** 置いた新しい実体を消す（DB が落ちたとき）。失敗はログだけ */
async function dropNew(d: Deps, ctx: TenantContext, ref: string): Promise<void> {
  try {
    await d.objects.delete(ctx, ref);
  } catch (e) {
    console.error(`[me-avatar] 置いた写真を消せなかった（${kindOf(e)}）`);
  }
}

async function imageAvatar(d: Deps, ctx: TenantContext, ref: string, initial: string): Promise<Avatar> {
  const s = await d.objects.signUrl(ctx, ref, URL_TTL_SEC);
  return s.status === "done" ? { kind: "image", initial, url: s.value.url } : { kind: "text", initial, url: null };
}

async function resetAvatar(d: Deps, ctx: TenantContext): Promise<HookReply> {
  let got: { old: string | null; initial: string };
  try {
    got = await setRef(d, ctx, null);
  } catch (e) {
    return unavailable("文字に戻す取引が落ちた", e);
  }
  await dropOld(d, ctx, got.old);
  const avatar: Avatar = { kind: "text", initial: got.initial, url: null };
  return { status: 201, body: { data: { avatar } } };
}

async function putAvatar(d: Deps, ctx: TenantContext, file: File): Promise<HookReply> {
  if (file.size > AVATAR_MAX_BYTES) return avatarTooLarge();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageKind(bytes.subarray(0, HEAD_BYTES));
  if (!kind) return coded(422, "E-ME-011");
  let put: Awaited<ReturnType<Deps["objects"]["put"]>>;
  try {
    put = await d.objects.put(ctx, bytes, { contentType: contentTypeOf(kind), retentionDays: null });
  } catch (e) {
    console.error(`[me-avatar] 写真を置けなかった（${kindOf(e)}）`);
    return coded(502, "E-ME-012");
  }
  if (put.status !== "done") return coded(502, "E-ME-012");
  const ref = put.value.ref;
  let got: { old: string | null; initial: string };
  try {
    got = await setRef(d, ctx, ref);
  } catch (e) {
    await dropNew(d, ctx, ref);
    return unavailable("顔を書く取引が落ちた", e);
  }
  await dropOld(d, ctx, got.old);
  return { status: 201, body: { data: { avatar: await imageAvatar(d, ctx, ref, got.initial) } } };
}

export function createUploadAvatar(d: Deps) {
  return async (a: HookArgs): Promise<HookReply> => {
    const body = readForm(a.form);
    if (!body) return badFile("写真のファイルか reset=true のどちらか 1 つを送ってください");
    return "reset" in body ? resetAvatar(d, a.ctx) : putAvatar(d, a.ctx, body.file);
  };
}
