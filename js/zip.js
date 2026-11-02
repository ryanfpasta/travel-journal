// Minimal zip writer and reader. Writing stores files uncompressed (photos are already JPEG), which
// keeps memory low on the phone. Reading handles stored and deflated entries, so Android backups
// (whose journal.json is deflated) restore here too.
(function () {
  "use strict";

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  async function toBytes(data) {
    if (typeof data === "string") return new TextEncoder().encode(data);
    if (data instanceof Uint8Array) return data;
    return new Uint8Array(await data.arrayBuffer());
  }

  /** files: [{name, data: Blob | Uint8Array | string}]. Returns a Blob. */
  async function write(files, onProgress) {
    var parts = [], central = [], offset = 0, now = dosTime(new Date());
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var bytes = await toBytes(f.data);
      var crc = crc32(bytes);
      var name = new TextEncoder().encode(f.name);
      var size = bytes.length;
      if (offset + size > 0xfffffff0) throw new Error("This zip would be over 4 GB. Back up in smaller pieces.");

      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true); // UTF-8 names
      lh.setUint16(8, 0, true); // stored
      lh.setUint16(10, now.time, true);
      lh.setUint16(12, now.date, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true);
      lh.setUint32(22, size, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      // Keep the original Blob for big files so the browser can page it from disk.
      parts.push(lh.buffer, name, f.data instanceof Blob ? f.data : bytes);

      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, now.time, true);
      ch.setUint16(14, now.date, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, size, true);
      ch.setUint32(24, size, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);

      offset += 30 + name.length + size;
      if (onProgress) onProgress(i + 1, files.length);
    }
    var cdSize = central.reduce(function (s, p) { return s + p.byteLength; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: "application/zip" });
  }

  /** Lists entries of a zip Blob: [{name, read(): Promise<Blob>}]. Uses the central directory. */
  async function read(blob) {
    var tailLen = Math.min(blob.size, 65557);
    var tail = new DataView(await blob.slice(blob.size - tailLen).arrayBuffer());
    var eocd = -1;
    for (var i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("This file isn't a zip.");
    var count = tail.getUint16(eocd + 10, true);
    var cdSize = tail.getUint32(eocd + 12, true);
    var cdOffset = tail.getUint32(eocd + 16, true);
    var cd = new DataView(await blob.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
    var out = [], p = 0, dec = new TextDecoder();
    for (var n = 0; n < count; n++) {
      if (cd.getUint32(p, true) !== 0x02014b50) throw new Error("This zip looks damaged.");
      var method = cd.getUint16(p + 10, true);
      var compSize = cd.getUint32(p + 20, true);
      var nameLen = cd.getUint16(p + 28, true);
      var extraLen = cd.getUint16(p + 30, true);
      var commentLen = cd.getUint16(p + 32, true);
      var local = cd.getUint32(p + 42, true);
      var name = dec.decode(new Uint8Array(cd.buffer, p + 46, nameLen));
      out.push(entry(blob, name, method, compSize, local));
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  function entry(blob, name, method, compSize, local) {
    return {
      name: name,
      isDir: name.endsWith("/"),
      read: async function () {
        var lh = new DataView(await blob.slice(local, local + 30).arrayBuffer());
        var start = local + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
        var raw = blob.slice(start, start + compSize);
        if (method === 0) return raw;
        if (method === 8) {
          if (typeof DecompressionStream === "undefined") throw new Error("Please update iOS to restore this backup.");
          return await new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
        }
        throw new Error("Unsupported zip compression in " + name);
      },
    };
  }

  window.Zip = { write: write, read: read, crc32: crc32 };
})();
