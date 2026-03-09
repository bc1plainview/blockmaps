import { networks } from '@btc-vision/bitcoin';

export const NETWORK = networks.opnetTestnet;
export const RPC_URL = 'https://testnet.opnet.org';

export const CONTRACT_ADDRESS = 'opt1sqz2ss945gw7jsxzu63jugtadwqahmy20k5tfmyhj';
export const CONTRACT_ADDRESS_HEX = 'opt1sqz2ss945gw7jsxzu63jugtadwqahmy20k5tfmyhj';

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
