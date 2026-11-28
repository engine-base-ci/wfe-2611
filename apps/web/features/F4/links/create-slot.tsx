"use client";
// 作る面の「＋ つながりを足す」の中身（K-442 が既定を置き、K-580 が押せる形に替えた）。相手を探して選ぶ小窓と足した一覧は create-links.tsx
import type { LinksSlotProps } from "../create-ticket/create-slot-types";
import { CreateLinks } from "./create-links";

export function LinksSlotFill(props: LinksSlotProps) {
  return <CreateLinks {...props} />;
}
