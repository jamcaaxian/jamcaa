import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { canonicalLocale } from "../i18n/locale";

/** Sample used to show what a pattern produces, and to check that it can be used.
 *  Local rather than UTC so the example reads the same wherever it is shown. */
export const SAMPLE_MOMENT = new Date(2026, 7, 9, 14, 5, 3);

export const DATE_PATTERNS = ["d MMMM yyyy", "MMMM d, yyyy", "yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy"];

export const TIME_PATTERNS = ["HH:mm", "HH:mm:ss", "h:mm a"];

/**
 * date-fns refuses `YYYY` and `DD`, which is exactly what someone coming from
 * WordPress or Moment will type first. Its own message says what to use instead,
 * so it is passed on rather than replaced with something vaguer.
 */
export function checkPattern(pattern: string): string | undefined {
    if (pattern.trim() === "") {
        return "Give a pattern, such as yyyy-MM-dd.";
    }

    try {
        format(SAMPLE_MOMENT, pattern);

        return undefined;
    } catch (error) {
        return error instanceof Error ? tidy(error.message) : "That pattern cannot be used.";
    }
}

function tidy(message: string) {
    return message.split(" to the input")[0]?.split("; see:")[0]?.trim() ?? message;
}

/** What a pattern would produce, for showing beside the field that sets it. */
export function describePattern(pattern: string): string | undefined {
    try {
        return format(SAMPLE_MOMENT, pattern);
    } catch {
        return undefined;
    }
}

/**
 * A pattern reaches this from configuration, so it is checked here too: a bad one
 * should leave a date looking wrong on one page, not take the page down.
 */
export function formatMoment(moment: Date, pattern: string, locale?: string): string {
    try {
        const canonical = locale === undefined ? undefined : canonicalLocale(locale);
        const dateLocale =
            canonical === "zh-Hans-CN" ? zhCN
            : canonical === "en-US" ? enUS
            : undefined;

        return format(moment, pattern, dateLocale === undefined ? undefined : { locale: dateLocale });
    } catch {
        return moment.toISOString().slice(0, 10);
    }
}
