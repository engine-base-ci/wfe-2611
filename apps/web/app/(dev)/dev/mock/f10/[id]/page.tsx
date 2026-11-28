import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { MockView } from "../render";

// 段 11 の下絵のモックの 1 つの状態（/dev/mock/f10/<id>）
export default async function MockF10State({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div data-mock={id}>
      <MockView id={id} theme={theme} />
    </div>
  );
}
