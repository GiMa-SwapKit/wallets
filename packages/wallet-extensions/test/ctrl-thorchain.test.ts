import { afterEach, describe, expect, test } from "bun:test";
import { Chain } from "@swapkit/helpers";
import { convertThorchainTransactionToCtrlParams, signCtrlThorchainTransaction } from "../src/ctrl/walletHelpers";

describe("convertThorchainTransactionToCtrlParams", () => {
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
  });

  test("converts THORChain deposit transactions for CTRL", () => {
    const params = convertThorchainTransactionToCtrlParams(
      {
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
      },
      Chain.THORChain,
    );

    expect(params).toEqual({
      amount: { amount: 123456789, decimals: 8 },
      asset: { chain: "THOR", symbol: "RUNE", ticker: "RUNE" },
      from: "thor1sender",
      gasLimit: "500000000",
      memo: "=:ETH.ETH:0xabc",
      recipient: "",
    });
  });

  test("converts THORChain transfer transactions for CTRL", () => {
    const params = convertThorchainTransactionToCtrlParams(
      {
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
      Chain.THORChain,
    );

    expect(params).toEqual({
      amount: { amount: 200000000, decimals: 8 },
      asset: { chain: "THOR", symbol: "RUNE", ticker: "RUNE" },
      from: "thor1sender",
      gasLimit: "500000000",
      memo: "memo",
      recipient: "thor1recipient",
    });
  });

  test("submits deposit transactions through the CTRL THORChain provider", async () => {
    const requests: unknown[] = [];

    // @ts-expect-error test window shim
    globalThis.window = {
      ctrl: {
        thorchain: {
          request: (request: unknown, cb: (err: unknown, result: unknown) => void) => {
            requests.push(request);
            if ((request as { method?: string }).method === "request_accounts") {
              cb(null, ["thor1sender"]);
              return;
            }
            cb(null, "0xhash");
          },
        },
      },
    };

    await expect(
      signCtrlThorchainTransaction(
        {
          fee: { gas: "500000000" },
          memo: "=:ETH.ETH:0xabc",
          msgs: [
            {
              typeUrl: "/types.MsgDeposit",
              value: {
                coins: [
                  { amount: "123456789", asset: { chain: "THOR", symbol: "RUNE", synth: false, ticker: "RUNE" } },
                ],
                memo: "=:ETH.ETH:0xabc",
                signer: "thor1sender",
              },
            },
          ],
        },
        Chain.THORChain,
      ),
    ).resolves.toBe("0xhash");

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
});
