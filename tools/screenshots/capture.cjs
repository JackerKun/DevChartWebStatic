const { createServer } = require('node:http');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const { resolve, join, extname, sep } = require('node:path');
const { createRequire } = require('node:module');
const root = process.env.DEVCHART_SCREENSHOT_ROOT || resolve(__dirname, '../..');
const out = resolve(process.env.DEVCHART_SCREENSHOT_DIR || join(root, 'docs/screenshots'));
const { chromium, expect } = require(process.env.DEVCHART_PLAYWRIGHT || '@playwright/test');
async function main() {
  await mkdir(out, { recursive: true });
  const errors = [],
    shots = [];
  const server = createServer(async (req, res) => {
    try {
      const u = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const f = resolve(root, '.' + (u === '/' ? '/index.html' : u));
      if (!f.startsWith(root + sep) || u.split('/').some((x) => x.startsWith('.'))) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader(
        'Content-Type',
        {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'text/javascript',
          '.json': 'application/json',
          '.svg': 'image/svg+xml',
          '.webmanifest': 'application/manifest+json',
        }[extname(f)] || 'application/octet-stream',
      );
      res.end(await readFile(f));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    const url = 'http://127.0.0.1:' + server.address().port;
    await page.goto(url);
    await expect(page.locator('#table-shell')).toBeVisible();
    const route = async (name, p = page) => {
      await p.locator(`button[data-route="${name}"]:visible`).first().click();
    };
    async function shot(name, p = page) {
      await expect(p.locator('#toast')).toBeHidden();
      await p.mouse.move(1, 1);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(250);
      const png = await p.screenshot();
      const webp = await p.evaluate(async (base64) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + base64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/webp', 0.9).split(',')[1];
      }, png.toString('base64'));
      const bytes = Buffer.from(webp, 'base64');
      await writeFile(join(out, name + '.webp'), bytes);
      shots.push({ name, ...p.viewportSize(), bytes: bytes.length });
      console.log('Captured', name);
    }
    await page.locator('#keyword').fill('HP5');
    await expect(page.locator('#result-body')).toContainText('HP5');
    await shot('recipes');
    await page.locator('.time-button').first().click();
    await expect(page.locator('[data-view="timer"]')).toBeVisible();
    await expect(page.locator('#timer-recipe')).toBeVisible();
    await shot('timer');
    await route('chemistry');
    await page.locator('#mix-volume').fill('500');
    await page.locator('#mix-ratio').fill('1+1+100');
    await shot('chemistry');
    await route('tools');
    await shot('tools');
    await page.locator('#wash-start').click();
    await expect(page.locator('#wash-alert')).toBeVisible();
    await shot('wash-guide');
    await page.locator('#wash-cancel').click();
    await page.locator('#log-film').fill('HP5 Plus · 演示记录');
    await page.locator('#log-developer').fill('示例工作液 / 不代表推荐配方');
    await page.locator('#log-time').fill('示例');
    await page.locator('#log-notes').fill('仅供界面展示，不是真实冲洗结果');
    await page.locator('#log-form button[type=submit]').click();
    await page.locator('#log-list').scrollIntoViewIfNeeded();
    await shot('logbook');
    const exported = page.waitForEvent('download');
    await page.locator('#log-export-json').click();
    const download = await exported;
    const json = JSON.parse(await readFile(await download.path(), 'utf8'));
    if (!JSON.stringify(json).includes('演示记录')) throw Error('Log export missing fixture');
    const mobile = await context
      .browser()
      .newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      });
    const m = await mobile.newPage();
    m.on('pageerror', (e) => errors.push(e.message));
    await m.goto(url);
    await expect(m.locator('#table-shell')).toBeVisible();
    await m.locator('#keyword').fill('HP5');
    await m.locator('#results').scrollIntoViewIfNeeded();
    await shot('mobile-recipes', m);
    await m.locator('.time-button').first().tap();
    await expect(m.locator('#timer-recipe')).toBeVisible();
    await shot('mobile-timer', m);
    if (errors.length) throw Error(errors.join('\n'));
    await writeFile(
      join(out, 'capture-report.json'),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          source: 'bundled data/charts.json; isolated demo log',
          logExportVerified: true,
          shots,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
