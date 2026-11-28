import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import type { RoleId } from "@/lib/nav";
import { ShellDemo } from "./demo";

// 新しい外枠の見本（K-25）。?role=R1〜R6 で役割を替える。?built=all で全部の画面を「作った」として見る
export default async function KShellPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const role = (["R1", "R2", "R3", "R4", "R6"].includes(q["role"] ?? "") ? q["role"] : "R1") as RoleId;
  return <ShellDemo theme={theme} role={role} allBuilt={q["built"] === "all"} panel={q["panel"] !== "none"} />;
}
