"use client";
// 前の道 /ai/chat（K-762 から）：分身の部屋の「話す」（/ai/talk）へ送るだけ。?c=<会話の id> などはそのまま渡す。
//   前の会話の画面の部品は読まない（消すのは K-765）
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CloneChatPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/ai/talk${window.location.search}` as Route);
  }, [router]);
  return null;
}
