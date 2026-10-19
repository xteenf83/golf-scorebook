// 스크린샷용 예시 데이터: 실제 앱과 같은 저장 형식(rounds / courses / settings)으로 만든다.
// 시드 고정 난수라 매번 같은 데이터가 나온다.
import { readFileSync } from "node:fs";

export const NOW = new Date("2026-10-19T09:30:00+09:00").getTime();

function defaultCourses(root) {
  const s = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const m = s.match(/const DEFAULT_COURSES = (\[[\s\S]*?\n\]);/);
  return new Function("return " + m[1])().map((c, i) => ({ id: "c" + i, ...c, createdAt: 1 }));
}

export function makeSeed(scenario = "full") {
  const courses = defaultCourses();
  const C = (club, name) => courses.find(c => c.club === club && c.name === name);
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const pick = w => { let t = rnd() * w.reduce((a, x) => a + x[1], 0); for (const [k, v] of w) { if ((t -= v) < 0) return k } return w[0][0] };
  const SHAPE_W = [["slice", 18], ["fade", 14], ["push", 6], ["straight", 31], ["pull", 9], ["draw", 14], ["hook", 8]];
  const half = c => ({ courseId: c.id, course: c.name, pars: [...c.pars] });

  function holesFor(pars, target) {
    let d = pars.map(() => pick([[0, 30], [1, 45], [2, 15], [-1, 4], [3, 6]]));
    const want = target - pars.reduce((a, b) => a + b, 0);
    let guard = 0;
    while (d.reduce((a, b) => a + b, 0) !== want && guard++ < 500) {
      const i = Math.floor(rnd() * d.length), up = d.reduce((a, b) => a + b, 0) < want;
      if (up && d[i] < 4) d[i]++; else if (!up && d[i] > -1) d[i]--;
    }
    return pars.map((p, i) => {
      const ob = d[i] >= 2 && rnd() < .3 ? 1 : 0, hz = !ob && d[i] >= 2 && rnd() < .25 ? 1 : 0;
      const fw = p < 4 ? null : ob ? (rnd() < .6 ? "L" : "R") : pick([["L", 34], ["H", 41], ["R", 25]]);
      let putts = pick([[2, 70], [3, 14], [1, 16]]); putts = Math.max(0, Math.min(p + d[i] - 1, putts));
      return { par: p, d: d[i], putts, fw, shape: pick(SHAPE_W), ob, hz, done: true };
    });
  }

  const rounds = [];
  const add = r => { rounds.push({ id: "r" + rounds.length, holesPlayed: 18, tee: "White", status: "done", createdAt: NOW - rounds.length * 1000, updatedAt: NOW - 86400e3, ...r }); return rounds[rounds.length - 1] };
  const plan = [
    ["2026-04-12", "오크밸리CC", "오크", "메이플", 101],
    ["2026-04-26", "서원힐스CC", "웨스트", "사우스", 98],
    ["2026-05-10", "베르힐CC 영종", "베르힐", "스카이", 99],
    ["2026-05-24", "서원힐스CC", "사우스", "웨스트", 96],
    ["2026-06-14", "라비에벨CC", "올드OUT", "올드IN", 97],
    ["2026-07-05", "서원힐스CC", "웨스트", "사우스", 95],
    ["2026-08-02", "오크밸리CC", "오크", "메이플", 94],
    ["2026-08-30", "베르힐CC 영종", "베르힐", "스카이", 98],
    ["2026-09-29", "서원힐스CC", "웨스트", "사우스", 93],
    ["2026-10-09", "서원힐스CC", "사우스", "웨스트", 89],
  ];
  if (scenario !== "empty") {
    // 총타만 기록한 18홀, 홀별 타수만 기록한 18홀, 9홀 라운드 (지난 기록)
    add({ date: "2026-03-29", club: "오크밸리CC", front: half(C("오크밸리CC", "파인")), back: half(C("오크밸리CC", "체리")), type: "total", total: 104, par: 72, out: 52, in: 52 });
    const sp = [...C("자유로CC", "대한").pars, ...C("자유로CC", "민국").pars];
    add({ date: "2026-03-15", club: "자유로CC", front: half(C("자유로CC", "대한")), back: half(C("자유로CC", "민국")), holes: holesFor(sp, 103).map(h => ({ par: h.par, d: h.d, done: true })) });
    add({ date: "2026-09-06", club: "강화웰빙CC", front: half(C("강화웰빙CC", "웰빙")), back: null, holesPlayed: 9, holes: holesFor(C("강화웰빙CC", "웰빙").pars, 44) });
    plan.forEach(([date, club, f, b, tot], k) => {
      const F = C(club, f), B = C(club, b);
      const r = add({ date, club, front: half(F), back: half(B), holes: holesFor([...F.pars, ...B.pars], tot) });
      if (k % 3 === 1) r.mission = { type: "slice", target: 3 };
      if (k === 5) r.mission = { type: "three", target: 2 };
      if (k === 6) r.mission = { type: "ob", target: 2 };
    });
    // 마지막 라운드: 고스트·메모·일기·미션
    const last = rounds[rounds.length - 1], prev = rounds.find(r => r.date === "2026-09-29");
    last.mission = { type: "slice", target: 3 };
    last.ghost = { front: { roundId: rounds.find(r => r.date === "2026-05-24").id, half: "front", label: "2026.05.24 베스트" }, back: { roundId: prev.id, half: "front", label: "2026.09.29 직전" } };
    last.holes[4].memo = "그린 앞 해저드 생각보다 가까움. 한 클럽 더 잡을 것";
    last.holes[12].memo = "오르막 라인 너무 약하게 쳤다";
    last.holes[16].memo = "드라이버 대신 유틸 쳤어야 했다";
    last.diary = "인아웃을 의식하니 슬라이스가 확실히 줄었다. 후반 OB는 드라이버 고집 때문. 다음엔 유틸로.";
  }
  if (scenario === "full") {
    const F = C("서원힐스CC", "사우스"), B = C("서원힐스CC", "웨스트");
    const holes = [...F.pars, ...B.pars].map(p => ({ par: p, d: 0, putts: 2, fw: p >= 4 ? "H" : null, shape: "straight", ob: 0, hz: 0, done: false }));
    [0, 1, 0].forEach((d, i) => Object.assign(holes[i], { d, done: true }));
    holes[1].fw = "L"; holes[1].shape = "slice";
    rounds.push({ id: "rplay", date: "2026-10-19", club: "서원힐스CC", front: half(F), back: half(B), holes, holesPlayed: 18, tee: "White", status: "playing", at: 3,
      mission: { type: "slice", target: 3 }, ghost: { front: { roundId: rounds.find(r => r.date === "2026-10-09").id, half: "front", label: "2026.10.09 베스트" }, back: null },
      createdAt: NOW - 3 * 3600e3, updatedAt: NOW - 13 * 3600e3 });
  }
  return { rounds, courses, settings: {}, user: { coursesSeedVersion: 99 } };
}
