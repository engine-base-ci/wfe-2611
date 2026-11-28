// ゲストが足す添付の大きさと種類の検査（K-909・契約の口 uploadPortalAttachment・D-155.12・D-155.53・TP-FILE-01・TP-FILE-02）。
//   純粋な関数だけ（DB も置き場も呼ばない）。置き場（関門 C4）に置く前に口が呼び、通った物だけを置く。
//   大きさ：1〜700000 バイト（契約の入口の 1MB に base64 で入る大きさ・2026-11-23 の決め）。
//   種類：実行できる形式を、名前の拡張子（最後でも途中でも）と中身の先頭の印の両方で断る（拡張子と中身が食い違っても中身で見分ける）

/** 1 つのファイルの中身の上限（バイト） */
export const ATTACHMENT_MAX_BYTES = 700_000;
/** 本人が依頼に付ける前に持てる下書きの数 */
export const ATTACHMENT_MAX_DRAFTS = 5;

/** 実行できる形式の拡張子（大文字小文字を区別しない） */
export const BLOCKED_EXTENSIONS: ReadonlySet<string> = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "ps1",
  "vbs",
  "js",
  "jar",
  "sh",
  "app",
  "dmg",
  "apk",
  "dll",
  "bin",
  "pif",
  "lnk",
]);

/** 実行できる形式の中身の先頭の印（MZ・ELF・#!・Mach-O） */
export const BLOCKED_MAGIC: readonly (readonly number[])[] = [
  [0x4d, 0x5a], // MZ（Windows の実行ファイル）
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0x23, 0x21], // #!（スクリプト）
  [0xfe, 0xed, 0xfa, 0xce], // Mach-O
  [0xfe, 0xed, 0xfa, 0xcf],
  [0xce, 0xfa, 0xed, 0xfe],
  [0xcf, 0xfa, 0xed, 0xfe],
];

export type UploadCheck = { ok: true } | { ok: false; code: "E-GST-181" | "E-GST-182" | "E-GST-184" };

/** 名前のどこかの拡張子（最初の点より後ろの区切り全部）が実行できる形式か */
function hasBlockedExtension(name: string): boolean {
  const parts = name.toLowerCase().split(".").slice(1);
  return parts.some((p) => BLOCKED_EXTENSIONS.has(p.trim()));
}

function startsWith(bytes: Uint8Array, head: readonly number[]): boolean {
  if (bytes.byteLength < head.length) return false;
  return head.every((b, i) => bytes[i] === b);
}

/** 大きさ（空・大きすぎ）→ 種類（拡張子・中身の先頭）の順に見る */
export function checkUpload(f: { name: string; bytes: Uint8Array }): UploadCheck {
  if (f.bytes.byteLength === 0) return { ok: false, code: "E-GST-184" };
  if (f.bytes.byteLength > ATTACHMENT_MAX_BYTES) return { ok: false, code: "E-GST-181" };
  if (hasBlockedExtension(f.name)) return { ok: false, code: "E-GST-182" };
  if (BLOCKED_MAGIC.some((m) => startsWith(f.bytes, m))) return { ok: false, code: "E-GST-182" };
  return { ok: true };
}
