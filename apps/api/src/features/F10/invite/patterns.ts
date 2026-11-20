// 招く口（createInvitations）が、打ったとおりの宛てを照らす pattern（K-419）。
//   契約（08_api/openapi.yaml の InvitationsCreateInput の emails の items）と同じ字。契約の側は scripts/ci/invite_patterns.py が作る。
//   同じ字かは試験 K419-API-024 が openapi.yaml と照らす（pattern と字がずれたら赤）。口はこの pattern に合う宛てだけを normalizeEmail でそろえて使う

/** trim が落とす字（全角の空白 U+3000 も） */
const WS = " \\t\\n\\r\\v\\f\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff";
/** 宛ての中に入れない字：@（半角・全角・小さい @）と空白 */
const BAD = `@＠﹫${WS}`;

/** 宛て 1 つ：前後の空白は許し、中に空白は無く、@（半角か全角）で 2 つに分かれ、後ろの名前に点（半角か全角）がある。大文字・全角はそろえる前の字として通す */
export const INVITE_EMAIL_PATTERN = `^[${WS}]*[^${BAD}]+[@＠][^${BAD}]+[.．][^${BAD}]+[${WS}]*$`;
