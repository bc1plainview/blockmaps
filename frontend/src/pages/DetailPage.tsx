import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { InteractiveGrid } from '../components/InteractiveGrid.js';
import { TxPanel } from '../components/TxPanel.js';
import { BlockStatsCard } from '../components/BlockStatsCard.js';
import { ExplorerLinks } from '../components/ExplorerLinks.js';
import { ViewToggle } from '../components/ViewToggle.js';
import { useGetBlockData } from '../hooks/useBlockMaps.js';
import { useBlockData } from '../hooks/useBlockData.js';
import { useBlockTxs } from '../hooks/useBlockTxs.js';
import { useBlockTxWeights } from '../hooks/useBlockTxWeights.js';
import { CONTRACT_ADDRESS_HEX } from '../lib/constants.js';
import { hash16ToHex } from '../lib/format.js';
import { gridDimForTxCount } from '../lib/grid-colors.js';
import type { EnhancedBlockData } from '../types/index.js';

// Lazy-loaded 3D view — excluded from the main bundle
const BlockScene3D = lazy(() => import('../components/BlockScene3D.js').then((m) => ({ default: m.BlockScene3D })));

// Skeleton shown while the 3D chunk loads
function Scene3DSkeleton(): React.ReactElement {
    return (
        <div
            className="skeleton"
            style={{
                width: '100%',
                aspectRatio: '16/9',
            }}
            aria-busy="true"
            aria-label="Loading 3D view..."
        />
    );
}

