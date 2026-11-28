// 届いた依頼を読む口（K-892）の契約の口。振る舞いの本体は apps/api/src/features/F11/requests/read.ts（流れと操作ごとのフォルダ・D-128.130）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import { createGetClientRequest, createListClientRequests } from "../features/F11/requests/read.js";
import { defineHooks } from "./registry.js";

export const register = defineHooks({
  name: "clientRequestsReadHooks",
  make: (d) => ({
    listClientRequests: { before: createListClientRequests(d.appPool) },
    getClientRequest: { before: createGetClientRequest(d.appPool) },
  }),
  fuzz: "same",
});
