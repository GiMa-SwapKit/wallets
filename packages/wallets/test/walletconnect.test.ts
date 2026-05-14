import { describe, expect, it } from "bun:test";
import { Chain } from "@swapkit/helpers";

import { walletconnectWallet } from "../src/walletconnect";

describe("WalletConnect direct signing support", () => {
  it("marks non-EVM chains with WalletConnect signers as direct signing capable", () => {
    const directSigningSupport = walletconnectWallet.connectWalletconnect.directSigningSupport;

    expect(directSigningSupport[Chain.Cosmos]).toBe(true);
    expect(directSigningSupport[Chain.Kujira]).toBe(true);
    expect(directSigningSupport[Chain.Near]).toBe(true);
    expect(directSigningSupport[Chain.THORChain]).toBe(true);
    expect(directSigningSupport[Chain.Tron]).toBe(true);
  });
});
