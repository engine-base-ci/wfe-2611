import { redirect } from "next/navigation";

// 配るもの（K-991）。いまはプランへ送る（仮・操作とひな形の頁は K-994）。入れ物（layout・運営の外枠）は K-946
export default function OpsSkillsPage() {
  redirect("/ops/skills/plans");
}
