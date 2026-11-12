(function () {
  "use strict";
  // Everything comes from data.js, loaded by a plain <script> tag, so the page works when opened
  // straight from the folder (file://) with no web server. All paths are relative.
  var T = window.TRIP;
  // The iPhone app exports a simpler data file than the Android app; fill in what it leaves out so one page serves both.
  (function normalise() {
    T.days = T.days || []; T.places = T.places || []; T.photos = T.photos || []; T.entries = T.entries || []; T.route = T.route || [];
    var dates = T.days.map(function (d) { return d.date; }).sort();
    T.startDate = T.startDate || dates[0] || T.exportedAt; T.endDate = T.endDate || dates[dates.length - 1] || T.startDate;
    T.tiles = T.tiles || { list: [] }; T.tiles.list = T.tiles.list || [];
    T.stopIcons = T.stopIcons || { FOOD: "🍜", TEMPLE: "🛕", SIGHT: "🏛️", HIKE: "🥾", TRAIN: "🚄", HOTEL: "🏨", OTHER: "📍" };
    T.stopLabels = T.stopLabels || { FOOD: "Food", TEMPLE: "Temple", SIGHT: "Sight", HIKE: "Walk or hike", TRAIN: "Train or flight", HOTEL: "Hotel", OTHER: "Place" };
    var autoRegions = !T.regionColors; T.regionColors = T.regionColors || {};
    var PASTELS = ["#fde2e0", "#fdecc8", "#dff1e1", "#d8eef0", "#e6e1f5", "#fbe0ef", "#e3ecd2", "#f6e3d3"], k = 0;
    T.days.forEach(function (d) {
      d.cities = d.cities || []; d.placeIds = d.placeIds || []; d.planned = d.planned || [];
      if (d.region == null) d.region = d.cities[0] || "";
      if (autoRegions && d.region && !T.regionColors[d.region]) T.regionColors[d.region] = PASTELS[k++ % PASTELS.length];
    });
    T.photos.forEach(function (m) { if (!m.type) m.type = "photo"; });
  })();
  var MOODS = ["", "😞", "😕", "😐", "🙂", "😄"];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // Material Symbols Rounded paths (Apache 2.0), the same glyphs as the apps. Emoji stay for moods and pin kinds only.
  var ICONS = {"fit": "m592-127-243-86-188 75q-8 3-15 1.5t-13-5.5q-6-4-9.5-10t-3.5-14v-565q0-13 7.5-23t19.5-15l182-64q5-2 10-2.5t10-.5q5 0 10 .5t10 2.5l243 85 187-75q8-3 15-2t13 5q6 4 9.5 10.5T840-795v572q0 11-7.5 19T814-192l-182 65q-5 2-10 2.5t-10 .5q-5 0-10-.5t-10-2.5Zm-14-68v-505l-196-66v505l196 66Zm60 0 142-47v-512l-142 54v505Zm-458-12 142-54v-505l-142 47v512Zm458-493v505-505Zm-316-66v505-505Z", "collage": "m506-413-56-72q-5-6-12-5.5t-12 6.5l-63 83q-5 8-1.1 16 3.89 8 13.1 8h331q9.21 0 13.1-8 3.9-8-1.1-16l-97-131q-5-6-12-6t-12 6l-91 119ZM260-200q-24 0-42-18t-18-42v-560q0-24 18-42t42-18h560q24 0 42 18t18 42v560q0 24-18 42t-42 18H260Zm0-60h560v-560H260v560ZM140-80q-24 0-42-18t-18-42v-590q0-12.75 8.68-21.38 8.67-8.62 21.5-8.62 12.82 0 21.32 8.62 8.5 8.63 8.5 21.38v590h590q12.75 0 21.38 8.68 8.62 8.67 8.62 21.5 0 12.82-8.62 21.32Q742.75-80 730-80H140Zm120-740v560-560Z", "camera": "M480-267q72 0 121-49t49-121q0-73-49-121.5T480-607q-73 0-121.5 48.5T310-437q0 72 48.5 121T480-267Zm0-60q-48 0-79-31.5T370-437q0-48 31-79t79-31q47 0 78.5 31t31.5 79q0 47-31.5 78.5T480-327ZM140-120q-24 0-42-18t-18-42v-513q0-23 18-41.5t42-18.5h147l55-66q8-11 20-16t26-5h184q14 0 26 5t20 16l55 66h147q23 0 41.5 18.5T880-693v513q0 24-18.5 42T820-120H140Z", "video": "M140-160q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h520q24 0 42 18t18 42v215l134-134q7-7 16.5-3.5T880-649v338q0 10-9.5 13.5T854-301L720-435v215q0 24-18 42t-42 18H140Z", "close": "M480-438 270-228q-9 9-21 9t-21-9q-9-9-9-21t9-21l210-210-210-210q-9-9-9-21t9-21q9-9 21-9t21 9l210 210 210-210q9-9 21-9t21 9q9 9 9 21t-9 21L522-480l210 210q9 9 9 21t-9 21q-9 9-21 9t-21-9L480-438Z", "prev": "m406-481 177 177q9 9 8.5 21t-9.5 21q-9 9-21.5 9t-21.5-9L341-460q-5-5-7-10t-2-11q0-6 2-11t7-10l199-199q9-9 21.5-9t21.5 9q9 9 9 21.5t-9 21.5L406-481Z", "nextArrow": "M530-481 353-658q-9-9-8.5-21t9.5-21q9-9 21.5-9t21.5 9l198 198q5 5 7 10t2 11q0 6-2 11t-7 10L396-261q-9 9-21 8.5t-21-9.5q-9-9-9-21.5t9-21.5l176-176Z", "play": "M320-258v-450q0-14 9-22t21-8q4 0 8 1t8 3l354 226q7 5 10.5 11t3.5 14q0 8-3.5 14T720-458L366-232q-4 2-8 3t-8 1q-12 0-21-8t-9-22Z", "star": "M480-269 294-157q-8 5-17 4.5t-16-5.5q-7-5-10.5-13t-1.5-18l49-212-164-143q-8-7-9.5-15.5t.5-16.5q2-8 9-13.5t17-6.5l217-19 84-200q4-9 12-13.5t16-4.5q8 0 16 4.5t12 13.5l84 200 217 19q10 1 17 6.5t9 13.5q2 8 .5 16.5T826-544L662-401l49 212q2 10-1.5 18T699-158q-7 5-16 5.5t-17-4.5L480-269Z", "pin": "M458.5-103.5Q448-107 440-115q-42-38-91-87.5T258-309q-42-57-70-119t-28-124q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 62-28 124t-70 119q-42 57-91 106.5T520-115q-8 8-18.5 11.5T480-100q-11 0-21.5-3.5Zm71-407Q550-531 550-560t-20.5-49.5Q509-630 480-630t-49.5 20.5Q410-589 410-560t20.5 49.5Q451-490 480-490t49.5-20.5Z", "check": "m378-332 363-363q9-9 21.5-9t21.5 9q9 9 9 21.5t-9 21.5L399-267q-9 9-21 9t-21-9L175-449q-9-9-8.5-21.5T176-492q9-9 21.5-9t21.5 9l159 160Z", "pause": "M600-200v-560h120v560H600Zm-360 0v-560h120v560H240Z", "stop": "M240-240v-480h480v480H240Z", "next": "M680-240v-480h80v480h-80Zm-480 0v-480l360 240-360 240Z"};
  function ico(name) { return ICONS[name] ? '<svg viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="' + ICONS[name] + '"/></svg>' : ""; }
  function iconSpan(name) { return '<span class="i">' + ico(name) + "</span>"; }
  document.querySelectorAll("[data-icon]").forEach(function (e) { e.innerHTML = ico(e.dataset.icon); });
  function stars(n) { return n ? '<span class="stars" aria-label="' + n + ' out of 5">' + "★".repeat(n) + '<span class="off">' + "★".repeat(5 - n) + "</span></span>" : ""; }
  // Region colours from the app are pastel; dots and the calendar's top bar use a clearer version of the same hue.
  function vivid(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return hex;
    var n = parseInt(m[1], 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, d = mx - mn;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = Math.round(h * 60); if (h < 0) h += 360;
    return "hsl(" + h + "," + (d ? 52 : 0) + "%," + (S && S.dark ? 66 : 56) + "%)";
  }
  function mood(n) { return n ? MOODS[n] : ""; }
  function dur(ms) { if (!ms) return ""; var s = Math.round(ms / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function parseDate(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function km(a, b) {
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function niceName(p) { return p ? (p.name.indexOf("New place") === 0 ? (p.city || "") : p.name) : ""; }
  function icon(stop) { return T.stopIcons[stop] || "📍"; }

  // The trip's colour scheme (Trip setup → Colour scheme). Older exports only had one colour.
  var S = T.scheme || { header: T.theme, accent: T.theme, route: T.theme, ring: T.theme };
  var css = document.documentElement.style;
  [["--theme", S.accent], ["--header", S.header], ["--ring", S.ring], ["--bg", S.page], ["--card", S.card], ["--ink", S.ink],
    ["--muted", S.muted], ["--line", S.line], ["--sea", S.sea]].forEach(function (v) { if (v[1]) css.setProperty(v[0], v[1]); });
  if (S.dark) document.documentElement.classList.add("dark");
  var ROUTE = S.route || T.theme || "#b3261e";

  // ---- Indexes ----
  var placesById = {}; T.places.forEach(function (p) { placesById[p.id] = p; });
  var dayByDate = {}; T.days.forEach(function (d, i) { d.index = i; dayByDate[d.date] = d; });
  var mediaByDate = {}, mediaByPlace = {};
  T.photos.forEach(function (m, i) {
    m.index = i;
    var place = placesById[m.placeId];
    m.plat = m.lat != null ? m.lat : place && place.lat;
    m.plon = m.lon != null ? m.lon : place && place.lon;
    (mediaByDate[m.date] = mediaByDate[m.date] || []).push(m);
    if (m.placeId) (mediaByPlace[m.placeId] = mediaByPlace[m.placeId] || []).push(m);
  });
  var routeByDate = {}; T.route.forEach(function (p) { (routeByDate[p.date] = routeByDate[p.date] || []).push(p); });
  var entriesByDate = {}; T.entries.forEach(function (e) { (entriesByDate[e.date] = entriesByDate[e.date] || []).push(e); });

  // ---- Header ----
  document.title = T.title + " · Memory Box";
  document.getElementById("title").textContent = T.title;
  if (T.edition) document.getElementById("eyebrow").textContent = "Memory box \u00b7 " + T.edition;
  var fmt = { weekday: "short", day: "numeric", month: "short", year: "numeric" };
  var s0 = parseDate(T.startDate), s1 = parseDate(T.endDate);
  var sameYear = s0.getFullYear() === s1.getFullYear(), sameMonth = sameYear && s0.getMonth() === s1.getMonth();
  function mon(d) { return d.toLocaleDateString(undefined, { month: "long" }); }
  var range = T.startDate === T.endDate ? s0.getDate() + " " + mon(s0) + " " + s0.getFullYear()
    : s0.getDate() + (sameMonth ? "" : " " + mon(s0)) + (sameYear ? "" : " " + s0.getFullYear()) + " – " + s1.getDate() + " " + mon(s1) + " " + s1.getFullYear();
  document.getElementById("dates").textContent = range + (T.travelers ? "  ·  " + T.travelers : "");
  var dist = 0; for (var i = 1; i < T.route.length; i++) dist += km(T.route[i - 1], T.route[i]);
  var nPhotos = T.photos.filter(function (m) { return m.type === "photo"; }).length, nVideos = T.photos.length - nPhotos;
  var cities = {}; T.places.forEach(function (p) { if (p.city) cities[p.city] = 1; });
  function n(k, one, many) { return k + " " + (k === 1 ? one : (many || one + "s")); }
  var nCities = Object.keys(cities).length;
  document.getElementById("stats").innerHTML = [
    [T.days.length, T.days.length === 1 ? "day" : "days"], nCities ? [nCities, nCities === 1 ? "city" : "cities"] : null,
    [nPhotos, nPhotos === 1 ? "photo" : "photos"], nVideos ? [nVideos, nVideos === 1 ? "clip" : "clips"] : null,
    dist ? [Math.round(dist).toLocaleString(), "km logged"] : null,
  ].filter(Boolean).map(function (x) { return "<div><dt>" + x[1] + "</dt><dd>" + x[0] + "</dd></div>"; }).join("");
  document.getElementById("foot").textContent = "Exported " + T.exportedAt + " from " + (T.app || "China Journal") + (T.tiles.list.length ? "  ·  Map data © OpenStreetMap contributors" : "");

  // ---- Filmstrip: the first photo from each region (or each day for a one-region trip) ----
  (function () {
    var strip = document.getElementById("filmstrip"), picks = [], seen = {};
    var pics = T.photos.filter(function (m) { return m.type === "photo"; }).sort(function (a, b) { return a.utc - b.utc; });
    pics.forEach(function (m) {
      var day = dayByDate[m.date], key = day && day.region ? day.region : m.date;
      if (!seen[key] && picks.length < 5) { seen[key] = 1; picks.push({ m: m, label: day && day.region ? day.region : (day ? day.label : "") }); }
    });
    if (picks.length < 3) return;
    picks.forEach(function (p) {
      var d = el("div", "shot", '<img src="' + p.m.src + '" alt="" loading="lazy"><span>' + esc(p.label) + "</span>");
      d.dataset.media = p.m.index; strip.appendChild(d);
    });
  })();

  // ---- Calendar: Monday-to-Sunday weeks over the trip, cells coloured by region ----
  var cal = document.getElementById("calendar");
  var head = el("div", "cal-head");
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(function (d) { head.appendChild(el("div", null, d)); });
  var WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  cal.appendChild(head);
  var cells = {};
  var first = new Date(s0); first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  var last = new Date(s1); last.setDate(last.getDate() + (6 - (last.getDay() + 6) % 7));
  var week = null;
  for (var d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    if ((d.getDay() + 6) % 7 === 0) { week = el("div", "week"); cal.appendChild(week); }
    var key = iso(d), day = dayByDate[key];
    var cell = el("div", "cell" + (day ? "" : " out"));
    var top = '<span class="wd">' + WD[d.getDay()] + '</span><div class="top"><span><span class="num">' + d.getDate() + "</span>" +
      (d.getDate() === 1 || key === T.startDate ? ' <span class="mon">' + d.toLocaleDateString(undefined, { month: "short" }) + "</span>" : "") +
      "</span>" + (day ? '<span class="mood">' + mood(day.mood) + "</span>" : "") + "</div>";
    if (!day) { cell.innerHTML = top; week.appendChild(cell); continue; }
    if (day.region && T.regionColors[day.region]) { cell.style.setProperty("--region", vivid(T.regionColors[day.region])); cell.style.setProperty("--region-dot", vivid(T.regionColors[day.region])); }
    var media = mediaByDate[key] || [];
    var nP = media.filter(function (m) { return m.type === "photo"; }).length, nV = media.length - nP;
    // Up to three highlight icons: the kinds of stop visited that day.
    var stops = [];
    day.placeIds.forEach(function (pid) { var p = placesById[pid]; if (p && p.stop && stops.indexOf(p.stop) < 0) stops.push(p.stop); });
    (entriesByDate[key] || []).forEach(function (e) { if (e.stop && stops.indexOf(e.stop) < 0) stops.push(e.stop); });
    var html = top + '<div class="region">' + (day.region ? "<i></i><span>" + esc(day.region) + "</span>" : "") + "</div>";
    html += '<div class="bottom"><span class="counts">' + (nP ? iconSpan("camera") + nP : "") + (nV ? (nP ? "&nbsp;" : "") + iconSpan("video") + nV : "") + "</span>" +
      '<span class="plans" title="Planned items">' + day.planned.slice(0, 4).map(function (it) { return '<b class="' + it.status + '"></b>'; }).join("") + "</span></div>";
    cell.title = day.label + (day.region ? " · " + day.region : "") + (stops.length ? "  " + stops.slice(0, 3).map(icon).join(" ") : "");
    cell.innerHTML = html;
    cell.dataset.date = key;
    cell.tabIndex = 0;
    cell.addEventListener("click", (function (k) { return function () { selectDay(k, { scroll: true }); }; })(key));
    cell.addEventListener("keydown", (function (k) { return function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectDay(k); } }; })(key));
    cells[key] = cell;
    week.appendChild(cell);
  }
  function mark(status) {
    return status === "done" ? '<span class="mark-done" title="Logged">✓</span>'
      : status === "confirmed" ? '<span class="mark-confirmed" title="Booked">✓</span>'
      : '<span class="mark-proposed" title="Planned, not booked">*</span>';
  }

  // ---- Legend ----
  var legend = document.getElementById("legend");
  var hasPlans = T.days.some(function (d) { return d.planned.length; });
  if (hasPlans) legend.innerHTML = '<span><b class="dot" style="width:7px;height:7px;border-radius:50%;background:#2e7d32;display:inline-block"></b> planned or booked</span>' +
    '<span><b class="dot" style="width:7px;height:7px;border-radius:50%;background:#c77800;display:inline-block"></b> not booked yet</span>';

  // ---- Map: only the tiles saved in this folder. The page never asks a tile server for anything:
  // opened from a file, tile servers refuse it (no referrer), and it must work with no internet. ----
  var hasTiles = T.tiles.list.length > 0;
  var tb = T.tiles.bounds || [];
  var savedArea = hasTiles && tb.length === 4 ? L.latLngBounds([tb[0], tb[1]], [tb[2], tb[3]]) : null;
  // One level closer than the most detailed saved tile (drawn from it, scaled up), and no further out
  // than the widest saved view. Panning stays near the saved area.
  var map = L.map("map", {
    zoomControl: true,
    minZoom: hasTiles ? T.tiles.minZoom : 2,
    maxZoom: hasTiles ? Math.min(18, T.tiles.maxZoom + 1) : 12,
    maxBounds: savedArea ? savedArea.pad(1.5) : null,
    maxBoundsViscosity: savedArea ? 0.8 : 0,
  });
  var world = topojson.feature(WORLD_TOPO, WORLD_TOPO.objects.countries);
  // The country outline sits under the map tiles: it shows wherever no tile was saved.
  map.createPane("world").style.zIndex = 150;
  L.geoJSON(world, { pane: "world", style: { color: S.landEdge || "#c9b8aa", weight: 1, fillColor: S.land || "#f4ece2", fillOpacity: 1 }, interactive: false }).addTo(map);

  var bundled = {}; T.tiles.list.forEach(function (k) { bundled[k] = 1; });
  // Draws each tile from the saved set, or the closest saved lower zoom scaled up, so zooming past
  // the saved detail stays readable instead of going blank. Where nothing was saved the tile stays
  // empty and the country outline underneath shows through; never a broken image.
  var LocalTiles = L.GridLayer.extend({
    createTile: function (c, done) {
      var tile = document.createElement("div"), size = this.getTileSize().x;
      var dz = 0;
      while (c.z - dz >= T.tiles.minZoom && !bundled[(c.z - dz) + "/" + (c.x >> dz) + "/" + (c.y >> dz)]) dz++;
      if (c.z - dz < T.tiles.minZoom || dz > 6) { setTimeout(function () { done(null, tile); }, 0); return tile; }
      var scale = 1 << dz, px = c.x >> dz, py = c.y >> dz;
      var img = document.createElement("img");
      img.alt = "";
      img.style.cssText = "position:absolute;width:" + size * scale + "px;height:" + size * scale + "px;left:" + (-(c.x - px * scale) * size) + "px;top:" + (-(c.y - py * scale) * size) + "px";
      img.onload = function () { done(null, tile); };
      img.onerror = function () { if (img.parentNode) img.parentNode.removeChild(img); done(null, tile); };
      img.src = "tiles/" + (c.z - dz) + "/" + px + "/" + py + ".png";
      tile.style.overflow = "hidden";
      tile.appendChild(img);
      return tile;
    },
  });
  window.memoryBoxMap = map; // handy for checking the page from the browser's console
  if (hasTiles) new LocalTiles({ minZoom: T.tiles.minZoom, maxZoom: 18, zIndex: 2, attribution: "Map data © OpenStreetMap contributors" }).addTo(map);
  var note = document.getElementById("mapNote");
  function updateTiles() {
    var z = map.getZoom();
    if (!hasTiles) { note.textContent = "No map tiles were saved with this trip, so routes and pins show on an outline map"; note.hidden = false; }
    else if (z > (T.tiles.fullMaxZoom || T.tiles.maxZoom)) { note.textContent = "Closest saved detail: zoom out a step for the full map"; note.hidden = false; }
    else note.hidden = true;
  }
  map.on("zoomend", updateTiles);

  var allRoute = L.layerGroup().addTo(map), dayRoute = L.layerGroup().addTo(map), pins = L.layerGroup().addTo(map);
  var fullLine = T.route.map(function (p) { return [p.lat, p.lon]; });
  var CASING = S.dark ? "#000" : "#fff";
  if (fullLine.length > 1) {
    L.polyline(fullLine, { color: CASING, weight: 7, opacity: .85, lineCap: "round", lineJoin: "round" }).addTo(allRoute);
    L.polyline(fullLine, { color: ROUTE, weight: 3.5, opacity: .9, lineCap: "round", lineJoin: "round" }).addTo(allRoute);
  }

  function pinIcon(stop, dim) { return L.divIcon({ className: "", html: '<div class="pin' + (dim ? " dim" : "") + '">' + icon(stop || "OTHER") + "</div>", iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] }); }
  function thumbHtml(m) {
    return '<div class="thumb" data-media="' + m.index + '"><img src="' + m.thumb + '" alt="" loading="lazy">' +
      (m.type === "video" ? '<span class="play">' + iconSpan("play") + '</span><span class="dur">' + dur(m.durationMs) + "</span>" : "") + "</div>";
  }
  var popGroups = [];
  function popupFor(title, sub, media, entries) {
    media = media.slice().sort(function (a, b) { return a.utc - b.utc; });
    var g = popGroups.push(media) - 1, shown = media.length > 9 ? media.slice(0, 8) : media;
    return "<div class='pop-title'>" + esc(title) + "</div>" + (sub ? "<div class='muted'>" + sub + "</div>" : "") +
      (entries || []).map(function (e) { return "<div class='entry'>" + esc(e.title || e.kind) + " " + stars(e.rating) + "</div>"; }).join("") +
      (media.length ? "<div class='gallery'>" + shown.map(function (m) { return thumbHtml(m).replace("<div class=\"thumb\"", "<div class=\"thumb\" data-group=\"" + g + "\""); }).join("") +
        (media.length > shown.length ? "<div class='thumb more' data-media='" + media[8].index + "' data-group='" + g + "'><span>+" + (media.length - 8) + "</span></div>" : "") + "</div>" : "");
  }
  var POPUP = { maxWidth: 260, maxHeight: 340, autoPanPaddingTopLeft: [16, 16], autoPanPaddingBottomRight: [16, 16] };

  // One pin per place (with its kind-of-stop icon), plus one per photo or clip that isn't tied to a place.
  function drawPins(date) {
    pins.clearLayers();
    popGroups = [];
    var pts = [];
    T.places.forEach(function (p) {
      var media = (mediaByPlace[p.id] || []).filter(function (m) { return !date || m.date === date; });
      var onDay = !date || (dayByDate[date] && dayByDate[date].placeIds.indexOf(p.id) >= 0) || media.length;
      if (!onDay) return;
      var entries = T.entries.filter(function (e) { return e.placeId === p.id && (!date || e.date === date); });
      L.marker([p.lat, p.lon], { icon: pinIcon(p.stop || (entries[0] && entries[0].stop)) })
        .bindPopup(popupFor(niceName(p) || "Place", esc(p.city) + " " + stars(p.rating) + " " + mood(p.mood), media, entries), POPUP)
        .addTo(pins);
      pts.push([p.lat, p.lon]);
    });
    T.photos.forEach(function (m) {
      if (m.placeId && placesById[m.placeId]) return;
      if (m.plat == null || (date && m.date !== date)) return;
      L.marker([m.plat, m.plon], { icon: pinIcon(m.stop) }).bindPopup(popupFor(m.caption || (m.type === "video" ? "Clip" : "Photo"), esc(m.date + " " + m.time), [m]), POPUP).addTo(pins);
      pts.push([m.plat, m.plon]);
    });
    return pts;
  }

  function fitAll() {
    dayRoute.clearLayers();
    var pts = drawPins(null).concat(fullLine);
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); else map.setView([35, 105], 4);
    document.querySelectorAll(".cell.selected").forEach(function (c) { c.classList.remove("selected"); });
    selected = null;
  }

  // ---- Day selection: calendar, map and detail panel together ----
  var selected = null;
  var detail = document.getElementById("detail");
  function selectDay(date, opts) {
    selected = date;
    document.querySelectorAll(".cell").forEach(function (c) { c.classList.toggle("selected", c.dataset.date === date); });
    dayRoute.clearLayers();
    var line = (routeByDate[date] || []).map(function (p) { return [p.lat, p.lon]; });
    if (line.length > 1) {
      L.polyline(line, { color: CASING, weight: 10, opacity: .9, lineCap: "round", lineJoin: "round" }).addTo(dayRoute);
      L.polyline(line, { color: ROUTE, weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(dayRoute);
    }
    var pts = drawPins(date).concat(line);
    if (!(opts && opts.keepView)) {
      if (pts.length) map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
    }
    renderDetail(date);
    if (opts && opts.scroll) detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderDetail(date) {
    var day = dayByDate[date];
    if (!day) { detail.innerHTML = "<p class='muted'>Pick a day in the calendar to see its photos and stops.</p>"; return; }
    var media = (mediaByDate[date] || []).slice().sort(function (a, b) { return a.utc - b.utc; });
    var dd = parseDate(date), long = dd.toLocaleDateString(undefined, { weekday: "long" }) + " " + dd.getDate() + " " + dd.toLocaleDateString(undefined, { month: "long" });
    var h = "<p class='day-eyebrow'>Day " + (day.index + 1) + " of " + T.days.length + "</p>";
    h += "<div class='day-title'><h2>" + esc(long) + "</h2><span class='mood'>" + mood(day.mood) + "</span></div>";
    h += "<div class='day-meta'><span>" + esc(day.cities.length ? day.cities.join(" → ") : day.region) + "</span>" + (day.rating ? stars(day.rating) : "") + "</div>";
    if (day.note) h += "<p class='lede'>" + esc(day.note) + "</p>";
    if (day.planned.length) {
      var TAG = { done: "Done", confirmed: "Booked", proposed: "Not booked" };
      h += "<h3 class='label sub'>Plan</h3><ul class='plan-list'>" + day.planned.map(function (it) {
        return "<li><span class='tag " + it.status + "'>" + (TAG[it.status] || "Planned") + "</span>" + esc(it.text) + "</li>"; }).join("") + "</ul>";
    }
    if (media.length) h += "<h3 class='label sub'>Photos and clips · " + media.length + "</h3><div class='gallery n" + Math.min(media.length, 3) + "'>" + media.map(thumbHtml).join("") + "</div>";
    // Stops in time order: first moment each place shows up that day, then entries.
    var events = [];
    var seen = {};
    (routeByDate[date] || []).forEach(function (p) { if (p.placeId && !seen[p.placeId]) { seen[p.placeId] = 1; events.push({ utc: p.utc, place: placesById[p.placeId], time: p.time }); } });
    media.forEach(function (m) { if (m.placeId && !seen[m.placeId]) { seen[m.placeId] = 1; events.push({ utc: m.utc, place: placesById[m.placeId], time: m.time }); } });
    day.placeIds.forEach(function (pid) { if (!seen[pid]) { seen[pid] = 1; events.push({ utc: Infinity, place: placesById[pid] }); } });
    events.sort(function (a, b) { return a.utc - b.utc; });
    if (events.length) {
      h += "<h3 class='label sub'>Stops</h3><ul class='stops'>" + events.map(function (ev) {
        var p = ev.place; if (!p) return "";
        var ents = (entriesByDate[date] || []).filter(function (e) { return e.placeId === p.id; });
        var kind = p.stop || (ents[0] && ents[0].stop) || "OTHER";
        return "<li><span class='t'>" + (ev.time || "") + "</span><span class='ico'>" + icon(kind) + "</span><div class='body'>" +
          "<div class='name'>" + esc(niceName(p) || "Place") + (p.rating ? stars(p.rating) : "") + " " + mood(p.mood) + "</div>" +
          "<div class='kind'>" + esc([T.stopLabels[kind], p.city].filter(Boolean).join(" · ")) + "</div>" +
          (p.note ? "<div class='note'>" + esc(p.note) + "</div>" : "") +
          ents.filter(function (e) { return e.title || e.note; }).map(function (e) { return "<div class='entry'>" + esc(e.kind) + (e.title ? ": " + esc(e.title) : "") + " " + stars(e.rating) + " " + mood(e.mood) + (e.note ? " <span class='muted'>" + esc(e.note) + "</span>" : "") + "</div>"; }).join("") +
          "</div></li>";
      }).join("") + "</ul>";
    }
    var loose = (entriesByDate[date] || []).filter(function (e) { return !e.placeId || !placesById[e.placeId]; });
    if (loose.length) h += "<h3 class='label sub'>Notes</h3>" + loose.map(function (e) { return "<div class='entry'><b>" + esc(e.kind) + (e.title ? ": " + esc(e.title) : "") + "</b> " + stars(e.rating) + " " + mood(e.mood) + (e.note ? "<div class='note'>" + esc(e.note) + "</div>" : "") + "</div>"; }).join("");
    if (!media.length && !events.length && !day.note && !day.planned.length) h += "<p class='muted' style='margin-top:16px'>Nothing logged this day.</p>";
    detail.innerHTML = h;
  }
  document.getElementById("wholeTrip").onclick = function () { stopRecap(); fitAll(); renderDetail(null); };

  // ---- Lightbox: same full-screen viewer everywhere, mouse-wheel and pinch zoom, clips play ----
  var lb = document.getElementById("lightbox"), stage = lb.querySelector(".stage"), cap = lb.querySelector(".caption");
  var allMedia = T.photos.slice().sort(function (a, b) { return a.utc - b.utc; }), list = allMedia, cur = -1;
  var z = { s: 1, x: 0, y: 0 }, imgEl = null;
  function applyZoom() { if (imgEl) imgEl.style.transform = "translate(" + z.x + "px," + z.y + "px) scale(" + z.s + ")"; }
  function resetZoom() { z = { s: 1, x: 0, y: 0 }; applyZoom(); }
  /** Opens the viewer on one photo; group (a pin's photos) limits Previous / Next to that place. */
  function openMedia(m, group) {
    list = group && group.indexOf(m) >= 0 ? group : allMedia;
    cur = list.indexOf(m);
    if (map) map.closePopup();
    showCur(); lb.hidden = false;
  }
  function showCur() {
    var m = list[cur]; if (!m) return;
    stage.innerHTML = "";
    imgEl = null;
    if (m.type === "video") {
      var v = el("video"); v.src = m.src; v.controls = true; v.autoplay = true; v.poster = m.thumb; stage.appendChild(v);
    } else {
      imgEl = el("img"); imgEl.src = m.src; imgEl.alt = m.caption || ""; stage.appendChild(imgEl);
      resetZoom();
    }
    var place = placesById[m.placeId];
    lb.querySelector(".prev").hidden = cur <= 0; lb.querySelector(".next").hidden = cur >= list.length - 1;
    cap.innerHTML = esc([m.caption, niceName(place), (dayByDate[m.date] ? dayByDate[m.date].label : m.date) + ", " + m.time].filter(Boolean).join(" · ")) + "<span class='count'>" + (cur + 1) + " / " + list.length + "</span>";
  }
  function zoomAt(cx, cy, factor) {
    if (!imgEl) return;
    var r = imgEl.getBoundingClientRect();
    var ns = Math.min(8, Math.max(1, z.s * factor));
    // Keep the point under the cursor (or between the fingers) still.
    var ox = cx - r.left, oy = cy - r.top;
    z.x -= ox * (ns / z.s - 1); z.y -= oy * (ns / z.s - 1); z.s = ns;
    if (ns === 1) { z.x = 0; z.y = 0; }
    applyZoom();
  }
  stage.addEventListener("wheel", function (e) { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
  stage.addEventListener("dblclick", function (e) { if (z.s > 1) resetZoom(); else zoomAt(e.clientX, e.clientY, 2.5); });
  var ptrs = {}, lastDist = 0, lastPos = null;
  stage.addEventListener("pointerdown", function (e) { if (!imgEl) return; ptrs[e.pointerId] = e; stage.setPointerCapture(e.pointerId); lastPos = { x: e.clientX, y: e.clientY }; lastDist = 0; });
  stage.addEventListener("pointermove", function (e) {
    if (!ptrs[e.pointerId] || !imgEl) return;
    ptrs[e.pointerId] = e;
    var ids = Object.keys(ptrs);
    if (ids.length === 2) {
      var a = ptrs[ids[0]], b = ptrs[ids[1]];
      var dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (lastDist) zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, dist / lastDist);
      lastDist = dist;
    } else if (ids.length === 1 && z.s > 1 && lastPos) {
      z.x += e.clientX - lastPos.x; z.y += e.clientY - lastPos.y; applyZoom();
    }
    lastPos = { x: e.clientX, y: e.clientY };
  });
  function up(e) { delete ptrs[e.pointerId]; lastDist = 0; }
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  function close() { lb.hidden = true; stage.innerHTML = ""; }
  lb.querySelector(".close").onclick = close;
  lb.querySelector(".prev").onclick = function () { if (cur > 0) { cur--; showCur(); } };
  lb.querySelector(".next").onclick = function () { if (cur < list.length - 1) { cur++; showCur(); } };
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft" && cur > 0) { cur--; showCur(); }
    if (e.key === "ArrowRight" && cur < list.length - 1) { cur++; showCur(); }
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-media]");
    if (t) { e.preventDefault(); openMedia(T.photos[+t.dataset.media], t.dataset.group != null ? popGroups[+t.dataset.group] : null); }
  });

  var collageBtn = document.getElementById("collageBtn");
  var probeCollage = new Image();
  probeCollage.onload = function () { collageBtn.hidden = false; };
  probeCollage.src = "collage.jpg";
  collageBtn.onclick = function () {
    stage.innerHTML = ""; imgEl = el("img"); imgEl.src = "collage.jpg"; stage.appendChild(imgEl); resetZoom();
    cap.textContent = "The whole trip in one picture (collage.jpg in this folder)"; cur = -1; lb.hidden = false;
  };

  // ---- Recap: the route draws day by day while photos and clips pop up where they were taken ----
  var playBtn = document.getElementById("play"), bar = document.getElementById("recapBar"), card = document.getElementById("recapCard");
  var rec = null;
  function recapDays() {
    return T.days.filter(function (d) { return (routeByDate[d.date] || []).length || (mediaByDate[d.date] || []).some(function (m) { return m.plat != null; }); });
  }
  function setPlay(on) { playBtn.querySelector(".i").innerHTML = ico(on ? "stop" : "play"); playBtn.querySelector(".lbl").textContent = on ? "Stop recap" : "Play recap"; }
  function setPause(p) { var b = document.getElementById("recPause"); b.innerHTML = iconSpan(p ? "play" : "pause"); b.setAttribute("aria-label", p ? "Resume" : "Pause"); }
  function stopRecap() {
    if (!rec) return;
    clearTimeout(rec.timer); rec.stopped = true; rec = null;
    bar.hidden = true; card.hidden = true; card.innerHTML = "";
    setPlay(false);
  }
  function wait(ms, fn) { rec.timer = setTimeout(function () { if (rec && !rec.stopped) { if (rec.paused) rec.resume = fn; else fn(); } }, ms / rec.speed); }
  function playDay() {
    if (!rec) return;
    var days = rec.days;
    if (rec.dayIdx >= days.length) { wait(1500, function () { stopRecap(); fitAll(); }); return; }
    var day = days[rec.dayIdx];
    document.getElementById("recDay").textContent = "Day " + (day.index + 1) + " · " + day.label;
    selectDay(day.date, { keepView: true });
    dayRoute.clearLayers();
    var steps = (routeByDate[day.date] || []).map(function (p) { return { utc: p.utc, lat: p.lat, lon: p.lon }; });
    (mediaByDate[day.date] || []).forEach(function (m) { if (m.plat != null) steps.push({ utc: m.utc, lat: m.plat, lon: m.plon, media: m }); });
    steps.sort(function (a, b) { return a.utc - b.utc; });
    var pts = steps.map(function (s) { return [s.lat, s.lon]; });
    if (pts.length) map.flyToBounds(pts, { padding: [60, 60], maxZoom: 15, duration: 1.2 });
    var casing = L.polyline([], { color: CASING, weight: 10, opacity: .9, lineCap: "round", lineJoin: "round" }).addTo(dayRoute);
    var line = L.polyline([], { color: ROUTE, weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(dayRoute);
    var dot = null;
    card.innerHTML = "<div><b>" + esc(day.label) + "</b>" + esc(day.cities.join(" → ") || day.region) + " " + mood(day.mood) + "</div>";
    card.hidden = false;
    var i = 0;
    function next() {
      if (!rec || rec.skip) { if (rec) { rec.skip = false; rec.dayIdx++; playDay(); } return; }
      if (i >= steps.length) { wait(1200, function () { rec.dayIdx++; playDay(); }); return; }
      var s = steps[i++];
      line.addLatLng([s.lat, s.lon]); casing.addLatLng([s.lat, s.lon]);
      if (!dot) dot = L.circleMarker([s.lat, s.lon], { radius: 8, color: "#fff", weight: 3, fillColor: ROUTE, fillOpacity: 1 }).addTo(dayRoute);
      else dot.setLatLng([s.lat, s.lon]);
      if (s.media) {
        var m = s.media, place = placesById[m.placeId];
        var media = m.type === "video" ? "<video src='" + m.src + "' autoplay muted playsinline></video>" : "<img src='" + m.src + "' alt=''>";
        card.innerHTML = media + "<div><b>" + esc(niceName(place) || day.region) + "</b><span class='muted'>" + esc(day.label + " · " + m.time) + "</span>" + (m.caption ? "<br>" + esc(m.caption) : "") + "</div>";
        // Clips play for their length (up to 10 s), photos for about 2.5 s.
        wait(m.type === "video" ? Math.min(10000, m.durationMs || 5000) : 2500, next);
      } else wait(180, next);
    }
    wait(1400, next);
  }
  playBtn.onclick = function () {
    if (rec) { stopRecap(); return; }
    var days = recapDays();
    if (!days.length) { alert("Nothing with a location to replay yet."); return; }
    rec = { days: days, dayIdx: 0, speed: +document.getElementById("recSpeed").value, paused: false };
    bar.hidden = false; setPlay(true); setPause(false);
    playDay();
  };
  document.getElementById("recPause").onclick = function () {
    if (!rec) return;
    rec.paused = !rec.paused;
    setPause(rec.paused);
    var v = card.querySelector("video"); if (v) { if (rec.paused) v.pause(); else v.play(); }
    if (!rec.paused && rec.resume) { var f = rec.resume; rec.resume = null; f(); }
  };
  document.getElementById("recSkip").onclick = function () {
    if (!rec) return;
    clearTimeout(rec.timer);
    rec.paused = false; rec.resume = null; setPause(false);
    rec.dayIdx++; playDay();
  };
  document.getElementById("recSpeed").onchange = function () { if (rec) rec.speed = +this.value; };
  document.getElementById("recStop").onclick = function () { stopRecap(); fitAll(); };

  // ---- Start: whole trip on the map, first day with something logged in the panel ----
  fitAll();
  updateTiles();
  // The layout settles after first paint; size the map again so the trip fills it.
  window.addEventListener("load", function () { map.invalidateSize(); if (!selected) fitAll(); });
  window.addEventListener("resize", function () { map.invalidateSize(); });
  var firstLogged = T.days.filter(function (d) { return (mediaByDate[d.date] || []).length || d.placeIds.length || d.note; })[0];
  renderDetail(firstLogged ? firstLogged.date : (T.days[0] && T.days[0].date));
  if (firstLogged && cells[firstLogged.date]) cells[firstLogged.date].classList.add("selected");
})();
