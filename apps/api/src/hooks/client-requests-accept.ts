// 依頼を受けて普通のチケットを作る（K-894）の契約の口 acceptClientRequest。振る舞いの本体は apps/api/src/features/F11/requests/accept.ts。
//   依頼を読む・返す・断るは、それぞれの葉が自分の hooks のファイルを持つ（このファイルに足さない）。
//   ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import { createAcceptClientRequest } from "../features/F11/requests/accept.js";
import { defineHooks } from "./registry.js";

export const register = defineHooks({
  name: "clientRequestsAcceptHooks",
  make: (d) => ({ acceptClientRequest: { before: createAcceptClientRequest(d.appPool) } }),
  fuzz: "same",
});
