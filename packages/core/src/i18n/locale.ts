export type LocaleTag = string & { readonly __localeTag: unique symbol };

export interface LocaleDefinition<TTag extends string = string, TKey extends string = string> {
    tag: TTag;
    urlKey: TKey;
    label: string;
    /** Explicit product-level language ranges accepted for this Locale. */
    matches?: readonly string[];
}

export interface LocaleCatalogue<TDefinitions extends readonly LocaleDefinition[] = readonly LocaleDefinition[]> {
    readonly defaultLocale: TDefinitions[number]["tag"];
    readonly locales: readonly TDefinitions[number]["tag"][];
    readonly definitions: TDefinitions;
    canonical(value: string): TDefinitions[number]["tag"] | undefined;
    fromUrlKey(value: string): TDefinitions[number]["tag"] | undefined;
    urlKey(locale: TDefinitions[number]["tag"]): TDefinitions[number]["urlKey"];
    definition(locale: TDefinitions[number]["tag"]): TDefinitions[number];
    negotiate(acceptLanguage: string | null | undefined): TDefinitions[number]["tag"] | undefined;
}

/** Canonicalises a well-formed BCP 47 tag; a catalogue then limits it to supported registered tags. */
export function canonicalLocale(value: string): LocaleTag {
    const input = value.trim().replaceAll("_", "-");

    if (input === "") {
        throw new Error("A Locale needs a BCP 47 language tag.");
    }

    try {
        const [canonical] = Intl.getCanonicalLocales(input);

        if (canonical === undefined) {
            throw new Error("A Locale needs a BCP 47 language tag.");
        }

        return canonical as LocaleTag;
    } catch {
        throw new Error(`"${value}" is not a well-formed BCP 47 language tag.`);
    }
}

function localeKey(value: string): string {
    return canonicalLocale(value).toLowerCase();
}

function parseAcceptLanguage(value: string | null | undefined): string[] {
    if (!value?.trim()) {
        return [];
    }

    return value
        .split(",")
        .map((part, index) => {
            const [rangePart, ...parameters] = part.trim().split(";");
            const qualityParameter = parameters.find(parameter => parameter.trim().toLowerCase().startsWith("q="));
            const quality = qualityParameter === undefined ? 1 : Number(qualityParameter.split("=")[1]);

            return {
                range: rangePart?.trim() ?? "",
                quality: Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0,
                index
            };
        })
        .filter(candidate => candidate.range !== "" && candidate.quality > 0)
        .sort((left, right) => right.quality - left.quality || left.index - right.index)
        .map(candidate => candidate.range);
}

export function defineLocaleCatalogue<const TDefinitions extends readonly LocaleDefinition[]>(options: {
    defaultLocale: TDefinitions[number]["tag"];
    locales: TDefinitions;
}): LocaleCatalogue<TDefinitions> {
    if (options.locales.length === 0) {
        throw new Error("A Locale catalogue needs at least one Locale.");
    }

    const definitions = options.locales.map(definition => ({
        ...definition,
        tag: canonicalLocale(definition.tag),
        urlKey: definition.urlKey.toLowerCase()
    })) as unknown as TDefinitions;
    const byTag = new Map<string, TDefinitions[number]>();
    const byUrlKey = new Map<string, TDefinitions[number]>();
    const byRange = new Map<string, TDefinitions[number]>();

    for (const definition of definitions) {
        const tagKey = definition.tag.toLowerCase();
        const urlKey = definition.urlKey.toLowerCase();

        if (byTag.has(tagKey)) {
            throw new Error(`Locale "${definition.tag}" is declared twice.`);
        }

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(urlKey)) {
            throw new Error(`Locale URL key "${definition.urlKey}" must use lowercase ASCII path segments.`);
        }

        if (byUrlKey.has(urlKey)) {
            throw new Error(`Locale URL key "${definition.urlKey}" is declared twice.`);
        }

        byTag.set(tagKey, definition);
        byUrlKey.set(urlKey, definition);

        for (const range of [definition.tag, ...(definition.matches ?? [])]) {
            const key = localeKey(range);
            const existing = byRange.get(key);

            if (existing !== undefined && existing.tag !== definition.tag) {
                throw new Error(`Language range "${range}" maps to more than one Locale.`);
            }

            byRange.set(key, definition);
        }
    }

    const defaultDefinition = byTag.get(localeKey(options.defaultLocale));

    if (defaultDefinition === undefined) {
        throw new Error(`Default Locale "${options.defaultLocale}" is not declared.`);
    }

    function definition(locale: TDefinitions[number]["tag"]): TDefinitions[number] {
        const found = byTag.get(localeKey(locale));

        if (found === undefined) {
            throw new Error(`Locale "${locale}" is not supported.`);
        }

        return found;
    }

    return {
        defaultLocale: defaultDefinition.tag,
        locales: definitions.map(item => item.tag),
        definitions,
        canonical(value) {
            try {
                return byTag.get(localeKey(value))?.tag;
            } catch {
                return undefined;
            }
        },
        fromUrlKey(value) {
            return byUrlKey.get(value.trim().toLowerCase())?.tag;
        },
        urlKey(locale) {
            return definition(locale).urlKey;
        },
        definition,
        negotiate(acceptLanguage) {
            for (const range of parseAcceptLanguage(acceptLanguage)) {
                if (range === "*") {
                    continue;
                }

                try {
                    const direct = byRange.get(localeKey(range));

                    if (direct !== undefined) {
                        return direct.tag;
                    }
                } catch {
                    continue;
                }
            }

            return undefined;
        }
    };
}
