import { expect, test } from "@playwright/test";
test("W4 probe", async ({ page }) => {
  await page.goto("/dev/k/showcase");
  const r = await page.evaluate(async () => {
    const out: Record<string, string> = {};
    for (const u of ["http://127.0.0.1:38617/ping", "http://127.0.0.1:3011/health", "http://127.0.0.1:3411/health"]) {
      try { const x = await fetch(u); out[u] = String(x.status); } catch (e) { out[u] = "ERR"; }
    }
    return out;
  });
  console.log(JSON.stringify(r));
  expect(r["http://127.0.0.1:38617/ping"]).toBe("ERR");
  expect(r["http://127.0.0.1:3011/health"]).toBe("ERR");
});
