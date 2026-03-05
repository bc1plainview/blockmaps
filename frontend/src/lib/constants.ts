import { networks } from '@btc-vision/bitcoin';

export const NETWORK = networks.opnetTestnet;
export const RPC_URL = 'https://testnet.opnet.org';

export const CONTRACT_ADDRESS = 'opt1sqq2umuzamxgewajsnnzwgvgq7fzflgjp85fy2xl8';
export const CONTRACT_ADDRESS_HEX = '0xf46b3143f90d6a4849ce301a71404114994330e01d65956e90ecf901b005edcc';

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
