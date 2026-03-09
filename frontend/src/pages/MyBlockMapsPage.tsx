import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useWalletConnect, SupportedWallets } from '@btc-vision/walletconnect';
import { BlockMapCard } from '../components/BlockMapCard.js';
import { SkeletonCard } from '../components/SkeletonCard.js';
import { discoverOwnedBlocks } from '../lib/block-discovery.js';
import { hash16ToHex } from '../lib/format.js';
import type { MintedBlockData } from '../types/index.js';

interface OwnedEntry {
    blockHeight: bigint;
    data: MintedBlockData;
}

export function MyBlockMapsPage(): React.ReactElement {
    const { address, walletAddress, hashedMLDSAKey, connectToWallet } = useWalletConnect();
    const isConnected = address !== null;
    const [ownedBlocks, setOwnedBlocks] = useState<OwnedEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [scanProgress, setScanProgress] = useState<{ found: number; total: number } | null>(null);
    const cancelledRef = useRef(false);

    const ownerKey: string = hashedMLDSAKey ?? '';

    const loadOwnedBlocks = useCallback(async (): Promise<void> => {
        if (!ownerKey) return;
        setLoading(true);
        setOwnedBlocks([]);
        setScanProgress(null);
        cancelledRef.current = false;

        try {
            const results = await discoverOwnedBlocks(ownerKey, (found, total) => {
                if (!cancelledRef.current) {
                    setScanProgress({ found, total });
                }
            });

            if (!cancelledRef.current) {
                setOwnedBlocks(results);
            }
        } catch {
            // Discovery failed
        } finally {
            if (!cancelledRef.current) {
                setLoading(false);
            }
        }
    }, [ownerKey]);

    useEffect(() => {
        if (isConnected && ownerKey) {
            void loadOwnedBlocks();
        }
        return (): void => { cancelledRef.current = true; };
    }, [isConnected, ownerKey, loadOwnedBlocks]);

    const handleConnect = useCallback((): void => {
        connectToWallet(SupportedWallets.OP_WALLET);
    }, [connectToWallet]);

    if (!isConnected || !walletAddress) {
        return (
            <div className="page">
                <div
                    className="container"
                    style={{ maxWidth: '600px', textAlign: 'center', paddingTop: 'var(--spacing-2xl)' }}
                >
                    <h1
                        style={{
                            fontSize: '28px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            marginBottom: '12px',
                        }}
                    >
                        My BlockMaps
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
                        Connect your wallet to see your BlockMaps.
                    </p>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleConnect}
                    >
                        Connect Wallet
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div style={{ marginBottom: 'var(--spacing-2xl)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <h1
                            style={{
                                fontSize: '28px',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginBottom: '4px',
                            }}
                        >
                            My BlockMaps
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                            {walletAddress}
                        </p>
                    </div>
                    <Link to="/" className="btn btn-primary btn-sm">
                        Mint New Block
                    </Link>
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
                        Scanning... checked {scanProgress.found} / {scanProgress.total} minted blocks
                    </p>
                )}

                {loading && !scanProgress ? (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                            gap: '16px',
                        }}
                    >
                        <SkeletonCard count={4} />
                    </div>
                ) : !loading && ownedBlocks.length === 0 ? (
                    <div
                        style={{
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            padding: 'var(--spacing-2xl)',
                            fontSize: '14px',
                        }}
                    >
                        <p style={{ marginBottom: '16px' }}>You have not minted any BlockMaps yet.</p>
                        <Link to="/" className="btn btn-primary">
                            Mint Your First Block
                        </Link>
                    </div>
                ) : !loading ? (
                    <>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--spacing-lg)', fontVariantNumeric: 'tabular-nums' }}>
                            {ownedBlocks.length} BlockMap{ownedBlocks.length !== 1 ? 's' : ''} found
                        </p>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                gap: '16px',
                            }}
                        >
                            {ownedBlocks.map(({ blockHeight, data }) => (
                                <BlockMapCard
                                    key={blockHeight.toString()}
                                    blockHeight={blockHeight}
                                    hashHex={hash16ToHex(data.hash16)}
                                    txCount={Number(data.txCount)}
                                    owner={data.owner}
                                    timestamp={data.timestamp}
                                />
                            ))}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
