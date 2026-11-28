"use client";
// コピー（全体・表・コードごと・D-104.17）。できたら小さく知らせる。できなければ理由を出す（黙って失敗しない）
import { toast } from "sonner";

export async function copyText(text: string, done = "コピーしました"): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
    return true;
  } catch {
    toast("コピーできませんでした。文を選んでコピーしてください");
    return false;
  }
}
