import { networks } from '@btc-vision/bitcoin';

export const NETWORK = networks.opnetTestnet;
export const RPC_URL = 'https://testnet.opnet.org';

export const CONTRACT_ADDRESS = 'opt1sqqs68ez7hh5rv9sntu4l7ar43yhpyftkwu3xejju';
export const CONTRACT_ADDRESS_HEX = '0xef3d4470307b797796e296759737e39bd6c3d00efb22e434bd6c3aedb070ced7';

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
