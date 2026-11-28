"use client";
// 差し込み口の先：自分で直す（持ち主の葉 K-743。器 slots.tsx と帯のファイルは触らない）。
//   承認の帯の［自分で直す］と成果物の場所（開いている間は直す面）。本物は features/F5/self-edit/self-edit.tsx
import type { ReactNode } from "react";
import { ArtifactArea, SelfEditAct } from "@/features/F5/self-edit/self-edit";
import type { ArtifactAreaProps, SelfEditActProps } from "../slots";

export function SelfEditActFill(props: SelfEditActProps): ReactNode {
  return <SelfEditAct {...props} />;
}
export function ArtifactAreaFill(props: ArtifactAreaProps): ReactNode {
  return <ArtifactArea {...props} />;
}
