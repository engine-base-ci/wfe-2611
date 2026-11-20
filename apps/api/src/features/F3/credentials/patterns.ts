// 預けたログイン情報の口（預ける・上書きする）が、打ったとおりの入力を照らす pattern（K-383）。
//   契約（08_api/openapi.yaml の CredentialCreateInput・CredentialUpdateInput）と同じ字。契約の側は scripts/ci/credential_patterns.py が作る。
//   同じ字かは試験 K352-API-026 が openapi.yaml と照らす（pattern と字がずれたら赤）。口はこの pattern に合う入力だけを整えて使う
/** 公開の接尾辞（誰でも下に名前を取れる 2 段の名前）。これだけを使える場所にすると、よその会社の宛先にも当たる（代表の答え answer=449e72553c59）。
 *  1 段だけの名前（jp・com）は形の確かめが先に断る。全部の一覧（Public Suffix List）は部品の追加が要るので、日本とよく使う国の分だけを持つ */
export const PUBLIC_SUFFIXES_LIST: readonly string[] = [
  "co.jp", "ne.jp", "or.jp", "ac.jp", "ad.jp", "ed.jp", "go.jp", "gr.jp", "lg.jp",
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz", "co.kr", "com.cn", "com.tw", "com.sg", "com.br",
]; // prettier-ignore

/** trim が落とす字（全角の空白 U+3000 も） */
const WS = " \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff";
const ch = (c: string): string => {
  if (c === ".") return "[.．]";
  const full = String.fromCharCode(c.charCodeAt(0) - 0x61 + 0xff41);
  return `[${c}${c.toUpperCase()}${full}${String.fromCharCode(full.charCodeAt(0) - 0x20)}]`;
};
const word = (s: string): string => [...s].map(ch).join("");

/** 名前：半角と全角の英字で始まり、英字・数字・_ の 64 文字まで。ß・ı・ſ のように大文字にすると英字になる字は入れない */
export const NAME_PATTERN = `^[${WS}]*[A-Za-zＡ-Ｚａ-ｚ][A-Za-z0-9_Ａ-Ｚａ-ｚ０-９＿]{0,63}[${WS}]*$`;

const ALNUM = "A-Za-z0-9Ａ-Ｚａ-ｚ０-９";
const JP = "ぁ-ゖァ-ヶー一-龥";
const NOT_XN = `(?!${word("xn")}--)`;
const ASCII_LABEL = `${NOT_XN}[${ALNUM}](?:[${ALNUM}-]{0,61}[${ALNUM}])?`;
const JP_LABEL = `[${JP}](?:[${JP}${ALNUM}-]{0,8}[${JP}${ALNUM}])?`;
const LABEL = `(?:${ASCII_LABEL}|${JP_LABEL})`;
const TLD = `${NOT_XN}[A-Za-zＡ-Ｚａ-ｚ][${ALNUM}-]{1,62}`;
const HOST = `(?:${LABEL}[.．])+${TLD}[.．]?`;
const SUFFIX_LOOK = `(?!(?:\\*[.．])?(?:${PUBLIC_SUFFIXES_LIST.map(word).join("|")})[.．]?(?:[/?#]|[${WS}]|$))`;
const SCHEME = `${word("http")}${ch("s")}?://`;
const USERINFO = "(?:[A-Za-z0-9._~%!$&'()*+,;:=-]+@)?";
const PATH = "(?:[/?#][A-Za-z0-9._~%!$&'()*+,;=:@/?#-]*)?";
/** 使える場所 1 つ：URL（http・https・@ の前・道・問い合わせ・断片）・大文字・全角・日本語の名前・末尾の点・頭の *. 。公開の接尾辞だけは入れない */
export const DESTINATION_PATTERN = `^[${WS}]*(?:${SCHEME}${USERINFO}${SUFFIX_LOOK}${HOST}${PATH}|${SUFFIX_LOOK}(?:\\*[.．])?${HOST})[${WS}]*$`;

/** 認証アプリの鍵：半角の空白と大文字・小文字・全角の Base32 を 16 字以上 */
export const TOTP_PATTERN = "^[ \\t]*(?:[A-Za-zＡ-Ｚａ-ｚ2-7２-７][ \\t]*){16,}=*[ \\t]*$";

const M31 = "(?:0[13578]|1[02])-(?:0[1-9]|[12][0-9]|3[01])";
const M30 = "(?:0[469]|11)-(?:0[1-9]|[12][0-9]|30)";
const FEB = "02-(?:0[1-9]|1[0-9]|2[0-8])";
const LEAP = "(?:[0-9]{2}(?:0[48]|[2468][048]|[13579][26])|(?:00|0[48]|[2468][048]|[13579][26])00)-02-29";
/** 期限：年-月-日（半角の数字）。暦に在る日だけ。日本の今日との前後は口が決める（時刻で決まる・409） */
export const EXPIRES_PATTERN = `^[${WS}]*(?:[0-9]{4}-(?:${M31}|${M30}|${FEB})|${LEAP})[${WS}]*$`;

/** ログイン名：空白だけでない */
export const LOGIN_PATTERN = "\\S";

export const NAME_RE_RAW = new RegExp(NAME_PATTERN);
export const DESTINATION_RE_RAW = new RegExp(DESTINATION_PATTERN);
export const TOTP_RE_RAW = new RegExp(TOTP_PATTERN);
export const EXPIRES_RE_RAW = new RegExp(EXPIRES_PATTERN);
export const LOGIN_RE_RAW = new RegExp(LOGIN_PATTERN);
