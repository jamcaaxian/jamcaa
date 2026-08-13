import { checkPattern, DATE_PATTERNS, TIME_PATTERNS } from "../dates";
import { DEFAULT_ACCENT, parseColor } from "../theme";

/**
 * Settings are declared in code and their values live in the database, for the same
 * reason capabilities are (ADR-0015): a setting nothing reads is a promise nothing
 * keeps, while the value itself is an operational choice.
 */
interface CommonSetting {
    label: string;
    description?: string;
    /** Kept by the platform for its own bookkeeping; never offered for editing. */
    internal?: boolean;
}

export type SettingDeclaration =
    | (CommonSetting & {
          kind: "text";
          default: string;
          multiline?: boolean;
          /** What the value describes, so the form can show what it would produce.
           *  A tag rather than a function: the catalogue crosses to the browser. */
          preview?: "moment" | "address";
          /** Ready-made values to offer beside the field. */
          suggestions?: readonly string[];
          /** Beyond the shape: says why a well-formed value still will not do. */
          check?: (value: string) => string | undefined;
      })
    | (CommonSetting & { kind: "flag"; default: boolean })
    | (CommonSetting & { kind: "number"; default: number; check?: (value: number) => string | undefined })
    | (CommonSetting & {
          kind: "choice";
          of: readonly string[];
          default: string;
          check?: (value: string) => string | undefined;
      });

export type SettingCatalogue = Record<string, SettingDeclaration>;

export type SettingValue<TDeclaration> =
    TDeclaration extends { kind: "flag" } ? boolean
    : TDeclaration extends { kind: "number" } ? number
    : TDeclaration extends { kind: "choice"; of: readonly (infer TOption)[] } ? TOption
    : string;

export type SettingValues<TCatalogue extends SettingCatalogue> = {
    [TKey in keyof TCatalogue]: SettingValue<TCatalogue[TKey]>;
};

type MergedSettings<TCatalogues extends readonly SettingCatalogue[]> =
    TCatalogues extends readonly [infer THead extends SettingCatalogue, ...infer TTail extends SettingCatalogue[]] ?
        THead & MergedSettings<TTail>
    :   unknown;

// Namespaced so a plugin's settings cannot silently collide with the platform's.
// The dot is what matters; a segment may be named however its owner names things,
// which lets a key be derived from a collection whose name is snake case.
const SEGMENT = "[a-z][A-Za-z0-9_]*";
const KEY = new RegExp(`^${SEGMENT}(\\.${SEGMENT})+$`);

export function defineSettings<const TCatalogue extends SettingCatalogue>(catalogue: TCatalogue): TCatalogue {
    for (const [key, declaration] of Object.entries(catalogue)) {
        if (!KEY.test(key)) {
            throw new Error(`Setting "${key}": keys are namespaced, such as "site.title" or "permalink.blog_post".`);
        }

        if (declaration.kind === "choice" && !declaration.of.includes(declaration.default)) {
            throw new Error(`Setting "${key}": the default is not one of the choices it offers.`);
        }
    }

    return catalogue;
}

export function mergeSettings<const TCatalogues extends readonly SettingCatalogue[]>(
    ...catalogues: TCatalogues
): MergedSettings<TCatalogues> {
    const merged: SettingCatalogue = {};

    for (const catalogue of catalogues) {
        for (const [key, declaration] of Object.entries(catalogue)) {
            if (key in merged) {
                throw new Error(`Two settings are both named "${key}".`);
            }

            merged[key] = declaration;
        }
    }

    return merged as MergedSettings<TCatalogues>;
}

/** Returns undefined when a stored value no longer fits what the setting accepts. */
export function readSettingValue(declaration: SettingDeclaration, raw: unknown): unknown {
    switch (declaration.kind) {
        case "text":
            return typeof raw === "string" ? raw : undefined;
        case "flag":
            return typeof raw === "boolean" ? raw : undefined;
        case "number":
            return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
        case "choice":
            return typeof raw === "string" && declaration.of.includes(raw) ? raw : undefined;
    }
}

/** The declaration's own objection to a value that is otherwise the right shape. */
export function checkSettingValue(declaration: SettingDeclaration, value: unknown): string | undefined {
    if (declaration.kind === "flag") {
        return undefined;
    }

    return (declaration.check as ((value: unknown) => string | undefined) | undefined)?.(value);
}

export const coreSettings = defineSettings({
    "site.title": { kind: "text", label: "Site title", default: "jamcaa" },
    "site.description": { kind: "text", label: "Tagline", default: "", multiline: true },
    // Which installation steps this site has already had run. Bookkeeping, not a choice.
    "platform.installedVersion": { kind: "number", label: "Installed version", default: 0, internal: true },
    "format.date": {
        kind: "text",
        label: "Date format",
        description: "Patterns follow date-fns, such as yyyy-MM-dd.",
        default: "d MMMM yyyy",
        preview: "moment",
        suggestions: DATE_PATTERNS,
        check: checkPattern
    },
    "format.time": {
        kind: "text",
        label: "Time format",
        default: "HH:mm",
        preview: "moment",
        suggestions: TIME_PATTERNS,
        check: checkPattern
    },
    "media.maxUploadMegabytes": {
        kind: "number",
        label: "Largest upload",
        description: "In megabytes. A file that arrives through the server is also bounded by the platform it runs on.",
        default: 25,
        check: value => (value > 0 ? undefined : "An upload limit has to be more than nothing.")
    },
    // The Site owns presenting this value (ADR-0016); the Design page in the admin
    // is the dedicated editor, so the generic settings form never lists it.
    "theme.accent": {
        kind: "text",
        label: "Accent colour",
        description: "Any CSS colour. Text on top is kept legible automatically.",
        default: DEFAULT_ACCENT,
        internal: true,
        check: value => (parseColor(value) ? undefined : "That does not look like a colour.")
    }
});
