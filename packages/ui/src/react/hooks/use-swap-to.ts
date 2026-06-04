import { SwapKitApi } from "@swapkit/helpers/api";
import { useEffect, useRef } from "react";
import { captureWidgetError } from "../sentry";
import { useSwapKitStore } from "../swapkit-context";

export function useSwapTo(sellAsset: string | undefined) {
  const { swapToSellAsset, setSwapToData, setIsFetchingSwapTo, isFetchingSwapTo } = useSwapKitStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!sellAsset || sellAsset === swapToSellAsset) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchSwapTo = async () => {
      setIsFetchingSwapTo(true);
      try {
        const response = await SwapKitApi.getSwapTo({ sellAsset });

        if (controller.signal.aborted) return;

        setSwapToData(response.buyAssets, sellAsset);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("[SwapKit] Failed to fetch swap-to assets:", error);
        captureWidgetError(error, { category: "api", extra: { sellAsset }, tags: { endpoint: "swapTo" } });
      } finally {
        if (!controller.signal.aborted) {
          setIsFetchingSwapTo(false);
        }
      }
    };

    void fetchSwapTo();

    return () => {
      controller.abort();
    };
  }, [sellAsset, swapToSellAsset, setSwapToData, setIsFetchingSwapTo]);

  return { isFetchingSwapTo };
}
