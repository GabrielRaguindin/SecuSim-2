/** IPv4 helpers. Leading zeros are rejected on purpose ("01.2.3.4" is ambiguous). */

const OCTET = /^(0|[1-9]\d{0,2})$/;

export function normalizeIp(value) {
  return String(value ?? '').trim();
}

export function isValidIPv4(value) {
  const parts = normalizeIp(value).split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => OCTET.test(part) && Number(part) <= 255);
}
