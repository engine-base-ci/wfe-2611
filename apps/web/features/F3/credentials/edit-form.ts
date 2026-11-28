// 上書きの小窓の値 → 上書きの口 updateCredential の体（K-357・正は口の葉 K-353 の入力の整え）。画面の部品は持たない（直し方だけ）。
//   ログイン情報：ID とパスワードのどちらかを入れたら両方を送る（片方なら口が 422 E-CRED-005 を欄の下に出す）。入れなければ送らない。
//   鍵：値が空なら送らない。使える場所は預けるときと同じ直し方。期限は空なら null（期限を外す）・書けば YYYY-MM-DD に寄せる。理由は空なら送らない。
//   既定の値：使える場所は今の物を「, 」でつなぎ、期限は YYYY/MM/DD、値と理由は空
import type { Ops } from "@kaname/contracts";
import { normalizeDestinations, normalizeExpires } from "./add-form";
import type { CredentialRow } from "./to-item";
import type { EditCredentialErrors, EditCredentialField, EditCredentialValues } from "./views";

export type UpdateCredentialBody = Ops["updateCredential"]["body"];

const FIELDS: readonly EditCredentialField[] = ["login", "password", "value", "destinations", "expires_on", "reason"];

export const editValuesOf = (it: CredentialRow): EditCredentialValues => ({
  login: "",
  password: "",
  value: "",
  destinations: it.destinations.join(", "),
  expires_on: it.expiresOn ? it.expiresOn.replace(/-/g, "/") : "",
  reason: "",
});

export function toUpdateBody(kind: "login" | "key", v: EditCredentialValues): UpdateCredentialBody {
  const secret =
    kind === "login"
      ? v.login !== "" || v.password !== ""
        ? { login: v.login, password: v.password }
        : {}
      : v.value !== ""
        ? { value: v.value }
        : {};
  const expires = normalizeExpires(v.expires_on);
  return {
    ...secret,
    destinations: normalizeDestinations(v.destinations),
    expires_on: expires === "" ? null : expires,
    ...(v.reason.trim() === "" ? {} : { reason: v.reason }),
  };
}

/** 口の 422 の欄ごとの理由 → 小窓の欄。小窓に無い欄は返さない */
export function editErrorsOf(fields: Record<string, string>): EditCredentialErrors {
  const out: EditCredentialErrors = {};
  for (const [key, message] of Object.entries(fields)) {
    const f = FIELDS.find((x) => x === key.split(/[.[]/)[0]);
    if (f && !out[f]) out[f] = message;
  }
  return out;
}
