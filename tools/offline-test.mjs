// 비행기 모드 점검: 실제 서비스워커로 한 번 연 뒤 오프라인으로 다시 열어 앱·사진·글꼴이 보이는지
//   node tools/offline-test.mjs   (로컬 웹서버 http://localhost:8765 를 직접 띄움)
import { chromium, ROOT, wait } from "./harness.mjs";
import { spawn } from "node:child_process";
const srv = spawn("python3", ["-m", "http.server", "8765", "--bind", "127.0.0.1"], { cwd: ROOT, stdio: "ignore" });
await wait(800);
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
// Playwright의 proxy 옵션은 localhost도 프록시로 보내므로 Chromium 인자로 직접 (localhost는 기본으로 프록시 제외)
const b = await chromium.launch(proxy ? { args: [`--proxy-server=${proxy}`] } : {});
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
const p = await ctx.newPage();
let fail = 0; const ok = (c, m) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) fail++ };
try {
  await p.goto("http://localhost:8765/index.html");
  await p.evaluate(() => navigator.serviceWorker.ready); await wait(3000);
  await p.reload(); await wait(3000);   // 서비스워커가 페이지를 맡은 뒤 글꼴 조각까지 저장되게 한 번 더
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), "서비스워커 작동");
  const keys = await p.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return (await c.keys()).map(r => r.url) });
  ok(keys.some(u => u.includes("images/splash")) && keys.some(u => u.includes("pretendard")), `캐시에 사진·글꼴 (${keys.length}개 파일)`);
  await ctx.setOffline(true);
  await p.reload(); await wait(2500);
  ok(!(await p.isHidden("#scrLogin")) || !(await p.isHidden("#scrHome")), "오프라인으로 다시 열어도 앱 화면이 뜸");
  const imgs = await p.evaluate(async () => { const r = {}; for (const f of ["splash-aerial-bunkers", "home-live-aerial", "insights-header-bunker", "share-card-lush"]) { const i = new Image(); i.src = `images/${f}.jpg`; try { await i.decode(); r[f] = i.naturalWidth } catch (e) { r[f] = 0 } } return r });
  ok(Object.values(imgs).every(w => w > 0), "오프라인 사진 4장: " + JSON.stringify(imgs));
  const font = await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 16px "Pretendard Variable"', "가나다") && [...document.fonts].some(f => /Pretendard/.test(f.family) && f.status === "loaded") });
  ok(font, "오프라인 Pretendard 글꼴");
  await p.screenshot({ path: "/tmp/claude-0/offline.png" });
} finally { await b.close(); srv.kill() }
console.log(fail ? `실패 ${fail}개` : "모두 통과"); process.exit(fail ? 1 : 0);
