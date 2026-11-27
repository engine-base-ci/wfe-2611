// メールを変える口（K-835）：requestEmailChange（POST /api/v1/me/email-change）・verifyEmailChange（POST /api/v1/me/email-change/verify）。
//   頼む：入口の前処理（inputEmailChange）で宛ての形を確かめそろえる（422・E-ME-020）→ リンクの印を作りハッシュだけを DB へ
//         （app.me_email_change_request・取引 1 つ）→ 新しいアドレスへ確かめのメール（関門 C6）→ 送れなければ待ちを取り消して 502・E-ME-025。
//   確かめる：印のハッシュで app.me_email_change_verify（行を錠で取る・メールを変える・安全の記録・取引 1 つ）→ 古いアドレスへ知らせ（リンクを入れない）。
//   リンクの印はメールの本文にだけ在り、DB・ログ・答えに出さない。ログには場所と例外の種類だけ（宛てを出さない）。DB の失敗は 503・E-PAGE-003
import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { EMAIL_RE, normalizeEmail } from "@kaname/auth/signup";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import type { HookMailer } from "../../../hooks/registry.js";
import { INVITE_EMAIL_PATTERN } from "../invite/patterns.js";

/** 宛ての長さの上限（そろえた後・RFC の 254） */
const EMAIL_MAX = 254;
/** 打ったとおりの字の長さの上限（正規表現を当てる前に見る・長い入力で時間がかからないように） */
const RAW_MAX = 320;
const EMAIL_FORM = new RegExp(INVITE_EMAIL_PATTERN);
const TAG = "[me-email]";

export interface MeEmailDeps {
  appPool: pg.Pool;
  mailer?: HookMailer;
  config: { baseUrl: string; webBaseUrl: string | null };
}

/** 正本のエラーを答えにする（状態の番号は口が決める） */
const reply = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });

/** 宛ての形の誤り（欄の名前つきの 422・E-ME-020） */
function badEmail(): HookReply {
  const e = kanameError("E-ME-020", { field: "email" });
  return {
    status: 422,
    body: { ...e.toJSON(), field: "email", details: [{ field: "email", message: e.entry.message }] },
  };
}

