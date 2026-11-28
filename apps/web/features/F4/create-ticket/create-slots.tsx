"use client";
// 作る面の差し込み口（K-442 が置く）。どれも 1 行で先のファイルの …Fill を呼ぶだけ。中身の葉（K-443・K-444・K-580）は先のファイルだけを直し、このファイルは触らない
import { DueSlotFill } from "../due/create-slot";
import { LinksSlotFill } from "../links/create-slot";
import { ParentSlotFill } from "../parent/create-slot";
import type { DueSlotProps, LinksSlotProps, ParentSlotProps } from "./create-slot-types";

export type { CreateLink, DueSlotProps, LinksSlotProps, ParentSlotProps } from "./create-slot-types";

export const ParentSlot = (p: ParentSlotProps) => <ParentSlotFill {...p} />;
export const DueSlot = (p: DueSlotProps) => <DueSlotFill {...p} />;
export const LinksSlot = (p: LinksSlotProps) => <LinksSlotFill {...p} />;
