// Funkcionalna provjera: korisnik može uređivati dokument i spremiti izmjenu
// dok je zaslonska tipkovnica otvorena.
import { test, expect } from '@playwright/test';

test('uređivanje i spremanje uz otvorenu tipkovnicu', async ({ page }) => {
  await page.goto('/#/doc/demo-1');
  const editor = page.getByLabel('Sadržaj');
  await editor.tap();

  // Tipkovnica zauzima oko pola zaslona: vidljivi dio se smanjuje.
  const size = page.viewportSize();
  await page.setViewportSize({ width: size.width, height: Math.round(size.height * 0.5) });
  await expect(page.locator('body')).toHaveClass(/keyboard-open/);

  const text = `Mobilna izmjena ${Date.now()}`;
  await editor.fill(text);
  await expect(editor).toBeFocused();

  const save = page.getByRole('button', { name: 'Spremi' });
  await expect(save).toBeInViewport();
  await save.tap();
  await expect(page.getByRole('status')).toHaveText('Spremljeno');

  await page.setViewportSize(size);
  await page.reload();
  await expect(page.getByLabel('Sadržaj')).toHaveValue(text);
});
