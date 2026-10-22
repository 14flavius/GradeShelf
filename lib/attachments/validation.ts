import { attachmentNameSchema } from "./rules.ts";
import { getAttachmentLimits } from "./config.ts";
import { AttachmentError } from "./errors.ts";

// Identify supported containers; never trust the browser MIME type. This is not a
// document renderer. Files are always delivered as private attachment downloads.
export function validateFile(originalName: string, bytes: Buffer) {
  const name = attachmentNameSchema.safeParse(originalName);
  if (!name.success || bytes.length === 0) {
    throw new AttachmentError("INVALID_FILE");
  }
  if (bytes.length > getAttachmentLimits().maxFileSize) {
    throw new AttachmentError("TOO_LARGE");
  }
  const extension = originalName.split(".").at(-1)?.toLowerCase();
  let mimeType: string | null = null;
  if (
    extension === "pdf" &&
    /^%PDF-(1\.[0-7]|2\.0)[\r\n]/.test(bytes.subarray(0, 16).toString("latin1")) &&
    /%%EOF\s*$/.test(bytes.subarray(-2048).toString("latin1"))
  ) {
    mimeType = "application/pdf";
  }
  if ((extension === "jpg" || extension === "jpeg") && validJpeg(bytes)) {
    mimeType = "image/jpeg";
  }
  if (extension === "png" && validPng(bytes)) {
    mimeType = "image/png";
  }
  if (extension === "webp" && validWebp(bytes)) {
    mimeType = "image/webp";
  }
  if (extension === "heic" || extension === "heif" || extension === "hif") {
    const detected = heifType(bytes);
    if (extension !== "heic" || detected === "image/heic") {
      mimeType = detected;
    }
  }
  if (!mimeType) {
    throw new AttachmentError("INVALID_FILE");
  }
  return { originalName: name.data, mimeType, size: bytes.length };
}

// Inspect bounded ISO BMFF boxes and brands, without decoding image content.
// HEIF can store its payload in mdat or in an idat child of the metadata box.
function heifType(bytes: Buffer): string | null {
  let offset = 0;
  let hasType = false;
  let heic = false;
  let heif = false;
  let metadata = false;
  let payload = false;
  while (offset < bytes.length) {
    const box = readBox(bytes, offset, bytes.length);
    if (!box) {
      return null;
    }
    if (box.type === "ftyp") {
      if (hasType || box.end - box.start < 8 || (box.end - box.start) % 4 !== 0) {
        return null;
      }
      hasType = true;
      for (let position = box.start; position < box.end; position += 4) {
        if (position === box.start + 4) {
          continue;
        } // Minor version, not a brand.
        const brand = bytes.toString("latin1", position, position + 4);
        heic ||= ["heic", "heix", "heim", "heis"].includes(brand);
        heif ||= brand === "mif1";
      }
    } else if (box.type === "meta") {
      if (metadata || box.end - box.start < 12 || bytes.readUInt32BE(box.start) !== 0) {
        return null;
      }
      metadata = true;
      let childOffset = box.start + 4;
      while (childOffset < box.end) {
        const child = readBox(bytes, childOffset, box.end);
        if (!child) {
          return null;
        }
        if (child.type === "idat" && child.end > child.start) {
          payload = true;
        }
        childOffset = child.end;
      }
    } else if (box.type === "mdat" && box.end > box.start) {
      payload = true;
    }
    offset = box.end;
  }
  if (!hasType || !metadata || !payload) {
    return null;
  }
  if (heic) {
    return "image/heic";
  }
  return heif ? "image/heif" : null;
}

function readBox(bytes: Buffer, offset: number, end: number) {
  if (end - offset < 8) {
    return null;
  }
  let size = bytes.readUInt32BE(offset);
  let headerSize = 8;
  if (size === 1) {
    if (end - offset < 16) {
      return null;
    }
    const extendedSize = bytes.readBigUInt64BE(offset + 8);
    if (extendedSize > BigInt(end - offset)) {
      return null;
    }
    size = Number(extendedSize);
    headerSize = 16;
  } else if (size === 0) {
    size = end - offset;
  }
  if (size < headerSize || size > end - offset) {
    return null;
  }
  return {
    type: bytes.toString("latin1", offset + 4, offset + 8),
    start: offset + headerSize,
    end: offset + size,
  };
}

function validPng(bytes: Buffer) {
  if (
    bytes.length < 45 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return false;
  }
  let offset = 8;
  let hasData = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    if (offset + length + 12 > bytes.length) {
      return false;
    }
    if (
      offset === 8 &&
      (type !== "IHDR" ||
        length !== 13 ||
        bytes.readUInt32BE(16) === 0 ||
        bytes.readUInt32BE(20) === 0)
    ) {
      return false;
    }
    if (type === "IDAT" && length > 0) {
      hasData = true;
    }
    if (type === "IEND") {
      return hasData && length === 0 && offset + 12 === bytes.length;
    }
    offset += length + 12;
  }
  return false;
}

function validWebp(bytes: Buffer) {
  if (
    bytes.length < 20 ||
    bytes.toString("latin1", 0, 4) !== "RIFF" ||
    bytes.toString("latin1", 8, 12) !== "WEBP" ||
    bytes.readUInt32LE(4) + 8 !== bytes.length
  ) {
    return false;
  }
  let offset = 12;
  let image = false;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString("latin1", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    if (length === 0 || offset + 8 + length > bytes.length) {
      return false;
    }
    if (["VP8 ", "VP8L", "ANMF"].includes(type)) {
      image = true;
    }
    offset += 8 + length + (length % 2);
  }
  return image && offset === bytes.length;
}

function validJpeg(bytes: Buffer) {
  if (
    bytes.length < 20 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    return false;
  }
  let offset = 2;
  let hasFrame = false;
  while (offset + 4 < bytes.length) {
    if (bytes[offset++] !== 0xff) {
      return false;
    }
    while (bytes[offset] === 0xff) {
      offset++;
    }
    const marker = bytes[offset++];
    if (marker === 0x01) {
      continue;
    }
    if (offset + 2 > bytes.length) {
      return false;
    }
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length - 2) {
      return false;
    }
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      if (
        length < 8 ||
        bytes.readUInt16BE(offset + 3) === 0 ||
        bytes.readUInt16BE(offset + 5) === 0
      ) {
        return false;
      }
      hasFrame = true;
    }
    if (marker === 0xda) {
      return hasFrame && offset + length < bytes.length - 2;
    }
    offset += length;
  }
  return false;
}
