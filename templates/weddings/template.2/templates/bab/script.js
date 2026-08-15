/* ============================================================
   قالب «باب الفرح» (bab)
   دخولية: دُقّوا على الباب ثلاث دقّات → الباب يُفتح على النور → الواجهة
   الصوت: طرقة حقيقية كل دقّة، صرير الباب عند انفتاحه، والأغنية بعد الفتح
   ============================================================ */

/* لا تربط المنصّة الأغنية بأول لمسة — القالب يسلّمها بنفسه لحظة ظهور الدعوة.
   يجب أن يسبق حقن مشغّل المنصّة، ولذلك هو أول سطر بالملف. */
window.__da3waMusicManualStart = true;

const WEDDING_CONFIG = (typeof window !== "undefined" && window.__INVITE__ && window.__INVITE__.config) || {
  groom: "محمد", bride: "زينب",
  date: "2026-11-20T19:00:00",
  dateText: "يوم الجمعة، ٢٠ تشرين الثاني ٢٠٢٦",
  timeText: "الساعة السابعة مساءً",
  heroSub: "فتحنا باب فرحتنا… وطارت البشائر تدعوكم",
  verse: "وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً",
  invitationText: "بقلوبٍ مفعمةٍ بالفرح والسرور، نفتح لكم باب فرحتنا وندعوكم لمشاركتنا أجمل لحظات حياتنا في حفل زفافنا. حضوركم شرفٌ لنا وبهجةٌ تكتمل بها فرحتنا.",
  groomParents: "نجل السيّد كريم عبد الله و السيّدة هدى",
  brideParents: "كريمة السيّد سامي حسن و السيّدة رنا",
  venueName: "قاعة بابل الكبرى", venueAddr: "بغداد — المنصور",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=Babylon+Hotel+Baghdad",
  program: [
    { time: "٧:٠٠ مساءً", title: "استقبال الضيوف" },
    { time: "٧:٣٠ مساءً", title: "عقد القران" },
    { time: "٩:٠٠ مساءً", title: "العشاء" },
    { time: "١٠:٠٠ مساءً", title: "السهرة" },
  ],
  notes: ["يُرجى الحضور قبل الموعد بنصف ساعة", "الدعوة تشمل حاملها والعائلة الكريمة"],
  closingNote: "حضوركم يفتح أبواب سعادتنا",
  hashtag: "#محمد_وزينب",
  contactLabel: "للتواصل والتأكيد", contactName: "أبو محمد", contactPhone: "+9647700000000",
  closingFamilies: "عائلة عبد الله  &  عائلة حسن",
  images: {},
};

