(function () {
  "use strict";
  var T = window.TRIP;
  var MOODS = ["", "😞", "😕", "😐", "🙂", "😄"];
  var DAY_COLORS = ["#b3261e", "#1f6f8b", "#8c6a00", "#6a3d9a", "#2e7d32", "#c2185b", "#ef6c00", "#00838f"];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function stars(n) { return n ? '<span class="stars">' + "★".repeat(n) + "☆".repeat(5 - n) + "</span>" : ""; }
  function mood(n) { return n ? MOODS[n] : ""; }
  function km(a, b) {
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  var placesById = {}; T.places.forEach(function (p) { placesById[p.id] = p; });
  var photosByPlace = {}, photosByDate = {};
  T.photos.forEach(function (p) {
    (photosByPlace[p.placeId || "_"] = photosByPlace[p.placeId || "_"] || []).push(p);
    (photosByDate[p.date] = photosByDate[p.date] || []).push(p);
  });
  var dayIndex = {}; T.days.forEach(function (d, i) { dayIndex[d.date] = i; });

  // ---- Header ----
  document.title = T.title + " · Memory Box";
  document.getElementById("title").textContent = T.title;
  var dist = 0; for (var i = 1; i < T.route.length; i++) dist += km(T.route[i - 1], T.route[i]);
  var cities = {}; T.places.forEach(function (p) { if (p.city) cities[p.city] = 1; });
  document.getElementById("stats").textContent = [
    T.days.length + " days", Object.keys(cities).length ? Object.keys(cities).length + " cities" : null,
    T.places.length + " places", T.photos.length + " photos", Math.round(dist) + " km logged",
  ].filter(Boolean).join(" · ") + "  ·  exported " + T.exportedAt;

  // ---- Map ----
  var map = L.map("map", { zoomControl: true, worldCopyJump: true, preferCanvas: true });
  var world = topojson.feature(WORLD_TOPO, WORLD_TOPO.objects.countries);
  L.geoJSON(world, { style: { color: "#c9b8aa", weight: 1, fillColor: "#f4ece2", fillOpacity: 1 }, interactive: false }).addTo(map);
  var tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" });
  document.getElementById("tiles").addEventListener("change", function (e) { e.target.checked ? tileLayer.addTo(map) : map.removeLayer(tileLayer); });

  var routeLayer = L.layerGroup().addTo(map);
  var markerLayer = L.layerGroup().addTo(map);
  var markers = {};

  function drawRoute() {
    routeLayer.clearLayers();
    var byDay = {};
    T.route.forEach(function (p) { (byDay[p.date] = byDay[p.date] || []).push([p.lat, p.lon]); });
    Object.keys(byDay).sort().forEach(function (d, i) {
      // Connect each day to the previous one so the whole trip reads as one line.
      L.polyline(byDay[d], { color: DAY_COLORS[(dayIndex[d] || i) % DAY_COLORS.length], weight: 4, opacity: .85 }).addTo(routeLayer);
    });
    if (T.route.length > 1) L.polyline(T.route.map(function (p) { return [p.lat, p.lon]; }), { color: "#555", weight: 1, dashArray: "4 6", opacity: .5 }).addTo(routeLayer);
  }

  function placePopup(p) {
    var ph = (photosByPlace[p.id] || []).slice(0, 8);
    return "<b>" + esc(p.name) + "</b>" + (p.city ? "<br><span class='muted'>" + esc(p.city) + "</span>" : "") +
      "<br>" + stars(p.rating) + " " + mood(p.mood) + (p.note ? "<div class='note'>" + esc(p.note) + "</div>" : "") +
      "<div class='thumbs'>" + ph.map(function (x) { return "<img src='" + x.thumb + "' data-photo='" + x.id + "'>"; }).join("") + "</div>";
  }

  T.places.forEach(function (p) {
    var n = (photosByPlace[p.id] || []).length;
    var m = L.circleMarker([p.lat, p.lon], { radius: 6 + Math.min(10, n), color: "#fff", weight: 2, fillColor: "#b3261e", fillOpacity: .9 })
      .bindPopup(placePopup(p), { maxWidth: 300 });
    m.addTo(markerLayer);
    markers[p.id] = m;
  });
  drawRoute();

  function fitAll() {
    var pts = T.route.map(function (p) { return [p.lat, p.lon]; }).concat(T.places.map(function (p) { return [p.lat, p.lon]; }));
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); else map.setView([35, 105], 4);
  }
  fitAll();

  // ---- Timeline ----
  var tl = document.getElementById("timeline");
  T.days.forEach(function (d, i) {
    var card = el("article", "day");
    card.dataset.date = d.date;
    card.appendChild(el("h2", null, "<span>Day " + (i + 1) + " · " + esc(d.label) + "</span><span>" + mood(d.mood) + "</span>"));
    if (d.cities.length) card.appendChild(el("div", "cities", esc(d.cities.join(" → "))));
    if (d.rating) card.appendChild(el("div", null, stars(d.rating)));
    if (d.note) card.appendChild(el("div", "note", esc(d.note)));
    var dayPhotos = photosByDate[d.date] || [];
    var dayEntries = T.entries.filter(function (e) { return e.date === d.date; });
    d.placeIds.forEach(function (pid) {
      var p = placesById[pid]; if (!p) return;
      var block = el("div", "place");
      block.appendChild(el("h3", null, "📍 " + esc(p.name) + " " + stars(p.rating) + " " + mood(p.mood)));
      dayEntries.filter(function (e) { return e.placeId === pid; }).forEach(function (e) { block.appendChild(entryEl(e)); });
      block.appendChild(thumbs(dayPhotos.filter(function (x) { return x.placeId === pid; })));
      card.appendChild(block);
    });
    var loose = dayPhotos.filter(function (x) { return !x.placeId || d.placeIds.indexOf(x.placeId) < 0; });
    dayEntries.filter(function (e) { return !e.placeId || d.placeIds.indexOf(e.placeId) < 0; }).forEach(function (e) { card.appendChild(entryEl(e)); });
    if (loose.length) card.appendChild(thumbs(loose));
    card.addEventListener("click", function (ev) { if (ev.target.tagName !== "IMG") focusDay(d.date); });
    tl.appendChild(card);
  });
  if (!T.days.length) tl.appendChild(el("p", "muted", "Nothing was logged yet."));

  function entryEl(e) {
    return el("div", "entry", "<b>" + esc(e.kind) + (e.title ? ": " + esc(e.title) : "") + "</b> " + stars(e.rating) + " " + mood(e.mood) +
      (e.note ? "<div class='note'>" + esc(e.note) + "</div>" : ""));
  }
  function thumbs(list) {
    var t = el("div", "thumbs");
    list.forEach(function (x) { var img = el("img"); img.src = x.thumb; img.loading = "lazy"; img.dataset.photo = x.id; img.alt = x.caption || ""; t.appendChild(img); });
    return t;
  }

  function focusDay(date) {
    document.querySelectorAll(".day").forEach(function (c) { c.classList.toggle("active", c.dataset.date === date); });
    var pts = T.route.filter(function (p) { return p.date === date; }).map(function (p) { return [p.lat, p.lon]; });
    var d = T.days[dayIndex[date]];
    d.placeIds.forEach(function (pid) { var p = placesById[pid]; if (p) pts.push([p.lat, p.lon]); });
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
  }

  // ---- Places ----
  var pl = document.getElementById("places");
  T.places.slice().sort(function (a, b) { return a.firstDate < b.firstDate ? -1 : 1; }).forEach(function (p) {
    var card = el("article", "day");
    card.appendChild(el("h2", null, "<span>" + esc(p.name) + "</span><span>" + mood(p.mood) + "</span>"));
    card.appendChild(el("div", "cities", esc(p.city || "")));
    card.appendChild(el("div", null, stars(p.rating) + " <span class='muted'>first visited " + esc(p.firstDate) + "</span>"));
    if (p.note) card.appendChild(el("div", "note", esc(p.note)));
    T.entries.filter(function (e) { return e.placeId === p.id; }).forEach(function (e) { card.appendChild(entryEl(e)); });
    card.appendChild(thumbs(photosByPlace[p.id] || []));
    card.addEventListener("click", function (ev) {
      if (ev.target.tagName === "IMG") return;
      map.setView([p.lat, p.lon], 15); markers[p.id].openPopup();
    });
    pl.appendChild(card);
  });

  document.querySelectorAll("nav button[data-tab]").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("nav button[data-tab]").forEach(function (x) { x.classList.toggle("active", x === b); });
      document.querySelectorAll(".tab").forEach(function (t) { t.hidden = t.id !== b.dataset.tab; });
    });
  });

  // ---- Lightbox ----
  var lb = document.getElementById("lightbox"), lbImg = lb.querySelector("img"), lbCap = lb.querySelector("figcaption");
  var photoIdx = {}; T.photos.forEach(function (p, i) { photoIdx[p.id] = i; });
  var current = -1;
  function show(i) {
    if (i < 0 || i >= T.photos.length) return;
    current = i;
    var p = T.photos[i], place = placesById[p.placeId];
    lbImg.src = p.src;
    lbCap.textContent = [p.caption, place && place.name, p.date + " " + p.time].filter(Boolean).join(" · ");
    lb.hidden = false;
  }
  document.addEventListener("click", function (e) {
    var id = e.target && e.target.dataset && e.target.dataset.photo;
    if (id != null && photoIdx[id] != null) { e.stopPropagation(); show(photoIdx[id]); }
  }, true);
  lb.querySelector(".close").onclick = function () { lb.hidden = true; };
  lb.querySelector(".prev").onclick = function () { show(current - 1); };
  lb.querySelector(".next").onclick = function () { show(current + 1); };
  lb.addEventListener("click", function (e) { if (e.target === lb) lb.hidden = true; });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") lb.hidden = true;
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });

  // ---- Animated recap: a marker travels the route and photos pop up where they were taken ----
  var playBtn = document.getElementById("play"), card = document.getElementById("recapCard");
  var playing = false, timer = null;
  function buildSteps() {
    var steps = T.route.map(function (p) { return { utc: p.utc, lat: p.lat, lon: p.lon, date: p.date }; });
    T.photos.forEach(function (p) {
      var place = placesById[p.placeId];
      var lat = p.lat != null ? p.lat : place && place.lat, lon = p.lon != null ? p.lon : place && place.lon;
      if (lat != null) steps.push({ utc: p.utc, lat: lat, lon: lon, date: p.date, photo: p });
    });
    return steps.sort(function (a, b) { return a.utc - b.utc; });
  }
  function stop() {
    playing = false; clearTimeout(timer); card.hidden = true; playBtn.textContent = "▶ Play the trip";
    if (window._recapMarker) { map.removeLayer(window._recapMarker); window._recapMarker = null; }
  }
  playBtn.addEventListener("click", function () {
    if (playing) { stop(); return; }
    var steps = buildSteps();
    if (!steps.length) return;
    playing = true; playBtn.textContent = "■ Stop";
    var marker = window._recapMarker = L.circleMarker([steps[0].lat, steps[0].lon], { radius: 9, color: "#fff", weight: 3, fillColor: "#e0a100", fillOpacity: 1 }).addTo(map);
    map.setView([steps[0].lat, steps[0].lon], 12);
    var i = 0, lastDate = null;
    (function next() {
      if (!playing) return;
      if (i >= steps.length) { timer = setTimeout(function () { stop(); fitAll(); }, 2500); return; }
      var s = steps[i++];
      var from = marker.getLatLng(), to = L.latLng(s.lat, s.lon);
      var far = from.distanceTo(to) > 30000;
      if (far) map.flyTo(to, 11, { duration: 1.5 }); else map.panTo(to, { animate: true, duration: .6 });
      animateMarker(marker, from, to, far ? 1500 : 600, function () {
        var d = T.days[dayIndex[s.date]];
        if (s.photo) {
          var place = placesById[s.photo.placeId];
          card.innerHTML = "<img src='" + s.photo.src + "'><div><b>" + esc(place ? place.name : "") + "</b><br><span class='muted'>" +
            esc(d ? d.label : s.date) + " · " + esc(s.photo.time) + "</span>" + (s.photo.caption ? "<br>" + esc(s.photo.caption) : "") + "</div>";
          card.hidden = false;
          timer = setTimeout(next, 2200);
        } else {
          if (s.date !== lastDate && d) {
            card.innerHTML = "<div><b>" + esc(d.label) + "</b><br>" + esc(d.cities.join(" → ")) + " " + mood(d.mood) + "</div>";
            card.hidden = false;
          }
          timer = setTimeout(next, s.date !== lastDate ? 1600 : 150);
        }
        lastDate = s.date;
      });
    })();
  });
  function animateMarker(m, from, to, ms, done) {
    var start = performance.now();
    (function frame(now) {
      if (!playing) return;
      var t = Math.min(1, (now - start) / ms);
      m.setLatLng([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t]);
      if (t < 1) requestAnimationFrame(frame); else done();
    })(start);
  }
})();
