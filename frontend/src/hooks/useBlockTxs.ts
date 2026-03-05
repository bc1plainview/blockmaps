import { useState, useCallback } from 'react';

const MEMPOOL_API = 'https://mempool.space/api';

interface UseBlockTxsReturn {
    txids: string[];
    loading: boolean;
    error: string | null;
    fetchTxids: (blockHash: string) => Promise<string[]>;
}

export function useBlockTxs(): UseBlockTxsReturn {
    const [txids, setTxids] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTxids = useCallback(async (blockHash: string): Promise<string[]> => {
        setLoading(true);
        setError(null);
        setTxids([]);

        try {
            // mempool.space returns all txids in a single array (no pagination for /txids)
            const response = await fetch(`${MEMPOOL_API}/block/${blockHash}/txids`);
            if (!response.ok) {
                throw new Error(`Failed to fetch txids for block ${blockHash}`);
            }
            const ids = await response.json() as string[];
            setTxids(ids);
            return ids;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch transaction IDs';
            setError(message);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    return { txids, loading, error, fetchTxids };
}
