"use client";
import type { ReactNode } from "react";
import { useShell } from "./context";

/** 時点に依存する部品（AI パネル・件数・データ由来の一覧）。その cap が無い時点では出さない（screen-derivation §9・data-requires） */
export function PsGate({ requires, children }: { requires: string; children: ReactNode }) {
  const { caps } = useShell();
  const ok = requires.split(" ").every((c) => caps.includes(c));
  if (!ok) return null;
  return (
    <div data-requires={requires} className="contents">
      {children}
    </div>
  );
}
/** 役割ごとに中身が変わる塊（D-073・data-roles）。含まれない役割には出さない（錠前だけの画面を作らない） */
export function RoleGate({ roles, children }: { roles: string; children: ReactNode }) {
  const { role } = useShell();
  if (!roles.split(" ").includes(role)) return null;
  return (
    <div data-roles={roles} className="contents">
      {children}
    </div>
  );
}
