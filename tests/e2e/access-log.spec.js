import { expect, test } from "@playwright/test";

test("student na 360 px otvara dnevnik sa stranice rada", async ({ page, context, request, baseURL }) => {
  const demo = await request.post("http://127.0.0.1:4099/__rad/otvori");
  expect(demo.ok()).toBe(true);
  const { title, documentId } = await demo.json();
  const cookie = { name: "__Host-ductus_session", domain: new URL(baseURL).hostname, path: "/", secure: true };
  await context.addCookies([{ ...cookie, value: "demo-pristup" }]);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await page.getByRole("link", { name: title, exact: true }).tap();
  await page.getByRole("link", { name: "Tko je vidio moj rad" }).tap();

  await expect(page).toHaveURL(`/pristup/${documentId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tko je vidio moj rad");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("20. studenoga 2026.");
  const zapis = page.getByRole("listitem");
  await expect(zapis).toContainText("Izmišljena Mentorica");
  await expect(zapis.getByText("Mentor", { exact: true })).toBeVisible();
  await expect(zapis.locator("time")).toHaveText("00:35");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  await page.getByRole("link", { name: "Prikaži starija otvaranja" }).tap();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("19. studenoga 2026.");
  await expect(page.getByRole("listitem")).toContainText("Nastavnik kolegija");
  await page.getByRole("link", { name: "Prikaži najnovija otvaranja" }).tap();
  await expect(page).toHaveURL(`/pristup/${documentId}`);

  await page.goto("/pristup/demo-nepoznat");
  await expect(page.getByRole("alert")).toHaveText("Rad nije pronađen");
  await context.addCookies([{ ...cookie, value: "demo-zabranjeno" }]);
  await page.goto(`/pristup/${documentId}`);
  await expect(page.getByRole("alert")).toHaveText("Rad nije pronađen");

  await context.clearCookies();
  await page.reload();
  const prijava = page.getByRole("link", { name: "Prijava preko AAI@EduHr" });
  await expect(prijava).toHaveAttribute("href", `/api/v1/auth/login?returnTo=%2Fpristup%2F${documentId}`);
  await expect(page.getByRole("listitem")).toHaveCount(0);
});
