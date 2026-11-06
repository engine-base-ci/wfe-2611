// K-52 メールを確かめる：確認のメールのリンクを押した時点で登録を確定し、そのまま入る（契約の口 verifySignup・D-088・D-088.2）。
//   順番：使うの印を付ける（claimPendingByToken）→ 本人とテナントを作る（signUp。会社名が空なら名前を渡す・D-125.135）→ emailVerified を立てる
//        → 同意を移す（terms_consents・関門 C2 の withTenant）→ 包んだパスワードを消す → 完了のメール（関門 C6）→ ログインの印を返す。
//   印は 1 回だけ付く（同時に何回押しても確定は 1 回）。途中で失敗したら全部戻す：この確定で作った本人（id で指す）と、
//   signUp の hook が作った会社の一式を app.drop_half_made_company で片付け、印を戻す。
//   signUp が同じメールの重複で落ちた（確定の途中に別の道で本人ができた）ら、何も消さずに E-CONF-001。
//   冪等キーは使わない：2 回目にログインの印を渡すと、リンクを持つ人なら誰でも入れてしまう（2 回目は E-CONF-011）。
//   会社を作る hook（packages/auth の databaseHooks.user.create.after）は変えない（招待で入る人は会社を作らない）。
//   確定の直後の最初のログインでは「新しい端末」の知らせを出さない（D-128.137）：signUp は端末の印（user-agent）を渡さずに作るので、
//   セッションの端末は最初に使われたときに決まり、新しい端末とは数えない。
//   ログにパスワード・メールアドレス・リンクの手がかりを出さない（TP-REG-14）
import type { Auth } from "@kaname/auth";
import {
  claimPendingByToken,
  closeSessionsOf,
  authUserHasMembers,
  dbNow,
  dropHalfMadeUser,
  emailOfUser,
  isRegistered,
  markEmailVerified,
  memberOfNewUser,
  openPendingPassword,
  releasePendingClaim,
  sealOffPending,
  userMadeSince,
  type AuthPool,
  type ClaimedPending,
} from "@kaname/auth/pending";
import { signUp } from "@kaname/auth/signup";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { cleanText } from "../sign-up/input.js";
import { OPS_TENANT_ID } from "../sign-up/index.js";
import { sendDoneMail, type DoneMailer } from "./mail.js";

/** 包んだパスワードが開けなかった出来事（security_events.kind_id）。登録の前なので運営のテナントに置く */
export const PENDING_UNSEALABLE = "pending_signup_unsealable";
/** 手がかりの形（putPending が作る 24 バイトの base64url は 32 文字）。形の違うものは DB を引かずに「無い」と同じ答え */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,200}$/;

export interface VerifyEmailDeps {
  auth: Auth;
  /** 認証の接続（kaname_auth の表） */
  authPool: AuthPool;
  /** 業務の接続（関門 C2 の withTenant・app のスキーマの関数） */
  appPool: AuthPool;
  repo: Repository;
  /** メールの送出（関門 C6・server.ts の 1 か所） */
  mailer?: DoneMailer;
  config: {
    secretsMasterKey: string;
    baseUrl: string;
    webBaseUrl: string | null;
    opsEmail: string;
    mailReplyTo?: string;
  };
}

/** 正本のエラーを、決めた状態の番号で返す（410・500 は正本の class から出ない番号） */
const reply = (status: number, code: string): HookReply => ({ status, body: kanameError(code).toJSON() });
const ok = (data: Record<string, unknown>): HookReply => ({ status: 201, body: { data } });
const errName = (e: unknown) => (e as Error)?.name ?? "Error";

