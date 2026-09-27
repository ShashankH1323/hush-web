/* Hush landing — app.js
 * Vanilla, no libs, defer-loaded. Feature-detected; never throws on
 * missing elements; honors prefers-reduced-motion. Keep it small. */
(function () {
  "use strict";

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* Small deterministic PRNG (mulberry32) so patterned data is stable
     across reloads instead of flickering with Math.random(). */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Integer with thousands separators (safe if toLocaleString is absent). */
  function formatInt(n) {
    n = Math.round(n);
    try { return n.toLocaleString("en-US"); } catch (_) { return String(n); }
  }
  /* Catmull-Rom → cubic-bezier smooth path through [x,y] points. */
  function smoothPath(p) {
    if (!p || p.length < 2) return "";
    var r = function (n) { return Math.round(n * 100) / 100; };
    var d = "M" + p[0][0] + "," + p[0][1], i, p0, p1, p2, p3, k = 1 / 6;
    for (i = 0; i < p.length - 1; i++) {
      p0 = p[i - 1] || p[i]; p1 = p[i]; p2 = p[i + 1]; p3 = p[i + 2] || p2;
      d += "C" + r(p1[0] + (p2[0] - p0[0]) * k) + "," +
        r(p1[1] + (p2[1] - p0[1]) * k) + " " +
        r(p2[0] - (p3[0] - p1[0]) * k) + "," +
        r(p2[1] - (p3[1] - p1[1]) * k) + " " + p2[0] + "," + p2[1];
    }
    return d;
  }

  function ready(fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    /* 1. Nav shrink — toggle .nav--scrolled past a few px of scroll. */
    var nav = document.querySelector("[data-nav]");
    if (nav) {
      var syncNav = function () {
        nav.classList.toggle("nav--scrolled", window.scrollY > 8);
      };
      syncNav();
      window.addEventListener("scroll", syncNav, { passive: true });
    }

    /* 2. Smooth anchor scroll for in-page links (instant if reduced-motion). */
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href");
      if (!id || id.length < 2) return; // ignore bare "#"
      var target;
      try { target = document.querySelector(id); } catch (_) { return; }
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    });

    /* 3. Reveal on view — add .is-in when ~15% visible, then unobserve. */
    var reveals = document.querySelectorAll(".reveal");
    if (reveals.length) {
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (en) {
              if (en.isIntersecting) {
                en.target.classList.add("is-in");
                io.unobserve(en.target);
              }
            });
          },
          { threshold: 0.15 }
        );
        reveals.forEach(function (el) { io.observe(el); });
      } else {
        // No observer support: just show everything.
        reveals.forEach(function (el) { el.classList.add("is-in"); });
      }
    }

    /* 4. Hero word stagger — kinetic reveal via transition-delay on load. */
    var words = document.querySelectorAll(".hero .word");
    words.forEach(function (w, i) {
      if (!reduced) w.style.transitionDelay = (i * 0.06).toFixed(3) + "s";
    });
    // Next frame so the initial (hidden) state paints before transitioning.
    requestAnimationFrame(function () {
      words.forEach(function (w) { w.classList.add("is-in"); });
    });

    /* 5. Pill demo — swap the hero voice-bar's markup per state so each
       state shows its TRUE content (idle empty, recording meter, writing
       spinner, done check) and toggle the matching hush-pill--* class.
       Reduced-motion: leave it in recording with the meter, no cycle. */
    var pill = document.querySelector(".hero [data-pill]");
    if (pill && !reduced) {
      var xSvg =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      var checkSvg =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      var bars = "";
      for (var b = 0; b < 12; b++) bars += "<span></span>"; // 12 meter bars
      var content = {
        idle: "",
        recording:
          '<button class="hush-pill__btn hush-pill__btn--cancel" ' +
          'aria-label="Cancel">' + xSvg + "</button>" +
          '<div class="hush-meter" data-meter>' + bars + "</div>" +
          '<button class="hush-pill__btn hush-pill__btn--accept" ' +
          'aria-label="Accept">' + checkSvg + "</button>",
        writing:
          '<span class="hush-spinner"></span>' +
          '<span class="hush-pill__label">Writing…</span>',
        done:
          '<span class="hush-pill__check">' + checkSvg + "</span>" +
          '<span class="hush-pill__label">Done</span>',
      };
      // DOM starts in recording; advance recording→writing→done→idle→…
      var order = ["recording", "writing", "done", "idle"];
      var i = 0;
      setInterval(function () {
        i = (i + 1) % order.length;
        var s = order[i];
        order.forEach(function (o) {
          pill.classList.remove("hush-pill--" + o);
        });
        pill.classList.add("hush-pill--" + s);
        pill.innerHTML = content[s];
      }, 2600);
    }

    /* 6. Download feedback — transient toast; NEVER block the native download. */
    document.addEventListener("click", function (e) {
      var d = e.target.closest && e.target.closest("[data-download]");
      if (!d) return; // no preventDefault: let the href download proceed
      var t = document.createElement("div");
      t.className = "hush-toast";
      t.textContent = "Starting your download…";
      t.style.cssText =
        "position:fixed;left:50%;bottom:28px;transform:translateX(-50%) " +
        "translateY(12px);background:#17191c;color:#fff;font:500 15px/1 " +
        "var(--sans),sans-serif;padding:12px 18px;border-radius:9999px;" +
        "box-shadow:0 8px 30px rgba(0,0,0,.18);opacity:0;z-index:100;" +
        "pointer-events:none;transition:opacity .25s,transform .25s;";
      document.body.appendChild(t);
      requestAnimationFrame(function () {
        t.style.opacity = "1";
        t.style.transform = "translateX(-50%) translateY(0)";
      });
      setTimeout(function () {
        t.style.opacity = "0";
        t.style.transform = "translateX(-50%) translateY(12px)";
        setTimeout(function () { t.remove(); }, 300);
      }, 2200);
    });

    /* 10. Copy buttons — copy a [data-copy] payload to the clipboard, with a
       legacy execCommand fallback, then flash a transient "Copied" state on the
       button. Feature-detected and fully guarded: never throws even if the
       clipboard APIs are missing. */
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("[data-copy]");
      if (!btn) return;
      var text = btn.getAttribute("data-copy");
      if (text == null) return;

      // Flash the copied state, then restore the prior label after ~1.6s.
      var flash = function () {
        btn.classList.add("is-copied");
        var label = btn.querySelector(".download__copy-label");
        if (label) {
          if (btn.__copyLabel == null) btn.__copyLabel = label.textContent;
          label.textContent = "Copied";
        }
        if (btn.__copyT) clearTimeout(btn.__copyT); // clear any prior timeout
        btn.__copyT = setTimeout(function () {
          btn.classList.remove("is-copied");
          if (label && btn.__copyLabel != null) label.textContent = btn.__copyLabel;
          btn.__copyT = null;
        }, 1600);
      };

      // Legacy path: off-screen readonly textarea + execCommand('copy').
      var legacy = function () {
        try {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.cssText =
            "position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          flash();
        } catch (_) {} // never throw if execCommand/select are unavailable
      };

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(flash, legacy);
        } else {
          legacy();
        }
      } catch (_) {
        legacy(); // clipboard access threw synchronously — fall back
      }
    });

    /* 7. Stats — contribution grid: 53 weeks × 7 days = 371 day cells.
       Deterministic seeded pattern weighted toward low/mid levels with the
       odd bright multi-week streak. A filled grid IS the final state, so
       reduced-motion needs no special case here. */
    (function buildContrib() {
      var grid = document.querySelector("[data-contrib-grid]");
      if (!grid || grid.childElementCount) return; // guard + idempotent
      var WEEKS = 53, DAYS = 7;
      var rng = mulberry32(0x1f2e3d4c);
      var frag = document.createDocumentFragment();
      var intensity = 0.35, streak = 0;
      for (var w = 0; w < WEEKS; w++) {
        if (streak > 0) streak--; // decay an active bright streak
        else if (rng() < 0.09) streak = 2 + Math.floor(rng() * 3); // start one
        var boost = streak > 0 ? 0.42 : 0;
        intensity += (rng() - 0.5) * 0.3; // gentle random walk between weeks
        if (intensity < 0.1) intensity = 0.1;
        if (intensity > 0.72) intensity = 0.72;
        for (var d = 0; d < DAYS; d++) {
          var weekend = d === 0 || d === 6 ? -0.24 : 0; // quieter weekends
          var v = intensity + boost + weekend + (rng() - 0.5) * 0.42;
          var level = v < 0.16 ? 0 : v < 0.4 ? 1 : v < 0.62 ? 2 : v < 0.82 ? 3 : 4;
          var cell = document.createElement("span");
          cell.className = "contrib__day";
          cell.setAttribute("data-level", String(level));
          frag.appendChild(cell); // column-major: 7 days per week, in order
        }
      }
      grid.appendChild(frag);
    })();

    /* 8. Stats — count-up: animate each .stat-tile__num[data-count] from 0
       to its value (~1s easeOut, thousands separators) the first time it
       scrolls into view. Reduced-motion / no observer: snap to final. */
    (function countUp() {
      var nums = document.querySelectorAll(".stat-tile__num[data-count]");
      if (!nums.length) return;
      var valOf = function (el) {
        return parseFloat(el.getAttribute("data-count")) || 0;
      };
      if (reduced || !("IntersectionObserver" in window)) {
        nums.forEach(function (el) { el.textContent = formatInt(valOf(el)); });
        return;
      }
      var run = function (el) {
        var end = valOf(el), dur = 1000, t0 = null;
        var step = function (ts) {
          if (t0 === null) t0 = ts;
          var t = clamp01((ts - t0) / dur);
          el.textContent = formatInt(end * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
          else el.textContent = formatInt(end);
        };
        requestAnimationFrame(step);
      };
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
        });
      }, { threshold: 0.4 });
      nums.forEach(function (el) { el.textContent = formatInt(0); io.observe(el); });
    })();

    /* 9. Stats — usage line graph: build a smooth path over 52 patterned
       weekly points plus a soft terracotta area fill. On reveal, draw the
       stroke (stroke-dashoffset) and fade the fill in. Reduced-motion / no
       observer: show it fully drawn immediately. */
    (function usageLine() {
      var svg = document.querySelector("[data-usageline]");
      if (!svg || svg.querySelector(".usageline__line")) return; // guard + idempotent
      var NS = "http://www.w3.org/2000/svg";
      var W = 720, H = 220, N = 52;
      var padX = 8, padTop = 20, padBot = 6;
      var usableW = W - padX * 2, usableH = H - padTop - padBot;
      var rng = mulberry32(0x51ed270b), pts = [], v = 0.32, i;
      for (i = 0; i < N; i++) {
        v += (rng() - 0.5) * 0.16; // bounded weekly random walk
        if (v < 0.05) v = 0.05;
        if (v > 0.7) v = 0.7;
        var trend = (i / (N - 1)) * 0.34; // gentle upward drift over the year
        var wave = Math.sin((i / N) * Math.PI * 4) * 0.1; // a few soft humps
        var val = clamp01(0.18 + v * 0.55 + trend + wave);
        var x = padX + (i / (N - 1)) * usableW;
        var y = padTop + (1 - val) * usableH;
        pts.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
      }
      var lineD = smoothPath(pts);
      var areaD = lineD + " L" + pts[N - 1][0] + "," + H +
        " L" + pts[0][0] + "," + H + " Z";

      // Soft area fill: vertical accent→transparent gradient.
      var gid = "usageline-fill";
      var defs = document.createElementNS(NS, "defs");
      var grad = document.createElementNS(NS, "linearGradient");
      grad.setAttribute("id", gid);
      grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
      grad.setAttribute("x2", "0"); grad.setAttribute("y2", "1");
      var mkStop = function (off, op) {
        var s = document.createElementNS(NS, "stop");
        s.setAttribute("offset", off);
        s.style.stopColor = "var(--hush-accent,#B5643C)";
        s.style.stopOpacity = op;
        return s;
      };
      grad.appendChild(mkStop("0", ".22"));
      grad.appendChild(mkStop("1", "0"));
      defs.appendChild(grad);

      var area = document.createElementNS(NS, "path");
      area.setAttribute("class", "usageline__area");
      area.setAttribute("d", areaD);
      area.style.fill = "url(#" + gid + ")";
      area.style.opacity = "0";

      var line = document.createElementNS(NS, "path");
      line.setAttribute("class", "usageline__line");
      line.setAttribute("d", lineD);
      line.setAttribute("fill", "none");
      line.setAttribute("stroke-width", "2.5");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      line.setAttribute("vector-effect", "non-scaling-stroke");
      line.style.stroke = "var(--hush-accent,#B5643C)";

      svg.appendChild(defs);
      svg.appendChild(area);
      svg.appendChild(line);

      if (reduced || !("IntersectionObserver" in window)) {
        area.style.opacity = "1"; // fully drawn, no draw-on animation
        return;
      }
      var len = 0;
      try { len = line.getTotalLength(); } catch (_) {}
      if (len) { // pre-hide the stroke so there is no flash of the full line
        line.style.strokeDasharray = len;
        line.style.strokeDashoffset = len;
      }
      var draw = function () {
        area.style.transition = "opacity .9s ease .2s";
        area.style.opacity = "1";
        if (!len) return;
        line.getBoundingClientRect(); // reflow so the offset sticks
        line.style.transition = "stroke-dashoffset 1.5s cubic-bezier(.22,1,.36,1)";
        line.style.strokeDashoffset = "0";
      };
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { draw(); io.unobserve(en.target); }
        });
      }, { threshold: 0.3 });
      io.observe(svg);
    })();
  });
})();
