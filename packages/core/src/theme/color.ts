import { converter, formatCss, parse, wcagContrast } from "culori";
import type { Oklch } from "culori";

const toOklch = converter("oklch");

/** Foregrounds are chosen from these rather than pure black and white. */
const LIGHT_FOREGROUND = "oklch(0.985 0 0)";
const DARK_FOREGROUND = "oklch(0.145 0 0)";

/**
 * Accepts whatever a person is likely to paste — hex in three, six, or eight
 * digits, rgb(), rgba(), hsl(), hsla(), oklch(), and named colours — and returns
 * a single internal representation.
 *
 * Everything is normalised to oklch because the derived values below (hover
 * states, readable foregrounds) depend on adjusting perceived lightness. Doing
 * that arithmetic in sRGB produces muddy colours and unpredictable contrast.
 */
export function parseColor(input: string): Oklch | undefined {
    const parsed = parse(input.trim());
    return parsed ? toOklch(parsed) : undefined;
}

export function formatColor(color: Oklch): string {
    return formatCss(color);
}

/** Contrast ratio as defined by WCAG, between 1 and 21. */
export function contrastRatio(a: string, b: string): number {
    return wcagContrast(a, b);
}

export interface ContrastTarget {
    /** 4.5 for body text, 3 for large text and interface components. */
    minimum: number;
}

/**
 * Picks the foreground that reads best on a background, and reports whether it
 * actually clears the bar. Callers decide what to do when it does not; silently
 * shipping unreadable text is worse than surfacing it.
 */
export function readableForegroundOn(
    background: string,
    target: ContrastTarget = { minimum: 4.5 }
): { color: string; ratio: number; meetsTarget: boolean } {
    const candidates = [DARK_FOREGROUND, LIGHT_FOREGROUND];

    const best = candidates
        .map((color) => ({ color, ratio: contrastRatio(color, background) }))
        .sort((a, b) => b.ratio - a.ratio)[0]!;

    return { ...best, meetsTarget: best.ratio >= target.minimum };
}

/**
 * Moves a colour's lightness until it clears a contrast target against a fixed
 * counterpart, keeping hue and chroma. Used to make a brand colour usable as a
 * solid background behind text when the colour as supplied is too light.
 *
 * Returns the original when the target cannot be reached at any lightness.
 */
export function adjustForContrast(color: Oklch, against: string, minimum: number): Oklch {
    if (contrastRatio(formatColor(color), against) >= minimum) {
        return color;
    }

    const againstIsLight = contrastRatio("oklch(0 0 0)", against) > contrastRatio("oklch(1 0 0)", against);
    const direction = againstIsLight ? -1 : 1;

    let best: Oklch | undefined;

    // 0.01 steps are finer than the eye resolves, so the first hit is close enough.
    for (let step = 1; step <= 100; step += 1) {
        const lightness = color.l + direction * step * 0.01;

        if (lightness < 0 || lightness > 1) {
            break;
        }

        const candidate: Oklch = { ...color, l: lightness };

        if (contrastRatio(formatColor(candidate), against) >= minimum) {
            best = candidate;
            break;
        }
    }

    return best ?? color;
}

/**
 * A slightly shifted version of a colour for hover and pressed states, moving
 * away from the surface it sits on so the change reads as "closer to the user".
 */
export function shiftLightness(color: Oklch, amount: number): Oklch {
    return { ...color, l: Math.min(1, Math.max(0, color.l + amount)) };
}

export interface UsableAccent {
    /** The accent as it should be painted, possibly darkened from what was asked for. */
    color: string;
    /** The text colour to place on it. */
    foreground: string;
    ratio: number;
    /** Set when the requested accent had to move to keep its label legible. */
    darkenedBy?: number;
}

/**
 * Prepares a brand colour for use as a solid background behind text.
 *
 * Light text is used regardless of which direction would technically score higher,
 * because a mid-tone accent with near-black text reads as a mistake even when it
 * passes. When light text falls short, the accent is darkened until it clears the
 * bar — the result is still recognisably the colour that was chosen.
 */
export function makeAccentUsable(accent: Oklch, minimum = 4.5): UsableAccent {
    const foreground = LIGHT_FOREGROUND;
    const asRequested = contrastRatio(foreground, formatColor(accent));

    if (asRequested >= minimum) {
        return { color: formatColor(accent), foreground, ratio: asRequested };
    }

    for (let step = 1; step <= 100; step += 1) {
        const lightness = accent.l - step * 0.005;

        if (lightness < 0) {
            break;
        }

        const candidate = formatColor({ ...accent, l: lightness });
        const ratio = contrastRatio(foreground, candidate);

        if (ratio >= minimum) {
            return { color: candidate, foreground, ratio, darkenedBy: accent.l - lightness };
        }
    }

    // Unreachable for any real colour, since black clears the bar against light text.
    return { color: formatColor(accent), foreground, ratio: asRequested };
}
