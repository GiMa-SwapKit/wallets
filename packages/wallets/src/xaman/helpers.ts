import { type AssetValue, Chain, SwapKitError } from "@swapkit/helpers";
import { match } from "ts-pattern";
import type { Xumm } from "xumm";
import { sendXamanTransaction, sendXamanTrustSet } from "./walletMethods";

interface GetWalletForChainParams {
  chain: Chain;
  address: string;
  xumm: Xumm;
}

export function getWalletForChain({ xumm, chain, address }: GetWalletForChainParams) {
  return match(chain)
    .with(Chain.Ripple, async () => {
      const { getRippleToolbox } = await import("@swapkit/toolboxes/ripple");
      const toolbox = await getRippleToolbox({});

      const transfer = async ({
        assetValue,
        recipient,
        memo,
        destinationTag,
      }: {
        assetValue: AssetValue;
        recipient: string;
        memo?: string;
        destinationTag?: number;
      }) => {
        const isTokenTransfer = !assetValue.isGasAsset;

        if (isTokenTransfer && (!assetValue.ticker || !assetValue.address)) {
          throw new SwapKitError("wallet_xaman_transaction_failed");
        }

        const paymentResult = await sendXamanTransaction(xumm, {
          amount: assetValue.getValue("string"),
          destination: recipient,
          destinationTag,
          from: address,
          memo,
          ...(isTokenTransfer && { currency: assetValue.ticker, issuer: assetValue.address }),
        });

        if (!(paymentResult.result.success && paymentResult.result.transactionId)) {
          throw new SwapKitError("wallet_xaman_transaction_failed");
        }

        return paymentResult.result.transactionId;
      };

      const setTrustLine = async (params: { currency: string; issuer: string; limit: string }) => {
        const trustSetResult = await sendXamanTrustSet(xumm, { ...params, from: address });

        if (!(trustSetResult.result.success && trustSetResult.result.transactionId)) {
          throw new SwapKitError("wallet_xaman_transaction_failed");
        }

        return trustSetResult.result.transactionId;
      };

      return {
        ...toolbox,
        address,
        createAndSubscribePayment: sendXamanTransaction,
        disconnect: xumm.logout,
        getAddress: () => address,
        setTrustLine,
        transfer,
      };
    })
    .otherwise(() => {
      throw new SwapKitError("wallet_chain_not_supported", { chain, wallet: "Xaman" });
    });
}
