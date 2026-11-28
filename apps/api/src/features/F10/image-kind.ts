// 画像の種類を中身の先頭の印（マジックバイト）で見る（K-828・ロゴ／K-834・顔の写真）。content-type と名前は信じない。
//   受けるのは PNG・JPEG・WebP だけ。SVG・GIF・空・画像でない物は null（口が 422 にする）
export type ImageKind = "png" | "jpeg" | "webp";

/** 見分けに要る先頭のバイト数（WebP の RIFF ＋ 大きさ 4 バイト ＋ WEBP） */
export const IMAGE_HEAD_BYTES = 12;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG = [0xff, 0xd8, 0xff] as const;
const RIFF = [0x52, 0x49, 0x46, 0x46] as const; // "RIFF"
const WEBP = [0x57, 0x45, 0x42, 0x50] as const; // "WEBP"（8 バイト目から）

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0): boolean =>
  b.length >= at + sig.length && sig.every((x, i) => b[at + i] === x);

/** 先頭 12 バイト（それより長くてもよい）から種類を返す。合わなければ null */
export function imageKind(head: Uint8Array): ImageKind | null {
  if (startsWith(head, PNG)) return "png";
  if (startsWith(head, JPEG)) return "jpeg";
  if (startsWith(head, RIFF) && startsWith(head, WEBP, 8)) return "webp";
  return null;
}

/** 置き場に書く content-type（中身から決めた種類で決める） */
export function contentTypeOf(kind: ImageKind): string {
  return kind === "png" ? "image/png" : kind === "jpeg" ? "image/jpeg" : "image/webp";
}
