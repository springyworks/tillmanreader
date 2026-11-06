// @ts-nocheck
// TODO(typing): temporary while the original JavaScript is migrated module by module.

/*************************************************************************
 * 0.5. ZERO-DEPENDENCY PURE-JS ZIP ARCHIVE PACKAGER & VSCODE TS SCAFFOLD
 *      Generates standard PKZIP (Store method + IEEE 802.3 CRC32) in memory
 *************************************************************************/
export class SimpleZipPackager {
  constructor() {
    this.files = [];
    this.crcTable = SimpleZipPackager.buildCrc32Table();
  }

  static buildCrc32Table() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  }

  crc32(u8) {
    let crc = 0xffffffff;
    for (let i = 0; i < u8.length; i++) {
      crc = (crc >>> 8) ^ this.crcTable[(crc ^ u8[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  addFile(path, contentString) {
    const encoder = new TextEncoder();
    const nameBytes = encoder.encode(path);
    const dataBytes = encoder.encode(contentString);
    const crc = this.crc32(dataBytes);
    this.files.push({ path, nameBytes, dataBytes, crc });
  }

  generateZipBlob() {
    let localTotal = 0;
    let centralTotal = 0;
    for (const f of this.files) {
      localTotal += 30 + f.nameBytes.length + f.dataBytes.length;
      centralTotal += 46 + f.nameBytes.length;
    }
    const totalSize = localTotal + centralTotal + 22;
    const buf = new ArrayBuffer(totalSize);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);

    let localOffset = 0;
    const offsets = [];

    for (const f of this.files) {
      offsets.push(localOffset);
      // Local file header signature (0x04034b50)
      view.setUint32(localOffset, 0x04034b50, true);
      view.setUint16(localOffset + 4, 20, true); // Version needed (2.0)
      view.setUint16(localOffset + 6, 0x0800, true); // UTF-8 flag
      view.setUint16(localOffset + 8, 0, true); // Store method (0)
      view.setUint16(localOffset + 10, 0x7060, true); // DOS time
      view.setUint16(localOffset + 12, 0x5966, true); // DOS date
      view.setUint32(localOffset + 14, f.crc, true);
      view.setUint32(localOffset + 18, f.dataBytes.length, true);
      view.setUint32(localOffset + 22, f.dataBytes.length, true);
      view.setUint16(localOffset + 26, f.nameBytes.length, true);
      view.setUint16(localOffset + 28, 0, true);
      u8.set(f.nameBytes, localOffset + 30);
      u8.set(f.dataBytes, localOffset + 30 + f.nameBytes.length);
      localOffset += 30 + f.nameBytes.length + f.dataBytes.length;
    }

    let centralOffset = localOffset;
    for (let i = 0; i < this.files.length; i++) {
      const f = this.files[i];
      // Central directory file header signature (0x02014b50)
      view.setUint32(centralOffset, 0x02014b50, true);
      view.setUint16(centralOffset + 4, 20, true);
      view.setUint16(centralOffset + 6, 20, true);
      view.setUint16(centralOffset + 8, 0x0800, true);
      view.setUint16(centralOffset + 10, 0, true);
      view.setUint16(centralOffset + 12, 0x7060, true);
      view.setUint16(centralOffset + 14, 0x5966, true);
      view.setUint32(centralOffset + 16, f.crc, true);
      view.setUint32(centralOffset + 20, f.dataBytes.length, true);
      view.setUint32(centralOffset + 24, f.dataBytes.length, true);
      view.setUint16(centralOffset + 28, f.nameBytes.length, true);
      view.setUint16(centralOffset + 30, 0, true);
      view.setUint16(centralOffset + 32, 0, true);
      view.setUint16(centralOffset + 34, 0, true);
      view.setUint16(centralOffset + 36, 0, true);
      view.setUint32(centralOffset + 38, 0, true);
      view.setUint32(centralOffset + 42, offsets[i], true);
      u8.set(f.nameBytes, centralOffset + 46);
      centralOffset += 46 + f.nameBytes.length;
    }

    // End of central directory record (0x06054b50)
    view.setUint32(centralOffset, 0x06054b50, true);
    view.setUint16(centralOffset + 4, 0, true);
    view.setUint16(centralOffset + 6, 0, true);
    view.setUint16(centralOffset + 8, this.files.length, true);
    view.setUint16(centralOffset + 10, this.files.length, true);
    view.setUint32(centralOffset + 12, centralTotal, true);
    view.setUint32(centralOffset + 16, localOffset, true);
    view.setUint16(centralOffset + 20, 0, true);

    return new Blob([buf], { type: 'application/zip' });
  }
}
