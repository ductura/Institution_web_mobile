import { expect, test } from "@playwright/test";

test("student na 360 px otvara dnevnik sa stranice rada", async ({ page, request }) => {
  const demo = await request.post("http://127.0.0.1:4099/__rad/otvori");
  expect(demo.ok()).toBe(true);
  const { assignmentId, documentId } = await demo.json();
  let sesija = "demo-pristup";
  // WebKit does not send a Secure cookie to the HTTP test origin.
  await page.route("**/pristup/**", async (route) => {
    const headers = { ...route.request().headers(), cookie: `__Host-ductus_session=${sesija}` };
    await route.fulfill({ response: await route.fetch({ headers }) });
  });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/rad/${assignmentId}`);
  await page.getByRole("link", { name: "Tko je vidio moj rad" }).press("Enter");

  await expect(page).toHaveURL(`/pristup/${documentId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tko je vidio moj rad");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("20. studenoga 2026.");
  const zapis = page.getByRole("listitem");
  await expect(zapis).toContainText("Izmišljena Mentorica");
  await expect(zapis.getByText("Mentor", { exact: true })).toBeVisible();
  await expect(zapis.locator("time")).toHaveText("00:35");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  await page.getByRole("link", { name: "Prikaži starija otvaranja" }).press("Enter");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("19. studenoga 2026.");
  await expect(page.getByRole("listitem")).toContainText("Nastavnik kolegija");
  await page.getByRole("link", { name: "Prikaži najnovija otvaranja" }).press("Enter");
  await expect(page).toHaveURL(`/pristup/${documentId}`);

  const upozorenje = page.getByRole("main").getByRole("alert");
  await page.goto("/pristup/demo-nepoznat");
  await expect(upozorenje).toHaveText("Rad nije pronađen");
  sesija = "demo-zabranjeno";
  await page.goto(`/pristup/${documentId}`);
  await expect(upozorenje).toHaveText("Rad nije pronađen");

  await page.unroute("**/pristup/**");
  await page.reload();
  const prijava = page.getByRole("link", { name: "Prijava preko AAI@EduHr" });
  await expect(prijava).toHaveAttribute("href", `/api/v1/auth/login?returnTo=%2Fpristup%2F${documentId}`);
  await expect(page.getByRole("listitem")).toHaveCount(0);
});
