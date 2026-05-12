import { afterEach, describe, expect, mock, test } from "bun:test";
import { Chain } from "@swapkit/helpers";
import { extractTCLikeTransferIntent } from "../src/helpers/tclikeTransferIntent";
import { keepkeyBexWallet } from "../src/keepkey-bex";
import { vultisigWallet } from "../src/vultisig";

const thorDepositTx = {
  fee: { gas: "500000000" },
  memo: "=:ETH.ETH:0xabc",
  msgs: [
    {
      typeUrl: "/types.MsgDeposit",
      value: {
        coins: [{ amount: "123456789", asset: { chain: "THOR", symbol: "RUNE", synth: false, ticker: "RUNE" } }],
        memo: "=:ETH.ETH:0xabc",
        signer: "thor1sender",
      },
    },
  ],
};

describe("extractTCLikeTransferIntent", () => {
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  });

  test("converts THORChain deposit transactions into provider params", () => {
    const intent = extractTCLikeTransferIntent({ chain: Chain.THORChain, tx: thorDepositTx });

    expect(intent).toMatchObject({
      amount: { amount: 123456789, decimals: 8 },
      asset: { chain: "THOR", symbol: "RUNE", ticker: "RUNE" },
      from: "thor1sender",
      gasLimit: "500000000",
      memo: "=:ETH.ETH:0xabc",
      method: "deposit",
      recipient: "",
    });
  });

  test("converts base64 Maya deposit signer bytes to bech32", () => {
    const intent = extractTCLikeTransferIntent({
      chain: Chain.Maya,
      tx: {
        fee: { gas: "500000000" },
        memo: "=:BTC.BTC:bc1qrecipient",
        msgs: [
          {
            typeUrl: "/types.MsgDeposit",
            value: {
              coins: [{ amount: "1800000000", asset: { chain: "MAYA", symbol: "CACAO", ticker: "CACAO" } }],
              memo: "=:BTC.BTC:bc1qrecipient",
              signer: "nlf3C5LoXHB9Z3muFI3zB1i6lq8=",
            },
          },
        ],
      },
    });

    expect(intent.from).toBe("maya1netlwzujapw8qlt80xhpfr0nqavt494074s0ze");
    expect(intent.amount).toEqual({ amount: 1800000000, decimals: 8 });
    expect(intent.asset).toEqual({ chain: "MAYA", symbol: "CACAO", ticker: "CACAO" });
  });

  test("converts THORChain transfer transactions into provider params", () => {
    const intent = extractTCLikeTransferIntent({
      chain: Chain.THORChain,
      tx: {
        fee: { gas: "500000000" },
        memo: "memo",
        msgs: [
          {
            typeUrl: "/types.MsgSend",
            value: {
              amount: [{ amount: "200000000", denom: "rune" }],
              fromAddress: "thor1sender",
              toAddress: "thor1recipient",
            },
          },
        ],
      },
    });

    expect(intent).toMatchObject({
      amount: { amount: 200000000, decimals: 8 },
      asset: { chain: "THOR", symbol: "RUNE", ticker: "RUNE" },
      from: "thor1sender",
      gasLimit: "500000000",
      memo: "memo",
      method: "transfer",
      recipient: "thor1recipient",
    });
  });

  test("submits KeepKey BEX THORChain deposits through signAndBroadcastTransaction", async () => {
    const requests: unknown[] = [];

    // @ts-expect-error test window shim
    globalThis.window = {
      keepkey: {
        thorchain: {
          request: (request: unknown, cb?: (err: unknown, result: unknown) => void) => {
            requests.push(request);
            if (cb) {
              cb(null, "0xhash");
              return;
            }

            return Promise.resolve(["thor1sender"]);
          },
        },
      },
    };

    const addChain = mock(() => {});
    const connectKeepkeyBex = keepkeyBexWallet.connectKeepkeyBex.connectWallet({ addChain });

    await connectKeepkeyBex([Chain.THORChain]);

    const walletMethods = addChain.mock.calls[0]?.[0] as
      | { signAndBroadcastTransaction?: (tx: typeof thorDepositTx) => Promise<string> }
      | undefined;

    await expect(walletMethods?.signAndBroadcastTransaction?.(thorDepositTx)).resolves.toBe("0xhash");

    expect(requests).toEqual([
      { method: "request_accounts", params: [] },
      {
        method: "deposit",
        params: [
          {
            amount: { amount: 123456789, decimals: 8 },
            asset: { chain: "THOR", symbol: "RUNE", ticker: "RUNE" },
            from: "thor1sender",
            gasLimit: "500000000",
            memo: "=:ETH.ETH:0xabc",
            recipient: "",
          },
        ],
      },
    ]);
  });

  test("submits Vultisig THORChain deposits through signAndBroadcastTransaction", async () => {
    const requests: unknown[] = [];

    // @ts-expect-error test window shim
    globalThis.window = {
      vultisig: {
        thorchain: {
          request: (request: unknown, cb?: (err: unknown, result: unknown) => void) => {
            requests.push(request);
            if (cb) {
              cb(null, "0xhash");
              return;
            }

            return Promise.resolve(["thor1sender"]);
          },
        },
      },
    };

    const addChain = mock(() => {});
    const connectVultisig = vultisigWallet.connectVultisig.connectWallet({ addChain });

    await connectVultisig([Chain.THORChain]);

    const walletMethods = addChain.mock.calls[0]?.[0] as
      | { signAndBroadcastTransaction?: (tx: typeof thorDepositTx) => Promise<string> }
      | undefined;

    await expect(walletMethods?.signAndBroadcastTransaction?.(thorDepositTx)).resolves.toBe("0xhash");

    expect(requests).toEqual([
      { method: "request_accounts", params: [] },
      {
        method: "deposit_transaction",
        params: [
          {
            amount: { amount: 123456789, decimals: 8 },
            asset: { chain: "THOR", symbol: "RUNE", ticker: "RUNE" },
            data: "=:ETH.ETH:0xabc",
            from: "thor1sender",
            gasLimit: "500000000",
            to: "",
          },
        ],
      },
    ]);
  });

  test("marks KeepKey BEX and Vultisig THORChain and Maya direct signing as available", () => {
    expect(keepkeyBexWallet.connectKeepkeyBex.directSigningSupport[Chain.THORChain]).toBe(true);
    expect(keepkeyBexWallet.connectKeepkeyBex.directSigningSupport[Chain.Maya]).toBe(true);
    expect(vultisigWallet.connectVultisig.directSigningSupport[Chain.THORChain]).toBe(true);
    expect(vultisigWallet.connectVultisig.directSigningSupport[Chain.Maya]).toBe(true);
  });
});
