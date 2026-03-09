import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BlockMapCard } from '../components/BlockMapCard.js';
import { SkeletonCard } from '../components/SkeletonCard.js';
import { useGetBlockData } from '../hooks/useBlockMaps.js';
import { discoverMintedBlocks } from '../lib/block-discovery.js';
import { hash16ToHex } from '../lib/format.js';
import type { MintedBlockData } from '../types/index.js';

interface GalleryEntry {
    blockHeight: bigint;
    data: MintedBlockData;
}

export function GalleryPage(): React.ReactElement {
    const { fetchMintedBlockData } = useGetBlockData();
    const [entries, setEntries] = useState<GalleryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanProgress, setScanProgress] = useState<{ found: number; total: number } | null>(null);

    const [searchInput, setSearchInput] = useState('');
    const [searchHeight, setSearchHeight] = useState<bigint | null>(null);
    const [searchResult, setSearchResult] = useState<GalleryEntry | null>(null);
    const [searching, setSearching] = useState(false);
    const [notFound, setNotFound] = useState(false);

    const cancelledRef = useRef(false);

    useEffect(() => {
        cancelledRef.current = false;

        const loadGallery = async (): Promise<void> => {
            setLoading(true);
            setScanProgress(null);

            try {
                const result = await discoverMintedBlocks((found, total, partialBlocks) => {
                    if (cancelledRef.current) return;
                    setScanProgress({ found, total });
                    // Progressive rendering: show blocks as they're found
                    setEntries((prev) => {
                        const existing = new Set(prev.map((e) => e.blockHeight));
                        const newEntries = partialBlocks.filter((b) => !existing.has(b.blockHeight));
                        if (newEntries.length === 0) return prev;
                        return [...prev, ...newEntries].sort((a, b) =>
                            a.blockHeight < b.blockHeight ? -1 : a.blockHeight > b.blockHeight ? 1 : 0,
                        );
                    });
                });

                if (!cancelledRef.current) {
                    setEntries(result.blocks);
                    setScanProgress({ found: result.totalFound, total: result.totalMinted });
                    setLoading(false);
                }
            } catch {
                if (!cancelledRef.current) {
                    setLoading(false);
                }
            }
        };

        void loadGallery();
        return (): void => { cancelledRef.current = true; };
    }, []);

    const handleSearch = useCallback(async (): Promise<void> => {
        const str = searchInput.trim();
        if (!str || !/^\d+$/.test(str)) return;

        setSearching(true);
        setSearchResult(null);
        setNotFound(false);

        const height = BigInt(str);
        setSearchHeight(height);

        const data = await fetchMintedBlockData(height);
        if (data && data.hash16 !== 0n) {
            setSearchResult({ blockHeight: height, data });
        } else {
            setNotFound(true);
        }
        setSearching(false);
    }, [searchInput, fetchMintedBlockData]);

    return (
        <div className="page">
            <div className="container">
                <div style={{ marginBottom: 'var(--spacing-2xl)' }}>
                    <h1
                        style={{
                            fontSize: '28px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            marginBottom: '8px',
                        }}
                    >
                        Gallery
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                        Minted BlockMaps on OPNet Testnet.
                    </p>
                </div>

                {/* Search by block height */}
                <div className="glass-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h2
                        style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: 'var(--spacing-md)',
                        }}
                    >
                        Search by Block Height
                    </h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="input-field"
                            placeholder="e.g. 500000"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !searching) void handleSearch();
                            }}
                            disabled={searching}
                            aria-label="Search block height"
                            style={{ maxWidth: '260px' }}
                        />
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => void handleSearch()}
                            disabled={searching || !searchInput.trim()}
                        >
                            {searching ? 'Searching...' : 'Search'}
                        </button>
                    </div>

                    {notFound && searchHeight !== null && (
                        <p
                            style={{
                                marginTop: '12px',
                                color: 'var(--text-muted)',
                                fontSize: '13px',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            Block #{searchHeight.toLocaleString()} has not been minted yet.
                        </p>
                    )}

                    {searchResult && (
                        <div style={{ marginTop: 'var(--spacing-md)', maxWidth: '280px' }}>
                            <BlockMapCard
                                blockHeight={searchResult.blockHeight}
                                hashHex={hash16ToHex(searchResult.data.hash16)}
                                txCount={Number(searchResult.data.txCount)}
                                owner={searchResult.data.owner}
                                timestamp={searchResult.data.timestamp}
                            />
                        </div>
                    )}
                </div>

                {/* Scan progress */}
                {loading && scanProgress && (
                    <p
                        style={{
                            color: 'var(--text-muted)',
                            fontSize: '12px',
                            marginBottom: 'var(--spacing-md)',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        Scanning... found {scanProgress.found} / {scanProgress.total} minted blocks
                    </p>
                )}

                {/* Completeness warning */}
                {!loading && scanProgress && scanProgress.found < scanProgress.total && (
                    <p
                        style={{
                            color: 'var(--accent, #f7931a)',
                            fontSize: '12px',
                            marginBottom: 'var(--spacing-md)',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        Showing {scanProgress.found} of {scanProgress.total} minted blocks.
                        Use search to find specific blocks by height.
                    </p>
                )}

                {/* Gallery grid */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '16px',
                    }}
                >
                    {loading && entries.length === 0 ? (
                        <SkeletonCard count={6} />
                    ) : entries.length === 0 && !loading ? (
                        <div
                            style={{
                                gridColumn: '1 / -1',
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                padding: 'var(--spacing-2xl)',
                                fontSize: '14px',
                            }}
                        >
                            No BlockMaps minted yet. Be the first.
                        </div>
                    ) : (
                        entries.map(({ blockHeight, data }) => (
                            <BlockMapCard
                                key={blockHeight.toString()}
                                blockHeight={blockHeight}
                                hashHex={hash16ToHex(data.hash16)}
                                txCount={Number(data.txCount)}
                                owner={data.owner}
                                timestamp={data.timestamp}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
