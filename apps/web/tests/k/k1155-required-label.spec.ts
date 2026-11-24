// K-1155「必須の欄の印（＊）を項目名の label の字から外す」の画面の試験（実 Chrome・実装より先に積む）。
//   見本の画面 /dev/k/design（K-218）に、実装の役が必須の欄を 5 つ足す（data-testid の箱）：
//     req-md（TextField「件名」required）・req-lg-hint（TextField「会社名」required size lg hint「あとで変えられる」）・
//     req-area（TextArea「理由」required）・req-pw（PasswordField「新しいパスワード」required size lg）・req-due（DueField・期限の欄）
//   ＊は項目名の要素（.k-label）の ::after（content: "*" / ""）で出し、label の字にも読み上げの名前にも入れない。見た目は 1px も変えない。
//   口は呼ばない。固定の待ちは使わない。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "../..");

const REQUIRED = [
  { id: "req-md", name: "件名", kind: "textbox" },
  { id: "req-lg-hint", name: "会社名", kind: "textbox" },
  { id: "req-area", name: "理由", kind: "textbox" },
  { id: "req-pw", name: "新しいパスワード", kind: "password" },
  { id: "req-due", name: "期限", kind: "button" },
] as const;

async function open(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1400 });
  const res = await page.goto("/dev/k/design");
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("req-due")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const labelOf = (page: Page, id: string): Locator => page.getByTestId(id).locator(".k-label").first();

/** 色・長さのトークンを、その場の見た目で計算した値にする（暗い見た目でも同じ読み方） */
async function resolved(page: Page, prop: "color" | "margin-left", value: string) {
  return page.evaluate(
    ([p, v]) => {
      const probe = document.createElement("span");
      probe.style.setProperty(p, v);
      document.querySelector(".k-root")!.appendChild(probe);
      const out = getComputedStyle(probe).getPropertyValue(p);
      probe.remove();
      return out;
    },
    [prop, value] as const,
  );
}

test("K1155-UI-001 必須の欄 5 つは getByLabel(名前, {exact:true}) で 1 件ずつ取れる", async ({ page }) => {
  await open(page);
  for (const f of REQUIRED) {
    const c = page.getByLabel(f.name, { exact: true });
    await expect(c, f.name).toHaveCount(1);
    await expect(c, f.name).toBeVisible();
    if (f.kind === "button") {
      expect(await c.evaluate((e) => e.tagName), f.name).toBe("BUTTON");
      await expect(c, f.name).toHaveAttribute("aria-haspopup", "dialog");
    } else {
      expect(["INPUT", "TEXTAREA"], f.name).toContain(await c.evaluate((e) => e.tagName));
      await expect(c, f.name).toHaveAttribute("aria-required", "true");
    }
  }
});

test("K1155-UI-002 読み上げの名前に ＊ が入らない（getByRole の name・exact）", async ({ page }) => {
  await open(page);
  for (const f of REQUIRED) {
    if (f.kind === "password") continue;
    const role = f.kind === "button" ? "button" : "textbox";
    await expect(page.getByRole(role, { name: f.name, exact: true }), f.name).toHaveCount(1);
    await expect(page.getByRole(role, { name: `${f.name}*`, exact: true }), `${f.name}*`).toHaveCount(0);
    await expect(page.getByRole(role, { name: `${f.name} *`, exact: true }), `${f.name} *`).toHaveCount(0);
  }
});

test("K1155-UI-003 項目名の字は名前だけ。＊は ::after（色 --k-error・左の間 --k-s-xs）。項目名の中に aria-hidden の子は無い", async ({
  page,
}) => {
  await open(page);
  const red = await resolved(page, "color", "var(--k-error)");
  const gap = await resolved(page, "margin-left", "var(--k-s-xs)");
  for (const f of REQUIRED) {
    const l = labelOf(page, f.id);
    expect((await l.textContent())?.trim(), f.name).toBe(f.name);
    const after = await l.evaluate((e) => {
      const s = getComputedStyle(e, "::after");
      return { content: s.content, color: s.color, ml: s.marginLeft };
    });
    expect(after.content, f.name).toContain("*");
    expect(after.color, f.name).toBe(red);
    expect(after.ml, f.name).toBe(gap);
    expect(await l.locator('[aria-hidden="true"]').count(), f.name).toBe(0);
  }
});