/** いまログインしているか（signedIn）と、その人のメール。ログイン中かは文脈の役で決める（members が読めなくても、ログインしていない扱いにしない・D-128.137） */
async function currentUser(a: HookArgs, d: VerifyEmailDeps): Promise<{ signedIn: boolean; email: string | null }> {
  if (a.ctx.role === "anonymous") return { signedIn: false, email: null };
  try {
    const me = a.ctx.userId ? await a.repo.table("members").get(a.ctx, a.ctx.userId) : null;
    const id = me?.["auth_user_id"];
    return { signedIn: true, email: typeof id === "string" ? await emailOfUser(d.authPool, id) : null };
  } catch {
    return { signedIn: true, email: null };
  }
}

/** 確定の途中の失敗。made は、この確定で作った本人の id（作る前に落ちたら null）・tenant はその会社（分かれば）。
 *  otherPath は、signUp が本人を足せなかった（同じメールの本人が別の道でできた）とき。何も消さない */
class ConfirmFailed extends Error {
  constructor(
    readonly made: string | null,
    readonly tenant: string | null,
    readonly reason: unknown,
    readonly otherPath = false,
  ) {
    super("確定の途中で失敗した");
  }
}
/** 片付けが落ちた・印を戻せなかった出来事（security_events.kind_id）。運営のテナントに置く */
export const SIGNUP_CLEANUP_FAILED = "signup_cleanup_failed";

