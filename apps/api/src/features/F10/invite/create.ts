// メールで招く口（K-419）：createInvitations（POST /api/v1/invitations・D-148.1・D-148.23・D-148.29・D-148.47）。
//   入口（op.ts）が先に確かめる：ログイン・権限（members の invite・会社全体＝管理者の束と個別に付けた人。マネージャーは招けない）・
//   上限・冪等・体の形（emails・scope_id・role_key・message。知らない項目は 422）。順：
//   ⓪ 欠け・決まった値の外（宛てが無い・役割が 4 つの外・ひとこと 501 文字）は 422・VALIDATION_ERROR（契約の VALUE_RANGES と同じ）
//   ① 宛てを登録と同じ normalizeEmail（NFKC・空白を全部消す・小文字）でそろえ、そろえて同じになる宛ては 1 つにまとめる
//   ② 51 人以上 → 422・E-INV-012
//   ③ 管理者として招く（role_key admin）ときだけ、本人確認が直前 15 分の内か（無ければ 403・STEP_UP_REQUIRED）
//   ④ 全部か無しか：EMAIL_RE に合わない宛て（E-INV-009）が 1 つでもあれば、どの宛ても招かず 422 と details（宛てごと・入れた順）。
//      形の誤りだけを 422 で返し、DB の中身で決まる断りは ⑤ の 409・404 に分ける（口が断る番号の決め・answer=431fc50df51b）
//   ⑤ 1 つの取引（app.create_invitations）で、同じ宛ての招待中の招待を取り消して新しい招待を作り、証跡を書く。
//      グループが会社に無い・消した → 404・E-INV-011。もう入っている人が 1 人でもいる → 409・E-INV-010（details は宛てごと）。DB が落ちた → 503・E-PAGE-003（何も残らない）
//   ⑥ 取引が終わってから宛てごとに 1 通（関門 C6）。送れたら mail "sent"・送れなかったら "failed" と証跡 invitation.mail_failed。
//      証跡を書けなければログに招待の id だけ（宛てのメールは出さない・ドメインだけを証跡に書く）
//   ⑦ 201 { invitations: [{ id, email, expires_at, mail }] }
import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";
import { EMAIL_RE, mailTag, normalizeEmail } from "@kaname/auth/signup";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookDeps } from "../../../hooks/registry.js";
import { inviteMail } from "./mail.js";

/** 一度に招ける人数 */
export const INVITE_MAX = 50;
/** 役割（契約の role_key は決まった 4 つ）とひとことの長さ（invitations_message_len と同じ 500 文字） */
const ROLES = ["member", "manager", "viewer", "admin"] as const;
const MESSAGE_MAX = 500;
/** トークンの長さ（バイト）。DB には sha256 だけを置く（packages/auth/src/invitations.ts と同じ形） */
const TOKEN_BYTES = 32;

type Detail = { field: string; email?: string; code: string; message: string };
interface Created {
  invitation_id: string;
  email: string;
  expires_at: Date;
}
interface Facts {
  workspace_name: string | null;
  inviter_name: string | null;
  group_name: string | null;
}

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
const pgInfo = (e: unknown): { code: string; hint: string; detail: string } => {
  const x = (e ?? {}) as { code?: unknown; hint?: unknown; detail?: unknown };
  return {
    code: typeof x.code === "string" ? x.code : "",
    hint: typeof x.hint === "string" ? x.hint : "",
    detail: typeof x.detail === "string" ? x.detail : "",
  };
};
/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

const invalid = (code: string, details: Detail[], status = 422): HookReply => ({
  status,
  body: { ...kanameError(code).toJSON(), details },
});
const detail = (code: string, field: string, email?: string): Detail => ({
  field,
  ...(email === undefined ? {} : { email }),
  code,
  message: kanameError(code).entry.message,
});
const STEP_UP_REQUIRED: HookReply = {
  status: 403,
  body: { error: "step_up_required", code: "STEP_UP_REQUIRED", message: "本人確認を取り直してから" },
};
const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
const unavailable = (): HookReply => {
  const e = kanameError("E-PAGE-003").toJSON();
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003", message: e.message, action: e.action } };
};

/** 契約の形に合うが決まった値の外・欠け：入口の形の確かめと同じ答え（画面は details の欄の下に文を出す） */
const badField = (field: string, message: string): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details: [{ field, message }] },
});

/** 入力の欠け・決まった値の外を 422 にする（宛て・グループ・役割は必須。ひとことは 500 文字まで） */
function checkInput(input: Record<string, unknown>): HookReply | null {
  const emails = input["emails"];
  if (!Array.isArray(emails) || emails.length === 0 || emails.some((v) => typeof v !== "string"))
    return badField("emails", "宛てを 1 つ以上入れてください");
  if (typeof input["scope_id"] !== "string" || input["scope_id"] === "")
    return badField("scope_id", "グループを選んでください");
  if (typeof input["role_key"] !== "string" || !(ROLES as readonly string[]).includes(input["role_key"]))
    return badField("role_key", ROLES.join("／"));
  const m = input["message"];
  if (m !== undefined && m !== null && (typeof m !== "string" || Array.from(m).length > MESSAGE_MAX))
    return badField("message", `${MESSAGE_MAX} 文字まで`);
  return null;
}

