// 사용법(더보기 → 라운드 기록하는 법) 그림 만들기: 실제 앱 화면(예시 데이터, 우타)을 잘라 PNG로 저장.
//   node tools/guide-images.mjs <폴더>  → 그다음 JPEG(품질 80)로 바꿔 images/guide/에 넣는다.
// 화면이 바뀌면 다시 찍을 것.
import { chromium, openApp, wait, makeSeed } from "./harness.mjs";
const b=await chromium.launch(); const OUT=process.argv[2];
const fab=p=>p.evaluate(()=>document.querySelector("[data-tab=new],#fabTab,.fabbtn").click());
async function region(p,name,a,z,pad=8){ // a~z 요소를 덮는 영역
  const r=await p.evaluate(([a,z])=>{ const A=document.querySelector(a).getBoundingClientRect(), Z=document.querySelector(z).getBoundingClientRect(); return [Math.min(A.top,Z.top)+scrollY,Math.max(A.bottom,Z.bottom)+scrollY] },[a,z]);
  await p.screenshot({path:`${OUT}/${name}.png`,clip:{x:0,y:Math.max(0,r[0]-pad),width:390,height:r[1]-r[0]+pad*2},fullPage:true});
}
const unpin=p=>p.addStyleTag({content:"html,body{height:auto!important;overflow:visible!important}#scroller{position:static!important;overflow:visible!important;height:auto!important}#bottomNav,#tabBar,.tabbar{visibility:hidden!important}"});
for(const sc of ["light","dark"]){
  const seed=()=>{ const s=makeSeed("done"); s.settings={hand:"R"}; return s };
  let p=await openApp(b,{scenario:"done",scheme:sc,seed:seed()}); await fab(p); await wait(500); await unpin(p); await wait(200);
  await region(p,`g1-setup-${sc}`,"#modeRow","#sBackWrap",14);
  await p.click('#modeSeg [data-m="score"]'); await wait(300);
  await region(p,`g6-score-${sc}`,"#scoreBox","#scoreBox",10).catch(async()=>{});
  await p.context().close();
  p=await openApp(b,{scenario:"done",scheme:sc,seed:seed()}); await fab(p); await wait(400); await p.click("#startBtn"); await wait(800);
  // 아래 고정 버튼 줄만 따로
  await p.addStyleTag({content:"#scrPlay>*:not(#bottomNav),#topBar{visibility:hidden!important}"}); await wait(150);
  const nb=await p.$("#bottomNav"); await nb.screenshot({path:`${OUT}/g5-next-${sc}.png`});
  await p.addStyleTag({content:"#scrPlay>*:not(#bottomNav),#topBar{visibility:visible!important}"});
  await unpin(p); await wait(200);
  await region(p,`g2-hole-${sc}`,"#strip","#scrPlay .holecard",6).catch(e=>console.log("g2",e.message));
  await region(p,`g3-tee-${sc}`,"#teeCard","#teeCard",6);
  await region(p,`g4-score-${sc}`,"#scrPlay .pencard",'#scrPlay [data-step="score"]',6).catch(e=>console.log("g4",e.message));
  console.log(sc,p.errs.join("|")||"ok"); await p.context().close();
}
await b.close();
