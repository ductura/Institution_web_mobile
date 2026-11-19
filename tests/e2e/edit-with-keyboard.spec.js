// Funkcionalna provjera: korisnik može uređivati dokument i spremiti izmjenu
// dok je zaslonska tipkovnica otvorena.
import { test, expect } from '@playwright/test';

test('uređivanje i spremanje uz otvorenu tipkovnicu', async ({ page }) => {
  await page.goto('/doc/demo-1');
  const editor = page.getByLabel('Sadržaj');
  await editor.tap();

  // Tipkovnica zauzima oko pola zaslona: vidljivi dio se smanjuje.
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.width, height: Math.round(size.height * 0.5) });
  // Pravi uređaj pri otvaranju tipkovnice šalje događaj 'resize'; emulirani WebKit ga ne šalje sam.
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await expect(page.locator('body')).toHaveClass(/keyboard-open/);

  const text = `Mobilna izmjena ${Date.now()}`;
  await editor.fill(text);
  await expect(editor).toBeFocused();

  const save = page.getByRole('button', { name: 'Spremi' });
  await expect(save).toBeInViewport();
  await save.tap();
  await expect(page.getByRole('status')).toHaveText('Spremljeno na poslužitelju');

  await page.setViewportSize(size);
  await page.reload();
  await expect(page.getByLabel('Sadržaj')).toHaveValue(text);
});

test('stara poveznica /#/doc/… otvara stranicu dokumenta', async ({ page }) => {
  await page.goto('/#/doc/demo-2');
  await expect(page).toHaveURL(/\/doc\/demo-2$/);
  await expect(page.getByLabel('Naslov')).toHaveValue('Bilješke s predavanja');
});

test('popis dokumenata vodi na dokument', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Moji dokumenti' })).toBeVisible();
  await page.getByRole('link', { name: 'Seminarski rad' }).tap();
  await expect(page).toHaveURL(/\/doc\/demo-1$/);
});

test('nepostojeći dokument', async ({ page }) => {
  await page.goto('/doc/nema-ga');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Dokument nije dostupan.');
});

test('istekla sesija nudi prijavu preko AAI@EduHr', async ({ page }) => {
  await page.goto('/doc/istekla-sesija');
  const prijava = page.getByRole('link', { name: 'Prijava preko AAI@EduHr' });
  await expect(prijava).toHaveAttribute('href', '/api/v1/auth/login?returnTo=%2Fdoc%2Fistekla-sesija');
});
