/** Everything a rule may be judged against at the moment a file is uploaded. */
export interface UploadContext {
    collection?: string;
    categories?: readonly string[];
    tags?: readonly string[];
    authorRole?: string | null;
    authorId?: string;
    mimeType: string;
    size: number;
    at: Date;
}

/** An absent or empty condition does not care; every condition present must hold. */
export interface StorageConditions {
    collections?: readonly string[];
    categories?: readonly string[];
    tags?: readonly string[];
    authorRoles?: readonly string[];
    authorIds?: readonly string[];
    /** Matched against the start of the type, so "image/" covers every image. */
    mimePrefixes?: readonly string[];
    /** Both bounds are inclusive. */
    minSize?: number;
    maxSize?: number;
    from?: string;
    until?: string;
}

export interface StorageRule {
    id: string;
    label: string;
    bucketId: string;
    priority: number;
    isFallback: boolean;
    conditions: StorageConditions;
}

function wants(condition: readonly string[] | undefined): condition is readonly string[] {
    return condition !== undefined && condition.length > 0;
}

function overlaps(condition: readonly string[], held: readonly string[] | undefined) {
    return held !== undefined && held.some(value => condition.includes(value));
}

export function ruleMatches(rule: StorageRule, context: UploadContext): boolean {
    const { conditions } = rule;

    if (wants(conditions.collections) && !conditions.collections.includes(context.collection ?? "")) {
        return false;
    }

    if (wants(conditions.categories) && !overlaps(conditions.categories, context.categories)) {
        return false;
    }

    if (wants(conditions.tags) && !overlaps(conditions.tags, context.tags)) {
        return false;
    }

    if (wants(conditions.authorRoles) && !conditions.authorRoles.includes(context.authorRole ?? "")) {
        return false;
    }

    if (wants(conditions.authorIds) && !conditions.authorIds.includes(context.authorId ?? "")) {
        return false;
    }

    if (
        wants(conditions.mimePrefixes)
        && !conditions.mimePrefixes.some(prefix => context.mimeType.startsWith(prefix))
    ) {
        return false;
    }

    if (conditions.minSize !== undefined && context.size < conditions.minSize) {
        return false;
    }

    if (conditions.maxSize !== undefined && context.size > conditions.maxSize) {
        return false;
    }

    if (conditions.from !== undefined && context.at < new Date(conditions.from)) {
        return false;
    }

    if (conditions.until !== undefined && context.at > new Date(conditions.until)) {
        return false;
    }

    return true;
}

/**
 * The first rule that matches decides. The fallback is held back until every other
 * rule has been offered, whatever priority it was given, because it exists to catch
 * what nothing else claimed rather than to compete with them.
 */
export function chooseRule(rules: readonly StorageRule[], context: UploadContext): StorageRule {
    const contenders = rules.filter(rule => !rule.isFallback).sort((a, b) => a.priority - b.priority);

    for (const rule of contenders) {
        if (ruleMatches(rule, context)) {
            return rule;
        }
    }

    const fallback = rules.find(rule => rule.isFallback);

    if (fallback === undefined) {
        throw new Error("No storage rule matched and there is no fallback rule to catch the file.");
    }

    return fallback;
}

/** Undefined when the stored conditions cannot be read; such a rule is left out
 *  entirely, since an unreadable rule must not quietly become one that matches all. */
export function parseConditions(raw: string): StorageConditions | undefined {
    try {
        const parsed: unknown = JSON.parse(raw);

        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ?
                (parsed as StorageConditions)
            :   undefined;
    } catch {
        return undefined;
    }
}
