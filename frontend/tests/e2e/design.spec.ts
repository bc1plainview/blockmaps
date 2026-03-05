import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { test, expect } from './fixtures';

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);

// Navigate from frontend/tests/e2e -> frontend -> loop-onchain-bitmaps -> artifacts
const SCREENSHOT_DIR = path.resolve(
    __dir,
    '../../..',                                              // -> loop-onchain-bitmaps/
    '.claude/loop/sessions/onchain-bitmaps/artifacts/testing/screenshots'
);

function ensureScreenshotDir(): void {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
}

// ─── Pixel Cards ─────────────────────────────────────────────────────────────

test('[design] pixel cards use solid borders and pixel shadows', async ({ page }) => {
    await page.goto('/gallery');
    await page.waitForLoadState('domcontentloaded');

    const hasPixelBorders = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets);
        for (const sheet of sheets) {
            try {
                const rules = Array.from(sheet.cssRules);
                for (const rule of rules) {
                    if (rule instanceof CSSStyleRule) {
                        if (
                            rule.selectorText?.includes('.glass-card') &&
                            rule.style.border &&
                            rule.style.boxShadow
                        ) {
                            return true;
                        }
                    }
                }
            } catch {
                // Cross-origin
            }
        }
        return false;
    });
    expect(hasPixelBorders, '.glass-card missing pixel border or box-shadow').toBe(true);
});

// ─── No Hardcoded Colors (< threshold) ──────────────────────────────────────

test('[design] CSS uses custom properties, not hardcoded hex colors', async ({ page }) => {
    await page.goto('/');

    const hardcodedCount = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets);
        let count = 0;
        for (const sheet of sheets) {
            try {
                const rules = Array.from(sheet.cssRules);
                for (const rule of rules) {
                    if (rule instanceof CSSStyleRule) {
                        // Skip :root where CSS vars are defined
                        if (rule.selectorText?.includes(':root')) continue;
                        const style = rule.style;
                        for (let i = 0; i < style.length; i++) {
                            const propName = style[i];
                            // Only color-related properties
                            if (
                                !propName.includes('color') &&
                                !propName.includes('background') &&
                                !propName.includes('border') &&
                                !propName.includes('shadow') &&
                                !propName.includes('fill') &&
                                !propName.includes('stroke')
                            ) {
                                continue;
                            }
                            const value = style.getPropertyValue(propName);
                            if (/#[0-9a-fA-F]{3,8}\b/.test(value)) {
                                count++;
                            }
                        }
                    }
                }
            } catch {
                // Cross-origin
            }
        }
        return count;
    });

    // Threshold of 15 allows a small number of hex values (e.g., in SVG stroke colors, shadows)
    expect(
        hardcodedCount,
        `Found ${hardcodedCount} hardcoded hex color values (threshold: 15). Use CSS custom properties.`
    ).toBeLessThan(15);
});

// ─── Press Start 2P Pixel Font ───────────────────────────────────────────────

test('[design] body uses Press Start 2P pixel font (not Inter/Roboto/Arial)', async ({ page }) => {
    await page.goto('/');

    const fontFamily = await page.evaluate(() => {
        return getComputedStyle(document.body).fontFamily.toLowerCase();
    });

    const forbiddenFonts = ['inter', 'roboto', 'arial', 'system-ui'];
    for (const font of forbiddenFonts) {
        expect(fontFamily, `Forbidden display font detected: ${font}`).not.toContain(font);
    }

    // Must use Press Start 2P or cursive fallback
    const isPixelFont =
        fontFamily.includes('press start 2p') ||
        fontFamily.includes('cursive');
    expect(isPixelFont, `Body font "${fontFamily}" is not Press Start 2P`).toBe(true);
});

// ─── Background Atmosphere ────────────────────────────────────────────────────

test('[design] background has atmosphere (pseudo-element or gradient)', async ({ page }) => {
    await page.goto('/');

    const hasAtmosphere = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets);
        for (const sheet of sheets) {
            try {
                const rules = Array.from(sheet.cssRules);
                for (const rule of rules) {
                    if (rule instanceof CSSStyleRule) {
                        if (
                            (rule.selectorText?.includes('::before') ||
                                rule.selectorText?.includes('::after')) &&
                            (rule.selectorText?.includes('body') ||
                                rule.selectorText?.includes('#root'))
                        ) {
                            return true;
                        }
                    }
                }
            } catch {
                // Cross-origin
            }
        }
        return false;
    });
    expect(hasAtmosphere, 'No atmosphere pseudo-element found on body or #root').toBe(true);
});

// ─── No Purple-on-White AI Slop Pattern ──────────────────────────────────────

test('[design] no white card backgrounds (synthwave dark theme only)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const whiteCards = await page.evaluate(() => {
        const cards = document.querySelectorAll('.card, .glass-card, [class*="card"]');
        let whiteCount = 0;
        for (const card of Array.from(cards)) {
            const bg = getComputedStyle(card).backgroundColor;
            if (bg === 'rgb(255, 255, 255)') {
                whiteCount++;
            }
        }
        return whiteCount;
    });
    expect(whiteCards, `${whiteCards} card(s) have white backgrounds`).toBe(0);
});

// ─── Responsive: No Horizontal Overflow ───────────────────────────────────────

const breakpoints = [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
] as const;

for (const bp of breakpoints) {
    test(`[responsive] no horizontal overflow at ${bp.name} (${bp.width}px)`, async ({ page }) => {
        ensureScreenshotDir();
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const hasOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasOverflow, `Horizontal overflow detected at ${bp.width}px width`).toBe(false);

        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `home-${bp.name}.png`),
            fullPage: false,
        });
    });
}

// ─── Skeleton Loader Present in CSS ──────────────────────────────────────────

test('[design] skeleton loader CSS class is defined', async ({ page }) => {
    await page.goto('/');

    const hasSkeletonClass = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets);
        for (const sheet of sheets) {
            try {
                const rules = Array.from(sheet.cssRules);
                for (const rule of rules) {
                    if (rule instanceof CSSStyleRule && rule.selectorText?.includes('skeleton')) {
                        return true;
                    }
                }
            } catch {
                // Cross-origin
            }
        }
        return false;
    });
    expect(hasSkeletonClass, 'No .skeleton CSS class found — skeleton loaders are required').toBe(true);
});

// ─── Tabular-nums for Numeric Displays ───────────────────────────────────────

test('[design] tabular-nums defined for numeric elements', async ({ page }) => {
    await page.goto('/');

    const hasTabularNums = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets);
        for (const sheet of sheets) {
            try {
                const rules = Array.from(sheet.cssRules);
                for (const rule of rules) {
                    if (rule instanceof CSSStyleRule) {
                        const style = rule.style;
                        const fnSettings = style.getPropertyValue('font-variant-numeric');
                        const ffSettings = style.getPropertyValue('font-feature-settings');
                        if (
                            fnSettings.includes('tabular-nums') ||
                            ffSettings.includes('tnum')
                        ) {
                            return true;
                        }
                    }
                }
            } catch {
                // Cross-origin
            }
        }
        return false;
    });
    expect(hasTabularNums, 'No tabular-nums font-variant-numeric found in stylesheets').toBe(true);
});
