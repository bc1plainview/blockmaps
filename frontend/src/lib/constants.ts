import { networks } from '@btc-vision/bitcoin';

export const NETWORK = networks.opnetTestnet;
export const RPC_URL = 'https://testnet.opnet.org';

export const CONTRACT_ADDRESS = 'opt1sqr40v6232gwhwtf2jwmr7a3r9au2q25ykqd3cnrj';
export const CONTRACT_ADDRESS_HEX = '0x00eaf66951521d772d2a93b63f76232f78a02a84b0';

export const MEMPOOL_BASE = 'https://mempool.opnet.org/testnet4';
export const OPSCAN_BASE = 'https://opscan.org';

export function mempoolTxUrl(txid: string): string {
    return `${MEMPOOL_BASE}/tx/${txid}`;
}

export function opscanAddressUrl(hexAddress: string): string {
    return `${OPSCAN_BASE}/accounts/${hexAddress}?network=op_testnet`;
}

export function mempoolBlockUrl(height: bigint): string {
    return `${MEMPOOL_BASE}/block/${height.toString()}`;
}
