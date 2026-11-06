// 試験の下ごしらえ：「確定した本人」を作る道具（K-51 で前の道すじ POST /api/auth-ext/sign-up を、K-52 で POST /api/auth-ext/verify-signup を消したため）。
//   登録の振る舞いは apps/api/test/features/F1/sign-up.test.ts、確認のリンクで確定する振る舞いは apps/api/test/features/F1/verify-email.test.ts
//   （どちらも契約の口・本物の DB）が持つ。ここは、確定した本人とログインの印が要るだけの試験の道具。
//   この道具を使う試験（apps/api/test/*.test.ts の 18 本）は createApp を契約の hooks 無しで組むので、契約の口 verifySignup はそこでは 501 になる。
//   だから口は通さず、契約の口の確定と同じ部品（signUp → Better Auth の hook が app.create_company で会社・根の層・代表・自分のAI を作る）で作る。
import pg from "pg";
import type { Auth } from "@kaname/auth";
import { putPending } from "@kaname/auth/pending";
import { signUp } from "@kaname/auth/signup";
import { agreeCurrentTerms as agreeTerms } from "../../../packages/db/test/agree-terms.js";

const pools = new Map<string, pg.Pool>();
const poolOf = (url: string) => {
  const p = pools.get(url) ?? new pg.Pool({ connectionString: url, max: 1, allowExitOnIdle: true });
  pools.set(url, p);
  return p;
};
let kept: Auth | null = null;
/** 試験が組んだログインの部品を覚える（createAuth の答えをそのまま返す）。verifiedUser が使う */
export function keepAuth<T extends { auth: Auth }>(made: T): T {
  kept = made.auth;
  return made;
}

/** 申し込みを置き、確認のメールのリンクの手がかり（契約の口 POST /api/v1/auth/sign-up/verify に渡す token）を返す */
export async function pendingToken(
  authUrl: string,
  masterKey: string,
  input: { email: string; password: string; companyName?: string; name?: string },
): Promise<string> {
  const { token } = await putPending(poolOf(authUrl), masterKey, {
    email: input.email,
    password: input.password,
    name: input.name ?? input.companyName ?? "試験",
    companyName: input.companyName ?? "",
  });
  return token;
}

/** 確定した本人を作り、ログインの印を返す（メールは確認済み）。会社名が空なら名前で個人のテナント（K-52 の確定と同じ・D-125.135） */
export async function verifiedUser(
  authUrl: string,
  input: { email: string; password: string; companyName?: string; name?: string },
): Promise<{ token: string; userId: string; user_id: string }> {
  if (!kept) throw new Error("keepAuth(createAuth(...)) で、ログインの部品を先に渡す");
  const name = input.name ?? input.companyName ?? "試験";
  const r = await signUp(kept, {
    email: input.email,
    password: input.password,
    name,
    companyName: input.companyName || name,
  });
  await poolOf(authUrl).query('update kaname_auth."user" set "emailVerified" = true where id = $1', [r.userId]);
  await agreeCurrentTerms(r.userId);
  if (!r.token) throw new Error("ログインの印が返らない");
  return { token: r.token, userId: r.userId, user_id: r.userId };
}

/** 今の版の利用規約とプライバシーポリシーに同意済みにする（K-53）。SQL は packages/db/test/agree-terms.ts の 1 か所 */
export async function agreeCurrentTerms(userId: string, adminUrl = process.env["DATABASE_URL"]!): Promise<void> {
  const db = poolOf(adminUrl);
  await agreeTerms(async (sql, params) => (await db.query(sql, params)).rows, userId);
}
