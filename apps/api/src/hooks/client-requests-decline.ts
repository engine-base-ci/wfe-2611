// 依頼を断る（K-895）の契約の口 declineClientRequest。振る舞いの本体は apps/api/src/features/F11/requests/decline.ts（文面は mail.ts）。
//   依頼を読む・返す・受けるは、それぞれの葉が自分の hooks のファイルを持つ（このファイルに足さない）
import { createDeclineClientRequest } from "../features/F11/requests/decline.js";
import { defineHooks } from "./registry.js";

export const register = defineHooks({
  name: "clientRequestsDeclineHooks",
  make: (d) => ({ declineClientRequest: { before: createDeclineClientRequest(d) } }),
  fuzz: "same",
});
