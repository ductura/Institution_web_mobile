import { expect, test } from "@playwright/test";

const fake = "http://127.0.0.1:4099";
const title = "Seminarski rad o gradskim vrtovima";
const text = "Izmišljeni opis gradskih vrtova.";

test.beforeEach(async ({ request, page }) => {
  expect((await request.post(`${fake}/__rad/ponisti`)).ok()).toBe(true);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await page.getByRole("link", { name: title }).tap();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("student na 360 px otvara, piše, sinkronizira i predaje istu reviziju", async ({ page }) => {
  const editor = page.getByRole("textbox", { name: "Sadržaj rada" });
  await editor.tap();
  await page.keyboard.insertText(text);
  await expect(page.getByRole("status")).toHaveText("Spremljeno na poslužitelju");
  await page.reload();
  await expect(editor).toHaveText(text);

  await editor.tap();
  await page.setViewportSize({ width: 360, height: 400 });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await expect(page.getByRole("button", { name: "Predaj rad" })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  // Confirm while the newest edit is still in the editor's debounce window.
  const latest = " Druga rečenica.";
  await editor.press("End");
  await page.keyboard.insertText(latest);
  await page.getByRole("button", { name: "Predaj rad" }).tap();
  const dialog = page.getByRole("dialog", { name: "Predati rad?" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  const submission = page.waitForRequest((req) => req.url().endsWith("/api/v1/submission"));
  await dialog.getByRole("button", { name: "Potvrdi predaju" }).tap();
  expect((await submission).postDataJSON()).toEqual({ documentId: "demo-studentski-rad", revision: 2 });
  await expect(page.getByRole("status")).toContainText("Rad je predan.");
  await expect(page.getByText("Otisak predanog rada")).toBeVisible();
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(editor).toHaveText(text + latest);
  await page.reload();
  await expect(editor).toHaveText(text + latest);
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(page.getByRole("status")).toContainText("Rad je predan.");
});

test("nevaljana potvrda spremanja ne dopušta predaju i ponavlja istu transakciju", async ({ page }) => {
  const commits = [];
  const submissions = [];
  let corrupt = true;
  await page.route("**/api/v1/evidence/commit", async (route) => {
    commits.push(route.request().postDataJSON());
    const response = await route.fetch();
    const body = await response.json();
    if (corrupt) body.receipt.signedReceipt.payloadDigestSha256 = "0".repeat(64);
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/v1/submission", async (route) => {
    submissions.push(route.request().postDataJSON());
    await route.continue();
  });

  const editor = page.getByRole("textbox", { name: "Sadržaj rada" });
  await editor.tap();
  await page.keyboard.insertText(text);
  await expect(page.getByRole("status")).toHaveText("Greška");
  await page.getByRole("button", { name: "Predaj rad" }).tap();
  const dialog = page.getByRole("dialog", { name: "Predati rad?" });
  await dialog.getByRole("button", { name: "Potvrdi predaju" }).tap();
  await expect(dialog.getByRole("alert")).toContainText("Spremanje nije potvrđeno");
  expect(submissions).toHaveLength(0);
  expect(commits).toHaveLength(2);
  expect(commits[1]).toEqual(commits[0]);

  corrupt = false;
  await dialog.getByRole("button", { name: "Potvrdi predaju" }).tap();
  await expect(page.getByRole("status")).toContainText("Rad je predan.");
  expect(commits[2]).toEqual(commits[0]);
  expect(submissions).toEqual([{ documentId: "demo-studentski-rad", revision: 1 }]);
});
