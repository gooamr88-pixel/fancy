/* ============================================================
   المسرح المخملي — Velvet Theater Engagement (ring-A)
   script.js — config, fill, box-open choreography, particles
   ============================================================ */

const WEDDING_CONFIG = (typeof window!=="undefined" && window.__INVITE__ && window.__INVITE__.config) || {
  occasion: "engagement",

  // ===== الأساسيات =====
  groom: "اسم الخطيب",
  bride: "اسم الخطيبة",

  // تاريخ ووقت الحفل: YYYY-MM-DDTHH:MM:SS — لازم مستقبلي
  date: "2026-12-18T19:00:00",
  dateText: "يوم الجمعة، ١٨ كانون الأول ٢٠٢٦",
  timeText: "الساعة السابعة مساءً",

  heroSub: "يتشرّفان بدعوتكم لمشاركتهما فرحة الخطوبة",

  // ===== دعاء افتتاحي =====
  verse: "على بركة الله، وبأطيب الأمنيات، تمّت الخطوبة",

  // ===== نص الدعوة الرسمي =====
  invitationText: "بقلوبٍ مفعمةٍ بالفرح، نتشرّف بدعوتكم لحضور حفل خطوبتنا.",

  // ===== أهل الخطيبين =====
  groomParents: "نجل السيّد … والسيّدة …",
  brideParents: "كريمة السيّد … والسيّدة …",

  // ===== القاعة =====
  venueName: "قاعة الياقوت للمناسبات",
  venueAddr: "بغداد — شارع الكرادة",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=Baghdad",

  // ===== برنامج الحفل =====
  program: [
    { time: "٧:٠٠ مساءً", title: "استقبال الضيوف" },
    { time: "٨:٠٠ مساءً", title: "مراسم الخطوبة وتبادل الخواتم" },
    { time: "٩:٠٠ مساءً", title: "العشاء" },
    { time: "١٠:٠٠ مساءً", title: "السهرة والتهاني" },
  ],

  // ===== ملاحظات =====
  notes: [
    "يُرجى الحضور قبل الموعد بنصف ساعة",
    "نتشرّف بحضوركم بأبهى حلّة",
    "الدعوة تشمل حاملها والعائلة الكريمة",
  ],

  // ===== الخاتمة =====
  closingNote: "حضوركم يزيّن فرحتنا",
  hashtag: "#خطوبتنا",
  contactLabel: "للاستفسار والتأكيد",
  contactName: "للتواصل",
  contactPhone: "+9647700000000",   // رقم وهمي للمعاينة — الرقم الحقيقي يأتي من إعدادات الدعوة فقط
  closingFamilies: "عائلتا الخطيبين",

  // ===== الصور (اختياري) =====
  images: {
    hero: "",         // صورة الخطيبين المؤطّرة في الواجهة
    background: "",   // خلفية الغلاف بحواف متلاشية
  },
};

