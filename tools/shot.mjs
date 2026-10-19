// 화면 확인용 스크린샷 도구 (배포에는 포함되지 않음)
//   node tools/shot.mjs [출력폴더=shots] [--only=home,play] [--width=390] [--design]
// - 앱: 가짜 로그인·예시 데이터(tools/seed.mjs)로 index.html을 열어 라이트/다크로 찍는다.
// - --design: design/v3/screens/*.dc.html 시안을 그대로 그려서 같이 찍는다 (비교용).
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { MOCK } from "./mock-firebase.mjs";
import { makeSeed, NOW } from "./seed.mjs";

// playwright: 프로젝트에 없으면 전역 설치본을 쓴다
const req = createRequire(import.meta.url);
let pw; try { pw = req("playwright") } catch { pw = req(path.join(execFileSync("npm", ["root", "-g"]).toString().trim(), "playwright")) }
const { chromium } = pw;
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const args = process.argv.slice(2);
const opt = k => (args.find(a => a.startsWith(`--${k}=`)) || "").split("=")[1];
const OUT = path.resolve(args.find(a => !a.startsWith("--")) || "shots");
const ONLY = opt("only") ? opt("only").split(",") : null;
const WIDTH = +(opt("width") || 390), HEIGHT = 844;
const CACHE = process.env.SHOT_CACHE || "/tmp/claude-0/shot-cache";
mkdirSync(OUT, { recursive: true }); mkdirSync(CACHE, { recursive: true });

const TYPES = { html: "text/html", js: "text/javascript", mjs: "text/javascript", css: "text/css", png: "image/png", jpg: "image/jpeg", webmanifest: "application/manifest+json", json: "application/json", woff2: "font/woff2" };
// 바깥 파일(글꼴 등)은 curl로 한 번 받아 두고 재사용 (브라우저가 프록시를 못 쓰는 환경 대비)
function external(url) {
  const f = path.join(CACHE, createHash("md5").update(url).digest("hex"));
  if (!existsSync(f)) execFileSync("curl", ["-sSfL", "-o", f, url], { timeout: 30000 });
  const ext = (url.split("?")[0].match(/\.(\w+)$/) || [])[1];
  return { body: readFileSync(f), contentType: url.includes("fonts.googleapis.com/css") ? "text/css" : TYPES[ext] || "application/octet-stream" };
}
async function routeAll(ctx) {
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

// ---------- 찍을 화면들: [이름, 시나리오, 동작] ----------
const wait = ms => new Promise(r => setTimeout(r, ms));
const click = async (p, sel) => { await p.locator(sel).first().click(); await wait(350) };
const SHOTS = [
  ["login", "login", async p => {}],
  ["home", "full", async p => {}],
  ["home-done", "done", async p => {}],
  ["home-empty", "empty", async p => {}],
  ["play", "full", async p => { await p.evaluate(() => document.querySelector("[data-tab=new],#fabTab,.fabbtn").click()); await wait(500) }],
  ["setup", "done", async p => { await p.evaluate(() => document.querySelector("[data-tab=new],#fabTab,.fabbtn").click()); await wait(400) }],
  ["round", "done", async p => { await click(p, "#roundList [data-id]") }],
  ["round-score", "done", async p => { await click(p, "#roundList [data-id]"); await clickTab(p, "스코어") }],
  ["round-shot", "done", async p => { await click(p, "#roundList [data-id]"); await clickTab(p, "샷") }],
  ["round-diary", "done", async p => { await click(p, "#roundList [data-id]"); await clickTab(p, "일기") }],
  ["round-total", "done", async p => { await p.evaluate(() => window.__open && window.__open("r0")); await wait(400) }],
  ["stats", "done", async p => { await click(p, "[data-tab=Stats]") }],
  ["courses", "done", async p => { await click(p, "[data-tab=Courses]") }],
  ["badges", "done", async p => { await p.evaluate(() => document.querySelector("[data-tab=Badges],#badgeBtn").click()); await wait(400) }],
  ["more", "done", async p => { await p.evaluate(() => document.querySelector("#avatar,#menuBtn").click()); await wait(400) }],
  ["share", "done", async p => { await click(p, "#roundList [data-id]"); await p.evaluate(() => document.querySelector("#shareRound").click()); await wait(1500) }],
];
async function clickTab(p, name) { const t = p.locator(`[role=tab]:has-text("${name}")`); if (await t.count()) { await t.first().click(); await wait(300) } }

async function shootApp(browser, [name, scenario, act], scheme) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2, colorScheme: scheme, timezoneId: "Asia/Seoul", locale: "ko-KR", serviceWorkers: "block" });
  await routeAll(ctx);
  const seed = makeSeed(scenario === "login" ? "empty" : scenario); seed.signedIn = scenario !== "login";
  await ctx.addInitScript(s => { window.__SEED = s }, seed);
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.clock.setFixedTime(new Date(NOW));
  await p.goto("http://app.local/index.html");
  await p.waitForFunction(() => [...document.querySelectorAll("section.screen")].some(s => !s.hidden && s.id !== "scrSplash"), null, { timeout: 8000 }).catch(() => {});
  await wait(1200);
  try { await act(p) } catch (e) { errs.push("action: " + e.message) }
  await p.evaluate(() => document.fonts && document.fonts.ready);
  await wait(300);
  const tag = `${name}-${scheme}${WIDTH !== 390 ? "-" + WIDTH : ""}`;
  if (name === "share") {
    const src = await p.evaluate(() => { const i = document.querySelector("#ov img"); return i && i.src });
    if (src) { const b = await p.evaluate(async u => { const r = await fetch(u); const a = new Uint8Array(await r.arrayBuffer()); let s = ""; a.forEach(x => s += String.fromCharCode(x)); return btoa(s) }, src); writeFileSync(path.join(OUT, `${tag}-image.png`), Buffer.from(b, "base64")) }
  }
  await p.screenshot({ path: path.join(OUT, `${tag}.png`) });
  // 긴 화면: 안쪽 스크롤 영역을 펼쳐서 전체를 한 장으로
  await p.addStyleTag({ content: "html,body{height:auto!important;overflow:visible!important}#scroller{position:static!important;overflow:visible!important;height:auto!important}" });
  await wait(150);
  await p.screenshot({ path: path.join(OUT, `${tag}-full.png`), fullPage: true });
  if (errs.length) console.log(`  ! ${tag}: ${errs.join(" | ")}`);
  await ctx.close();
}

