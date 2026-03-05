import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletButton } from './WalletButton.js';
import { SearchBar } from './SearchBar.js';
import { MuteToggle } from './MuteToggle.js';
import { CRTOverlay } from './CRTOverlay.js';

interface LayoutProps {
    children: React.ReactNode;
}

interface NavLinkProps {
    to: string;
    children: React.ReactNode;
    isActive: boolean;
}

function NavLink({ to, children, isActive }: NavLinkProps): React.ReactElement {
    return (
        <Link
            to={to}
            style={{
                fontSize: '9px',
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                textDecoration: 'none',
                padding: '4px 0',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 80ms step-start, border-color 80ms step-start',
                fontFamily: "'Press Start 2P', cursive",
            }}
        >
            {children}
        </Link>
    );
}

export function Layout({ children }: LayoutProps): React.ReactElement {
    const location = useLocation();

    return (
        <>
            {/* Fixed glow orbs */}
            <div className="glow-orb glow-orb-pink" aria-hidden="true" />
            <div className="glow-orb glow-orb-cyan" aria-hidden="true" />
            <div className="glow-orb glow-orb-purple" aria-hidden="true" />

            {/* Header */}
            <header
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    background: 'rgba(5, 5, 16, 0.96)',
                    borderBottom: '2px solid var(--border-glass)',
                    boxShadow: '0 2px 0 rgba(247,147,26,0.1)',
                    height: '60px',
                    display: 'flex',
                    alignItems: 'center',
                    imageRendering: 'pixelated',
                }}
            >
                <div
                    className="container"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        gap: 16,
                    }}
                >
                    {/* Logo */}
                    <Link
                        to="/"
                        style={{
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0,
                        }}
                    >
                        <span
                            className="header-logo"
                            style={{
                                fontSize: '12px',
                                fontWeight: 400,
                                color: 'var(--accent)',
                                letterSpacing: '0.02em',
                                fontVariantNumeric: 'tabular-nums',
                                fontFamily: "'Press Start 2P', cursive",
                                textShadow: '2px 2px 0 rgba(247,147,26,0.3)',
                            }}
                        >
                            BlockMaps
                        </span>
                    </Link>

                    {/* Nav */}
                    <nav
                        className="main-nav"
                        aria-label="Main navigation"
                    >
                        <NavLink to="/" isActive={location.pathname === '/'}>Mint</NavLink>
                        <NavLink to="/gallery" isActive={location.pathname === '/gallery'}>Gallery</NavLink>
                        <NavLink to="/my" isActive={location.pathname === '/my'}>My Maps</NavLink>
                    </nav>

                    {/* Search bar + Mute + Wallet */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <SearchBar />
                        <MuteToggle />
                        <WalletButton />
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main style={{ position: 'relative', zIndex: 1 }}>
                {children}
            </main>

            {/* Footer */}
            <footer
                style={{
                    borderTop: '2px solid var(--border-glass)',
                    boxShadow: '0 -2px 0 rgba(247,147,26,0.05)',
                    padding: '20px var(--spacing-md)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '8px',
                    position: 'relative',
                    zIndex: 1,
                    fontFamily: "'Press Start 2P', cursive",
                    letterSpacing: '0.04em',
                }}
            >
                <p>BlockMaps &mdash; On-chain Bitcoin block NFTs on OPNet Testnet</p>
            </footer>

            {/* CRT overlay — last child, pointer-events: none */}
            <CRTOverlay />
        </>
    );
}
