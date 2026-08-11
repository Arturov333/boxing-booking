/* ============================================================
   PREMIUM LAYER (motion) — ARTUR Performance Club
   Progressive enhancement. НЕ чіпає Firebase-запис і адмінку.
   Якщо цей файл не завантажиться — сайт лишається видимим і робочим.
   Легко відкотити: прибрати <script src="premium.js"> з index.html.
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // GSAP scroll-cinema (локально). Якщо GSAP не завантажився або
  // reduced-motion — hasST=false і працює наявний rAF/IO-шар.
  var GSAP = window.gsap, ST = window.ScrollTrigger;
  var hasST = !!(GSAP && ST && !reduce);
  if (hasST) {
    try { GSAP.registerPlugin(ST); ST.config({ ignoreMobileResize: true }); }
    catch (e) { hasST = false; }
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /* --- Атмосферні full-bleed фони окремих секцій -------------
     ТІЛЬКИ власні матеріали (кадри галереї / фото тренера).
     Якщо файл відсутній — браузер просто не покаже картинку. */
  var SECTION_BG = {
    about:         "assets/bg/about.jpg?v=4",
    pricing:       "assets/bg/pricing.jpg?v=4",
    "booking-start": "assets/bg/cta.jpg?v=4",
    contacts:      "assets/bg/contacts.jpg?v=4"
  };

  function injectSectionBackgrounds() {
    Object.keys(SECTION_BG).forEach(function (id) {
      var sec = document.getElementById(id);
      if (!sec) return;
      // sec-booking — окрема секція перед кроками; підсвітимо її блок
      sec.classList.add("pm-has-bg");
      var bg = document.createElement("div");
      bg.className = "pm-section-bg";
      bg.setAttribute("aria-hidden", "true");
      bg.style.setProperty("--pm-img", "url('" + SECTION_BG[id] + "')");
      sec.insertBefore(bg, sec.firstChild);
    });
  }

  /* --- Смуга scroll-прогресу --------------------------------- */
  function injectProgressBar() {
    var bar = document.createElement("div");
    bar.className = "pm-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop || window.pageYOffset) / max : 0;
      bar.style.width = (p * 100).toFixed(2) + "%";
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* --- 3D-атмосфера збоку hero: золоті іскри + світлові промені --- */
  function injectHeroFx() {
    var media = document.querySelector(".hero-media");
    if (!media || media.querySelector(".pm-hero-fx")) return;
    var fx = document.createElement("div");
    fx.className = "pm-hero-fx";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML = '<span class="pm-fx-glow g1"></span><span class="pm-fx-glow g2"></span>';
    var N = reduce ? 0 : (finePointer ? 24 : 12);
    for (var i = 0; i < N; i++) {
      var e = document.createElement("i");
      e.className = "pm-ember";
      var x = Math.random() * 100;
      var size = 2 + Math.random() * 4.5;
      var dur = 7 + Math.random() * 9;
      var delay = -Math.random() * dur;
      var depth = Math.random();
      e.style.cssText =
        "left:" + x.toFixed(2) + "%;" +
        "width:" + size.toFixed(1) + "px;height:" + size.toFixed(1) + "px;" +
        "animation-duration:" + dur.toFixed(1) + "s;animation-delay:" + delay.toFixed(1) + "s;" +
        "opacity:" + (0.25 + depth * 0.5).toFixed(2) + ";" +
        "filter:blur(" + ((1 - depth) * 1.6).toFixed(1) + "px);" +
        "--pm-z:" + Math.round(depth * 44) + "px;";
      fx.appendChild(e);
    }
    media.insertBefore(fx, media.firstChild);
  }

  /* --- Immersive-відео обабіч героя (з папки Я: 14 зліва, 9 справа) --- */
  function injectHeroSides() {
    var media = document.querySelector(".hero-media");
    var header = document.querySelector(".site-header");
    var content = header && header.querySelector(".header-inner");
    if (!media || !header || header.querySelector(".pm-hero-side")) return;
    function mk(cls, src, poster) {
      var wrap = document.createElement("div");
      wrap.className = "pm-hero-side " + cls;
      wrap.setAttribute("aria-hidden", "true");
      var v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute("muted", ""); v.setAttribute("loop", "");
      v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
      v.setAttribute("preload", "auto"); v.setAttribute("poster", poster);
      v.src = src;
      wrap.appendChild(v);
      if (content) header.insertBefore(wrap, content); else header.appendChild(wrap); // над veil, під контентом
      return v;
    }
    var vl = mk("left", "assets/hero-left.mp4", "assets/hero-left.jpg");
    var vr = mk("right", "assets/hero-right.mp4", "assets/hero-right.jpg");
    function play(v) { if (!reduce) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
    play(vl); play(vr);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { play(vl); play(vr); }
          else { try { vl.pause(); vr.pause(); } catch (x) {} }
        });
      }, { threshold: 0 }).observe(media);
    }
  }

  /* --- Відео-«рибки»: маленькі кліпи, що плавають обабіч героя --- */
  function injectHeroFish() {
    var header = document.querySelector(".site-header");
    if (!header || header.querySelector(".pm-sticker-layer")) return;
    var DIR = "assets/fish/";
    var files = ["f1.mp4", "f2.mp4", "f3.mp4", "f4.mp4", "f5.mp4", "f6.mp4"];
    var sideArr = ["l", "r", "l", "r", "l", "r"];
    var sizes = [130, 112, 142, 120, 134, 116];
    var layer = document.createElement("div");
    layer.className = "pm-sticker-layer";
    layer.setAttribute("aria-hidden", "true");
    header.appendChild(layer);
    var els = files.map(function (f, i) {
      var s = document.createElement("div");
      s.className = "pm-sticker pm-phys pm-fish";
      s.style.cssText = "left:0;top:0;visibility:hidden;touch-action:none;cursor:grab;--pm-psz:" + sizes[i] + "px;";
      var v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute("muted", ""); v.setAttribute("loop", "");
      v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
      v.setAttribute("preload", "auto");
      v.src = DIR + f;
      s.appendChild(v);
      s.__side = sideArr[i];
      layer.appendChild(s);
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      return s;
    });
    if (els.length) setupStickerPhysics(layer, els);
    if ("IntersectionObserver" in window) {
      var vids = layer.querySelectorAll("video");
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          Array.prototype.forEach.call(vids, function (v) {
            if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
            else { try { v.pause(); } catch (x) {} }
          });
        });
      }, { threshold: 0 }).observe(header);
    }
  }

  /* --- Hero sticker-wall: Nike-стайл бокс-колаж (без реальних людей) --- */
  function injectHeroStickers() {
    var header = document.querySelector(".site-header");
    if (!header || header.querySelector(".pm-sticker-layer")) return;

    var DIR = "assets/stickers/";
    // t: 'd' = GPT-виріз (пояс/медаль/кубок...), 'p' = кругле фото-медальйон із папки Я.
    // Збалансовано по боках: медалі на РІЗНИХ боках, декалі й фото чергуються.
    var items = [
      { f: "belt.png",   t: "d", side: "l", sz: 132 },
      { f: "ph1.jpg",    t: "p", side: "l", sz: 92 },
      { f: "medal1.png", t: "d", side: "l", sz: 112 },
      { f: "ph2.jpg",    t: "p", side: "l", sz: 86 },
      { f: "trophy.png", t: "d", side: "l", sz: 128 },
      { f: "ph3.jpg",    t: "p", side: "l", sz: 96 },
      { f: "ring.png",   t: "d", side: "r", sz: 124 },
      { f: "ph4.jpg",    t: "p", side: "r", sz: 92 },
      { f: "medal2.png", t: "d", side: "r", sz: 110 },
      { f: "ph5.jpg",    t: "p", side: "r", sz: 86 },
      { f: "gloves.png", t: "d", side: "r", sz: 104 },
      { f: "ph6.jpg",    t: "p", side: "r", sz: 96 }
    ];

    var layer = document.createElement("div");
    layer.className = "pm-sticker-layer";
    layer.setAttribute("aria-hidden", "true");
    header.appendChild(layer);

    var els = items.map(function (it) {
      var s = document.createElement("div");
      s.className = "pm-sticker pm-phys";
      s.style.cssText = "left:0;top:0;visibility:hidden;touch-action:none;cursor:grab;--pm-psz:" + it.sz + "px;";
      s.innerHTML = '<img class="' + (it.t === "d" ? "pm-decal" : "pm-photo-badge") +
        '" src="' + DIR + it.f + '" alt="" draggable="false">';
      s.__side = it.side;
      layer.appendChild(s);
      return s;
    });
    if (els.length) setupStickerPhysics(layer, els);
  }

  /* --- Фізика наклейок: 3D дрейф + перетягування + кидок + відштовхування курсором --- */
  function setupStickerPhysics(host, els) {
    var YTOP = 110; // не залазити на верхню панель (лого/тема/Тренер)
    function rel(el) {
      var a = el.getBoundingClientRect(), b = host.getBoundingClientRect();
      return { left: a.left - b.left, right: a.right - b.left, top: a.top - b.top, bottom: a.bottom - b.top, cx: (a.left + a.right) / 2 - b.left };
    }
    var W = host.clientWidth, H = host.clientHeight;
    var video = document.querySelector(".hero-video");
    var leftN = els.filter(function (e) { return e.__side === "l"; }).length;
    var rightN = els.length - leftN;
    var li = 0, ri = 0;
    var st = els.map(function (s) {
      s.style.visibility = "";
      var w = s.offsetWidth || 90, h = s.offsetHeight || 90;
      var vr = video ? rel(video) : null;
      var isL = s.__side === "l";
      var idx = isL ? li++ : ri++, cnt = isL ? leftN : rightN;
      var slot = (H - YTOP - 24) / Math.max(cnt, 1);
      var y = YTOP + idx * slot + Math.random() * Math.max(slot - h, 8);
      var x;
      if (isL) x = 8 + Math.random() * Math.max((vr ? vr.left : W * 0.28) - w - 14, 8);
      else { var rs = vr ? vr.right : W * 0.72; x = rs + 8 + Math.random() * Math.max(W - rs - w - 14, 8); }
      return { s: s, x: x, y: y, w: w, h: h, vx: (Math.random() - 0.5) * 0.7, vy: (Math.random() - 0.5) * 0.7, rot: (Math.random() - 0.5) * 20, vr: (Math.random() - 0.5) * 0.3, z: ((Math.random() - 0.5) * 70) | 0, drag: false };
    });
    // початкові позиції синхронно (щоб не збилися в кут, якщо rAF на паузі)
    st.forEach(function (o) { o.s.style.transform = "translate3d(" + o.x.toFixed(1) + "px," + o.y.toFixed(1) + "px," + o.z + "px) rotate(" + o.rot.toFixed(1) + "deg)"; });
    var mouse = { x: -1e4, y: -1e4, on: false }, dragging = null, off = { x: 0, y: 0 }, last = { x: 0, y: 0 }, topZ = 10;

    els.forEach(function (s, i) {
      s.addEventListener("pointerdown", function (e) {
        dragging = st[i]; dragging.drag = true; dragging.vx = dragging.vy = 0;
        var r = host.getBoundingClientRect();
        off.x = (e.clientX - r.left) - dragging.x; off.y = (e.clientY - r.top) - dragging.y;
        last.x = e.clientX; last.y = e.clientY;
        try { s.setPointerCapture(e.pointerId); } catch (er) {}
        s.style.cursor = "grabbing"; s.style.zIndex = ++topZ;
        e.preventDefault();
      });
      s.addEventListener("pointermove", function (e) {
        if (!dragging || dragging.s !== s) return;
        var r = host.getBoundingClientRect();
        dragging.x = (e.clientX - r.left) - off.x; dragging.y = (e.clientY - r.top) - off.y;
        dragging.vx = e.clientX - last.x; dragging.vy = e.clientY - last.y;
        last.x = e.clientX; last.y = e.clientY;
      });
      var release = function () { if (dragging === st[i]) { st[i].drag = false; s.style.cursor = "grab"; dragging = null; } };
      s.addEventListener("pointerup", release);
      s.addEventListener("pointercancel", release);
    });
    host.addEventListener("pointermove", function (e) { var r = host.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true; });
    host.addEventListener("pointerleave", function () { mouse.on = false; });
    window.addEventListener("resize", function () { W = host.clientWidth; H = host.clientHeight; }, { passive: true });

    if (reduce) { st.forEach(function (o) { o.s.style.transform = "translate3d(" + o.x + "px," + o.y + "px,0) rotate(" + o.rot + "deg)"; }); return; }

    function frame() {
      var vr = video ? rel(video) : null;
      st.forEach(function (o) {
        if (!o.drag) {
          if (mouse.on) {
            var dx = (o.x + o.w / 2) - mouse.x, dy = (o.y + o.h / 2) - mouse.y, d2 = dx * dx + dy * dy;
            if (d2 < 17000 && d2 > 1) { var d = Math.sqrt(d2), f = (1 - d / 130) * 1.6; o.vx += (dx / d) * f; o.vy += (dy / d) * f; }
          }
          o.vx += (Math.random() - 0.5) * 0.05; o.vy += (Math.random() - 0.5) * 0.05;
          if (vr && o.x + o.w > vr.left - 4 && o.x < vr.right + 4 && o.y + o.h > vr.top && o.y < vr.bottom) {
            o.vx += ((o.x + o.w / 2) < vr.cx ? -0.75 : 0.75);
          }
          o.x += o.vx; o.y += o.vy; o.vx *= 0.95; o.vy *= 0.95; o.rot += o.vr; o.vr *= 0.95;
          if (o.x < 0) { o.x = 0; o.vx = Math.abs(o.vx) * 0.5; }
          if (o.x > W - o.w) { o.x = W - o.w; o.vx = -Math.abs(o.vx) * 0.5; }
          if (o.y < YTOP) { o.y = YTOP; o.vy = Math.abs(o.vy) * 0.5; }
          if (o.y > H - o.h) { o.y = H - o.h; o.vy = -Math.abs(o.vy) * 0.5; }
        }
        var ry = Math.max(-16, Math.min(16, o.vx * 3)), rx = Math.max(-16, Math.min(16, -o.vy * 3));
        o.s.style.transform = "translate3d(" + o.x.toFixed(1) + "px," + o.y.toFixed(1) + "px," + o.z + "px) rotateY(" + ry.toFixed(1) + "deg) rotateX(" + rx.toFixed(1) + "deg) rotate(" + o.rot.toFixed(1) + "deg)";
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* --- Achievement-плашки під героєм ------------------------- */
  function injectHeroBadges() {
    var host = document.querySelector(".hero-center");
    if (!host) return;
    var badges = [
      { t: "10+ років досвіду" },
      { t: "Змагальний рівень" },
      { t: "1-на-1 у Львові" }
    ];
    var wrap = document.createElement("div");
    wrap.className = "pm-hero-badges";
    wrap.setAttribute("aria-hidden", "true");
    var check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    badges.forEach(function (b) {
      var el = document.createElement("span");
      el.className = "pm-hero-badge";
      el.innerHTML = check + "<span>" + b.t + "</span>";
      wrap.appendChild(el);
    });
    // одразу після мантри-тікера, якщо він поруч, інакше в кінці hero-center
    host.appendChild(wrap);
  }

  /* --- Scroll-reveal зі стаґером ----------------------------- */
  function setupReveal() {
    var targets = [];
    // КОЖЕН БЛОК: ціла секція/крок — надійний IO+CSS reveal (працює і без GSAP)
    document.querySelectorAll("#client-view > .sec, #client-view > .step")
      .forEach(function (n) { targets.push(n); });

    if (!("IntersectionObserver" in window) || reduce) {
      targets.forEach(function (n) { n.classList.add("pm-in"); });
      return;
    }
    targets.forEach(function (n) { n.classList.add("pm-reveal"); });

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("pm-in");
          obs.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    targets.forEach(function (n) { obs.observe(n); });
    // Backstop — гарантія, що блоки НЕ лишаться прихованими (показати ті, що у в'юпорті)
    function revealInView() {
      var vh = window.innerHeight || document.documentElement.clientHeight || 800;
      targets.forEach(function (n) {
        if (n.classList.contains("pm-in")) return;
        var r = n.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) { n.classList.add("pm-in"); obs.unobserve(n); }
      });
    }
    window.addEventListener("scroll", revealInView, { passive: true });
    window.addEventListener("load", revealInView);
    setTimeout(revealInView, 600);
  }

  /* --- Count-up для статистики ------------------------------- */
  function setupCounters() {
    if (reduce || !("IntersectionObserver" in window)) return;
    var nums = document.querySelectorAll(".stat-num, .astat-num");
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        countUp(en.target);
        obs.unobserve(en.target);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { obs.observe(n); });
  }

  function countUp(node) {
    var raw = node.textContent.trim();
    // Працюємо лише з провідним цілим числом (напр. "10+", "6", "2").
    var m = raw.match(/^(\d+)(.*)$/);
    if (!m) return;                 // "1:1" тощо — лишаємо як є
    var target = parseInt(m[1], 10);
    var suffix = m[2] || "";
    if (target <= 1) return;
    var dur = 900, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      node.textContent = Math.round(eased * target) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else node.textContent = target + suffix;
    }
    requestAnimationFrame(step);
  }

  /* --- Паралакс + згасання hero ------------------------------ */
  function setupHeroParallax() {
    if (reduce || !finePointer || hasST) return; // GSAP керує героєм
    var media = document.querySelector(".hero-media");
    var center = document.querySelector(".hero-center");
    var header = document.querySelector(".site-header");
    if (!header) return;
    var ticking = false;
    function update() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var h = header.offsetHeight || 1;
      var p = Math.min(y / h, 1);
      if (media) media.style.transform = "translateY(" + (y * 0.18).toFixed(1) + "px)";
      if (center) {
        center.style.transform = "translateY(" + (y * 0.12).toFixed(1) + "px)";
        center.style.opacity = String(Math.max(1 - p * 1.15, 0));
      }
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* --- Магнітні кнопки (rect кешується на mouseenter) -------- */
  function setupMagnetic() {
    if (reduce || !finePointer) return;
    var btns = document.querySelectorAll(".primary-btn, .hero-cta, .about-cta");
    Array.prototype.forEach.call(btns, function (b) {
      var r = null;
      b.addEventListener("mouseenter", function () {
        r = b.getBoundingClientRect();
        b.style.transition = "transform 0s";
      });
      b.addEventListener("mousemove", function (e) {
        if (!r) r = b.getBoundingClientRect();
        var mx = e.clientX - r.left - r.width / 2;
        var my = e.clientY - r.top - r.height / 2;
        requestAnimationFrame(function () {
          b.style.transform = "translate(" + (mx * 0.16).toFixed(1) + "px," + (my * 0.22).toFixed(1) + "px)";
        });
      });
      b.addEventListener("mouseleave", function () {
        b.style.transition = "transform 0.4s var(--pm-ease)";
        b.style.transform = "";
        r = null;
      });
    });
  }

  /* --- Spotlight + 3D-tilt під курсором (rect кеш на enter) -- */
  function setupCardSpotlight() {
    if (reduce || !finePointer) return;
    var cards = document.querySelectorAll(
      ".feature, .result, .price-card, .format-card, .map-card, .rule, .gtile"
    );
    Array.prototype.forEach.call(cards, function (c) {
      var r = null;
      var tilt = !c.classList.contains("map-card"); // iframe не нахиляємо
      c.addEventListener("mouseenter", function () { r = c.getBoundingClientRect(); });
      c.addEventListener("mousemove", function (e) {
        if (!r) r = c.getBoundingClientRect();
        var lx = e.clientX - r.left, ly = e.clientY - r.top;
        c.style.setProperty("--pm-mx", lx + "px");
        c.style.setProperty("--pm-my", ly + "px");
        if (!tilt) return;
        var ry = (lx / r.width - 0.5) * 8;
        var rx = (0.5 - ly / r.height) * 8;
        c.style.transform = "perspective(900px) rotateX(" + rx.toFixed(2) +
          "deg) rotateY(" + ry.toFixed(2) + "deg) translateZ(6px)";
      });
      c.addEventListener("mouseleave", function () {
        if (tilt) c.style.transform = "";
        r = null;
      });
    });
  }

  /* --- Стаґер появи плиток слоту (мертвий контракт → живий) ---
     script.js перемальовує #location-grid/#day-grid/#time-grid
     (innerHTML=""). Ловимо це MutationObserver і додаємо стаґер.
     Вибрану плитку не чіпаємо — у неї власний pm-pop. */
  function setupSlotStagger() {
    if (reduce || !("MutationObserver" in window)) return;
    ["location-grid", "day-grid", "time-grid"].forEach(function (id) {
      var grid = document.getElementById(id);
      if (!grid) return;
      var mo = new MutationObserver(function () {
        var tiles = grid.querySelectorAll(".tile");
        Array.prototype.forEach.call(tiles, function (t, i) {
          if (t.classList.contains("selected")) return;
          t.style.setProperty("--pm-i", i);
          t.classList.remove("pm-tin");
          void t.offsetWidth;            // рестарт анімації
          t.classList.add("pm-tin");
        });
      });
      mo.observe(grid, { childList: true });
    });
  }

  /* --- Плаваюча золота CTA (зʼявляється, коли герой пішов) ---- */
  function injectFloatingCta() {
    if (document.querySelector(".pm-float-cta")) return;
    var a = document.createElement("a");
    a.className = "pm-float-cta";
    a.href = "#booking-start";
    a.textContent = "Записатись";
    document.body.appendChild(a);
    var header = document.querySelector(".site-header");
    if (header && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          a.classList.toggle("pm-visible", !en.isIntersecting);
        });
      }, { threshold: 0 });
      io.observe(header);
    } else {
      a.classList.add("pm-visible");
    }
  }

  /* --- Ambient-галерея: відео тихо грає, лише видиме ---------
     Не чіпає data-video/lightbox. Деградує до постерів на
     reduced-motion / без IO / saveData / 2g. Ліміт одночасних. */
  function setupAmbientGallery() {
    var tiles = Array.prototype.slice.call(document.querySelectorAll(".gtile[data-video]"));
    if (!tiles.length || reduce || !("IntersectionObserver" in window)) return;
    var conn = navigator.connection || navigator.webkitConnection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return;
    // Усі видимі плитки грають самі (клікати не треба). Легкі кліпи (~0.3МБ).
    var CAP = finePointer ? 12 : 6;
    var ratios = [];

    tiles.forEach(function (t, i) {
      t.__pmI = i;
      if (t.querySelector(".pm-gtile-video")) return;
      var src = t.getAttribute("data-video");
      if (!src) return;
      var v = document.createElement("video");
      v.className = "pm-gtile-video";
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute("muted", ""); v.setAttribute("loop", "");
      v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
      v.setAttribute("preload", "none"); v.setAttribute("disableremoteplayback", "");
      v.setAttribute("poster", src.replace(/\.mp4(\?.*)?$/i, ".jpg$1"));
      v.__src = src;
      t.insertBefore(v, t.firstChild);
      v.addEventListener("playing", function () { t.classList.add("pm-playing"); });
      v.addEventListener("pause", function () { t.classList.remove("pm-playing"); });
    });

    function apply() {
      var vis = tiles.filter(function (t) { return (ratios[t.__pmI] || 0) > 0.25; });
      vis.sort(function (a, b) { return (ratios[b.__pmI] || 0) - (ratios[a.__pmI] || 0); });
      var playSet = vis.slice(0, CAP);
      tiles.forEach(function (t) {
        var v = t.querySelector(".pm-gtile-video");
        if (!v) return;
        if (playSet.indexOf(t) !== -1) {
          if (!v.getAttribute("src")) { v.setAttribute("src", v.__src); try { v.load(); } catch (e) {} }
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else {
          try { v.pause(); } catch (e) {}
        }
      });
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        ratios[en.target.__pmI] = en.isIntersecting ? en.intersectionRatio : 0;
      });
      apply();
    }, { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "150px 0px" });
    tiles.forEach(function (t) { io.observe(t); });

    // Пауза всіх ambient, поки відкрито відео-lightbox
    var lb = document.getElementById("video-lightbox");
    if (lb && "MutationObserver" in window) {
      new MutationObserver(function () {
        if (!lb.classList.contains("hidden")) {
          tiles.forEach(function (t) {
            var v = t.querySelector(".pm-gtile-video"); if (v) try { v.pause(); } catch (e) {}
          });
        } else { apply(); }
      }).observe(lb, { attributes: true, attributeFilter: ["class"] });
    }
  }

  /* --- Відео-відгук: клік по плей → підвантажити й програти --- */
  function setupVideoReview() {
    var fig = document.querySelector(".pm-vreview");
    if (!fig) return;
    var video = fig.querySelector(".pm-vreview-video");
    var btn = fig.querySelector(".pm-vreview-play");
    if (!video || !btn) return;
    btn.addEventListener("click", function () {
      var src = video.getAttribute("data-src");
      if (src && !video.getAttribute("src")) video.setAttribute("src", src);
      fig.classList.add("is-playing");
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    });
    video.addEventListener("play", function () { fig.classList.add("is-playing"); });
    video.addEventListener("pause", function () {
      if (!video.ended) fig.classList.remove("is-playing");
    });
  }

  /* --- Преміум: клікабельна картка + колода тижнів + лайтбокс -- */
  var PM_WEEKS = [
    { n: 1, goal: "Старт · аеробна база", split: "6-денний спліт", days: [
      ["ПН", "Бокс + Сила"], ["ВТ", "Біг — аеробна база", 1], ["СР", "Техніка ніг + Фізуха"],
      ["ЧТ", "Активне відновлення", 2], ["ПТ", "Парна робота + Груша"], ["СБ", "Біг або відпочинок", 1], ["НД", "Повний відпочинок", 2] ] },
    { n: 2, goal: "Сайд-кік · Hyrox", split: "6-денний спліт", days: [
      ["ПН", "Hyrox / Сила"], ["ВТ", "Біг", 1], ["СР", "Сайд-кік + Лапи + Пліометрика"],
      ["ЧТ", "Відновлення", 2], ["ПТ", "Парна робота + Груша"], ["СБ", "Біг", 1], ["НД", "Відпочинок", 2] ] },
    { n: 3, goal: "Round kick · сила", split: "6-денний спліт", days: [
      ["ПН", "Hyrox / Сила"], ["ВТ", "Біг", 1], ["СР", "Рука + Round Kick + Лапи"],
      ["ЧТ", "Відновлення", 2], ["ПТ", "Парна робота + Груша"], ["СБ", "Біг", 1], ["НД", "Відпочинок", 2] ] },
    { n: 4, goal: "Кругове · round kick", split: "6-денний спліт", days: [
      ["ПН", "Боксерське кругове"], ["ВТ", "Біг", 1], ["СР", "Round Kick розвиток + Лапи"],
      ["ЧТ", "Відновлення", 2], ["ПТ", "Парна робота + Груша"], ["СБ", "Біг", 1], ["НД", "Відпочинок", 2] ] },
    { n: 5, goal: "3-денний спліт", split: "ПН · СР · ПТ", days: [
      ["ПН", "Hyrox / Сила"], ["СР", "Техніка ніг + Фізуха"], ["ПТ", "Бокс"], ["СБ/НД", "Відпочинок", 2] ] },
    { n: 6, goal: "Набір ваги", split: "ПН · СР · ПТ", days: [
      ["ПН", "Hyrox / Силовий"], ["СР", "Кікбоксинг"], ["ПТ", "Бокс"], ["СБ/НД", "Відпочинок", 2] ] }
  ];
  var PM_WEEK_URL = "https://client-protocols-alpha.vercel.app/clients/lyubchyk/week-";

  function pmEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function pmPosterHTML(w, full) {
    var rows = w.days.map(function (d) {
      var rest = d[2] ? " is-rest" : "";
      return '<li class="' + (d[2] === 1 ? "pm-solo" : d[2] === 2 ? "pm-rest" : "") + '"><b>' + pmEsc(d[0]) + '</b><span>' + pmEsc(d[1]) + '</span></li>';
    }).join("");
    return (
      '<div class="pm-poster' + (full ? " is-full" : "") + '">' +
        '<span class="pm-poster-eyebrow">Artur Performance Club</span>' +
        '<span class="pm-poster-no">Тиждень ' + w.n + '</span>' +
        '<span class="pm-poster-goal">' + pmEsc(w.goal) + '</span>' +
        '<ul class="pm-poster-days">' + rows + '</ul>' +
        '<span class="pm-poster-foot"><b>Любчик</b>' + pmEsc(w.split) + '</span>' +
      '</div>'
    );
  }

  function setupPremiumCards() {
    Array.prototype.forEach.call(document.querySelectorAll(".pm-card-link"), function (card) {
      card.addEventListener("click", function (e) {
        if (e.target.closest("a, button")) return; // не перехоплювати вкладену кнопку
        var id = card.getAttribute("data-target");
        var t = id && document.getElementById(id);
        if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function buildPremiumWeeks() {
    var mount = document.getElementById("premium-weeks");
    if (!mount) return;

    // Колода
    var pile = document.createElement("div");
    pile.className = "pm-deck";
    pile.setAttribute("role", "button");
    pile.setAttribute("tabindex", "0");
    pile.setAttribute("aria-label", "Приклад плану Любчика — 6 тижнів, відкрити");
    PM_WEEKS.forEach(function (w, i) {
      var card = document.createElement("article");
      card.className = "pm-week";
      card.style.setProperty("--i", i);
      card.setAttribute("data-week", i);
      card.innerHTML = pmPosterHTML(w, false);
      pile.appendChild(card);
    });
    var hint = document.createElement("span");
    hint.className = "pm-deck-hint";
    hint.textContent = "6 тижнів · натисни, щоб гортати";
    pile.appendChild(hint);
    mount.insertBefore(pile, mount.firstChild);

    // Лайтбокс (один на сторінку)
    var lb = document.createElement("div");
    lb.className = "pm-lb";
    lb.setAttribute("hidden", "");
    lb.innerHTML =
      '<div class="pm-lb-backdrop"></div>' +
      '<div class="pm-lb-stage" role="dialog" aria-modal="true" aria-label="План Любчика по тижнях">' +
        '<button class="pm-lb-nav pm-lb-prev" aria-label="Попередній тиждень">&#8249;</button>' +
        '<div class="pm-lb-body"></div>' +
        '<button class="pm-lb-nav pm-lb-next" aria-label="Наступний тиждень">&#8250;</button>' +
      '</div>' +
      '<div class="pm-lb-foot">' +
        '<span class="pm-lb-count"></span>' +
        '<a class="pm-lb-full primary-btn small" target="_blank" rel="noopener">Весь план тижня &#8594;</a>' +
        '<button class="pm-lb-close ghost-btn small">Закрити</button>' +
      '</div>';
    document.body.appendChild(lb);

    var body = lb.querySelector(".pm-lb-body");
    var count = lb.querySelector(".pm-lb-count");
    var full = lb.querySelector(".pm-lb-full");
    var idx = 0, lastFocus = null;

    function render() {
      var w = PM_WEEKS[idx];
      body.innerHTML = pmPosterHTML(w, true);
      count.textContent = (idx + 1) + " / " + PM_WEEKS.length;
      full.setAttribute("href", PM_WEEK_URL + w.n);
    }
    function open(i) {
      idx = i || 0; render();
      lastFocus = document.activeElement;
      lb.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
      requestAnimationFrame(function () { lb.classList.add("is-open"); });
      lb.querySelector(".pm-lb-close").focus();
    }
    function close() {
      lb.classList.remove("is-open");
      document.body.style.overflow = "";
      setTimeout(function () { lb.setAttribute("hidden", ""); }, 260);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function go(step) { idx = (idx + step + PM_WEEKS.length) % PM_WEEKS.length; render(); }

    pile.addEventListener("click", function (e) {
      var c = e.target.closest(".pm-week");
      open(c ? parseInt(c.getAttribute("data-week"), 10) : 0);
    });
    pile.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(0); }
    });
    lb.querySelector(".pm-lb-prev").addEventListener("click", function () { go(-1); });
    lb.querySelector(".pm-lb-next").addEventListener("click", function () { go(1); });
    lb.querySelector(".pm-lb-close").addEventListener("click", close);
    lb.querySelector(".pm-lb-backdrop").addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (lb.hasAttribute("hidden")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    });
  }

  /* --- Легкий scroll-паралакс фонів секцій ------------------- */
  function setupSectionParallax() {
    if (reduce || hasST) return; // GSAP керує фонами секцій
    var bgs = Array.prototype.slice.call(document.querySelectorAll(".pm-section-bg"));
    if (!bgs.length) return;
    var ticking = false;
    function update() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      bgs.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var p = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.transform = "translateX(-50%) translateY(" + (p * -26).toFixed(1) + "px)";
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* --- GSAP scroll-cinema: інтро героя + scrub-паралакс + reveal 2.0 + фони секцій --- */
  function setupGsapCinema() {
    if (!hasST) return;

    // Розбити wordmark на слова (для інтро «тексти збираються»)
    var wm = document.querySelector(".hero-wordmark");
    if (wm && !wm.querySelector(".pm-word")) {
      wm.innerHTML = '<span class="wm-line pm-word">Boxing</span><span class="wm-rule" aria-hidden="true"></span><span class="wm-line pm-word">Kickboxing</span>';
    }

    var mm = GSAP.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", function () {
      // 1) Інтро героя
      try {
        var words = wm ? wm.querySelectorAll(".pm-word") : [];
        var bt = document.querySelector(".brand-tag");
        var sub = document.querySelector(".brand-sub");
        var cta = document.querySelector(".hero-cta");
        var tl = GSAP.timeline({ defaults: { ease: "power3.out" } });
        if (bt) tl.from(bt, { y: 14, opacity: 0, duration: 0.6 }, 0.1);
        if (words.length) tl.from(words, { yPercent: 120, opacity: 0, filter: "blur(14px)", stagger: 0.12, duration: 0.9 }, 0.2);
        var rule = wm ? wm.querySelector(".wm-rule") : null;
        if (rule) tl.from(rule, { scaleX: 0, opacity: 0, duration: 0.7, ease: "power2.out" }, 0.5);
        if (sub) tl.from(sub, { y: 16, opacity: 0, duration: 0.55 }, "-=0.4");
        if (cta) tl.from(cta, { y: 16, opacity: 0, duration: 0.55 }, "-=0.35");
      } catch (e) {}

      // 2) Scrub героя: медіа паралакс+zoom, контент тане вгору, veil темнішає
      try {
        var header = document.querySelector(".site-header");
        var media = document.querySelector(".hero-media");
        var center = document.querySelector(".hero-center");
        var veil = document.querySelector(".hero-video-veil");
        if (header) {
          var stt = GSAP.timeline({ scrollTrigger: { trigger: header, start: "top top", end: "bottom top", scrub: 0.6 } });
          if (media) stt.to(media, { yPercent: 16, scale: 1.12, ease: "none" }, 0);
          if (center) stt.to(center, { yPercent: -14, opacity: 0, ease: "none" }, 0);
          if (veil) stt.to(veil, { opacity: 1, ease: "none" }, 0);
        }
      } catch (e) {}

      // 3) Reveal блоків — керує надійний IO+CSS у setupReveal() (не GSAP).

      // 4) Фони секцій — scrub-паралакс
      try {
        GSAP.utils.toArray(".pm-section-bg").forEach(function (bg) {
          GSAP.fromTo(bg, { yPercent: -8 }, {
            yPercent: 8, ease: "none",
            scrollTrigger: { trigger: bg.parentNode, start: "top bottom", end: "bottom top", scrub: true }
          });
        });
      } catch (e) {}

      return function () {}; // cleanup за matchMedia
    });

    // Захист адмінки: script.js свапає main → вимикаємо тригери
    if (document.getElementById("admin-view") && "MutationObserver" in window) {
      new MutationObserver(function () {
        var adminOpen = document.body.classList.contains("admin-active");
        try {
          ST.getAll().forEach(function (t) { if (adminOpen) t.disable(); else t.enable(); });
          if (!adminOpen) ST.refresh();
        } catch (e) {}
      }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

    // Refresh після завантаження й hero-відео
    window.addEventListener("load", function () { try { ST.refresh(); } catch (e) {} });
    var hv = document.querySelector(".hero-video");
    if (hv) hv.addEventListener("loadeddata", function () { try { ST.refresh(); } catch (e) {} });
  }

  ready(function () {
    try { injectHeroFx(); } catch (e) {}
    try { injectHeroSides(); } catch (e) {} // бічні відео 14/9 + god-rays свічення
    try { injectSectionBackgrounds(); } catch (e) {}
    try { setupGsapCinema(); } catch (e) {}
    try { injectProgressBar(); } catch (e) {}
    try { injectHeroBadges(); } catch (e) {}
    try { injectFloatingCta(); } catch (e) {}
    try { setupVideoReview(); } catch (e) {}
    try { setupPremiumCards(); } catch (e) {}
    try { buildPremiumWeeks(); } catch (e) {}
    try { setupAmbientGallery(); } catch (e) {}
    try { setupReveal(); } catch (e) {}
    try { setupCounters(); } catch (e) {}
    try { setupHeroParallax(); } catch (e) {}
    try { setupSectionParallax(); } catch (e) {}
    try { setupSlotStagger(); } catch (e) {}
    try { setupMagnetic(); } catch (e) {}
    try { setupCardSpotlight(); } catch (e) {}
  });
})();
