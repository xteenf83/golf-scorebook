// 스크린샷·흐름 테스트 공통: 브라우저 열기, 앱 파일·가짜 Firebase·바깥 글꼴 연결, 예시 데이터로 앱 열기
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { MOCK } from "./mock-firebase.mjs";
import { makeSeed, NOW } from "./seed.mjs";
export { makeSeed, NOW };
// playwright: 프로젝트에 없으면 전역 설치본을 쓴다
const req = createRequire(import.meta.url);
let pw; try { pw = req("playwright") } catch { pw = req(path.join(execFileSync("npm", ["root", "-g"]).toString().trim(), "playwright")) }
export const { chromium } = pw;
export const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const CACHE = process.env.SHOT_CACHE || "/tmp/claude-0/shot-cache";
mkdirSync(CACHE, { recursive: true });

const TYPES = { html: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css", png: "image/png", jpg: "image/jpeg", webmanifest: "application/manifest+json", json: "application/json", woff2: "font/woff2" };
// 바깥 파일(글꼴 등)은 curl로 한 번 받아 두고 재사용 (브라우저가 프록시를 못 쓰는 환경 대비)
function external(url) {
  const f = path.join(CACHE, createHash("md5").update(url).digest("hex"));
  if (!existsSync(f)) execFileSync("curl", ["-sSfL", "-o", f, url], { timeout: 30000 });
  const ext = (url.split("?")[0].match(/\.(\w+)$/) || [])[1];
  return { body: readFileSync(f), contentType: url.includes("fonts.googleapis.com/css") ? "text/css" : TYPES[ext] || "application/octet-stream" };
}
export async function routeAll(ctx) {
  await ctx.route("**/*", async route => {
    const u = new URL(route.request().url());
    try {
      if (u.hostname === "app.local") {
        const p = path.join(ROOT, decodeURIComponent(u.pathname));
        if (!existsSync(p)) return route.fulfill({ status: 404, body: "" });
        return route.fulfill({ body: readFileSync(p), contentType: TYPES[p.split(".").pop()] || "application/octet-stream" });
      }
      if (u.hostname === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/"))
        return route.fulfill({ body: MOCK[u.pathname.split("/").pop()], contentType: "text/javascript" });
      const r = external(u.href);
      return route.fulfill({ ...r, headers: { "access-control-allow-origin": "*" } });
    } catch (e) { return route.fulfill({ status: 404, body: "" }) }
  });
}

export const wait = ms => new Promise(r => setTimeout(r, ms));
// 예시 데이터로 앱을 열어 첫 화면이 뜰 때까지 기다린 page를 돌려준다
export async function openApp(browser, { scenario = "full", scheme = "light", width = 390, height = 844, seed, early = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: scheme, timezoneId: "Asia/Seoul", locale: "ko-KR", serviceWorkers: "block" });
  await routeAll(ctx);
  const sd = seed || makeSeed(scenario === "login" ? "empty" : scenario); sd.signedIn = scenario !== "login";
  await ctx.addInitScript(s => { window.__SEED = s }, sd);
  const p = await ctx.newPage();
  p.errs = []; p.on("pageerror", e => p.errs.push(e.message));
  await p.clock.setFixedTime(new Date(NOW));
  await p.goto("http://app.local/index.html");
  if (early) { await p.evaluate(() => document.fonts.ready); await wait(250); return p }   // 시작 화면을 찍을 때
  await p.waitForFunction(() => [...document.querySelectorAll("section.screen")].some(s => !s.hidden && s.id !== "scrSplash"), null, { timeout: 8000 }).catch(() => {});
  await wait(1200);
  return p;
}
