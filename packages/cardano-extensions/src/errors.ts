export type CardanoExtensionErrorCode =
  | "cardano_cip158_invalid_uri"
  | "cardano_cip30_api_invalid"
  | "cardano_cip30_extension_missing"
  | "cardano_cip30_wallet_not_found"
  | "cardano_cip45_invalid_identifier"
  | "cardano_cip45_rpc_method_not_found"
  | "cardano_hex_invalid";

export class CardanoExtensionError extends Error {
  code: CardanoExtensionErrorCode;

  constructor(code: CardanoExtensionErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "CardanoExtensionError";
    this.code = code;
    this.cause = cause;
  }
}
