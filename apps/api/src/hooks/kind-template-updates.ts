// 会社の側のひな形の新しい版の口（K-993・契約の口 listKindTemplateUpdates・applyKindTemplateUpdate）。中身は apps/api/src/features/F9/settings/template-updates.ts。
//   上限・管理者か・体の形（choice）・:id の形（uuid）は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import { createTemplateUpdateHooks, type TemplateUpdatesDeps } from "../features/F9/settings/template-updates.js";
import { defineHooks } from "./registry.js";

export function kindTemplateUpdatesHooks(d: TemplateUpdatesDeps): Record<string, Hook> {
  return createTemplateUpdateHooks(d);
}

export const register = defineHooks({
  name: "kindTemplateUpdatesHooks",
  make: (d) => kindTemplateUpdatesHooks({ appPool: d.appPool }),
  fuzz: "same",
});