function setText(id, v) { const el = document.getElementById(id); if (el && v != null) el.textContent = v; }
function toArabicDigits(s) { const ar = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"]; return String(s).replace(/[0-9]/g, (d) => ar[+d]); }
function pad(n) { return toArabicDigits(String(n).padStart(2, "0")); }

function fillContent() {
  const c = WEDDING_CONFIG;
  const names = c.groom && c.bride ? `${c.groom} & ${c.bride}` : "";
  setText("coverNames", names);
  setText("heroGroom", c.groom); setText("heroBride", c.bride);
  setText("heroInvite", c.heroSub); setText("heroDate", c.dateText);
  setText("verseText", c.verse); setText("invitationText", c.invitationText);
  setText("groomParents", c.groomParents); setText("brideParents", c.brideParents);
  setText("venueName", c.venueName); setText("venueAddr", c.venueAddr);
  setText("closingNote", c.closingNote); setText("closingFamilies", c.closingFamilies); setText("closingHashtag", c.hashtag);
  const mapBtn = document.getElementById("mapBtn");
  if (mapBtn && c.mapUrl) mapBtn.href = c.mapUrl; else if (mapBtn) mapBtn.style.display = "none";
  buildTimeline(c.program); buildNotes(c.notes); buildContact(c);
  if (c.groom && c.bride) document.title = `دعوة زفاف ${c.groom} & ${c.bride}`;
}

/* زهرة الجدول الزمني — SVG ثابتة (لا بيانات مستخدم) */
const BLOOM_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<g stroke="rgba(125,86,148,.45)" stroke-width=".8">
<ellipse cx="32" cy="17" rx="8" ry="12" fill="#c3a1d6"/>
<ellipse cx="32" cy="17" rx="8" ry="12" fill="#c3a1d6" transform="rotate(72 32 32)"/>
<ellipse cx="32" cy="17" rx="8" ry="12" fill="#b48fc9" transform="rotate(144 32 32)"/>
<ellipse cx="32" cy="17" rx="8" ry="12" fill="#c3a1d6" transform="rotate(216 32 32)"/>
<ellipse cx="32" cy="17" rx="8" ry="12" fill="#b48fc9" transform="rotate(288 32 32)"/>
</g>
<circle cx="32" cy="32" r="6.5" fill="#f0e0b4" stroke="#c9a45c" stroke-width="1"/>
</svg>`;

function buildTimeline(items) {
  const box = document.getElementById("timeline"); if (!box) return;
  const sec = box.closest(".program");
  if (!Array.isArray(items) || !items.length) { if (sec) sec.style.display = "none"; return; }
  box.innerHTML = "";
  const line = document.createElement("span"); line.className = "sched__line"; box.appendChild(line);
  items.forEach((it) => {
    const row = document.createElement("div"); row.className = "sched__row";
    const t = document.createElement("span"); t.className = "sched__time"; t.textContent = it.time || "";
    const d = document.createElement("span"); d.className = "sched__dot";
    const e = document.createElement("span"); e.className = "sched__event"; e.textContent = it.title || "";
    row.append(t, d, e); box.appendChild(row);
  });
  const bloom = document.createElement("span"); bloom.className = "sched__bloom"; bloom.innerHTML = BLOOM_SVG;
  box.appendChild(bloom);
  setupSchedBloom(box, bloom);
}

/* الزهرة تنزلق على الخط حسب موضع التمرير */
function setupSchedBloom(box, bloom) {
  const rows = () => box.querySelectorAll(".sched__row");
  const place = (p) => {
    const r = rows(); if (!r.length) return;
    const a = r[0], b = r[r.length - 1];
    const y0 = a.offsetTop + a.offsetHeight / 2, y1 = b.offsetTop + b.offsetHeight / 2;
    bloom.style.top = (y0 + (y1 - y0) * p) + "px";
  };
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { place(0.5); return; }
  place(0);
  let tick = false;
  const onScroll = () => {
    if (tick) return; tick = true;
    requestAnimationFrame(() => {
      tick = false;
      const rc = box.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight * 0.55 - rc.top) / rc.height));
      place(p);
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
}

function buildNotes(items) {
  const ul = document.getElementById("notesList"); if (!ul || !Array.isArray(items)) return; ul.innerHTML = "";
  items.forEach((txt) => { const li = document.createElement("li"); li.className = "notes__item";
    li.innerHTML = `<span class="notes__mark" aria-hidden="true">✿</span><span></span>`;
    li.querySelector("span:last-child").textContent = txt; ul.appendChild(li); });
}
function buildContact(c) {
  const link = document.getElementById("contactLink"); const label = document.querySelector(".contact__label");
  if (label && c.contactLabel) label.textContent = c.contactLabel; if (!link) return;
  const wa = (c.contactPhone || "").replace(/[^0-9]/g, "");
  if (wa) { link.href = `https://wa.me/${wa}`; link.target = "_blank"; link.rel = "noopener";
    link.innerHTML = `<span aria-hidden="true">&#9742;</span> `; link.appendChild(document.createTextNode(c.contactName ? c.contactName : c.contactPhone)); }
  else { const box = document.getElementById("contactBox"); if (box) box.style.display = "none"; }
}
function loadImages() {
  const imgs = WEDDING_CONFIG.images || {};
  if (imgs.venue) { const img = new Image(); img.onload = () => { const vp = document.getElementById("venuePhoto"); const venue = document.querySelector(".venue");
    if (vp) vp.style.backgroundImage = `url("${imgs.venue}")`; if (venue) venue.classList.add("has-photo"); }; img.src = imgs.venue; }
}

