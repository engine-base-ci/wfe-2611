"use client";
// 困ったとき（/help・K-315）の動き。開いたら誰でも読める稼働状況の口（getServiceStatus）を 1 回読み、部品（HelpView）に渡す。
//   答えまでは "loading"（区画の中だけ・3 秒の決まり）、読めたら toIncidents の並び、落ちた・形が違うなら null（その区画だけ「読めません」）。
//   401 でも入り直しへ送らない（ログインしていない人の画面・keepOn401）
import { useEffect, useState } from "react";
import { call } from "@/lib/api/call";
import { toIncidents } from "../service-status/to-incidents";
import { HelpView, type HelpStatus } from "./help-view";

export function HelpScreen({ opsEmail }: { opsEmail: string }) {
  const [status, setStatus] = useState<HelpStatus>("loading");
  useEffect(() => {
    let alive = true;
    void call("getServiceStatus", { keepOn401: true, screenId: "help" })
      .then((r) => (r.ok ? toIncidents(r.data) : null))
      .catch(() => null)
      .then((v) => {
        if (alive) setStatus(v);
      });
    return () => {
      alive = false;
    };
  }, []);
  return <HelpView status={status} opsEmail={opsEmail} />;
}
