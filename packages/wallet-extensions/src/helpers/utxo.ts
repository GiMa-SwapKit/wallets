import { base64, hex } from "@scure/base";
import { Transaction } from "@swapkit/utxo-signer";

export type UtxoTransaction = InstanceType<typeof Transaction>;

export function getUtxoInputIndexes(tx: Pick<UtxoTransaction, "inputsLength">) {
  return Array.from({ length: tx.inputsLength }, (_, index) => index);
}

export function getPsbtBytes(tx: Pick<UtxoTransaction, "toPSBT">, psbtVersion?: number) {
  return psbtVersion === undefined ? tx.toPSBT() : tx.toPSBT(psbtVersion);
}

export function getPsbtBase64(tx: Pick<UtxoTransaction, "toPSBT">, psbtVersion?: number) {
  return base64.encode(getPsbtBytes(tx, psbtVersion));
}

export function getPsbtHex(tx: Pick<UtxoTransaction, "toPSBT">, psbtVersion?: number) {
  return hex.encode(getPsbtBytes(tx, psbtVersion));
}

export function getInputsToSign({ address, tx }: { address: string; tx: Pick<UtxoTransaction, "inputsLength"> }) {
  return [{ address, signingIndexes: getUtxoInputIndexes(tx) }];
}

export function getSignInputsByAddress({
  address,
  tx,
}: {
  address: string;
  tx: Pick<UtxoTransaction, "inputsLength">;
}) {
  return { [address]: getUtxoInputIndexes(tx) };
}

export function transactionFromPsbtBytes(psbt: Uint8Array) {
  return Transaction.fromPSBT(psbt);
}

export function transactionFromPsbtBase64(psbt: string) {
  return transactionFromPsbtBytes(base64.decode(psbt));
}

export function transactionFromPsbtHex(psbt: string) {
  return transactionFromPsbtBytes(hex.decode(psbt));
}
