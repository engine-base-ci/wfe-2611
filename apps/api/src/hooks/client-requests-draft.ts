// 分身の案の仕事を出す（K-896）の契約の口 requestClientRequestDraft。振る舞いの本体は apps/api/src/features/F11/requests/draft.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import { createRequestClientRequestDraft } from "../features/F11/requests/draft.js";
import { defineHooks } from "./registry.js";

export const register = defineHooks({
  name: "clientRequestsDraftHooks",
  make: (d) => ({ requestClientRequestDraft: { before: createRequestClientRequestDraft(d.appPool) } }),
  fuzz: "same",
});
