"use client";
// 困ったとき（/help・K-315）の動き。開いたら誰でも読める稼働状況の口（getServiceStatus）を 1 回読み、部品（HelpView）に渡す。
//   答えまでは "loading"（区画の中だけ・3 秒の決まり）、読めたら toIncidents の並び、落ちた・形が違うなら null（その区画だけ「読めません」）。
//   401 でも入り直しへ送らない（ログインしていない人の画面・keepOn401）
import { useEffect, useRef, useState } from "react";
import { call } from "@/lib/api/call";
import { toIncidents } from "../service-status/to-incidents";
import { HelpView, type HelpStatus } from "./help-view";

export function HelpScreen({ opsEmail }: { opsEmail: string }) {
  const [status, setStatus] = useState<HelpStatus>("loading");
  // 口を呼ぶのは 1 回だけ。開発のサーバー（StrictMode）は効果を 2 回走らせるが、2 回目は同じ答えを待つ（verify-link.tsx と同じ形）
  const asked = useRef<Promise<HelpStatus> | null>(null);
  useEffect(() => {
    let alive = true;
    asked.current ??= call("getServiceStatus", { keepOn401: true, screenId: "help" })
      .then((r) => (r.ok ? toIncidents(r.data) : null))
      .catch(() => null);
    void asked.current.then((v) => {
      if (alive) setStatus(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return <HelpView status={status} opsEmail={opsEmail} />;
}
