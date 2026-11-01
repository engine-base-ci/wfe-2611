// Claude Code・npm・フックに渡す環境変数（D-092・段階 1 は本人のサブスクだけ）。
// 親の環境をそのまま渡さない。Bridge を起こした環境に ANTHROPIC_API_KEY 等があると、
// Claude Code がサブスクではなくその鍵で動き、API の料金がかかりうる（2026-09-28・Atelier との突き合わせで判明）。
// 渡すのは、動くのに要る名前（家・利用者・言語・一時置き場・プロキシ・OS の必須）だけ。それ以外は名前を足すまで渡らない
const ALLOW = [
  // 家と利用者（USER が無いと Claude Code がログインしていない扱いになる・Atelier で実測）
  "HOME", "USER", "LOGNAME", "SHELL",
  // 言語と時刻
  "LANG", "LANGUAGE", "TZ",
  // 一時置き場・設定の置き場
  "TMPDIR", "TEMP", "TMP", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME",
  // 会社のネットワーク（プロキシ・社内の証明書）
  "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR",
  // Windows の必須
  "USERPROFILE", "USERNAME", "APPDATA", "LOCALAPPDATA", "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "PATHEXT",
  "HOMEDRIVE", "HOMEPATH", "ProgramFiles", "ProgramFiles(x86)", "ProgramData", "ProgramW6432", "CommonProgramFiles",
] as const;
/** 名前の頭で許すもの（言語の細目だけ） */
const ALLOW_PREFIX = ["LC_"] as const;
/** 何があっても渡さないもの（許可リストに誤って足されても落とす）。モデルの鍵・別の請求先の切り替え */
const DENY = /^(ANTHROPIC_|CLAUDE_CODE_USE_(BEDROCK|VERTEX|FOUNDRY)|AWS_|GOOGLE_|GCLOUD_|AZURE_|OPENAI_|VERTEX_)/;

/** 子プロセスに渡す環境。PATH は本人のシェルのもの。extra は Bridge が決めた値（KANAME_* 等）だけ */
export function childEnv(path: string, extra: Record<string, string> = {}, from: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(from)) {
    if (v === undefined || DENY.test(k)) continue;
    if ((ALLOW as readonly string[]).includes(k) || ALLOW_PREFIX.some((p) => k.startsWith(p))) out[k] = v;
  }
  out["PATH"] = path;
  for (const [k, v] of Object.entries(extra)) if (!DENY.test(k)) out[k] = v;
  return out;
}
