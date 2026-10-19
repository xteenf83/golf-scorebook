// 분석 화면 숫자를 예시 데이터로 따로 계산해서 화면 글자와 대조: node tools/calc-check.mjs
import { chromium, openApp, makeSeed, wait } from "./harness.mjs";
const seed = makeSeed("done");
const done = seed.rounds.filter(r => r.status === "done" && (r.holesPlayed || 18) === 18).sort((a, b) => b.date.localeCompare(a.date));
const tot = r => r.type === "total" ? r.total : r.holes.reduce((s, h) => s + h.par + h.d, 0);
const last5 = done.slice(0, 5), prev5 = done.slice(5, 10), avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const a5 = avg(last5.map(tot)), d5 = a5 - avg(prev5.map(tot));
const pk = last5.filter(r => r.type !== "total" && r.holes.every(h => typeof h.par === "number"));
const byPar = [3, 4, 5].map(p => pk.flatMap(r => r.holes).filter(h => h.par === p).reduce((s, h) => s + h.d, 0) / pk.length);
let bb = 0, bn = 0; last5.filter(r => r.holes).forEach(r => r.holes.forEach((h, i) => { if (i < 17 && h.d >= 1) { bn++; if (r.holes[i + 1].d <= 0) bb++ } }));
const t5 = last5.map(tot), sd = Math.sqrt(t5.reduce((s, v) => s + (v - a5) ** 2, 0) / (t5.length - 1));
const halves = last5.filter(r => r.holes).map(r => [0, 9].map(k => r.holes.slice(k, k + 9).reduce((s, h) => s + h.par + h.d, 0)));
const back = avg(halves.map(x => x[1] - x[0]));
const want = { 평균: a5.toFixed(1) + "타", 변화: Math.abs(d5).toFixed(1), 파3: byPar[0].toFixed(1) + "타", 파4: byPar[1].toFixed(1) + "타", 파5: byPar[2].toFixed(1) + "타",
  바운스백: Math.round(bb / bn * 100) + "%", 기복: "±" + sd.toFixed(1), 후반체력: (back > 0 ? "+" : "") + back.toFixed(1) + "타" };
const b = await chromium.launch(); const p = await openApp(b, { scenario: "done" });
await p.click("[data-tab=Stats]"); await wait(500);
const text = await p.textContent("#scrStats");
let bad = 0;
for (const [k, v] of Object.entries(want)) { const ok = text.includes(v); if (!ok) bad++; console.log(`${ok ? "✓" : "✗"} ${k}: 손계산 ${v}`) }
await b.close(); console.log(bad ? `불일치 ${bad}개` : "모두 일치"); process.exit(bad ? 1 : 0);
