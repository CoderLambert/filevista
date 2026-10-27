import { expect, test, type Page } from "@playwright/test";

// Keep network-failure tests deterministic even without a local Git LFS checkout.
// The real demo loader still fetches the generated URLs and constructs FileInfo.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII=",
  "base64",
);
const imageName = "39471142-2dae-4c27-9fb0-4b943d5a6b09.png";

async function loadDemo(page: Page) {
  await page.route("**/demo/**", async (route) => {
    if (route.request().url().endsWith(`/${imageName}`)) {
      await route.fulfill({ body: png, contentType: "image/png" });
    } else {
      await route.fulfill({ status: 404 });
    }
  });
  await page.getByRole("button", { name: "Load Demo Files", exact: true }).click();
}

async function expectImage(page: Page) {
  const image = page.locator(".fv-image__img");
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  await expect(page.getByRole("heading", { name: "预览加载失败" })).toHaveCount(0);
}

test("Demo Files previews an image under the GitHub Pages base path", async ({ page }) => {
  await page.goto("./");
  await loadDemo(page);
  await expectImage(page);
});

test("Retry recovers a failed preview chunk without reloading or losing files", async ({ page }) => {
  await page.goto("./");
  // All initial scripts have loaded. Block only the subsequently imported plugin.
  await page.route("**/_next/static/chunks/**/*.js", (route) => route.abort("failed"));
  await loadDemo(page);
  await expect(page.getByRole("heading", { name: "预览加载失败" })).toBeVisible();
  await page.unroute("**/_next/static/chunks/**/*.js");

  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") requests.push(request.url());
  });
  let navigations = 0;
  page.on("framenavigated", () => navigations++);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expectImage(page);
  expect(requests.length).toBeGreaterThan(0);
  expect(navigations).toBe(0);
  await expect(page.getByText("1 file loaded", { exact: true })).toBeVisible();
});
