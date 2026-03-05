import { useState, useCallback } from 'react';
import type { TxDetail, TxInput, TxOutput } from '../types/index.js';

const MEMPOOL_API = 'https://mempool.space/api';

interface RawVin {
    txid: string;
    vout: number;
    prevout: {
        scriptpubkey_address?: string;
        value: number;
    } | null;
    sequence: number;
}

interface RawVout {
    scriptpubkey_address?: string;
    value: number;
}

interface RawTx {
    txid: string;
    size: number;
    weight: number;
    fee: number;
    vin: RawVin[];
    vout: RawVout[];
    status: {
        confirmed: boolean;
        block_height?: number;
        block_time?: number;
    };
}

interface UseTxDetailReturn {
    txDetail: TxDetail | null;
    loading: boolean;
    error: string | null;
    fetchTxDetail: (txid: string) => Promise<TxDetail | null>;
    reset: () => void;
}

function parseVin(raw: RawVin): TxInput {
    return {
        txid: raw.txid,
        vout: raw.vout,
        prevout: raw.prevout
            ? {
                  scriptpubkey_address: raw.prevout.scriptpubkey_address ?? 'unknown',
                  value: BigInt(raw.prevout.value),
              }
            : null,
        sequence: raw.sequence,
    };
}

function parseVout(raw: RawVout): TxOutput {
    return {
        scriptpubkey_address: raw.scriptpubkey_address ?? 'OP_RETURN',
        value: BigInt(raw.value),
    };
}

export function useTxDetail(): UseTxDetailReturn {
    const [txDetail, setTxDetail] = useState<TxDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTxDetail = useCallback(async (txid: string): Promise<TxDetail | null> => {
        setLoading(true);
        setError(null);
        setTxDetail(null);

        try {
            const response = await fetch(`${MEMPOOL_API}/tx/${txid}`);
            if (!response.ok) {
                throw new Error(`Transaction ${txid} not found`);
            }
            const raw = await response.json() as RawTx;

            const detail: TxDetail = {
                txid: raw.txid,
                size: raw.size,
                weight: raw.weight,
                fee: BigInt(raw.fee),
                vin: raw.vin.map(parseVin),
                vout: raw.vout.map(parseVout),
                status: {
                    confirmed: raw.status.confirmed,
                    block_height: raw.status.block_height ?? null,
                    block_time: raw.status.block_time ?? null,
                },
            };

            setTxDetail(detail);
            return detail;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch transaction';
            setError(message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const reset = useCallback((): void => {
        setTxDetail(null);
        setError(null);
        setLoading(false);
    }, []);

    return { txDetail, loading, error, fetchTxDetail, reset };
}
