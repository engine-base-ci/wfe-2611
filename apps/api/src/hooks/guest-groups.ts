// ゲストのグループの契約の口（K-876）：一覧を読む listGuestGroups・作る createGuestGroup（D-155.39・D-155.40）。
//   振る舞いの本体は apps/api/src/features/F11/guest-groups/。招く口（createInvitations）のゲストの枝は hooks/workspace-invitations.ts の口が持つ
import { createCreateGuestGroup } from "../features/F11/guest-groups/create.js";
import { createListGuestGroups } from "../features/F11/guest-groups/list.js";
import { defineHooks } from "./registry.js";

export const register = defineHooks({
  name: "guestGroupHooks",
  make: (d) => ({
    listGuestGroups: { before: createListGuestGroups(d.appPool) },
    createGuestGroup: { before: createCreateGuestGroup(d.appPool) },
  }),
  fuzz: "same",
});