/** DB が落ちた：503・E-PAGE-003（場所と例外の種類だけをログに出す） */
function down(where: string, e: unknown): HookReply {
  console.error(`${TAG} ${where}：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
  return reply(503, "E-PAGE-003");
}

const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });
const hashOf = (token: string): string => createHash("sha256").update(token).digest("hex");

/** 新しい宛ての伏せ字（古いアドレスへの知らせに出す・名前の頭 2 字とドメインだけ） */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

/** そろえた宛てが使える形か（契約の pattern と同じ字・そろえた後もログインの形） */
function emailOk(raw: string): string | null {
  if (raw.length > RAW_MAX || !EMAIL_FORM.test(raw)) return null;
  const e = normalizeEmail(raw);
  return e.length <= EMAIL_MAX && EMAIL_RE.test(e) ? e : null;
}

/** 入口の前処理：宛ての形を確かめてそろえる。文字でない値は契約の形（欄の名前つきの 422）に回す */
export function inputEmailChange(raw: unknown): { input: Record<string, unknown> } | { reply: HookReply } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { input: raw as Record<string, unknown> };
  const o = raw as Record<string, unknown>;
  if (typeof o["email"] !== "string") return { input: o };
  const email = emailOk(o["email"]);
  return email ? { input: { ...o, email } } : { reply: badEmail() };
}

interface RequestResult {
  ok?: boolean;
  error?: string;
  expires_at?: string;
}
interface VerifyResult {
  ok?: boolean;
  error?: string;
  old_email?: string;
  new_email?: string;
}

const REQUEST_REFUSED: Readonly<Record<string, [number, string]>> = {
  same: [409, "E-ME-026"],
  taken: [409, "E-ME-021"],
  too_many: [429, "E-ME-024"],
};
const VERIFY_REFUSED: Readonly<Record<string, [number, string]>> = {
  invalid: [409, "E-PAGE-006"],
  used: [409, "E-ME-023"],
  expired: [409, "E-ME-022"],
  taken: [409, "E-ME-021"],
};

function confirmMail(to: string, link: string) {
  return {
    to,
    subject: "【Kaname】メールアドレスの確かめ",
    text: [
      "Kaname のログインのメールを、このアドレスに変えようとしています。",
      "下のリンクを開くと変わります（24 時間・1 回だけ使えます）。",
      "",
      link,
      "",
      "心当たりが無ければ、このメールは捨ててください。メールは変わりません。",
    ].join("\n"),
  };
}

function changedMail(to: string, masked: string) {
  return {
    to,
    subject: "【Kaname】ログインのメールが変わりました",
    text: [
      `Kaname のログインのメールが ${masked} に変わりました。`,
      "これからは新しいアドレスでログインしてください。",
      "",
      "心当たりが無ければ、このメールに返信して運営に知らせてください。",
    ].join("\n"),
  };
}

export function meEmailFeature(d: MeEmailDeps) {
  const web = d.config.webBaseUrl ?? d.config.baseUrl;
  const send = async (m: { to: string; subject: string; text: string }): Promise<boolean> => {
    if (!d.mailer) return false;
    try {
      await d.mailer(m);
      return true;
    } catch {
      return false;
    }
  };

  /** 送れなかった頼みの待ちを取り消す（落ちても印は誰にも届いていないので、ログ 1 行だけ） */
  const revoke = async (a: HookArgs, hash: string): Promise<void> => {
    try {
      await withTenant(d.appPool, a.ctx, (cl) => cl.query("select app.me_email_change_revoke($1)", [hash]));
    } catch {
      console.error(`${TAG} 送れなかった頼みを取り消せなかった`);
    }
  };

  const request = async (a: HookArgs): Promise<HookReply> => {
    // 入口の前処理を通った宛てをもう一度確かめる（口の 2 層目）
    const raw = a.input["email"];
    const email = typeof raw === "string" ? emailOk(raw) : null;
    if (!email) return badEmail();
    const token = randomBytes(32).toString("base64url");
    const hash = hashOf(token);
    let v: RequestResult;
    try {
      v = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: RequestResult | null }>("select app.me_email_change_request($1, $2) as v", [
          email,
          hash,
        ]);
        return r.rows[0]?.v ?? {};
      });
    } catch (e) {
      return down("メールを変える頼み", e);
    }
    if (v.error === "forbidden") return forbidden();
    const refused = v.error ? REQUEST_REFUSED[v.error] : undefined;
    if (refused) return reply(refused[0], refused[1]);
    if (!v.ok || !v.expires_at) return down("メールを変える頼み（知らない答え）", new Error("unknown"));
    const link = `${web}/account/email-confirm?token=${token}`;
    if (!(await send(confirmMail(email, link)))) {
      await revoke(a, hash);
      return reply(502, "E-ME-025");
    }
    return { status: 201, body: { data: { pending_email: email, expires_at: new Date(v.expires_at).toISOString() } } };
  };

  const verify = async (a: HookArgs): Promise<HookReply> => {
    const token = a.input["token"];
    if (typeof token !== "string" || token.length === 0) return reply(409, "E-PAGE-006");
    let v: VerifyResult;
    try {
      v = await withTenant(d.appPool, a.ctx, async (cl) => {
        const r = await cl.query<{ v: VerifyResult | null }>("select app.me_email_change_verify($1) as v", [
          hashOf(token),
        ]);
        return r.rows[0]?.v ?? {};
      });
    } catch (e) {
      return down("メールを変える確かめ", e);
    }
    if (v.error === "forbidden") return forbidden();
    const refused = v.error ? VERIFY_REFUSED[v.error] : undefined;
    if (refused) return reply(refused[0], refused[1]);
    if (!v.ok || !v.new_email) return down("メールを変える確かめ（知らない答え）", new Error("unknown"));
    if (v.old_email && !(await send(changedMail(v.old_email, maskEmail(v.new_email)))))
      console.error(`${TAG} 古いアドレスへの知らせを送れなかった`);
    return { status: 201, body: { data: { changed: true, email: v.new_email } } };
  };

  return { request, verify };
}
