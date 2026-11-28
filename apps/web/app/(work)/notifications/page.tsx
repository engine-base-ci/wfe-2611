// 自分の設定 › 知らせ（K-843・画面 account・行為 A74）。PC をつないでいなくても開く・どの役でも開ける。
//   中身は apps/web/features/F10/account/（外枠 MeShell・本文 NotifyBody）
import { NotifyScreen } from "@/features/F10/account/notify-screen";

export default function Notifications() {
  return <NotifyScreen />;
}
