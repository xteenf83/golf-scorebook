// iOS 홈 화면 앱의 실행 이미지(apple-touch-startup-image) 만들기 — HTML이 뜨기 전 흰 화면 대신 시작 화면 사진이 보이게
//   node tools/startup-images.mjs   → images/startup/*.jpg 와 index.html에 넣을 <link> 줄을 출력
// 시작 화면(.splash)을 기기 크기·배율 그대로 찍는다. 상태 표시줄 칸(band)은 실제 앱처럼 #1F3A22로 칠하고 그 아래부터 시작 화면.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, routeAll, makeSeed, wait, ROOT } from "./harness.mjs";
// [CSS 폭, 높이, 배율, 상태 표시줄 높이]
const DEVICES = [[440,956,3,62],[430,932,3,59],[420,912,3,62],[402,874,3,62],[393,852,3,59],[428,926,3,47],[390,844,3,47],[414,896,3,44],[414,896,2,48],[375,812,3,50],[375,667,2,20]];
const OUT = path.join(ROOT, "images/startup"); mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const links = [];
for (const [w, h, r, band] of DEVICES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: r, locale: "ko-KR", serviceWorkers: "block" });
  await routeAll(ctx); const sd = makeSeed("full"); sd.signedIn = true;
  await ctx.addInitScript(s => { window.__SEED = s; window.__NO_SPLASH_END = true }, sd);
  const p = await ctx.newPage(); await p.goto("http://app.local/index.html");
  await p.evaluate(band => { document.documentElement.style.background = document.body.style.background = "#1F3A22";
    const s = document.getElementById("splash"); s.style.top = band + "px"; s.style.zIndex = 9999; s.querySelector(".sp-load").style.visibility = "hidden";
    for (const e of document.body.children) if (e !== s) e.style.visibility = "hidden"; }, band);
  await p.evaluate(() => document.fonts.ready); await p.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {})))); await wait(300);
  const f = `launch-${w * r}x${h * r}.jpg`;
  await p.screenshot({ path: path.join(OUT, f), type: "jpeg", quality: 82 });
  links.push(`<link rel="apple-touch-startup-image" href="images/startup/${f}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)">`);
  await ctx.close();
}
await b.close(); console.log(links.join("\n"));
