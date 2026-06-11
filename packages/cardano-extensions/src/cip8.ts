import type { CardanoAddressHex, Cip30Api, Cip8DataSignature, HexString } from "./types";
import { assertHex, utf8ToHex } from "./utils";

export const CIP8 = {
  cip: 8,
  name: "Message Signing",
} as const;

export type SignCip8DataParams = {
  address: CardanoAddressHex;
  api: Pick<Cip30Api, "signData">;
  payload: HexString | Uint8Array;
};

export const toCip8HexPayload = (payload: string | Uint8Array) => {
  if (typeof payload === "string") return utf8ToHex(payload);

  return [...payload].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const assertCip8DataSignature = (signature: unknown): Cip8DataSignature => {
  if (typeof signature !== "object" || signature === null || !("signature" in signature) || !("key" in signature)) {
    throw new TypeError("CIP-8 data signature must include signature and key hex fields");
  }

  const dataSignature = signature as Cip8DataSignature;

  return {
    key: assertHex(dataSignature.key, "CIP-8 COSE_Key"),
    signature: assertHex(dataSignature.signature, "CIP-8 COSE_Sign1"),
  };
};

export const signCip8Data = async ({ address, api, payload }: SignCip8DataParams) => {
  assertHex(address, "Cardano address");
  const hexPayload = payload instanceof Uint8Array ? toCip8HexPayload(payload) : assertHex(payload, "CIP-8 payload", { allowEmpty: true });
  const signature = await api.signData(address, hexPayload);

  return assertCip8DataSignature(signature);
};
