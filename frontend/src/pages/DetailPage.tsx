import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { InteractiveGrid } from '../components/InteractiveGrid.js';
import { TxPanel } from '../components/TxPanel.js';
import { BlockStatsCard } from '../components/BlockStatsCard.js';
import { ExplorerLinks } from '../components/ExplorerLinks.js';
import { useGetBlockData } from '../hooks/useBlockMaps.js';
import { useBlockData } from '../hooks/useBlockData.js';
import { useBlockTxs } from '../hooks/useBlockTxs.js';
import { CONTRACT_ADDRESS_HEX } from '../lib/constants.js';
import type { EnhancedBlockData } from '../types/index.js';

function hash16ToHex(hash16: bigint): string {
    const hex = hash16.toString(16).padStart(32, '0');
    return hex.padEnd(64, '0');
}

export function DetailPage(): React.ReactElement {
    const { height } = useParams<{ height: string }>();
    const { mintedBlockData, loadingMintedData, fetchMintedBlockData } = useGetBlockData();
    const { fetchEnhancedBlock } = useBlockData();
    const { txids, loading: loadingTxs, fetchTxids } = useBlockTxs();

    const [error, setError] = useState<string | null>(null);
    const [selectedCell, setSelectedCell] = useState<number | null>(null);
    const [activeTxid, setActiveTxid] = useState<string | null>(null);
    const [enhancedBlock, setEnhancedBlock] = useState<EnhancedBlockData | null>(null);
    const [blockHash, setBlockHash] = useState<string | null>(null);

    let blockHeight: bigint = 0n;
    try {
        blockHeight = height && /^\d+$/.test(height) ? BigInt(height) : 0n;
    } catch {
        blockHeight = 0n;
    }

    useEffect(() => {
        if (blockHeight === 0n) {
            setError('Invalid block height');
            return;
        }

        void fetchMintedBlockData(blockHeight).then((data) => {
            if (!data || data.hash16 === 0n) {
                setError(`Block #${blockHeight.toString()} has not been minted yet.`);
            }
        });
    }, [blockHeight, fetchMintedBlockData]);

    // Fetch enhanced block data + txids from mempool.space
    useEffect(() => {
        if (blockHeight === 0n) return;

        void fetchEnhancedBlock(blockHeight).then((data) => {
            if (data) {
                setEnhancedBlock(data);
                setBlockHash(data.id);
                void fetchTxids(data.id);
            }
        });
    }, [blockHeight, fetchEnhancedBlock, fetchTxids]);

    const handleCellClick = useCallback((cellIndex: number): void => {
        setSelectedCell(cellIndex);

        // Determine which txid(s) this cell represents
        const txCount = mintedBlockData ? Number(mintedBlockData.txCount) : 0;
        const txsPerCell = Math.ceil(txCount / 256);
        const txStart = cellIndex * txsPerCell;
        const txid = txids[txStart] ?? null;

        if (txid) {
            setActiveTxid(txid);
        } else {
            // No txid loaded yet — open panel with first available
            setActiveTxid(null);
        }
    }, [mintedBlockData, txids]);

    const handlePanelClose = useCallback((): void => {
        setActiveTxid(null);
        setSelectedCell(null);
    }, []);

    if (loadingMintedData) {
        return (
            <div className="page">
                <div className="container" style={{ maxWidth: '1100px' }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2xl)', flexWrap: 'wrap' }}>
                        <div className="skeleton" style={{ width: '400px', height: '400px', borderRadius: '12px', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '200px' }}>
                            <div className="skeleton" style={{ height: '32px', width: '70%', borderRadius: '4px' }} />
                            <div className="skeleton" style={{ height: '200px', borderRadius: '8px' }} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !mintedBlockData) {
        return (
            <div className="page">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <Link to="/gallery" className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--spacing-lg)', display: 'inline-flex' }}>
                        Back to Gallery
                    </Link>
                    <div className="alert alert-info">
                        {error ?? 'Block not found.'}
                    </div>
                </div>
            </div>
        );
    }

    const data = mintedBlockData;
    const hashHex = blockHash ?? hash16ToHex(data.hash16);
    const txCount = Number(data.txCount);
    const txsPerCell = Math.ceil(txCount / 256);

    return (
        <div className="page page-enter" style={{ paddingBottom: 80 }}>
            <div className="container" style={{ maxWidth: '1100px' }}>
                {/* Back link */}
                <Link
                    to="/gallery"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-secondary)',
                        fontSize: '13px',
                        marginBottom: 'var(--spacing-xl)',
                        textDecoration: 'none',
                        transition: 'color 200ms ease',
                    }}
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M11 6H1M1 6L6 1M1 6L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Back to Gallery
                </Link>

                {/* Page header */}
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
                        Block #{blockHeight.toLocaleString()}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        On-chain BlockMap NFT &mdash; Click a parcel to inspect its transaction
                    </p>
                </div>

                {/* Interactive grid */}
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            District View &mdash; {txCount.toLocaleString()} transactions
                            {txsPerCell > 1 && ` (${txsPerCell} tx/parcel)`}
                        </div>
                        {loadingTxs && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loading tx data...</span>
                        )}
                    </div>

                    <div
                        style={{
                            borderRadius: '12px',
                            padding: '3px',
                            background: selectedCell !== null
                                ? 'linear-gradient(135deg, var(--accent), var(--accent-b), var(--accent-c))'
                                : 'linear-gradient(135deg, rgba(247,147,26,0.3), rgba(255,204,0,0.3), rgba(255,107,0,0.3))',
                            boxShadow: '0 0 40px var(--accent-20)',
                            transition: 'background 300ms ease',
                        }}
                    >
                        <InteractiveGrid
                            blockHeight={blockHeight}
                            hashHex={hashHex}
                            txCount={txCount}
                            txids={txids}
                            selectedCell={selectedCell}
                            onCellClick={handleCellClick}
                        />
                    </div>
                </div>

                {/* Block metadata */}
                <div style={{ display: 'flex', gap: 'var(--spacing-xl)', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 'var(--spacing-xl)' }}>
                    {/* On-chain data (from contract) */}
                    <div style={{ flex: 1, minWidth: '260px' }}>
                        <div className="glass-card">
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                                On-Chain Data
                            </div>
                            <table className="meta-table">
                                <tbody>
                                    <tr>
                                        <td>Hash (first 16B)</td>
                                        <td>
                                            <span className="code-text" style={{ fontSize: 11 }}>
                                                {hashHex.slice(0, 16)}...
                                            </span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Owner</td>
                                        <td>
                                            <span className="code-text" style={{ fontSize: 11 }}>
                                                {data.owner.slice(0, 12)}...
                                            </span>
                                        </td>
                                    </tr>
                                    {data.blockSize > 0n && (
                                        <tr>
                                            <td>Total Fees</td>
                                            <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                {(Number(data.totalFees) / 1e8).toFixed(8)} BTC
                                            </td>
                                        </tr>
                                    )}
                                    {data.blockReward > 0n && (
                                        <tr>
                                            <td>Block Reward</td>
                                            <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                {(Number(data.blockReward) / 1e8).toFixed(8)} BTC
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Explorer links */}
                        <div style={{ marginTop: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <a
                                href={`https://mempool.space/block/${hashHex}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="explorer-link"
                            >
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                    <path d="M1 11L11 1M11 1H4M11 1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                View on Mempool.space
                            </a>
                            <ExplorerLinks txid="" contractAddress={CONTRACT_ADDRESS_HEX} />
                        </div>
                    </div>

                    {/* Extended block stats from mempool.space */}
                    {enhancedBlock && (
                        <div style={{ flex: 2, minWidth: '300px' }}>
                            <BlockStatsCard data={enhancedBlock} />
                        </div>
                    )}

                    {!enhancedBlock && (
                        <div style={{ flex: 2, minWidth: '300px' }}>
                            <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
                        </div>
                    )}
                </div>
            </div>

            {/* Tx detail panel */}
            {activeTxid && (
                <TxPanel txid={activeTxid} onClose={handlePanelClose} />
            )}
        </div>
    );
}