// ---------- 시안(.dc.html) 그리기: {{값}} 치환 + <sc-for>/<sc-if> 펼치기 ----------
const BLOB = { "412fd059e887c4235f87be34aeb8c579": "splash-aerial-bunkers.jpg", a7d23579c71b0382e4ebc12f9614d26f: "home-live-aerial.jpg", "9de3599be213f91662feb55d2fbe889c": "insights-header-bunker.jpg", e534bedb0c7751772ee501cf71483d7d: "share-card-lush.jpg" };
const PRETENDARD = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";
async function shootDesign(browser, file, props, tag) {
  let src = readFileSync(path.join(ROOT, "design/v3/screens", file), "utf8");
  src = src.replace(/\/_blob\/([0-9a-f]+)/g, (m, id) => BLOB[id] ? `/design/v3/images/${BLOB[id]}` : m);
  const body = src.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1].replace(/<helmet>([\s\S]*?)<\/helmet>/, "");
  const style = (src.match(/<helmet>([\s\S]*?)<\/helmet>/) || ["", ""])[1].replace(/@font-face\{[^}]*\}/g, "");
  const logic = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${PRETENDARD}">${style}<style>body{margin:0}</style></head><body><template id="t">${body}</template><div id="o"></div>
<script>
class DCLogic{constructor(p){this.props=p;this.state=null}}
${logic}
const vals=new Component(${JSON.stringify(props)}).renderVals();
const get=(sc,e)=>e.trim().split(".").reduce((o,k)=>o==null?o:o[k],sc);
const sub=(s,sc)=>s.replace(/\\{\\{([^}]+)\\}\\}/g,(m,e)=>{const v=get(sc,e);return v==null||typeof v==="function"?"":v});
function walk(node,sc,out){
  for(const n of [...node.childNodes]){
    if(n.nodeType===3){out.appendChild(document.createTextNode(sub(n.textContent,sc)));continue}
    if(n.nodeType!==1) continue;
    const tg=n.localName;
    if(tg==="sc-for"){const list=get(sc,n.getAttribute("list").replace(/[{}]/g,""))||[], as=n.getAttribute("as");
      list.forEach(it=>walk(n,{...sc,[as]:it},out));continue}
    if(tg==="sc-if"){if(get(sc,n.getAttribute("value").replace(/[{}]/g,""))) walk(n,sc,out);continue}
    const c=n.namespaceURI==="http://www.w3.org/2000/svg"?document.createElementNS(n.namespaceURI,tg):document.createElement(tg);
    for(const a of n.attributes){ if(/^on/i.test(a.name)) continue; c.setAttribute(a.name,sub(a.value,sc)) }
    walk(n.content||n,sc,c); out.appendChild(c);
  }
}
walk(document.getElementById("t").content,vals,document.getElementById("o"));
</script></body></html>`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: HEIGHT }, deviceScaleFactor: 2 });
  await routeAll(ctx);
  await ctx.route("http://app.local/__design.html", r => r.fulfill({ body: html, contentType: "text/html" }));
  const p = await ctx.newPage(); p.on("pageerror", e => console.log("  ! design", file, e.message));
  await p.goto("http://app.local/__design.html");
  await p.evaluate(() => document.fonts.ready); await wait(500);
  await p.locator("#o > div").first().screenshot({ path: path.join(OUT, `design-${tag}.png`) });
  await ctx.close();
}

const browser = await chromium.launch();
if (args.includes("--design")) {
  for (const [f, props, tag] of [["Splash.dc.html", {}, "splash"], ["Home.dc.html", { dark: false }, "home-light"], ["Home.dc.html", { dark: true }, "home-dark"],
    ["HoleInput.dc.html", {}, "play"], ["Round.dc.html", { startTab: "sum" }, "round"], ["Round.dc.html", { startTab: "score" }, "round-score"],
    ["Round.dc.html", { startTab: "shot" }, "round-shot"], ["Round.dc.html", { startTab: "diary" }, "round-diary"], ["Insights.dc.html", {}, "stats"], ["ShareCard.dc.html", {}, "share"]])
    if (!ONLY || ONLY.some(o => tag.startsWith(o))) { await shootDesign(browser, f, props, tag); console.log("design", tag) }
} else {
  for (const s of SHOTS) {
    if (ONLY && !ONLY.includes(s[0])) continue;
    for (const scheme of ["light", "dark"]) { await shootApp(browser, s, scheme); }
    console.log("app", s[0]);
  }
}
await browser.close();
