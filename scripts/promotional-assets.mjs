import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import "../src/settings.js";
const browser = await chromium.launch({
  ...(process.env.CI
    ? {}
    : {
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      }),
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const cards = Object.entries(YTM.presets)
    .filter(([key]) => !["YoutubeMusicDefault", "UserDefined"].includes(key))
    .map(
      ([, p]) =>
        `<article style="--canvas:${p.background};--player:${p.player};--accent:${p.accent}"><div class="canvas"><span class="kicker">YOUR LISTENING SPACE</span><div class="track"><div class="art">♫</div><div><b>Make room for the music</b><small>Your playlist · Your palette</small></div></div><div class="queue"><span>01 &nbsp; A little more focus</span><span>02 &nbsp; A little more you</span></div><div class="player"><span>↺ &nbsp; ◀</span><i>▶</i><span>▶ &nbsp; ↻</span><div class="progress"></div></div></div><footer>${p.name}<span style="color:${p.accent}">●</span></footer></article>`,
    )
    .join("");
  await page.setContent(
    `<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;padding:48px 64px;font-family:system-ui,sans-serif;background:#111016;color:#f3efff}header{display:flex;align-items:end;justify-content:space-between;margin-bottom:34px}h1{font-size:38px;letter-spacing:-1.4px;margin:8px 0}.eyebrow{color:#baa4f2;font-size:11px;letter-spacing:2px}header p{margin:0;color:#aaa0b6;font-size:13px}.credit{font-size:11px;color:#827a90}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}article{border:1px solid #ffffff15;border-radius:16px;overflow:hidden;background:#19161f}.canvas{background:var(--canvas);padding-top:20px}.kicker{padding:0 20px;color:#aaa;font-size:9px;letter-spacing:1.4px}.track{display:flex;align-items:center;gap:13px;margin:18px 20px}.art{width:48px;height:48px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),#454054);color:#16111d;border-radius:10px;font-size:26px}b{font-size:11px}small{display:block;color:#aaa;margin-top:5px;font-size:9px}.queue{display:grid;gap:12px;padding:2px 20px 20px;font-size:10px;color:#aaa}.player{background:var(--player);display:flex;gap:22px;justify-content:center;align-items:center;padding:14px;position:relative;color:#ccc;font-size:11px}i{font-style:normal;background:var(--accent);width:25px;height:25px;border-radius:50%;display:grid;place-items:center;color:#16111d}.progress{position:absolute;bottom:0;left:0;width:60%;height:2px;background:var(--accent)}footer{display:flex;justify-content:space-between;padding:13px 20px;font-size:11px}.note{margin-top:25px;font-size:10px;color:#898094;display:flex;justify-content:space-between}</style></head><body><header><div><div class="eyebrow">YOUTUBE MUSIC CUSTOM THEMES</div><h1>Find your after-hours palette.</h1><p>Six dark presets. One uninterrupted canvas. Make it yours.</p></div><span class="credit">by Ameer Jamal</span></header><div class="grid">${cards}</div><div class="note"><span>Palette previews · Illustrative sample tracks</span><span>Live themes · Custom colors · Focused listening</span></div></body></html>`,
  );
  mkdirSync("docs/promotional", { recursive: true });
  await page.screenshot({ path: "docs/promotional/palettes.png" });
  console.log("Saved docs/promotional/palettes.png");
} finally {
  await browser.close();
}
