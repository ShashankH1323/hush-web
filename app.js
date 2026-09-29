/* Hush landing — app.js
 * Vanilla, no libs, defer-loaded. Feature-detected; never throws on missing elements.
 *
 * Release contract (do not break — the release pipeline and the desktop updater depend on it):
 *  - index.html keeps STATIC download hrefs ending in x64-setup.exe / x64_en-US.msi and plain-text
 *    "Version X.Y.Z" strings; the release workflow rewrites them with regexes.
 *  - version.json (same origin, /version.json) is the update manifest the desktop app polls.
 *    Here it only progressively enhances the page: hrefs, version labels and the SHA-256 copy button
 *    are refreshed from it, and the static markup remains the fallback if the fetch fails. */
(function () {
  "use strict";

  var d = document;
  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var qsa = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };

  /* 1. Nav: frosted once scrolled ------------------------------------------------ */
  var nav = d.querySelector("[data-nav]");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("nav--scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* 2. Reveal on scroll ---------------------------------------------------------- */
  var reveals = qsa(".reveal");
  if (reveals.length) {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
      reveals.forEach(function (el) { io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add("is-in"); });
    }
  }

  /* 3. Card spotlight: move a radial gradient with transform (hover-capable pointers only) */
  if (!reduced && window.matchMedia && window.matchMedia("(hover: hover)").matches) {
    qsa(".card").forEach(function (card) {
      var raf = 0, x = 0, y = 0;
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect(); x = e.clientX - r.left; y = e.clientY - r.top;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0; card.style.setProperty("--mx", x + "px"); card.style.setProperty("--my", y + "px");
        });
      });
    });
  }

  /* 4. Release manifest: refresh links / version / checksum from /version.json ------ */
  var isHttps = function (u) { return typeof u === "string" && /^https:\/\//i.test(u); };
  var isSemver = function (v) { return typeof v === "string" && /^\d+\.\d+\.\d+/.test(v); };
  if (window.fetch) {
    fetch("version.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("version.json " + r.status)); })
      .then(function (v) {
        if (!v || typeof v !== "object") return;
        if (isHttps(v.download_url)) qsa("[data-download]").forEach(function (a) { a.href = v.download_url; });
        if (isHttps(v.msi_url)) qsa("[data-msi]").forEach(function (a) { a.href = v.msi_url; });
        if (isSemver(v.version)) qsa("[data-version-text]").forEach(function (el) { el.textContent = "Version " + v.version; });
        if (typeof v.sha256 === "string" && /^[a-f0-9]{64}$/i.test(v.sha256)) {
          qsa("[data-copy]").forEach(function (b) { b.setAttribute("data-copy", v.sha256.toLowerCase()); b.hidden = false; });
        }
      })
      .catch(function () { /* keep the static links */ });
  }

  /* 5. Download feedback: transient toast; never blocks the native download ------- */
  var toast = null, toastT = 0;
  d.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-download],[data-msi]");
    if (!a) return;                                   // no preventDefault: the href does the work
    if (!toast) { toast = d.createElement("div"); toast.className = "toast"; toast.setAttribute("role", "status"); d.body.appendChild(toast); }
    toast.textContent = "Starting your download…";
    requestAnimationFrame(function () { toast.classList.add("is-on"); });
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove("is-on"); }, 2400);
  });

  /* 6. Copy buttons (SHA-256) -------------------------------------------------------- */
  d.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-copy]");
    if (!btn) return;
    var text = btn.getAttribute("data-copy");
    if (!text) return;
    var label = btn.__label == null ? (btn.__label = btn.textContent) : btn.__label;
    var flash = function () {
      btn.textContent = "Copied";
      clearTimeout(btn.__t);
      btn.__t = setTimeout(function () { btn.textContent = label; }, 1600);
    };
    var legacy = function () {
      try {
        var ta = d.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
        d.body.appendChild(ta); ta.select(); d.execCommand("copy"); ta.remove(); flash();
      } catch (_) { /* nothing more to try */ }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(flash, legacy);
      else legacy();
    } catch (_) { legacy(); }
  });

  /* 7. Footer year ------------------------------------------------------------------ */
  qsa("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
})();