(function () {
  "use strict";

  var C = WEDDING_CONFIG;
  var REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function setText(id, val) { var el = $(id); if (el && val != null && val !== "") el.textContent = val; }

  var AR_DIGITS = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
  function toArabicDigits(n) {
    return String(n).replace(/[0-9]/g, function (d) { return AR_DIGITS[+d]; });
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  /* ---------------- fill content (textContent only) ---------------- */
  function fillContent() {
    setText("groomName", C.groom);
    setText("brideName", C.bride);
    setText("coverNames", (C.groom || "") + " & " + (C.bride || ""));
    setText("heroSub", C.heroSub);
    setText("heroDate", C.dateText);
    setText("verseText", C.verse);
    setText("invitationText", C.invitationText);
    setText("groomParents", C.groomParents);
    setText("brideParents", C.brideParents);
    setText("weddingDate", C.dateText);
    setText("weddingTime", C.timeText);
    setText("venueName", C.venueName);
    setText("venueAddr", C.venueAddr);
    setText("closingNote", C.closingNote);
    setText("closingHashtag", C.hashtag);
    setText("closingFamilies", C.closingFamilies);
    setText("contactLabel", C.contactLabel);

    document.title = "دعوة خطوبة " + (C.groom || "") + " & " + (C.bride || "");

    var mapBtn = $("mapBtn");
    if (mapBtn) {
      if (C.mapUrl) { mapBtn.href = C.mapUrl; }
      else { mapBtn.style.display = "none"; }
    }

    /* contact: tel: link — skip section entirely when phone empty */
    var contactBox = $("contactBox");
    var contactLink = $("contactLink");
    var digits = C.contactPhone ? String(C.contactPhone).replace(/[^\d+]/g, "") : "";
    if (digits && contactLink) {
      contactLink.href = "tel:" + digits;
      setText("contactPhoneText", C.contactPhone);
      setText("contactName", C.contactName || C.contactLabel);
    } else if (contactBox) {
      contactBox.style.display = "none";
    }

    buildTimeline(C.program);
    buildNotes(C.notes);
    loadImages();
  }

  /* program/notes arrive server-escaped — same handling as rosegold */
  function buildTimeline(items) {
    var ul = $("timeline");
    if (!ul || !Array.isArray(items)) return;
    ul.innerHTML = "";
    items.forEach(function (it) {
      if (!it) return;
      var li = document.createElement("li");
      li.className = "tl-item";
      var dot = document.createElement("span");
      dot.className = "tl-dot";
      dot.setAttribute("aria-hidden", "true");
      var time = document.createElement("span");
      time.className = "tl-time";
      time.textContent = it.time || "";
      var title = document.createElement("span");
      title.className = "tl-title";
      title.textContent = it.title || "";
      li.appendChild(dot); li.appendChild(time); li.appendChild(title);
      ul.appendChild(li);
    });
    if (!items.length) {
      var card = ul.closest(".timeline-card");
      if (card) card.style.display = "none";
    }
  }

  function buildNotes(items) {
    var ul = $("notesList");
    if (!ul || !Array.isArray(items)) return;
    ul.innerHTML = "";
    items.forEach(function (txt) {
      if (!txt) return;
      var li = document.createElement("li");
      var span = document.createElement("span");
      span.textContent = txt;
      li.appendChild(span);
      ul.appendChild(li);
    });
    if (!items.length) {
      var card = ul.closest(".notes-card");
      if (card) card.style.display = "none";
    }
  }

  /* ---------------- image hooks (shown only on successful load) ---------------- */
  function loadImages() {
    var imgs = C.images || {};

    /* cover background — feathered radial mask on the wrapper */
    var coverBg = $("coverBg");
    if (coverBg && imgs.background) {
      var bgImg = coverBg.querySelector("img.bg-photo");
      if (bgImg) {
        bgImg.onload = function () { bgImg.classList.add("is-shown"); };
        bgImg.onerror = function () { bgImg.classList.remove("is-shown"); };
        bgImg.src = imgs.background;
      }
    }

    /* framed couple photo in the hero */
    var box = $("heroPhoto");
    var im = $("heroPhotoImg");
    if (box && im && imgs.hero) {
      im.onload = function () { box.hidden = false; };
      im.onerror = function () { box.hidden = true; };
      im.src = imgs.hero;
    }
  }

  /* ---------------- countdown (Arabic-Indic digits) ---------------- */
  function setupCountdown() {
    var target = C.date ? new Date(C.date) : null;
    if (!target || isNaN(target.getTime())) return;
    var els = { d: $("cdDays"), h: $("cdHours"), m: $("cdMins"), s: $("cdSecs") };
    var cd = $("countdown"), arrived = $("cdArrived");
    function tick() {
      var diff = target.getTime() - Date.now();
      if (diff <= 0) {
        if (cd) cd.style.display = "none";
        if (arrived) arrived.hidden = false;
        clearInterval(timer);
        return;
      }
      var s = Math.floor(diff / 1000);
      var d = Math.floor(s / 86400); s -= d * 86400;
      var h = Math.floor(s / 3600);  s -= h * 3600;
      var m = Math.floor(s / 60);    s -= m * 60;
      if (els.d) els.d.textContent = toArabicDigits(pad2(d));
      if (els.h) els.h.textContent = toArabicDigits(pad2(h));
      if (els.m) els.m.textContent = toArabicDigits(pad2(m));
      if (els.s) els.s.textContent = toArabicDigits(pad2(s));
    }
    var timer = setInterval(tick, 1000);
    tick();
  }

  /* ============================================================
     PARTICLE ENGINE — one fixed layer, pooled, hard cap
     ============================================================ */
  var MAX_LIVE = 40;
  var live = 0;
  var fxLayer = null;

  function ensureLayer() {
    if (fxLayer) return fxLayer;
    fxLayer = document.createElement("div");
    fxLayer.className = "fx-layer";
    fxLayer.setAttribute("aria-hidden", "true");
    document.body.appendChild(fxLayer);
    return fxLayer;
  }

  /* spawn one particle; kind: twinkle | spark | petal | heart */
  function spawnFx(kind, x, y, opts) {
    if (REDUCED || live >= MAX_LIVE) return;
    opts = opts || {};
    var el = document.createElement("span");
    el.className = "fx fx-" + kind;
    el.style.setProperty("--x", x + "px");
    el.style.setProperty("--y", y + "px");
    if (opts.tx != null) el.style.setProperty("--tx", opts.tx + "px");
    if (opts.ty != null) el.style.setProperty("--ty", opts.ty + "px");
    if (opts.dur) el.style.animationDuration = opts.dur + "s";
    if (opts.scale) el.style.width = el.style.height = opts.scale + "px";
    live++;
    el.addEventListener("animationend", function () {
      live--;
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    ensureLayer().appendChild(el);
  }

  /* burst of gold sparks radiating from a point */
  function burstSparks(x, y, count, spread) {
    for (var i = 0; i < count; i++) {
      var a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      var r = (spread || 90) * (0.55 + Math.random() * 0.65);
      spawnFx("spark", x, y, { tx: x + Math.cos(a) * r, ty: y + Math.sin(a) * r * 0.85 - 24 });
    }
  }

  /* falling rose petals from the top of a point */
  function burstPetals(x, y, count) {
    for (var i = 0; i < count; i++) {
      var sx = x + (Math.random() - 0.5) * 140;
      spawnFx("petal", sx, y - 30 - Math.random() * 40, {
        tx: sx + (Math.random() - 0.5) * 120,
        ty: y + 180 + Math.random() * 160,
        dur: 2.2 + Math.random() * 1.6,
      });
    }
  }

  /* hearts + twinkles for the emblem easter egg */
  function burstHearts(x, y) {
    var n = 6 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
      var a = -Math.PI * (0.15 + Math.random() * 0.7);
      var r = 46 + Math.random() * 60;
      var kind = i % 3 === 2 ? "twinkle" : "heart";
      spawnFx(kind, x, y, { tx: x + Math.cos(a) * r, ty: y + Math.sin(a) * r, dur: 1 + Math.random() * 0.5 });
    }
  }

  /* ---------------- sparkle trail across the whole page ---------------- */
  function setupTrail() {
    if (REDUCED) return;
    var last = 0, lastX = -99, lastY = -99;
    function onMove(e) {
      var now = Date.now();
      if (now - last < 90) return;
      var p = e.touches ? e.touches[0] : e;
      if (!p) return;
      /* movement gate: no spark clusters when the finger rests or micro-jitters */
      var dx = p.clientX - lastX, dy = p.clientY - lastY;
      if (dx * dx + dy * dy < 220) return;
      /* keep the reading cards clean — sparkle only over the velvet */
      if (e.target && e.target.closest && e.target.closest(".card")) return;
      last = now; lastX = p.clientX; lastY = p.clientY;
      spawnFx("twinkle", p.clientX + (Math.random() - 0.5) * 14, p.clientY + (Math.random() - 0.5) * 14,
        { scale: 6 + Math.random() * 7 });
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
  }

  /* ---------------- occasional drifting petals (ambient) ---------------- */
  function setupAmbientPetals() {
    if (REDUCED) return;
    setInterval(function () {
      if (document.hidden || live > MAX_LIVE - 10) return;
      var x = Math.random() * window.innerWidth;
      spawnFx("petal", x, -20, {
        tx: x + (Math.random() - 0.5) * 160,
        ty: window.innerHeight + 40,
        dur: 7 + Math.random() * 4,
      });
    }, 3800);
  }

  /* ============================================================
     BOX-OPEN CHOREOGRAPHY
     tap → shiver + clasp → lid swings back on its hinge (1.7s)
     → warm light spills → ring rises & turns → sparkle + petal
     burst → cover cross-fades to the hero
     ============================================================ */
  function setupOpen() {
    var cover = $("cover");
    var invite = $("invite");
    var btn = $("openBtn");
    if (!cover || !invite || !btn) return;
    var opened = false;

    /* سخّن مشهد الكشف مسبقاً حتى يكون التبديل لحظياً */
    var warm = new Image();
    warm.src = "/templates/ring/assets/box-open.jpg";

    function finish() {
      cover.classList.add("is-done");
      document.body.classList.remove("locked");
      invite.setAttribute("aria-hidden", "false");
      window.scrollTo(0, 0);
      var hero = document.querySelector(".hero.reveal");
      if (hero) hero.classList.add("is-visible");
      setTimeout(function () {
        if (cover.parentNode) cover.parentNode.removeChild(cover);
      }, 1300);
    }

    /* مشهد الوميض الفوتوغرافي — الخطة البديلة إذا لم يعمل الفيديو */
    function photoFallback() {
      var w = window.innerWidth, h = window.innerHeight;
      var cx = w * 0.5, cy = h * 0.55;
      cover.classList.add("is-arming");
      setTimeout(function () { cover.classList.add("is-flash"); }, 650);
      setTimeout(function () {
        cover.classList.add("is-revealed");
        burstSparks(cx, cy - 40, 16, 150);
        burstPetals(cx, cy - 30, 10);
      }, 1000);
      setTimeout(function () { burstSparks(cx, cy - 70, 8, 95); }, 2800);
      setTimeout(finish, 3800);
    }

    function openInvite() {
      if (opened) return;
      var vg = $("boxVideo");
      if (vg && !vg.dataset.ready) return;   /* انتظر جهوزية الفيديو قبل فتح المشهد */
      opened = true;
      cover.classList.add("is-open");

      var w = window.innerWidth, h = window.innerHeight;
      var cx = w * 0.5, cy = h * 0.55;   /* موضع الصندوق في المشهد */

      if (REDUCED) {
        cover.classList.add("is-revealed");
        setTimeout(finish, 700);
        return;
      }

      var vid = $("boxVideo");
      if (!vid) { photoFallback(); return; }

      var done = false, started = false, fellBack = false;
      var watchdog = null;
      function reveal() {
        if (done || fellBack) return;
        done = true;
        if (watchdog) clearInterval(watchdog);
        burstSparks(cx, cy - 40, 16, 150);
        burstPetals(cx, cy - 30, 10);
        finish();   /* الذوبان إلى الدعوة قبل نزول المطر الذهبي */
      }
      function fallBack() {
        if (done || started || fellBack) return;
        fellBack = true;
        if (watchdog) clearInterval(watchdog);
        cover.classList.remove("is-playing");
        try { vid.pause(); } catch (e) { /* لا شيء */ }
        photoFallback();
      }

      /* استجابة فورية ملموسة (توهج) + رسالة تحضير إن طال تحميل الفيديو */
      cover.classList.add("is-arming");
      var hint = $("hintLabel");
      var hintTimer = setTimeout(function () {
        if (!started && !fellBack && hint) hint.textContent = "✨ يجهَّز المشهد…";
      }, 900);

      /* .play() داخل لمسة المستخدم مباشرة — يتجاوز وضع توفير البطارية.
         حتى لو تأخر التخزين المؤقت، التشغيل يبدأ تلقائياً فور جاهزيته */
      var p = vid.play();
      if (p && p.catch) p.catch(function () { fallBack(); });
      vid.addEventListener("error", fallBack);

      /* لا نُظهر الفيديو إلا مع أول إطارات حقيقية — لا وميض أسود أثناء التحميل */
      function begin() {
        if (started || done || fellBack) return;
        started = true;
        clearTimeout(hintTimer);
        cover.classList.add("is-playing");
        /* الكشف عندما يبدأ البريق الذهبي بالنزول (~4.35 ث) أو عند نهاية الفيديو.
           كاشف تعليق بساعة حقيقية: أقل من 0.15 ث تقدّم خلال ≥1.7 ث حقيقية = متجمّد */
        var hist = [];
        watchdog = setInterval(function () {
          var t = vid.currentTime;
          if (t >= 4.35) { reveal(); return; }
          var now = Date.now();
          hist.push({ tm: now, t: t });
          while (hist.length && now - hist[0].tm > 2100) hist.shift();
          if (t > 0.2 && hist.length && now - hist[0].tm >= 1700 && (t - hist[0].t) < 0.15) reveal();
        }, 120);
      }
      vid.addEventListener("playing", begin);
      vid.addEventListener("timeupdate", function () { if (vid.currentTime > 0.05) begin(); });
      vid.addEventListener("ended", reveal);

      /* لم يبدأ إطلاقاً خلال 6 ثوانٍ (شبكة بطيئة جداً أو جهاز رافض) → المشهد الفوتوغرافي */
      setTimeout(fallBack, 6000);
      /* سقف مطلق من اللمسة: لا يعلق أي ضيف مهما حدث */
      setTimeout(function () { if (!fellBack) reveal(); }, 14000);
    }

    btn.addEventListener("click", openInvite);
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openInvite(); }
    });
  }

  /* ---------------- ring emblem easter egg ---------------- */
  function setupEmblem() {
    var emblem = $("ringEmblem");
    if (!emblem) return;
    emblem.addEventListener("click", function () {
      var r = emblem.getBoundingClientRect();
      burstHearts(r.left + r.width / 2, r.top + r.height / 2);
    });
  }

  /* ---------------- scroll reveal ---------------- */
  function setupReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.13, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    /* حمّل الفيديو فوراً واقفل اللمس حتى يجهز — كي يعمل المشهد عند الضغط (لا «يجهَّز المشهد») */
    var bv = $("boxVideo");
    if (bv) {
      try { bv.load(); } catch (e) { /* لا شيء */ }
      var hintEl0 = $("hintLabel");
      if (hintEl0) hintEl0.textContent = "جارٍ التحميل…";
      var markReady = function () {
        if (bv.dataset.ready) return;
        bv.dataset.ready = "1";
        var co = $("cover"), h = $("hintLabel");
        if (h && !(co && co.classList.contains("is-open"))) h.textContent = "المس الصندوق";
      };
      if (bv.readyState >= 3) markReady();
      else { bv.addEventListener("canplaythrough", markReady); bv.addEventListener("canplay", markReady); }
      setTimeout(markReady, 7000);   /* أمان: فعّل اللمس بعد ٧ ثوانٍ مهما حدث */
    }
    fillContent();
    setupCountdown();
    setupOpen();
    setupEmblem();
    setupReveal();
    setupTrail();
    setupAmbientPetals();
  });
})();
