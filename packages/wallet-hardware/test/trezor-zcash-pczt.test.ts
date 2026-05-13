import { describe, expect, it } from "bun:test";
import { createPCZT, Script, ZcashConsensusBranchId, ZcashVersionGroupId } from "@swapkit/utxo-signer";

import { extractSignaturesFromSignedZcashTx } from "../src/trezor";

const signature = new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x02, 0x01]);
const pubkey = new Uint8Array([0x02, ...Array(32).fill(1)]);
const scriptPubkey = new Uint8Array([0x76, 0xa9, 0x14, ...Array(20).fill(2), 0x88, 0xac]);
const scriptSig = Script.encode([signature, pubkey]);

function uint32LE(value: number) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function uint64LE(value: bigint) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}

function compactSize(value: number) {
  return Buffer.from([value]);
}

function transparentInput(script: Uint8Array) {
  return Buffer.concat([
    Buffer.alloc(32, 1),
    uint32LE(0),
    compactSize(script.length),
    Buffer.from(script),
    uint32LE(0xffffffff),
  ]);
}

function transparentOutput() {
  return Buffer.concat([uint64LE(1n), compactSize(scriptPubkey.length), Buffer.from(scriptPubkey)]);
}

function signedZcashV4Hex() {
  return Buffer.concat([
    uint32LE(0x80000004),
    uint32LE(ZcashVersionGroupId.SAPLING),
    compactSize(1),
    transparentInput(scriptSig),
    compactSize(1),
    transparentOutput(),
    uint32LE(0),
    uint32LE(0),
    Buffer.alloc(11),
  ]).toString("hex");
}

function signedZcashV5Hex() {
  return Buffer.concat([
    uint32LE(0x80000005),
    uint32LE(ZcashVersionGroupId.NU5),
    uint32LE(ZcashConsensusBranchId.NU6_1),
    uint32LE(0),
    uint32LE(0),
    compactSize(1),
    transparentInput(scriptSig),
    compactSize(1),
    transparentOutput(),
    Buffer.from([0, 0, 0]),
  ]).toString("hex");
}

function pcztForVersion(version: 4 | 5) {
  const pczt = createPCZT({
    consensusBranchId: ZcashConsensusBranchId.NU6_1,
    expiryHeight: 0,
    lockTime: 0,
    version,
    versionGroupId: version === 5 ? ZcashVersionGroupId.NU5 : ZcashVersionGroupId.SAPLING,
  });

  pczt.addInput({ index: 0, scriptPubkey, txid: new Uint8Array(32).fill(1), value: 1n });

  return pczt;
}

describe("Trezor Zcash PCZT signing", () => {
  it("extracts signatures from signed transparent v4 transactions", async () => {
    const signedPczt = await extractSignaturesFromSignedZcashTx(signedZcashV4Hex(), pcztForVersion(4));
    const input = signedPczt.getInput(0);

    expect(input.partialSig?.[0]?.[0]).toEqual(pubkey);
    expect(input.partialSig?.[0]?.[1]).toEqual(signature);
  });

  it("extracts signatures from signed transparent v5 transactions", async () => {
    const signedPczt = await extractSignaturesFromSignedZcashTx(signedZcashV5Hex(), pcztForVersion(5));
    const input = signedPczt.getInput(0);

    expect(input.partialSig?.[0]?.[0]).toEqual(pubkey);
    expect(input.partialSig?.[0]?.[1]).toEqual(signature);
  });
});
