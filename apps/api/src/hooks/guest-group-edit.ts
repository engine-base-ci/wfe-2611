// ゲストのグループの名前を直す・消す（K-927）の契約の口。振る舞いの本体は apps/api/src/features/F11/guest-groups/（rename.ts・remove.ts）。
// ここは「作った口」の一覧（生成の試験と目録がこのフォルダを見る）
import { createRenameGuestGroup } from "../features/F11/guest-groups/rename.js";
import { createDeleteGuestGroup } from "../features/F11/guest-groups/remove.js";
import { defineHooks } from "./registry.js";

export const register = defineHooks({
  name: "guestGroupEditHooks",
  make: (d) => ({
    updateGuestGroup: { before: createRenameGuestGroup(d.appPool) },
    deleteGuestGroup: { before: createDeleteGuestGroup(d.appPool) },
  }),
  fuzz: "same",
});
