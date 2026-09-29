/* Hush landing — app.js
 * Vanilla, no libs, defer-loaded. Feature-detected; never throws on missing elements.
 *
 * Release contract (do not break — the release pipeline and the desktop updater depend on it):
 *  - index.html keeps STATIC download hrefs ending in x64-setup.exe and plain-text "Version X.Y.Z" strings;
 *    the release workflow rewrites them with regexes.
 *  - /version.json (same origin) is the update manifest the desktop app polls. Here it only progressively enhances
 *    the page: download hrefs and version labels are refreshed from it, and the static markup remains the fallback
 *    if the fetch fails or the manifest fails validation.
 *
 * Security: nothing from the manifest is ever parsed as HTML. Text goes through textContent; the download URL is
 * only accepted if it is an https://github.com/ShashankH1323/hush-web/releases/download/... URL. */
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

  /* 4. Release manifest: refresh the download links and version labels from /version.json ------ */
  var RELEASE_PREFIX = "/ShashankH1323/hush-web/releases/download/";
  /* Returns the normalised URL string, or "" if it is not a GitHub release-asset installer link for this project.
   * new URL() resolves ".." and "%2e%2e" segments, so the prefix check below runs on the final path. */
  var safeDownload = function (u) {
    if (typeof u !== "string" || u.length > 300) return "";
    var url;
    try { url = new URL(u); } catch (_) { return ""; }
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port !== "") return "";
    if (url.username || url.password || url.search || url.hash) return "";
    if (url.pathname.indexOf(RELEASE_PREFIX) !== 0 || !/x64-setup\.exe$/.test(url.pathname)) return "";
    return url.href;
  };
  var safeVersion = function (v) { return typeof v === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v) ? v : ""; };

  if (window.fetch) {
    fetch("/version.json", { cache: "no-cache", credentials: "omit", referrerPolicy: "no-referrer" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("version.json " + r.status)); })
      .then(function (v) {
        if (!v || typeof v !== "object") return;
        var href = safeDownload(v.download_url), ver = safeVersion(v.version);
        if (href) qsa("[data-download]").forEach(function (a) { a.href = href; });
        if (ver) qsa("[data-version-text]").forEach(function (el) { el.textContent = "Version " + ver; });
      })
      .catch(function () { /* keep the static links */ });
  }

  /* 5. Download feedback: transient toast; never blocks the native download ------- */
  var toast = null, toastT = 0;
  d.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-download]");
    if (!a) return;                                   // no preventDefault: the href does the work
    if (!toast) { toast = d.createElement("div"); toast.className = "toast"; toast.setAttribute("role", "status"); d.body.appendChild(toast); }
    toast.textContent = "Starting your download…";
    requestAnimationFrame(function () { toast.classList.add("is-on"); });
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove("is-on"); }, 2400);
  });

  /* 6. Footer year ------------------------------------------------------------------ */
  qsa("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
})();
