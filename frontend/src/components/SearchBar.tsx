import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const TXID_RE = /^[0-9a-fA-F]{64}$/;
const HEIGHT_RE = /^\d{1,8}$/;

export function SearchBar(): React.ReactElement {
    const [value, setValue] = useState('');
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement | null>(null);

    const handleSearch = useCallback((query: string): void => {
        const trimmed = query.trim();
        if (!trimmed) return;

        if (TXID_RE.test(trimmed)) {
            navigate(`/tx/${trimmed}`);
            setValue('');
            inputRef.current?.blur();
        } else if (HEIGHT_RE.test(trimmed)) {
            navigate(`/block/${trimmed}`);
            setValue('');
            inputRef.current?.blur();
        }
        // Silently ignore invalid input — user is still typing
    }, [navigate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'Enter') {
            handleSearch(value);
        }
        if (e.key === 'Escape') {
            setValue('');
            inputRef.current?.blur();
        }
    }, [value, handleSearch]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
        setValue(e.target.value);
    }, []);

    return (
        <div className="search-bar">
            <input
                ref={inputRef}
                type="text"
                className="search-bar-input"
                placeholder="Block height or txid..."
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                aria-label="Search by block height or transaction ID"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
            />
            <svg
                className="search-bar-icon"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
            >
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M8 8L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
        </div>
    );
}
