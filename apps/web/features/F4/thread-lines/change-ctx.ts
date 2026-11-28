// 会社の項目の名前の引き先（K-574）。詳細の答え（getTicket・K-560）の fields（id と名前）から作る。
//   前の形の答え（fields が無い）・形の崩れた答えは空の引き先（名前が引けない行は「会社の項目」の字になる）。
import type { ChangeCtx } from "./change-text";

export function makeChangeCtx(fields: unknown): ChangeCtx {
  const names = new Map<string, string>();
  if (Array.isArray(fields)) {
    for (const f of fields as unknown[]) {
      if (typeof f !== "object" || f === null) continue;
      const { id, name } = f as { id?: unknown; name?: unknown };
      if (typeof id === "string" && typeof name === "string" && name !== "") names.set(id, name);
    }
  }
  return { fieldName: (id) => names.get(id) ?? null };
}
