import { useState, useCallback } from 'react';
import type { BlockData, EnhancedBlockData } from '../types/index.js';

// Bitcoin mainnet block data from mempool.space (NOT the OPNet Signet fork)
const MEMPOOL_API = 'https://mempool.space/api';

interface MempoolBlock {
    id: string;
    height: number;
    tx_count: number;
    timestamp: number;
    difficulty: number;
    bits: number;
    nonce: number;
    size: number;
    weight: number;
    previousblockhash: string;
    mediantime: number;
    merkle_root: string;
    version: number;
    extras?: {
        coinbaseRaw?: string;
        medianFee?: number;
        feeRange?: number[];
        reward?: number;
        totalFees?: number;
    };
}

interface UseBlockDataReturn {
    blockData: BlockData | null;
    loading: boolean;
    error: string | null;
    fetchBlock: (height: bigint) => Promise<BlockData | null>;
    fetchEnhancedBlock: (hashOrHeight: string | bigint) => Promise<EnhancedBlockData | null>;
    reset: () => void;
}

export function useBlockData(): UseBlockDataReturn {
    const [blockData, setBlockData] = useState<BlockData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBlock = useCallback(async (height: bigint): Promise<BlockData | null> => {
        setLoading(true);
        setError(null);
        setBlockData(null);

        try {
            // Step 1: Get block hash by height
            const hashResponse = await fetch(`${MEMPOOL_API}/block-height/${height.toString()}`);
            if (!hashResponse.ok) {
                throw new Error(`Block ${height.toString()} not found. It may not exist yet.`);
            }
            const blockHash = await hashResponse.text();

            // Step 2: Get full block data by hash
            const blockResponse = await fetch(`${MEMPOOL_API}/block/${blockHash.trim()}`);
            if (!blockResponse.ok) {
                throw new Error(`Failed to fetch block data for hash ${blockHash}`);
            }
            const block = await blockResponse.json() as MempoolBlock;

            const totalFeesSats = block.extras?.totalFees ?? 0;
            const rewardSats = block.extras?.reward ?? 0;

            const data: BlockData = {
                blockHeight: height,
                blockHash: blockHash.trim(),
                txCount: BigInt(block.tx_count),
                timestamp: BigInt(block.timestamp),
                difficulty: BigInt(Math.round(block.difficulty)),
                blockSize: BigInt(block.size),
                blockWeight: BigInt(block.weight),
                totalFees: BigInt(Math.round(totalFeesSats)),
                blockReward: BigInt(Math.round(rewardSats)),
            };

            setBlockData(data);
            return data;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch block data';
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchEnhancedBlock = useCallback(async (hashOrHeight: string | bigint): Promise<EnhancedBlockData | null> => {
        try {
            let hash: string;
            if (typeof hashOrHeight === 'bigint') {
                const hashResponse = await fetch(`${MEMPOOL_API}/block-height/${hashOrHeight.toString()}`);
                if (!hashResponse.ok) return null;
                hash = (await hashResponse.text()).trim();
            } else {
                hash = hashOrHeight;
            }

            const blockResponse = await fetch(`${MEMPOOL_API}/block/${hash}`);
            if (!blockResponse.ok) return null;
            const block = await blockResponse.json() as MempoolBlock;

            const enhanced: EnhancedBlockData = {
                id: block.id,
                height: block.height,
                tx_count: block.tx_count,
                timestamp: block.timestamp,
                difficulty: block.difficulty,
                bits: block.bits,
                nonce: block.nonce,
                size: block.size,
                weight: block.weight,
                merkle_root: block.merkle_root,
                version: block.version,
                previousblockhash: block.previousblockhash,
                mediantime: block.mediantime,
                extras: block.extras,
            };

            return enhanced;
        } catch {
            return null;
        }
    }, []);

    const reset = useCallback((): void => {
        setBlockData(null);
        setError(null);
        setLoading(false);
    }, []);

    return { blockData, loading, error, fetchBlock, fetchEnhancedBlock, reset };
}
