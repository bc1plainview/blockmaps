import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletButton } from './WalletButton.js';
import { SearchBar } from './SearchBar.js';

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
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                textDecoration: 'none',
                padding: '4px 0',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 200ms ease, border-color 200ms ease',
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
                    background: 'rgba(10, 10, 26, 0.9)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderBottom: '1px solid var(--border-glass)',
                    height: '60px',
                    display: 'flex',
                    alignItems: 'center',
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
                            gap: '10px',
                            flexShrink: 0,
                        }}
                    >
                        <span
                            className="header-logo"
                            style={{
                                fontSize: '18px',
                                fontWeight: 700,
                                color: 'var(--accent)',
                                letterSpacing: '-0.02em',
                                fontVariantNumeric: 'tabular-nums',
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

                    {/* Search bar + Wallet */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <SearchBar />
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
                    borderTop: '1px solid var(--border-glass)',
                    padding: '24px var(--spacing-md)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                <p>BlockMaps &mdash; On-chain Bitcoin block NFTs on OPNet Testnet</p>
            </footer>
        </>
    );
}
