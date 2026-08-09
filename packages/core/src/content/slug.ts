/**
 * Keeps letters and digits from any script, so a title written in Chinese or
 * Cyrillic still produces a slug rather than an empty string. Browsers encode
 * these in a URL; stripping them would leave nothing to encode.
 */
export function toSlug(value: string): string {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/['\u2019]/gu, "")
        .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
        .replace(/^-+|-+$/gu, "");
}

/**
 * Appends a counter until the slug is free. The caller supplies the check because
 * only it knows which collection is being written to.
 */
export async function freeSlug(wanted: string, isTaken: (candidate: string) => Promise<boolean>): Promise<string> {
    if (!(await isTaken(wanted))) {
        return wanted;
    }

    for (let suffix = 2; suffix < 1000; suffix += 1) {
        const candidate = `${wanted}-${suffix}`;

        if (!(await isTaken(candidate))) {
            return candidate;
        }
    }

    throw new Error(`Could not find a free slug based on "${wanted}".`);
}
