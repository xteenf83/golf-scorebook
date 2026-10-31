// Cloudflare Worker: 앱이 ?d= 에 담아 보낸 .ics(base64url)를 text/calendar로 그대로 돌려준다.
// 아이폰은 인터넷 주소로 받은 .ics만 바로 '캘린더에 추가' 화면을 띄우기 때문 (홈 화면 앱은 data:·blob: 주소를 못 엶).
// 아무것도 저장하지 않는다. 배포: Cloudflare Worker golf-ics에 이 레포를 연결 (Root directory: tools/ics-worker). 주소는 index.html의 ICS_URL에.
export default {
  async fetch(req) {
    const d = new URL(req.url).searchParams.get("d") || "";
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
  },
};
