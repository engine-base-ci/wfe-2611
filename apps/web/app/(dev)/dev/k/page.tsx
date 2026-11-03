import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { Parts } from "./parts";

// 新しい部品の見本（KN-104）。部品の操作の試験（tests/components.spec.ts）の的。外枠・4 つの状態と並べる見本は KN-108
export default async function KPartsPage() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return <Parts theme={theme} />;
}
