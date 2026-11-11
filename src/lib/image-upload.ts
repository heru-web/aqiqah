import { ValidationError } from "@/lib/errors";

/** Determine content type from bytes; never trust a browser-provided MIME type. */
export function imageFormat(bytes: Uint8Array): { mime: string; extension: string } {
  const starts = (...signature: number[]) => signature.every((value, i) => bytes[i] === value);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", extension: "png" };
  if (starts(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", extension: "jpg" };
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { mime: "image/webp", extension: "webp" };
  throw new ValidationError("File harus berupa gambar JPEG, PNG, atau WebP yang valid.");
}
