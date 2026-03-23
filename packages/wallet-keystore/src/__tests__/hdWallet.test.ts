import { describe, expect, it } from "bun:test";
import { Chain } from "@swapkit-dev/helpers";
import type { DerivedAddress } from "@swapkit-dev/toolboxes";
import { createKeystoreWallet } from "../index";

const TEST_PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

type WalletWithHD = {
  deriveAddresses: (params: { count: number; startIndex?: number; change?: boolean }) => DerivedAddress[];
  getExtendedPublicKey: () => string | undefined;
  deriveAddressAtIndex: (params: { index: number; change?: boolean }) => DerivedAddress | undefined;
  scanForAddresses: (params?: { gapLimit?: number; change?: boolean }) => Promise<DerivedAddress[]>;
  address: string;
};

describe("Keystore HD Wallet Integration", () => {
  describe("deriveAddresses", () => {
    it("should derive multiple BTC addresses", async () => {
      const wallets = await createKeystoreWallet({ chains: [Chain.Bitcoin], phrase: TEST_PHRASE });
      const btcWallet = wallets[Chain.Bitcoin] as unknown as WalletWithHD;

      expect(btcWallet.deriveAddresses).toBeDefined();

      const addresses = btcWallet.deriveAddresses({ count: 5 });
      expect(addresses).toHaveLength(5);

      const uniqueAddresses = new Set(addresses.map((a: DerivedAddress) => a.address));
      expect(uniqueAddresses.size).toBe(5);

      for (const addr of addresses) {
        expect(addr.address.startsWith("bc1")).toBe(true);
        expect(addr.pubkey).toBeString();
      }
    });

    it("should derive addresses with startIndex", async () => {
      const wallets = await createKeystoreWallet({ chains: [Chain.Bitcoin], phrase: TEST_PHRASE });
      const btcWallet = wallets[Chain.Bitcoin] as unknown as WalletWithHD;

      const addresses = btcWallet.deriveAddresses({ count: 3, startIndex: 10 });

      expect(addresses).toHaveLength(3);
      expect(addresses[0]?.index).toBe(10);
      expect(addresses[1]?.index).toBe(11);
      expect(addresses[2]?.index).toBe(12);
    });

    it("should derive change addresses", async () => {
      const wallets = await createKeystoreWallet({ chains: [Chain.Bitcoin], phrase: TEST_PHRASE });
      const btcWallet = wallets[Chain.Bitcoin] as unknown as WalletWithHD;

      const receiveAddresses = btcWallet.deriveAddresses({ change: false, count: 3, startIndex: 0 });
      const changeAddresses = btcWallet.deriveAddresses({ change: true, count: 3, startIndex: 0 });

      expect(receiveAddresses[0]?.address).not.toBe(changeAddresses[0]?.address);

      for (const addr of changeAddresses) {
        expect(addr.change).toBe(true);
      }
    });

    it("should throw RangeError for invalid count", async () => {
      const wallets = await createKeystoreWallet({ chains: [Chain.Bitcoin], phrase: TEST_PHRASE });
      const btcWallet = wallets[Chain.Bitcoin] as unknown as WalletWithHD;

      expect(() => btcWallet.deriveAddresses({ count: 0 })).toThrow(RangeError);
      expect(() => btcWallet.deriveAddresses({ count: -1 })).toThrow(RangeError);
      expect(() => btcWallet.deriveAddresses({ count: 1001 })).toThrow(RangeError);
    });

    it("should throw RangeError for invalid startIndex", async () => {
      const wallets = await createKeystoreWallet({ chains: [Chain.Bitcoin], phrase: TEST_PHRASE });
      const btcWallet = wallets[Chain.Bitcoin] as unknown as WalletWithHD;

      expect(() => btcWallet.deriveAddresses({ count: 1, startIndex: -1 })).toThrow(RangeError);
      expect(() => btcWallet.deriveAddresses({ count: 1, startIndex: -100 })).toThrow(RangeError);
    });
  });

  describe("getExtendedPublicKey", () => {
    it("should expose xpub from toolbox", async () => {
      const wallets = await createKeystoreWallet({ chains: [Chain.Bitcoin], phrase: TEST_PHRASE });
      const btcWallet = wallets[Chain.Bitcoin] as unknown as WalletWithHD;

      const xpub = btcWallet.getExtendedPublicKey();

      expect(xpub).toBeDefined();
      expect(xpub).toBeString();
    });
  });

  describe("deriveAddressAtIndex", () => {
    it("should expose primitive from toolbox", async () => {
      const wallets = await createKeystoreWallet({ chains: [Chain.Bitcoin], phrase: TEST_PHRASE });
      const btcWallet = wallets[Chain.Bitcoin] as unknown as WalletWithHD;

      const derived = btcWallet.deriveAddressAtIndex({ index: 0 });

      expect(derived).toBeDefined();
      expect(derived?.address).toBe(btcWallet.address);
    });
  });

  describe("multiple UTXO chains", () => {
    it("should add HD methods to all UTXO chains", async () => {
      const wallets = await createKeystoreWallet({
        chains: [Chain.Bitcoin, Chain.Litecoin, Chain.Dogecoin],
        phrase: TEST_PHRASE,
      });

      const btcWallet = wallets[Chain.Bitcoin] as unknown as WalletWithHD;
      const ltcWallet = wallets[Chain.Litecoin] as unknown as WalletWithHD;
      const dogeWallet = wallets[Chain.Dogecoin] as unknown as WalletWithHD;

      expect(btcWallet.deriveAddresses).toBeDefined();
      expect(btcWallet.getExtendedPublicKey).toBeDefined();

      expect(ltcWallet.deriveAddresses).toBeDefined();
      expect(ltcWallet.getExtendedPublicKey).toBeDefined();

      expect(dogeWallet.deriveAddresses).toBeDefined();
      expect(dogeWallet.getExtendedPublicKey).toBeDefined();
    });

    it("should derive correct address formats per chain", async () => {
      const wallets = await createKeystoreWallet({
        chains: [Chain.Bitcoin, Chain.Litecoin, Chain.Dogecoin],
        phrase: TEST_PHRASE,
      });

      const btcWallet = wallets[Chain.Bitcoin] as unknown as WalletWithHD;
      const ltcWallet = wallets[Chain.Litecoin] as unknown as WalletWithHD;
      const dogeWallet = wallets[Chain.Dogecoin] as unknown as WalletWithHD;

      const btcAddr = btcWallet.deriveAddresses({ count: 1 })[0];
      const ltcAddr = ltcWallet.deriveAddresses({ count: 1 })[0];
      const dogeAddr = dogeWallet.deriveAddresses({ count: 1 })[0];

      expect(btcAddr?.address.startsWith("bc1")).toBe(true);
      expect(ltcAddr?.address.startsWith("ltc1")).toBe(true);
      expect(dogeAddr?.address.startsWith("D")).toBe(true);
    });
  });

  describe("non-UTXO chains", () => {
    it("should NOT add HD methods to EVM chains", async () => {
      const wallets = await createKeystoreWallet({ chains: [Chain.Ethereum], phrase: TEST_PHRASE });

      const ethWallet = wallets[Chain.Ethereum] as unknown as WalletWithHD;
      expect(ethWallet.deriveAddresses).toBeUndefined();
    });
  });
});