/* عدّاد */
function setupCountdown() {
  const target = new Date(WEDDING_CONFIG.date).getTime(); if (isNaN(target)) return;
  const cd = document.getElementById("countdown"), arrived = document.getElementById("cdArrived");
  const els = { d: document.getElementById("cdDays"), h: document.getElementById("cdHours"), m: document.getElementById("cdMins"), s: document.getElementById("cdSecs") };
  function tick() { const diff = target - Date.now();
    if (diff <= 0) { if (cd) cd.style.display = "none"; if (arrived) arrived.hidden = false; clearInterval(t); return; }
    els.d.textContent = pad(Math.floor(diff / 86400000)); els.h.textContent = pad(Math.floor((diff % 86400000) / 3600000));
    els.m.textContent = pad(Math.floor((diff % 3600000) / 60000)); els.s.textContent = pad(Math.floor((diff % 60000) / 1000)); }
  const t = setInterval(tick, 1000); tick();
}

/* ظهور */
function setupReveal() {
  const items = document.querySelectorAll(".creveal");
  if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("is-visible")); return; }
  const obs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  items.forEach((el) => obs.observe(el));
}

/* عناصر متحركة: بتلات بنفسجية + وميض ذهبي */
function startFx() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const pl = document.getElementById("petals");
  if (pl && !pl.dataset.on) { pl.dataset.on = "1";
    const glyphs = ["❀", "✿", "❁", "✽", "❀"]; const colors = ["#c3a1d6", "#b48fc9", "#d8c2e6", "#f0e0b4", "#c3a1d6"];
    for (let i = 0; i < 16; i++) { const s = document.createElement("span"); s.className = "petal"; s.textContent = glyphs[i % glyphs.length];
      s.style.left = Math.random() * 100 + "%"; s.style.color = colors[i % colors.length]; s.style.fontSize = (10 + Math.random() * 15) + "px";
      s.style.animationDuration = (8 + Math.random() * 7) + "s"; s.style.animationDelay = (Math.random() * 8) + "s"; pl.appendChild(s); } }
  const sp = document.getElementById("sparkles");
  if (sp && !sp.dataset.on) { sp.dataset.on = "1";
    for (let i = 0; i < 22; i++) { const s = document.createElement("span"); s.className = "spark";
      s.style.left = Math.random() * 100 + "%"; s.style.top = Math.random() * 100 + "%";
      const sz = 2 + Math.random() * 4; s.style.width = s.style.height = sz + "px";
      s.style.animationDuration = (2 + Math.random() * 3) + "s"; s.style.animationDelay = (Math.random() * 4) + "s"; sp.appendChild(s); } }
}

/* ==================== أصوات المدخل ====================
   تسجيلان قصيران (~٤٠ك.ب) يحملان الدخولية: طرقة على الخشب، والباب ينفتح.
   يُفكّ ترميزهما بالتحميل فتكون أول دقّة فورية، وتوليف الأصوات القديم يبقى
   شبكة أمان لأي متصفح يرفض فكّ الترميز — فالمدخل لا يصمت أبداً. */
let audioCtx = null;
const SFX = { knock: null, door: null };

function makeCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audioCtx = new AC(); } catch (_) { return null; }
    /* نعرض القناة للمنصّة: أول دقّة تفتحها بلمسة حقيقية، فتعزف عليها
       أغنيةُ الملف تلقائياً على آيفون بلا لمسة جديدة عند فتح الباب. */
    window.__da3waAudioCtx = audioCtx;
    /* آيفون يكتم Web Audio بزرّ الصامت الجانبي — فضيفٌ جهازه صامت لا يسمع
       الطرق ولا الصرير ولا الأغنية (بعكس إطار يوتيوب الذي يتجاهل الزرّ).
       إعلان الجلسة «playback» يخبر iOS أن هذا تشغيل وسائط لا تنبيهاً، فيمرّ
       الصوت رغم الصامت. متوفّر من iOS 16.4، ومحروسٌ بالفحص فلا يضرّ غيره. */
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch { /* غير مدعوم */ }
  }
  return audioCtx;
}

/* السياق المُنشأ قبل أي لمسة يبدأ معلّقاً: فكّ الترميز يعمل فيه،
   والتشغيل وحده يحتاج resume — وأول دقّة توفّره */
