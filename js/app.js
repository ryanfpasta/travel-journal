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

  // Each trip has its own colour. [light primary, light tonal, light on-tonal, dark primary, dark on-primary, dark tonal, dark on-tonal]
  var SCHEMES = {
    red: ["Classic Red", "#b3261e", "#f9dedc", "#410e0b", "#ffb4ab", "#561e19", "#73332d", "#ffdad6"],
    blue: ["Ocean Blue", "#00639b", "#cde5ff", "#001d32", "#94ccff", "#003352", "#004a77", "#cde5ff"],
    green: ["Forest Green", "#2e6b30", "#b1f1a9", "#002204", "#96d58f", "#003909", "#11521b", "#b1f1a9"],
    teal: ["Lagoon Teal", "#006a64", "#9ef2e9", "#00201e", "#82d5cd", "#003734", "#00504b", "#9ef2e9"],
    orange: ["Sunset Orange", "#9a4600", "#ffdbc8", "#321200", "#ffb68b", "#532200", "#763300", "#ffdbc8"],
    plum: ["Plum", "#7b4e7f", "#ffd6fd", "#30083a", "#ecb4ee", "#48204f", "#612f67", "#ffd6fd"],
    charcoal: ["Charcoal", "#3f4a54", "#dbe4ee", "#121d26", "#bfc8d2", "#29323b", "#3f4a54", "#dbe4ee"],
  };
  function scheme() { var t = Store.trip(); return SCHEMES[(t && t.scheme) || "red"] || SCHEMES.red; }
  function applyScheme() {
    var c = scheme(), el = $("#schemeStyle");
    if (!el) { el = document.createElement("style"); el.id = "schemeStyle"; document.head.appendChild(el); }
    el.textContent = ":root{--primary:" + c[1] + ";--tonal:" + c[2] + ";--on-tonal:" + c[3] + "}" +
      "@media (prefers-color-scheme: dark){:root{--primary:" + c[4] + ";--on-primary:" + c[5] + ";--tonal:" + c[6] + ";--on-tonal:" + c[7] + "}}";
    var meta = $('meta[name="theme-color"]'); if (meta) meta.content = c[1];
  }
  function mapColour() { return scheme()[1]; }
  function tripName() { var t = Store.trip(); return t ? t.name : "My trip"; }
  function tripPill() {
    return '<button class="trip-pill" data-trips>' + esc(tripName()) + ' <span>▾</span></button>';
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
      return '<button class="row' + (t.id === cur.id ? " current" : "") + '" data-id="' + t.id + '"><div><b>' + (t.id === cur.id ? "✓ " : "") + esc(t.name) + "</b>" +
        '<div class="muted small">' + esc([tripDates(t), plural(n.photos, "photo")].filter(Boolean).join(" · ")) + '</div></div><span class="swatch" style="background:' + (SCHEMES[t.scheme] || SCHEMES.red)[1] + '"></span></button>';
    }).join("") + "</div>";
    var sh = sheet(html, [{ label: "Close" }, { label: "＋ New trip", cls: "primary", onClick: newTripSheet }]);
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
      return '<button class="scheme' + (k === cur ? " on" : "") + '" data-scheme="' + k + '" style="--c:' + SCHEMES[k][1] + '" aria-label="' + SCHEMES[k][0] + '"><span></span>' + SCHEMES[k][0] + "</button>";
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
      function flush() {
        var p = pendingSaves.get(input); if (!p) return;
        clearTimeout(p); pendingSaves.delete(input);
        var c = {}; c[key] = input.value; save(c);
      }
      input.addEventListener("input", function () {
        clearTimeout(pendingSaves.get(input));
        pendingSaves.set(input, setTimeout(flush, 500));
        input._flush = flush;
      });
      input.addEventListener("blur", flush);
      input._flush = flush;
    });
  }
  function flushAll() { $$("[data-autosave]").forEach(function (i) { if (i._flush) i._flush(); }); }

  function hydrateThumbs(root) {
    $$("img[data-photo]", root).forEach(function (img) {
      var p = S.photos.get(img.dataset.photo);
      if (p) Photos.thumbUrl(p).then(function (u) { if (u) img.src = u; });
    });
  }
  function thumbGrid(photos, cls) {
    if (!photos.length) return "";
    return '<div class="' + (cls || "grid") + '">' + photos.map(function (p) {
      var vid = Photos.isVideo(p) ? '<span class="vbadge">▶' + (p.durationMs ? " " + Math.floor(p.durationMs / 60000) + ":" + String(Math.round(p.durationMs / 1000) % 60).padStart(2, "0") : "") + "</span>" : "";
      var badge = vid + (p.locStatus === "APPROX" ? '<span class="badge">≈</span>' : p.locStatus === "NONE" ? '<span class="badge">?</span>' : "");
      return '<a href="#/photo/' + p.id + '" class="thumb"><img data-photo="' + p.id + '" alt="">' + badge + "</a>";
    }).join("") + "</div>";
  }

  function placeName(id) { var p = id && S.places.get(id); return p ? p.name : ""; }
  function placeRow(p) {
    var n = Store.placePhotos(p.id).length;
    return '<a class="row" href="#/place/' + p.id + '"><div><b>' + esc(p.name) + "</b>" +
      (p.city ? '<div class="muted">' + esc(p.city) + "</div>" : "") + '</div><div class="right">' +
      starText(p.rating) + " " + moodText(p.mood) + (n ? ' <span class="muted">' + n + " 📷</span>" : "") + "</div></a>";
  }
  function entryRow(e) {
    var icon = e.kind === "MEAL" ? "🍜" : e.kind === "EXPERIENCE" ? "⭐" : "📝";
    var title = e.title || (e.note ? e.note.slice(0, 60) : KINDS[e.kind] || "Note");
    return '<a class="row" href="#/entry/' + e.id + '"><div><b>' + icon + " " + esc(title) + "</b>" +
      (e.placeId ? '<div class="muted">' + esc(placeName(e.placeId)) + "</div>" : "") +
      '</div><div class="right">' + starText(e.rating) + " " + moodText(e.mood) + "</div></a>";
  }

  /** Lets the person choose a place. onPick(placeOrNull). Nearest to `near` first, else most recent. */
  function pickPlace(near, onPick, allowNone) {
    var list = Store.values(S.places);
    if (near && near.lat != null) list.sort(function (a, b) { return Store.distanceM(a.lat, a.lon, near.lat, near.lon) - Store.distanceM(b.lat, b.lon, near.lat, near.lon); });
    else list.sort(function (a, b) { return b.createdAtUtc - a.createdAtUtc; });
    var html = "<h3>Choose a place</h3>" + (list.length ? "" : '<p class="muted">No places yet. Tap Sync on the Today tab to start one.</p>') +
      '<div class="pick-list">' + (allowNone ? '<button class="row" data-id="">No place</button>' : "") +
      list.map(function (p) {
        var d = near && near.lat != null ? Store.distanceM(p.lat, p.lon, near.lat, near.lon) : null;
        return '<button class="row" data-id="' + p.id + '"><div><b>' + esc(p.name) + "</b>" + (p.city ? '<div class="muted">' + esc(p.city) + "</div>" : "") +
          "</div>" + (d != null ? '<div class="muted right">' + (d < 1000 ? Math.round(d) + " m" : (d / 1000).toFixed(1) + " km") + "</div>" : "") + "</button>";
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

  function cameraHelp() {
    sheet("<h3>Camera shows a black screen?</h3>" +
      "<p>The journal uses the iPhone's own camera. A black screen usually means iOS has blocked the camera for websites:</p>" +
      "<ol><li>Open <b>Settings → Apps → Safari → Camera</b> (older iPhones: <b>Settings → Safari → Camera</b>) and choose <b>Allow</b> or <b>Ask</b>.</li>" +
      "<li>If that's already on, check <b>Settings → Screen Time → Content &amp; Privacy Restrictions → Allowed Apps</b> and make sure <b>Camera</b> is on.</li>" +
      "<li>Swipe the journal away in the app switcher, open it again from the Home Screen icon, and try again.</li></ol>" +
      "<p><b>Always works:</b> take the picture with the normal Camera app, then tap <b>Add from library</b> here. The photo keeps its time and location.</p>");
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
        return sheet("<h3>Location is off</h3><p>Open the iPhone <b>Settings → Privacy &amp; Security → Location Services → Safari Websites</b> and choose <b>While Using the App</b>, then try again.</p>");
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
    if (!isInstalled()) banners += '<div class="card warn"><b>Add this to your Home Screen first.</b> In Safari tap <b>Share</b> <span class="ios-share"></span> then <b>Add to Home Screen</b>, and open it from there. Otherwise Safari may clear the journal after a week of not using it.</div>';
    if (storageLevel === "CRITICAL") banners += '<div class="card warn"><b>The phone is almost full.</b> New photos are paused until you free some space.</div>';
    else if (storageLevel === "LOW") banners += '<div class="card warn">Under 1 GB left for the journal. Consider a backup and freeing space.</div>';
    var nPhotos = Store.values(Store.ALL.photos).length;
    var tc = Store.tripCounts(t.id);
    if (Store.trips().length === 1 && !t.startDate && t.name === "My trip" && !tc.photos && !tc.places && !tc.entries)
      banners += '<a class="card" href="#/more">👋 <b>Welcome!</b> Tap here to name your trip, set its dates and pick a colour.</a>';
    else if (t.startDate && date < t.startDate) banners += '<div class="card">✈️ ' + esc(t.name) + " starts in " + plural(Math.round((Store.dateObj(t.startDate) - Store.dateObj(date)) / 864e5), "day") + ". Anything you add now still goes into this trip.</div>";
    else if (t.endDate && date > t.endDate) banners += '<div class="card warn">' + esc(t.name) + ' ended on ' + Store.shortDay(t.endDate) + '. Starting somewhere new? <a href="#" data-newtrip>Start a new trip</a> so today doesn\'t land in this one.</div>';
    if (nPhotos && Date.now() - (Store.settings.lastBackupUtc || 0) > 3 * 864e5) banners += '<a class="card" href="#/more">💾 No backup in the last 3 days. Tap to back up.</a>';
    var cur = Store.currentPlaceId();
    return '<div class="page">' +
      tripPill() +
      "<h1>" + Store.prettyDay(date) + "</h1>" + (dayN ? '<div class="muted">Day ' + dayN + " of the trip</div>" : "") +
      banners +
      '<div class="btnrow"><button class="btn primary big" id="takePhoto">📷 Take photo</button><button class="btn tonal big" id="takeVideo">🎥 Video</button></div>' +
      '<button class="btn tonal wide" id="import">🖼️ Add photos or videos from library</button>' +
      '<div class="center small"><a href="#" id="camHelp">Camera black or not opening?</a></div>' +
      '<button class="btn outline wide" id="sync">📍 Sync now: I\'m somewhere new</button>' +
      (cur ? '<div class="muted small center">You\'re at <a href="#/place/' + cur + '">' + esc(placeName(cur)) + "</a></div>" : "") +
      '<h2>Today</h2><div class="card">' +
      '<div class="field"><label>Mood</label>' + moodPicker("mood", log.mood) + "</div>" +
      '<div class="field"><label>Rating</label>' + stars("rating", log.rating) + "</div>" +
      '<textarea data-autosave="note" placeholder="How was today?" rows="3">' + esc(log.note || "") + "</textarea></div>" +
      '<div class="btnrow three"><button class="btn tonal" data-new="MEAL">🍜 Meal</button><button class="btn tonal" data-new="EXPERIENCE">⭐ Experience</button><button class="btn tonal" data-new="NOTE">📝 Note</button></div>' +
      (d.entries.length ? "<h2>Logged today</h2>" + d.entries.map(entryRow).join("") : "") +
      (d.places.length ? "<h2>Places today</h2>" + d.places.map(placeRow).join("") : "") +
      (d.photos.length ? "<h2>" + plural(d.photos.length, "photo") + "</h2>" + thumbGrid(d.photos.slice().reverse()) : "") +
      "</div>";
  }
  function bindToday(root) {
    var date = Store.today();
    $("#takePhoto", root).onclick = function () { takePhoto(null, null); };
    $("#takeVideo", root).onclick = function () { takeVideo(null, null); };
    $("#camHelp", root).onclick = function (e) { e.preventDefault(); cameraHelp(); };
    $("#import", root).onclick = function () { importPhotos(null, null); };
    $("#sync", root).onclick = function () { syncNow(this); };
    bindPickers(root, function () { return S.dayLogs.get(date) || {}; }, function (c) { Store.saveDayLog(date, c); });
    bindAutosave(root, function (c) { Store.saveDayLog(date, c); });
    $$("[data-new]", root).forEach(function (b) {
      b.onclick = async function () { var e = await Store.newEntry(b.dataset.new, date, Store.currentPlaceId()); go("#/entry/" + e.id); };
    });
  }

  function dayCard(date) {
    var d = Store.day(date), log = d.log || {};
    var bits = [d.photos.length ? plural(d.photos.length, "photo") : null, d.places.length ? plural(d.places.length, "place") : null, d.entries.length ? plural(d.entries.length, "entry").replace("entrys", "entries") : null].filter(Boolean).join(" · ");
    return '<a class="card day" href="#/day/' + date + '"><div class="dayhead"><b>' + Store.prettyDay(date) + "</b><span>" + starText(log.rating) + " " + moodText(log.mood) + "</span></div>" +
      (d.cities.length ? '<div class="muted">' + esc(d.cities.join(", ")) + "</div>" : d.places.length ? '<div class="muted">' + esc(d.places.slice(0, 3).map(function (p) { return p.name; }).join(", ")) + "</div>" : "") +
      (log.note ? '<div class="note">' + esc(log.note.length > 140 ? log.note.slice(0, 140) + "…" : log.note) + "</div>" : "") +
      thumbGrid(d.photos.slice(0, 6), "strip") + '<div class="muted small">' + bits + "</div></a>";
  }

  function viewTimeline() {
    var dates = Store.allDates();
    return '<div class="page">' + tripPill() + '<h1>Timeline</h1>' + (dates.length ? dates.map(dayCard).join("") :
      '<p class="muted">Nothing yet. Take a photo or tap Sync on the Today tab and your days will show up here.</p>') + "</div>";
  }

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
      cells += (has ? '<a href="#/day/' + ds + '"' : "<div") + ' class="cal-day' + (has ? " has" : "") + (inTrip ? " trip" : "") + (ds === today ? " today" : "") + '"><span>' + dn + "</span>" +
        (log && log.mood ? '<i>' + MOODS[log.mood - 1] + "</i>" : has ? "<i>•</i>" : "") + (has ? "</a>" : "</div>");
    }
    var label = first.toLocaleDateString("en", { month: "long", year: "numeric" });
    return '<div class="page">' + tripPill() + '<div class="calhead"><button class="btn icon" id="prevM">‹</button><h1>' + label + '</h1><button class="btn icon" id="nextM">›</button></div>' +
      '<div class="cal"><b>M</b><b>T</b><b>W</b><b>T</b><b>F</b><b>S</b><b>S</b>' + cells + "</div></div>";
  }
  function bindCalendar(root) {
    $("#prevM", root).onclick = function () { calMonth.m--; if (calMonth.m < 0) { calMonth.m = 11; calMonth.y--; } render(); };
    $("#nextM", root).onclick = function () { calMonth.m++; if (calMonth.m > 11) { calMonth.m = 0; calMonth.y++; } render(); };
  }

  function viewDay(date) {
    var d = Store.day(date), log = d.log || {};
    return '<div class="page"><a class="back" href="#/timeline">‹ Timeline</a><h1>' + Store.prettyDay(date) + "</h1>" +
      (d.cities.length ? '<div class="muted">' + esc(d.cities.join(", ")) + "</div>" : "") +
      '<div class="card"><div class="field"><label>Mood</label>' + moodPicker("mood", log.mood) + "</div>" +
      '<div class="field"><label>Rating</label>' + stars("rating", log.rating) + "</div>" +
      '<textarea data-autosave="note" placeholder="Notes about this day" rows="4">' + esc(log.note || "") + "</textarea></div>" +
      '<div class="btnrow three"><button class="btn tonal" data-new="MEAL">🍜 Meal</button><button class="btn tonal" data-new="EXPERIENCE">⭐ Experience</button><button class="btn tonal" data-new="NOTE">📝 Note</button></div>' +
      '<div class="btnrow"><button class="btn outline" id="addPh">🖼️ Add photos to this day</button><a class="btn outline" href="#/map/' + date + '">🗺️ Show on map</a></div>' +
      (d.entries.length ? "<h2>Logged</h2>" + d.entries.map(entryRow).join("") : "") +
      (d.places.length ? "<h2>Places</h2>" + d.places.map(placeRow).join("") : "") +
      (d.photos.length ? "<h2>" + plural(d.photos.length, "photo") + "</h2>" + thumbGrid(d.photos) : "") +
      (d.points.length ? '<p class="muted small">' + plural(d.points.length, "location reading") + " logged.</p>" : "") + "</div>";
  }
  function bindDay(root, date) {
    bindPickers(root, function () { return S.dayLogs.get(date) || {}; }, function (c) { Store.saveDayLog(date, c); });
    bindAutosave(root, function (c) { Store.saveDayLog(date, c); });
    $("#addPh", root).onclick = function () { importPhotos(date, null); };
    $$("[data-new]", root).forEach(function (b) {
      b.onclick = async function () { var e = await Store.newEntry(b.dataset.new, date, null); go("#/entry/" + e.id); };
    });
  }

  function viewPlace(id) {
    var p = S.places.get(id);
    if (!p) return '<div class="page"><a class="back" href="#/map">‹ Back</a><p>This place no longer exists (it may have been merged).</p></div>';
    var photos = Store.placePhotos(id), entries = Store.placeEntries(id);
    var maps = "https://maps.apple.com/?ll=" + p.lat + "," + p.lon + "&q=" + encodeURIComponent(p.name);
    return '<div class="page"><a class="back" href="javascript:history.back()">‹ Back</a>' +
      '<input class="title-input" data-autosave="name" value="' + esc(p.name) + '" placeholder="Name this place">' +
      '<input data-autosave="city" value="' + esc(p.city) + '" placeholder="City">' +
      '<div class="card"><div class="field"><label>Mood</label>' + moodPicker("mood", p.mood) + "</div>" +
      '<div class="field"><label>Rating</label>' + stars("rating", p.rating) + "</div>" +
      '<textarea data-autosave="note" placeholder="What was it like?" rows="4">' + esc(p.note) + "</textarea></div>" +
      '<div class="btnrow"><button class="btn tonal" id="phHere">📷 Photo here</button><button class="btn outline" id="merge">Merge into…</button></div>' +
      (entries.length ? "<h2>Logged here</h2>" + entries.map(entryRow).join("") : "") +
      (photos.length ? "<h2>" + plural(photos.length, "photo") + "</h2>" + thumbGrid(photos) : "") +
      '<p class="muted small">First visited ' + Store.prettyDay(p.firstLocalDate) + ' · <a href="' + maps + '" target="_blank" rel="noopener">' + p.lat.toFixed(5) + ", " + p.lon.toFixed(5) + "</a></p>" +
      (!photos.length && !entries.length ? '<button class="btn danger-text" id="delPlace">Delete this place</button>' : "") + "</div>";
  }
  function bindPlace(root, id) {
    if (!S.places.get(id)) return;
    bindPickers(root, function () { return S.places.get(id) || {}; }, function (c) { Store.updatePlace(id, c); });
    bindAutosave(root, function (c) { Store.updatePlace(id, c); });
    $("#phHere", root).onclick = function () { takePhoto(null, id); };
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
    if (!e) return '<div class="page"><a class="back" href="#/today">‹ Back</a><p>This entry was deleted.</p></div>';
    return '<div class="page"><a class="back" href="javascript:history.back()">‹ Back</a>' +
      '<div class="chips">' + Object.keys(KINDS).map(function (k) { return '<button class="chip' + (e.kind === k ? " on" : "") + '" data-kind="' + k + '">' + KINDS[k] + "</button>"; }).join("") + "</div>" +
      '<input class="title-input" data-autosave="title" value="' + esc(e.title) + '" placeholder="' + (e.kind === "MEAL" ? "What did you eat?" : e.kind === "EXPERIENCE" ? "What did you do?" : "Title") + '">' +
      '<div class="card"><div class="field"><label>Mood</label>' + moodPicker("mood", e.mood) + "</div>" +
      '<div class="field"><label>Rating</label>' + stars("rating", e.rating) + "</div>" +
      '<textarea data-autosave="note" placeholder="Notes" rows="5">' + esc(e.note) + "</textarea></div>" +
      '<button class="row" id="entryPlace"><div><div class="muted small">Place</div><b>' + esc(placeName(e.placeId) || "No place") + '</b></div><div class="right muted">Change ›</div></button>' +
      '<p class="muted small">' + Store.prettyDay(e.localDate) + " · " + Store.clock(e.createdAtUtc, e.tzId) + "</p>" +
      '<button class="btn danger-text" id="delEntry">Delete</button></div>';
  }
  function bindEntry(root, id) {
    if (!S.entries.get(id)) return;
    bindPickers(root, function () { return S.entries.get(id) || {}; }, function (c) { Store.updateEntry(id, c); });
    bindAutosave(root, function (c) { Store.updateEntry(id, c); });
    $$("[data-kind]", root).forEach(function (b) {
      b.onclick = function () { Store.updateEntry(id, { kind: b.dataset.kind }); $$("[data-kind]", root).forEach(function (x) { x.classList.toggle("on", x === b); }); };
    });
    $("#entryPlace", root).onclick = function () {
      var e = S.entries.get(id), near = e.placeId ? S.places.get(e.placeId) : Store.recentGoodFix(3600e3, 2000);
      pickPlace(near, function (p) { Store.updateEntry(id, { placeId: p ? p.id : null }).then(render); }, true);
    };
    $("#delEntry", root).onclick = function () { confirmSheet("Delete this entry?", "Delete", async function () { await Store.deleteEntry(id); history.back(); }); };
  }

  var fullUrl = null;
  function viewPhoto(id) {
    var p = S.photos.get(id);
    if (!p) return '<div class="page"><a class="back" href="#/today">‹ Back</a><p>This photo was deleted.</p></div>';
    var loc = { GPS: "Location from GPS" + (p.accuracyM ? " (±" + Math.round(p.accuracyM) + " m)" : ""), APPROX: "Approximate location, borrowed from a nearby reading", MANUAL: "Place set by hand", NONE: "No location", WAITING: "Finding location…" }[p.locStatus] || "";
    return '<div class="page photo-page"><a class="back" href="javascript:history.back()">‹ Back</a>' +
      (Photos.isVideo(p) ? '<div class="photo-full"><video id="fullVid" controls playsinline preload="metadata"></video></div>' : '<div class="photo-full"><img id="fullImg" alt=""></div>') +
      '<textarea data-autosave="caption" placeholder="Add a caption" rows="2">' + esc(p.caption) + "</textarea>" +
      '<button class="row" id="photoPlace"><div><div class="muted small">Place</div><b>' + esc(placeName(p.placeId) || "No place") + '</b></div><div class="right muted">Change ›</div></button>' +
      '<p class="muted small"><a href="#/day/' + p.localDate + '">' + Store.prettyDay(p.localDate) + "</a> · " + Store.clock(p.takenAtUtc, p.tzId) + " · " + esc(loc) + "</p>" +
      '<div class="btnrow"><button class="btn outline" id="sharePh">Share / Save</button><button class="btn danger-text" id="delPh">Delete</button></div></div>';
  }
  function bindPhoto(root, id) {
    var p = S.photos.get(id); if (!p) return;
    Store.getBlob("full:" + p.fileName).then(function (b) {
      if (!b) return;
      if (fullUrl) URL.revokeObjectURL(fullUrl);
      fullUrl = URL.createObjectURL(b);
      var img = $("#fullImg") || $("#fullVid"); if (img) img.src = fullUrl;
    });
    bindAutosave(root, function (c) { Store.updatePhoto(id, c); });
    $("#photoPlace", root).onclick = function () {
      var cur = S.photos.get(id);
      pickPlace(cur.lat != null ? cur : null, function (place) {
        var change = place ? { placeId: place.id, placeLocked: true, lat: cur.lat != null ? cur.lat : place.lat, lon: cur.lon != null ? cur.lon : place.lon, locStatus: cur.lat != null ? cur.locStatus : "MANUAL" }
          : { placeId: null, placeLocked: false };
        Store.updatePhoto(id, change).then(render);
      }, true);
    };
    $("#sharePh", root).onclick = async function () {
      var b = await Store.getBlob("full:" + S.photos.get(id).fileName);
      var ext = p.fileName.split(".").pop();
      saveFile(b, safeName(tripName()) + "-" + p.localDate + "." + ext, Photos.mimeOf(p.fileName));
    };
    $("#delPh", root).onclick = function () { confirmSheet((Photos.isVideo(p) ? "Delete this video from the journal?" : "Delete this photo from the journal?"), "Delete", async function () { await Store.deletePhoto(id); history.back(); }); };
  }

  // ---- Map ----

  var map = null, mapLayers = null, tiles = null;
  function viewMap(date) {
    return '<div class="mapview"><div id="map"></div><div class="map-top">' +
      (date ? '<a class="pill" href="#/map">' + Store.shortDay(date) + " ✕</a>" : '<button class="pill" data-trips>' + esc(tripName()) + " ▾</button>") +
      '<label class="pill"><input type="checkbox" id="tilesBox"' + (Store.settings.streetMap !== false ? " checked" : "") + "> Street map</label></div>" +
      '<button class="pill map-save" id="saveArea">⬇️ Save this area for offline</button></div>';
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

  function viewMore() {
    var st = Store.settings, trip = Store.trip();
    var lastB = st.lastBackupUtc ? Store.prettyDay(Store.localDate(st.lastBackupUtc)) + " " + Store.clock(st.lastBackupUtc, Store.zone()) : "never";
    return '<div class="page"><h1>More</h1>' +
      "<h2>Trip in use</h2>" +
      '<div class="card"><label class="lbl">Name</label><input data-tripsave="name" value="' + esc(trip.name) + '">' +
      '<div class="two"><div><label class="lbl">First day</label><input type="date" data-tripdate="startDate" value="' + esc(trip.startDate) + '"></div>' +
      '<div><label class="lbl">Last day</label><input type="date" data-tripdate="endDate" value="' + esc(trip.endDate) + '"></div></div>' +
      '<label class="lbl">Colour</label>' + schemePicker(trip.scheme || "red") +
      '<div class="btnrow"><button class="btn tonal" data-trips>Switch trip</button><button class="btn outline" data-newtrip>＋ New trip</button></div></div>' +
      "<h2>Photos</h2>" +
      '<div class="card"><button class="btn tonal wide" id="saveAll">Save all ' + plural(Store.values(S.photos).length, "photo") + ' to the Photos app</button>' +
      '<p class="muted small">Photos taken in the journal stay in the journal. This copies this trip\'s photos and videos into the iPhone\'s Photos app, a batch at a time.</p></div>' +
      "<h2>Keep it safe</h2>" +
      '<div class="card"><p>Last backup: <b>' + lastB + "</b></p>" +
      '<button class="btn primary wide" id="backup">💾 Back up now</button>' +
      '<p class="muted small">Makes one zip with everything and every photo. Save it to Files or iCloud Drive, or AirDrop it to a computer. It holds every trip.</p>' +
      '<button class="btn outline wide" id="restore">Restore from a backup</button>' +
      '<p class="muted small">Restoring merges: it brings back anything missing and never removes what you added since.</p></div>' +
      "<h2>Memory box</h2>" +
      '<div class="card"><button class="btn tonal wide" id="export">🎁 Export memory box</button>' +
      '<p class="muted small">For the trip in use. A zip to open on a laptop: unzip it and double-click <b>memory-box/index.html</b>. Route map, day-by-day timeline, galleries per place, and “Play the trip”. Works without internet.</p></div>' +
      "<h2>Location</h2>" +
      '<div class="card"><label class="switch"><input type="checkbox" id="checkOpen"' + (st.checkWhileOpen ? " checked" : "") + "> Log a reading every " + st.intervalMinutes + " minutes while the app is open</label>" +
      '<p class="muted small">iPhone web apps can\'t check location in the background, so the journal logs a location with every photo, when you tap Sync, and (with this on) whenever you open the app after a while.</p></div>' +
      "<h2>Storage</h2>" +
      '<div class="card" id="storageCard"><p class="muted">Checking…</p></div>' +
      (Store.trips().length > 1 ? '<button class="btn danger-text" id="delTrip">Delete this trip…</button>' : "") +
      '<p class="muted small center">Travel Journal · v' + APP_VERSION + "</p></div>";
  }
  function bindMore(root) {
    var trip = Store.trip();
    $$("[data-tripsave]", root).forEach(function (i) { i.setAttribute("data-autosave", i.dataset.tripsave); });
    bindAutosave(root, function (c) { if (c.name !== undefined && !c.name.trim()) return; Store.updateTrip(trip.id, c); });
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
    $("#saveAll", root).onclick = saveAllToPhotos;
    var del = $("#delTrip", root);
    if (del) del.onclick = function () {
      var n = Store.tripCounts(trip.id);
      confirmSheet("Delete “" + trip.name + "” and everything in it (" + plural(n.photos, "photo") + ", " + plural(n.places, "place") + ", " + plural(n.entries, "entry").replace("entrys", "entries") + ")? This can't be undone. Make a backup first if you might want it back.", "Delete trip", async function () {
        await Store.deleteTrip(trip.id); calMonth = null; applyScheme(); go("#/today"); toast("Trip deleted.");
      });
    };
    $("#checkOpen", root).onchange = function () { Store.saveSettings({ checkWhileOpen: this.checked }); };
    $("#backup", root).onclick = doBackup;
    $("#restore", root).onclick = function () { $("#restoreInput").value = ""; $("#restoreInput").click(); };
    $("#export", root).onclick = doExport;
    Promise.all([checkStorage(), navigator.storage && navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false)]).then(function (r) {
      var card = $("#storageCard"); if (!card) return;
      var est = r[0], persisted = r[1];
      card.innerHTML = (est ? "<p>Journal uses <b>" + mb(est.usage) + "</b>, about <b>" + mb(est.free) + "</b> available.</p>" : "") +
        "<p>" + Store.values(S.photos).length + " photos · " + S.places.size + " places · " + S.points.size + " location readings</p>" +
        "<p>" + (persisted ? "✅ Protected storage is on." : "⚠️ Protected storage is off. " + (isInstalled() ? "" : "Add the app to your Home Screen, then ") + '<a href="#" id="persistBtn">turn it on</a>.') + "</p>" +
        (isInstalled() ? "" : '<p class="warn-text">Not on the Home Screen yet. Open it from the Home Screen icon so Safari doesn\'t clear it.</p>');
      var pb = $("#persistBtn");
      if (pb) pb.onclick = async function (e) { e.preventDefault(); var ok = await askPersist(); toast(ok ? "Storage protected." : "iPhone said no. Adding the app to the Home Screen usually fixes this."); render(); };
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
    "lib/images/layers.png", "lib/images/layers-2x.png", "lib/images/marker-icon.png", "lib/images/marker-icon-2x.png", "lib/images/marker-shadow.png"];

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
      var data = {
        title: tripName(),
        exportedAt: Store.prettyDay(Store.today()),
        days: dates.map(function (d) {
          var day = Store.day(d), log = day.log || {};
          return { date: d, label: Store.prettyDay(d), mood: log.mood || null, rating: log.rating || null, note: log.note || "", cities: day.cities, placeIds: day.places.map(function (x) { return x.id; }) };
        }),
        places: Store.values(S.places).map(function (p) { return { id: p.id, name: p.name, city: p.city, lat: p.lat, lon: p.lon, rating: p.rating, mood: p.mood, note: p.note, firstDate: p.firstLocalDate }; }),
        photos: have.map(function (p) {
          return { id: p.id, src: "photos/" + p.fileName, thumb: "thumbs/" + p.fileName.replace(/\.[^.]+$/, "") + ".jpg", date: p.localDate, time: Store.clock(p.takenAtUtc, p.tzId),
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

  function render() {
    flushAll();
    var r = parse(), key = r.name + "/" + r.arg, sameRoute = key === currentRoute;
    var scroll = sameRoute ? window.scrollY : 0;
    if (map) { try { map.remove(); } catch (e) { console.warn(e); } map = null; }
    if (r.name !== "photo" && fullUrl) { URL.revokeObjectURL(fullUrl); fullUrl = null; }
    var V = {
      today: [viewToday, bindToday], timeline: [viewTimeline], calendar: [viewCalendar, bindCalendar], map: [viewMap, bindMap],
      more: [viewMore, bindMore], day: [viewDay, bindDay], place: [viewPlace, bindPlace], entry: [viewEntry, bindEntry], photo: [viewPhoto, bindPhoto],
    }[r.name] || [viewToday, bindToday];
    // Leaving an entry that was never filled in removes it, so stray taps don't leave blank rows.
    if (!sameRoute && currentRoute && currentRoute.indexOf("entry/") === 0) {
      var old = S.entries.get(currentRoute.slice(6));
      if (old && !old.title && !old.note && !old.rating && !old.mood) Store.deleteEntry(old.id);
    }
    currentRoute = key;
    view.innerHTML = V[0](r.arg);
    if (V[1]) V[1](view, r.arg);
    hydrateThumbs(view);
    $$("[data-trips]", view).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); tripSheet(); }; });
    $$("[data-newtrip]", view).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); newTripSheet(); }; });
    var tab = { day: "timeline", place: "map", entry: "today", photo: "timeline" }[r.name] || r.name;
    $$("#tabs a").forEach(function (a) { a.classList.toggle("on", a.dataset.tab === tab); });
    document.body.classList.toggle("map-mode", r.name === "map");
    window.scrollTo(0, scroll);
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
    window.addEventListener("hashchange", function () { $("#sheet").hidden = true; render(); });
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", function () { if (document.hidden) flushAll(); else { maybeCheck(); checkStorage(); } });
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
