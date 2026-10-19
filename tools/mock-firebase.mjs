// 스크린샷용 가짜 Firebase: 앱이 쓰는 함수만 메모리 저장소로 흉내 낸다 (실제 서버·로그인 없이 화면 확인용).
// 브라우저에 window.__SEED = {rounds, courses, settings, user, signedIn} 를 먼저 넣어 둔다.
const store = `
const S = window.__MOCK || (window.__MOCK = (() => {
  const seed = window.__SEED || {}, data = new Map(), subs = new Set();
  const U = "u1", base = "users/" + U;
  (seed.rounds || []).forEach(r => { const {id, ...b} = r; data.set(base + "/rounds/" + id, b) });
  (seed.courses || []).forEach(c => { const {id, ...b} = c; data.set(base + "/courses/" + id, b) });
  data.set(base + "/settings/app", seed.settings || {});
  data.set(base, seed.user || {});
  let n = 0;
  return { data, subs, U, signedIn: seed.signedIn !== false, newId: () => "m" + (++n),
    fire() { setTimeout(() => subs.forEach(f => f()), 0) } };
})());
`;
export const MOCK = {
  "firebase-app.js": `export function initializeApp(c){ return {c} }`,
  "firebase-auth.js": `${store}
export function getAuth(){ return {} }
export class GoogleAuthProvider {}
const user = { uid: S.U, displayName: "김현수", email: "golfer@example.com" };
export function onAuthStateChanged(a, cb){ setTimeout(() => cb(S.signedIn ? user : null), 0); return () => {} }
export const getRedirectResult = () => Promise.resolve(null);
export const signInWithPopup = () => Promise.resolve({ user });
export const signInWithRedirect = () => Promise.resolve();
export const signOut = () => Promise.resolve();`,
  "firebase-firestore.js": `${store}
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export function collection(fs, ...p){ return { type: "col", path: p.join("/") } }
export function doc(a, ...p){ const path = a && a.type === "col" ? [a.path, ...(p.length ? p : [S.newId()])].join("/") : p.join("/");
  return { type: "doc", path, id: path.split("/").pop() } }
const snapDoc = r => ({ id: r.id, ref: r, exists: () => S.data.has(r.path), data: () => S.data.has(r.path) ? JSON.parse(JSON.stringify(S.data.get(r.path))) : undefined });
const kids = c => [...S.data.keys()].filter(k => k.startsWith(c.path + "/") && !k.slice(c.path.length + 1).includes("/")).map(k => snapDoc({ type: "doc", path: k, id: k.split("/").pop() }));
export async function setDoc(r, b, o){ S.data.set(r.path, o && o.merge ? { ...(S.data.get(r.path) || {}), ...b } : JSON.parse(JSON.stringify(b))); S.fire() }
export async function updateDoc(r, b){ S.data.set(r.path, { ...(S.data.get(r.path) || {}), ...JSON.parse(JSON.stringify(b)) }); S.fire() }
export async function deleteDoc(r){ S.data.delete(r.path); S.fire() }
export async function getDoc(r){ return snapDoc(r) }
export async function getDocs(c){ return { docs: kids(c) } }
export const getDocsFromServer = getDocs;
export function writeBatch(){ const ops = []; return { set: (r, b, o) => ops.push(() => setDoc(r, b, o)), update: (r, b) => ops.push(() => updateDoc(r, b)), commit: async () => { for (const f of ops) await f() } } }
export function onSnapshot(r, ...a){ const fn = a.find(x => typeof x === "function");
  const meta = { hasPendingWrites: false, fromCache: false };
  const run = () => fn(r.type === "col" ? { docs: kids(r), metadata: meta } : { ...snapDoc(r), metadata: meta });
  S.subs.add(run); setTimeout(run, 0); return () => S.subs.delete(run) }`,
};
