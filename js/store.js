// Storage and journal logic. Field names match the Android app's database rows exactly, so backups
// move between the two apps and the memory box export is the same shape.
(function () {
  "use strict";

  var DB_NAME = "china-journal";
  // Version 2 added trips. Day logs moved to "days", keyed "<tripId>|<date>", because two trips can
  // share a date. The old "dayLogs" store is emptied on first start and never used again.
  var DB_VERSION = 2;
  var dbp = null;

  function open() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = function (ev) {
        var d = r.result;
        if (ev.oldVersion < 1) {
          ["places", "entries", "photos", "points"].forEach(function (n) { d.createObjectStore(n, { keyPath: "id" }); });
          d.createObjectStore("dayLogs", { keyPath: "localDate" });
          d.createObjectStore("blobs");
          d.createObjectStore("kv");
        }
        if (ev.oldVersion < 2) {
          d.createObjectStore("trips", { keyPath: "id" });
          d.createObjectStore("days", { keyPath: "key" });
        }
      };
      r.onblocked = function () { rej(new Error("The journal is open in another window. Close the other one and try again.")); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }

  /** Runs fn(stores) in one transaction and resolves once it is committed to disk. */
  async function tx(names, mode, fn) {
    var d = await open();
    return new Promise(function (res, rej) {
      var t = d.transaction(names, mode, { durability: "strict" });
      var stores = {};
      names.forEach(function (n) { stores[n] = t.objectStore(n); });
      var out;
      try { out = fn(stores); } catch (e) { t.abort(); rej(e); return; }
      t.oncomplete = function () { res(out && out.result !== undefined && out instanceof IDBRequest ? out.result : out); };
      t.onerror = function () { rej(t.error); };
      t.onabort = function () { rej(t.error || new Error("Save was cancelled")); };
    });
  }

  function reqP(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }

  async function getAll(name) { var d = await open(); return reqP(d.transaction(name).objectStore(name).getAll()); }
  async function getOne(name, key) { var d = await open(); return reqP(d.transaction(name).objectStore(name).get(key)); }

  // ---- Time ----

  function zone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; } }
  function safeZone(tz) { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return tz; } catch (e) { return zone(); } }
  function localDate(utc, tz) {
    var p = new Intl.DateTimeFormat("en-CA", { timeZone: safeZone(tz || zone()), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(utc));
    var g = {}; p.forEach(function (x) { g[x.type] = x.value; });
    return g.year + "-" + g.month + "-" + g.day;
  }
  function today() { return localDate(Date.now(), zone()); }
  function dateObj(d) { var a = d.split("-"); return new Date(+a[0], +a[1] - 1, +a[2], 12); }
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function prettyDay(d) { var x = dateObj(d); return DOW[x.getDay()] + " " + x.getDate() + " " + MON[x.getMonth()] + " " + x.getFullYear(); }
  function shortDay(d) { var x = dateObj(d); return DOW[x.getDay()] + " " + x.getDate() + " " + MON[x.getMonth()]; }
  function clock(utc, tz) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: safeZone(tz), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(utc));
  }
  function newId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  function distanceM(lat1, lon1, lat2, lon2) {
    var r = 6371000, rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * r * Math.asin(Math.sqrt(a));
  }

  // ---- In-memory copy of every row (small), kept in step with each write ----
  // ALL holds every trip's rows. S holds only the trip in use (day logs keyed by date), so the
  // screens never see another trip's places or photos.

  var ROW_STORES = ["places", "entries", "photos", "points"];
  var ALL = { trips: new Map(), places: new Map(), days: new Map(), entries: new Map(), photos: new Map(), points: new Map() };
  var S = { places: new Map(), dayLogs: new Map(), entries: new Map(), photos: new Map(), points: new Map() };
  var settings = { currentTripId: null, checkWhileOpen: true, intervalMinutes: 30, lastBackupUtc: 0 };
  var listeners = [];
  function changed() { listeners.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }

  function dayKey(tripId, date) { return tripId + "|" + date; }
  function tripId() { return settings.currentTripId; }
  function trip() { return ALL.trips.get(settings.currentTripId) || null; }
  function trips() { return values(ALL.trips).sort(function (a, b) { return (b.startDate || "").localeCompare(a.startDate || "") || b.createdAtUtc - a.createdAtUtc; }); }

  function rebuildView() {
    var t = tripId();
    ROW_STORES.forEach(function (n) {
      S[n] = new Map();
      ALL[n].forEach(function (r, id) { if (r.tripId === t) S[n].set(id, r); });
    });
    S.dayLogs = new Map();
    ALL.days.forEach(function (l) { if (l.tripId === t) S.dayLogs.set(l.localDate, l); });
  }

  function newTripRow(name) {
    var now = Date.now();
    return { id: newId(), name: name || "My trip", startDate: "", endDate: "", scheme: "red", createdAtUtc: now, updatedAtUtc: now };
  }

  async function load() {
    var saved = await getOne("kv", "settings");
    if (saved) Object.assign(settings, saved);
    var all = await Promise.all(["trips", "places", "days", "entries", "photos", "points", "dayLogs"].map(getAll));
    var oldLogs = all[6];
    // First start after trips arrived: everything so far becomes one trip, named after the old setting.
    if (!all[0].length) {
      var first = newTripRow(settings.tripName || "My trip");
      var moved = { places: all[1], entries: all[3], photos: all[4], points: all[5] };
      var days = oldLogs.map(function (l) { return Object.assign({}, l, { tripId: first.id, key: dayKey(first.id, l.localDate) }); });
      await tx(["trips", "days", "dayLogs", "places", "entries", "photos", "points", "kv"], "readwrite", function (s) {
        s.trips.put(first);
        days.forEach(function (r) { s.days.put(r); });
        s.dayLogs.clear();
        ROW_STORES.forEach(function (n) { moved[n].forEach(function (r) { r.tripId = first.id; s[n].put(r); }); });
        settings.currentTripId = first.id;
        delete settings.tripName;
        s.kv.put(Object.assign({}, settings), "settings");
      });
      all[0] = [first]; all[2] = days;
    }
    function toMap(list, key) { return new Map(list.map(function (x) { return [x[key || "id"], x]; })); }
    ALL.trips = toMap(all[0]); ALL.places = toMap(all[1]); ALL.days = toMap(all[2], "key");
    ALL.entries = toMap(all[3]); ALL.photos = toMap(all[4]); ALL.points = toMap(all[5]);
    if (!ALL.trips.has(settings.currentTripId)) settings.currentTripId = trips()[0].id;
    rebuildView();
  }

  // The in-memory copy is updated before the disk write, so two quick edits in a row (a typed note,
  // then a star tap) each build on the other instead of the second one overwriting the first.
  async function put(name, row) {
    if (name === "dayLogs") {
      ALL.days.set(row.key, row);
      if (row.tripId === tripId()) S.dayLogs.set(row.localDate, row);
      await tx(["days"], "readwrite", function (s) { s.days.put(row); });
    } else if (name === "trips") {
      ALL.trips.set(row.id, row);
      await tx(["trips"], "readwrite", function (s) { s.trips.put(row); });
    } else {
      ALL[name].set(row.id, row);
      if (row.tripId === tripId()) S[name].set(row.id, row); else S[name].delete(row.id);
      await tx([name], "readwrite", function (s) { s[name].put(row); });
    }
    changed();
    return row;
  }

  // ---- Trips ----

  async function createTrip(fields) {
    var t = Object.assign(newTripRow(), fields || {});
    await put("trips", t);
    await switchTrip(t.id);
    return t;
  }
  async function updateTrip(id, change) {
    var t = ALL.trips.get(id); if (!t) return;
    return put("trips", Object.assign({}, t, change, { updatedAtUtc: Date.now() }));
  }
  async function switchTrip(id) {
    if (!ALL.trips.has(id)) return;
    settings.currentTripId = id;
    rebuildView();
    await saveSettings({});
  }
  function tripCounts(id) {
    var n = { photos: 0, places: 0, entries: 0 };
    ALL.photos.forEach(function (p) { if (p.tripId === id && p.status === "READY") n.photos++; });
    ALL.places.forEach(function (p) { if (p.tripId === id) n.places++; });
    ALL.entries.forEach(function (e) { if (e.tripId === id) n.entries++; });
    return n;
  }
  /** Deletes a trip and everything in it, photos included. The last trip can't be deleted. */
  async function deleteTrip(id) {
    if (ALL.trips.size < 2 || !ALL.trips.has(id)) return;
    var gone = {};
    ROW_STORES.forEach(function (n) { gone[n] = values(ALL[n]).filter(function (r) { return r.tripId === id; }); });
    var days = values(ALL.days).filter(function (l) { return l.tripId === id; });
    await tx(["trips", "days", "places", "entries", "photos", "points", "blobs"], "readwrite", function (s) {
      s.trips.delete(id);
      days.forEach(function (l) { s.days.delete(l.key); });
      ROW_STORES.forEach(function (n) { gone[n].forEach(function (r) { s[n].delete(r.id); }); });
      gone.photos.forEach(function (p) { s.blobs.delete("full:" + p.fileName); s.blobs.delete("thumb:" + p.fileName); });
    });
    ALL.trips.delete(id);
    days.forEach(function (l) { ALL.days.delete(l.key); });
    ROW_STORES.forEach(function (n) { gone[n].forEach(function (r) { ALL[n].delete(r.id); }); });
    if (settings.currentTripId === id) await switchTrip(trips()[0].id); else { rebuildView(); changed(); }
  }

  async function saveSettings(change) {
    Object.assign(settings, change);
    await tx(["kv"], "readwrite", function (s) { s.kv.put(Object.assign({}, settings), "settings"); });
    changed();
  }

  // ---- Views over the data ----

  function values(m) { return Array.from(m.values()); }

  function allDates() {
    var set = new Set();
    S.dayLogs.forEach(function (l) { if (l.mood || l.rating || l.note) set.add(l.localDate); });
    S.entries.forEach(function (x) { set.add(x.localDate); });
    S.photos.forEach(function (x) { if (x.status === "READY") set.add(x.localDate); });
    S.points.forEach(function (x) { set.add(x.localDate); });
    return Array.from(set).sort().reverse();
  }

  function day(date) {
    var photos = values(S.photos).filter(function (p) { return p.status === "READY" && p.localDate === date; }).sort(function (a, b) { return a.takenAtUtc - b.takenAtUtc; });
    var entries = values(S.entries).filter(function (e) { return e.localDate === date; }).sort(function (a, b) { return a.createdAtUtc - b.createdAtUtc; });
    var points = values(S.points).filter(function (p) { return p.localDate === date; }).sort(function (a, b) { return a.timeUtc - b.timeUtc; });
    var touched = points.map(function (p) { return [p.timeUtc, p.placeId]; })
      .concat(photos.map(function (p) { return [p.takenAtUtc, p.placeId]; }))
      .concat(entries.map(function (e) { return [e.createdAtUtc, e.placeId]; }))
      .sort(function (a, b) { return a[0] - b[0]; });
    var ids = [];
    touched.forEach(function (t) { if (t[1] && ids.indexOf(t[1]) < 0) ids.push(t[1]); });
    var places = ids.map(function (id) { return S.places.get(id); }).filter(Boolean);
    var cities = [];
    places.forEach(function (p) { var c = (p.city || "").trim(); if (c && cities.indexOf(c) < 0) cities.push(c); });
    return { localDate: date, log: S.dayLogs.get(date) || null, places: places, photos: photos, entries: entries, points: points, cities: cities };
  }

  function placePhotos(id) { return values(S.photos).filter(function (p) { return p.status === "READY" && p.placeId === id; }).sort(function (a, b) { return a.takenAtUtc - b.takenAtUtc; }); }
  function placeEntries(id) { return values(S.entries).filter(function (e) { return e.placeId === id; }); }

  /** The place you're most likely at: the latest one touched in the last three hours. */
  function currentPlaceId() {
    var since = Date.now() - 3 * 3600e3, best = null;
    S.points.forEach(function (p) { if (p.placeId && p.timeUtc > since && (!best || p.timeUtc > best.t)) best = { t: p.timeUtc, id: p.placeId }; });
    S.photos.forEach(function (p) { if (p.placeId && p.takenAtUtc > since && (!best || p.takenAtUtc > best.t)) best = { t: p.takenAtUtc, id: p.placeId }; });
    return best && S.places.has(best.id) ? best.id : null;
  }

  // ---- Places and points ----

  async function findOrCreatePlace(fix, timeUtc, tzId) {
    var radius = Math.min(500, Math.max(150, (fix.accuracyM || 50) * 1.5));
    var nearest = null, nd = Infinity;
    S.places.forEach(function (p) {
      var d = distanceM(p.lat, p.lon, fix.lat, fix.lon);
      if (d <= radius && d < nd) { nd = d; nearest = p; }
    });
    if (nearest) return nearest;
    var date = localDate(timeUtc, tzId);
    return put("places", {
      id: newId(), tripId: tripId(), name: "New place · " + shortDay(date) + " " + clock(timeUtc, tzId), city: "",
      lat: fix.lat, lon: fix.lon, createdAtUtc: timeUtc, tzId: tzId, firstLocalDate: date,
      rating: null, mood: null, note: "", updatedAtUtc: timeUtc,
    });
  }

  async function recordPoint(fix, source, attachPlace) {
    var tz = zone();
    var place = attachPlace ? await findOrCreatePlace(fix, fix.timeUtc, tz) : null;
    return put("points", {
      id: newId(), tripId: tripId(), lat: fix.lat, lon: fix.lon, accuracyM: fix.accuracyM, altitudeM: fix.altitudeM,
      provider: fix.provider, timeUtc: fix.timeUtc, tzId: tz, localDate: localDate(fix.timeUtc, tz),
      source: source, placeId: place ? place.id : null,
    });
  }

  function recentGoodFix(maxAgeMs, maxAcc) {
    var since = Date.now() - maxAgeMs, best = null;
    S.points.forEach(function (p) { if (p.timeUtc >= since && (p.accuracyM || 9999) <= maxAcc && (!best || p.timeUtc > best.timeUtc)) best = p; });
    return best && { lat: best.lat, lon: best.lon, accuracyM: best.accuracyM, altitudeM: best.altitudeM, provider: best.provider, timeUtc: best.timeUtc };
  }

  function lastPointUtc() { var t = 0; S.points.forEach(function (p) { if (p.timeUtc > t) t = p.timeUtc; }); return t; }

  /** One location reading. Resolves null when there's no signal or permission. */
  function getFix(timeoutMs) {
    return new Promise(function (res) {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(function (pos) {
        res({
          lat: pos.coords.latitude, lon: pos.coords.longitude,
          accuracyM: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null,
          altitudeM: pos.coords.altitude, provider: "iphone", timeUtc: pos.timestamp || Date.now(),
        });
      }, function (err) { res({ error: err.code === 1 ? "denied" : "nosignal" }); },
      { enableHighAccuracy: true, timeout: timeoutMs || 20000, maximumAge: 60000 });
    });
  }

  async function mergePlaces(fromId, intoId) {
    if (fromId === intoId) return;
    var from = S.places.get(fromId), into = S.places.get(intoId);
    if (!from || !into) return;
    var photos = values(S.photos).filter(function (p) { return p.placeId === fromId; }).map(function (p) { return Object.assign({}, p, { placeId: intoId }); });
    var entries = values(S.entries).filter(function (e) { return e.placeId === fromId; }).map(function (e) { return Object.assign({}, e, { placeId: intoId }); });
    var points = values(S.points).filter(function (p) { return p.placeId === fromId; }).map(function (p) { return Object.assign({}, p, { placeId: intoId }); });
    var merged = Object.assign({}, into, {
      note: [into.note, from.note].filter(function (s) { return s && s.trim(); }).join("\n\n"),
      city: into.city || from.city, rating: into.rating || from.rating, mood: into.mood || from.mood, updatedAtUtc: Date.now(),
    });
    await tx(["photos", "entries", "points", "places"], "readwrite", function (s) {
      photos.forEach(function (r) { s.photos.put(r); });
      entries.forEach(function (r) { s.entries.put(r); });
      points.forEach(function (r) { s.points.put(r); });
      s.places.put(merged);
      s.places.delete(fromId);
    });
    [S, ALL].forEach(function (M) {
      photos.forEach(function (r) { M.photos.set(r.id, r); });
      entries.forEach(function (r) { M.entries.set(r.id, r); });
      points.forEach(function (r) { M.points.set(r.id, r); });
      M.places.set(intoId, merged);
      M.places.delete(fromId);
    });
    changed();
  }

  /** Removes a place; any readings that pointed at it keep their coordinates but lose the link. */
  async function deletePlace(id) {
    var points = values(S.points).filter(function (p) { return p.placeId === id; }).map(function (p) { return Object.assign({}, p, { placeId: null }); });
    await tx(["points", "places"], "readwrite", function (s) {
      points.forEach(function (r) { s.points.put(r); });
      s.places.delete(id);
    });
    points.forEach(function (r) { S.points.set(r.id, r); ALL.points.set(r.id, r); });
    S.places.delete(id); ALL.places.delete(id);
    changed();
  }

  async function updatePlace(id, change) {
    var p = S.places.get(id); if (!p) return;
    return put("places", Object.assign({}, p, change, { updatedAtUtc: Date.now() }));
  }

  // ---- Day logs and entries ----

  async function saveDayLog(date, change) {
    var cur = S.dayLogs.get(date) || { key: dayKey(tripId(), date), tripId: tripId(), localDate: date, mood: null, rating: null, note: "", updatedAtUtc: 0 };
    return put("dayLogs", Object.assign({}, cur, change, { updatedAtUtc: Date.now() }));
  }

  async function newEntry(kind, date, placeId) {
    var now = Date.now();
    return put("entries", {
      id: newId(), tripId: tripId(), kind: kind, title: "", localDate: date || today(), placeId: placeId || null,
      rating: null, mood: null, note: "", createdAtUtc: now, tzId: zone(), updatedAtUtc: now,
    });
  }
  async function updateEntry(id, change) {
    var e = S.entries.get(id); if (!e) return;
    return put("entries", Object.assign({}, e, change, { updatedAtUtc: Date.now() }));
  }
  async function deleteEntry(id) {
    await tx(["entries"], "readwrite", function (s) { s.entries.delete(id); });
    S.entries.delete(id); ALL.entries.delete(id); changed();
  }

  // ---- Photos ----

  /** Saves the photo row and its image in one transaction, so a crash can't leave half a photo. */
  async function addPhoto(row, full, thumb) {
    row.status = "READY";
    if (!row.tripId) row.tripId = tripId();
    await tx(["photos", "blobs"], "readwrite", function (s) {
      s.blobs.put(full, "full:" + row.fileName);
      if (thumb) s.blobs.put(thumb, "thumb:" + row.fileName);
      s.photos.put(row);
    });
    ALL.photos.set(row.id, row);
    if (row.tripId === tripId()) S.photos.set(row.id, row);
    changed();
    return row;
  }

  async function updatePhoto(id, change) {
    var p = S.photos.get(id); if (!p) return;
    return put("photos", Object.assign({}, p, change));
  }

  async function deletePhoto(id) {
    var p = S.photos.get(id); if (!p) return;
    await tx(["photos", "blobs"], "readwrite", function (s) {
      s.photos.delete(id); s.blobs.delete("full:" + p.fileName); s.blobs.delete("thumb:" + p.fileName);
    });
    S.photos.delete(id); ALL.photos.delete(id); changed();
  }

  async function applyFixToPhoto(id, fix, approx) {
    var p = S.photos.get(id);
    if (!p || p.placeLocked) return;
    if (!fix) return updatePhoto(id, { locStatus: "NONE" });
    var place = await findOrCreatePlace(fix, p.takenAtUtc, p.tzId);
    return updatePhoto(id, { lat: fix.lat, lon: fix.lon, accuracyM: fix.accuracyM, locStatus: approx ? "APPROX" : "GPS", placeId: place.id });
  }

  /** Photos with no location borrow the nearest reading within 45 minutes. Safe to call often. */
  async function fillMissingPhotoLocations() {
    var win = 45 * 60e3, cutoff = Date.now() - 3 * 60e3;
    var pts = values(S.points);
    for (var p of values(S.photos)) {
      if (p.placeLocked || p.takenAtUtc > cutoff || (p.locStatus !== "WAITING" && p.locStatus !== "NONE")) continue;
      var near = null, nd = Infinity;
      pts.forEach(function (x) { var d = Math.abs(x.timeUtc - p.takenAtUtc); if (d <= win && d < nd) { nd = d; near = x; } });
      if (near) await updatePhoto(p.id, { lat: near.lat, lon: near.lon, accuracyM: near.accuracyM, locStatus: "APPROX", placeId: near.placeId || p.placeId });
      else if (p.locStatus === "WAITING") await updatePhoto(p.id, { locStatus: "NONE" });
    }
  }

  async function getBlob(key) { return getOne("blobs", key); }
  async function putBlob(key, blob) { await tx(["blobs"], "readwrite", function (s) { s.blobs.put(blob, key); }); }

  // ---- Backup and restore (same zip layout as the Android app) ----

  async function backupFiles() {
    var photos = values(ALL.photos).filter(function (p) { return p.status === "READY"; });
    var data = {
      format: 2, app: "travel-journal-iphone", createdAtUtc: Date.now(), trips: values(ALL.trips),
      places: values(ALL.places), dayLogs: values(ALL.days), entries: values(ALL.entries),
      photos: photos, points: values(ALL.points),
    };
    var files = [{ name: "journal.json", data: JSON.stringify(data) }];
    var missing = 0;
    for (var p of photos) {
      var b = await getBlob("full:" + p.fileName);
      if (b) files.push({ name: "photos/" + p.fileName, data: b }); else missing++;
    }
    return { files: files, photos: photos.length - missing, missing: missing };
  }

  async function restore(zipBlob, onProgress) {
    var list = await Zip.read(zipBlob);
    var j = list.find(function (e) { return e.name === "journal.json"; });
    if (!j) throw new Error("This doesn't look like a journal backup.");
    var backup = JSON.parse(await (await j.read()).text());
    var have = new Set(), copied = 0;
    var existing = await new Promise(function (res) { open().then(function (d) { reqP(d.transaction("blobs").objectStore("blobs").getAllKeys()).then(res); }); });
    existing.forEach(function (k) { have.add(k); });
    var photoEntries = list.filter(function (e) { return !e.isDir && e.name.indexOf("photos/") === 0; });
    for (var i = 0; i < photoEntries.length; i++) {
      var e = photoEntries[i];
      var name = e.name.split("/").pop(); // never trust paths inside a zip
      if (!have.has("full:" + name)) {
        var blob = await e.read();
        await putBlob("full:" + name, new Blob([blob], { type: Photos.mimeOf(name) }));
        have.add("full:" + name);
        copied++;
      }
      if (onProgress) onProgress(i + 1, photoEntries.length);
    }
    var added = 0, updated = 0;
    // Trips: rows from a backup made before trips existed go into the trip in use.
    var tripRows = [];
    (backup.trips || []).forEach(function (t) {
      var cur = ALL.trips.get(t.id);
      if (!cur) added++; else if ((t.updatedAtUtc || 0) > (cur.updatedAtUtc || 0)) updated++; else return;
      tripRows.push(t);
    });
    var known = new Set(Array.from(ALL.trips.keys()).concat(tripRows.map(function (t) { return t.id; })));
    function fixTrip(r) {
      if (!r.tripId) r = Object.assign({}, r, { tripId: tripId() });
      if (!known.has(r.tripId)) { var t = newTripRow("Restored trip"); t.id = r.tripId; tripRows.push(t); known.add(t.id); }
      return r;
    }
    var places = [], logs = [], entries = [], photos = [], points = [];
    function merge(list, map, out, keyOf) {
      (list || []).forEach(function (r) {
        r = fixTrip(r);
        var cur = map.get(keyOf(r));
        if (!cur) added++; else if ((r.updatedAtUtc || 0) > (cur.updatedAtUtc || 0)) updated++; else return;
        out.push(r);
      });
    }
    merge(backup.places, ALL.places, places, function (r) { return r.id; });
    merge((backup.dayLogs || []).map(function (l) { return l.key ? l : Object.assign({}, l, { key: null }); }), ALL.days, logs, function (r) {
      if (!r.key) r.key = dayKey(r.tripId, r.localDate);
      return r.key;
    });
    merge(backup.entries, ALL.entries, entries, function (r) { return r.id; });
    (backup.photos || []).forEach(function (p) {
      if (!ALL.photos.has(p.id) && have.has("full:" + p.fileName)) { photos.push(Object.assign(fixTrip(p), { status: "READY" })); added++; }
    });
    (backup.points || []).forEach(function (p) { if (!ALL.points.has(p.id)) { points.push(fixTrip(p)); added++; } });
    await tx(["trips", "places", "days", "entries", "photos", "points"], "readwrite", function (s) {
      tripRows.forEach(function (r) { s.trips.put(r); });
      places.forEach(function (r) { s.places.put(r); });
      logs.forEach(function (r) { s.days.put(r); });
      entries.forEach(function (r) { s.entries.put(r); });
      photos.forEach(function (r) { s.photos.put(r); });
      points.forEach(function (r) { s.points.put(r); });
    });
    // A fresh install restoring a backup: drop the empty starter trip and open the restored one.
    var starter = trip(), restoredTrips = tripRows.filter(function (t) { return t.id !== starter.id; });
    var c = tripCounts(starter.id);
    var starterEmpty = restoredTrips.length && !c.photos && !c.places && !c.entries &&
      !values(ALL.points).some(function (p) { return p.tripId === starter.id; }) && !values(ALL.days).some(function (l) { return l.tripId === starter.id; }) &&
      !places.concat(entries, photos, points, logs).some(function (r) { return r.tripId === starter.id; });
    await load();
    if (starterEmpty) {
      var next = trips().filter(function (t) { return t.id !== starter.id; })[0];
      await switchTrip(next.id);
      await deleteTrip(starter.id);
    }
    changed();
    return { added: added, updated: updated, photosCopied: copied };
  }

  window.Store = {
    S: S, ALL: ALL, settings: settings, onChange: function (f) { listeners.push(f); },
    trip: trip, trips: trips, createTrip: createTrip, updateTrip: updateTrip, switchTrip: switchTrip, deleteTrip: deleteTrip, tripCounts: tripCounts,
    load: load, saveSettings: saveSettings, values: values,
    zone: zone, localDate: localDate, today: today, prettyDay: prettyDay, shortDay: shortDay, clock: clock, newId: newId, distanceM: distanceM, dateObj: dateObj,
    allDates: allDates, day: day, placePhotos: placePhotos, placeEntries: placeEntries, currentPlaceId: currentPlaceId,
    recordPoint: recordPoint, recentGoodFix: recentGoodFix, lastPointUtc: lastPointUtc, getFix: getFix,
    findOrCreatePlace: findOrCreatePlace, mergePlaces: mergePlaces, deletePlace: deletePlace, updatePlace: updatePlace,
    saveDayLog: saveDayLog, newEntry: newEntry, updateEntry: updateEntry, deleteEntry: deleteEntry,
    addPhoto: addPhoto, updatePhoto: updatePhoto, deletePhoto: deletePhoto, applyFixToPhoto: applyFixToPhoto,
    fillMissingPhotoLocations: fillMissingPhotoLocations, getBlob: getBlob, putBlob: putBlob,
    backupFiles: backupFiles, restore: restore,
  };
})();
