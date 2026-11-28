"use client";
import { useParams } from "next/navigation";
import { NoticeScreen } from "@/features/F12/ops2/notice-screen";

// 運営のお知らせの 1 件（K-980）。入れ物（layout・運営の外枠）は K-946
export default function OpsNoticePage() {
  const { id } = useParams<{ id: string }>();
  return <NoticeScreen key={id} id={id} />;
}