test("K1155-UI-004 任意の欄（題名・メール）は印が出ず、getByLabel(名前, {exact:true}) で 1 件ずつ", async ({ page }) => {
  await open(page);
  for (const [id, name] of [
    ["field-md", "題名"],
    ["field-lg", "メール"],
  ] as const) {
    const content = await labelOf(page, id).evaluate((e) => getComputedStyle(e, "::after").content);
    expect(content, name).toBe("none");
    await expect(page.getByLabel(name, { exact: true }), name).toHaveCount(1);
  }
});

/** 項目名を前の作り（label の中の aria-hidden の span の ＊）に戻す */
async function toOld(l: Locator) {
  await l.evaluate((e) => {
    e.removeAttribute("data-required");
    const s = document.createElement("span");
    s.setAttribute("aria-hidden", "true");
    s.style.setProperty("color", "var(--k-error)");
    s.style.setProperty("margin-left", "var(--k-s-xs)");
    s.textContent = "*";
    e.appendChild(s);
  });
}

for (const scheme of ["light", "dark"] as const) {
  for (const width of [1440, 375] as const) {
    test(`K1155-UI-005 1px も変えない（幅 ${width}・${scheme === "light" ? "明るい" : "暗い"}）：前の作りと写しが 1 バイトも違わない`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, width);
      for (const f of REQUIRED) {
        const boxEl = page.getByTestId(f.id);
        await boxEl.scrollIntoViewIfNeeded();
        const l = labelOf(page, f.id);
        const hint = boxEl.locator(".k-hint");
        const hasHint = (await hint.count()) > 0;
        const before = {
          shot: await boxEl.screenshot({ animations: "disabled", caret: "hide" }),
          label: await l.boundingBox(),
          hint: hasHint ? await hint.boundingBox() : null,
        };
        await toOld(l);
        const after = {
          shot: await boxEl.screenshot({ animations: "disabled", caret: "hide" }),
          label: await l.boundingBox(),
          hint: hasHint ? await hint.boundingBox() : null,
        };
        expect(after.label, `${f.name} の項目名の箱`).toEqual(before.label);
        expect(after.hint, `${f.name} の補足の箱`).toEqual(before.hint);
        expect(Buffer.compare(before.shot, after.shot), `${f.name} の写し`).toBe(0);
      }
      expect(await page.getByTestId("req-lg-hint").locator(".k-hint").count()).toBe(1);
    });
  }
}

function tsxUnder(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...tsxUnder(p));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

test("K1155-UI-006 ＊だけを中身に持つ aria-hidden の span が画面のコードに無い。k.css に .k-label[data-required]::after（content: \"*\" / \"\"）が在り .k-req が無い", () => {
  const files = ["components", "features", "app"].flatMap((d) => tsxUnder(join(WEB, d)));
  expect(files.length).toBeGreaterThan(50);
  const star = /<span\b[^>]*aria-hidden="true"[^>]*>\s*\*\s*<\/span>/;
  const hits = files.filter((p) => star.test(readFileSync(p, "utf8")));
  expect(hits).toEqual([]);
  const css = readFileSync(join(WEB, "components/k/k.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = /\.k-label\[data-required\]::after\s*\{([^}]*)\}/.exec(css);
  expect(rule, ".k-label[data-required]::after の規則が無い").not.toBeNull();
  expect(rule![1]).toMatch(/content:\s*"\*"\s*\/\s*""/);
  expect(css).not.toMatch(/\.k-req\b/);
});

test("K1155-UI-007 必須の欄の項目名を押すと、その欄に入力の印が移る", async ({ page }) => {
  await open(page);
  await labelOf(page, "req-md").click();
  await expect(page.getByLabel("件名", { exact: true })).toBeFocused();
});
