import { cookies } from "next/headers";
import QRCode from "qrcode";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { MockView } from "../mocks";

// 段 2 のモックの 1 つの状態（/dev/mock/f1/<id>）。QR は見本の otpauth の URI から作る（本番は startTwoFactor の答え）
export default async function MockF1State({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const qrSvg = await QRCode.toString("otpauth://totp/Kaname:mock?secret=JBSWY3DPEHPK3PXP&issuer=Kaname", {
    type: "svg",
    margin: 0,
  });
  return (
    <div data-mock={id}>
      <MockView id={id} theme={theme} qrSvg={qrSvg} />
    </div>
  );
}
