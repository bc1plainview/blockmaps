import { useState, useCallback, useRef, useEffect } from 'react';

const MEMPOOL_API = 'https://mempool.space/api';
const PAGE_SIZE = 25; // mempool.space returns 25 txs per page
const PARALLEL_BATCH = 15; // fetch 15 pages in parallel at once
const BATCH_DELAY_MS = 100; // delay between parallel batches to avoid rate limiting

export interface TxWeightData {
    fee: number;    // sats
    weight: number; // weight units
    size: number;   // bytes
}

interface UseBlockTxWeightsReturn {
    /** Sparse array: txWeights[txIndex] = data or undefined if not yet fetched */
    txWeights: (TxWeightData | null)[];
    /** 0-100 progress percentage */
    progress: number;
    loading: boolean;
    /** Min/max fee rates across all fetched txs (for normalization) */
    feeRateRange: { min: number; max: number };
    /** Start fetching weights for a block */
    fetchWeights: (blockHash: string, txCount: number) => void;
}

export function useBlockTxWeights(): UseBlockTxWeightsReturn {
    const [txWeights, setTxWeights] = useState<(TxWeightData | null)[]>([]);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(false);
    const [feeRateRange, setFeeRateRange] = useState<{ min: number; max: number }>({ min: 1, max: 100 });
    const abortRef = useRef<AbortController | null>(null);

    // Clean up on unmount
    useEffect(() => {
        return (): void => {
            abortRef.current?.abort();
        };
    }, []);

    const fetchWeights = useCallback((blockHash: string, txCount: number): void => {
        // Abort previous fetch
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setProgress(0);
        setTxWeights(new Array(txCount).fill(null));

        const totalPages = Math.ceil(txCount / PAGE_SIZE);
        let fetchedPages = 0;
        let allMin = Infinity;
        let allMax = 0;

        const fetchPage = async (pageIndex: number): Promise<void> => {
            if (controller.signal.aborted) return;

            const startIndex = pageIndex * PAGE_SIZE;
            const url = `${MEMPOOL_API}/block/${blockHash}/txs/${startIndex}`;

            try {
                const resp = await fetch(url, { signal: controller.signal });
                if (!resp.ok) return;

                const txs = await resp.json() as Array<{
                    fee?: number;
                    weight?: number;
                    size?: number;
                }>;

                if (controller.signal.aborted) return;

                const pageData: { index: number; data: TxWeightData }[] = [];
                for (let i = 0; i < txs.length; i++) {
                    const tx = txs[i];
                    const fee = tx.fee ?? 0;
                    const weight = tx.weight ?? 0;
                    const size = tx.size ?? 0;
                    const feeRate = weight > 0 ? fee / (weight / 4) : 0;

                    if (feeRate > 0) {
                        if (feeRate < allMin) allMin = feeRate;
                        if (feeRate > allMax) allMax = feeRate;
                    }

                    pageData.push({
                        index: startIndex + i,
                        data: { fee, weight, size },
                    });
                }

                // Batch state update
                setTxWeights((prev) => {
                    const next = [...prev];
                    for (const { index, data } of pageData) {
                        next[index] = data;
                    }
                    return next;
                });

                fetchedPages++;
                setProgress(Math.round((fetchedPages / totalPages) * 100));
                setFeeRateRange({ min: allMin === Infinity ? 1 : allMin, max: allMax || 100 });
            } catch {
                // Aborted or network error — silently skip
            }
        };

        // Fetch in parallel batches
        const runBatches = async (): Promise<void> => {
            for (let batch = 0; batch < totalPages; batch += PARALLEL_BATCH) {
                if (controller.signal.aborted) break;

                const pageIndices: number[] = [];
                for (let i = batch; i < Math.min(batch + PARALLEL_BATCH, totalPages); i++) {
                    pageIndices.push(i);
                }

                await Promise.all(pageIndices.map((idx) => fetchPage(idx)));

                // Small delay between batches to avoid rate limiting
                if (batch + PARALLEL_BATCH < totalPages && !controller.signal.aborted) {
                    await new Promise<void>((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
                }
            }

            if (!controller.signal.aborted) {
                setLoading(false);
            }
        };

        void runBatches();
    }, []);

    return { txWeights, progress, loading, feeRateRange, fetchWeights };
}
