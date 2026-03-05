export interface BlockData {
    blockHeight: bigint;
    blockHash: string;
    txCount: bigint;
    timestamp: bigint;
    difficulty: bigint;
    blockSize: bigint;
    blockWeight: bigint;
    totalFees: bigint;
    blockReward: bigint;
}

export interface MintedBlockData {
    hash16: bigint;
    txCount: bigint;
    timestamp: bigint;
    difficulty: bigint;
    owner: string;
    blockSize: bigint;
    blockWeight: bigint;
    totalFees: bigint;
    blockReward: bigint;
}

export interface TxInput {
    txid: string;
    vout: number;
    prevout: {
        scriptpubkey_address: string;
        value: bigint;
    } | null;
    sequence: number;
}

export interface TxOutput {
    scriptpubkey_address: string;
    value: bigint;
}

export interface TxStatus {
    confirmed: boolean;
    block_height: number | null;
    block_time: number | null;
}

export interface TxDetail {
    txid: string;
    size: number;
    weight: number;
    fee: bigint;
    vin: TxInput[];
    vout: TxOutput[];
    status: TxStatus;
}

export interface MempoolBlockSummary {
    id: string;
    height: number;
    tx_count: number;
    timestamp: number;
    size: number;
    weight: number;
    difficulty: number;
    extras?: {
        medianFee?: number;
        totalFees?: number;
        reward?: number;
    };
}

export interface EnhancedBlockData {
    id: string;
    height: number;
    tx_count: number;
    timestamp: number;
    difficulty: number;
    bits: number;
    nonce: number;
    size: number;
    weight: number;
    merkle_root: string;
    version: number;
    previousblockhash: string;
    mediantime: number;
    extras?: {
        medianFee?: number;
        feeRange?: number[];
        reward?: number;
        totalFees?: number;
    };
}

export interface TxResult {
    txid: string;
    success: boolean;
}

export type MintStatus = 'idle' | 'fetching' | 'simulating' | 'pending' | 'success' | 'error';
