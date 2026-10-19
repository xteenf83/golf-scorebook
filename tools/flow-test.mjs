// 홀 입력 흐름 회귀 테스트: node tools/flow-test.mjs
// - 평범한 홀은 '다음 홀' 한 번으로 끝 (기본값 파·2퍼트·페어웨이·직진)
// - 벌타·스코어·퍼팅 연동 (지금 동작 그대로인지)
// - 18홀/9홀 마지막 홀 완료 → 라운드 기록 화면, 저장 형식 그대로
import { chromium, openApp, wait } from "./harness.mjs";

let fail = 0;
const ok = (c, msg) => { console.log((c ? "  ✓ " : "  ✗ ") + msg); if (!c) fail++ };
const saved = (p, id) => p.evaluate(id => { const k = [...window.__MOCK.data.keys()].find(k => k.endsWith("/rounds/" + id)); return k && window.__MOCK.data.get(k) }, id);
const playingId = p => p.evaluate(() => { for (const [k, v] of window.__MOCK.data) if (/\/rounds\//.test(k) && v.status === "playing") return k.split("/").pop() });
const curHole = p => p.evaluate(() => +document.querySelector("#strip button.cur").dataset.h);

async function startRound(p, holes) {
  await p.click("#fabTab"); await wait(300);
  if (holes === 9) { await p.click('#holesSeg [data-n="9"]'); await wait(100) }
  await p.click("#startBtn"); await wait(600);
}

const browser = await chromium.launch();
{
  console.log("18홀 홀별 입력");
  const p = await openApp(browser, { scenario: "done" });
  await startRound(p, 18);
  ok(!(await p.isHidden("#scrPlay")), "새 라운드 → 홀 입력 화면");
  const id = await playingId(p);
  await p.click("#nextBtn"); await wait(500);
  let r = await saved(p, id);
  ok(await curHole(p) === 1, "'다음 홀' 한 번에 2번 홀로");
  const h0 = r.holes[0];
  ok(h0.done && h0.d === 0 && h0.putts === 2 && h0.shape === "straight" && h0.ob === 0 && h0.hz === 0 && (h0.par >= 4 ? h0.fw === "H" : h0.fw === null), "1번 홀 기본값 저장 (파·2퍼트·페어웨이·직진)");
  ok(JSON.stringify(Object.keys(h0).sort()) === JSON.stringify(["d", "done", "fw", "ob", "par", "putts", "shape", "hz"].sort()), "홀 저장 항목 그대로: " + Object.keys(h0).join(","));
  // 벌타 + : 스코어는 그대로 (지금 동작 유지)
  await p.click('[data-pen="ob"][data-v="1"]'); await wait(500);
  r = await saved(p, id);
  ok(r.holes[1].ob === 1 && r.holes[1].d === 0, "OB +1 → ob=1, 스코어는 자동으로 바뀌지 않음 (기존 동작)");
  ok((await p.textContent("#obV")) === "1", "OB 숫자 표시 1");
  await p.click('#scoreIn .rb[aria-label="한 타 늘리기"]'); await wait(400);
  await p.click('#scoreIn .rb[aria-label="한 타 늘리기"]'); await wait(400);
  r = await saved(p, id);
  ok(r.holes[1].d === 2, "스코어 + 두 번 → 파 대비 +2");
  ok((await p.textContent("#scoreIn .sval b")) === String(r.holes[1].par + 2), "큰 숫자 = 파+2");
  ok(/더블 보기/.test(await p.textContent("#scoreIn .chip")), "결과 칩 '더블 보기'");
  // 퍼팅을 타수보다 많이 고르면 타수가 따라 올라감 (기존 동작)
  await p.click('#puttBtns [data-p="4"]'); await wait(400);
  r = await saved(p, id);
  ok(r.holes[1].putts === 4 && r.holes[1].par + r.holes[1].d >= 5, "4퍼트 → 타수 최소 5타로 (기존 동작)");
  ok(/그린/.test(await p.textContent("#girLbl")), "그린 적중/미스 자동 표시");
  // 한 타씩 줄이기: 이글(-2) 아래로는 안 내려감
  for (let i = 0; i < 9; i++) { const b = p.locator('#scoreIn .rb[aria-label="한 타 줄이기"]'); if (await b.isDisabled()) break; await b.click(); await wait(120) }
  await wait(600);   // 자동 저장(0.4초 뒤) 기다림
  r = await saved(p, id);
  ok(r.holes[1].d === -2 && r.holes[1].putts <= r.holes[1].par - 3, `가장 낮게 = 이글, 퍼팅도 맞춰 줄어듦 (d=${r.holes[1].d}, putts=${r.holes[1].putts})`);
  // 파3에서는 티샷 방향 칸 숨김
  const par3 = r.holes.findIndex(h => h.par === 3);
  await p.click(`#strip [data-h="${par3}"]`); await wait(300);
  ok(await p.isHidden("#fwField"), "파3 홀: 페어웨이 칸 숨김");
  await p.click(`#strip [data-h="1"]`); await wait(300);
  for (let i = 1; i < 17; i++) { await p.click("#nextBtn"); await wait(150) }
  ok(await curHole(p) === 17, "18번 홀까지 이동");
  ok((await p.textContent("#nextT")) === "라운드 완료", "마지막 홀 버튼 '라운드 완료'");
  await p.click("#nextBtn"); await wait(900);
  r = await saved(p, id);
  ok(r.status === "done" && r.holes.every(h => h.done), "완료 → status done, 모든 홀 done");
  ok(!(await p.isHidden("#scrRound")), "라운드 기록 화면으로 이동");
  ok(!p.errs.length, "오류 없음 " + p.errs.join(" | "));
  await p.context().close();
}
{
  console.log("9홀 홀별 입력");
  const p = await openApp(browser, { scenario: "done" });
  await startRound(p, 9);
  const id = await playingId(p);
  let r = await saved(p, id);
  ok(r.holes.length === 9 && r.holesPlayed === 9 && r.back === null, "9홀 라운드 생성 (holes 9개, back null)");
  for (let i = 0; i < 9; i++) { await p.click("#nextBtn"); await wait(150) }
  await wait(800);
  r = await saved(p, id);
  ok(r.status === "done", "9홀 완료");
  ok(!(await p.isHidden("#scrRound")), "라운드 기록 화면으로 이동");
  ok(!p.errs.length, "오류 없음 " + p.errs.join(" | "));
  await p.context().close();
}
{
  console.log("진행 중 라운드 이어서 + 홈으로");
  const p = await openApp(browser, { scenario: "full" });
  await p.click("#fabTab"); await wait(400);
  ok(await curHole(p) === 3, "초록 원 버튼 → 보던 4번 홀로");
  // 아래 고정 메모 버튼: 메모 칸으로 가서 바로 입력, 메모가 있으면 표시
  await p.click("#memoBtn"); await wait(700);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.id === "memoIn"), "메모 버튼 → 메모 칸에 바로 입력");
  ok(await p.evaluate(() => { const r = document.querySelector(".memocard").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }), "메모 칸이 화면 안에 보임");
  await p.keyboard.type("오르막 퍼팅 짧았음"); await wait(700);
  ok(await p.evaluate(() => document.querySelector("#memoBtn").classList.contains("has") && document.querySelector('#strip [data-h="3"]').classList.contains("memo")), "메모 남기면 버튼·홀 번호에 표시");
  await p.click("#topBack"); await wait(400);
  ok(!(await p.isHidden("#scrHome")), "← 버튼 → 홈");
  ok(!p.errs.length, "오류 없음 " + p.errs.join(" | "));
  await p.context().close();
}
await browser.close();
console.log(fail ? `실패 ${fail}개` : "모두 통과");
process.exit(fail ? 1 : 0);
