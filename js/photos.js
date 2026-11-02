// Turning picked or captured images into stored photos: JPEG for the archive, a small thumbnail for
// lists, and a location reading. The photo is saved before any location lookup, so a slow or missing
// GPS signal never costs a picture.
(function () {
  "use strict";

  function loadImage(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("That image couldn't be opened.")); };
      img.src = url;
    });
  }

  function drawJpeg(img, maxEdge, quality) {
    var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxEdge / Math.max(w, h));
    var c = document.createElement("canvas");
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return new Promise(function (res) {
      c.toBlob(function (b) { c.width = c.height = 0; res(b); }, "image/jpeg", quality);
    });
  }

  /** Returns {full, thumb} JPEG blobs. Original JPEGs are kept untouched; HEIC and others are converted. */
  async function prepare(file) {
    var loaded = await loadImage(file);
    try {
      var keep = file.type === "image/jpeg" && file.size < 15e6;
      var full = keep ? file.slice(0, file.size, "image/jpeg") : await drawJpeg(loaded.img, 3200, 0.88);
      var thumb = await drawJpeg(loaded.img, 480, 0.8);
      return { full: full, thumb: thumb };
    } finally { URL.revokeObjectURL(loaded.url); }
  }

  function isVideo(p) { return p && p.mediaType === "VIDEO"; }
  var VIDEO_TYPES = { mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v" };
  function mimeOf(fileName) { var ext = String(fileName).split(".").pop().toLowerCase(); return VIDEO_TYPES[ext] || "image/jpeg"; }

  /** First frame (a moment in) of a clip as a JPEG, plus its length. */
  function videoFrame(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), v = document.createElement("video"), done = false;
      v.muted = true; v.playsInline = true; v.preload = "auto"; v.setAttribute("playsinline", "");
      function finish(err, out) { if (done) return; done = true; URL.revokeObjectURL(url); v.removeAttribute("src"); v.load(); err ? rej(err) : res(out); }
      var timer = setTimeout(function () { finish(null, { thumb: null, durationMs: null }); }, 15000);
      v.onloadedmetadata = function () { try { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); } catch (e) { } };
      v.onseeked = function () {
        clearTimeout(timer);
        var w = v.videoWidth, h = v.videoHeight, k = Math.min(1, 480 / Math.max(w, h || 1));
        var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        var dur = isFinite(v.duration) ? Math.round(v.duration * 1000) : null;
        c.toBlob(function (b) { finish(null, { thumb: b, durationMs: dur }); }, "image/jpeg", 0.8);
      };
      v.onerror = function () { clearTimeout(timer); finish(new Error("That video couldn't be opened.")); };
      v.src = url;
    });
  }

  async function makeThumb(fullBlob, p) {
    if (isVideo(p)) { var f = await videoFrame(fullBlob); return f.thumb; }
    var loaded = await loadImage(fullBlob);
    try { return await drawJpeg(loaded.img, 480, 0.8); } finally { URL.revokeObjectURL(loaded.url); }
  }

  var thumbUrls = new Map();
  /** Object URL for a photo's thumbnail, building and saving one if a restore brought only the full image. */
  async function thumbUrl(p) {
    if (thumbUrls.has(p.fileName)) return thumbUrls.get(p.fileName);
    var b = await Store.getBlob("thumb:" + p.fileName);
    if (!b) {
      var full = await Store.getBlob("full:" + p.fileName);
      if (!full) return "";
      b = await makeThumb(full, p);
      if (!b) return "";
      await Store.putBlob("thumb:" + p.fileName, b);
    }
    var u = URL.createObjectURL(b);
    thumbUrls.set(p.fileName, u);
    return u;
  }
  async function thumbBlob(p) {
    var b = await Store.getBlob("thumb:" + p.fileName);
    if (b) return b;
    var full = await Store.getBlob("full:" + p.fileName);
    return full ? makeThumb(full, p) : null;
  }

  /**
   * Saves each file as a photo. opts: {source: "CAMERA"|"IMPORT", date, placeId, onSaved(count)}.
   * Camera photos get a fresh location reading (shared by a burst within two minutes); imports use
   * their own EXIF location if any, otherwise the nearest logged reading.
   */
  async function addFiles(files, opts) {
    var saved = [], failed = 0, tooBig = 0;
    var place = opts.placeId ? Store.S.places.get(opts.placeId) : null;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      try {
        var video = /^video\//.test(file.type) || /\.(mov|mp4|m4v)$/i.test(file.name || "");
        if (video && file.size > MAX_VIDEO) { tooBig++; continue; }
        var exif = video ? {} : await Exif.read(file);
        var tz = Store.zone(), now = Date.now();
        var taken = opts.source === "CAMERA" ? now : (exif.takenAtUtc || file.lastModified || now);
        var date = opts.date || (opts.source === "IMPORT" && exif.localDate) || Store.localDate(taken, tz);
        var img, ext = "jpg", extra = {};
        if (video) {
          ext = /quicktime/.test(file.type) || /\.mov$/i.test(file.name || "") ? "mov" : "mp4";
          var frame = await videoFrame(file);
          img = { full: file.slice(0, file.size, VIDEO_TYPES[ext]), thumb: frame.thumb };
          extra = { mediaType: "VIDEO", durationMs: frame.durationMs };
        } else img = await prepare(file);
        var id = Store.newId();
        var row = {
          id: id, fileName: Store.newId() + "." + ext, status: "PENDING", source: opts.source,
          takenAtUtc: taken, tzId: tz, localDate: date,
          lat: place ? place.lat : null, lon: place ? place.lon : null, accuracyM: null,
          locStatus: place ? "MANUAL" : "WAITING", placeId: place ? place.id : null,
          caption: "", placeLocked: !!place,
        };
        Object.assign(row, extra);
        await Store.addPhoto(row, img.full, img.thumb);
        saved.push({ row: row, exif: exif });
        if (opts.onSaved) opts.onSaved(saved.length, files.length);
      } catch (e) {
        console.error(e);
        failed++;
      }
    }
    var located = await locate(saved, opts.source);
    return { saved: saved.length, failed: failed, tooBig: tooBig, videos: saved.filter(function (x) { return x.row.mediaType === "VIDEO"; }).length, location: located };
  }

  async function locate(saved, source) {
    var todo = saved.filter(function (s) { return !s.row.placeLocked; });
    if (!todo.length) return "manual";
    var result = "ok";
    if (source === "CAMERA") {
      var fix = Store.recentGoodFix(2 * 60e3, 100), approx = false;
      if (!fix) {
        var got = await Store.getFix(20000);
        if (got && !got.error) { fix = got; await Store.recordPoint(fix, "PHOTO", true); }
        else {
          result = got && got.error === "denied" ? "denied" : "nosignal";
          fix = Store.recentGoodFix(45 * 60e3, 1000);
          approx = true;
        }
      }
      for (var s of todo) await Store.applyFixToPhoto(s.row.id, fix, approx);
    } else {
      for (var t of todo) {
        if (t.exif.lat != null) {
          await Store.applyFixToPhoto(t.row.id, { lat: t.exif.lat, lon: t.exif.lon, accuracyM: null }, false);
        }
      }
      await Store.fillMissingPhotoLocations();
    }
    return result;
  }

  var MAX_VIDEO = 300e6;
  window.Photos = { addFiles: addFiles, thumbUrl: thumbUrl, thumbBlob: thumbBlob, isVideo: isVideo, mimeOf: mimeOf };
})();
