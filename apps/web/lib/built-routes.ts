// もうある画面の route（機械生成：scripts/ci/gen_built_routes.py）。手で直さない。
// ナビはまだ作っていない画面も指す（設計にはある）。押すと 404 の行き止まりになるので、
// 画面側はこの一覧で「準備中」を出し、押させない。画面が増えれば自動で消える印。
export const BUILT_ROUTES: readonly string[] = [
  "/",
  "/ai/chat",
  "/dev/fake-login",
  "/dev/k",
  "/dev/k/shell",
  "/dev/k/showcase",
  "/dev/k/states",
  "/dev/mail",
  "/dev/memory",
  "/dev/shell",
  "/dev/ui",
  "/dev/views",
  "/invite/:token",
  "/legal/:kind",
  "/login",
  "/mfa-setup",
  "/onboard/draft",
  "/onboard/golive",
  "/onboard/interview",
  "/onboard/testrun",
  "/password-reset",
  "/settings/credentials",
  "/setup/bridge",
  "/signup",
  "/verify-email",
] as const;

/** その route の画面がもうあるか（:id は実際の値でも合う） */
export function isBuilt(route: string): boolean {
  const p = route.split("?")[0]!.replace(/\/+$/, "") || "/";
  return BUILT_ROUTES.some((b) => {
    if (b === p) return true;
    const bs = b.split("/");
    const ps = p.split("/");
    return bs.length === ps.length && bs.every((s, i) => s.startsWith(":") || s === ps[i]);
  });
}
