// 運営がひな形を読む口（K-992・契約の口 listOpsTemplates・getOpsTemplate）。中身は apps/api/src/features/F12/ops/templates/read.ts。
//   上限・ops:distribute・:id の形（uuid）は契約の入口（op.ts）が先に確かめる
import type { Hook } from "../contract/deps.js";
import {
  createGetOpsTemplate,
  createListOpsTemplates,
  type OpsTemplatesDeps,
} from "../features/F12/ops/templates/read.js";
import { defineHooks } from "./registry.js";

export function opsTemplatesReadHooks(d: OpsTemplatesDeps): Record<string, Hook> {
  return {
    listOpsTemplates: { before: createListOpsTemplates(d) },
    getOpsTemplate: { before: createGetOpsTemplate(d) },
  };
}

export const register = defineHooks({
  name: "opsTemplatesReadHooks",
  make: (d) => opsTemplatesReadHooks({ appPool: d.appPool }),
  fuzz: "same",
});
