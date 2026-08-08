import { formatColor, makeAccentUsable, parseColor } from "./color";

/** The accent a site starts with before anyone customises it. */
export const DEFAULT_ACCENT = "#3388FF";

/**
 * Colours an administrator may set. Tokens absent from this list are either
 * structural or derived, and are deliberately not exposed: letting someone set a
 * foreground independently of its background is how unreadable interfaces happen.
 */
export const THEMEABLE_TOKENS = [
    "background",
    "foreground",
    "card",
    "popover",
    "primary",
    "secondary",
    "muted",
    "accent",
    "destructive",
    "border",
    "input",
    "ring",
    "sidebar"
] as const;

export type ThemeableToken = (typeof THEMEABLE_TOKENS)[number];

export type ThemeOverrides = Partial<Record<ThemeableToken, string>>;

export interface ThemeResolution {
    /** Token name to CSS colour value, ready to emit as custom properties. */
    declarations: Record<string, string>;
    /** Inputs that could not be parsed, reported rather than silently dropped. */
    rejected: { token: string; value: string }[];
    /** Adjustments made to keep text legible, so the interface can explain itself. */
    adjustments: { token: string; reason: string }[];
}

/** Text on a solid accent must clear this; interface chrome only needs 3. */
const BODY_TEXT_CONTRAST = 4.5;

/**
 * Turns whatever an administrator typed into custom properties, normalising the
 * colour space and deriving the tokens that must stay consistent with others.
 */
export function resolveTheme(overrides: ThemeOverrides): ThemeResolution {
    const declarations: Record<string, string> = {};
    const rejected: ThemeResolution["rejected"] = [];
    const adjustments: ThemeResolution["adjustments"] = [];

    for (const token of THEMEABLE_TOKENS) {
        const raw = overrides[token];

        if (raw === undefined) {
            continue;
        }

        const parsed = parseColor(raw);

        if (!parsed) {
            rejected.push({ token, value: raw });
            continue;
        }

        declarations[token] = formatColor(parsed);
    }

    const accent = overrides.primary === undefined ? undefined : parseColor(overrides.primary);

    if (accent) {
        const usable = makeAccentUsable(accent, BODY_TEXT_CONTRAST);

        declarations.primary = usable.color;
        declarations["primary-foreground"] = usable.foreground;

        if (usable.darkenedBy !== undefined) {
            adjustments.push({
                token: "primary",
                reason: `darkened by ${usable.darkenedBy.toFixed(3)} lightness so its label reaches ${BODY_TEXT_CONTRAST}:1`
            });
        }
    }

    return { declarations, rejected, adjustments };
}

/** Renders resolved tokens as a stylesheet the document can adopt. */
export function themeToCss(resolution: ThemeResolution, selector = ":root"): string {
    const body = Object.entries(resolution.declarations)
        .map(([token, value]) => `  --${token}: ${value};`)
        .join("\n");

    return body ? `${selector} {\n${body}\n}` : "";
}
