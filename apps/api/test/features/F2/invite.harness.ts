// 段 3（F2 招かれて参加する）の口の試験の土台（K-331 が持ち込む・K-332・K-333・K-334 が使う）。
//   ログインの土台（F1/login.harness.ts の setupLogin：本番と同じ bootApi・本物の DB・本物のログインの部品）の上に、招待を作る道具と口の呼び方を足す。
//   招く側（F10・K-70）はまだ無いので、招待の行は DB に直に入れる（前からの試験 prep.ts・api.ts と同じ道）。トークンは平文を返し、DB にはハッシュだけ置く
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { createHash, randomBytes } from "node:crypto";
import { PW, msg, setupLogin, type Login, type User } from "../F1/login.harness.js";

export { PW, msg, type User };
export const INVITATION = (token: string): string => `/api/v1/auth/invitations/${encodeURIComponent(token)}`;
export const ACCEPT = (token: string): string => `${INVITATION(token)}/accept`;
export const RESEND = (token: string): string => `${INVITATION(token)}/resend-request`;

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

export interface InviteOpts {
  /** 宛てのメール（既定はこの回の新しいメール） */
  email?: string;
  /** invitations.role_id（既定 member） */
  role?: string;
  /** グループ（層）。null なら決めない（既定はワークスペースのいちばん上のグループ） */
  scopeId?: string | null;
  /** 招いた人のひとこと（K-331 の migration が足す invitations.message） */
  message?: string | null;
  /** 期限切れにする（expires_at を 1 分前に） */
  expired?: boolean;
  /** 取り消し済みにする（revoked_at） */
  revoked?: boolean;
  /** 使われた（accepted_member_id に招いた人を入れる） */
  used?: boolean;
}

export interface Invite {
  token: string;
  id: string;
  tenantId: string;
  email: string;
  scopeId: string | null;
}

export interface InviteHarness extends Login {
  /** 招いた人（ワークスペースの持ち主）を作る */
  owner: (tag: string, company?: string) => Promise<User>;
  /** inviter のワークスペースに招待の行を置き、平文のトークンを返す */
  invite: (inviter: User, o?: InviteOpts) => Promise<Invite>;
  /** その人のログインの印（Bearer）。ログインの部品を直に呼ぶ（上限に当たらない） */
  tokenOf: (u: User) => Promise<string>;
  bearer: (token: string) => Record<string, string>;
  /** 下見の口（GET） */
  preview: (token: string, o?: { headers?: Record<string, string>; ip?: string }) => Promise<Response>;
  /** 参加の口（POST） */
  accept: (token: string, body?: unknown, o?: { headers?: Record<string, string>; ip?: string }) => Promise<Response>;
  /** 送り直しを頼む口（POST・K-334） */
  resendRequest: (token: string, o?: { headers?: Record<string, string>; ip?: string }) => Promise<Response>;
  /** 招待の行の今 */
  row: (id: string) => Promise<{ accepted_member_id: string | null; revoked_at: Date | null; updated_at: Date }>;
  /** そのメールの認証側の利用者の数 */
  authUsers: (email: string) => Promise<number>;
  /** ワークスペースの数（招待で会社が増えないことを見る） */
  tenants: () => Promise<number>;
}

export function setupInvite(prefix: string): InviteHarness {
  const h = setupLogin(prefix);
  const owner: InviteHarness["owner"] = (tag, company) => h.makeUser(tag, { company: company ?? `株式会社${tag}` });
  const invite: InviteHarness["invite"] = async (inviter, o = {}) => {
    const token = randomBytes(24).toString("base64url");
    const email = o.email ?? h.email(`inv-${randomBytes(4).toString("hex")}`);
    const top =
      o.scopeId !== undefined
        ? o.scopeId
        : ((
            await h.admin.query<{ id: string }>(
              "select id from scopes where tenant_id = $1 and parent_id is null and deleted_at is null order by created_at limit 1",
              [inviter.tenantId],
            )
          ).rows[0]?.id ?? null);
    const r = await h.admin.query<{ id: string }>(
      `insert into invitations (tenant_id, email, scope_id, role_id, token_hash, expires_at, created_by, revoked_at, accepted_member_id)
       values ($1, $2, $3, $4, $5, now() + ($6::text)::interval, $7, $8, $9) returning id`,
      [
        inviter.tenantId,
        email,
        top,
        o.role ?? "member",
        sha256(token),
        o.expired ? "-1 minute" : "7 days",
        inviter.memberId,
        o.revoked ? new Date() : null,
        o.used ? inviter.memberId : null,
      ],
    );
    const id = r.rows[0]!.id;
    if (o.message !== undefined && o.message !== null)
      await h.admin.query("update invitations set message = $2 where id = $1", [id, o.message]);
    return { token, id, tenantId: inviter.tenantId, email, scopeId: top };
  };
  const tokenOf: InviteHarness["tokenOf"] = async (u) => {
    // 入り方を 1 つ持つ人にしてから入る（段 2 の「付けるまで進めない」の印 mfa_pending が立たない・K-321 の addTestEntry と同じ「試験の鍵」）。
    //   パスキーの表（K-304）が無ければ何もしない
    const t = await h.admin.query<{ t: string | null }>("select to_regclass('kaname_auth.passkey')::text as t");
    if (t.rows[0]?.t)
      await h.admin.query(
        `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
         select gen_random_uuid()::text, '試験の鍵', 'test-entry', $1, 'test-entry-' || gen_random_uuid()::text, 0, 'singleDevice', false, 'internal', now()
          where not exists (select 1 from kaname_auth.passkey where "userId" = $1 and name = '試験の鍵')`,
        [u.userId],
      );
    // 契約のログインの口（K-301・本線にある）で入る。部品のログインの関数を直に呼ばない（段 2 の K-308・K-321 が件数を数えている呼び方を増やさない）
    const r = await h.signIn(u.email, PW);
    if (r.status !== 201) throw new Error(`ログインの口が ${r.status}：${await r.text()}`);
    return String((await h.json(r)).data!["token"]);
  };
  const bearer: InviteHarness["bearer"] = (t) => ({ authorization: `Bearer ${t}` });
  const preview: InviteHarness["preview"] = (t, o = {}) => h.req("GET", INVITATION(t), undefined, o);
  const accept: InviteHarness["accept"] = (t, body = {}, o = {}) => h.req("POST", ACCEPT(t), body, o);
  const resendRequest: InviteHarness["resendRequest"] = (t, o = {}) => h.req("POST", RESEND(t), {}, o);
  const row: InviteHarness["row"] = async (id) =>
    (
      await h.admin.query<{ accepted_member_id: string | null; revoked_at: Date | null; updated_at: Date }>(
        "select accepted_member_id, revoked_at, updated_at from invitations where id = $1",
        [id],
      )
    ).rows[0]!;
  const authUsers: InviteHarness["authUsers"] = async (email) =>
    Number(
      (
        await h.admin.query<{ n: string }>(
          'select count(*) as n from kaname_auth."user" where lower(email) = lower($1)',
          [email],
        )
      ).rows[0]!.n,
    );
  const tenants: InviteHarness["tenants"] = async () =>
    Number((await h.admin.query<{ n: string }>("select count(*) as n from tenants")).rows[0]!.n);
  return Object.assign(Object.create(h) as Login, {
    owner,
    invite,
    tokenOf,
    bearer,
    preview,
    accept,
    resendRequest,
    row,
    authUsers,
    tenants,
  }) as InviteHarness;
}
