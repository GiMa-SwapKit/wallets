"use client";

import { AssetValue } from "@swapkit/helpers";
import { Loader2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { useModal } from "../../hooks/use-modal";
import { getTokenLogoUrl } from "../config";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

export interface ApprovalConfirmDialogProps {
  tokenAsset: string;
  amount: string;
  spenderAddress: string;
  isWaiting?: boolean;
  onApproveClick?: () => Promise<void>;
}

export const ApprovalConfirmDialog = ({
  tokenAsset,
  amount,
  spenderAddress,
  isWaiting: externalIsWaiting = false,
  onApproveClick,
}: ApprovalConfirmDialogProps) => {
  const modal = useModal();
  const [internalIsWaiting, setInternalIsWaiting] = useState(false);

  const isWaiting = externalIsWaiting || internalIsWaiting;

  const { tokenTicker, tokenLogoUrl, truncatedSpenderAddress } = useMemo(() => {
    const assetValue = AssetValue.from({ asset: tokenAsset });
    const tokenTicker = assetValue.ticker;
    const tokenLogoUrl = getTokenLogoUrl(tokenAsset);
    const truncatedSpenderAddress = `${spenderAddress.slice(0, 6)}...${spenderAddress.slice(-4)}`;

    return { tokenLogoUrl, tokenTicker, truncatedSpenderAddress };
  }, [tokenAsset, spenderAddress]);

  const handleApprove = async () => {
    if (onApproveClick) {
      setInternalIsWaiting(true);
      try {
        await onApproveClick();
        modal.resolve({ confirmed: true, data: undefined });
      } catch (error) {
        setInternalIsWaiting(false);
        throw error;
      }
    } else {
      modal.resolve({ confirmed: true, data: undefined });
    }
  };

  return (
    <Dialog {...modal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Token</DialogTitle>
        </DialogHeader>

        <div className="sk-ui-flex sk-ui-flex-col sk-ui-items-center sk-ui-gap-4 sk-ui-py-4">
          <img alt={tokenTicker} className="sk-ui-size-12 sk-ui-rounded-full sk-ui-bg-primary" src={tokenLogoUrl} />

          <div className="sk-ui-text-center">
            <span className="sk-ui-font-bold sk-ui-text-xl sk-ui-text-foreground">
              {amount} {tokenTicker}
            </span>
          </div>

          <div className="sk-ui-flex sk-ui-flex-col sk-ui-items-center sk-ui-gap-1 sk-ui-text-muted-foreground">
            {isWaiting ? (
              <>
                <Loader2Icon className="sk-ui-h-6 sk-ui-w-6 sk-ui-animate-spin sk-ui-text-primary" />
                <span className="sk-ui-text-sm">Waiting for confirmation...</span>
              </>
            ) : (
              <>
                <span className="sk-ui-text-sm">Approving for contract:</span>
                <span className="sk-ui-font-mono sk-ui-text-sm sk-ui-text-foreground">{truncatedSpenderAddress}</span>
              </>
            )}
          </div>
        </div>

        <Button disabled={isWaiting} onClick={handleApprove} variant="primary">
          {isWaiting ? "Confirming..." : "Approve"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
