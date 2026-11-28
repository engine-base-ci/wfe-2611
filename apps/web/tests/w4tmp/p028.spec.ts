import { expect, test } from "@playwright/test";
import { TID, mockDetail, openDetail, panel } from "../k/detail-body-mock";
test("W4 p028", async ({ page }) => {
  await mockDetail(page);
  await openDetail(page);
  await panel(page).getByRole("button", { name: "パネルを閉じる" }).click();
  await expect(panel(page)).toBeHidden();
  await page.evaluate((i) => window.dispatchEvent(new CustomEvent("kaname:f4:open-spec-add", { detail: { ticketId: i } })), TID);
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => [...document.querySelectorAll("aside")].map((a) => `${a.getAttribute("aria-label")} hidden=${a.hidden} inert=${a.inert} ariaHidden=${a.closest("[aria-hidden]")?.getAttribute("aria-hidden")} disp=${getComputedStyle(a).display}`));
  console.log(JSON.stringify(info));
  console.log(await page.getByRole("dialog").count());
});
