import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTxDetail } from '../hooks/useTxDetail.js';
import { SankeyDiagram } from '../components/SankeyDiagram.js';
import type { TxDetail, TxInput, TxOutput } from '../types/index.js';

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

function formatTimestamp(ts: number | null): string {
    if (ts === null) return 'Unconfirmed';
    return new Date(ts * 1000).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    });
}

interface IORowProps {
    addr: string;
    value: bigint | null;
    index: number;
}

function InputRow({ addr, value, index }: IORowProps): React.ReactElement {
    return (
        <div className="io-item">
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 24, flexShrink: 0 }}>
                {index}
            </span>
            <span className="io-item-addr">{addr}</span>
            <span className="io-item-value">
                {value !== null ? satsToBtcDisplay(value) : '—'}
            </span>
        </div>
    );
}

function OutputRow({ addr, value, index }: IORowProps): React.ReactElement {
    return (
        <div className="io-item">
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 24, flexShrink: 0 }}>
                {index}
            </span>
            <span className="io-item-addr">{addr}</span>
            <span className="io-item-value" style={{ color: 'var(--accent-b)' }}>
                {value !== null ? satsToBtcDisplay(value) : '—'}
            </span>
        </div>
    );
}

function TxDetailContent({ tx, txid }: { tx: TxDetail; txid: string }): React.ReactElement {
    const totalIn = tx.vin.reduce((acc: bigint, v: TxInput) => acc + (v.prevout?.value ?? 0n), 0n);
    const totalOut = tx.vout.reduce((acc: bigint, v: TxOutput) => acc + v.value, 0n);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {[
                    { label: 'Fee', value: satsToBtcDisplay(tx.fee) },
                    { label: 'Fee Rate', value: formatFeeRate(tx.fee, tx.weight) },
                    { label: 'Size', value: `${tx.size.toLocaleString()} bytes` },
                    { label: 'Weight', value: `${tx.weight.toLocaleString()} WU` },
                    { label: 'Inputs', value: tx.vin.length.toString() },
                    { label: 'Outputs', value: tx.vout.length.toString() },
                    { label: 'Total Input', value: satsToBtcDisplay(totalIn) },
                    { label: 'Total Output', value: satsToBtcDisplay(totalOut) },
                ].map(({ label, value }) => (
                    <div
                        key={label}
                        style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-glass)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 12px',
                        }}
                    >
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                            {label}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Status */}
            <div className="glass-card" style={{ padding: 16 }}>
                <table className="meta-table">
                    <tbody>
                        <tr>
                            <td>Status</td>
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className={`status-dot ${tx.status.confirmed ? 'status-dot-green' : 'status-dot-yellow'}`} />
                                    {tx.status.confirmed ? 'Confirmed' : 'Unconfirmed / Mempool'}
                                </div>
                            </td>
                        </tr>
                        {tx.status.block_height !== null && (
                            <tr>
                                <td>Block</td>
                                <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    <Link
                                        to={`/block/${tx.status.block_height.toString()}`}
                                        style={{ color: 'var(--accent)' }}
                                    >
                                        #{tx.status.block_height.toLocaleString()}
                                    </Link>
                                </td>
                            </tr>
                        )}
                        <tr>
                            <td>Timestamp</td>
                            <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatTimestamp(tx.status.block_time)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Sankey flow */}
            <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                    BTC Flow Diagram
                </div>
                <SankeyDiagram tx={tx} />
            </div>

            {/* Inputs */}
            <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>Inputs ({tx.vin.length})</span>
                    <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {totalIn > 0n ? satsToBtcDisplay(totalIn) : 'coinbase'}
                    </span>
                </div>
                <div className="io-list">
                    {tx.vin.slice(0, 50).map((inp: TxInput, i: number) => (
                        <InputRow
                            key={i}
                            index={i}
                            addr={inp.prevout ? inp.prevout.scriptpubkey_address : 'coinbase'}
                            value={inp.prevout ? inp.prevout.value : null}
                        />
                    ))}
                    {tx.vin.length > 50 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px' }}>
                            +{tx.vin.length - 50} more inputs
                        </div>
                    )}
                </div>
            </div>

            {/* Outputs */}
            <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>Outputs ({tx.vout.length})</span>
                    <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {satsToBtcDisplay(totalOut)}
                    </span>
                </div>
                <div className="io-list">
                    {tx.vout.slice(0, 50).map((out: TxOutput, i: number) => (
                        <OutputRow
                            key={i}
                            index={i}
                            addr={out.scriptpubkey_address}
                            value={out.value}
                        />
                    ))}
                    {tx.vout.length > 50 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px' }}>
                            +{tx.vout.length - 50} more outputs
                        </div>
                    )}
                </div>
            </div>

            {/* Explorer links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Explorers
                </div>
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
                <a
                    href={`https://mempool.opnet.org/testnet4/tx/${txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="explorer-link"
                >
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M1 11L11 1M11 1H4M11 1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    View on OPNet Mempool
                </a>
            </div>
        </div>
    );
}

export function TxDetailPage(): React.ReactElement {
    const { txid } = useParams<{ txid: string }>();
    const { txDetail, loading, error, fetchTxDetail } = useTxDetail();

    useEffect(() => {
        if (txid) {
            void fetchTxDetail(txid);
        }
    }, [txid, fetchTxDetail]);

    if (!txid) {
        return (
            <div className="page">
                <div className="container" style={{ maxWidth: '900px' }}>
                    <div className="alert alert-error">Invalid transaction ID</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page page-enter">
            <div className="container" style={{ maxWidth: '900px' }}>
                {/* Back link */}
                <Link
                    to="/"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: 'var(--text-secondary)',
                        fontSize: 13,
                        marginBottom: 'var(--spacing-xl)',
                        textDecoration: 'none',
                    }}
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M11 6H1M1 6L6 1M1 6L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Home
                </Link>

                {/* Header */}
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                        Transaction
                    </h1>
                    <div className="code-text" style={{ wordBreak: 'break-all', fontSize: 12 }}>
                        {txid}
                    </div>
                </div>

                {loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="skeleton" style={{ height: 48, borderRadius: 4 }} />
                        ))}
                    </div>
                )}

                {error && !loading && (
                    <div className="alert alert-error">{error}</div>
                )}

                {txDetail && !loading && (
                    <TxDetailContent tx={txDetail} txid={txid} />
                )}
            </div>
        </div>
    );
}
