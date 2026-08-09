/**
 * A redirect target taken from a query string is attacker-controlled, so only a
 * plain in-site path is honoured. `//host` and `/\host` are both read as
 * protocol-relative by browsers and must not survive this.
 */
export function safeNextPath(value: string | undefined | null): string {
    if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
        return "/admin";
    }

    return value;
}
