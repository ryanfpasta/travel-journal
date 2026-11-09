(function () {
  "use strict";

  var S = Store.S;
  var MOODS = ["😞", "😕", "😐", "🙂", "😄"];
  var KINDS = { MEAL: "Meal", EXPERIENCE: "Experience", NOTE: "Note" };
  var view = document.getElementById("view");
  var busy = false;

  // ---- Small helpers ----

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function mb(n) { return n >= 1e9 ? (n / 1e9).toFixed(1) + " GB" : Math.max(1, Math.round(n / 1e6)) + " MB"; }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

  // ---- Trips and colours ----

  // Each trip has its own colour scheme (Material 3 roles, shared with the Android app).
  // l / d = light / dark: primary, onPrimary, primaryContainer, onPrimaryContainer, secondaryContainer,
  // onSecondaryContainer, background, lowest, low, container, high, highest, onSurface,
  // onSurfaceVariant, outline, outlineVariant, inverseSurface, inverseOnSurface, error, tertiary.
  // Copied from the shared design-tokens.json by tools/tokens.py; don't edit by hand.
  var SCHEMES = {
    red: {"name":"China Red","l":["#B3261E","#FFFFFF","#FFDAD5","#910809","#FD9486","#762B23","#FFFBF7","#FFFFFF","#FFF1E9","#FAEBE3","#F4E5DE","#EEE0D8","#261816","#5A403D","#8E706C","#E2BEB9","#3D2C2A","#FFEDEA","#BA1A1A","#7C5800"],"d":["#FFB4AA","#690003","#910809","#FFDAD5","#7D3028","#FF9F92","#1D100E","#180B09","#261816","#2B1C1A","#362624","#42312E","#F8DCD9","#E2BEB9","#A98985","#5A403D","#F8DCD9","#3D2C2A","#FFB4AB","#FABC3A"]},
    blue: {"name":"Ocean Blue","l":["#1F6FB2","#FFFFFF","#D1E4FF","#00497C","#C7DFFF","#4C637E","#FFFBF7","#FFFFFF","#FFF1E9","#FAEBE3","#F4E5DE","#EEE0D8","#191C20","#414750","#717781","#C1C7D2","#2E3135","#EFF0F7","#BA1A1A","#7C5800"],"d":["#9ECAFF","#003258","#00497C","#D1E4FF","#344B65","#A3BAD9","#101418","#0B0E13","#191C20","#1D2024","#272A2F","#32353A","#E1E2E8","#C1C7D2","#8B919B","#414750","#E1E2E8","#2E3135","#FFB4AB","#FABC3A"]},
    green: {"name":"Forest Green","l":["#2E7D4F","#FFFFFF","#A4F4BC","#00522C","#CAEBD0","#4E6B56","#FFFBF7","#FFFFFF","#FFF1E9","#FAEBE3","#F4E5DE","#EEE0D8","#181D19","#3F4941","#6F7A70","#BFC9BE","#2D322D","#EEF2EB","#BA1A1A","#7C5800"],"d":["#88D7A1","#00391D","#00522C","#A4F4BC","#334F3B","#A0C0A7","#101411","#0B0F0C","#181D19","#1C211D","#272B27","#313632","#E0E4DD","#BFC9BE","#899389","#3F4941","#E0E4DD","#2D322D","#FFB4AB","#FABC3A"]},
    teal: {"name":"Lagoon Teal","l":["#006A64","#FFFFFF","#9EF2E9","#00504B","#C9E9E5","#4D6A67","#FFFBF7","#FFFFFF","#FFF1E9","#FAEBE3","#F4E5DE","#EEE0D8","#181C1C","#3E4947","#6E7977","#BEC9C7","#2D3130","#EEF1F0","#BA1A1A","#7C5800"],"d":["#84D5CD","#003734","#00504B","#A0F1E9","#2F4C49","#9CBBB7","#101414","#0B0F0E","#181C1C","#1C2020","#272B2A","#313635","#E0E3E2","#BEC9C7","#889391","#3E4947","#E0E3E2","#2D3130","#FFB4AB","#FABC3A"]},
    orange: {"name":"Sunset Orange","l":["#C5531D","#FFFFFF","#FFDBCE","#7E2C00","#FDB294","#78422B","#FFFBF7","#FFFFFF","#FFF1E9","#FAEBE3","#F4E5DE","#EEE0D8","#241915","#57423A","#8B7268","#DFC0B5","#3B2E29","#FFEDE7","#BA1A1A","#7C5800"],"d":["#FFB598","#591D00","#7E2C00","#FFDBCE","#6F3B25","#F0A78A","#1B110D","#160C08","#241915","#291D18","#342722","#3F322D","#F4DED6","#DFC0B5","#A68B81","#57423A","#F4DED6","#3B2E29","#FFB4AB","#FABC3A"]},
    plum: {"name":"Plum","l":["#7B3F8C","#FFFFFF","#FBD7FF","#682D79","#FAD7FE","#775B7C","#FFFBF7","#FFFFFF","#FFF1E9","#FAEBE3","#F4E5DE","#EEE0D8","#1F1A1F","#4E444E","#7F737F","#D1C2CF","#342F34","#F9EEF5","#BA1A1A","#7C5800"],"d":["#F1AFFF","#4F1361","#682D79","#FBD7FF","#5A405F","#CFAED3","#171217","#110D12","#1F1A1F","#231E23","#2E282E","#393339","#EADFE7","#D1C2CF","#9A8D99","#4E444E","#EADFE7","#342F34","#FFB4AB","#FABC3A"]},
    charcoal: {"name":"Charcoal","l":["#3C4043","#FFFFFF","#E0E3E6","#43474A","#E0DFE1","#626364","#FFFBF7","#FFFFFF","#FFF1E9","#FAEBE3","#F4E5DE","#EEE0D8","#1C1B1C","#44474A","#74777A","#C4C7CA","#313030","#F3F0F0","#BA1A1A","#7C5800"],"d":["#C4C7CA","#2D3134","#43474A","#E0E3E6","#48494A","#B8B8B9","#131313","#0E0E0E","#1C1B1C","#201F20","#2A2A2A","#353535","#E5E2E1","#C4C7CA","#8E9194","#44474A","#E5E2E1","#313030","#FFB4AB","#FABC3A"]},
  };
  var ROLE_VARS = ["--primary", "--on-primary", "--pc", "--on-pc", "--sc", "--on-sc", "--bg", "--lowest", "--card", "--sc1", "--sc2", "--sc3",
    "--text", "--muted", "--outline", "--line", "--inverse", "--on-inverse", "--error", "--tertiary"];
  function schemeKey() { var t = Store.trip(); return t && SCHEMES[t.scheme] ? t.scheme : "red"; }
  function scheme() { return SCHEMES[schemeKey()]; }
  function swatch(k) { return (SCHEMES[k] || SCHEMES.red).l[0]; }
  function isDark() { return matchMedia("(prefers-color-scheme: dark)").matches; }
  function applyScheme() {
    var c = scheme(), el = $("#schemeStyle");
    if (!el) { el = document.createElement("style"); el.id = "schemeStyle"; document.head.appendChild(el); }
    function vars(list) { return ROLE_VARS.map(function (v, i) { return v + ":" + list[i]; }).join(";"); }
    el.textContent = ":root{" + vars(c.l) + "}@media (prefers-color-scheme: dark){:root{" + vars(c.d) + "}}";
    var meta = $('meta[name="theme-color"]'); if (meta) meta.content = isDark() ? c.d[6] : c.l[6];
  }
  function mapColour() { return isDark() ? scheme().d[0] : scheme().l[0]; }
  function tripName() { var t = Store.trip(); return t ? t.name : "My trip"; }
  function tripPill() {
    return '<button class="trip-pill" data-trips aria-label="Trip in use: ' + esc(tripName()) + '. Switch trip">' +
      '<span class="label">' + esc(tripName()) + "</span>" + icon("keyboard_arrow_down", false, "sm") + "</button>";
  }
  /** Top app bar. Main tabs show a large title below it that collapses into the bar on scroll. */
  function appbar(title, opts) {
    opts = opts || {};
    return '<header class="appbar' + (opts.solid ? " solid" : "") + '">' +
      (opts.back ? '<button class="back" data-back>' + icon("chevron_left") + esc(opts.backLabel || "Back") + "</button>" : "") +
      '<div class="appbar-title">' + esc(title) + "</div>" + (opts.right || "") + "</header>";
  }
  function mainHeader(title) { return appbar(title, { right: tripPill() }) + '<h1 class="large-title">' + esc(title) + "</h1>"; }
  function emptyState(ic, line, btn) {
    return '<div class="empty"><div class="bubble">' + icon(ic) + "</div><p>" + line + "</p>" + (btn || "") + "</div>";
  }
  function fab() { return '<button class="fab" id="fab" aria-label="Add a photo or video">' + icon("photo_camera") + '<span class="fab-label">Photo</span></button>'; }
  function notice(ic, html, cls, href, attrs) {
    var inner = icon(ic) + "<div>" + html + "</div>";
    return href ? '<a class="card notice ' + (cls || "") + '" href="' + href + '"' + (attrs || "") + ">" + inner + "</a>" : '<div class="card notice ' + (cls || "") + '">' + inner + "</div>";
  }
  function ago(utc) {
    if (!utc) return "never";
    var d = Math.round((Store.dateObj(Store.today()) - Store.dateObj(Store.localDate(utc))) / 864e5);
    return d <= 0 ? "today at " + Store.clock(utc, Store.zone()) : d === 1 ? "yesterday" : d + " days ago";
  }

  /** What the Photo button offers: the iPhone camera, video, the built-in camera, or the library. */
  function captureSheet(date, placeId) {
    var html = "<h3>Add to the journal</h3><div class=\"actions\">" +
      '<button class="action" data-a="photo"><span class="lead">' + icon("photo_camera") + '</span><div>Take a photo</div></button>' +
      '<button class="action" data-a="video"><span class="lead">' + icon("videocam") + '</span><div>Record a video</div></button>' +
      '<button class="action" data-a="library"><span class="lead">' + icon("photo_library") + '</span><div>Choose from library<span class="sub">Photos and videos, many at once</span></div></button>' +
      '<button class="action" data-a="builtin"><span class="lead">' + icon("add_a_photo") + '</span><div>Built-in camera<span class="sub">Try this if the camera opens black</span></div></button>' +
      "</div>";
    var sh = sheet(html, [{ label: "Camera trouble?", cls: "text", onClick: cameraHelp }, { label: "Cancel" }]);
    $$("[data-a]", sh.el).forEach(function (b) {
      b.onclick = function () {
        sh.close();
        var a = b.dataset.a;
        if (a === "photo") takePhoto(date, placeId);
        else if (a === "video") takeVideo(date, placeId);
        else if (a === "library") importPhotos(date, placeId);
        else builtInCamera(date, placeId);
      };
    });
  }
  function tripDates(t) {
    if (!t.startDate) return "";
    return Store.shortDay(t.startDate) + (t.endDate && t.endDate !== t.startDate ? " – " + Store.shortDay(t.endDate) : "") + " " + t.startDate.slice(0, 4);
  }
  function safeName(s) { return String(s || "trip").replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "trip"; }

  /** Quick switcher, opened from the trip name at the top of the main tabs. */
  function tripSheet() {
    var cur = Store.trip();
    var html = "<h3>Your trips</h3><div class=\"pick-list\">" + Store.trips().map(function (t) {
      var n = Store.tripCounts(t.id);
      return '<button class="row' + (t.id === cur.id ? " current" : "") + '" data-id="' + t.id + '"><div class="body"><b>' + esc(t.name) + "</b>" +
        '<div class="muted">' + esc([tripDates(t), plural(n.photos, "photo")].filter(Boolean).join(" · ")) + '</div></div>' + (t.id === cur.id ? icon("check") : "") + '<span class="swatch" style="background:' + swatch(t.scheme) + '"></span></button>';
    }).join("") + "</div>";
    var sh = sheet(html, [{ label: "Close" }, { label: "New trip", cls: "primary", onClick: newTripSheet }]);
    $$(".pick-list .row", sh.el).forEach(function (b) {
      b.onclick = async function () { sh.close(); if (b.dataset.id !== cur.id) { await Store.switchTrip(b.dataset.id); calMonth = null; applyScheme(); toast("Now using " + tripName() + "."); } };
    });
  }

  function newTripSheet() {
    var opts = Object.keys(SCHEMES);
    var pick = opts[(Store.trips().length) % opts.length];
    var html = "<h3>New trip</h3>" +
      '<label class="lbl">Name</label><input id="ntName" placeholder="New Zealand 2027" autocomplete="off">' +
      '<div class="two"><div><label class="lbl">First day</label><input type="date" id="ntStart"></div><div><label class="lbl">Last day</label><input type="date" id="ntEnd"></div></div>' +
      '<label class="lbl">Colour</label>' + schemePicker(pick) +
      '<p class="muted small">Photos, places and notes go into the trip in use, so switch to the right trip before you go. You can change all of this later under More.</p>';
    var sh = sheet(html, [{ label: "Cancel" }, { label: "Create", cls: "primary", keepOpen: true, onClick: async function () {
      var name = $("#ntName").value.trim();
      if (!name) { $("#ntName").focus(); return toast("Give the trip a name first."); }
      var start = $("#ntStart").value, end = $("#ntEnd").value;
      if (start && end && end < start) return toast("The last day is before the first day.");
      sh.close();
      await Store.createTrip({ name: name, startDate: start, endDate: end || start, scheme: pick });
      calMonth = null; applyScheme();
      go("#/today");
      toast(name + " is now the trip in use.");
    } }]);
    bindSchemePicker(sh.el, function (k) { pick = k; });
  }

  function schemePicker(cur) {
    return '<div class="schemes">' + Object.keys(SCHEMES).map(function (k) {
      return '<button class="scheme' + (k === cur ? " on" : "") + '" data-scheme="' + k + '" style="--c:' + swatch(k) + '" aria-pressed="' + (k === cur) + '"><span></span>' + SCHEMES[k].name + "</button>";
    }).join("") + "</div>";
  }
  function bindSchemePicker(root, onPick) {
    $$("[data-scheme]", root).forEach(function (b) {
      b.onclick = function () { $$("[data-scheme]", root).forEach(function (x) { x.classList.toggle("on", x === b); }); onPick(b.dataset.scheme); };
    });
  }

  function toast(msg, ms) {
    var t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, ms || 3500);
  }

  /** Bottom sheet. buttons: [{label, cls, onClick}] ; returns a close function. */
  function sheet(html, buttons) {
    var wrap = $("#sheet");
    wrap.innerHTML = '<div class="sheet-card">' + html + '<div class="sheet-buttons"></div></div>';
    var row = $(".sheet-buttons", wrap);
    function close() { wrap.hidden = true; wrap.innerHTML = ""; }
    (buttons || [{ label: "OK" }]).forEach(function (b) {
      var el = document.createElement("button");
      el.className = "btn " + (b.cls || "");
      el.textContent = b.label;
      el.onclick = function () { if (!b.keepOpen) close(); if (b.onClick) b.onClick(); };
      row.appendChild(el);
    });
    wrap.onclick = function (e) { if (e.target === wrap) close(); };
    wrap.hidden = false;
    return { close: close, el: wrap };
  }

  function confirmSheet(msg, yesLabel, onYes) {
    sheet("<p>" + esc(msg) + "</p>", [{ label: "Cancel" }, { label: yesLabel, cls: "danger", onClick: onYes }]);
  }

  function moodPicker(name, val) {
    return '<div class="mood" data-field="' + name + '">' + MOODS.map(function (m, i) {
      return '<button class="' + (val === i + 1 ? "on" : "") + '" data-v="' + (i + 1) + '" aria-label="Mood ' + (i + 1) + '">' + m + "</button>";
    }).join("") + "</div>";
  }
  function stars(name, val) {
    var s = '<div class="stars" data-field="' + name + '">';
    for (var i = 1; i <= 5; i++) s += '<button class="' + (val >= i ? "on" : "") + '" data-v="' + i + '" aria-label="' + i + ' stars">★</button>';
    return s + "</div>";
  }
  function starText(n) { return n ? '<span class="startext">' + "★".repeat(n) + "☆".repeat(5 - n) + "</span>" : ""; }
  function moodText(n) { return n ? MOODS[n - 1] : ""; }

  /** Wires mood and star pickers: tapping the current value again clears it. */
  function bindPickers(root, current, save) {
    $$(".mood, .stars", root).forEach(function (box) {
      box.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        var field = box.dataset.field, v = +b.dataset.v;
        var next = current()[field] === v ? null : v;
        var change = {}; change[field] = next;
        save(change);
        $$("button", box).forEach(function (x) {
          var xv = +x.dataset.v;
          x.classList.toggle("on", box.classList.contains("stars") ? next != null && xv <= next : xv === next);
        });
      });
    });
  }

  /** Text fields save as you type (and immediately when you leave the field or the app). */
  var pendingSaves = new Map();
  function bindAutosave(root, save) {
    $$("[data-autosave]", root).forEach(function (input) {
      var key = input.dataset.autosave;
      var status = document.createElement("div");
      status.className = "save-status"; status.setAttribute("aria-live", "polite");
      input.insertAdjacentElement("afterend", status);
      function show(t) { status.innerHTML = t; status.classList.toggle("on", !!t); }
      function flush() {
        var p = pendingSaves.get(input); if (!p) return;
        clearTimeout(p); pendingSaves.delete(input);
        var c = {}; c[key] = input.value;
        Promise.resolve(save(c)).then(function () { show(icon("check", false, "sm") + "Saved"); clearTimeout(status._t); status._t = setTimeout(function () { show(""); }, 2000); });
      }
      input.addEventListener("input", function () {
        show("Saving…");
        clearTimeout(pendingSaves.get(input));
        pendingSaves.set(input, setTimeout(flush, 500));
        input._flush = flush;
      });
      input.addEventListener("focus", function () { doneBar.show(input); });
      input.addEventListener("blur", function () { flush(); doneBar.hide(input); });
      if (input.tagName === "INPUT") input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); input.blur(); } });
      input._flush = flush;
    });
  }

  /** A "Done" pill that sits just above the keyboard while a text field is being edited. */
  var doneBar = (function () {
    var el = null, cur = null;
    function place() {
      if (!el) return;
      var vv = window.visualViewport;
      var bottom = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      el.style.bottom = (bottom + 10) + "px";
    }
    function ensure() {
      if (el) return;
      el = document.createElement("button");
      el.id = "doneBar"; el.type = "button"; el.innerHTML = icon("check") + "Done"; el.hidden = true;
      el.addEventListener("pointerdown", function (e) { e.preventDefault(); });
      el.onclick = function () { if (cur) { if (cur._flush) cur._flush(); cur.blur(); } };
      document.body.appendChild(el);
      if (window.visualViewport) { visualViewport.addEventListener("resize", place); visualViewport.addEventListener("scroll", place); }
    }
    return {
      show: function (input) { ensure(); cur = input; el.hidden = false; place(); },
      hide: function (input) { if (cur === input) { cur = null; if (el) el.hidden = true; } },
    };
  })();
  function flushAll() { $$("[data-autosave]").forEach(function (i) { if (i._flush) i._flush(); }); }

  function hydrateThumbs(root) {
    $$("img[data-photo]", root).forEach(function (img) {
      var p = S.photos.get(img.dataset.photo);
      img.onload = function () { img.classList.add("ready"); };
      if (p) Photos.thumbUrl(p).then(function (u) { if (u) img.src = u; });
    });
  }
  function duration(ms) { return ms ? Math.floor(ms / 60000) + ":" + String(Math.round(ms / 1000) % 60).padStart(2, "0") : ""; }
  function thumb(p) {
    var vid = Photos.isVideo(p) ? '<span class="vbadge">' + icon("play_arrow", true) + duration(p.durationMs) + "</span>" : "";
    var badge = vid + (p.locStatus === "APPROX" ? '<span class="badge" title="Approximate place">≈</span>' : p.locStatus === "NONE" ? '<span class="badge" title="No place">?</span>' : "");
    return '<a href="#/photo/' + p.id + '" class="thumb" aria-label="' + (Photos.isVideo(p) ? "Video" : "Photo") + (p.caption ? ": " + esc(p.caption) : "") + '"><img data-photo="' + p.id + '" alt="">' + badge + "</a>";
  }
  function thumbGrid(photos, cls) {
    if (!photos.length) return "";
    return '<div class="' + (cls || "grid") + '">' + photos.map(thumb).join("") + "</div>";
  }

  function placeName(id) { var p = id && S.places.get(id); return p ? p.name : ""; }
  function placeRow(p) {
    var ph = Store.placePhotos(p.id), n = ph.length, first = ph[0];
    var time = first ? Store.clock(first.takenAtUtc, first.tzId) : "";
    return '<a class="row" href="#/place/' + p.id + '"><span class="lead">' + icon("location_on", true) + '</span><div class="body"><b>' + esc(p.name) + "</b>" +
      '<div class="muted">' + esc([p.city, time, ].filter(Boolean).join(" · ") || "Tap to name it") + '</div></div><div class="right">' +
      starText(p.rating) + (p.mood ? " " + moodText(p.mood) : "") + icon("chevron_right", false, "sm") + "</div></a>";
  }
  var KIND_ICON = { MEAL: "restaurant", EXPERIENCE: "star", NOTE: "notes" };
  function entryRow(e) {
    var title = e.title || (e.note ? e.note.slice(0, 60) : KINDS[e.kind] || "Note");
    return '<a class="row" href="#/entry/' + e.id + '"><span class="lead">' + icon(KIND_ICON[e.kind] || "notes", e.kind === "EXPERIENCE") + '</span><div class="body"><b>' + esc(title) + "</b>" +
      '<div class="muted">' + esc([KINDS[e.kind], placeName(e.placeId)].filter(Boolean).join(" · ")) + "</div>" +
      '</div><div class="right">' + starText(e.rating) + (e.mood ? " " + moodText(e.mood) : "") + "</div></a>";
  }

  /** Lets the person choose a place. onPick(placeOrNull). Nearest to `near` first, else most recent. */
  function pickPlace(near, onPick, allowNone) {
    var list = Store.values(S.places);
    if (near && near.lat != null) list.sort(function (a, b) { return Store.distanceM(a.lat, a.lon, near.lat, near.lon) - Store.distanceM(b.lat, b.lon, near.lat, near.lon); });
    else list.sort(function (a, b) { return b.createdAtUtc - a.createdAtUtc; });
    var html = "<h3>Choose a place</h3>" + (list.length ? "" : '<p class="muted">No places yet. Tap Sync now on the Today tab to start one.</p>') +
      '<div class="pick-list">' + (allowNone ? '<button class="row" data-id=""><span class="lead">' + icon("location_off") + '</span><div class="body"><b>No place</b></div></button>' : "") +
      list.map(function (p) {
        var d = near && near.lat != null ? Store.distanceM(p.lat, p.lon, near.lat, near.lon) : null;
        return '<button class="row" data-id="' + p.id + '"><span class="lead">' + icon("location_on", true) + '</span><div class="body"><b>' + esc(p.name) + "</b>" + (p.city ? '<div class="muted">' + esc(p.city) + "</div>" : "") +
          "</div>" + (d != null ? '<div class="right">' + (d < 1000 ? Math.round(d) + " m" : (d / 1000).toFixed(1) + " km") + "</div>" : "") + "</button>";
      }).join("") + "</div>";
    var sh = sheet(html, [{ label: "Cancel" }]);
    $$(".pick-list .row", sh.el).forEach(function (b) {
      b.onclick = function () { sh.close(); onPick(b.dataset.id ? S.places.get(b.dataset.id) : null); };
    });
  }

  // ---- Storage ----

  var storageLevel = "OK";
  async function checkStorage() {
    try {
      var est = await navigator.storage.estimate();
      var free = (est.quota || 0) - (est.usage || 0);
      storageLevel = free < 150e6 ? "CRITICAL" : free < 1e9 ? "LOW" : "OK";
      return { usage: est.usage || 0, quota: est.quota || 0, free: free };
    } catch (e) { return null; }
  }
  async function askPersist() {
    try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { }
    return false;
  }
  function isInstalled() { return navigator.standalone === true || matchMedia("(display-mode: standalone)").matches; }

  // ---- Taking and importing photos ----

  var pickTarget = { date: null, placeId: null };
  function takePhoto(date, placeId) {
    if (storageLevel === "CRITICAL") return toast("The phone is almost full, so new photos are paused. Free some space first.", 6000);
    pickTarget = { date: date || null, placeId: placeId || null };
    askPersist();
    var input = $(takePhoto.video ? "#videoInput" : "#cameraInput");
    takePhoto.video = false;
    input.value = "";
    input.click();
  }
  function takeVideo(date, placeId) { takePhoto.video = true; takePhoto(date, placeId); }

  // ---- Built-in camera ----
  // A second way to take photos: a live preview inside the app (getUserMedia) instead of the iPhone's
  // camera screen. Useful when the iPhone's camera screen opens black from a Home Screen web app.
  var camStream = null, camFacing = "environment";
  function stopCam() {
    if (camStream) camStream.getTracks().forEach(function (t) { t.stop(); });
    camStream = null;
    var o = $("#camOverlay"); if (o) o.remove();
  }
  async function startCam(video) {
    if (camStream) camStream.getTracks().forEach(function (t) { t.stop(); });
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: camFacing }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
    video.srcObject = camStream;
    await video.play();
  }
  async function builtInCamera(date, placeId) {
    if (storageLevel === "CRITICAL") return toast("The phone is almost full, so new photos are paused. Free some space first.", 6000);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast("This browser has no built-in camera support. Use the Camera app, then Add from library.", 6000);
    pickTarget = { date: date || null, placeId: placeId || null };
    askPersist();
    var o = document.createElement("div");
    o.id = "camOverlay";
    o.innerHTML = '<video id="camVideo" autoplay muted playsinline></video>' +
      '<div class="cam-msg" id="camMsg">Starting the camera…</div>' +
      '<div class="cam-bar"><button class="cam-btn" id="camClose" aria-label="Close">' + icon("close") + '</button>' +
      '<button class="cam-shutter" id="camShoot" aria-label="Take photo"></button>' +
      '<button class="cam-btn" id="camFlip" aria-label="Switch camera">' + icon("flip_camera_ios") + '</button></div>';
    document.body.appendChild(o);
    var video = $("#camVideo", o), shots = 0;
    $("#camClose", o).onclick = stopCam;
    async function begin() {
      try { await startCam(video); $("#camMsg", o).hidden = true; }
      catch (e) {
        var denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
        $("#camMsg", o).innerHTML = denied
          ? "The iPhone blocked the camera for this app.<br>Open <b>Settings → Apps</b>, pick the browser you installed the journal from (<b>Safari</b>, <b>Edge</b>, <b>Chrome</b>…), set <b>Camera</b> to <b>Allow</b>, then close and reopen the journal."
          : "The camera couldn't start (" + esc(e && (e.name || e.message)) + ").<br>Use the Camera app, then Add from library.";
      }
    }
    $("#camFlip", o).onclick = function () { camFacing = camFacing === "environment" ? "user" : "environment"; begin(); };
    $("#camShoot", o).onclick = function () {
      if (!video.videoWidth) return;
      var c = document.createElement("canvas");
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext("2d").drawImage(video, 0, 0);
      o.classList.add("flash"); setTimeout(function () { o.classList.remove("flash"); }, 150);
      c.toBlob(function (b) {
        c.width = c.height = 0;
        if (!b) return toast("That photo couldn't be saved. Try again.");
        shots++;
        handleFiles([new File([b], "camera-" + Date.now() + ".jpg", { type: "image/jpeg", lastModified: Date.now() })], "CAMERA");
      }, "image/jpeg", 0.9);
    };
    begin();
    setTimeout(function () {
      var m = $("#camMsg", o);
      if (m && document.body.contains(o) && !video.videoWidth) { m.hidden = false; m.innerHTML = "Still black? Restart the iPhone and try again. Meanwhile, the Camera app plus <b>Add from library</b> always works."; }
    }, 8000);
  }

  function cameraHelp() {
    sheet("<h3>Camera shows a black screen?</h3>" +
      "<p>Try the <b>built-in camera</b> first: it works differently from the iPhone's camera screen and often works when that one stays black.</p>" +
      "<p>If both stay black:</p>" +
      "<ol><li>Open <b>Settings → Apps</b> and pick the browser you added the journal from: <b>Safari</b>, <b>Edge</b>, <b>Chrome</b> or another. Set <b>Camera</b> to <b>Allow</b> or <b>Ask</b>. (Older iPhones: <b>Settings → Safari → Camera</b>.)</li>" +
      "<li>If that's already on, check <b>Settings → Screen Time → Content &amp; Privacy Restrictions → Allowed Apps</b> and make sure <b>Camera</b> is on.</li>" +
      "<li>Swipe the journal away in the app switcher, open it again from the Home Screen icon, and try again.</li>" +
      "<li>Restart the iPhone. iOS sometimes leaves the camera stuck for web apps until a restart.</li></ol>" +
      "<p><b>Always works:</b> take the picture with the normal Camera app, then tap <b>Add from library</b> here. The photo keeps its time and location.</p>",
      [{ label: "Close" }, { label: "📸 Built-in camera", cls: "primary", onClick: function () { builtInCamera(null, null); } }]);
  }

  function importPhotos(date, placeId) {
    if (storageLevel === "CRITICAL") return toast("The phone is almost full, so new photos are paused. Free some space first.", 6000);
    pickTarget = { date: date || null, placeId: placeId || null };
    askPersist();
    $("#libraryInput").value = "";
    $("#libraryInput").click();
  }
  async function handleFiles(files, source) {
    if (!files || !files.length) return;
    files = Array.prototype.slice.call(files);
    toast(source === "CAMERA" ? "Saving…" : "Adding " + plural(files.length, "photo") + "…", 60000);
    var r = await Photos.addFiles(files, {
      source: source, date: pickTarget.date, placeId: pickTarget.placeId,
      onSaved: function (n, total) { if (total > 1) toast("Saved " + n + " of " + total + "…", 60000); },
    });
    var msg = (r.videos ? (r.saved - r.videos ? plural(r.saved - r.videos, "photo") + " and " : "") + plural(r.videos, "video") : plural(r.saved, "photo")) + " saved";
    if (r.tooBig) msg += ", " + plural(r.tooBig, "video") + " over 300 MB skipped (trim it in Photos first)";
    if (r.failed) msg += ", " + r.failed + " couldn't be read";
    if (r.location === "denied") msg += ". Location is off for this app, so it has no place yet";
    else if (r.location === "nosignal") msg += ". No GPS signal, so it borrowed a nearby reading if there was one";
    toast(msg + ".", r.location === "ok" || r.location === "manual" ? 2500 : 6000);
    checkStorage();
  }

  // ---- Location ----

  async function syncNow(btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Finding you…'; }
    var fix = await Store.getFix(30000), msg, ok = true;
    if (!fix || fix.error) {
      if (fix && fix.error === "denied") {
        if (btn) render();
        return sheet("<h3>Location is off</h3><p>Open the iPhone <b>Settings → Privacy &amp; Security → Location Services</b>, pick the browser you added the journal from (<b>Safari Websites</b>, <b>Edge</b>, <b>Chrome</b>…) and choose <b>While Using the App</b>, then try again.</p>");
      }
      var last = Store.recentGoodFix(30 * 60e3, 1000);
      if (!last) {
        if (btn) render();
        return sheet("<h3>No GPS signal</h3><p>Couldn't get a location. Try again near a window or outdoors. Photos you take now will borrow the next reading.</p>");
      }
      fix = Object.assign({}, last, { timeUtc: Date.now() });
      msg = "No fresh GPS signal, so I used your last spot from the past half hour.";
    } else msg = "Location saved" + (fix.accuracyM ? " (within " + fix.accuracyM + " m)" : "") + ".";
    var pt = await Store.recordPoint(fix, "MANUAL", true);
    await Store.fillMissingPhotoLocations();
    var place = S.places.get(pt.placeId);
    render();
    sheet("<h3>" + esc(place ? place.name : "Saved") + "</h3><p>" + esc(msg) + "</p>", [
      { label: "OK" },
      place ? { label: "Name this place", cls: "primary", onClick: function () { go("#/place/" + place.id); } } : null,
    ].filter(Boolean));
  }

  /** While the app is open, logs a reading if none in the last interval. iPhone web apps can't do this in the background. */
  var checking = false;
  async function maybeCheck() {
    if (checking || document.hidden || !Store.settings.checkWhileOpen) return;
    if (Date.now() - Store.lastPointUtc() < Store.settings.intervalMinutes * 60e3) return;
    checking = true;
    try {
      var fix = await Store.getFix(20000);
      if (fix && !fix.error) { await Store.recordPoint(fix, "BACKGROUND", false); await Store.fillMissingPhotoLocations(); }
    } finally { checking = false; }
  }

  // ---- Views ----

  function viewToday() {
    var date = Store.today(), d = Store.day(date), dates = Store.allDates(), t = Store.trip();
    var first = t.startDate || dates[dates.length - 1];
    var dayN = first && first <= date && (!t.endDate || date <= t.endDate) ? Math.round((Store.dateObj(date) - Store.dateObj(first)) / 864e5) + 1 : null;
    var log = d.log || {};
    var banners = "";
    if (!isInstalled()) banners += notice("add", "<b>Add to Home Screen</b> so the journal is kept safe. Tap <b>Share</b> <span class=\"ios-share\"></span> then <b>Add to Home Screen</b>.", "warn");
    if (storageLevel === "CRITICAL") banners += notice("warning", "<b>The phone is almost full.</b> New photos are paused until you free some space.", "warn");
    else if (storageLevel === "LOW") banners += notice("storage", "Under 1 GB left for the journal. Consider a backup and freeing space.", "warn");
    var tc = Store.tripCounts(t.id);
    if (Store.trips().length === 1 && !t.startDate && t.name === "My trip" && !tc.photos && !tc.places && !tc.entries)
      banners += notice("travel_explore", "<b>Welcome!</b> Tap here to name your trip, set its dates and pick a colour.", "tonal", "#/more/trip");
    else if (t.startDate && date < t.startDate) banners += notice("flight", esc(t.name) + " starts in " + plural(Math.round((Store.dateObj(t.startDate) - Store.dateObj(date)) / 864e5), "day") + ". Anything you add now still goes into this trip.");
    else if (t.endDate && date > t.endDate) banners += notice("luggage", esc(t.name) + " ended on " + Store.shortDay(t.endDate) + '. Starting somewhere new? <b>Tap to start a new trip</b> so today doesn\'t land in this one.', "warn", "#", " data-newtrip");
    var cur = Store.currentPlaceId();
    var nAll = Store.values(Store.ALL.photos).length, lastB = Store.settings.lastBackupUtc || 0;
    var stale = nAll && Date.now() - lastB > 3 * 864e5;
    var x = Store.dateObj(date);
    var where = cur ? 'At <a href="#/place/' + cur + '">' + esc(placeName(cur)) + "</a>" : d.cities.length ? esc(d.cities.join(", ")) : "";
    var photos = d.photos.slice().reverse();
    return '<div class="page">' + mainHeader("Today") +
      '<section class="hero" aria-label="Today">' +
      '<div class="eyebrow">' + icon("flight", false, "sm") + (dayN ? "Day " + dayN + " of " + esc(t.name) : esc(t.name)) + "</div>" +
      '<div class="date">' + x.toLocaleDateString("en", { weekday: "long" }) + ", " + x.getDate() + " " + x.toLocaleDateString("en", { month: "long" }) + "</div>" +
      (where ? '<div class="where">' + icon("location_on", true, "sm") + where + "</div>" : '<div class="where">' + icon("location_off", false, "sm") + "No place yet today</div>") +
      '<div class="pickers">' + moodPicker("mood", log.mood) + stars("rating", log.rating) + "</div></section>" +
      banners +
      '<div class="chips" role="toolbar" aria-label="Quick add">' +
      '<button class="chip" data-new="NOTE">' + icon("edit_note") + "Note</button>" +
      '<button class="chip" data-new="MEAL">' + icon("restaurant") + "Rate a meal</button>" +
      '<button class="chip" data-new="EXPERIENCE">' + icon("star") + "Experience</button>" +
      '<button class="chip" id="sync">' + icon("my_location") + "Sync now</button></div>" +
      '<div class="card"><label class="lbl" for="todayNote" style="margin-top:0">How was today?</label>' +
      '<textarea id="todayNote" data-autosave="note" placeholder="A few words about today" rows="3">' + esc(log.note || "") + "</textarea></div>" +
      '<div class="sec-head"><h2>' + (photos.length ? plural(photos.length, "photo") + " today" : "Photos") + "</h2>" + (photos.length ? '<a href="#/day/' + date + '">See all</a>' : "") + "</div>" +
      (photos.length ? thumbGrid(photos.slice(0, 12), "strip") : emptyState("add_a_photo", "No photos yet today.", '<button class="btn tonal" id="firstPhoto">' + icon("photo_camera") + "Take a photo</button>")) +
      (d.places.length ? '<div class="sec-head"><h2>Places today</h2></div>' + d.places.map(placeRow).join("") : "") +
      (d.entries.length ? '<div class="sec-head"><h2>Logged today</h2></div>' + d.entries.map(entryRow).join("") : "") +
      '<div style="margin-top:20px"><a class="chip status' + (stale || (nAll && !lastB) ? " bad" : "") + '" href="#/more/backup">' + icon(stale ? "warning" : "backup", false) +
      (nAll ? "Backed up " + ago(lastB) : "Nothing to back up yet") + "</a></div>" +
      "</div>" + fab();
  }
  function bindToday(root) {
    var date = Store.today();
    $("#fab", root).onclick = function () { captureSheet(null, null); };
    var fp = $("#firstPhoto", root); if (fp) fp.onclick = function () { captureSheet(null, null); };
    $("#sync", root).onclick = function () { syncNow(this); };
    bindPickers(root, function () { return S.dayLogs.get(date) || {}; }, function (c) { Store.saveDayLog(date, c); });
    bindAutosave(root, function (c) { return Store.saveDayLog(date, c); });
    $$("[data-new]", root).forEach(function (b) {
      b.onclick = async function () { var e = await Store.newEntry(b.dataset.new, date, Store.currentPlaceId()); go("#/entry/" + e.id); };
    });
  }

  function dayHead(date, log) {
    return '<div class="day-head"><b>' + Store.prettyDay(date) + '</b><span class="meta">' + starText(log.rating) + (log.mood ? " " + moodText(log.mood) : "") + "</span></div>";
  }
  function dayCard(date) {
    var d = Store.day(date), log = d.log || {};
    var bits = [d.photos.length ? plural(d.photos.length, "photo") : null, d.places.length ? plural(d.places.length, "place") : null, d.entries.length ? plural(d.entries.length, "entry").replace("entrys", "entries") : null].filter(Boolean).join(" · ");
    var where = d.cities.length ? d.cities.join(", ") : d.places.slice(0, 3).map(function (p) { return p.name; }).join(", ");
    return '<section class="day-sec">' + dayHead(date, log) +
      '<a class="card day" href="#/day/' + date + '">' +
      (where ? '<div class="where">' + icon("location_on", true, "sm") + esc(where) + "</div>" : "") +
      (log.note ? '<div class="note">' + esc(log.note.length > 160 ? log.note.slice(0, 160) + "…" : log.note) + "</div>" : "") +
      thumbGrid(d.photos.slice(0, 8), "mini") +
      d.entries.slice(0, 3).map(function (e) {
        return '<div class="bits" style="display:flex;gap:8px;align-items:center;margin:4px 0">' + icon(KIND_ICON[e.kind] || "notes", false, "sm") + esc(e.title || KINDS[e.kind]) + " " + starText(e.rating) + (e.mood ? " " + moodText(e.mood) : "") + "</div>";
      }).join("") +
      '<div class="bits">' + bits + "</div></a></section>";
  }

  function viewTimeline() {
    var dates = Store.allDates();
    return '<div class="page">' + mainHeader("Timeline") + (dates.length ? dates.map(dayCard).join("") :
      emptyState("view_timeline", "Your days show up here as you add photos and notes.", '<a class="btn tonal" href="#/today">Go to Today</a>')) + "</div>" + fab();
  }
  function bindTimeline(root) { $("#fab", root).onclick = function () { captureSheet(null, null); }; }

  var calMonth = null;
  function viewCalendar() {
    var trip = Store.trip(), td = Store.today();
    var t = Store.dateObj(trip.startDate && (td < trip.startDate || (trip.endDate && td > trip.endDate)) ? trip.startDate : td);
    if (!calMonth) calMonth = { y: t.getFullYear(), m: t.getMonth() };
    var first = new Date(calMonth.y, calMonth.m, 1), days = new Date(calMonth.y, calMonth.m + 1, 0).getDate();
    var lead = (first.getDay() + 6) % 7, set = new Set(Store.allDates()), today = Store.today();
    var cells = "";
    for (var i = 0; i < lead; i++) cells += "<div></div>";
    for (var dn = 1; dn <= days; dn++) {
      var ds = calMonth.y + "-" + String(calMonth.m + 1).padStart(2, "0") + "-" + String(dn).padStart(2, "0");
      var log = S.dayLogs.get(ds), has = set.has(ds), inTrip = trip.startDate && ds >= trip.startDate && ds <= (trip.endDate || trip.startDate);
      var label = Store.prettyDay(ds) + (has ? ", has entries" : "") + (ds === today ? ", today" : "");
      cells += (has ? '<a href="#/day/' + ds + '"' : "<div") + ' aria-label="' + label + '" class="cal-day' + (has ? " has" : "") + (inTrip ? " trip" : "") + (ds === today ? " today" : "") + '"><span>' + dn + "</span>" +
        (log && log.mood ? "<i>" + MOODS[log.mood - 1] + "</i>" : has ? '<span class="dot"></span>' : "") + (has ? "</a>" : "</div>");
    }
    var label = first.toLocaleDateString("en", { month: "long", year: "numeric" });
    return '<div class="page">' + mainHeader("Calendar") +
      '<div class="card" style="padding:16px 12px"><div class="calhead"><button class="btn icon" id="prevM" aria-label="Previous month">' + icon("chevron_left") + "</button><h2>" + label +
      '</h2><button class="btn icon" id="nextM" aria-label="Next month">' + icon("chevron_right") + "</button></div>" +
      '<div class="cal"><b>M</b><b>T</b><b>W</b><b>T</b><b>F</b><b>S</b><b>S</b>' + cells + "</div></div>" +
      '<div class="cal-legend"><span><i style="background:var(--pc)"></i>Days with entries</span>' + (trip.startDate ? '<span><i style="background:var(--sc1);box-shadow:inset 0 0 0 1px var(--line)"></i>Trip days</span>' : "") + "</div></div>";
  }
  function bindCalendar(root) {
    $("#prevM", root).onclick = function () { calMonth.m--; if (calMonth.m < 0) { calMonth.m = 11; calMonth.y--; } render(true); };
    $("#nextM", root).onclick = function () { calMonth.m++; if (calMonth.m > 11) { calMonth.m = 0; calMonth.y++; } render(true); };
  }

  function viewDay(date) {
    var d = Store.day(date), log = d.log || {};
    return '<div class="page">' + appbar(Store.prettyDay(date), { back: true, solid: true }) +
      (d.cities.length ? '<div class="muted" style="display:flex;gap:4px;align-items:center;margin:4px 0 0">' + icon("location_on", true, "sm") + esc(d.cities.join(", ")) + "</div>" : "") +
      '<div class="card"><div class="field"><label>Mood</label>' + moodPicker("mood", log.mood) + "</div>" +
      '<div class="field"><label>Rating</label>' + stars("rating", log.rating) + "</div>" +
      '<textarea data-autosave="note" placeholder="Notes about this day" rows="4" aria-label="Notes about this day">' + esc(log.note || "") + "</textarea></div>" +
      '<div class="chips" role="toolbar" aria-label="Add to this day">' +
      '<button class="chip" data-new="NOTE">' + icon("edit_note") + "Note</button>" +
      '<button class="chip" data-new="MEAL">' + icon("restaurant") + "Rate a meal</button>" +
      '<button class="chip" data-new="EXPERIENCE">' + icon("star") + "Experience</button>" +
      '<a class="chip" href="#/map/' + date + '">' + icon("map") + "Show on map</a></div>" +
      (d.photos.length ? '<div class="sec-head"><h2>' + plural(d.photos.length, "photo") + "</h2></div>" + thumbGrid(d.photos) : "") +
      (d.places.length ? '<div class="sec-head"><h2>Places</h2></div>' + d.places.map(placeRow).join("") : "") +
      (d.entries.length ? '<div class="sec-head"><h2>Logged</h2></div>' + d.entries.map(entryRow).join("") : "") +
      (!d.photos.length && !d.places.length && !d.entries.length ? emptyState("calendar_today", "Nothing logged on this day yet.") : "") +
      (d.points.length ? '<p class="muted small center">' + plural(d.points.length, "location reading") + " logged.</p>" : "") + "</div>" + fab();
  }
  function bindDay(root, date) {
    bindPickers(root, function () { return S.dayLogs.get(date) || {}; }, function (c) { Store.saveDayLog(date, c); });
    bindAutosave(root, function (c) { return Store.saveDayLog(date, c); });
    $("#fab", root).onclick = function () { captureSheet(date, null); };
    $$("[data-new]", root).forEach(function (b) {
      b.onclick = async function () { var e = await Store.newEntry(b.dataset.new, date, null); go("#/entry/" + e.id); };
    });
  }

  function viewPlace(id) {
    var p = S.places.get(id);
    if (!p) return '<div class="page">' + appbar("Place", { back: true, solid: true }) + emptyState("location_off", "This place no longer exists (it may have been merged).") + "</div>";
    var photos = Store.placePhotos(id), entries = Store.placeEntries(id);
    var maps = "https://maps.apple.com/?ll=" + p.lat + "," + p.lon + "&q=" + encodeURIComponent(p.name);
    return '<div class="page">' + appbar(p.name, { back: true, solid: true }) +
      '<input class="title-input" data-autosave="name" value="' + esc(p.name) + '" placeholder="Name this place" aria-label="Place name" enterkeyhint="done">' +
      '<input data-autosave="city" value="' + esc(p.city) + '" placeholder="City" aria-label="City" enterkeyhint="done">' +
      '<div class="card"><div class="field"><label>Mood</label>' + moodPicker("mood", p.mood) + "</div>" +
      '<div class="field"><label>Rating</label>' + stars("rating", p.rating) + "</div>" +
      '<textarea data-autosave="note" placeholder="What was it like?" rows="4" aria-label="Notes about this place">' + esc(p.note) + "</textarea></div>" +
      '<div class="btnrow"><button class="btn tonal" id="phHere">' + icon("photo_camera") + 'Photo here</button><button class="btn outline" id="merge">' + icon("swap_horiz") + "Merge into…</button></div>" +
      (photos.length ? '<div class="sec-head"><h2>' + plural(photos.length, "photo") + "</h2></div>" + thumbGrid(photos) : "") +
      (entries.length ? '<div class="sec-head"><h2>Logged here</h2></div>' + entries.map(entryRow).join("") : "") +
      '<p class="muted small">First visited ' + Store.prettyDay(p.firstLocalDate) + ' · <a href="' + maps + '" target="_blank" rel="noopener">Open in Maps</a></p>' +
      (!photos.length && !entries.length ? '<button class="btn danger-text" id="delPlace">' + icon("delete") + "Delete this place</button>" : "") + "</div>";
  }
  function bindPlace(root, id) {
    if (!S.places.get(id)) return;
    bindPickers(root, function () { return S.places.get(id) || {}; }, function (c) { Store.updatePlace(id, c); });
    bindAutosave(root, function (c) { return Store.updatePlace(id, c); });
    $("#phHere", root).onclick = function () { captureSheet(null, id); };
    $("#merge", root).onclick = function () {
      var me = S.places.get(id);
      pickPlace(me, function (into) {
        if (!into || into.id === id) return;
        confirmSheet("Move everything from “" + me.name + "” into “" + into.name + "”? This place will be removed.", "Merge", async function () {
          await Store.mergePlaces(id, into.id); go("#/place/" + into.id);
        });
      }, false);
    };
    var del = $("#delPlace", root);
    if (del) del.onclick = function () {
      confirmSheet("Delete this place?", "Delete", async function () { await Store.deletePlace(id); history.back(); });
    };
  }

  function viewEntry(id) {
    var e = S.entries.get(id);
    if (!e) return '<div class="page">' + appbar("Entry", { back: true, solid: true }) + emptyState("notes", "This entry was deleted.") + "</div>";
    return '<div class="page">' + appbar(KINDS[e.kind] || "Entry", { back: true, solid: true }) +
      '<div class="chips" role="radiogroup" aria-label="Kind">' + Object.keys(KINDS).map(function (k) {
        return '<button class="chip' + (e.kind === k ? " on" : "") + '" data-kind="' + k + '" role="radio" aria-checked="' + (e.kind === k) + '">' + icon(KIND_ICON[k]) + KINDS[k] + "</button>";
      }).join("") + "</div>" +
      '<input class="title-input" data-autosave="title" value="' + esc(e.title) + '" enterkeyhint="done" aria-label="Title" placeholder="' + (e.kind === "MEAL" ? "What did you eat?" : e.kind === "EXPERIENCE" ? "What did you do?" : "Title") + '">' +
      '<div class="card"><div class="field"><label>Mood</label>' + moodPicker("mood", e.mood) + "</div>" +
      '<div class="field"><label>Rating</label>' + stars("rating", e.rating) + "</div>" +
      '<textarea data-autosave="note" placeholder="Notes" rows="5" aria-label="Notes">' + esc(e.note) + "</textarea></div>" +
      '<button class="row" id="entryPlace"><span class="lead">' + icon("location_on", true) + '</span><div class="body"><div class="muted">Place</div><b>' + esc(placeName(e.placeId) || "No place") + '</b></div><div class="right">Change' + icon("chevron_right", false, "sm") + "</div></button>" +
      '<p class="muted small">' + Store.prettyDay(e.localDate) + " · " + Store.clock(e.createdAtUtc, e.tzId) + "</p>" +
      '<button class="btn danger-text" id="delEntry">' + icon("delete") + "Delete</button></div>";
  }
  function bindEntry(root, id) {
    if (!S.entries.get(id)) return;
    bindPickers(root, function () { return S.entries.get(id) || {}; }, function (c) { Store.updateEntry(id, c); });
    bindAutosave(root, function (c) { return Store.updateEntry(id, c); });
    $$("[data-kind]", root).forEach(function (b) {
      b.onclick = function () {
        Store.updateEntry(id, { kind: b.dataset.kind });
        $$("[data-kind]", root).forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
      };
    });
    $("#entryPlace", root).onclick = function () {
      var e = S.entries.get(id), near = e.placeId ? S.places.get(e.placeId) : Store.recentGoodFix(3600e3, 2000);
      pickPlace(near, function (p) { Store.updateEntry(id, { placeId: p ? p.id : null }).then(function () { render(true); }); }, true);
    };
    $("#delEntry", root).onclick = function () { confirmSheet("Delete this entry?", "Delete", async function () { await Store.deleteEntry(id); history.back(); }); };
  }

  var fullUrl = null;
  var LOC_TEXT = { GPS: "Location from GPS", APPROX: "Approximate location, borrowed from a nearby reading", MANUAL: "Place set by hand", NONE: "No location", WAITING: "Finding location…" };
  function viewPhoto(id) {
    var p = S.photos.get(id);
    if (!p) return '<div class="page">' + appbar("Photo", { back: true, solid: true }) + emptyState("image", "This photo was deleted.") + "</div>";
    var vid = Photos.isVideo(p);
    return '<div class="viewer" id="viewer">' +
      '<div class="media" id="media">' + (vid ? '<video id="fullVid" controls playsinline preload="metadata"></video>' : '<img id="fullImg" alt="' + esc(p.caption || "Photo") + '">') + "</div>" +
      '<div class="top"><button class="back" data-back aria-label="Back">' + icon("chevron_left") + "</button>" +
      '<div class="t"><b>' + esc(placeName(p.placeId) || "No place") + "</b>" + Store.prettyDay(p.localDate) + " · " + Store.clock(p.takenAtUtc, p.tzId) + "</div></div>" +
      '<div class="bottom">' + (p.caption ? '<div class="caption">' + esc(p.caption) + "</div>" : "") +
      '<div class="bar">' +
      '<button id="sharePh">' + icon("share") + "Share</button>" +
      '<button id="savePh">' + icon("download") + "Save</button>" +
      '<button id="capPh">' + icon("edit") + "Caption</button>" +
      '<button id="photoPlace">' + icon("location_on") + "Place</button>" +
      '<button id="infoPh">' + icon("info") + "Details</button>" +
      '<button id="delPh">' + icon("delete") + "Delete</button>" +
      "</div></div></div>";
  }
  function bindPhoto(root, id) {
    var p = S.photos.get(id); if (!p) return;
    Store.getBlob("full:" + p.fileName).then(function (b) {
      if (!b) return;
      if (fullUrl) URL.revokeObjectURL(fullUrl);
      fullUrl = URL.createObjectURL(b);
      var img = $("#fullImg") || $("#fullVid"); if (img) img.src = fullUrl;
    });
    var viewer = $("#viewer", root);
    // Tap the photo to hide or show the controls.
    $("#media", root).onclick = function (e) { if (e.target.tagName !== "VIDEO") viewer.classList.toggle("hide-ui"); };
    async function shareIt() {
      var cur = S.photos.get(id), b = await Store.getBlob("full:" + cur.fileName);
      var ext = cur.fileName.split(".").pop(), type = Photos.mimeOf(cur.fileName);
      var file = new File([b], safeName(tripName()) + "-" + cur.localDate + "." + ext, { type: type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(function (e) { if (e.name !== "AbortError") toast("Sharing failed: " + e.message); });
      } else saveFile(b, file.name, type);
    }
    $("#sharePh", root).onclick = shareIt;
    $("#savePh", root).onclick = function () { toast("In the share sheet, choose “Save Image” (or “Save Video”).", 4000); shareIt(); };
    $("#capPh", root).onclick = function () {
      var cur = S.photos.get(id);
      var sh = sheet('<h3>Caption</h3><textarea id="capText" rows="3" placeholder="Add a caption" aria-label="Caption">' + esc(cur.caption || "") + "</textarea>",
        [{ label: "Cancel" }, { label: "Save", cls: "primary", onClick: function () {
          Store.updatePhoto(id, { caption: $("#capText").value }).then(function () { render(true); toast("Caption saved."); });
        } }]);
      setTimeout(function () { var t = $("#capText", sh.el); if (t) t.focus(); }, 50);
    };
    $("#infoPh", root).onclick = function () {
      var cur = S.photos.get(id);
      sheet("<h3>Details</h3>" +
        '<p><b>' + Store.prettyDay(cur.localDate) + "</b> at " + Store.clock(cur.takenAtUtc, cur.tzId) + "</p>" +
        "<p>" + esc(LOC_TEXT[cur.locStatus] || "") + (cur.accuracyM && cur.locStatus === "GPS" ? " (±" + Math.round(cur.accuracyM) + " m)" : "") + "</p>" +
        (cur.lat != null ? '<p><a href="https://maps.apple.com/?ll=' + cur.lat + "," + cur.lon + '" target="_blank" rel="noopener">Open in Maps</a></p>' : "") +
        '<p><a href="#/day/' + cur.localDate + '">Go to this day</a></p>');
    };
    $("#photoPlace", root).onclick = function () {
      var cur = S.photos.get(id);
      pickPlace(cur.lat != null ? cur : null, function (place) {
        var change = place ? { placeId: place.id, placeLocked: true, lat: cur.lat != null ? cur.lat : place.lat, lon: cur.lon != null ? cur.lon : place.lon, locStatus: cur.lat != null ? cur.locStatus : "MANUAL" }
          : { placeId: null, placeLocked: false };
        Store.updatePhoto(id, change).then(function () { render(true); });
      }, true);
    };
    $("#delPh", root).onclick = function () { confirmSheet(Photos.isVideo(p) ? "Delete this video from the journal?" : "Delete this photo from the journal?", "Delete", async function () { await Store.deletePhoto(id); history.back(); }); };
  }

  // ---- Map ----

  var map = null, mapLayers = null, tiles = null;
  function viewMap(date) {
    return '<div class="mapview"><div id="map"></div><div class="map-top">' +
      (date ? '<a class="pill" href="#/map">' + icon("close", false, "sm") + Store.shortDay(date) + "</a>" : '<button class="pill" data-trips>' + icon("luggage", false, "sm") + esc(tripName()) + icon("keyboard_arrow_down", false, "sm") + "</button>") +
      '<label class="pill"><input type="checkbox" id="tilesBox"' + (Store.settings.streetMap !== false ? " checked" : "") + "> Street map</label></div>" +
      '<button class="pill map-save" id="saveArea">' + icon("cloud_download", false, "sm") + "Save this area for offline</button></div>";
  }
  function bindMap(root, date) {
    var el = $("#map", root);
    map = L.map(el, { zoomControl: false, worldCopyJump: true, attributionControl: true }).setView([50, -100], 3);
    el._journalMap = map;
    L.control.zoom({ position: "bottomright" }).addTo(map);
    if (window.WORLD_TOPO) {
      L.geoJSON(topojson.feature(WORLD_TOPO, WORLD_TOPO.objects.countries), { style: { color: "#c9b8aa", weight: 1, fillColor: "#f4ece2", fillOpacity: 1 }, interactive: false }).addTo(map);
    }
    tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, crossOrigin: true, attribution: "© OpenStreetMap" });
    if (Store.settings.streetMap !== false) tiles.addTo(map);
    $("#saveArea", root).onclick = saveMapArea;
    $("#tilesBox", root).onchange = function () {
      Store.saveSettings({ streetMap: this.checked });
      if (this.checked) tiles.addTo(map); else map.removeLayer(tiles);
    };
    var pts = Store.values(S.points).filter(function (p) { return !date || p.localDate === date; }).sort(function (a, b) { return a.timeUtc - b.timeUtc; });
    var placeIds = date ? Store.day(date).places.map(function (p) { return p.id; }) : Array.from(S.places.keys());
    var bounds = [];
    if (pts.length > 1) L.polyline(pts.map(function (p) { return [p.lat, p.lon]; }), { color: mapColour(), weight: 3, opacity: 0.7 }).addTo(map);
    pts.forEach(function (p) { bounds.push([p.lat, p.lon]); });
    placeIds.forEach(function (id) {
      var p = S.places.get(id); if (!p) return;
      var n = Store.placePhotos(id).length;
      bounds.push([p.lat, p.lon]);
      L.circleMarker([p.lat, p.lon], { radius: 7 + Math.min(10, Math.sqrt(n) * 2), color: "#fff", weight: 2, fillColor: mapColour(), fillOpacity: 0.9 })
        .addTo(map).bindPopup('<b>' + esc(p.name) + "</b>" + (p.city ? "<br>" + esc(p.city) : "") + "<br>" + starText(p.rating) + " " + moodText(p.mood) +
          (n ? "<br>" + plural(n, "photo") : "") + '<br><a href="#/place/' + id + '">Open ›</a>');
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    setTimeout(function () { map && map.invalidateSize(); }, 50);
  }

  // ---- Offline map areas ----
  // Street tiles are kept once seen. This fetches a whole area ahead of time (the service worker keeps
  // them), a few zoom levels deeper than what's on screen. OpenStreetMap's servers are shared and
  // free, so it's capped per area and per day, like the Android app.
  var AREA_MAX = 800, DAY_MAX = 2500, DEEPEST = 16;
  function tilesFor(bounds, z) {
    function x(lon) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
    function y(lat) { var r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z)); }
    var out = [], n = Math.pow(2, z);
    var x0 = x(bounds.getWest()), x1 = x(bounds.getEast()), y0 = y(Math.min(85, bounds.getNorth())), y1 = y(Math.max(-85, bounds.getSouth()));
    for (var tx = x0; tx <= x1; tx++) for (var ty = y0; ty <= y1; ty++) if (ty >= 0 && ty < n) out.push(z + "/" + (((tx % n) + n) % n) + "/" + ty);
    return out;
  }
  function saveMapArea() {
    if (!map) return;
    if (!navigator.onLine) return toast("You're offline. Save map areas while you have Wi-Fi.");
    // Zoomed-out views of the same area are only a few pieces each, so they come along too.
    var b = map.getBounds(), z0 = Math.max(2, Math.round(map.getZoom()) - 4), list = [], zTop = z0;
    for (var z = z0; z <= DEEPEST; z++) { var t = tilesFor(b, z); if (list.length + t.length > AREA_MAX) break; list = list.concat(t); zTop = z; }
    if (zTop < Math.min(13, DEEPEST)) return sheet("<h3>Zoom in a bit more</h3><p>This area is too big to save in street detail. Zoom in on one town or region (so it fills the screen) and tap Save again. You can save as many areas as you like, one at a time.</p>");
    var day = Store.today(), used = Store.settings.tileDay === day ? Store.settings.tileCount || 0 : 0;
    if (used + list.length > DAY_MAX) return sheet("<h3>That's enough for today</h3><p>The free map servers ask apps not to download too much at once. Try again tomorrow; the areas you've already saved stay saved.</p>");
    sheet("<h3>Save this area for offline?</h3><p>Downloads " + list.length + " map pieces (about " + Math.max(1, Math.round(list.length * 0.02)) + " MB), down to street level, so this area works with no signal. Use Wi-Fi if you can.</p>", [
      { label: "Cancel" },
      { label: "Save", cls: "primary", onClick: function () {
        runJob("Saving map area", async function (progress) {
          var ok = 0, fail = 0;
          for (var i = 0; i < list.length; i++) {
            try { var r = await fetch("https://tile.openstreetmap.org/" + list[i] + ".png", { mode: "cors" }); if (r.ok) ok++; else fail++; } catch (e) { fail++; }
            if (i % 10 === 0) progress("Map pieces " + (i + 1) + " of " + list.length + "…");
          }
          await Store.saveSettings({ tileDay: day, tileCount: used + list.length });
          return { ok: ok, fail: fail };
        }).then(function (r) {
          if (!r) return;
          sheet("<h3>Area saved</h3><p>" + r.ok + " map pieces kept for offline use" + (r.fail ? " (" + r.fail + " didn't download; try again on better Wi-Fi)" : "") + ". Pan to the next town and save that too.</p>");
        });
      } },
    ]);
  }

  // ---- More ----

  // ---- More: grouped list, with longer sections on their own screens ----

  function item(ic, title, sub, attrs, opts) {
    opts = opts || {};
    var tag = opts.href ? "a" : "button";
    return "<" + tag + ' class="item' + (opts.danger ? " danger" : "") + '"' + (opts.href ? ' href="' + opts.href + '"' : "") + " " + (attrs || "") + ">" + icon(ic) +
      '<div class="body"><b>' + title + "</b>" + (sub ? "<span>" + sub + "</span>" : "") + "</div>" +
      (opts.trail != null ? opts.trail : opts.href ? icon("chevron_right", false, "chev") : "") + "</" + tag + ">";
  }
  function group(title, items) { return '<div class="group-title">' + title + '</div><div class="group">' + items.join("") + "</div>"; }

  function viewMore(section) {
    if (section === "trip") return viewTripSetup();
    if (section === "about") return viewAbout();
    if (section === "backup") return viewBackup();
    var st = Store.settings, trip = Store.trip(), nPh = Store.values(S.photos).length;
    return '<div class="page">' + mainHeader("More") +
      group("Trip", [
        item("luggage", esc(trip.name), esc([tripDates(trip), SCHEMES[schemeKey()].name].filter(Boolean).join(" · ")), "", { href: "#/more/trip" }),
        item("swap_horiz", "Switch or start a trip", plural(Store.trips().length, "trip") + " on this phone", "data-trips"),
      ]) +
      group("Photos", [
        item("photo_library", "Save all to the Photos app", plural(nPh, "photo") + " in this trip, a batch at a time", 'id="saveAll"'),
        item("help", "Camera trouble?", "What to do if the camera opens black", 'id="camHelpRow"'),
      ]) +
      group("Backup", [
        item("backup", "Back up now", "Last backup " + ago(st.lastBackupUtc), 'id="backup"'),
        item("history", "Backup and restore", "Restore, and how backups work", "", { href: "#/more/backup" }),
        item("redeem", "Export memory box", "A keepsake to open on a laptop", 'id="export"'),
      ]) +
      group("Maps", [
        item("cloud_download", "Offline maps", "On the Map tab, zoom to a town and tap Save this area", "", { href: "#/map" }),
      ]) +
      group("Location", [
        '<label class="item">' + icon("my_location") + '<div class="body"><b>Log location while open</b><span>Every ' + st.intervalMinutes + " minutes. iPhone web apps can't track in the background.</span></div>" +
          '<input type="checkbox" id="checkOpen"' + (st.checkWhileOpen ? " checked" : "") + ' aria-label="Log location while open"></label>',
      ]) +
      group("Appearance", [
        item("palette", "Trip colour", SCHEMES[schemeKey()].name + ". Light or dark follows the iPhone setting.", "", { href: "#/more/trip" }),
      ]) +
      group("About", [
        item("storage", "Storage and install", "Space used, protected storage, Home Screen", "", { href: "#/more/about" }),
        item("info", "Travel Journal", "Version " + APP_VERSION, "", { trail: "" }),
      ]) + "</div>";
  }

  function viewTripSetup() {
    var trip = Store.trip();
    return '<div class="page">' + appbar("Trip setup", { back: true, solid: true, backLabel: "More" }) +
      '<p class="section-intro">Everything that makes this trip its own. Photos, places and notes always go into the trip in use.</p>' +
      '<div class="card"><label class="lbl" for="tripName" style="margin-top:0">Name</label><input id="tripName" data-tripsave="name" value="' + esc(trip.name) + '" enterkeyhint="done">' +
      '<div class="two"><div><label class="lbl">First day</label><input type="date" data-tripdate="startDate" value="' + esc(trip.startDate) + '" aria-label="First day"></div>' +
      '<div><label class="lbl">Last day</label><input type="date" data-tripdate="endDate" value="' + esc(trip.endDate) + '" aria-label="Last day"></div></div>' +
      '<label class="lbl">Colour</label>' + schemePicker(trip.scheme || "red") + "</div>" +
      '<div class="btnrow"><button class="btn tonal" data-trips>' + icon("swap_horiz") + 'Switch trip</button><button class="btn outline" data-newtrip>' + icon("add") + "New trip</button></div>" +
      (Store.trips().length > 1 ? '<div class="group" style="margin-top:24px">' + item("delete", "Delete this trip…", "Removes its photos, places and notes", 'id="delTrip"', { danger: true }) + "</div>" : "") +
      "</div>";
  }

  function viewBackup() {
    var st = Store.settings;
    return '<div class="page">' + appbar("Backup and restore", { back: true, solid: true, backLabel: "More" }) +
      '<div class="card tonal notice">' + icon("backup") + "<div><b>Last backup " + ago(st.lastBackupUtc) + "</b><br>One zip with every trip, photo and note.</div></div>" +
      '<button class="btn primary wide" id="backup">' + icon("backup") + "Back up now</button>" +
      '<p class="muted small">Choose <b>Save to Files</b> (iCloud Drive is safest) or AirDrop it to a computer.</p>' +
      '<button class="btn outline wide" id="restore">' + icon("history") + "Restore from a backup</button>" +
      '<p class="muted small">Restoring merges: it brings back anything missing and never removes what you added since.</p>' +
      '<div class="sec-head"><h2>Memory box</h2></div>' +
      '<button class="btn tonal wide" id="export">' + icon("redeem") + "Export memory box</button>" +
      '<p class="muted small">For the trip in use: a route map, day-by-day timeline, galleries per place and “Play the trip”. Unzip it on a laptop and open <b>memory-box/index.html</b>. Works without internet.</p></div>';
  }

  function viewAbout() {
    return '<div class="page">' + appbar("Storage and install", { back: true, solid: true, backLabel: "More" }) +
      '<div class="card" id="storageCard"><p class="muted">Checking…</p></div>' +
      '<p class="muted small center">Travel Journal · v' + APP_VERSION + "</p></div>";
  }

  function bindMore(root, section) {
    var trip = Store.trip();
    function on(id, fn) { var el = $("#" + id, root); if (el) el.onclick = fn; }
    $$("[data-tripsave]", root).forEach(function (i) { i.setAttribute("data-autosave", i.dataset.tripsave); });
    bindAutosave(root, function (c) { if (c.name !== undefined && !c.name.trim()) return; return Store.updateTrip(trip.id, c); });
    $$("[data-tripdate]", root).forEach(function (i) {
      i.onchange = function () {
        var c = {}; c[i.dataset.tripdate] = i.value;
        var t = Object.assign({}, Store.trip(), c);
        if (t.startDate && t.endDate && t.endDate < t.startDate) { toast("The last day is before the first day."); i.value = Store.trip()[i.dataset.tripdate]; return; }
        if (i.dataset.tripdate === "startDate" && i.value && !t.endDate) c.endDate = i.value;
        calMonth = null;
        Store.updateTrip(trip.id, c);
      };
    });
    bindSchemePicker(root, function (k) { Store.updateTrip(trip.id, { scheme: k }).then(applyScheme); });
    on("saveAll", saveAllToPhotos);
    on("camHelpRow", cameraHelp);
    on("delTrip", function () {
      var n = Store.tripCounts(trip.id);
      confirmSheet("Delete “" + trip.name + "” and everything in it (" + plural(n.photos, "photo") + ", " + plural(n.places, "place") + ", " + plural(n.entries, "entry").replace("entrys", "entries") + ")? This can't be undone. Make a backup first if you might want it back.", "Delete trip", async function () {
        await Store.deleteTrip(trip.id); calMonth = null; applyScheme(); go("#/today"); toast("Trip deleted.");
      });
    });
    var co = $("#checkOpen", root); if (co) co.onchange = function () { Store.saveSettings({ checkWhileOpen: this.checked }); };
    on("backup", doBackup);
    on("restore", function () { $("#restoreInput").value = ""; $("#restoreInput").click(); });
    on("export", doExport);
    if (!$("#storageCard", root)) return;
    Promise.all([checkStorage(), navigator.storage && navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false)]).then(function (r) {
      var card = $("#storageCard"); if (!card) return;
      var est = r[0], persisted = r[1];
      card.innerHTML = (est ? "<p>Journal uses <b>" + mb(est.usage) + "</b>, about <b>" + mb(est.free) + "</b> available.</p>" : "") +
        '<p class="muted">' + Store.values(Store.ALL.photos).length + " photos · " + Store.ALL.places.size + " places · " + Store.ALL.points.size + " location readings, across all trips</p>" +
        '<p style="display:flex;gap:8px;align-items:center">' + (persisted ? icon("check") + "Protected storage is on." : icon("warning") + "<span>Protected storage is off. " + (isInstalled() ? "" : "Add the app to your Home Screen, then ") + '<a href="#" id="persistBtn">turn it on</a>.</span>') + "</p>" +
        (isInstalled() ? "" : '<p class="warn-text">Not on the Home Screen yet. Open it from the Home Screen icon so the browser doesn\'t clear it.</p>');
      var pb = $("#persistBtn");
      if (pb) pb.onclick = async function (e) { e.preventDefault(); var ok = await askPersist(); toast(ok ? "Storage protected." : "iPhone said no. Adding the app to the Home Screen usually fixes this."); render(true); };
    });
  }

  async function runJob(label, work) {
    if (busy) return;
    busy = true;
    var sh = sheet('<h3>' + esc(label) + '</h3><p id="jobMsg"><span class="spin"></span> Starting…</p><p class="muted small">Keep the app open until this finishes.</p>', []);
    try {
      var r = await work(function (msg) { var m = $("#jobMsg"); if (m) m.innerHTML = '<span class="spin"></span> ' + esc(msg); });
      sh.close();
      return r;
    } catch (e) {
      console.error(e);
      sh.close();
      sheet("<h3>" + esc(label) + " failed</h3><p>" + esc(e.message || e) + "</p>");
    } finally { busy = false; }
  }

  /**
   * Hands a finished file to the person. Sharing needs a fresh tap on iPhone, so the share sheet
   * opens from the button in this sheet, not straight after the long job.
   */
  function saveFile(blob, name, type, intro, after) {
    var file = new File([blob], name, { type: type });
    var canShare = navigator.canShare && navigator.canShare({ files: [file] });
    sheet((intro || "") + '<p class="muted small">' + esc(name) + " · " + mb(blob.size) + "</p>", [
      { label: "Close" },
      { label: "Download", cls: canShare ? "outline" : "primary", onClick: function () {
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
        if (after) after();
      } },
      canShare ? { label: "Save or share…", cls: "primary", onClick: function () {
        navigator.share({ files: [file] }).then(function () { if (after) after(); }).catch(function (e) { if (e.name !== "AbortError") toast("Sharing failed: " + e.message); });
      } } : null,
    ].filter(Boolean));
  }

  /** iPhone only saves to Photos from a share sheet opened by a tap, so this goes a batch at a time. */
  async function saveAllToPhotos() {
    var photos = Store.values(S.photos).filter(function (p) { return p.status === "READY"; }).sort(function (a, b) { return a.takenAtUtc - b.takenAtUtc; });
    if (!photos.length) return toast("No photos in this trip yet.");
    if (!navigator.canShare) return toast("This browser can't save to Photos. Open each photo and use Share / Save.");
    var BATCH = 20, i = 0;
    async function batchFiles(from) {
      var out = [];
      for (var p of photos.slice(from, from + BATCH)) {
        var b = await Store.getBlob("full:" + p.fileName);
        if (b) out.push(new File([b], safeName(tripName()) + "-" + p.localDate + "-" + p.id.slice(0, 6) + "." + p.fileName.split(".").pop(), { type: Photos.mimeOf(p.fileName) }));
      }
      return out;
    }
    async function step() {
      if (i >= photos.length) return sheet("<h3>All done</h3><p>" + plural(photos.length, "photo") + " offered to the Photos app.</p>");
      var files = await batchFiles(i);
      var to = Math.min(i + BATCH, photos.length);
      sheet("<h3>Save to Photos</h3><p>Photos " + (i + 1) + "–" + to + " of " + photos.length + ". Tap <b>Save</b>, then choose <b>Save " + files.length + " Items</b> (or Images).</p>", [
        { label: "Stop" },
        { label: "Save", cls: "primary", onClick: function () {
          navigator.share({ files: files }).then(function () { i = to; step(); }).catch(function (e) {
            if (e.name === "AbortError") step(); else toast("Saving failed: " + e.message, 6000);
          });
        } },
      ]);
    }
    step();
  }

  async function doBackup() {
    var r = await runJob("Backup", async function (progress) {
      progress("Collecting photos…");
      var b = await Store.backupFiles();
      progress("Packing " + plural(b.photos, "photo") + "…");
      var zip = await Zip.write(b.files, function (n, t) { if (n % 5 === 0) progress("Packing " + n + " of " + t + "…"); });
      return { zip: zip, photos: b.photos, missing: b.missing };
    });
    if (!r) return;
    saveFile(r.zip, "travel-journal-backup-" + Store.today() + ".zip", "application/zip",
      "<h3>Backup ready</h3><p>" + plural(r.photos, "photo") + (r.missing ? " (" + r.missing + " missing)" : "") + ". Choose <b>Save to Files</b> (iCloud Drive is safest) or AirDrop it.</p>",
      function () { Store.saveSettings({ lastBackupUtc: Date.now() }); });
  }

  async function doRestore(file) {
    if (!file) return;
    var r = await runJob("Restore", function (progress) {
      return Store.restore(file, function (n, t) { progress("Copying photos " + n + " of " + t + "…"); });
    });
    if (!r) return;
    render();
    sheet("<h3>Restore finished</h3><p>" + r.added + " items added, " + r.updated + " updated, " + plural(r.photosCopied, "photo") + " copied in.</p>");
  }

  var MB_FILES = ["index.html", "app.js", "style.css", "lib/leaflet.css", "lib/leaflet.js", "lib/topojson-client.min.js", "lib/world.js",
    "lib/images/layers.png", "lib/images/layers-2x.png", "lib/images/marker-icon.png", "lib/images/marker-icon-2x.png", "lib/images/marker-shadow.png",
    "fonts/dm-sans-latin-400-normal.woff2", "fonts/dm-sans-latin-500-normal.woff2", "fonts/dm-sans-latin-700-normal.woff2", "fonts/dm-serif-display-latin-400-normal.woff2", "fonts/OFL-DM-Sans.txt"];

  async function doExport() {
    var r = await runJob("Memory box", async function (progress) {
      await Store.fillMissingPhotoLocations();
      var files = [];
      progress("Preparing the page…");
      for (var f of MB_FILES) {
        var res = await fetch("memorybox/" + f);
        if (!res.ok) throw new Error("Missing part of the memory box page: " + f);
        files.push({ name: "memory-box/" + f, data: await res.blob() });
      }
      var photos = [];
      Store.values(S.photos).filter(function (p) { return p.status === "READY" && !Photos.isVideo(p); }).sort(function (a, b) { return a.takenAtUtc - b.takenAtUtc; }).forEach(function (p) { photos.push(p); });
      var have = [];
      for (var i = 0; i < photos.length; i++) {
        var p = photos[i], base = p.fileName.replace(/\.[^.]+$/, "");
        var full = await Store.getBlob("full:" + p.fileName);
        if (!full) continue;
        have.push(p);
        files.push({ name: "memory-box/photos/" + p.fileName, data: full });
        var th = await Photos.thumbBlob(p);
        if (th) files.push({ name: "memory-box/thumbs/" + base + ".jpg", data: th });
        if ((i + 1) % 5 === 0) progress("Photos " + (i + 1) + " of " + photos.length + "…");
      }
      var dates = Store.allDates().slice().reverse();
      var sc = scheme().l, trip = Store.trip() || {};
      var data = {
        title: tripName(),
        app: "Travel Journal",
        exportedAt: Store.prettyDay(Store.today()),
        startDate: trip.startDate || dates[0], endDate: trip.endDate || dates[dates.length - 1],
        // The exported page is always light; colours come from the trip's scheme (same roles as the Android export).
        scheme: { header: sc[0], accent: sc[0], route: sc[0], ring: sc[0], page: sc[6], card: sc[7], ink: sc[12], muted: sc[13], line: sc[15],
          sea: "#dfeef3", land: "#f4ece2", landEdge: "#c9b8aa", dark: false },
        days: dates.map(function (d) {
          var day = Store.day(d), log = day.log || {};
          return { date: d, label: Store.prettyDay(d), mood: log.mood || null, rating: log.rating || null, note: log.note || "", cities: day.cities, placeIds: day.places.map(function (x) { return x.id; }) };
        }),
        places: Store.values(S.places).map(function (p) { return { id: p.id, name: p.name, city: p.city, lat: p.lat, lon: p.lon, rating: p.rating, mood: p.mood, note: p.note, firstDate: p.firstLocalDate }; }),
        photos: have.map(function (p) {
          return { id: p.id, type: "photo", src: "photos/" + p.fileName, thumb: "thumbs/" + p.fileName.replace(/\.[^.]+$/, "") + ".jpg", date: p.localDate, time: Store.clock(p.takenAtUtc, p.tzId),
            utc: p.takenAtUtc, lat: p.lat, lon: p.lon, placeId: p.placeId, caption: p.caption, approx: p.locStatus !== "GPS" };
        }),
        entries: Store.values(S.entries).map(function (e) { return { id: e.id, kind: KINDS[e.kind] || "Note", title: e.title, date: e.localDate, placeId: e.placeId, rating: e.rating, mood: e.mood, note: e.note }; }),
        route: Store.values(S.points).sort(function (a, b) { return a.timeUtc - b.timeUtc; }).map(function (p) { return { lat: p.lat, lon: p.lon, utc: p.timeUtc, date: p.localDate, placeId: p.placeId }; }),
      };
      files.splice(MB_FILES.length, 0, { name: "memory-box/data.js", data: "window.TRIP = " + JSON.stringify(data) + ";\n" });
      progress("Packing the zip…");
      return { zip: await Zip.write(files), photos: have.length };
    });
    if (!r) return;
    saveFile(r.zip, safeName(tripName()) + "-memory-box-" + Store.today() + ".zip", "application/zip",
      "<h3>Memory box ready</h3><p>" + plural(r.photos, "photo") + ". Save it to Files or AirDrop it to a laptop, unzip, and open <b>memory-box/index.html</b>.</p>");
  }

  // ---- Router ----

  var currentRoute = null;
  function parse() {
    var h = (location.hash || "#/today").slice(2).split("/");
    return { name: h[0] || "today", arg: h[1] ? decodeURIComponent(h[1]) : null };
  }

  var TABS = [["today", "Today", "today"], ["timeline", "Timeline", "view_timeline"], ["calendar", "Calendar", "calendar_month"], ["map", "Map", "map"], ["more", "More", "more_horiz"]];
  function renderTabs(active) {
    $("#tabs").innerHTML = TABS.map(function (t) {
      var on = t[0] === active;
      return '<a href="#/' + t[0] + '" data-tab="' + t[0] + '" class="' + (on ? "on" : "") + '"' + (on ? ' aria-current="page"' : "") + '><span class="ind">' + icon(t[2], on) + "</span>" + t[1] + "</a>";
    }).join("");
  }

  // Large titles collapse into the top bar, and the Photo button shrinks while scrolling down.
  var lastY = 0;
  window.addEventListener("scroll", function () {
    var y = window.scrollY;
    document.body.classList.toggle("scrolled", y > 36);
    if (Math.abs(y - lastY) > 6) { document.body.classList.toggle("fab-small", y > lastY && y > 80); lastY = y; }
  }, { passive: true });

  function render() {
    flushAll();
    var r = parse(), key = r.name + "/" + r.arg, sameRoute = key === currentRoute;
    var scroll = sameRoute ? window.scrollY : 0;
    if (map) { try { map.remove(); } catch (e) { console.warn(e); } map = null; }
    if (r.name !== "photo" && fullUrl) { URL.revokeObjectURL(fullUrl); fullUrl = null; }
    var V = {
      today: [viewToday, bindToday], timeline: [viewTimeline, bindTimeline], calendar: [viewCalendar, bindCalendar], map: [viewMap, bindMap],
      more: [viewMore, bindMore], day: [viewDay, bindDay], place: [viewPlace, bindPlace], entry: [viewEntry, bindEntry], photo: [viewPhoto, bindPhoto],
    }[r.name] || [viewToday, bindToday];
    // Leaving an entry that was never filled in removes it, so stray taps don't leave blank rows.
    if (!sameRoute && currentRoute && currentRoute.indexOf("entry/") === 0) {
      var old = S.entries.get(currentRoute.slice(6));
      if (old && !old.title && !old.note && !old.rating && !old.mood) Store.deleteEntry(old.id);
    }
    currentRoute = key;
    view.classList.toggle("no-anim", sameRoute);
    if (!sameRoute) { view.style.animation = "none"; void view.offsetWidth; view.style.animation = ""; }
    view.innerHTML = V[0](r.arg);
    if (V[1]) V[1](view, r.arg);
    hydrateThumbs(view);
    $$("[data-trips]", view).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); tripSheet(); }; });
    $$("[data-newtrip]", view).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); newTripSheet(); }; });
    $$("[data-back]", view).forEach(function (b) { b.onclick = function () { if (history.length > 1) history.back(); else go("#/today"); }; });
    var tab = { day: "timeline", place: "map", entry: "today", photo: "timeline" }[r.name] || r.name;
    if (!TABS.some(function (t) { return t[0] === tab; })) tab = "today";
    renderTabs(tab);
    document.body.classList.toggle("map-mode", r.name === "map");
    document.body.classList.toggle("viewer-mode", r.name === "photo" && !!S.photos.get(r.arg));
    if (!sameRoute) document.body.classList.remove("fab-small");
    window.scrollTo(0, scroll);
    document.body.classList.toggle("scrolled", window.scrollY > 36);
  }

  /** Data changes re-render, but never while someone is typing (that would steal the keyboard). */
  var dirty = false;
  function onDataChanged() {
    var a = document.activeElement;
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA") && a.type !== "checkbox") { dirty = true; return; }
    if (!$("#sheet").hidden || parse().name === "map") { dirty = true; return; }
    clearTimeout(onDataChanged.t);
    onDataChanged.t = setTimeout(render, 30);
  }
  document.addEventListener("focusout", function () { setTimeout(function () { if (dirty && !document.activeElement.matches("input:not([type=checkbox]),textarea")) { dirty = false; render(); } }, 100); });

  // ---- Start ----

  async function start() {
    try {
      await Store.load();
    } catch (e) {
      view.innerHTML = '<div class="page"><h1>Couldn\'t open the journal</h1><p>' + esc(e.message) + "</p><p>Close the app fully and open it again. Private Browsing can't save a journal.</p></div>";
      return;
    }
    applyScheme();
    Store.onChange(onDataChanged);
    $("#cameraInput").onchange = function () { handleFiles(this.files, "CAMERA"); };
    $("#videoInput").onchange = function () { handleFiles(this.files, "CAMERA"); };
    $("#libraryInput").onchange = function () { handleFiles(this.files, "IMPORT"); };
    $("#restoreInput").onchange = function () { doRestore(this.files[0]); };
    window.addEventListener("hashchange", function () { $("#sheet").hidden = true; stopCam(); render(); });
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", function () { if (document.hidden) { flushAll(); stopCam(); } else { maybeCheck(); checkStorage(); } });
    setInterval(maybeCheck, 60e3);
    await checkStorage();
    if (isInstalled()) askPersist();
    render();
    Store.fillMissingPhotoLocations();
    setTimeout(maybeCheck, 1500);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      reg.addEventListener("updatefound", function () {
        var nw = reg.installing;
        nw && nw.addEventListener("statechange", function () {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            var b = $("#updateBar"); b.hidden = false;
            b.onclick = function () { flushAll(); nw.postMessage("skipWaiting"); };
          }
        });
      });
      setInterval(function () { reg.update(); }, 3600e3);
    }).catch(function (e) { console.warn("No offline support", e); });
    var reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () { if (!reloaded && $("#updateBar").hidden === false) { reloaded = true; location.reload(); } });
  }

  start();
})();
