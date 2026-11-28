// 招く口（createInvitations）が、打ったとおりの宛てを照らす pattern（K-419）。
//   契約（08_api/openapi.yaml の InvitationsCreateInput の emails の items）と同じ字。契約の側は scripts/ci/invite_patterns.py が作る。
//   同じ字かは試験 K419-API-024 が openapi.yaml と照らす（pattern と字がずれたら赤）。口はこの pattern に合う宛てだけを normalizeEmail でそろえて使う
//   前の口（normalizeEmail でそろえてから EMAIL_RE で見る）が受けていた入力は今も受ける（PM の決め 2026-11-21 02:45）：試験 K419-API-027 が全 BMP の 1 字で並べて照らす

/** trim が落とす字（全角の空白 U+3000 も）。JavaScript の \s と同じ字 */
const WS = " \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff";
/** NFKC で @ になる字（半角・全角・小さい @）と、. になる字（半角・全角・小さい点・一点リーダー） */
const AT = "[@＠﹫]";
const DOT = "[.․﹒．]";
/** @ でも空白でもない字（NFKC の後に 2 字以上へ開く ‥ ⒈ ㏂ などは、点とは数えずふつうの字として通す） */
const NOT = `[^@＠﹫${WS}]`;
const SP = `[${WS}]*`;

/** 宛て 1 つの長さの上限（打ったとおりの字・そろえる前）。pattern を当てる前に確かめる（長い入力で正規表現が二乗の時間にならないため・PM の決め 2026-11-21 03:40）。契約の items.maxLength と同じ */
export const INVITE_EMAIL_MAX_LENGTH = 320;

/** 宛て 1 つ：空白（半角・全角・中も）は許し、そろえるときに落ちる。@ で 2 つに分かれ、後ろの名前の中ほどに点がある（前と同じ形） */
export const INVITE_EMAIL_PATTERN = `^${SP}(?:${NOT}${SP})+${AT}${SP}${NOT}(?:${SP}${NOT})*${SP}${DOT}(?:${SP}${NOT})+${SP}$`;