/** DB の関数が断った例外 → 答え。分からない例外は 503（何も残らない） */
function refused(e: unknown): HookReply {
  const { code, hint, detail: dt } = pgInfo(e);
  if (code === "42501" && hint === "E-INV-011") return invalid("E-INV-011", [detail("E-INV-011", "scope_id")], 404);
  if (code === "42501") return forbidden();
  if (code === "22023" && hint === "E-INV-010")
    return invalid(
      "E-INV-010",
      dt
        .split("\n")
        .filter((s) => s !== "")
        .map((s) => detail("E-INV-010", "emails", s)),
      409,
    );
  console.error(`[invite] 招く取引が落ちた（${kindOf(e)}）`);
  return unavailable();
}

/** 入力の宛てをそろえ、重なりを外す（入れた順を守る） */
export function normalizeEmails(raw: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    if (typeof v !== "string") continue;
    const e = normalizeEmail(v);
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export function createCreateInvitations(d: Pick<HookDeps, "appPool" | "mailer" | "config">) {
  /** ⑤ 1 つの取引：メールの文面に要る名前を読み、招待を作る（呼んだ人の権限は関数の中でも見る） */
  const store = async (
    a: HookArgs,
    emails: string[],
    tokens: string[],
    scope: string,
    role: string,
    message: string | null,
  ): Promise<{ rows: Created[]; facts: Facts }> =>
    withTenant(d.appPool, a.ctx, async (cl: pg.PoolClient) => {
      const f = await cl.query<Facts>(
        `select (select t.name from tenants t where t.id = app.tenant_id()) as workspace_name,
                (select m.display_name from members m where m.id = app.user_id()) as inviter_name,
                (select s.name from scopes s where s.id = $1 and s.deleted_at is null) as group_name`,
        [scope],
      );
      const r = await cl.query<Created>(
        "select invitation_id, email, expires_at from app.create_invitations($1::text[], $2::uuid, $3, $4, $5::text[])",
        [emails, scope, role, message, tokens.map(sha256)],
      );
      return { rows: r.rows, facts: f.rows[0] ?? { workspace_name: null, inviter_name: null, group_name: null } };
    });

  /** ⑥ 送れなかった証跡。書けなければログに招待の id だけ */
  const markFailed = async (a: HookArgs, id: string, email: string): Promise<void> => {
    try {
      await withTenant(d.appPool, a.ctx, async (cl) => {
        await cl.query("select app.record_audit('invitation.mail_failed', 'invitation', $1, 'C6', $2::jsonb)", [
          id,
          JSON.stringify({ invitation_id: id, email_domain: email.split("@")[1] ?? "" }),
        ]);
      });
    } catch {
      console.error("[invite] 招待のメールの結果を書けなかった", id);
    }
  };

  const send = async (
    a: HookArgs,
    rows: Created[],
    tokens: string[],
    facts: Facts,
    scope: { role: string; message: string | null },
  ): Promise<("sent" | "failed")[]> => {
    const base = d.config.webBaseUrl ?? "";
    const out: ("sent" | "failed")[] = [];
    for (const [i, r] of rows.entries()) {
      try {
        if (!d.mailer) throw new Error("メールの送出先が無い");
        const mail = inviteMail({
          workspaceName: facts.workspace_name ?? "ワークスペース",
          inviterName: facts.inviter_name ?? "ワークスペースの人",
          groupName: facts.group_name ?? "",
          role: scope.role,
          message: scope.message,
          link: `${base}/invite/${tokens[i]}`,
          expiresAt: new Date(r.expires_at),
        });
        await d.mailer({ to: r.email, ...mail });
        out.push("sent");
      } catch (e) {
        console.error(`[invite] 招待のメールを送れなかった → ${mailTag(r.email)}: ${kindOf(e)}`);
        await markFailed(a, r.invitation_id, r.email);
        out.push("failed");
      }
    }
    return out;
  };

  return async (a: HookArgs): Promise<HookReply> => {
    const bad = checkInput(a.input);
    if (bad) return bad;
    const emails = normalizeEmails(a.input["emails"]);
    const scope = String(a.input["scope_id"] ?? "");
    const role = String(a.input["role_key"] ?? "");
    const rawMessage = a.input["message"];
    const message = typeof rawMessage === "string" && rawMessage !== "" ? rawMessage : null;
    if (emails.length > INVITE_MAX) return invalid("E-INV-012", [detail("E-INV-012", "emails")]);
    if (emails.length === 0) return invalid("E-INV-009", [detail("E-INV-009", "emails")]);
    if (role === "admin") {
      // 判定が渡されなければ閉じた側に倒す
      const stale = a.requireStepUp ? a.requireStepUp() : STEP_UP_REQUIRED;
      if (stale) return stale;
    }
    const badEmails = emails.filter((e) => !EMAIL_RE.test(e));
    if (badEmails.length > 0)
      return invalid(
        "E-INV-009",
        badEmails.map((e) => detail("E-INV-009", "emails", e)),
      );
    const tokens = emails.map(() => randomBytes(TOKEN_BYTES).toString("base64url"));
    let stored: { rows: Created[]; facts: Facts };
    try {
      stored = await store(a, emails, tokens, scope, role, message);
    } catch (e) {
      return refused(e);
    }
    const marks = await send(a, stored.rows, tokens, stored.facts, { role, message });
    return {
      status: 201,
      body: {
        data: {
          invitations: stored.rows.map((r, i) => ({
            id: r.invitation_id,
            email: r.email,
            expires_at: r.expires_at,
            mail: marks[i],
          })),
        },
      },
    };
  };
}
