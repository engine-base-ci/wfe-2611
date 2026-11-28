"use client";
// 運営の宛先を画面の外枠まで渡す（K-1008・止められた画面の「再開するには」の宛先）。
//   値は設定（@kaname/config の legalValues().operator.email・環境の OPS_EMAIL）をルートのレイアウト（サーバー）で読んで渡す。
//   画面に宛先を直書きしない（K-315 の /help と同じ値）。Provider の外では空の字（読めないときに嘘の宛先を出さない）
import { createContext, useContext, type ReactNode } from "react";

const OpsContact = createContext<string>("");

export function OpsContactProvider({ email, children }: { email: string; children: ReactNode }) {
  return <OpsContact.Provider value={email}>{children}</OpsContact.Provider>;
}

/** 運営の宛先（メールの住所） */
export function useOpsContact(): string {
  return useContext(OpsContact);
}
