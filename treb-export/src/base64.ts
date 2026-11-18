/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along
 * with TREB. If not, see <https://www.gnu.org/licenses/>.
 *
 * Copyright 2022-2026 trebco, llc.
 * info@treb.app
 *
 */

/**
 * base64 <-> bytes. uses native Uint8Array.fromBase64 / toBase64 where
 * available, falling back to atob/btoa for older browsers. we can drop
 * the fallbacks once we no longer care about browsers that predate
 * the native methods (Chrome 140, Firefox 133, Safari 18.2).
 */

const has_native_from = 'fromBase64' in Uint8Array;
const has_native_to = 'toBase64' in Uint8Array.prototype;

/** chunk size for String.fromCharCode, to stay under argument limits */
const chunk_size = 0x8000;

export const Base64ToBytes = (data: string): Uint8Array<ArrayBuffer> => {

  if (has_native_from) {
    return Uint8Array.fromBase64(data);
  }

  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;

};

export const BytesToBase64 = (bytes: Uint8Array): string => {

  if (has_native_to) {
    return bytes.toBase64();
  }

  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunk_size) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk_size)));
  }
  return btoa(parts.join(''));

};