/* التوليف يطلب فتح القناة ثم يجدول الصوت باللحظة نفسها — و`resume` غير
   فوري، فالصوت الأول يُجدوَل على قناة مقفلة ويضيع. هذا سبب ضياع الدقّة
   الأولى حين تسبق فكَّ ترميز ملف الطرقة. ننتظر الفتح ثم نصدر التوليف.
   (نفس علاج playSfx بـPR #364 — فاتني المسار المُولَّف.) */
function whenLive(fn) {
  const c = makeCtx(); if (!c) return;
  if (c.state === "running") { fn(); return; }
  try { const p = c.resume(); if (p && p.then) p.then(fn, () => {}); else fn(); }
  catch { fn(); }
}

function liveCtx() {
  const c = makeCtx();
  if (c && c.state === "suspended") { try { c.resume(); } catch (_) {} }
  return c;
}

function loadSfx() {
  const c = makeCtx();
  if (!c || !window.fetch) return;
  const grab = (key, url) => fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
    .then((b) => new Promise((res, rej) => {
      /* سفاري ما زال يحتاج صيغة الاستدعاء بدوال، والمحرّكات الأحدث ترجع وعداً */
      const p = c.decodeAudioData(b, res, rej);
      if (p && p.then) p.then(res, rej);
    }))
    .then((buf) => { SFX[key] = buf; })
    .catch(() => {});
  grab("knock", "/templates/bab/assets/knock.wav");
  grab("door", "/templates/bab/assets/door-open.m4a");
}

/* ⚠️ آيفون: `resume()` غير متزامن. السياق يُنشأ قبل أي لمسة (ليُفكّ الترميز)
   فيبقى معلّقاً، وإطلاقُ العيّنة فوراً بعد `resume()` كان يضيع أحياناً —
   وهذا سبب «صوت الدقّة لا يظهر أحياناً». الآن نطلقها بعد أن يستيقظ السياق فعلاً. */
function playSfx(key, gain, rate) {
  const c = makeCtx(); const buf = SFX[key];
  if (!c || !buf) return false;
  const fire = () => {
    try {
      const src = c.createBufferSource(); src.buffer = buf;
      if (rate) src.playbackRate.value = rate;
      const g = c.createGain(); g.gain.value = gain == null ? 1 : gain;
      src.connect(g).connect(c.destination); src.start();
    } catch (_) { /* العيّنة زينة */ }
  };
  if (c.state === "running") { fire(); return true; }
  try { const p = c.resume(); if (p && p.then) p.then(fire, () => {}); else fire(); }
  catch (_) { return false; }
  return true;
}

/* الدقّة — التسجيل أولاً والتوليف شبكة أمان */
function knockSound() {
  /* انحراف نغمة طفيف كي لا تُقرأ الدقّات الثلاث عيّنةً واحدة مكرّرة */
  if (playSfx("knock", 0.92, 1 + (knocks - 1) * 0.03)) return;
  whenLive(synthKnock);
}

/* الباب ينفتح — التسجيل أولاً والتوليف شبكة أمان */
function doorOpeningSound() {
  /* ٠٫٧ لا ١: ذروة التسجيل المفكوك ١٫٣٧٦ — بكسبٍ ١ يتجاوز الحدّ فيتشوّه */
  if (playSfx("door", 0.7)) return;
  whenLive(synthDoorOpening);
}