export function DetailPage(): React.ReactElement {
    const { height } = useParams<{ height: string }>();
    const { mintedBlockData, loadingMintedData, fetchMintedBlockData } = useGetBlockData();
    const { fetchEnhancedBlock } = useBlockData();
    const { txids, loading: loadingTxs, fetchTxids } = useBlockTxs();
    const { txWeights, progress: weightsProgress, feeRateRange, fetchWeights } = useBlockTxWeights();

    const [error, setError] = useState<string | null>(null);
    const [selectedCell, setSelectedCell] = useState<number | null>(null);
    const [activeTxid, setActiveTxid] = useState<string | null>(null);
    const [enhancedBlock, setEnhancedBlock] = useState<EnhancedBlockData | null>(null);
    const [blockHash, setBlockHash] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

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

    // Start fetching tx weight data once we have block hash and tx count
    useEffect(() => {
        if (blockHash && mintedBlockData && Number(mintedBlockData.txCount) > 0) {
            fetchWeights(blockHash, Number(mintedBlockData.txCount));
        }
    }, [blockHash, mintedBlockData, fetchWeights]);

    const txCount = mintedBlockData ? Number(mintedBlockData.txCount) : 0;
    const gridDim = gridDimForTxCount(txCount);
    const totalCells = gridDim * gridDim;
    const txsPerCell = Math.max(1, Math.ceil(txCount / totalCells));

    const handleCellClick = useCallback((cellIndex: number): void => {
        setSelectedCell(cellIndex);

        // In 3D mode, cellIndex maps 1:1 to transaction index.
        // In 2D mode, multiple txs may share a cell.
        let txStart: number;
        if (viewMode === '3d') {
            txStart = cellIndex;
        } else {
            txStart = cellIndex * txsPerCell;
        }
        const txid = txids[txStart] ?? null;

        if (txid) {
            setActiveTxid(txid);
        } else {
            setActiveTxid(null);
        }
    }, [txsPerCell, txids, viewMode]);

    const handlePanelClose = useCallback((): void => {
        setActiveTxid(null);
        setSelectedCell(null);
    }, []);

    if (loadingMintedData) {
        return (
            <div className="page">
                <div className="container" style={{ maxWidth: '1100px' }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2xl)', flexWrap: 'wrap' }}>
                        <div className="skeleton" style={{ width: '400px', height: '400px', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '200px' }}>
                            <div className="skeleton" style={{ height: '32px', width: '70%' }} />
                            <div className="skeleton" style={{ height: '200px' }} />
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
                        fontSize: '8px',
                        marginBottom: 'var(--spacing-xl)',
                        textDecoration: 'none',
                        fontFamily: "'Press Start 2P', cursive",
                    }}
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M11 6H1M1 6L6 1M1 6L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Back to Gallery
                </Link>

                {/* Page header */}
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h1 style={{ fontSize: '14px', color: 'var(--accent)', marginBottom: 4, fontVariantNumeric: 'tabular-nums', fontFamily: "'Press Start 2P', cursive", textShadow: '2px 2px 0 rgba(247,147,26,0.3)' }}>
                        Block #{blockHeight.toLocaleString()}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '8px', fontFamily: "'Press Start 2P', cursive" }}>
                        On-chain BlockMap NFT &mdash; Click a parcel to inspect its transactions
                    </p>
                </div>

                {/* View mode toggle row */}
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: '7px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Press Start 2P', cursive" }}>
                        District View &mdash; {txCount.toLocaleString()} transactions
                        {viewMode === '2d' && txsPerCell > 1 && ` (${txsPerCell} tx/parcel)`}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {loadingTxs && (
                            <span style={{ fontSize: '7px', color: 'var(--text-muted)', fontFamily: "'Press Start 2P', cursive" }}>Loading tx data...</span>
                        )}
                        <ViewToggle value={viewMode} onChange={setViewMode} />
                    </div>
                </div>

                {/* 3D full-width view */}
                {viewMode === '3d' && (
                    <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                        <Suspense fallback={<Scene3DSkeleton />}>
                            <BlockScene3D
                                blockHeight={blockHeight}
                                txCount={txCount}
                                txids={txids}
                                txWeights={txWeights}
                                selectedCell={selectedCell}
                                onCellClick={handleCellClick}
                            />
                        </Suspense>
                    </div>
                )}

                {/* 2D: Grid + Stats side by side */}
                {viewMode === '2d' && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-xl)', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 'var(--spacing-xl)' }}>

                        {/* Left column: Grid */}
                        <div style={{ flex: '0 1 520px', minWidth: '280px' }}>
                            <div
                                style={{
                                    padding: '3px',
                                    background: selectedCell !== null
                                        ? 'linear-gradient(135deg, var(--accent), var(--accent-b), var(--accent-c))'
                                        : 'linear-gradient(135deg, rgba(247,147,26,0.3), rgba(255,204,0,0.3), rgba(255,107,0,0.3))',
                                    boxShadow: '0 0 40px var(--accent-20)',
                                    transition: 'background 300ms step-start',
                                }}
                            >
                                <InteractiveGrid
                                    blockHeight={blockHeight}
                                    hashHex={hashHex}
                                    txCount={txCount}
                                    txids={txids}
                                    txWeights={txWeights}
                                    feeRateRange={feeRateRange}
                                    weightsProgress={weightsProgress}
                                    selectedCell={selectedCell}
                                    onCellClick={handleCellClick}
                                />
                            </div>

                            {/* Heat map legend */}
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '6px', color: 'var(--text-muted)', fontFamily: "'Press Start 2P', cursive", whiteSpace: 'nowrap' }}>
                                    LIGHT TX
                                </span>
                                <div style={{
                                    flex: 1,
                                    height: 6,
                                    background: 'linear-gradient(to right, #3d1c00, #7a3800, #cc7000, #f7931a, #ffa940, #ffcc00, #ffe066, #fff5cc)',
                                }} />
                                <span style={{ fontSize: '6px', color: 'var(--text-muted)', fontFamily: "'Press Start 2P', cursive", whiteSpace: 'nowrap' }}>
                                    HEAVY TX
                                </span>
                                <span style={{ fontSize: '6px', color: '#22c55e', fontFamily: "'Press Start 2P', cursive", marginLeft: 8, whiteSpace: 'nowrap' }}>
                                    COINBASE
                                </span>
                            </div>
                        </div>

                        {/* Right column: Block metadata + stats */}
                        <div style={{ flex: '1 1 300px', minWidth: '260px', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            {/* On-chain data (from contract) */}
                            <div className="glass-card">
                                <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: "'Press Start 2P', cursive" }}>
                                    On-Chain Data
                                </div>
                                <table className="meta-table">
                                    <tbody>
                                        <tr>
                                            <td>Hash (first 16B)</td>
                                            <td>
                                                <span className="code-text" style={{ fontSize: '7px' }}>
                                                    {hashHex.slice(0, 16)}...
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Owner</td>
                                            <td>
                                                <span className="code-text" style={{ fontSize: '7px' }}>
                                                    {data.owner.slice(0, 12)}...
                                                </span>
                                            </td>
                                        </tr>
                                        {data.totalFees > 0n && (
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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

                            {/* Extended block stats from mempool.space */}
                            {enhancedBlock && <BlockStatsCard data={enhancedBlock} />}
                            {!enhancedBlock && <div className="skeleton" style={{ height: 200 }} />}
                        </div>
                    </div>
                )}

                {/* 3D: Stats below the scene */}
                {viewMode === '3d' && (
                    <div style={{ display: 'flex', gap: 'var(--spacing-xl)', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 'var(--spacing-xl)' }}>
                        {/* On-chain data */}
                        <div style={{ flex: 1, minWidth: '260px' }}>
                            <div className="glass-card">
                                <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: "'Press Start 2P', cursive" }}>
                                    On-Chain Data
                                </div>
                                <table className="meta-table">
                                    <tbody>
                                        <tr>
                                            <td>Hash (first 16B)</td>
                                            <td>
                                                <span className="code-text" style={{ fontSize: '7px' }}>
                                                    {hashHex.slice(0, 16)}...
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Owner</td>
                                            <td>
                                                <span className="code-text" style={{ fontSize: '7px' }}>
                                                    {data.owner.slice(0, 12)}...
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
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
                        {enhancedBlock && (
                            <div style={{ flex: 2, minWidth: '300px' }}>
                                <BlockStatsCard data={enhancedBlock} />
                            </div>
                        )}
                        {!enhancedBlock && (
                            <div style={{ flex: 2, minWidth: '300px' }}>
                                <div className="skeleton" style={{ height: 200 }} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Tx detail panel */}
            {activeTxid && (
                <TxPanel txid={activeTxid} onClose={handlePanelClose} />
            )}
        </div>
    );
}
