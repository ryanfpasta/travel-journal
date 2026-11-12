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
  /** The trip in use, shown small above each main title. Tap to switch trips. */
  function tripSub() {
    return '<button class="trip-sub" data-trips aria-label="Trip in use: ' + esc(tripName()) + '. Switch trip">' + icon("luggage", false, "sm") +
      '<span class="label">' + esc(tripName()) + "</span>" + icon("keyboard_arrow_down", false, "sm") + "</button>";
  }
  function menuBtn() { return '<button class="icon-btn menu-btn" data-menu aria-label="Menu">' + icon("menu") + "</button>"; }

  /** The ☰ menu: trips, photo housekeeping, backup and settings, sliding in from the left. */
  function openMenu() {
    var t = Store.trip(), nDel = photoList("deleted").length, nHid = photoList("hidden").length;
    function row(ic, label, sub, attrs) {
      return '<button class="mrow" ' + attrs + ">" + icon(ic) + '<span class="b"><b>' + label + "</b>" + (sub ? "<span>" + sub + "</span>" : "") + "</span></button>";
    }
    var el = document.createElement("div");
    el.id = "drawer";
    el.innerHTML = '<nav class="drawer-card" aria-label="Menu">' +
      '<div class="drawer-head"><span class="swatch" style="background:' + swatch(t.scheme) + '"></span><div><b>' + esc(t.name) + "</b><span>" + esc(tripDates(t) || "No dates yet") + "</span></div></div>" +
      row("swap_horiz", "Switch or start a trip", plural(Store.trips().length, "trip") + " on this phone", 'data-go="trips"') +
      row("luggage", "Trip setup", "Name, dates and colour", 'data-go="#/more/trip"') +
      '<div class="mhead">Photos</div>' +
      row("content_copy", "Clean up", "Similar and blurry photos", 'data-go="#/review"') +
      row("delete", "Recently deleted", nDel ? plural(nDel, "photo") : "Empty", 'data-go="#/photos/deleted"') +
      row("visibility_off", "Hidden photos", nHid ? plural(nHid, "photo") : "None", 'data-go="#/photos/hidden"') +
      '<div class="mhead">Keep it safe</div>' +
      row("backup", "Back up now", "Last backup " + ago(Store.settings.lastBackupUtc), 'data-go="backup"') +
      row("redeem", "Export memory box", "A keepsake to open on a laptop", 'data-go="export"') +
      row("tune", "Website versions", sites().length ? plural(sites().length, "version") + ", e.g. family or friends" : "Different photos for different people", 'data-go="#/sites"') +
      '<div class="mhead">App</div>' +
      row("settings", "Settings", "Location, storage, camera help", 'data-go="#/more"') +
      '<p class="mver">Travel Journal ' + APP_VERSION + "</p></nav>";
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("open"); });
    function close() { el.classList.remove("open"); setTimeout(function () { el.remove(); }, 220); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    el.onclick = function (e) { if (e.target === el) close(); };
    $$("[data-go]", el).forEach(function (b) {
      b.onclick = function () {
        var g = b.dataset.go; close();
        if (g === "trips") tripSheet(); else if (g === "backup") doBackup(); else if (g === "export") exportChooser(); else go(g);
      };
    });
    var first = $(".mrow", el); if (first) first.focus({ preventScroll: true });
  }
  /** Top app bar. Main tabs show a large title below it that collapses into the bar on scroll. */
  function appbar(title, opts) {
    opts = opts || {};
    return '<header class="appbar' + (opts.solid ? " solid" : "") + '">' +
      (opts.back ? '<button class="back" data-back>' + icon("chevron_left") + esc(opts.backLabel || "Back") + "</button>" : "") + (opts.left || "") +
      '<div class="appbar-title">' + esc(title) + "</div>" + (opts.right || "") + "</header>";
  }
  function mainHeader(title, opts) {
    opts = opts || {};
    return appbar(title, { left: menuBtn() + tripSub(), right: opts.right || "" }) +
      '<div class="title-block"><h1 class="large-title">' + (opts.titleHtml || esc(title)) + "</h1>" + (opts.sub || "") + "</div>";
  }
  function emptyState(ic, line, btn) {
    return '<div class="empty"><div class="bubble">' + icon(ic) + "</div><p>" + line + "</p>" + (btn || "") + "</div>";
  }
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
      "</div>";
    var sh = sheet(html, [{ label: "Camera not working?", cls: "text", onClick: cameraHelp }, { label: "Cancel" }]);
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

  /** Short message at the bottom. action: { label, fn } adds a button such as Undo. */
  function toast(msg, ms, action) {
    var t = $("#toast");
    t.innerHTML = "<span>" + esc(msg) + "</span>" + (action ? '<button class="toast-act">' + esc(action.label) + "</button>" : "");
    t.hidden = false;
    if (action) $(".toast-act", t).onclick = function () { t.hidden = true; action.fn(); };
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
  function thumb(p, opts) {
    opts = opts || {};
    var vid = Photos.isVideo(p) ? '<span class="vbadge">' + icon("play_arrow", true) + duration(p.durationMs) + "</span>" : "";
    var badge = vid + ((p.caption || "").trim() ? '<span class="cbadge" title="Has a comment">' + icon("chat_bubble", true) + "</span>" : "");
    var on = opts.sel && opts.sel.has(p.id);
    return '<a href="#/photo/' + p.id + '" class="thumb' + (on ? " sel" : "") + '" data-id="' + p.id + '" aria-label="' + (Photos.isVideo(p) ? "Video" : "Photo") + (p.caption ? ": " + esc(p.caption) : "") + '"' +
      (opts.sel ? ' role="checkbox" aria-checked="' + !!on + '"' : "") + '><img data-photo="' + p.id + '" alt="">' + badge +
      (opts.sel ? '<span class="tick">' + icon(on ? "check_circle" : "radio_button_unchecked", on) + "</span>" : "") + "</a>";
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
    if (!isInstalled() && !Store.settings.installTipClosed)
      banners += '<div class="card notice warn">' + icon("add") + "<div><b>Add to Home Screen</b> so the journal is kept safe. Tap <b>Share</b> <span class=\"ios-share\"></span> then <b>Add to Home Screen</b>.</div>" +
        '<button class="icon-btn small" id="closeInstall" aria-label="Hide this tip">' + icon("close", false, "sm") + "</button></div>";
    if (storageLevel === "CRITICAL") banners += notice("warning", "<b>The phone is almost full.</b> New photos are paused until you free some space.", "warn");
    else if (storageLevel === "LOW") banners += notice("storage", "Under 1 GB left for the journal. Consider a backup and freeing space.", "warn");
    var tc = Store.tripCounts(t.id);
    if (Store.trips().length === 1 && !t.startDate && t.name === "My trip" && !tc.photos && !tc.places && !tc.entries)
      banners += notice("travel_explore", "<b>Welcome!</b> Tap here to name your trip, set its dates and pick a colour.", "tonal", "#/more/trip");
    else if (t.startDate && date < t.startDate) banners += notice("flight", esc(t.name) + " starts in " + plural(Math.round((Store.dateObj(t.startDate) - Store.dateObj(date)) / 864e5), "day") + ". Anything you add now still goes into this trip.");
    else if (t.endDate && date > t.endDate) banners += notice("luggage", esc(t.name) + " ended on " + Store.shortDay(t.endDate) + '. Starting somewhere new? <b>Tap to start a new trip</b> so today doesn\'t land in this one.', "warn", "#", " data-newtrip");
    var cur = Store.currentPlaceId();
    var x = Store.dateObj(date);
    var where = cur ? '<a href="#/place/' + cur + '">' + esc(placeName(cur)) + "</a>" : d.cities.length ? esc(d.cities.join(", ")) : "No place yet";
    var photos = d.photos.slice().reverse();
    var title = x.toLocaleDateString("en", { weekday: "long" }) + " " + x.getDate() + " " + x.toLocaleDateString("en", { month: "long" });
    var meta = '<div class="today-meta">' + (dayN ? "<b>Day " + dayN + "</b><span>·</span>" : "") + icon("location_on", true, "sm") + "<span>" + where + "</span>" +
      '<button class="link" id="sync">Update</button></div>';
    return '<div class="page">' + mainHeader("Today", { titleHtml: esc(title), sub: meta }) +
      banners +
      '<div class="quick">' +
      '<button class="btn primary big" id="takePhoto">' + icon("photo_camera") + "Take photo</button>" +
      '<div class="quick-row">' +
      '<button class="tile" id="addLib">' + icon("photo_library") + "<span>Library</span></button>" +
      '<button class="tile" id="addVid">' + icon("videocam") + "<span>Video</span></button>" +
      '<button class="tile" id="addNote">' + icon("edit_note") + "<span>Note</span></button></div></div>" +
      '<div class="sec-head"><h2>' + (photos.length ? "Today’s photos <span class=\"count\">" + photos.length + "</span>" : "Today’s photos") + "</h2>" + (photos.length ? '<a href="#/day/' + date + '">See all</a>' : "") + "</div>" +
      (photos.length ? thumbGrid(photos.slice(0, 12), "strip") : '<p class="muted soft">Nothing yet today. Photos you take land here.</p>') +
      '<section class="card"><label class="card-title" for="todayNote">How was today?</label>' +
      '<textarea id="todayNote" data-autosave="note" placeholder="A few words about today" rows="3">' + esc(log.note || "") + "</textarea>" +
      '<div class="rate-row">' + moodPicker("mood", log.mood) + stars("rating", log.rating) + "</div></section>" +
      (d.places.length ? '<div class="sec-head"><h2>Places today</h2></div>' + d.places.map(placeRow).join("") : "") +
      (d.entries.length ? '<div class="sec-head"><h2>Notes today</h2></div>' + d.entries.map(entryRow).join("") : "") +
      statusLine() + "</div>";
  }
  /** "Saved on this phone · backed up 2 days ago", amber when a backup is overdue. */
  function statusLine() {
    var nAll = Store.values(Store.ALL.photos).length, lastB = Store.settings.lastBackupUtc || 0;
    var stale = nAll && Date.now() - lastB > 3 * 864e5;
    return '<a class="status-line' + (stale ? " bad" : "") + '" href="#/more/backup">' + icon(stale ? "warning" : "check_circle", !stale, "sm") +
      "<span>Saved on this phone · " + (nAll ? (lastB ? "backed up " + ago(lastB) : "not backed up yet") : "nothing to back up yet") + "</span>" + icon("chevron_right", false, "sm") + "</a>";
  }
  function bindToday(root) {
    var date = Store.today();
    $("#takePhoto", root).onclick = function () { takePhoto(null, null); };
    $("#addLib", root).onclick = function () { importPhotos(null, null); };
    $("#addVid", root).onclick = function () { takeVideo(null, null); };
    $("#addNote", root).onclick = async function () { var e = await Store.newEntry("NOTE", date, Store.currentPlaceId()); go("#/entry/" + e.id); };
    $("#sync", root).onclick = function () { syncNow(this); };
    var ci = $("#closeInstall", root); if (ci) ci.onclick = function () { Store.saveSettings({ installTipClosed: true }); toast("Tip hidden. It's under Settings → Storage and install."); };
    bindPickers(root, function () { return S.dayLogs.get(date) || {}; }, function (c) { Store.saveDayLog(date, c); });
    bindAutosave(root, function (c) { return Store.saveDayLog(date, c); });
  }

  function dayCard(date) {
    var d = Store.day(date), log = d.log || {};
    var bits = [d.photos.length ? plural(d.photos.length, "photo") : null, d.places.length ? plural(d.places.length, "place") : null, d.entries.length ? plural(d.entries.length, "note") : null].filter(Boolean).join(" · ");
    var where = d.cities.length ? d.cities.join(", ") : d.places.slice(0, 3).map(function (p) { return p.name; }).join(", ");
    var x = Store.dateObj(date);
    return '<a class="card day" href="#/day/' + date + '">' +
      '<div class="day-top"><div class="day-date"><b>' + x.getDate() + "</b><span>" + x.toLocaleDateString("en", { month: "short" }) + "</span></div>" +
      '<div class="day-title"><b>' + x.toLocaleDateString("en", { weekday: "long" }) + "</b>" + (where ? '<span class="where">' + esc(where) + "</span>" : "") + "</div>" +
      '<div class="day-mood">' + (log.mood ? moodText(log.mood) : "") + "</div></div>" +
      (log.note ? '<div class="note">' + esc(log.note.length > 160 ? log.note.slice(0, 160) + "…" : log.note) + "</div>" : "") +
      (d.photos.length ? '<div class="mini">' + d.photos.slice(0, 4).map(function (p) { return '<span class="thumb"><img data-photo="' + p.id + '" alt=""></span>'; }).join("") + "</div>" : "") +
      '<div class="bits">' + bits + (log.rating ? " · " + starText(log.rating) : "") + "</div></a>";
  }

  /** Journal: the days as a list, or as a calendar. */
  function viewJournal(mode) {
    var cal = mode === "calendar";
    var seg = '<div class="seg" role="tablist" aria-label="Show as">' +
      '<a role="tab" href="#/journal" class="' + (cal ? "" : "on") + '" aria-selected="' + !cal + '">' + icon("view_agenda", false, "sm") + "List</a>" +
      '<a role="tab" href="#/journal/calendar" class="' + (cal ? "on" : "") + '" aria-selected="' + cal + '">' + icon("calendar_month", false, "sm") + "Calendar</a></div>";
    var dates = Store.allDates();
    return '<div class="page">' + mainHeader("Journal") + seg +
      (cal ? calendarHtml() : dates.length ? dates.map(dayCard).join("") :
        emptyState("menu_book", "Your days show up here as you add photos and notes.", '<a class="btn tonal" href="#/today">Go to Today</a>')) + "</div>";
  }
  function bindJournal(root, mode) { if (mode === "calendar") bindCalendar(root); }

  var calMonth = null;
  function calendarHtml() {
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
    return '<div class="card cal-card"><div class="calhead"><button class="btn icon" id="prevM" aria-label="Previous month">' + icon("chevron_left") + "</button><h2>" + label +
      '</h2><button class="btn icon" id="nextM" aria-label="Next month">' + icon("chevron_right") + "</button></div>" +
      '<div class="cal"><b>M</b><b>T</b><b>W</b><b>T</b><b>F</b><b>S</b><b>S</b>' + cells + "</div></div>" +
      '<div class="cal-legend"><span><i class="has"></i>Days with entries</span>' + (trip.startDate ? '<span><i class="trip"></i>Trip days</span>' : "") + "</div>";
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
      '<button class="chip" id="dayAdd">' + icon("add_a_photo") + "Add photos</button>" +
      '<button class="chip" data-new="NOTE">' + icon("edit_note") + "Note</button>" +
      '<a class="chip" href="#/map/' + date + '">' + icon("map") + "Show on map</a></div>" +
      (d.photos.length ? '<div class="sec-head"><h2>' + plural(d.photos.length, "photo") + "</h2></div>" + thumbGrid(d.photos) : "") +
      (d.places.length ? '<div class="sec-head"><h2>Places</h2></div>' + d.places.map(placeRow).join("") : "") +
      (d.entries.length ? '<div class="sec-head"><h2>Notes</h2></div>' + d.entries.map(entryRow).join("") : "") +
      (!d.photos.length && !d.places.length && !d.entries.length ? emptyState("calendar_today", "Nothing logged on this day yet.") : "") +
      (d.points.length ? '<p class="muted small center">' + plural(d.points.length, "location reading") + " logged.</p>" : "") + "</div>";
  }
  function bindDay(root, date) {
    bindPickers(root, function () { return S.dayLogs.get(date) || {}; }, function (c) { Store.saveDayLog(date, c); });
    bindAutosave(root, function (c) { return Store.saveDayLog(date, c); });
    $("#dayAdd", root).onclick = function () { captureSheet(date, null); };
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

  // ---- Photos tab: every photo in the trip, grouped by day, with Select for clean-up ----

  var sel = null;          // Set of selected ids while Select is on, else null
  var photoCtx = null;     // { ids, filter } the list the viewer swipes through
  var FILTERS = [["all", "All"], ["uncommented", "No comment yet"], ["hidden", "Hidden"], ["deleted", "Recently deleted"]];
  function byTime(a, b) { return a.takenAtUtc - b.takenAtUtc; }
  function hasComment(p) { return !!(p.caption || "").trim(); }
  function photoList(filter) {
    var all = Store.values(S.photos);
    if (filter === "deleted") return all.filter(Store.trashed).sort(function (a, b) { return (b.deletedAtUtc || 0) - (a.deletedAtUtc || 0); });
    if (filter === "hidden") return all.filter(function (p) { return p.status === "READY" && p.hidden; }).sort(byTime);
    var l = all.filter(Store.live);
    if (filter === "uncommented") l = l.filter(function (p) { return !hasComment(p); });
    return l.sort(byTime);
  }
  function filterOf(arg) { return FILTERS.some(function (f) { return f[0] === arg; }) ? arg : "all"; }

  function viewPhotos(arg) {
    var filter = filterOf(arg), list = photoList(filter);
    var counts = {}; FILTERS.forEach(function (f) { counts[f[0]] = f[0] === filter ? list.length : photoList(f[0]).length; });
    var chips = '<div class="chips" role="tablist" aria-label="Show">' + FILTERS.filter(function (f) { return f[0] === "all" || f[0] === "uncommented" || counts[f[0]] || f[0] === filter; }).map(function (f) {
      return '<a role="tab" class="chip' + (f[0] === filter ? " on" : "") + '" href="#/photos/' + f[0] + '" aria-selected="' + (f[0] === filter) + '">' + f[1] + ' <span class="n">' + counts[f[0]] + "</span></a>";
    }).join("") + "</div>";
    var head = sel
      ? '<header class="appbar solid selhead"><button class="btn text" id="selCancel">Cancel</button><div class="appbar-title" id="selCount">' + selLabel() + '</div><button class="btn text" id="selAll">Select all</button></header>'
      : mainHeader("Photos", { right: list.length ? '<button class="btn text" id="selStart">Select</button>' : "" });
    var intro = {
      deleted: list.length ? notice("delete", "Photos here are removed for good " + Store.TRASH_DAYS + " days after you delete them. Select any you want back and tap <b>Restore</b>.", "plain") : "",
      hidden: list.length ? notice("visibility_off", "Hidden photos stay in your backups but are left out of the journal, the map and the memory box.", "plain") : "",
      uncommented: list.length ? notice("chat_bubble", "Open a photo and type under it. <b>Next</b> takes you straight to the next one without a comment.", "plain") : "",
      all: "",
    }[filter];
    var groups = {}, order = [];
    list.forEach(function (p) { var k = filter === "deleted" ? "" : p.localDate; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(p); });
    if (filter !== "deleted") order.sort().reverse();
    var body = order.map(function (k) {
      var g = groups[k];
      return '<section class="pgroup"><div class="pg-head"><b>' + (k ? Store.shortDay(k) : "Deleted") + '</b><span class="muted">' + g.length + "</span>" +
        (sel ? '<button class="btn text sm" data-selday="' + k + '">Select day</button>' : "") + "</div>" +
        '<div class="grid">' + g.map(function (p) { return thumb(p, { sel: sel }); }).join("") + "</div></section>";
    }).join("");
    var empty = {
      all: emptyState("photo_library", "No photos in this trip yet.", '<a class="btn tonal" href="#/today">Take a photo</a>'),
      uncommented: emptyState("check", "Every photo has a comment. Nice work!"),
      hidden: emptyState("visibility", "No hidden photos."),
      deleted: emptyState("delete", "Recently deleted is empty."),
    }[filter];
    var tools = !sel && filter === "all" && list.length > 1
      ? '<button class="card notice link-card" id="review">' + icon("content_copy") + "<div><b>Clean up</b><br><span class=\"muted\">Find similar shots and blurry photos</span></div>" + icon("chevron_right", false, "chev") + "</button>" : "";
    return '<div class="page photos-page" data-ctx>' + head + (sel ? "" : chips) + intro + tools + (list.length ? body : empty) +
      (filter === "all" && list.length && !sel ? '<p class="muted small center">Deleting here never touches the copies in your iPhone’s Photos app.</p>' : "") +
      (filter === "deleted" && list.length && !sel ? '<button class="btn danger-text wide" id="emptyBin">' + icon("delete_forever") + "Empty Recently deleted now</button>" : "") +
      "</div>" + (sel ? selBar(filter) : "");
  }
  function selLabel() { var n = sel ? sel.size : 0; return n ? n + " selected" : "Select photos"; }
  function selBar(filter) {
    var b = filter === "deleted"
      ? [["restore", "restore_from_trash", "Restore"], ["forever", "delete_forever", "Delete"]]
      : [["comment", "chat_bubble", "Comment"], ["site", "redeem", "Website"], filter === "hidden" ? ["unhide", "visibility", "Unhide"] : ["hide", "visibility_off", "Hide"], ["share", "share", "Share"], ["trash", "delete", "Delete"]];
    return '<div class="selbar" role="toolbar" aria-label="Selected photos">' + b.map(function (x) {
      return '<button data-act="' + x[0] + '"' + (x[0] === "trash" || x[0] === "forever" ? ' class="danger"' : "") + ">" + icon(x[1]) + x[2] + "</button>";
    }).join("") + "</div>";
  }

  function bindPhotos(root, arg) {
    var filter = filterOf(arg);
    function ids() { return Array.from(sel || []); }
    function refreshSel() {
      $$(".thumb[data-id]", root).forEach(function (a) {
        var on = sel && sel.has(a.dataset.id);
        a.classList.toggle("sel", !!on); a.setAttribute("aria-checked", !!on);
        var t = $(".tick", a); if (t) t.innerHTML = icon(on ? "check_circle" : "radio_button_unchecked", on);
      });
      var c = $("#selCount"); if (c) c.textContent = selLabel();
      $$(".selbar button").forEach(function (b) { b.disabled = !sel || !sel.size; });
    }
    function startSel(firstId) { sel = new Set(firstId ? [firstId] : []); render(true); }
    function endSel() { sel = null; render(true); }
    var st = $("#selStart", root); if (st) st.onclick = function () { startSel(null); };
    var sc = $("#selCancel", root); if (sc) sc.onclick = endSel;
    var sa = $("#selAll", root); if (sa) sa.onclick = function () {
      var all = $$(".thumb[data-id]", root).map(function (a) { return a.dataset.id; });
      sel = sel.size === all.length ? new Set() : new Set(all); refreshSel();
    };
    $$("[data-selday]", root).forEach(function (b) {
      b.onclick = function () {
        var g = $$(".thumb[data-id]", b.closest(".pgroup")).map(function (a) { return a.dataset.id; });
        var allOn = g.every(function (id) { return sel.has(id); });
        g.forEach(function (id) { if (allOn) sel.delete(id); else sel.add(id); });
        refreshSel();
      };
    });
    // Tap selects while Select is on; a long press starts it.
    $$(".thumb[data-id]", root).forEach(function (a) {
      var timer = null, longPressed = false;
      a.addEventListener("click", function (e) {
        if (longPressed) { e.preventDefault(); longPressed = false; return; }
        if (!sel) return;
        e.preventDefault();
        var id = a.dataset.id; if (sel.has(id)) sel.delete(id); else sel.add(id);
        refreshSel();
      });
      a.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      a.addEventListener("pointerdown", function () {
        if (sel) return;
        longPressed = false;
        timer = setTimeout(function () { longPressed = true; if (navigator.vibrate) navigator.vibrate(10); startSel(a.dataset.id); }, 450);
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { a.addEventListener(ev, function () { clearTimeout(timer); }); });
    });
    var rv = $("#review", root); if (rv) rv.onclick = function () { go("#/review"); };
    var eb = $("#emptyBin", root); if (eb) eb.onclick = function () {
      var all = photoList("deleted").map(function (p) { return p.id; });
      confirmSheet("Remove " + plural(all.length, "photo") + " for good? This can't be undone.", "Delete for good", async function () { await Store.deletePhotosForever(all); toast("Recently deleted is empty."); });
    };
    $$(".selbar button").forEach(function (b) {
      b.onclick = function () { photoAction(b.dataset.act, ids(), filter, endSel); };
    });
    refreshSel();
  }

  /** Runs one of the Select bar actions on a list of photo ids. Hide and delete can be undone. */
  function photoAction(act, list, filter, done) {
    if (!list.length) return;
    var n = plural(list.length, "photo");
    if (act === "trash") {
      Store.trashPhotos(list).then(function () { done(); toast(n + " moved to Recently deleted.", 6000, { label: "Undo", fn: function () { Store.restorePhotos(list); } }); });
    } else if (act === "hide") {
      Store.hidePhotos(list, true).then(function () { done(); toast(n + " hidden from the journal.", 6000, { label: "Undo", fn: function () { Store.hidePhotos(list, false); } }); });
    } else if (act === "unhide") {
      Store.hidePhotos(list, false).then(function () { done(); toast(n + " back in the journal."); });
    } else if (act === "restore") {
      Store.restorePhotos(list).then(function () { done(); toast(n + " restored."); });
    } else if (act === "forever") {
      confirmSheet("Remove " + n + " for good? This can't be undone.", "Delete for good", function () { Store.deletePhotosForever(list).then(function () { done(); toast(n + " deleted."); }); });
    } else if (act === "share") {
      shareMany(list);
    } else if (act === "comment") {
      bulkComment(list, done);
    } else if (act === "site") {
      siteAction(list, done);
    }
  }

  function bulkComment(list, done) {
    var rows = list.map(function (id) { return S.photos.get(id); }).filter(Boolean);
    var withC = rows.filter(hasComment).length;
    var html = "<h3>Comment on " + plural(rows.length, "photo") + "</h3>" +
      '<textarea id="bulkText" rows="3" placeholder="For example: Dinner at the night market" aria-label="Comment"></textarea>' +
      (withC ? '<div class="radio-list">' +
        '<label><input type="radio" name="bulkMode" value="empty" checked><span>Only the ' + plural(rows.length - withC, "photo") + " without a comment</span></label>" +
        '<label><input type="radio" name="bulkMode" value="all"><span>All ' + rows.length + ", replacing " + withC + " existing " + (withC === 1 ? "comment" : "comments") + "</span></label></div>" : "");
    var sh = sheet(html, [{ label: "Cancel" }, { label: "Save", cls: "primary", keepOpen: true, onClick: function () {
      var text = $("#bulkText").value.trim();
      if (!text) { $("#bulkText").focus(); return; }
      var m = $('input[name="bulkMode"]:checked'), mode = m ? m.value : "all";
      var before = {}; rows.forEach(function (p) { before[p.id] = p.caption || ""; });
      var target = rows.filter(function (p) { return mode === "all" || !hasComment(p); }).map(function (p) { return p.id; });
      sh.close();
      Store.updatePhotos(target, { caption: text }).then(function () {
        done();
        toast("Comment added to " + plural(target.length, "photo") + ".", 6000, { label: "Undo", fn: function () { Store.updatePhotos(target, function (p) { return { caption: before[p.id] }; }); } });
      });
    } }]);
    setTimeout(function () { var t = $("#bulkText", sh.el); if (t) t.focus(); }, 50);
  }

  async function shareMany(list) {
    if (!navigator.canShare) return toast("This browser can't share several photos at once. Open each photo and use Share.");
    var files = [];
    for (var id of list.slice(0, 20)) {
      var p = S.photos.get(id), b = p && await Store.getBlob("full:" + p.fileName);
      if (b) files.push(new File([b], safeName(tripName()) + "-" + p.localDate + "-" + p.id.slice(0, 6) + "." + p.fileName.split(".").pop(), { type: Photos.mimeOf(p.fileName) }));
    }
    if (!navigator.canShare({ files: files })) return toast("These can't be shared from here. Try fewer at a time.");
    sheet("<h3>Share " + plural(files.length, "photo") + "</h3>" + (list.length > 20 ? '<p class="muted">The first 20 of ' + list.length + " (iPhone's limit for one go).</p>" : "") +
      "<p>Choose <b>Save Images</b> to put them in Photos, or pick an app.</p>", [{ label: "Cancel" }, { label: "Share", cls: "primary", onClick: function () {
        navigator.share({ files: files }).catch(function (e) { if (e.name !== "AbortError") toast("Sharing failed: " + e.message); });
      } }]);
  }

  // ---- Clean up: similar shots and possibly blurry photos (suggestions only) ----

  var looks = new Map(); // photo id -> { hash: [64 bits], sharp: number }
  async function lookAt(p) {
    if (looks.has(p.id)) return looks.get(p.id);
    var b = await Photos.thumbBlob(p); if (!b) return null;
    var img = await new Promise(function (res) { var u = URL.createObjectURL(b), i = new Image(); i.onload = function () { URL.revokeObjectURL(u); res(i); }; i.onerror = function () { URL.revokeObjectURL(u); res(null); }; i.src = u; });
    if (!img) return null;
    function grey(w, h) {
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
      var d = x.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
      for (var i = 0; i < w * h; i++) out[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
      return out;
    }
    // Difference hash: does brightness rise or fall from each pixel to the next, on a 9 x 8 copy.
    var g = grey(9, 8), hash = [];
    for (var y = 0; y < 8; y++) for (var xx = 0; xx < 8; xx++) hash.push(g[y * 9 + xx] < g[y * 9 + xx + 1] ? 1 : 0);
    // Sharpness: how much the edges vary (Laplacian), on a 96 x 96 copy.
    var N = 96, q = grey(N, N), sum = 0, sum2 = 0, n = 0;
    for (var yy = 1; yy < N - 1; yy++) for (var x2 = 1; x2 < N - 1; x2++) {
      var i0 = yy * N + x2, lap = q[i0 - 1] + q[i0 + 1] + q[i0 - N] + q[i0 + N] - 4 * q[i0];
      sum += lap; sum2 += lap * lap; n++;
    }
    var r = { hash: hash, sharp: sum2 / n - (sum / n) * (sum / n) };
    looks.set(p.id, r);
    return r;
  }
  function hamming(a, b) { var d = 0; for (var i = 0; i < 64; i++) if (a[i] !== b[i]) d++; return d; }

  var reviewSel = new Set();
  function viewReview() {
    return '<div class="page">' + appbar("Clean up", { back: true, solid: true, backLabel: "Photos" }) +
      '<p class="section-intro">Suggestions only: nothing is deleted unless you pick it. Tap the photos you don’t need, then Delete. They wait in Recently deleted for ' + Store.TRASH_DAYS + " days.</p>" +
      '<div id="reviewBody"><p class="muted"><span class="spin"></span> Looking through your photos…</p></div></div>' +
      '<div class="selbar" role="toolbar"><button id="revDelete" class="danger" disabled>' + icon("delete") + '<span id="revLabel">Delete</span></button></div>';
  }
  async function bindReview(root) {
    reviewSel = new Set();
    var list = photoList("all").filter(function (p) { return !Photos.isVideo(p); }), info = [];
    for (var i = 0; i < list.length; i++) {
      var r = null; try { r = await lookAt(list[i]); } catch (e) { }
      if (r) info.push({ p: list[i], r: r });
      var m = $("#reviewBody p"); if (m && i % 10 === 0) m.innerHTML = '<span class="spin"></span> Looking through your photos… ' + (i + 1) + " of " + list.length;
      if (!root.isConnected) return;
    }
    // Similar: taken within 2 minutes of the previous shot and looking almost the same.
    var groups = [], cur = null;
    info.forEach(function (x, k) {
      var prev = info[k - 1];
      if (prev && x.p.takenAtUtc - prev.p.takenAtUtc < 120e3 && hamming(x.r.hash, prev.r.hash) <= 12) { if (!cur) { cur = [prev]; groups.push(cur); } cur.push(x); }
      else cur = null;
    });
    // Possibly blurry: far less edge detail than this trip's typical photo.
    var sharp = info.map(function (x) { return x.r.sharp; }).sort(function (a, b) { return a - b; });
    var median = sharp[Math.floor(sharp.length / 2)] || 0;
    var blurry = info.filter(function (x) { return x.r.sharp < Math.min(median * 0.3, 120); });
    function strip(items) { return '<div class="grid">' + items.map(function (x) { return thumb(x.p, { sel: reviewSel }); }).join("") + "</div>"; }
    var html = "";
    if (groups.length) html += '<div class="sec-head"><h2>Similar shots <span class="count">' + groups.length + "</span></h2></div>" +
      groups.map(function (g) { return '<div class="card review-group"><div class="muted small">' + plural(g.length, "photo") + " · " + Store.shortDay(g[0].p.localDate) + " " + Store.clock(g[0].p.takenAtUtc, g[0].p.tzId) + "</div>" + strip(g) + "</div>"; }).join("");
    if (blurry.length) html += '<div class="sec-head"><h2>Possibly blurry <span class="count">' + blurry.length + "</span></h2></div>" + strip(blurry);
    if (!html) html = emptyState("check", "No similar or blurry photos found. Your trip looks tidy!");
    var body = $("#reviewBody", root); if (!body) return;
    body.innerHTML = html;
    hydrateThumbs(body);
    function refresh() {
      $$(".thumb[data-id]", body).forEach(function (a) {
        var on = reviewSel.has(a.dataset.id);
        a.classList.toggle("sel", on); a.setAttribute("aria-checked", on);
        $(".tick", a).innerHTML = icon(on ? "check_circle" : "radio_button_unchecked", on);
      });
      $("#revDelete").disabled = !reviewSel.size;
      $("#revLabel").textContent = reviewSel.size ? "Delete " + plural(reviewSel.size, "photo") : "Delete";
    }
    $$(".thumb[data-id]", body).forEach(function (a) {
      a.onclick = function (e) { e.preventDefault(); var id = a.dataset.id; if (reviewSel.has(id)) reviewSel.delete(id); else reviewSel.add(id); refresh(); };
    });
    $("#revDelete").onclick = function () {
      var ids = Array.from(reviewSel);
      Store.trashPhotos(ids).then(function () {
        toast(plural(ids.length, "photo") + " moved to Recently deleted.", 6000, { label: "Undo", fn: function () { Store.restorePhotos(ids); } });
      });
    };
  }

  // ---- Website versions: different memory box websites for different people ----
  // Stored on the trip row as sites: [{ id, name, out: [photo ids left out] }]. Every version starts
  // with all photos, so new photos go in automatically. Nothing is deleted or hidden in the journal.

  function sites() { var t = Store.trip(); return (t && t.sites) || []; }
  function siteById(id) { return sites().filter(function (x) { return x.id === id; })[0] || null; }
  function saveSites(list) { return Store.updateTrip(Store.trip().id, { sites: list }); }
  function inSite(site, p) { return !site || site.out.indexOf(p.id) < 0; }
  function siteCount(site) { var l = photoList("all"); return { inn: l.filter(function (p) { return inSite(site, p); }).length, all: l.length }; }
  function newSite(onDone) {
    var sh = sheet('<h3>New website version</h3><label class="lbl" for="siteName">Who is it for?</label><input id="siteName" placeholder="For example: Family, Work friends" autocomplete="off" enterkeyhint="done">' +
      '<p class="muted small">It starts with every photo. Then leave out the ones these people shouldn’t see.</p>',
      [{ label: "Cancel" }, { label: "Create", cls: "primary", keepOpen: true, onClick: async function () {
        var name = $("#siteName").value.trim();
        if (!name) { $("#siteName").focus(); return; }
        sh.close();
        var site = { id: Store.newId(), name: name, out: [] };
        await saveSites(sites().concat([site]));
        if (onDone) onDone(site); else go("#/site/" + site.id);
      } }]);
    setTimeout(function () { var i = $("#siteName", sh.el); if (i) i.focus(); }, 50);
  }

  function viewSites() {
    var all = photoList("all").length;
    return '<div class="page">' + appbar("Website versions", { back: true, solid: true }) +
      '<h1 class="large-title">Website versions</h1>' +
      '<p class="section-intro">Make a different memory box website for different people. Each version starts with every photo; tap the ones to leave out. Nothing is deleted, and the journal keeps every photo.</p>' +
      '<div class="card site-card"><div class="site-top"><div><b>Everyone</b><span>All ' + plural(all, "photo") + "</span></div></div>" +
      '<div class="site-btns"><button class="btn tonal sm" data-export="">' + icon("redeem", false, "sm") + "Export</button></div></div>" +
      sites().map(function (x) {
        var c = siteCount(x);
        return '<div class="card site-card"><div class="site-top"><div><b>' + esc(x.name) + "</b><span>" + c.inn + " of " + plural(c.all, "photo") + "</span></div>" +
          '<button class="icon-btn" data-sitemore="' + x.id + '" aria-label="More for ' + esc(x.name) + '">' + icon("more_vert") + "</button></div>" +
          '<div class="site-btns"><a class="btn primary sm" href="#/site/' + x.id + '">' + icon("check_circle", false, "sm") + "Choose photos</a>" +
          '<button class="btn tonal sm" data-export="' + x.id + '">' + icon("redeem", false, "sm") + "Export</button></div></div>";
      }).join("") +
      '<button class="btn outline wide" id="newSite">' + icon("add") + "New website version</button></div>";
  }
  function bindSites(root) {
    $("#newSite", root).onclick = function () { newSite(); };
    $$("[data-export]", root).forEach(function (b) { b.onclick = function () { doExport(b.dataset.export || null); }; });
    $$("[data-sitemore]", root).forEach(function (b) {
      b.onclick = function () {
        var x = siteById(b.dataset.sitemore); if (!x) return;
        var sh = sheet("<h3>" + esc(x.name) + '</h3><div class="actions">' +
          '<button class="action" data-a="rename"><span class="lead">' + icon("edit") + "</span><div>Rename</div></button>" +
          '<button class="action" data-a="copy"><span class="lead">' + icon("content_copy") + "</span><div>Make a copy<span class=\"sub\">Same photo choices, new name</span></div></button>" +
          '<button class="action" data-a="del"><span class="lead">' + icon("delete") + "</span><div>Delete this version<span class=\"sub\">Only the choices. No photos are deleted.</span></div></button></div>", [{ label: "Close" }]);
        $$("[data-a]", sh.el).forEach(function (a) {
          a.onclick = function () {
            sh.close();
            if (a.dataset.a === "del") confirmSheet("Delete the website version “" + x.name + "”? Your photos stay as they are.", "Delete", function () {
              saveSites(sites().filter(function (y) { return y.id !== x.id; })).then(function () { toast("Version deleted."); });
            });
            else if (a.dataset.a === "copy") saveSites(sites().concat([{ id: Store.newId(), name: x.name + " (copy)", out: x.out.slice() }])).then(function () { toast("Copy made."); });
            else {
              var r = sheet('<h3>Rename</h3><input id="siteName" value="' + esc(x.name) + '" enterkeyhint="done" aria-label="Name">', [{ label: "Cancel" }, { label: "Save", cls: "primary", onClick: function () {
                var n = $("#siteName").value.trim(); if (!n) return;
                saveSites(sites().map(function (y) { return y.id === x.id ? Object.assign({}, y, { name: n }) : y; }));
              } }]);
              setTimeout(function () { var i = $("#siteName", r.el); if (i) i.focus(); }, 50);
            }
          };
        });
      };
    });
  }

  /** Tap photos to put them in or leave them out of one website version. */
  function viewSite(id) {
    var x = siteById(id);
    if (!x) return '<div class="page">' + appbar("Website", { back: true, solid: true }) + emptyState("redeem", "This website version was deleted.") + "</div>";
    var list = photoList("all"), c = siteCount(x), groups = {}, order = [];
    list.forEach(function (p) { if (!groups[p.localDate]) { groups[p.localDate] = []; order.push(p.localDate); } groups[p.localDate].push(p); });
    order.sort().reverse();
    return '<div class="page site-page">' + appbar(x.name, { back: true, solid: true, backLabel: "Versions" }) +
      '<h1 class="large-title">' + esc(x.name) + "</h1>" +
      '<div class="site-bar"><b id="siteCount">' + c.inn + " of " + c.all + "</b> photos go into this website" +
      '<span class="site-all"><button class="btn text sm" data-all="in">All in</button><button class="btn text sm" data-all="out">All out</button></span></div>' +
      notice("info", "Tap a photo to leave it out (it fades) or put it back. Nothing is deleted.", "plain") +
      order.map(function (k) {
        return '<section class="pgroup"><div class="pg-head"><b>' + Store.shortDay(k) + '</b><span class="muted">' + groups[k].length + '</span><button class="btn text sm" data-day="' + k + '">In / out</button></div>' +
          '<div class="grid">' + groups[k].map(function (p) {
            var on = inSite(x, p);
            return '<button class="thumb pick' + (on ? "" : " out") + '" data-pick="' + p.id + '" aria-pressed="' + on + '" aria-label="' + (on ? "In the website" : "Left out") + '"><img data-photo="' + p.id + '" alt="">' +
              (Photos.isVideo(p) ? '<span class="vbadge">' + icon("play_arrow", true) + "</span>" : "") +
              '<span class="tick">' + icon(on ? "check_circle" : "visibility_off", on) + "</span></button>";
          }).join("") + "</div></section>";
      }).join("") + "</div>" +
      '<div class="selbar" role="toolbar"><button id="siteExport">' + icon("redeem") + "Export this website</button></div>";
  }
  function bindSite(root, id) {
    var x = siteById(id); if (!x) return;
    var out = new Set(x.out), timer = null;
    function paint() {
      $$("[data-pick]", root).forEach(function (b) {
        var on = !out.has(b.dataset.pick);
        b.classList.toggle("out", !on); b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", on ? "In the website" : "Left out");
        $(".tick", b).innerHTML = icon(on ? "check_circle" : "visibility_off", on);
      });
      var all = photoList("all"), inn = all.filter(function (p) { return !out.has(p.id); }).length;
      $("#siteCount", root).textContent = inn + " of " + all.length;
    }
    // Saved quietly a moment after the last tap; the page isn't redrawn, so the scroll position stays.
    function save() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var t = Store.trip(), list = (t.sites || []).map(function (y) { return y.id === id ? Object.assign({}, y, { out: Array.from(out) }) : y; });
        Store.updateTrip(t.id, { sites: list });
      }, 400);
    }
    bindSite.flush = function () { if (timer) { clearTimeout(timer); timer = null; var t = Store.trip(); Store.updateTrip(t.id, { sites: (t.sites || []).map(function (y) { return y.id === id ? Object.assign({}, y, { out: Array.from(out) }) : y; }) }); } };
    $$("[data-pick]", root).forEach(function (b) { b.onclick = function () { var k = b.dataset.pick; if (out.has(k)) out.delete(k); else out.add(k); paint(); save(); }; });
    $$("[data-day]", root).forEach(function (b) {
      b.onclick = function () {
        var ids = $$("[data-pick]", b.closest(".pgroup")).map(function (e) { return e.dataset.pick; });
        var anyIn = ids.some(function (k) { return !out.has(k); });
        ids.forEach(function (k) { if (anyIn) out.add(k); else out.delete(k); });
        paint(); save();
      };
    });
    $$("[data-all]", root).forEach(function (b) {
      b.onclick = function () { photoList("all").forEach(function (p) { if (b.dataset.all === "in") out.delete(p.id); else out.add(p.id); }); paint(); save(); };
    });
    $("#siteExport").onclick = function () { bindSite.flush(); setTimeout(function () { doExport(id); }, 50); };
  }

  /** Chooses which version to export when there is more than one; otherwise exports everything. */
  function exportChooser() {
    if (!sites().length) return doExport(null);
    var html = "<h3>Export which website?</h3><div class=\"pick-list\">" +
      '<button class="row" data-id=""><div class="body"><b>Everyone</b><div class="muted">All ' + plural(photoList("all").length, "photo") + "</div></div></button>" +
      sites().map(function (x) { var c = siteCount(x); return '<button class="row" data-id="' + x.id + '"><div class="body"><b>' + esc(x.name) + '</b><div class="muted">' + c.inn + " of " + plural(c.all, "photo") + "</div></div></button>"; }).join("") + "</div>";
    var sh = sheet(html, [{ label: "Cancel" }, { label: "Manage versions", cls: "text", onClick: function () { go("#/sites"); } }]);
    $$(".pick-list .row", sh.el).forEach(function (b) { b.onclick = function () { sh.close(); doExport(b.dataset.id || null); }; });
  }

  /** Select bar: leave the selected photos out of (or put them back into) one website version. */
  function siteAction(list, done) {
    var html = "<h3>Website for " + plural(list.length, "photo") + "</h3><p class=\"muted small\">Pick a version, then choose whether these photos go in or stay out. Nothing is deleted.</p><div class=\"pick-list\">" +
      sites().map(function (x) {
        var outN = list.filter(function (id) { return x.out.indexOf(id) >= 0; }).length;
        return '<div class="row site-row"><div class="body"><b>' + esc(x.name) + '</b><div class="muted">' + (outN ? outN + " of these left out" : "All of these are in") + "</div></div>" +
          '<button class="btn text sm" data-in="' + x.id + '">Put in</button><button class="btn text sm" data-out="' + x.id + '">Leave out</button></div>';
      }).join("") + "</div>";
    var sh = sheet(html, [{ label: "Close" }, { label: "New version", cls: "outline", onClick: function () { newSite(function (site) { siteAction(list, done); }); } }]);
    function apply(id, leaveOut) {
      sh.close();
      var x = siteById(id), set = new Set(x.out);
      list.forEach(function (k) { if (leaveOut) set.add(k); else set.delete(k); });
      saveSites(sites().map(function (y) { return y.id === id ? Object.assign({}, y, { out: Array.from(set) }) : y; })).then(function () {
        done(); toast(plural(list.length, "photo") + (leaveOut ? " left out of " : " put into ") + x.name + ".");
      });
    }
    $$("[data-in]", sh.el).forEach(function (b) { b.onclick = function () { apply(b.dataset.in, false); }; });
    $$("[data-out]", sh.el).forEach(function (b) { b.onclick = function () { apply(b.dataset.out, true); }; });
    if (!sites().length) { sh.close(); newSite(function () { siteAction(list, done); }); }
  }

  // ---- Photo viewer ----

  var fullUrl = null;
  var LOC_TEXT = { GPS: "Location from GPS", APPROX: "Approximate location, borrowed from a nearby reading", MANUAL: "Place set by hand", NONE: "No location", WAITING: "Finding location…" };
  /** The list the viewer moves through: the grid it was opened from, else the whole trip. */
  function ctxIds(id) {
    if (photoCtx && photoCtx.ids.indexOf(id) >= 0) return photoCtx.ids;
    var p = S.photos.get(id);
    var l = p && Store.trashed(p) ? photoList("deleted") : p && p.hidden ? photoList("hidden") : photoList("all");
    return l.map(function (x) { return x.id; });
  }
  function nextUncommented(id) {
    var l = photoList("all"), i = l.findIndex(function (p) { return p.id === id; });
    for (var k = 1; k <= l.length; k++) { var p = l[(i + k + l.length) % l.length]; if (p.id !== id && !hasComment(p)) return p.id; }
    return null;
  }
  function viewPhoto(id) {
    var p = S.photos.get(id);
    if (!p) return '<div class="page">' + appbar("Photo", { back: true, solid: true }) + emptyState("image", "This photo was deleted.") + "</div>";
    var vid = Photos.isVideo(p), list = ctxIds(id), pos = list.indexOf(id);
    var gone = Store.trashed(p);
    var state = gone ? '<div class="vstate">' + icon("delete", false, "sm") + "In Recently deleted</div>" : p.hidden ? '<div class="vstate">' + icon("visibility_off", false, "sm") + "Hidden from the journal</div>" : "";
    var nextU = !gone && photoCtx && photoCtx.filter === "uncommented";
    return '<div class="viewer" id="viewer">' +
      '<div class="media" id="media">' + (vid ? '<video id="fullVid" controls playsinline preload="metadata"></video>' : '<img id="fullImg" alt="' + esc(p.caption || "Photo") + '">') + "</div>" +
      '<div class="top"><button class="back" data-back aria-label="Back">' + icon("chevron_left") + "</button>" +
      '<div class="t"><b>' + esc(placeName(p.placeId) || "No place") + "</b>" + Store.prettyDay(p.localDate) + " · " + Store.clock(p.takenAtUtc, p.tzId) + "</div>" +
      (list.length > 1 && pos >= 0 ? '<div class="pos">' + (pos + 1) + " / " + list.length + "</div>" : "") + "</div>" +
      (list.length > 1 ? '<button class="nav prev" data-step="-1" aria-label="Previous photo"' + (pos > 0 ? "" : " hidden") + ">" + icon("chevron_left") + "</button>" +
        '<button class="nav next" data-step="1" aria-label="Next photo"' + (pos < list.length - 1 ? "" : " hidden") + ">" + icon("chevron_right") + "</button>" : "") +
      '<div class="bottom">' + state +
      (gone ? "" : '<div class="comment">' + icon("chat_bubble", false, "sm") +
        '<textarea id="capText" data-autosave="caption" rows="1" placeholder="Add a comment…" aria-label="Comment">' + esc(p.caption || "") + "</textarea>" +
        (nextU ? '<button class="next-u" id="nextU">Next' + icon("arrow_forward", false, "sm") + "</button>" : "") + "</div>") +
      '<div class="bar">' + (gone
        ? '<button id="restorePh">' + icon("restore_from_trash") + "Restore</button>" + '<button id="foreverPh">' + icon("delete_forever") + "Delete</button>"
        : '<button id="sharePh">' + icon("share") + "Share</button>" +
          '<button id="photoPlace">' + icon("location_on") + "Place</button>" +
          '<button id="infoPh">' + icon("info") + "Details</button>" +
          '<button id="delPh">' + icon("delete") + "Delete</button>") +
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
    var viewer = $("#viewer", root), list = ctxIds(id), pos = list.indexOf(id);
    function step(d) { var n = list[pos + d]; if (n) { flushAll(); location.replace("#/photo/" + n); } }
    // Tap the photo to hide or show the controls; swipe left or right for the next one.
    var sx = null, sy = null;
    $("#media", root).addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    $("#media", root).addEventListener("touchend", function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 60) step(dx < 0 ? 1 : -1);
    });
    $("#media", root).onclick = function (e) { if (e.target.tagName !== "VIDEO") viewer.classList.toggle("hide-ui"); };
    $$("[data-step]", root).forEach(function (b) { b.onclick = function () { step(+b.dataset.step); }; });
    var cap = $("#capText", root);
    if (cap) {
      bindAutosave(root, function (c) { return Store.updatePhoto(id, c); });
      var grow = function () { cap.style.height = "auto"; cap.style.height = Math.min(cap.scrollHeight, 140) + "px"; };
      cap.addEventListener("input", grow); setTimeout(grow, 0);
    }
    var nu = $("#nextU", root);
    if (nu) nu.onclick = function () {
      flushAll();
      var n = nextUncommented(id);
      if (n) location.replace("#/photo/" + n); else { toast("That was the last photo without a comment."); history.back(); }
    };
    async function shareIt() {
      var cur = S.photos.get(id), b = await Store.getBlob("full:" + cur.fileName);
      var ext = cur.fileName.split(".").pop(), type = Photos.mimeOf(cur.fileName);
      var file = new File([b], safeName(tripName()) + "-" + cur.localDate + "." + ext, { type: type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(function (e) { if (e.name !== "AbortError") toast("Sharing failed: " + e.message); });
      } else saveFile(b, file.name, type);
    }
    function on(sel, fn) { var el = $(sel, root); if (el) el.onclick = fn; }
    function leave() { var n = list[pos + 1] || list[pos - 1]; if (n) location.replace("#/photo/" + n); else history.back(); }
    on("#sharePh", shareIt);
    on("#infoPh", function () {
      var cur = S.photos.get(id);
      var sh = sheet("<h3>Details</h3>" +
        '<p><b>' + Store.prettyDay(cur.localDate) + "</b> at " + Store.clock(cur.takenAtUtc, cur.tzId) + "</p>" +
        "<p>" + esc(LOC_TEXT[cur.locStatus] || "") + (cur.accuracyM && cur.locStatus === "GPS" ? " (±" + Math.round(cur.accuracyM) + " m)" : "") + "</p>" +
        (cur.lat != null ? '<p><a href="https://maps.apple.com/?ll=' + cur.lat + "," + cur.lon + '" target="_blank" rel="noopener">Open in Maps</a> · ' : "<p>") + '<a href="#/day/' + cur.localDate + '">Go to this day</a></p>' +
        '<div class="actions">' +
        '<button class="action" data-a="save"><span class="lead">' + icon("download") + "</span><div>Save to Photos<span class=\"sub\">In the share sheet, choose Save Image</span></div></button>" +
        '<button class="action" data-a="hide"><span class="lead">' + icon(cur.hidden ? "visibility" : "visibility_off") + "</span><div>" + (cur.hidden ? "Show in the journal again" : "Hide from the journal") +
        '<span class="sub">' + (cur.hidden ? "Back on the map, in the day and in the memory box" : "Kept in backups, left out of the journal and memory box") + "</span></div></button></div>", [{ label: "Close" }]);
      $$("[data-a]", sh.el).forEach(function (b) {
        b.onclick = function () {
          sh.close();
          if (b.dataset.a === "save") shareIt();
          else { var h = !cur.hidden; Store.hidePhotos([id], h).then(function () { render(true); toast(h ? "Hidden from the journal." : "Back in the journal."); }); }
        };
      });
    });
    on("#photoPlace", function () {
      var cur = S.photos.get(id);
      pickPlace(cur.lat != null ? cur : null, function (place) {
        var change = place ? { placeId: place.id, placeLocked: true, lat: cur.lat != null ? cur.lat : place.lat, lon: cur.lon != null ? cur.lon : place.lon, locStatus: cur.lat != null ? cur.locStatus : "MANUAL" }
          : { placeId: null, placeLocked: false };
        Store.updatePhoto(id, change).then(function () { render(true); });
      }, true);
    });
    on("#delPh", function () {
      flushAll();
      Store.trashPhotos([id]).then(function () {
        toast((Photos.isVideo(p) ? "Video" : "Photo") + " moved to Recently deleted.", 6000, { label: "Undo", fn: function () { Store.restorePhotos([id]); } });
        leave();
      });
    });
    on("#restorePh", function () { Store.restorePhotos([id]).then(function () { toast("Restored."); render(true); }); });
    on("#foreverPh", function () { confirmSheet("Delete this for good? This can't be undone.", "Delete for good", function () { Store.deletePhotosForever([id]).then(leave); }); });
  }

  // ---- Map ----

  var map = null, mapLayers = null, tiles = null;
  function viewMap(date) {
    return '<div class="mapview"><div id="map"></div><div class="map-top">' +
      '<div class="map-left"><button class="pill round" data-menu aria-label="Menu">' + icon("menu", false, "sm") + "</button>" +
      (date ? '<a class="pill" href="#/map">' + icon("close", false, "sm") + Store.shortDay(date) + "</a>" : '<button class="pill" data-trips>' + icon("luggage", false, "sm") + esc(tripName()) + icon("keyboard_arrow_down", false, "sm") + "</button>") + "</div>" +
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
    var st = Store.settings, trip = Store.trip(), nPh = photoList("all").length, nDel = photoList("deleted").length, nHid = photoList("hidden").length;
    return '<div class="page">' + appbar("Settings", { back: true }) + '<h1 class="large-title">Settings</h1>' +
      group("Trip", [
        item("luggage", esc(trip.name), esc([tripDates(trip), SCHEMES[schemeKey()].name].filter(Boolean).join(" · ")), "", { href: "#/more/trip" }),
        item("swap_horiz", "Switch or start a trip", plural(Store.trips().length, "trip") + " on this phone", "data-trips"),
      ]) +
      group("Photos", [
        item("photo_library", "Save all to the Photos app", plural(nPh, "photo") + " in this trip, a batch at a time", 'id="saveAll"'),
        item("delete", "Recently deleted", nDel ? plural(nDel, "photo") + ", removed for good after " + Store.TRASH_DAYS + " days" : "Empty", "", { href: "#/photos/deleted" }),
        item("visibility_off", "Hidden photos", nHid ? plural(nHid, "photo") + " left out of the journal" : "None", "", { href: "#/photos/hidden" }),
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
    return '<div class="page">' + appbar("Trip setup", { back: true, solid: true, backLabel: "Settings" }) +
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
    return '<div class="page">' + appbar("Backup and restore", { back: true, solid: true, backLabel: "Settings" }) +
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
    return '<div class="page">' + appbar("Storage and install", { back: true, solid: true, backLabel: "Settings" }) +
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
    on("export", exportChooser);
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
    var photos = photoList("all");
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

  async function doExport(siteId) {
    var site = siteId ? siteById(siteId) : null;
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
      Store.values(S.photos).filter(function (p) { return Store.live(p) && !Photos.isVideo(p) && inSite(site, p); }).sort(function (a, b) { return a.takenAtUtc - b.takenAtUtc; }).forEach(function (p) { photos.push(p); });
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
        edition: site ? site.name : "",
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
    saveFile(r.zip, safeName(tripName()) + (site ? "-" + safeName(site.name) : "") + "-memory-box-" + Store.today() + ".zip", "application/zip",
      "<h3>Memory box ready</h3><p>" + (site ? esc(site.name) + " version, " : "") + plural(r.photos, "photo") + ". Save it to Files or AirDrop it to a laptop, unzip, and open <b>memory-box/index.html</b>.</p>");
  }

  // ---- Router ----

  var currentRoute = null;
  function parse() {
    var h = (location.hash || "#/today").slice(2).split("/");
    return { name: h[0] || "today", arg: h[1] ? decodeURIComponent(h[1]) : null };
  }

  var TABS = [["today", "Today", "today"], ["journal", "Journal", "menu_book"], ["photos", "Photos", "photo_library"], ["map", "Map", "map"]];
  function renderTabs(active) {
    $("#tabs").innerHTML = TABS.map(function (t) {
      var on = t[0] === active;
      return '<a href="#/' + t[0] + '" data-tab="' + t[0] + '" class="' + (on ? "on" : "") + '"' + (on ? ' aria-current="page"' : "") + '><span class="ind">' + icon(t[2], on) + "</span>" + t[1] + "</a>";
    }).join("");
  }

  // Large titles collapse into the top bar while scrolling down.
  window.addEventListener("scroll", function () { document.body.classList.toggle("scrolled", window.scrollY > 36); }, { passive: true });

  // Opening a photo from a grid remembers that grid, so the viewer can swipe through the same photos.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.thumb[data-id]");
    if (!a || sel) return;
    var scope = a.closest("[data-ctx]") || a.parentNode;
    var r = parse();
    photoCtx = { ids: $$("a.thumb[data-id]", scope).map(function (x) { return x.dataset.id; }), filter: r.name === "photos" ? filterOf(r.arg) : null };
  }, true);

  function render() {
    flushAll();
    if (bindSite.flush) { bindSite.flush(); bindSite.flush = null; }
    var r = parse(), key = r.name + "/" + r.arg, sameRoute = key === currentRoute;
    var scroll = sameRoute ? window.scrollY : 0;
    if (map) { try { map.remove(); } catch (e) { console.warn(e); } map = null; }
    if (r.name !== "photo" && fullUrl) { URL.revokeObjectURL(fullUrl); fullUrl = null; }
    // Older links (#/timeline, #/calendar) open the Journal.
    if (r.name === "timeline") r = { name: "journal", arg: null };
    if (r.name === "calendar") r = { name: "journal", arg: "calendar" };
    if (r.name !== "photos") sel = null;
    var V = {
      today: [viewToday, bindToday], journal: [viewJournal, bindJournal], photos: [viewPhotos, bindPhotos], review: [viewReview, bindReview], sites: [viewSites, bindSites], site: [viewSite, bindSite], map: [viewMap, bindMap],
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
    $$("body > .selbar").forEach(function (el) { el.remove(); });
    view.innerHTML = V[0](r.arg);
    $$(".selbar", view).forEach(function (el) { document.body.appendChild(el); });
    if (V[1]) V[1](view, r.arg);
    hydrateThumbs(view);
    $$("[data-trips]", view).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); tripSheet(); }; });
    $$("[data-menu]", view).forEach(function (b) { b.onclick = openMenu; });
    $$("[data-newtrip]", view).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); newTripSheet(); }; });
    $$("[data-back]", view).forEach(function (b) { b.onclick = function () { if (history.length > 1) history.back(); else go("#/today"); }; });
    var tab = { day: "journal", place: "map", entry: "today", photo: "photos", review: "photos", more: "", sites: "", site: "" }[r.name];
    if (tab == null) tab = r.name;
    if (tab && !TABS.some(function (t) { return t[0] === tab; })) tab = "today";
    renderTabs(tab);
    document.body.classList.toggle("select-mode", !!sel || r.name === "review" || r.name === "site");
    document.body.classList.toggle("map-mode", r.name === "map");
    document.body.classList.toggle("viewer-mode", r.name === "photo" && !!S.photos.get(r.arg));
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
    window.addEventListener("hashchange", function () { $("#sheet").hidden = true; var dr = $("#drawer"); if (dr) dr.remove(); stopCam(); render(); });
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", function () { if (document.hidden) { flushAll(); stopCam(); } else { maybeCheck(); checkStorage(); } });
    setInterval(maybeCheck, 60e3);
    await checkStorage();
    if (isInstalled()) askPersist();
    render();
    Store.fillMissingPhotoLocations();
    Store.purgeOldTrash();
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
