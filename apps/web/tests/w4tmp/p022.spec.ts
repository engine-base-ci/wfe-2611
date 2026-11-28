import { test } from "@playwright/test";
import { RESULTS, mockDetail, openDetail } from "../k/detail-body-mock";
test("W4 p022", async ({ page }) => {
  await mockDetail(page, { results: RESULTS });
  await openDetail(page);
  await page.getByRole("heading", { level: 1 }).focus();
  const h = await page.evaluate(() => { const e = document.activeElement!; return `${e.tagName} ${e.outerHTML.slice(0,80)} parents=${[...(function*(x){while(x){yield x.tagName+'.'+x.className;x=x.parentElement}})(e)].slice(0,6).join('<')}`; });
  console.log("H1", h);
  await page.keyboard.press("Tab");
  const a = await page.evaluate(() => { const e = document.activeElement!; return `${e.tagName} ${e.outerHTML.slice(0,120)} parents=${[...(function*(x){while(x){yield x.tagName+'.'+String(x.className).slice(0,30);x=x.parentElement}})(e)].slice(0,8).join('<')}`; });
  console.log("TAB", a);
  for (let i=0;i<4;i++){ await page.keyboard.press("Tab"); console.log("T"+i, await page.evaluate(() => { const e = document.activeElement!; return `${e.tagName} ${e.textContent?.slice(0,20)} parents=${[...(function*(x){while(x){yield x.tagName+"."+String(x.className).slice(0,25);x=x.parentElement}})(e)].slice(0,7).join("<")}`; })); }
});
