// The backend address comes from config.js (online) or localhost (on your computer).
const LOCAL = ["", "localhost", "127.0.0.1"].includes(location.hostname);
const API = LOCAL ? "http://127.0.0.1:5000" : (window.API_URL || "");
const $ = (s) => document.querySelector(s);
const chat = $("#chat"), journal = $("#journalList");
const LEVEL_XP = 40;
const BADGES = [
  { id: "first", ic: "🌱", name: "First Question", ok: (s) => s.q >= 1 },
  { id: "curious", ic: "🔍", name: "Curious Explorer (3 big questions)", ok: (s) => s.curious >= 3 },
  { id: "persist", ic: "💪", name: "Never Give Up (5 questions)", ok: (s) => s.q >= 5 },
  { id: "ten", ic: "🏆", name: "Super Explorer (10 questions)", ok: (s) => s.q >= 10 },
  { id: "aha", ic: "💡", name: "Aha! Moment", ok: (s) => s.aha >= 1 },
];
const PRAISE_CURIOUS = ["Great question!", "Now that's explorer thinking!", "Ooh, I love that you asked this!", "Brilliant curiosity!"];
const PRAISE_STUCK = ["Being stuck means you're about to learn something!", "Thanks for telling me. That takes courage!", "Every great designer gets stuck. You're doing it right!"];
const MOOD_REPLY = {
  1: "Tough days happen. Small steps count, and I'm right here with you. 💛",
  2: "Okay is a fine place to start. Let's find something fun to explore!",
  3: "Yay, good vibes! Let's make something awesome today!",
  4: "Amazing! Your energy is contagious. Let's go, explorer! 🚀",
};

let S = { name: "", xp: 0, q: 0, curious: 0, trails: [], aha: 0, badges: [] };
let KEY = "explorer:guest";
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
let history = [];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ---------- mascot, toast, confetti ---------- */
const MOUTH = { happy: "M44 78 Q60 94 76 78", cheer: "M42 76 Q60 102 78 76 Z", think: "M48 84 L72 84" };
function mood(m, ms = 1800) {
  const el = $("#mascot"); el.setAttribute("class", "mascot " + m);
  $("#mouth").setAttribute("d", MOUTH[m]); $("#mouth").setAttribute("fill", m === "cheer" ? "#FF6B6B" : "none");
  if (m !== "happy") setTimeout(() => mood("happy"), ms);
}
let tt; function toast(t) { const e = $("#toast"); e.textContent = t; e.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => e.classList.remove("show"), 3200); }

const cv = $("#confetti"), cx = cv.getContext("2d"); let bits = [];
function fit() { cv.width = innerWidth; cv.height = innerHeight; } fit(); addEventListener("resize", fit);
function burst(n = 120) {
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
  const cols = ["#FFD54A", "#FF6B6B", "#17A399", "#5B8DEF", "#fff"];
  for (let i = 0; i < n; i++) bits.push({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - .5) * 16, vy: Math.random() * -14 - 3, s: 5 + Math.random() * 6, c: pick(cols), r: Math.random() * 6 });
  if (bits.length === n) tick();
}
function tick() {
  cx.clearRect(0, 0, cv.width, cv.height);
  bits.forEach((b) => { b.x += b.vx; b.y += b.vy; b.vy += .45; b.r += .2; cx.save(); cx.translate(b.x, b.y); cx.rotate(b.r); cx.fillStyle = b.c; cx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s * .6); cx.restore(); });
  bits = bits.filter((b) => b.y < cv.height + 20);
  if (bits.length) requestAnimationFrame(tick); else cx.clearRect(0, 0, cv.width, cv.height);
}

