// キャンバスとの見た目の突き合わせで、画面をその組の状態に整える道具（K-216）。
//   鍵は 04_design/fidelity.json の組の state。値は (page, path) => Promise<void>：path（組の app）を開き、組の状態（人・データ・開いた小窓）にする。
//   最初は空（入れた組が 0）。組を入れる（enrolled: true）画面のチケットが、ここに鍵を足す。
//   enrolled の組の鍵がここに無いと scripts/ci/fidelity_config.py が赤にする（"<鍵>": の字で探す）。
//   キャンバスの書体の差し替え（routeCanvasFonts）は K-238 が足す。
import type { Page } from "@playwright/test";

export const FIDELITY_STATES: Record<string, (page: Page, path: string) => Promise<void>> = {};
