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
 *  - macOS: the release workflow adds exactly two keys to /version.json: mac_arm64_url (Apple Silicon) and mac_x64_url (Intel),
 *    each a .dmg release asset. The Mac buttons are static, href-less "Coming soon" placeholders until one of them exists.
 *    Browsers can't reliably tell Apple Silicon from Intel, so "Download for macOS" links to mac_arm64_url and a small
 *    "Intel Mac? Download here" link (data-download-mac-intel) under it links to mac_x64_url, shown only when that key exists.
 *    Neither key => the button stays disabled and never links to a 404.
 *
 * Security: nothing from the manifest is ever parsed as HTML. Text goes through textContent; the download URL is
 * only accepted if it is an https://github.com/ShashankH1323/hush-web/releases/download/... URL (same rule for the Mac asset). */
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
  var safeAsset = function (u, ext) {
    if (typeof u !== "string" || u.length > 300) return "";
    var url;
    try { url = new URL(u); } catch (_) { return ""; }
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port !== "") return "";
    if (url.username || url.password || url.search || url.hash) return "";
    if (url.pathname.indexOf(RELEASE_PREFIX) !== 0 || !ext.test(url.pathname)) return "";
    return url.href;
  };
  var safeDownload = function (u) { return safeAsset(u, /x64-setup\.exe$/); };
  var safeMac = function (u) { return safeAsset(u, /\.dmg$/i); };
  var safeVersion = function (v) { return typeof v === "string" && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v) ? v : ""; };

  /* OS-aware buttons: the Windows and macOS buttons swap primary/soft styling so the visitor's platform is highlighted. */
  var winBtns = qsa("[data-download-win]"), macBtns = qsa("[data-download-mac]"), navBtn = d.querySelector("[data-nav-dl]");
  var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  var isMac = /^mac/i.test(plat) && !(navigator.maxTouchPoints > 1);      // iPadOS reports "MacIntel" but has touch
  var macUrl = "", macIntelUrl = "";                  // Apple Silicon (mac_arm64_url) / Intel (mac_x64_url)
  var setPrimary = function (a, on) { a.classList.toggle("btn--primary", on); a.classList.toggle("btn--soft", !on); };
  var applyOS = function () {
    if (macUrl) macBtns.forEach(function (a) {
      a.href = macUrl; a.setAttribute("download", ""); a.removeAttribute("aria-disabled");
      var tag = a.querySelector("[data-mac-tag]"); if (tag) tag.remove();
    });
    qsa("[data-download-mac-intel]").forEach(function (a) {
      if (macUrl && macIntelUrl) { a.href = macIntelUrl; a.setAttribute("download", ""); a.hidden = false; }
      else a.hidden = true;
    });
    if (!isMac) return;
    if (macUrl) { winBtns.forEach(function (a) { setPrimary(a, false); }); macBtns.forEach(function (a) { setPrimary(a, true); }); }
    if (navBtn) {                                     // never hand a Mac visitor the .exe from the nav button
      if (macUrl) { navBtn.href = macUrl; navBtn.setAttribute("download", ""); }
      else { navBtn.href = "#download"; navBtn.removeAttribute("download"); }
    }
  };
  applyOS();

  if (window.fetch) {
    fetch("/version.json", { cache: "no-cache", credentials: "omit", referrerPolicy: "no-referrer" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("version.json " + r.status)); })
      .then(function (v) {
        if (!v || typeof v !== "object") return;
        var href = safeDownload(v.download_url), ver = safeVersion(v.version);
        if (href) qsa("[data-download]").forEach(function (a) { a.href = href; });
        if (ver) qsa("[data-version-text]").forEach(function (el) { el.textContent = "Version " + ver; });
        var arm = safeMac(v.mac_arm64_url), x64 = safeMac(v.mac_x64_url);
        macUrl = arm || x64;                               // the main Mac button is Apple Silicon; Intel only if that is all there is
        macIntelUrl = arm ? x64 : "";                      // the secondary Intel link is shown only next to a distinct Apple Silicon button
        applyOS();
      })
      .catch(function () { /* keep the static links */ });
  }

  /* 5. Download feedback: transient toast; never blocks the native download (skipped for non-download links) ------- */
  var toast = null, toastT = 0;
  d.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-download], [data-download-mac], [data-download-mac-intel]");
    if (!a || !a.hasAttribute("href") || !a.hasAttribute("download")) return;                                   // no preventDefault: the href does the work
    if (!toast) { toast = d.createElement("div"); toast.className = "toast"; toast.setAttribute("role", "status"); d.body.appendChild(toast); }
    toast.textContent = "Starting your download…";
    requestAnimationFrame(function () { toast.classList.add("is-on"); });
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove("is-on"); }, 2400);
  });

  /* 6. Footer year ------------------------------------------------------------------ */
  qsa("[data-year]").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
})();
