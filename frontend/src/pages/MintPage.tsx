import React, { useEffect, useState } from 'react';
import { MintForm } from '../components/MintForm.js';
import { LiveBlockFeed } from '../components/LiveBlockFeed.js';
import { useTotalMinted } from '../hooks/useBlockMaps.js';

export function MintPage(): React.ReactElement {
    const { totalMinted, loadingTotal, fetchTotalMinted } = useTotalMinted();
    const [hasLoaded, setHasLoaded] = useState(false);

    useEffect(() => {
        void fetchTotalMinted().then(() => setHasLoaded(true));
    }, [fetchTotalMinted]);

    return (
        <div className="page">
            <div className="container">
                {/* Hero section */}
                <section
                    style={{ textAlign: 'center', marginBottom: 'var(--spacing-2xl)' }}
                    aria-labelledby="hero-title"
                >
                    <h1
                        id="hero-title"
                        className="neon-glow"
                        style={{
                            fontSize: 'clamp(32px, 6vw, 64px)',
                            fontWeight: 700,
                            color: 'var(--accent)',
                            marginBottom: '16px',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        BlockMaps
                    </h1>
                    <p
                        style={{
                            fontSize: 'clamp(14px, 2vw, 18px)',
                            color: 'var(--text-secondary)',
                            maxWidth: '560px',
                            margin: '0 auto 24px',
                            lineHeight: 1.7,
                        }}
                    >
                        On-chain Bitcoin block NFTs. Each block hash becomes a unique synthwave grid,
                        stored forever on OPNet. Explore transactions, view BTC flow, claim your block.
                    </p>

                    {/* Stats */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div className="stat-badge">
                            {loadingTotal || !hasLoaded ? (
                                <span className="skeleton" style={{ display: 'inline-block', width: '60px', height: '14px', borderRadius: '3px' }} />
                            ) : (
                                <strong data-numeric style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {totalMinted !== null ? totalMinted.toLocaleString() : '—'}
                                </strong>
                            )}
                            &nbsp;blocks minted
                        </div>
                        <div className="stat-badge">
                            OPNet Testnet
                        </div>
                    </div>
                </section>

                {/* Main layout: mint form + live feed */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)',
                        gap: 'var(--spacing-2xl)',
                        alignItems: 'flex-start',
                        maxWidth: '1100px',
                        margin: '0 auto',
                    }}
                    className="mint-layout"
                >
                    {/* Left: Mint form */}
                    <div>
                        <section aria-labelledby="mint-section-title">
                            <h2
                                id="mint-section-title"
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    marginBottom: 'var(--spacing-lg)',
                                }}
                            >
                                Mint a Block
                            </h2>
                            <MintForm />
                        </section>

                        {/* How it works */}
                        <section
                            style={{ marginTop: 'var(--spacing-2xl)' }}
                            aria-labelledby="how-it-works-title"
                        >
                            <h2
                                id="how-it-works-title"
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    marginBottom: 'var(--spacing-lg)',
                                }}
                            >
                                How It Works
                            </h2>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                                {[
                                    { step: '01', title: 'Enter block height', desc: 'Pick any Bitcoin block by number.' },
                                    { step: '02', title: 'Fetch real data', desc: 'Block hash, tx count, size, fees, and difficulty pulled from Bitcoin mainnet.' },
                                    { step: '03', title: 'Preview the art', desc: 'A synthwave grid is generated from the block hash bytes.' },
                                    { step: '04', title: 'Mint on-chain', desc: 'Your wallet signs the transaction. First to mint claims the block forever.' },
                                    { step: '05', title: 'Explore the district', desc: 'Click parcels in the interactive grid to inspect individual transactions and BTC flows.' },
                                ].map(({ step, title, desc }) => (
                                    <div
                                        key={step}
                                        className="glass-card"
                                        style={{ padding: '16px' }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '28px',
                                                fontWeight: 700,
                                                color: 'var(--accent)',
                                                opacity: 0.3,
                                                marginBottom: '8px',
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {step}
                                        </div>
                                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                            {title}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            {desc}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Right: Live block feed */}
                    <div>
                        <LiveBlockFeed />
                    </div>
                </div>
            </div>
        </div>
    );
}
