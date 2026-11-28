// PC が案を返す口（K-897）の契約の口。振る舞いの本体は apps/api/src/features/F11/requests/draft-result.ts。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）。
//   冪等は入口のまま（同じ冪等キーの再送は 1 回目の答え。キー無しの再送は、仕事がもう終わっているので 404・E-GST-150）
import { createReportClientRequestDraft } from "../features/F11/requests/draft-result.js";
import { defineHooks } from "./registry.js";

export const register = defineHooks({
  name: "clientRequestsDraftResultHooks",
  make: (d) => ({ reportClientRequestDraft: { before: createReportClientRequestDraft(d.appPool) } }),
  fuzz: "same",
});
