import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTxDetail } from '../hooks/useTxDetail.js';
import { SankeyDiagram } from './SankeyDiagram.js';
import type { TxDetail } from '../types/index.js';

interface TxPanelProps {
    txid: string;
    onClose: () => void;
}

type PanelView = 'detail' | 'flow';

function satsToBtcDisplay(sats: bigint): string {
    if (sats >= 100_000_000n) {
        const btc = Number(sats) / 100_000_000;
        return `${btc.toFixed(8)} BTC`;
    }
    return `${sats.toLocaleString()} sats`;
}

function formatFeeRate(fee: bigint, weight: number): string {
    if (weight === 0) return '—';
    const vbytes = weight / 4;
    const rate = Number(fee) / vbytes;
    return `${rate.toFixed(2)} sat/vB`;
}

function TxDetailView({ tx }: { tx: TxDetail }): React.ReactElement {
    const totalIn = tx.vin.reduce((acc, v) => acc + (v.prevout?.value ?? 0n), 0n);
    const totalOut = tx.vout.reduce((acc, v) => acc + v.value, 0n);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                    { label: 'Fee', value: satsToBtcDisplay(tx.fee) },
                    { label: 'Fee Rate', value: formatFeeRate(tx.fee, tx.weight) },
                    { label: 'Size', value: `${tx.size.toLocaleString()} B` },
                    { label: 'Weight', value: `${tx.weight.toLocaleString()} WU` },
                    { label: 'Inputs', value: tx.vin.length.toString() },
                    { label: 'Outputs', value: tx.vout.length.toString() },
                ].map(({ label, value }) => (
                    <div
                        key={label}
                        style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-glass)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '8px 10px',
                        }}
                    >
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                            {label}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Confirmation status */}
            {tx.status.block_height !== null && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Confirmed in block{' '}
                    <Link
                        to={`/block/${tx.status.block_height.toString()}`}
                        style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}
                    >
                        #{tx.status.block_height.toLocaleString()}
                    </Link>
                </div>
            )}

            {/* Inputs */}
            <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                    Inputs ({tx.vin.length})
                    {totalIn > 0n && <span style={{ marginLeft: 8, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{satsToBtcDisplay(totalIn)}</span>}
                </div>
                <div className="io-list">
                    {tx.vin.slice(0, 20).map((inp, i) => (
                        <div key={i} className="io-item">
                            <span className="io-item-addr">
                                {inp.prevout ? inp.prevout.scriptpubkey_address : 'coinbase'}
                            </span>
                            <span className="io-item-value">
                                {inp.prevout ? satsToBtcDisplay(inp.prevout.value) : '—'}
                            </span>
                        </div>
                    ))}
                    {tx.vin.length > 20 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px' }}>
                            +{tx.vin.length - 20} more inputs
                        </div>
                    )}
                </div>
            </div>

            {/* Outputs */}
            <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                    Outputs ({tx.vout.length})
                    <span style={{ marginLeft: 8, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{satsToBtcDisplay(totalOut)}</span>
                </div>
                <div className="io-list">
                    {tx.vout.slice(0, 20).map((out, i) => (
                        <div key={i} className="io-item">
                            <span className="io-item-addr">{out.scriptpubkey_address}</span>
                            <span className="io-item-value">{satsToBtcDisplay(out.value)}</span>
                        </div>
                    ))}
                    {tx.vout.length > 20 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px' }}>
                            +{tx.vout.length - 20} more outputs
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function TxPanel({ txid, onClose }: TxPanelProps): React.ReactElement {
    const { txDetail, loading, error, fetchTxDetail } = useTxDetail();
    const [view, setView] = useState<PanelView>('detail');

    useEffect(() => {
        // Reset to detail view first (called inside async chain, not synchronously in effect body)
        void Promise.resolve().then(() => {
            setView('detail');
        });
        void fetchTxDetail(txid);
    }, [txid, fetchTxDetail]);

    const handleOverlayClick = useCallback((): void => {
        onClose();
    }, [onClose]);

    const handlePanelClick = useCallback((e: React.MouseEvent): void => {
        e.stopPropagation();
    }, []);

    return (
        <>
            {/* Overlay */}
            <div className="tx-panel-overlay" onClick={handleOverlayClick} aria-hidden="true" />

            {/* Panel */}
            <aside className="tx-panel" onClick={handlePanelClick} aria-label="Transaction detail panel">
                {/* Header */}
                <div className="tx-panel-header">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                            Transaction
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', fontVariantNumeric: 'tabular-nums' }}>
                            {txid.slice(0, 20)}...{txid.slice(-8)}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, flexShrink: 0 }}>
                        {/* View toggle (only when data loaded) */}
                        {txDetail && (
                            <div className="view-toggle">
                                <button
                                    type="button"
                                    className={`view-toggle-btn${view === 'detail' ? ' active' : ''}`}
                                    onClick={() => setView('detail')}
                                >
                                    Detail
                                </button>
                                <button
                                    type="button"
                                    className={`view-toggle-btn${view === 'flow' ? ' active' : ''}`}
                                    onClick={() => setView('flow')}
                                >
                                    Flow
                                </button>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border-glass)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                fontSize: 11,
                                fontFamily: "'Space Mono', monospace",
                                transition: 'border-color 150ms ease, color 150ms ease',
                            }}
                            aria-label="Close transaction panel"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="tx-panel-body">
                    {loading && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="skeleton" style={{ height: 48, borderRadius: 4 }} />
                            ))}
                        </div>
                    )}

                    {error && !loading && (
                        <div className="alert alert-error">{error}</div>
                    )}

                    {txDetail && !loading && (
                        <>
                            {view === 'detail' && <TxDetailView tx={txDetail} />}
                            {view === 'flow' && <SankeyDiagram tx={txDetail} />}

                            {/* Explorer links */}
                            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <a
                                    href={`https://mempool.space/tx/${txid}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="explorer-link"
                                >
                                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                        <path d="M1 11L11 1M11 1H4M11 1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    View on Mempool.space
                                </a>
                                <Link
                                    to={`/tx/${txid}`}
                                    style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}
                                    onClick={onClose}
                                >
                                    Open full transaction page
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </aside>
        </>
    );
}
