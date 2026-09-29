/* Hush landing — hero demo.
 * Vanilla recreation of the "messy speech -> clean text" idea: raw words stream into a mock text field
 * while a faithful Hush bar (canvas capsule, 13 waveform bars, processing shimmer, paste flash) runs,
 * then the words morph into clean text (fillers dropped, survivors slide into place via FLIP).
 * Loops chat -> email -> code comment. Animations are transform/opacity (WAAPI + CSS) plus a canvas bar;
 * everything pauses off-screen / in hidden tabs, and prefers-reduced-motion gets a static final state. */
(function () {
  "use strict";

  var root = document.querySelector("[data-demo]");
  if (!root) return;

  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var q = function (s) { return root.querySelector(s); };
  var win = q("[data-win]"), appEl = q("[data-app]"), subEl = q("[data-sub]"), glyphEl = q("[data-glyph]"),
      ctxEl = q("[data-ctx]"), fieldEl = q("[data-field]"), textEl = q("[data-text]"), canvas = q("[data-bar]"),
      keyEls = root.querySelectorAll("[data-key]");
  if (!win || !textEl || !canvas || !canvas.getContext) { root.classList.add("is-ready"); return; }

  /* ---------------------------------------------------------------- scenes */
  /* All scene markup is built with createElement / createElementNS / textContent: no innerHTML anywhere, so there is no HTML-injection sink. */
  var SVG_NS = "http://www.w3.org/2000/svg";
  var el = function (tag, cls, kids) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    (kids || []).forEach(function (k) { n.appendChild(typeof k === "string" ? document.createTextNode(k) : k); });
    return n;
  };
  var sp = function (cls, text) { return el("span", cls, [text]); };
  var icon = function (shapes) {
    var svg = document.createElementNS(SVG_NS, "svg");
    var attrs = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.75", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
    Object.keys(attrs).forEach(function (k) { svg.setAttribute(k, attrs[k]); });
    shapes.forEach(function (sh) {
      var n = document.createElementNS(SVG_NS, sh[0]);
      Object.keys(sh[1]).forEach(function (k) { n.setAttribute(k, sh[1][k]); });
      svg.appendChild(n);
    });
    return svg;
  };
  var ICON = {
    chat: function () { return icon([["path", { d: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.2A8 8 0 1 1 21 12z" }]]); },
    mail: function () { return icon([["rect", { x: "3", y: "5", width: "18", height: "14", rx: "2.5" }], ["path", { d: "m4 7 8 6 8-6" }]]); },
    code: function () { return icon([["path", { d: "m8 8-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12" }]]); }
  };
  var kv = function (k, v) { return el("div", "kv", [el("span", null, [k]), el("b", null, [v])]); };
  var ln = function (n, kids) { return el("div", null, [sp("ln", String(n))].concat(kids)); };
  var CTX = {
    chat: function () {
      return [el("div", "msg msg--out", ["Sync on the launch plan Wednesday?"]), el("div", "msg msg--in", ["Wednesday is packed, sorry."])];
    },
    mail: function () { return [kv("To", "Priya Nair"), kv("Subject", "Proposal follow-up")]; },
    code: function () {
      return [el("div", "code", [
        ln(1, [sp("k", "import"), " ", sp("p", "{"), " format ", sp("p", "}"), " ", sp("k", "from"), " ", sp("s", "\"date-fns\"")]),
        ln(2, [sp("k", "export function"), " ", sp("f", "parseDate"), sp("p", "("), "input", sp("p", ":"), " ", sp("k", "string"), sp("p", ") {")]),
        ln(3, ["  ", sp("k", "const"), " d ", sp("p", "="), " ", sp("k", "new"), " ", sp("f", "Date"), sp("p", "("), "input", sp("p", ")")])
      ])];
    }
  };

  /* words: [spoken, written]. written === null -> dropped (filler / repeat). */
  var SCENES = [
    {
      id: "chat", app: "Messages", sub: "Sam Rivera", icon: ICON.chat, ph: "Message Sam Rivera", ctx: CTX.chat,
      words: [["um", null], ["so", null], ["like", null], ["can", "Can"], ["we", "we"], ["move", "move"], ["the", "the"],
              ["uh", null], ["meeting", "meeting"], ["to", "to"], ["thursday", "Thursday?"]]
    },
    {
      id: "mail", app: "Mail", sub: "New message", icon: ICON.mail, ph: "Write your message", ctx: CTX.mail,
      words: [["hey", "Hi"], ["priya", "Priya,"], ["uh", null], ["just", "just"], ["following", "following"], ["up", "up"], ["on", "on"],
              ["the", "the"], ["the", null], ["proposal", "proposal."], ["i", "I"], ["think", "think"], ["we", "we"], ["can", "can"],
              ["like", null], ["start", "start"], ["on", "on"], ["monday", "Monday."]]
    },
    {
      id: "code", app: "Editor", sub: "utils/date.ts", icon: ICON.code, ph: "Add a comment", mono: true, ln: "4", ctx: CTX.code,
      words: [["todo", "// TODO:"], ["uh", null], ["refactor", "refactor"], ["this", "this"], ["function", "function"], ["to", "to"],
              ["like", null], ["handle", "handle"], ["time", "time"], ["zones", "zones"], ["properly", "properly"]]
    }
  ];

  /* ------------------------------------------------------------- Hush bar */
  var U_W = 240, U_H = 64;                    // logical canvas size (pill units)
  var SIZE = { idle: [44, 8], rec: [112, 34] };  // SPEC §7: idle 44x8, push-to-talk 112x34
  var NBARS = 13;
  var ACC = "124,207,192";                    // the site accent (soft mint), as r,g,b
  var BELL = [], PH = [], OM = [];
  for (var bi = 0; bi < NBARS; bi++) {
    BELL.push(Math.exp(-Math.pow((bi - 6) / 3.4, 2)) * 0.94 + 0.06);
    PH.push(bi * 1.7 + 0.6);
    OM.push(6 + ((bi * 37) % 11) * 0.55);
  }
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

  function spring(o, target, dt) {           // SPEC "pill" spring: stiffness 620, damping 40, mass .8
    var a = (620 * (target - o.x) - 40 * o.v) / 0.8;
    o.v += a * dt; o.x += o.v * dt;
  }
  function capsule(c, x, y, w, h) {
    var r = Math.min(h / 2, w / 2);
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  var bar = {
    ctx: canvas.getContext("2d"), s: 1, state: "idle", t: 0, time: 0,
    w: { x: SIZE.idle[0], v: 0 }, h: { x: SIZE.idle[1], v: 0 },
    barsA: 0, dot: 0, rec: 0, flash: 0, doneT: 1, amp: 0, speaking: false, hb: [], dirty: true,
    resize: function () {
      var k = (canvas.clientWidth || U_W) / U_W, dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(U_W * k * dpr); canvas.height = Math.round(U_H * k * dpr);
      this.s = k * dpr; this.dirty = true;
    },
    set: function (st) {
      this.state = st; this.t = 0;
      if (st === "rec") { this.doneT = 0; this.dot = 0; }
      if (st === "done") this.doneT = 0;
    },
    kick: function (v) { if (v > this.amp) this.amp = v; },
    update: function (dt) {
      var st = this.state, tw, th;
      this.t += dt; this.time += dt;
      if (st === "idle" || (st === "done" && this.t > 0.16)) { tw = SIZE.idle[0]; th = SIZE.idle[1]; }
      else { tw = SIZE.rec[0]; th = SIZE.rec[1]; }
      spring(this.w, tw, dt); spring(this.h, th, dt);

      var live = st === "rec" || st === "proc";
      this.rec += ((live ? 1 : 0) - this.rec) * (1 - Math.exp(-dt * 10));
      this.dot += ((st === "proc" ? 1 : st === "done" ? this.dot : 0) - this.dot) * (1 - Math.exp(-dt * 12));
      var barsT = st === "idle" ? 0 : 1;
      this.barsA += (barsT - this.barsA) * (1 - Math.exp(-dt * (barsT ? 16 : 22)));
      if (st === "done") this.doneT = clamp01(this.doneT + dt / 0.42);
      if (st === "done") this.flash = this.t < 0.08 ? this.t / 0.08 : Math.max(0, 1 - (this.t - 0.08) / 0.6);
      else this.flash *= Math.exp(-dt * 8);

      var floor = this.speaking ? 0.3 : 0.02;
      this.amp += (floor - this.amp) * (1 - Math.exp(-dt * 4.5));
      for (var i = 0; i < NBARS; i++) {
        var wob = 0.62 + 0.38 * Math.sin(this.time * OM[i] + PH[i]);
        var lvl = this.amp * BELL[i] * wob + 0.035 * (1 + Math.sin(this.time * 2.1 + i));
        var target = 4 + clamp01(lvl) * 24;
        var cur = this.hb[i] == null ? 4 : this.hb[i];
        var k = target > cur ? 0.35 : 0.12;
        this.hb[i] = cur + (target - cur) * (1 - Math.pow(1 - k, dt * 60));
      }
      var moving = Math.abs(this.w.x - tw) > 0.02 || Math.abs(this.h.x - th) > 0.02 || Math.abs(this.w.v) > 0.05;
      this.active = st !== "idle" || moving || this.flash > 0.004 || this.barsA > 0.004 || this.rec > 0.004;
    },
    draw: function () {
      var c = this.ctx, s = this.s, cx = U_W / 2, cy = U_H / 2;
      c.setTransform(s, 0, 0, s, 0, 0); c.clearRect(0, 0, U_W, U_H);
      var w = Math.max(this.w.x, 2), h = Math.max(this.h.x, 2), x = cx - w / 2, y = cy - h / 2, f = this.flash;

      if (this.rec > 0.01 || f > 0.01) {          // soft accent glow while listening / on paste
        c.save(); c.shadowColor = "rgba(" + ACC + "," + (0.13 * this.rec + 0.38 * f).toFixed(3) + ")";
        c.shadowBlur = 26 * s; c.fillStyle = "rgba(10,10,11,1)"; capsule(c, x, y, w, h); c.fill(); c.restore();
      }
      c.save();                                      // body + drop shadow
      c.shadowColor = "rgba(0,0,0,.5)"; c.shadowBlur = 16 * s; c.shadowOffsetY = 6 * s;
      c.fillStyle = "rgb(" + Math.round(10 + f * 0.4 * 114) + "," + Math.round(10 + f * 0.4 * 197) + "," + Math.round(11 + f * 0.4 * 181) + ")";
      capsule(c, x, y, w, h); c.fill(); c.restore();
      c.lineWidth = 1;
      c.strokeStyle = f > 0.01 ? "rgba(" + ACC + "," + (0.12 + 0.6 * f).toFixed(3) + ")" : "rgba(255,255,255,.14)";
      capsule(c, x + 0.5, y + 0.5, w - 1, h - 1); c.stroke();
      if (h > 20) {                                  // inset top highlight
        c.strokeStyle = "rgba(255,255,255,.08)"; c.beginPath();
        c.moveTo(x + h / 2, y + 1.5); c.lineTo(x + w - h / 2, y + 1.5); c.stroke();
      }

      if (this.barsA > 0.01) {                       // waveform bars -> dots + shimmer
        var sp = ((this.time * 1000 / 900) % 1) * 1.6 - 0.3;
        for (var i = 0; i < NBARS; i++) {
          var bx = cx - 37.5 + i * 6 + 1.5;
          var hh = this.hb[i] + (3 - this.hb[i]) * this.dot;
          var g = Math.exp(-Math.pow((i / 12 - sp) / 0.15, 2));
          var a = (0.92 * (1 - this.dot) + this.dot * (0.36 + 0.62 * g)) * this.barsA;
          if (this.state === "done" || (this.state === "idle" && this.doneT > 0)) {
            var delay = (6 - Math.abs(i - 6)) / 6 * 0.4;          // edges first, centre last
            var e = clamp01((this.doneT - delay) / 0.5);
            a *= 1 - e; hh = hh * (1 - e * 0.6);
          }
          if (a < 0.01) continue;
          c.fillStyle = "rgba(255,255,255," + a.toFixed(3) + ")";
          capsule(c, bx - 1.5, cy - hh / 2, 3, hh); c.fill();
        }
      }
    }
  };

  var running = false, rafId = 0, last = 0;
  function frame(ts) {
    if (!running) return;
    var dt = Math.min((ts - last) / 1000 || 0.016, 1 / 30); last = ts;
    bar.update(dt);
    if (bar.active || bar.dirty) { bar.draw(); bar.dirty = bar.active; }
    rafId = requestAnimationFrame(frame);
  }
  function loopOn() { if (running) return; running = true; last = performance.now(); rafId = requestAnimationFrame(frame); }
  function loopOff() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  if (window.ResizeObserver) new ResizeObserver(function () { bar.resize(); }).observe(canvas);
  else window.addEventListener("resize", function () { bar.resize(); });
  bar.resize();

  /* -------------------------------------------------------------- helpers */
  function setKeys(down) {
    Array.prototype.forEach.call(keyEls, function (k, i) {
      if (down) setTimeout(function () { k.classList.add("is-down"); }, i * 70);
      else k.classList.remove("is-down");
    });
  }

  var toks = [], caret = null, sceneIdx = 0;

  function renderScene(sc, finalState) {
    appEl.textContent = sc.app; subEl.textContent = sc.sub;
    glyphEl.textContent = ""; glyphEl.appendChild(sc.icon());
    ctxEl.textContent = ""; sc.ctx().forEach(function (n) { ctxEl.appendChild(n); });
    fieldEl.className = "field" + (sc.mono ? " field--code" : "");
    textEl.setAttribute("data-ln", sc.ln || "");
    textEl.textContent = "";
    var k = 0;
    toks = sc.words.map(function (w) {
      var el = document.createElement("span");
      el.className = "tok"; el.textContent = w[0];
      var t = { el: el, raw: w[0], clean: w[1], drop: w[1] === null, changed: w[1] !== null && w[1] !== w[0] };
      if (t.drop) { el.classList.add("tok--drop"); el.style.setProperty("--fi", k++); }
      return t;
    });
    caret = document.createElement("i"); caret.className = "caret";
    if (finalState) {                                  // static: clean text only
      toks.forEach(function (t) {
        if (t.drop) return;
        t.el.textContent = t.clean; t.el.classList.add("is-on", "is-clean"); textEl.appendChild(t.el);
      });
      fieldEl.classList.add("is-clean");
    } else {
      var ph = document.createElement("span"); ph.className = "ph"; ph.textContent = sc.ph + "…"; ph.setAttribute("data-ph", "");
      textEl.appendChild(ph);
    }
    textEl.appendChild(caret);
  }

  var STOP = {}, runId = 0, alive = false;
  function mkWait(id) {
    return function (ms) {
      return new Promise(function (res, rej) {
        setTimeout(function () { (alive && id === runId) ? res() : rej(STOP); }, ms);
      });
    };
  }

  function morph(w) {
    var drops = toks.filter(function (t) { return t.drop; });
    var keeps = toks.filter(function (t) { return !t.drop; });
    drops.forEach(function (t) { t.el.classList.add("is-out"); });
    return w(280).then(function () {
      var first = keeps.map(function (t) { return t.el.getBoundingClientRect(); });   // FIRST
      drops.forEach(function (t) { t.el.style.display = "none"; });
      keeps.forEach(function (t) {
        if (t.changed) t.el.textContent = t.clean;
        t.el.classList.add("is-clean");
      });
      fieldEl.classList.add("is-clean", "is-morph");
      keeps.forEach(function (t, i) {                                                   // LAST + INVERT + PLAY
        var l = t.el.getBoundingClientRect(), f = first[i];
        if (!t.el.animate) return;
        var dx = f.left - l.left, dy = f.top - l.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          t.el.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "translate(0,0)" }],
            { duration: 640, delay: i * 34, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" });
        }
        if (t.changed) {
          t.el.animate([{ opacity: 0.15, filter: "blur(5px)" }, { opacity: 1, filter: "blur(0px)" }],
            { duration: 460, delay: i * 34 + 90, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" });
        }
      });
      return w(900).then(function () { fieldEl.classList.remove("is-morph"); });
    });
  }

  function runScene(sc, w) {
    var p = w(700);
    return p.then(function () {
      bar.set("rec"); bar.speaking = true; setKeys(true); fieldEl.classList.add("is-live");
      return w(520);
    }).then(function () {
      var i = 0;
      var ph = textEl.querySelector("[data-ph]");
      function next() {
        if (i >= toks.length) return w(380);
        var t = toks[i++];
        if (ph) { ph.remove(); ph = null; }
        textEl.insertBefore(t.el, caret);
        void t.el.offsetWidth;
        t.el.classList.add("is-on");
        bar.kick(0.5 + Math.min(t.raw.length, 8) / 8 * 0.4 + Math.random() * 0.1);
        var d = 105 + t.raw.length * 34 + Math.random() * 70 + (t.drop ? 50 : 0);
        return w(d).then(next);
      }
      return next();
    }).then(function () {
      bar.speaking = false; setKeys(false); bar.set("proc"); fieldEl.classList.remove("is-live");
      toks.forEach(function (t) { if (t.drop) t.el.classList.add("is-flag"); });
      return w(1250);
    }).then(function () {
      bar.set("done");
      return morph(w);
    }).then(function () { return w(2700); })
      .then(function () {
        win.classList.add("is-swapping");
        return w(340);
      }).then(function () {
        bar.set("idle");
        sceneIdx = (sceneIdx + 1) % SCENES.length;
        renderScene(SCENES[sceneIdx], false);
        void win.offsetWidth;
        win.classList.remove("is-swapping");
        return w(0);
      });
  }

  function loop(w) {
    return runScene(SCENES[sceneIdx], w).then(function () { return loop(w); });
  }

  function start() {
    if (alive) return;
    alive = true; runId++;
    var w = mkWait(runId);
    bar.speaking = false; bar.set("idle"); setKeys(false);
    renderScene(SCENES[sceneIdx], false);
    win.classList.remove("is-swapping");
    loopOn();
    loop(w).catch(function (e) { if (e !== STOP && window.console) console.error(e); });
  }
  function stop() { alive = false; runId++; loopOff(); }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    if (reduced) {                                    // static, final state: clean text, idle bar
      renderScene(SCENES[0], true);
      bar.draw();
      root.classList.add("is-ready");
      return;
    }
    renderScene(SCENES[0], false);
    root.classList.add("is-ready");
    var visible = false, tabOn = !document.hidden;
    var sync = function () { (visible && tabOn) ? start() : stop(); };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; sync(); }, { threshold: 0.2 }).observe(root);
    } else { visible = true; sync(); }
    document.addEventListener("visibilitychange", function () { tabOn = !document.hidden; sync(); });
  }

  var go = function () { boot(); };
  if (document.fonts && document.fonts.ready) {
    var done = false, once = function () { if (!done) { done = true; go(); } };
    document.fonts.ready.then(once); setTimeout(once, 1800);
  } else go();
})();
