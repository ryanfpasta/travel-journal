// Reads the few EXIF fields the journal needs from a JPEG: when it was taken and, if the phone
// kept it, where. Anything unreadable just returns {} and the app falls back to other clues.
(function () {
  "use strict";

  async function read(file) {
    try {
      var buf = await file.slice(0, 256 * 1024).arrayBuffer();
      var v = new DataView(buf);
      if (v.getUint16(0) !== 0xffd8) return {};
      var p = 2;
      while (p + 4 < v.byteLength) {
        var marker = v.getUint16(p), len = v.getUint16(p + 2);
        if (marker === 0xffe1 && v.getUint32(p + 4) === 0x45786966) return parseTiff(v, p + 10);
        if ((marker & 0xff00) !== 0xff00) break;
        p += 2 + len;
      }
    } catch (e) { /* not a JPEG we can read */ }
    return {};
  }

  function parseTiff(v, t) {
    var le = v.getUint16(t) === 0x4949;
    function u16(o) { return v.getUint16(t + o, le); }
    function u32(o) { return v.getUint32(t + o, le); }
    function ifd(o) {
      var tags = {}, n = u16(o);
      for (var i = 0; i < n; i++) {
        var e = o + 2 + i * 12;
        tags[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 };
      }
      return tags;
    }
    function ascii(tag) {
      if (!tag) return null;
      var at = tag.count > 4 ? u32(tag.at) : tag.at, s = "";
      for (var i = 0; i < tag.count - 1; i++) s += String.fromCharCode(v.getUint8(t + at + i));
      return s;
    }
    function rationals(tag) {
      if (!tag) return null;
      var at = u32(tag.at), out = [];
      for (var i = 0; i < tag.count; i++) out.push(u32(at + i * 8) / (u32(at + i * 8 + 4) || 1));
      return out;
    }
    var res = {};
    var ifd0 = ifd(u32(4));
    if (ifd0[0x8769]) {
      var ex = ifd(u32(ifd0[0x8769].at));
      var dt = ascii(ex[0x9003]) || ascii(ifd0[0x0132]);
      var off = ascii(ex[0x9011]);
      var m = dt && dt.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
      if (m) {
        res.localDate = m[1] + "-" + m[2] + "-" + m[3];
        var iso = m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + m[6];
        var ms = Date.parse(off && /^[+-]\d\d:\d\d$/.test(off) ? iso + off : iso);
        if (!isNaN(ms)) res.takenAtUtc = ms;
      }
    }
    if (ifd0[0x8825]) {
      var g = ifd(u32(ifd0[0x8825].at));
      var lat = rationals(g[2]), lon = rationals(g[4]);
      if (lat && lon) {
        var la = lat[0] + lat[1] / 60 + lat[2] / 3600, lo = lon[0] + lon[1] / 60 + lon[2] / 3600;
        if (String.fromCharCode(v.getUint8(t + g[1].at)) === "S") la = -la;
        if (String.fromCharCode(v.getUint8(t + g[3].at)) === "W") lo = -lo;
        if (la || lo) { res.lat = la; res.lon = lo; }
      }
    }
    return res;
  }

  window.Exif = { read: read };
})();
