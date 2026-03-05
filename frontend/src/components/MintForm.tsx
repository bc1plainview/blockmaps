import React, { useState, useCallback } from 'react';
import { useWalletConnect, SupportedWallets } from '@btc-vision/walletconnect';
import { SVGPreview } from './SVGPreview.js';
import { ExplorerLinks } from './ExplorerLinks.js';
import { useBlockData } from '../hooks/useBlockData.js';
import { useMint, useIsMinted } from '../hooks/useBlockMaps.js';
import { CONTRACT_ADDRESS_HEX } from '../lib/constants.js';
import type { BlockData } from '../types/index.js';

function formatTimestamp(ts: bigint): string {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    });
}

function formatDifficulty(d: bigint): string {
    const num = Number(d);
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}G`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return num.toLocaleString();
}

function satsToBtcDisplay(sats: bigint): string {
    if (sats === 0n) return '0 BTC';
    const btc = Number(sats) / 100_000_000;
    return `${btc.toFixed(8)} BTC`;
}

interface StatCardProps {
    label: string;
    value: string;
}

function StatCard({ label, value }: StatCardProps): React.ReactElement {
    return (
        <div
            style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                flex: 1,
                minWidth: '120px',
            }}
        >
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                {label}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all' }}>
                {value}
            </div>
        </div>
    );
}

export function MintForm(): React.ReactElement {
    const { address, connectToWallet } = useWalletConnect();
    const isConnected = address !== null;
    const { loading: fetchingBlock, error: fetchError, fetchBlock, reset } = useBlockData();
    const { isMinted, checkingMinted, checkMinted } = useIsMinted();
    const { mintStatus, mintError, mintTxId, mint } = useMint();

    const [inputValue, setInputValue] = useState('');
    const [checkedBlock, setCheckedBlock] = useState<BlockData | null>(null);

    const handleCheck = useCallback(async (): Promise<void> => {
        const heightStr = inputValue.trim();
        if (!heightStr || !/^\d+$/.test(heightStr)) return;

        reset();
        setCheckedBlock(null);

        const height = BigInt(heightStr);
        const data = await fetchBlock(height);
        if (data) {
            setCheckedBlock(data);
            await checkMinted(height);
        }
    }, [inputValue, fetchBlock, checkMinted, reset]);

    const handleMint = useCallback(async (): Promise<void> => {
        if (!checkedBlock) return;
        // Pass all 9 params to new contract signature
        await mint(
            checkedBlock.blockHeight,
            checkedBlock.blockHash,
            checkedBlock.txCount,
            checkedBlock.timestamp,
            checkedBlock.difficulty,
            checkedBlock.blockSize,
            checkedBlock.blockWeight,
            checkedBlock.totalFees,
            checkedBlock.blockReward,
        );
    }, [checkedBlock, mint]);

    const handleConnect = useCallback((): void => {
        connectToWallet(SupportedWallets.OP_WALLET);
    }, [connectToWallet]);

    const isBusy = fetchingBlock || checkingMinted || mintStatus === 'simulating' || mintStatus === 'pending';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {/* Block number input */}
            <div>
                <label htmlFor="block-height-input" className="label">
                    Bitcoin Block Height
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        id="block-height-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="input-field"
                        placeholder="e.g. 500000"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isBusy) void handleCheck();
                        }}
                        disabled={isBusy}
                        aria-label="Block height to mint"
                        style={{ flex: 1 }}
                    />
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void handleCheck()}
                        disabled={isBusy || !inputValue.trim()}
                        aria-label="Check block"
                    >
                        {fetchingBlock ? 'Fetching...' : 'Check Block'}
                    </button>
                </div>
            </div>

            {/* Fetch error */}
            {fetchError && (
                <div className="alert alert-error" role="alert">
                    {fetchError}
                </div>
            )}

            {/* Block data preview */}
            {checkedBlock && (
                <div className="glass-card fade-in">
                    <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
                        {/* SVG preview */}
                        <div style={{ flexShrink: 0 }}>
                            <SVGPreview
                                blockHeight={checkedBlock.blockHeight}
                                hashHex={checkedBlock.blockHash}
                                txCount={Number(checkedBlock.txCount)}
                                size={200}
                            />
                        </div>

                        {/* Block metadata */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '200px' }}>
                            <h2
                                style={{
                                    fontSize: '20px',
                                    color: 'var(--accent)',
                                    margin: 0,
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                Block #{checkedBlock.blockHeight.toLocaleString()}
                            </h2>

                            {/* Already minted status */}
                            {isMinted !== null && (
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '12px',
                                        color: isMinted ? 'var(--text-muted)' : 'var(--green)',
                                    }}
                                >
                                    <span
                                        className={`status-dot ${isMinted ? 'status-dot-red' : 'status-dot-green'}`}
                                    />
                                    {isMinted ? 'Already minted' : 'Available to mint'}
                                </div>
                            )}

                            <div className="code-text" style={{ fontSize: '11px', wordBreak: 'break-all', lineHeight: 1.4 }}>
                                {checkedBlock.blockHash}
                            </div>

                            {/* Stats row */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <StatCard label="Transactions" value={checkedBlock.txCount.toLocaleString()} />
                                <StatCard label="Difficulty" value={formatDifficulty(checkedBlock.difficulty)} />
                                <StatCard label="Timestamp" value={formatTimestamp(checkedBlock.timestamp)} />
                            </div>

                            {/* New fields row */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <StatCard label="Size" value={`${(Number(checkedBlock.blockSize) / 1000).toFixed(1)} kB`} />
                                <StatCard label="Total Fees" value={satsToBtcDisplay(checkedBlock.totalFees)} />
                                <StatCard label="Reward" value={satsToBtcDisplay(checkedBlock.blockReward)} />
                            </div>
                        </div>
                    </div>

                    <hr className="divider" />

                    {/* Mint action area */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {!isMinted && (
                            <>
                                {!isConnected ? (
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleConnect}
                                    >
                                        Connect Wallet to Mint
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => void handleMint()}
                                        disabled={mintStatus === 'simulating' || mintStatus === 'pending' || mintStatus === 'success'}
                                    >
                                        {mintStatus === 'simulating' && 'Simulating...'}
                                        {mintStatus === 'pending' && 'Confirm in Wallet...'}
                                        {mintStatus === 'success' && 'Minted'}
                                        {(mintStatus === 'idle' || mintStatus === 'error' || mintStatus === 'fetching') && 'Mint This Block'}
                                    </button>
                                )}
                            </>
                        )}

                        {/* Mint error */}
                        {mintError && (
                            <div className="alert alert-error" role="alert">
                                {mintError}
                            </div>
                        )}

                        {/* Success with txid */}
                        {mintStatus === 'success' && mintTxId && (
                            <div className="alert alert-success">
                                <div style={{ marginBottom: '8px', fontWeight: 700 }}>
                                    Block #{checkedBlock.blockHeight.toLocaleString()} minted
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontVariantNumeric: 'tabular-nums' }}>
                                    TXID: {mintTxId}
                                </div>
                                <ExplorerLinks txid={mintTxId} contractAddress={CONTRACT_ADDRESS_HEX} />
                            </div>
                        )}

                        {/* Success without txid */}
                        {mintStatus === 'success' && !mintTxId && (
                            <div className="alert alert-success">
                                Transaction submitted. Check your wallet for status.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
