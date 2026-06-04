"use client";

import { WalletOption } from "@swapkit/helpers";
import type React from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { isExperimentalWallet } from "../../lib/experimental-wallets";
import { useWalletsConfig } from "../../swapkit-config-context";
import { WALLET_DISPLAY_NAMES } from "../config";
import { WalletIcon } from "../simple/wallet-icon";
import { Chip } from "./chip";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "./form";

type WalletSelectionFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = { control: Control<TFieldValues>; name: TName; label?: React.ReactNode; description?: React.ReactNode };

const WALLET_GROUPS = {
  "Browser Extensions": [
    WalletOption.BITGET,
    WalletOption.BRAVE,
    WalletOption.COINBASE_WEB,
    WalletOption.CTRL,
    WalletOption.KEEPKEY_BEX,
    WalletOption.KEPLR,
    WalletOption.LEAP,
    WalletOption.METAMASK,
    WalletOption.OKX,
    WalletOption.ONEKEY,
    WalletOption.PASSKEYS,
    WalletOption.PHANTOM,
    WalletOption.RADIX_WALLET,
    WalletOption.TALISMAN,
  ],
  "Hardware Wallets": [WalletOption.KEEPKEY, WalletOption.LEDGER, WalletOption.TREZOR],
  "Mobile Wallets": [
    WalletOption.COINBASE_MOBILE,
    WalletOption.OKX_MOBILE,
    WalletOption.TRONLINK,
    WalletOption.TRUSTWALLET_WEB,
    WalletOption.VULTISIG,
    WalletOption.WALLETCONNECT,
    WalletOption.XAMAN,
  ],
  Other: [WalletOption.KEYSTORE],
} as const;

/** Flattened list of every wallet option offered by the controls UI. */
export const ALL_CONTROLLABLE_WALLETS = Object.values(WALLET_GROUPS).flat() as readonly WalletOption[];

export function WalletSelectionField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ label, control, name, description }: WalletSelectionFieldProps<TFieldValues, TName>) {
  const { isDev } = useWalletsConfig();

  // In prod the experimental wallets are dropped from the visible/controllable
  // set entirely. In dev they stay, badged "DEV" so the wallets repo can
  // toggle them while iterating.
  const visibleWallets = isDev
    ? ALL_CONTROLLABLE_WALLETS
    : ALL_CONTROLLABLE_WALLETS.filter((w) => !isExperimentalWallet(w));

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedWallets = field.value === "all" ? visibleWallets : (field.value as WalletOption[]);
        const allSelected = field.value === "all" || selectedWallets.length === visibleWallets.length;

        const isWalletSelected = (wallet: WalletOption) =>
          field.value === "all" || (field.value as WalletOption[]).includes(wallet);

        const toggleWallet = (wallet: WalletOption) => {
          if (field.value === "all") {
            field.onChange(visibleWallets.filter((w) => w !== wallet));
            return;
          }
          const current = field.value as WalletOption[];
          if (current.includes(wallet)) {
            field.onChange(current.filter((w) => w !== wallet));
            return;
          }
          const updated = [...current, wallet];
          field.onChange(updated.length === visibleWallets.length ? "all" : updated);
        };

        const enableAll = () => field.onChange("all");
        const disableAll = () => field.onChange([]);

        return (
          <FormItem>
            {label && <FormLabel>{label}</FormLabel>}
            {description && <FormDescription>{description}</FormDescription>}

            <FormControl>
              <div className="sk-ui-flex sk-ui-flex-col sk-ui-gap-2.5">
                <div className="sk-ui-flex sk-ui-items-center sk-ui-gap-1.5 sk-ui-text-[11.5px] sk-ui-text-muted-foreground">
                  <button
                    className="sk-ui-text-foreground hover:sk-ui-underline focus-visible:sk-ui-outline-none"
                    onClick={enableAll}
                    type="button">
                    Enable all
                  </button>
                  <span aria-hidden>·</span>
                  <button
                    className="sk-ui-text-foreground hover:sk-ui-underline focus-visible:sk-ui-outline-none"
                    onClick={disableAll}
                    type="button">
                    Disable all
                  </button>
                  <span className="sk-ui-ml-auto sk-ui-tabular-nums">
                    {allSelected ? visibleWallets.length : selectedWallets.length}/{visibleWallets.length}
                  </span>
                </div>

                {Object.entries(WALLET_GROUPS).map(([groupName, wallets]) => {
                  const groupWallets = isDev ? wallets : wallets.filter((w) => !isExperimentalWallet(w));
                  if (groupWallets.length === 0) return null;
                  const groupSelectedCount = groupWallets.filter(isWalletSelected).length;

                  return (
                    <div className="sk-ui-flex sk-ui-flex-col sk-ui-gap-1.5" key={groupName}>
                      <div className="sk-ui-flex sk-ui-items-center sk-ui-text-[11px] sk-ui-font-semibold sk-ui-uppercase sk-ui-tracking-wider sk-ui-text-muted-foreground">
                        <span>{groupName}</span>
                        <span className="sk-ui-ml-auto sk-ui-tabular-nums">
                          {groupSelectedCount}/{groupWallets.length}
                        </span>
                      </div>
                      <div className="sk-ui-grid sk-ui-grid-cols-2 sk-ui-gap-1.5">
                        {groupWallets.map((wallet) => (
                          <Chip
                            className="sk-ui-w-full sk-ui-justify-start"
                            key={wallet}
                            leading={<WalletIcon className="sk-ui-size-4 sk-ui-shrink-0" wallet={wallet} />}
                            onClick={() => toggleWallet(wallet)}
                            selected={isWalletSelected(wallet)}>
                            <span className="sk-ui-inline-flex sk-ui-items-center sk-ui-gap-1">
                              {WALLET_DISPLAY_NAMES[wallet] || wallet}
                              {isDev && isExperimentalWallet(wallet) && <DevBadge />}
                            </span>
                          </Chip>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </FormControl>
          </FormItem>
        );
      }}
    />
  );
}

function DevBadge() {
  return (
    <span
      className="sk-ui-rounded sk-ui-bg-orange-500/15 sk-ui-px-1 sk-ui-py-px sk-ui-text-[9px] sk-ui-font-semibold sk-ui-uppercase sk-ui-tracking-wider sk-ui-text-orange-400"
      title="Development only — not supported in production">
      Dev
    </span>
  );
}