/* صرير خشب ومزلاج — يحلّ محلّ التسجيل حيثما تعذّر فكّ ترميزه (فيديو الباب صامت) */
function synthDoorOpening() {
  try {
    const c = liveCtx(); if (!c) return;
    const t = c.currentTime;

    /* انفلات المزلاج */
    const latch = c.createOscillator(); const latchGain = c.createGain();
    latch.type = "triangle"; latch.frequency.setValueAtTime(112, t); latch.frequency.exponentialRampToValueAtTime(48, t + 0.2);
    latchGain.gain.setValueAtTime(0.34, t); latchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    latch.connect(latchGain).connect(c.destination); latch.start(t); latch.stop(t + 0.26);

    /* أنين الخشب البطيء */
    const creak = c.createOscillator(); const wobble = c.createOscillator();
    const wobbleDepth = c.createGain(); const creakFilter = c.createBiquadFilter(); const creakGain = c.createGain();
    creak.type = "sawtooth"; creak.frequency.setValueAtTime(83, t + 0.08); creak.frequency.exponentialRampToValueAtTime(43, t + 3.3);
    wobble.type = "sine"; wobble.frequency.value = 3.7; wobbleDepth.gain.value = 13;
    wobble.connect(wobbleDepth).connect(creak.frequency);
    creakFilter.type = "lowpass"; creakFilter.frequency.setValueAtTime(520, t); creakFilter.frequency.exponentialRampToValueAtTime(190, t + 3.3); creakFilter.Q.value = 2.2;
    creakGain.gain.setValueAtTime(0.001, t); creakGain.gain.linearRampToValueAtTime(0.13, t + 0.28);
    creakGain.gain.setValueAtTime(0.13, t + 2.35); creakGain.gain.exponentialRampToValueAtTime(0.001, t + 3.45);
    creak.connect(creakFilter).connect(creakGain).connect(c.destination);
    wobble.start(t + 0.08); creak.start(t + 0.08); wobble.stop(t + 3.5); creak.stop(t + 3.5);

    /* حبيبات الخشب */
    const duration = 3.25; const len = Math.floor(c.sampleRate * duration);
    const buf = c.createBuffer(1, len, c.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / len; const pulse = 0.35 + 0.65 * Math.abs(Math.sin(p * Math.PI * 7.5));
      data[i] = (Math.random() * 2 - 1) * pulse * Math.sin(Math.PI * p);
    }
    const grain = c.createBufferSource(); const grainFilter = c.createBiquadFilter(); const grainGain = c.createGain();
    grain.buffer = buf; grainFilter.type = "bandpass"; grainFilter.frequency.value = 430; grainFilter.Q.value = 0.75;
    grainGain.gain.setValueAtTime(0.001, t + 0.12); grainGain.gain.linearRampToValueAtTime(0.055, t + 0.45);
    grainGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    grain.connect(grainFilter).connect(grainGain).connect(c.destination); grain.start(t + 0.12);
  } catch (_) {}
}

/* توليف الدقّة — الاحتياطي */
function synthKnock() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.12);
    g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.18);
    const len = Math.floor(audioCtx.sampleRate * 0.06);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const bp = audioCtx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 850; bp.Q.value = 1.1;
    const g2 = audioCtx.createGain(); g2.gain.value = 0.45;
    src.connect(bp); bp.connect(g2); g2.connect(audioCtx.destination); src.start(t);
  } catch (_) {}
}

/* تحميل فيديو الهيرو عند أول دقّة — لا ينافس فيديو الباب عند فتح الصفحة،
   ويكسب مدة الدقّات وفتح الباب (~٨ ثوانٍ) ليجهز قبل الوصول للواجهة */
let heroLoading = false;
function preloadHero() {
  if (heroLoading) return; heroLoading = true;
  const hero = document.getElementById("heroVid");
  if (hero) { hero.preload = "auto"; try { hero.load(); } catch (_) {} }
}

/* الدقّات الثلاث */
let knocks = 0, opened = false;
function onKnock(e) {
  if (opened) return;
  knocks++;
  if (knocks === 1) preloadHero();
  const layer = document.getElementById("tapLayer");
  const x = (typeof e.clientX === "number" && e.clientX) || window.innerWidth / 2;
  const y = (typeof e.clientY === "number" && e.clientY) || window.innerHeight / 2;
  if (layer) {
    const r = document.createElement("span"); r.className = "tapring";
    r.style.left = x + "px"; r.style.top = y + "px";
    layer.appendChild(r); setTimeout(() => r.remove(), 760);
  }
  const cover = document.getElementById("cover");
  cover.classList.add("is-knocked"); setTimeout(() => cover.classList.remove("is-knocked"), 170);
  knockSound();
  if (navigator.vibrate) { try { navigator.vibrate(24); } catch (_) {} }
  const dots = document.querySelectorAll(".knocks__dot");
  if (dots[knocks - 1]) dots[knocks - 1].classList.add("is-hit");
  if (knocks >= 3) {
    /* ⚠️ الأغنية تُسلَّم **هنا مباشرةً** لا بمؤقّت: آيفون لا يفكّ كتم إطار
       يوتيوب إلا بأمرٍ يقع **داخل معالِج اللمسة نفسه**. وأي setTimeout — ولو
       بمللي ثانية — يخرج من سياق اللمسة فيُرفض. (المحاولة السابقة بمؤقّت
       ثانيتين كانت مبنيّة على أن العبرة بقِصَر المدّة، وهذا خطأ: العبرة
       بالبقاء داخل السياق.) والدقّة الثالثة لمسة حقيقية، فهي فرصتنا الوحيدة
       لتشغيلٍ تلقائي على آيفون بمشغّل يوتيوب. */
    startMusic();
    setTimeout(openInvite, 280);
  }
}

