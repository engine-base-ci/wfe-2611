// 鍵を受け取る（T-B-05・D-102.2・D-017.1）。Bridge は Infisical に入らない。
//   Kaname の関門 C8 が解いた値を「いま動いている仕事」のためだけに受け取り、使う間（use の中）だけ持ち、終わったら捨てる。
//   ディスクに書かない・ログに出さない・AI には渡さない（AI が持つのは参照 ID だけ。道具の引数にも載せない：guard.ts D-107.7）。
//   受け取りが途中で切れた・中身が欠けている・届かないときは成功にしない（G-15・G-11）。理由は値を含まない文で返す
export interface Credential {
  login: string;
  password: string;
  /** 認証アプリの秘密鍵（Base32）。無ければ null */
  totpSecret: string | null;
  serviceName: string | null;
}
export interface VaultDeps {
  apiBase: string;
  sessionId: () => string | null;
  /** 届かないときに待つ上限（既定 15 秒） */
  timeoutMs?: number;
}
export class CredentialError extends Error {
  constructor(
    message: string,
    readonly kind: "unreachable" | "denied" | "notfound" | "incomplete" | "gone",
    readonly handoff: string | null = null,
  ) {
    super(message);
  }
}
const UUID = /^[0-9a-f-]{36}$/i;

/** 受け取り口（Kaname）から 1 件を取る。値はここでしか扱わない */
async function fetchCredential(d: VaultDeps, jobId: string, credentialId: string): Promise<Credential> {
  const sid = d.sessionId();
  if (!sid) throw new CredentialError("この端末の接続は切れています。つなぎ直してください", "gone");
  if (!UUID.test(credentialId) || !UUID.test(jobId)) throw new CredentialError("資格情報の指定が正しくありません", "notfound");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), d.timeoutMs ?? 15_000);
  let r: Response;
  try {
    r = await fetch(`${d.apiBase}/api/auth-ext/bridge/credentials/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-session": sid },
      body: JSON.stringify({ job_id: jobId, credential_id: credentialId }),
      signal: ctl.signal,
    });
  } catch {
    // 届かない（G-11）：黙って失敗せず理由を返す。値は無いので漏れない
    throw new CredentialError("Kaname に届かないので、ログイン情報を受け取れませんでした", "unreachable", "少し待ってからもう一度");
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 401 || r.status === 410) throw new CredentialError("この端末の接続は切れています。つなぎ直してください", "gone");
  if (r.status === 404) throw new CredentialError("預けたログイン情報が見つかりません（消した・失効した）", "notfound", "預け直す");
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { message?: unknown; handoff?: unknown };
    throw new CredentialError(
      typeof body.message === "string" ? body.message : `Kaname が ${r.status}`,
      r.status === 403 ? "denied" : "unreachable",
      typeof body.handoff === "string" ? body.handoff : null,
    );
  }
  // 途中で切れた・空・欠け（G-15）：成功にしない
  let j: { data?: { login?: unknown; password?: unknown; totp_secret?: unknown; service_name?: unknown } };
  try {
    j = (await r.json()) as typeof j;
  } catch {
    throw new CredentialError("ログイン情報の受け取りが途中で切れました", "incomplete", "もう一度");
  }
  const dd = j?.data;
  if (!dd || typeof dd.login !== "string" || !dd.login || typeof dd.password !== "string" || !dd.password)
    throw new CredentialError("受け取ったログイン情報が欠けていたので使いません", "incomplete", "預け直す");
  return {
    login: dd.login,
    password: dd.password,
    totpSecret: typeof dd.totp_secret === "string" && dd.totp_secret ? dd.totp_secret : null,
    serviceName: typeof dd.service_name === "string" ? dd.service_name : null,
  };
}

/** 消す：参照を外し、中身を空にする（JS の文字列は書き換えられないので、持っている場所を無くす） */
function wipe(c: Credential): void {
  c.login = "";
  c.password = "";
  c.totpSecret = null;
}

/** 値を使う間だけ持つ。use の中でだけ値に触れ、戻ったら（失敗しても）消す。use の外に値を持ち出さない */
export async function withCredential<T>(d: VaultDeps, jobId: string, credentialId: string, use: (c: Credential) => Promise<T>): Promise<T> {
  const c = await fetchCredential(d, jobId, credentialId);
  try {
    return await use(c);
  } finally {
    wipe(c);
  }
}

/** 文の中に値が紛れていたら伏せる（ログ・証跡・会話に出す前の最後の砦） */
export function redact(text: string, c: Pick<Credential, "login" | "password" | "totpSecret">): string {
  let out = text;
  for (const v of [c.password, c.totpSecret, c.login]) if (v && v.length >= 4) out = out.split(v).join("＊＊＊");
  return out;
}
