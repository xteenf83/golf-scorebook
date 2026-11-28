// Cloudflare Worker 'golf-ics' — 두 가지 일을 한다. 아무것도 저장하지 않는다.
// 1) GET  /?d=…   : 앱이 base64url로 보낸 .ics를 text/calendar로 돌려준다.
//    아이폰은 인터넷 주소로 받은 .ics만 바로 '캘린더에 추가' 화면을 띄우기 때문 (홈 화면 앱은 data:·blob: 주소를 못 엶).
// 2) POST /notify : 앱에서 요청함에 새 요청을 보내면 관리자 텔레그램으로 알림.
//    보낸 사람 확인: Firebase 로그인 토큰(ID token)을 구글 공개키로 검사하고, 이름·이메일은 토큰에서 꺼낸다.
//    텔레그램 봇 토큰·채팅 번호는 Cloudflare 대시보드 → 이 Worker → 설정 → 변수 및 비밀에 TG_TOKEN, TG_CHAT으로 넣는다(레포에 넣지 않음).
// 배포: Cloudflare Worker golf-ics에 이 레포를 연결 (Root directory: tools/ics-worker). 주소는 index.html의 ICS_URL·NOTIFY_URL에.
const PROJECT = "golf-scorebook";
const ORIGINS = ["https://xteenf83.github.io"];
const TYPES = { course: "골프장 추가", bug: "불편·오류", idea: "기능 제안" };
const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/notify") return notify(req, env || {});
    return ics(url);
  },
};

function ics(url) {
  const d = url.searchParams.get("d") || "";
  let ics = "";
  try {
    const b = atob(d.replace(/-/g, "+").replace(/_/g, "/"));
    ics = new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0)));
  } catch (e) {}
  if (!ics.startsWith("BEGIN:VCALENDAR") || ics.length > 8000)
    return new Response("잘못된 요청입니다", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="golf.ics"',
      "Cache-Control": "no-store",
    },
  });
}

// ---------- 텔레그램 알림 ----------
const cors = req => {
  const o = req.headers.get("Origin") || "";
  return ORIGINS.includes(o) ? { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Vary": "Origin" } : {};
};
const reply = (req, status, msg = "") => new Response(status === 204 ? null : msg, { status, headers: { ...cors(req), "Content-Type": "text/plain; charset=utf-8" } });
const recent = new Map();   // uid → 최근 보낸 시각들 (같은 사람이 너무 자주 보내면 알림만 막음, 요청 자체는 앱에 저장됨)

async function notify(req, env) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return reply(req, 405);
  const TG_TOKEN = String(env.TG_TOKEN || "").trim(), TG_CHAT = String(env.TG_CHAT || "").trim();
  if (!TG_TOKEN || !TG_CHAT) return reply(req, 503, "알림 설정 전(TG_TOKEN·TG_CHAT 없음)");
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  let user = null, why = "";
  try { user = await verifyIdToken(tok); } catch (e) { why = String(e.message || e).slice(0, 80); }
  if (!user) return reply(req, 401, "로그인 확인 실패" + (why ? `: ${why}` : ""));
  const now = Date.now(), times = (recent.get(user.sub) || []).filter(t => now - t < 10 * 60e3);
  if (times.length >= 5) return reply(req, 429, "너무 자주 보냄(10분에 5번)");
  recent.set(user.sub, [...times, now]);
  let b = {};
  try { b = await req.json(); } catch (e) {}
  const s = (v, n) => String(v || "").slice(0, n).trim();
  const type = TYPES[b.type] ? b.type : "idea";
  const lines = [`⛳ 새 요청 · ${TYPES[type]}`];
  if (type === "course") lines.push(s(b.club, 60) + (s(b.region, 40) ? ` · ${s(b.region, 40)}` : ""));
  if (s(b.text, 1000)) lines.push(s(b.text, 1000));
  lines.push("", `— ${s(user.name, 40) || "이름 없음"}${user.email ? ` (${s(user.email, 100)})` : ""} · ${s(b.appVer, 10)} · ${s(b.device, 10)}`, "앱 더보기 → 받은 요청함에서 답변");
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text: lines.join("\n"), disable_web_page_preview: true }),
  });
  if (r.ok) return reply(req, 204);
  // 텔레그램이 거절한 이유(예: chat not found, bot can't initiate conversation, Unauthorized)를 그대로 돌려준다 — 비밀은 담기지 않음
  let d = ""; try { d = (await r.json()).description || ""; } catch (e) {}
  return reply(req, 502, "텔레그램 거절: " + String(d || r.status).slice(0, 120));
}

// Firebase ID token(RS256 JWT) 검사: 서명(구글 공개키) · 발급처 · 대상 프로젝트 · 만료
let jwks = null, jwksAt = 0;
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
async function verifyIdToken(t) {
  const [h, p, sig] = t.split(".");
  if (!sig) return null;
  const head = JSON.parse(new TextDecoder().decode(b64u(h))), pay = JSON.parse(new TextDecoder().decode(b64u(p)));
  if (head.alg !== "RS256") return null;
  if (!jwks || Date.now() - jwksAt > 3600e3) { jwks = (await (await fetch(JWK_URL)).json()).keys; jwksAt = Date.now(); }
  const jwk = jwks.find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(sig), new TextEncoder().encode(h + "." + p));
  const now = Date.now() / 1000;
  if (!ok || pay.aud !== PROJECT || pay.iss !== `https://securetoken.google.com/${PROJECT}` || !pay.sub || pay.exp < now || pay.iat > now + 300) return null;
  return pay;
}
