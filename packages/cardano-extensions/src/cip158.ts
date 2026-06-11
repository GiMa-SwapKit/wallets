import { CardanoExtensionError } from "./errors";
import { ensureHttpUri } from "./utils";

export const CIP158 = {
  cip: 158,
  name: "Cardano URIs - Browse Application",
} as const;

export const CIP158_AUTHORITY = "browse";
export const CIP158_VERSION = "v1";

export type Cip158BrowseUri = {
  targetUri: string;
  version: string;
};

export const createCip158BrowseUri = ({ targetUri, version = CIP158_VERSION }: { targetUri: string; version?: string }) =>
  `web+cardano://${CIP158_AUTHORITY}/${version}?uri=${encodeURIComponent(ensureHttpUri(targetUri))}`;

export const parseCip158BrowseUri = (uri: string): Cip158BrowseUri => {
  const parsed = new URL(uri);
  const targetUri = parsed.searchParams.get("uri");

  if (parsed.protocol !== "web+cardano:" || parsed.hostname !== CIP158_AUTHORITY || !parsed.pathname.startsWith(`/${CIP158_VERSION}`) || !targetUri) {
    throw new CardanoExtensionError("cardano_cip158_invalid_uri", "Invalid CIP-158 Cardano browse URI");
  }

  return {
    targetUri: ensureHttpUri(targetUri),
    version: parsed.pathname.slice(1),
  };
};

export const isCip158BrowseUri = (uri: string) => {
  try {
    parseCip158BrowseUri(uri);

    return true;
  } catch {
    return false;
  }
};

export const openCip158BrowseUri = (uri: string, target?: Pick<Location, "assign">) => {
  parseCip158BrowseUri(uri);
  const locationTarget = target ?? window.location;

  locationTarget.assign(uri);
};
