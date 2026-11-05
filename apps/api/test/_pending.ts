// 試験の下ごしらえ：保留の申し込みを直に置き、確認のリンクの手がかりを返す（K-51 で前の道すじ POST /api/auth-ext/sign-up を消したため）。
//   登録そのものの振る舞いは apps/api/test/features/F1/sign-up.test.ts（契約の口・本物の DB）が持つ。ここは「確定した本人」を作りたい試験の道具
import pg from "pg";
import { putPending } from "@kaname/auth/pending";

const pools = new Map<string, pg.Pool>();
/** 申し込みを置き、確認のメールのリンクの手がかり（verify-signup に渡す token）を返す */
export async function pendingToken(
  authUrl: string,
  masterKey: string,
  input: { email: string; password: string; companyName?: string; name?: string },
): Promise<string> {
  const pool = pools.get(authUrl) ?? new pg.Pool({ connectionString: authUrl, max: 1, allowExitOnIdle: true });
  pools.set(authUrl, pool);
  const { token } = await putPending(pool, masterKey, {
    email: input.email,
    password: input.password,
    name: input.name ?? input.companyName ?? "試験",
    companyName: input.companyName ?? "",
  });
  return token;
}
