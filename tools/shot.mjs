// 화면 확인용 스크린샷 도구 (배포에는 포함되지 않음)
//   node tools/shot.mjs [출력폴더=shots] [--only=home,play] [--width=390] [--design]
// - 앱: 가짜 로그인·예시 데이터(tools/seed.mjs)로 index.html을 열어 라이트/다크로 찍는다.
// - --design: design/v3/screens/*.dc.html 시안을 그대로 그려서 같이 찍는다 (비교용).
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium, routeAll, openApp, wait, ROOT } from "./harness.mjs";
const args = process.argv.slice(2);
const opt = k => (args.find(a => a.startsWith(`--${k}=`)) || "").split("=")[1];
const OUT = path.resolve(args.find(a => !a.startsWith("--")) || "shots");
const ONLY = opt("only") ? opt("only").split(",") : null;
const WIDTH = +(opt("width") || 390), HEIGHT = 844;
mkdirSync(OUT, { recursive: true });

// ---------- 찍을 화면들: [이름, 시나리오, 동작] ----------
const click = async (p, sel) => { await p.locator(sel).first().click(); await wait(350) };
const SHOTS = [
  ["splash", "done", async p => {}],
  ["login", "login", async p => {}],
  ["home", "full", async p => {}],
  ["home-done", "done", async p => {}],
  ["home-empty", "empty", async p => {}],
  ["play", "full", async p => { await p.evaluate(() => document.querySelector("[data-tab=new],#fabTab,.fabbtn").click()); await wait(500) }],
  ["play-edit", "done", async p => { await click(p, "#roundList [data-id]"); await p.evaluate(() => document.querySelector("#roundEdit").click()); await wait(500) }],
  ["setup", "done", async p => { await p.evaluate(() => document.querySelector("[data-tab=new],#fabTab,.fabbtn").click()); await wait(400) }],
  ["round", "done", async p => { await click(p, "#roundList [data-id]") }],
  ["round-score", "done", async p => { await click(p, "#roundList [data-id]"); await clickTab(p, "스코어") }],
  ["round-shot", "done", async p => { await click(p, "#roundList [data-id]"); await clickTab(p, "샷") }],
  ["round-diary", "done", async p => { await click(p, "#roundList [data-id]"); await clickTab(p, "일기") }],
  ["round-scoreonly", "done", async p => { await click(p, "#allToggle"); await click(p, '#rlList [data-id="r1"]'); await clickTab(p, "스코어") }],
  ["round-total", "done", async p => { await click(p, "#allToggle"); await click(p, '#rlList [data-id="r0"]') }],
  ["stats", "done", async p => { await click(p, "[data-tab=Stats]") }],
  ["courses", "done", async p => { await click(p, "[data-tab=Courses]") }],
  ["badges", "done", async p => { await p.evaluate(() => document.querySelector("[data-tab=Badges],#badgeBtn").click()); await wait(400) }],
  ["more", "done", async p => { await p.evaluate(() => document.querySelector("#avatar,#menuBtn").click()); await wait(400) }],
  ["share", "done", async p => { await click(p, "#roundList [data-id]"); await p.evaluate(() => document.querySelector("#roundShare").click()); await wait(1500) }],
];
async function clickTab(p, name) { const t = p.locator(`[role=tab]:has-text("${name}")`); if (await t.count()) { await t.first().click(); await wait(300) } }

async function shootApp(browser, [name, scenario, act], scheme) {
  const p = await openApp(browser, { scenario, scheme, width: WIDTH, height: HEIGHT, early: name === "splash" }), ctx = p.context(), errs = p.errs;
  try { await act(p) } catch (e) { errs.push("action: " + e.message) }
  await p.evaluate(() => document.fonts && document.fonts.ready);
  if (name !== "splash") await wait(300);
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