export function verifyEmailFeature(d: VerifyEmailDeps) {
  /** 同意を本人に移す（申し込みに残した版と時刻・D-128.137）。行の守り terms_consents_self_add を通すため、新しい本人の文脈で入れる */
  const moveConsents = async (ctx: TenantContext, userId: string, p: ClaimedPending) => {
    const versions = [p.termsVersionId, p.privacyVersionId].filter((v): v is string => !!v);
    if (!versions.length) return;
    await withTenant(d.appPool, ctx, async (cl) => {
      for (const v of versions)
        await cl.query(
          "insert into terms_consents (tenant_id, member_id, auth_user_id, terms_version_id, agreed_at) values ($1, $2, $3, $4, coalesce($5, now()))",
          [ctx.tenantId, ctx.userId, userId, v, p.consentedAt],
        );
    });
  };

  /** signUp が落ちたとき、この確定で作った本人かを見分ける。Better Auth は「本人を足せなかった（重複）」も「足した後に会社を作る hook で
   *  落ちた」も同じ FAILED_TO_CREATE_USER で返すので、DB で見分ける：確定を始めた後にできた同じメールの本人がいて、その人の会社の人が
   *  どこにも無いなら、この確定で作って hook で落ちた本人。会社の人がいる（招待で入った など）・始める前からいる本人は、別の道の本人（消さない） */
  const signUpFailed = async (email: string, since: Date, e: unknown): Promise<ConfirmFailed> => {
    const code = (e as { body?: { code?: string } } | null)?.body?.code ?? "";
    if (code.startsWith("USER_ALREADY_EXISTS")) return new ConfirmFailed(null, null, e, true);
    const cand = await userMadeSince(d.authPool, email, since).catch(() => null);
    if (cand) {
      const left = await dropHalfMadeUserDryRun(cand);
      if (left === "mine") return new ConfirmFailed(cand, null, e);
    }
    if (await isRegistered(d.authPool, email).catch(() => false)) return new ConfirmFailed(null, null, e, true);
    return new ConfirmFailed(null, null, e);
  };
  /** その本人の会社の人が残っているか（残っていれば別の道の本人）。読めなければ消さない側に倒す */
  const dropHalfMadeUserDryRun = async (userId: string): Promise<"mine" | "other"> =>
    (await authUserHasMembers(d.authPool, userId).catch(() => true)) ? "other" : "mine";

  /** 確定の本体。失敗したら ConfirmFailed（この確定で作った本人の id・会社つき）を投げる */
  const confirm = async (p: ClaimedPending, password: string) => {
    const name = cleanText(p.name);
    const companyName = cleanText(p.companyName) || name; // 会社名が空なら本人の名前で個人のテナント（D-125.135）
    const since = await dbNow(d.authPool); // 確定を始めた時刻（DB の時計・片付けの関数の「数分以内」と同じ）
    let r: Awaited<ReturnType<typeof signUp>>;
    try {
      r = await signUp(d.auth, { email: p.email, password, name, companyName });
    } catch (e) {
      throw await signUpFailed(p.email, since, e);
    }
    let tenant: string | null = null;
    try {
      await markEmailVerified(d.authPool, r.userId);
      const m = await memberOfNewUser(d.authPool, d.appPool, r.userId);
      if (!m) throw new Error("確定した本人の会社の人が見つからない");
      tenant = m.tenantId;
      const ctx: TenantContext = { tenantId: m.tenantId, userId: m.memberId, role: "member" };
      await moveConsents(ctx, r.userId, p);
      return { userId: r.userId, token: r.token, ctx, name };
    } catch (e) {
      if (!tenant)
        tenant = (await memberOfNewUser(d.authPool, d.appPool, r.userId).catch(() => null))?.tenantId ?? null;
      throw new ConfirmFailed(r.userId, tenant, e);
    }
  };

  /** 運営に知らせ（関門 C6）、セキュリティの記録（運営のテナント）に残す。メールアドレスは書かない。どちらが落ちても止めない */
  const alertOps = async (what: string) => {
    try {
      await d.repo.securityEvent(OPS_TENANT_ID, SIGNUP_CLEANUP_FAILED, null, null, { what });
    } catch (e) {
      console.error(`[verify-email] セキュリティの記録に残せなかった: ${errName(e)}`);
    }
    if (!d.mailer) return;
    await d
      .mailer({
        to: d.config.opsEmail,
        subject: "Kaname｜登録の確定の途中の片付けが落ちました",
        text: `メールの確認のリンクで登録を確定する途中で落ち、そのあとの${what}ができませんでした。\n作りかけの会社・本人が残っているか、申し込みが使い終わりのままです。セキュリティの記録（${SIGNUP_CLEANUP_FAILED}）を確かめてください（K-52・D-128.167）。`,
      })
      .catch(() => console.error("[verify-email] 運営への知らせを送れなかった（片付けの失敗）"));
  };

  /** 確定した後の片付け。落ちても確定は済んでいるので答えは変えない。ログに残す（メールアドレスは出さない） */
  const afterwards = async (what: string, fn: () => Promise<void>, tries = 1) => {
    for (let i = 0; i <= tries; i++) {
      try {
        await fn();
        return;
      } catch (e) {
        console.error(`[verify-email] 確定の後の${what}が落ちた（${i + 1} 回目）: ${errName(e)}`);
      }
    }
  };

  const verify = async (a: HookArgs): Promise<HookReply> => {
    // 前後の空白（メールソフトが付ける）は契約の入口が落とす。それ以外は直さない
    const token = typeof a.input["token"] === "string" ? a.input["token"].trim() : "";
    if (!token) return reply(422, "E-PAGE-006");
    // 形の違う手がかりは、でたらめと同じ答え（形の違いで中身を探らせない・TP-REG-07）
    if (!TOKEN_RE.test(token)) return reply(410, "E-PAGE-006");
    const me = await currentUser(a, d);
    let claim: Awaited<ReturnType<typeof claimPendingByToken>>;
    try {
      claim = await claimPendingByToken(d.authPool, token);
    } catch (e) {
      console.error(`[verify-email] 申し込みを引けなかった: ${errName(e)}`);
      return reply(500, "E-PAGE-003");
    }
    if (claim.kind === "gone" || claim.kind === "unusable") return reply(410, "E-PAGE-006");
    if (claim.kind === "expired") return reply(410, "E-AUTH-003");
    if (claim.kind === "replaced") return reply(410, "E-AUTH-008");
    if (claim.kind === "done")
      // 確定済み。別のアカウントでログイン中なら、そのまま（勝手に切り替えない・D-128.137）
      return me.signedIn && me.email !== claim.email ? reply(409, "E-AUTH-009") : reply(409, "E-CONF-011");

    const p = claim.pending;
    // 申し込みの後に、別の道で同じメールの本人ができた：申し込みは使い終わりのまま、二重に作らない
    if (await isRegistered(d.authPool, p.email)) {
      await afterwards("パスワードの片付け", () => sealOffPending(d.authPool, claim.tokenHash));
      return reply(409, "E-CONF-001");
    }
    let password: string;
    try {
      password = openPendingPassword(d.config.secretsMasterKey, p.sealed);
    } catch {
      // 鍵が替わった：確定しない。印は戻さず使い終わりのまま、包んだパスワードは空にする（押し直しても同じ登録し直しの案内）。
      // セキュリティの記録に残す（メールアドレスは書かない）
      await afterwards("パスワードの片付け", () => sealOffPending(d.authPool, claim.tokenHash));
      try {
        await d.repo.securityEvent(OPS_TENANT_ID, PENDING_UNSEALABLE, null, null, {
          reason: "包んだパスワードを開けない",
        });
      } catch (e) {
        console.error(`[verify-email] セキュリティの記録に残せなかった（鍵の入れ替え）: ${errName(e)}`);
      }
      console.error("[verify-email] 申し込みのパスワードを開けなかった（鍵の入れ替え）");
      return reply(410, "E-PAGE-006");
    }
    let done: Awaited<ReturnType<typeof confirm>>;
    try {
      done = await confirm(p, password);
    } catch (e) {
      const f = e instanceof ConfirmFailed ? e : new ConfirmFailed(null, null, e);
      console.error(`[verify-email] 確定できなかった: ${errName(f.reason)}`);
      // 同じメールの本人が別の道でできた（signUp が重複で落ちた）：何も消さない。申し込みは使い終わりのまま（HIGH-1）
      if (f.otherPath) {
        await afterwards("パスワードの片付け", () => sealOffPending(d.authPool, claim.tokenHash));
        return reply(409, "E-CONF-001");
      }
      // 途中まで残さない：この確定で作った本人と会社の中身を片付ける（会社は印を付けて残す・D-128.167）。
      // 片付けと印を戻すのは別々に。片付けが落ちたら印は戻さない（作りかけが残ったまま押し直させない）
      if (f.made) {
        try {
          await dropHalfMadeUser(d.authPool, f.made, f.tenant);
        } catch (e2) {
          console.error(`[verify-email] 作りかけを片付けられなかった: ${errName(e2)}`);
          await alertOps("作りかけの会社と本人の片付け");
          return reply(500, "E-PAGE-003");
        }
      }
      try {
        await releasePendingClaim(d.authPool, claim.tokenHash);
      } catch (e3) {
        console.error(`[verify-email] 申し込みの印を戻せなかった: ${errName(e3)}`);
        await alertOps("申し込みの印を戻す処理");
      }
      return reply(500, "E-PAGE-003");
    }
    await afterwards("パスワードの片付け", () => sealOffPending(d.authPool, claim.tokenHash));
    // 別のアカウントでログイン中：確定だけして、新しい本人のセッションはすぐ閉じる（今のアカウントは切り替えない・D-128.137）。閉じるのは 1 回やり直す
    const signedIn = !me.signedIn;
    if (!signedIn)
      await afterwards("セッションを閉じる処理", () => closeSessionsOf(d.authPool, d.appPool, done.userId), 1);
    const web = d.config.webBaseUrl ?? d.config.baseUrl;
    await sendDoneMail(d, done.ctx, {
      email: p.email,
      name: done.name,
      loginUrl: `${web}/login`,
      supportEmail: d.config.mailReplyTo || d.config.opsEmail,
    });
    // 答えに本人の id は入れない（email・token・signed_in だけ）
    return ok({ email: p.email, token: signedIn ? done.token : null, signed_in: signedIn });
  };

  return { verify };
}