/* الموسيقى تُسلَّم لحظة ظهور الدعوة لا قبلها: `__da3waMusicManualStart` بأعلى
   الملف يعطّل ربط المنصّة الافتراضي بأول لمسة — بدونه كانت الأغنية تنفجر مع
   أول دقّة فتعزف فوق صوت الطرق والباب لسّه مقفل. */
function startMusic() {
  try { if (typeof window.__da3waMusicGo === "function") window.__da3waMusicGo(); } catch (_) {}
}

/* الفتح */
function reveal() {
  const cover = document.getElementById("cover"); const invite = document.getElementById("invite"); const hero = document.getElementById("heroVid");
  document.body.classList.remove("locked");
  invite.classList.add("visible"); invite.setAttribute("aria-hidden", "false");
  cover.classList.add("is-open");
  startMusic();                       /* شبكة أمان: لا أثر لها إن سبق أن انطلقت */
  if (hero) {
    const showHero = () => hero.classList.add("is-ready");
    if (hero.readyState >= 2) showHero();
    ["loadeddata", "canplay", "playing"].forEach((e) => hero.addEventListener(e, showHero));
    hero.play().catch(() => {});
  }
  document.querySelectorAll(".stage__inner .sreveal").forEach((el, i) => setTimeout(() => el.classList.add("is-in"), 150 + i * 45));
  setupReveal(); startFx();
  setTimeout(() => { cover.style.display = "none"; }, 1300);
}

/* دفّتا الباب تبقيان مقفلتين أول لحظة من door.mp4 ولا تبدآن بالانفتاح إلا عند
   ~١٫٣ ثانية — فصوت الفتح يُوقَّت على ساعة الفيديو نفسه لا على لحظة play()،
   وإلا صرَّ الباب وهو ما زال مغلقاً. */
const DOOR_SFX_AT = 1.3;

function openInvite() {
  if (opened) return; opened = true;
  const cover = document.getElementById("cover"); const vid = document.getElementById("doorVid");
  cover.classList.add("is-playing"); cover.style.cursor = "default";
  let swung = false;
  const swing = () => { if (swung) return; swung = true; doorOpeningSound(); };
  let done = false; const finish = () => { if (done) return; done = true; reveal(); };
  if (vid) {
    vid.addEventListener("timeupdate", () => { if (vid.currentTime >= DOOR_SFX_AT) swing(); });
    vid.addEventListener("ended", finish, { once: true });
    const p = vid.play();
    /* إذا رفض الفيديو التشغيل أصلاً فالصوت هو الإشارة الوحيدة — أطلقه الآن */
    if (p && p.catch) p.catch(() => { swing(); setTimeout(finish, 400); });
    const dur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 5;
    setTimeout(swing, (DOOR_SFX_AT + 0.9) * 1000);   /* احتياطي: timeupdate قد يتعثّر */
    setTimeout(finish, dur * 1000 + 600);
  } else { swing(); finish(); }
}

/* تشغيل */
fillContent(); loadImages(); setupCountdown(); loadSfx();
(function bind() {
  const cover = document.getElementById("cover");
  if (cover) cover.addEventListener("pointerdown", onKnock);
  if (/[?&]autoopen=1/.test(location.search)) { preloadHero(); setTimeout(openInvite, 800); }
})();
