import { CardanoExtensionError } from "./errors";

const HEX_REGEX = /^(?:0x)?[0-9a-fA-F]*$/;
const URI_SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:/i;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const stripHexPrefix = (value: string) => (value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value);

export const isHex = (value: unknown, { allowEmpty = false } = {}) => {
  if (typeof value !== "string") return false;
  const stripped = stripHexPrefix(value);

  return (allowEmpty || stripped.length > 0) && stripped.length % 2 === 0 && HEX_REGEX.test(value);
};

export const assertHex = (value: unknown, name: string, { allowEmpty = false } = {}) => {
  if (!isHex(value, { allowEmpty })) {
    throw new CardanoExtensionError("cardano_hex_invalid", `${name} must be an even-length hex string`);
  }

  return stripHexPrefix(value as string).toLowerCase();
};

export const utf8ToHex = (value: string) =>
  [...new TextEncoder().encode(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export const hexToUtf8 = (hex: string) => {
  const normalized = assertHex(hex, "hex");
  const bytes = normalized.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [];

  return new TextDecoder().decode(Uint8Array.from(bytes));
};

export const ensureHttpUri = (uri: string) => {
  const normalized = URI_SCHEME_REGEX.test(uri) ? uri : `https://${uri}`;
  const parsed = new URL(normalized);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new CardanoExtensionError("cardano_cip158_invalid_uri", "CIP-158 browse URIs only support http and https targets");
  }

  return parsed.toString();
};
