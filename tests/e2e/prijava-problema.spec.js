import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { canonicalJson, validateInput } from "@ductura/contracts";
import { expect, test } from "@playwright/test";

const HOST = "127.0.0.1";
const SESIJA = "__Host-ductus_session=demo-prijava-problema";
const REFERENCA = "PR-0A1B2C3D4E";
const OPIS = "Na pokusnom zaslonu gumb ne radi.";
const PUTANJA = "/prijavi-problem";
const LOGIN = "/api/v1/auth/login";
test.use({ viewport: { width: 360, height: 780 } });

test("samo tipkovnicom otvara obrazac, vraća se s prijave i šalje zapis na 360 px", async ({ page }) => {
  test.setTimeout(60_000);
  const zapisi = [];
  const lazni = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/v1/documents") return res.end("[]");
    if (req.url !== "/api/v1/support/problem-report" || req.method !== "POST") {
      res.writeHead(404).end("{}");
      return;
    }
    if (req.headers.cookie !== SESIJA) {
      res.writeHead(401).end("{}");
      return;
    }
    const dijelovi = [];
    for await (const dio of req) dijelovi.push(dio);
    const json = Buffer.concat(dijelovi).toString("utf8");
    const tijelo = JSON.parse(json);
    if (!validateInput("support.problem-report.post", "body", tijelo) || json !== canonicalJson(tijelo)) {
      res.writeHead(422).end("{}");
      return;
    }
    zapisi.push(tijelo);
    res.writeHead(201).end(JSON.stringify({ reference: REFERENCA }));
  });
  lazni.listen(0, HOST);
  await once(lazni, "listening");
  const adresa = lazni.address();
  if (typeof adresa !== "object" || !adresa) throw new Error("Nema adrese lažnog poslužitelja");

  // Use the production build from the Playwright webServer, with a dedicated
  // upstream so this test can verify the actual server-to-server request.
  const next = fileURLToPath(import.meta.resolve("next/dist/bin/next"));
  const app = spawn(process.execPath, [next, "start", "-H", HOST, "-p", "0"], {
    env: { ...process.env, INSTITUTION_SERVER_URL: `http://${HOST}:${adresa.port}` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const izlaz = once(app, "exit");
  try {
    let log = "";
    app.stdout.on("data", (dio) => { log += dio; });
    app.stderr.on("data", (dio) => { log += dio; });
    await expect.poll(() => log, { timeout: 15_000 }).toMatch(/Local:\s+http:\/\/127\.0\.0\.1:\d+/);
    const origin = log.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)[1];
    await expect.poll(async () => (await fetch(origin)).status, { timeout: 10_000 }).toBe(200);

    await page.route(`**${LOGIN}?*`, async (route) => {
      const povratak = new URL(route.request().url()).searchParams.get("returnTo");
      expect(povratak).toBe(PUTANJA);
      await route.fulfill({
        status: 302,
        headers: { location: povratak, "set-cookie": `${SESIJA}; Path=/; HttpOnly; Secure; SameSite=Lax` },
      });
    });

    await page.goto(origin);
    const poveznica = page.getByRole("contentinfo").getByRole("link", { name: "Prijavi problem" });
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      if (await poveznica.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(poveznica).toBeFocused();
    await page.keyboard.press("Enter");
    const opis = page.getByRole("textbox", { name: "Opis problema" });
    const gumb = page.getByRole("button", { name: "Pošalji prijavu" });
    await expect(opis).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

    const tabDoOpisa = async () => {
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        if (await opis.evaluate((el) => el === document.activeElement)) break;
      }
      await expect(opis).toBeFocused();
    };
    const posalji = async () => {
      await page.keyboard.press("Tab");
      await expect(gumb).toBeFocused();
      await page.keyboard.press("Enter");
    };

    await tabDoOpisa();
    await page.keyboard.type(OPIS);
    const prijava = page.waitForRequest(`**${LOGIN}?*`);
    await posalji();
    await prijava;
    await expect(page).toHaveURL(`${origin}${PUTANJA}`);
    await expect(opis).toHaveValue(OPIS);
    expect(zapisi).toHaveLength(0);

    await tabDoOpisa();
    await posalji();
    await expect(page.getByRole("status")).toContainText(`Prijava je zaprimljena. Oznaka prijave je ${REFERENCA}.`);
    expect(zapisi).toEqual([expect.objectContaining({ category: "technical", description: OPIS })]);
  } finally {
    app.kill();
    lazni.closeAllConnections();
    await Promise.allSettled([izlaz, new Promise((resolve) => lazni.close(resolve))]);
  }
});
