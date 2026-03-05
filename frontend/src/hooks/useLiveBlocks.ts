import { useState, useEffect, useCallback } from 'react';
import type { MempoolBlockSummary } from '../types/index.js';

const MEMPOOL_API = 'https://mempool.space/api';
const POLL_INTERVAL_MS = 30_000;

interface RawBlock {
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

interface UseLiveBlocksReturn {
    blocks: MempoolBlockSummary[];
    loading: boolean;
    error: string | null;
    lastUpdated: number | null;
    refresh: () => void;
}

async function fetchLatestBlocks(): Promise<MempoolBlockSummary[]> {
    const response = await fetch(`${MEMPOOL_API}/blocks`);
    if (!response.ok) {
        throw new Error('Failed to fetch latest blocks');
    }
    const raw = await response.json() as RawBlock[];
    return raw.map((b) => ({
        id: b.id,
        height: b.height,
        tx_count: b.tx_count,
        timestamp: b.timestamp,
        size: b.size,
        weight: b.weight,
        difficulty: b.difficulty,
        extras: b.extras,
    }));
}

export function useLiveBlocks(): UseLiveBlocksReturn {
    const [blocks, setBlocks] = useState<MempoolBlockSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const [tick, setTick] = useState(0);

    const refresh = useCallback((): void => {
        setTick((t) => t + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;

        void Promise.resolve().then(() => {
            if (!cancelled) setLoading(true);
        });

        fetchLatestBlocks()
            .then((fetched) => {
                if (!cancelled) {
                    setBlocks((prev) => {
                        const existingIds = new Set(prev.map((b) => b.id));
                        const newBlocks = fetched.filter((b) => !existingIds.has(b.id));
                        if (newBlocks.length === 0) return prev;
                        // Prepend new blocks, keep top 10 by height
                        const merged = [...newBlocks, ...prev];
                        merged.sort((a, b) => b.height - a.height);
                        return merged.slice(0, 10);
                    });
                    setLastUpdated(Date.now());
                    setError(null);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : 'Failed to fetch blocks';
                    setError(message);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return (): void => {
            cancelled = true;
        };
    }, [tick]);

    // Auto-poll every 30 seconds
    useEffect((): (() => void) => {
        const interval = setInterval((): void => {
            setTick((t) => t + 1);
        }, POLL_INTERVAL_MS);
        return (): void => clearInterval(interval);
    }, []);

    return { blocks, loading, error, lastUpdated, refresh };
}