/* ---------- XP, badges, journal ---------- */
function render() {
  $("#lvl").textContent = "Level " + (Math.floor(S.xp / LEVEL_XP) + 1);
  $("#fill").style.width = ((S.xp % LEVEL_XP) / LEVEL_XP) * 100 + "%";
  $("#xpTxt").textContent = (S.xp % LEVEL_XP) + " / " + LEVEL_XP + " XP";
  $("#badges").innerHTML = BADGES.map((b) => `<li class="${S.badges.includes(b.id) ? "on" : ""}"><span class="ic">${b.ic}</span>${b.name}</li>`).join("");
  if (S.name) { $("#greet").textContent = "Hi, " + S.name + "! 👋"; }
}
function gainXP(n) {
  const before = Math.floor(S.xp / LEVEL_XP); S.xp += n;
  const after = Math.floor(S.xp / LEVEL_XP);
  BADGES.forEach((b) => { if (!S.badges.includes(b.id) && b.ok(S)) { S.badges.push(b.id); toast(b.ic + " New badge: " + b.name.split(" (")[0] + "!"); mood("cheer"); burst(); } });
  if (after > before) { toast("🎉 Level " + (after + 1) + "! You're growing as an explorer!"); mood("cheer", 2500); burst(200); }
  save(); render();
}
function journalAdd(text, star) {
  if (journal.querySelector(".empty")) journal.innerHTML = "";
  const li = document.createElement("li"); li.textContent = (star ? "⭐ " : "") + text; journal.prepend(li);
}
function add(role, text, praise, note) {
  const d = document.createElement("div"); d.className = "msg " + (role === "me" ? "me" : "bot");
  if (praise) { const s = document.createElement("strong"); s.textContent = praise; d.appendChild(s); }
  d.appendChild(document.createTextNode(text));
  if (note) { const n = document.createElement("small"); n.textContent = note; d.appendChild(n); }
  chat.appendChild(d); d.scrollIntoView({ block: "nearest" });
}

/* ---------- events ---------- */
document.querySelectorAll(".mood button").forEach((b) => b.addEventListener("click", () => {
  toast(MOOD_REPLY[b.dataset.m]); mood(b.dataset.m >= 3 ? "cheer" : "happy");
}));

$("#aha").addEventListener("click", () => {
  const what = prompt("Awesome! What did you figure out?"); if (!what) return;
  S.aha++; journalAdd("💡 " + what); add("bot", "That's real discovery. You found it yourself, and that's the best kind of learning!", "WOW! Amazing work!");
  mood("cheer", 2500); burst(220); gainXP(25);
});

$("#askForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("#q").value.trim(); if (!q) return;
  const level = document.querySelector("input[name=level]:checked").value;
  const curious = /why|how|what if|who|what|\?/i.test(q);
  add("me", q); journalAdd(q, curious); $("#q").value = ""; $("#send").disabled = true; mood("think", 4000);
  S.q++; if (curious) S.curious++;
  try {
    const r = await fetch(API + "/api/hint", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, level: +level, history }) });
    const data = await r.json(); if (!r.ok) throw new Error(data.error);
    add("bot", data.hint, pick(curious ? PRAISE_CURIOUS : PRAISE_STUCK), data.offline ? "Offline hint. " + (data.reason || "") : "");
    history.push({ role: "student", text: q }, { role: "coach", text: data.hint });
    mood("happy"); gainXP(curious ? 15 : 10);
  } catch (err) { add("bot", API.includes("PASTE_") ? "The backend address is not set yet. Open frontend/config.js and paste your backend address. 🔌" : "I can't reach my helper brain. Check the backend address in config.js and that the backend is deployed. 🔌"); }
  $("#send").disabled = false;
});

document.querySelectorAll("#chips button").forEach((b) => b.addEventListener("click", () => { $("#q").value = b.textContent + " "; $("#q").focus(); }));

/* ---------- start: ask the name every time the page loads ---------- */
function begin(name) {
  KEY = "explorer:" + name.toLowerCase();
  S = { name, xp: 0, q: 0, curious: 0, trails: [], aha: 0, badges: [] };
  try { S = { ...S, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch (e) {}
  S.name = name; save(); render();
  $("#welcome").classList.add("gone");
  add("bot", "Type any question you have. I'll give you hints, or tap 'Explain it simply' if you want me to explain!", "Hello, " + name + "! 🎒");
  mood("cheer", 2500); burst(150); toast("Great to see you, " + name + "! Ready to explore? 🚀");
}
$("#startForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const n = $("#nameIn").value.trim().slice(0, 20);
  if (!n) { $("#nameIn").focus(); return; }
  begin(n);
});
document.querySelectorAll("#chips button").forEach((b) => b.addEventListener("click", () => { $("#q").value = b.textContent + " "; $("#q").focus(); }));
render(); $("#nameIn").focus();
