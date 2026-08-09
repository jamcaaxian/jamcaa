import { checkPattern, DATE_PATTERNS, TIME_PATTERNS } from "../dates";

/**
 * Settings are declared in code and their values live in the database, for the same
 * reason capabilities are (ADR-0015): a setting nothing reads is a promise nothing
 * keeps, while the value itself is an operational choice.
 */ export type SettingDeclaration =
    | {
          kind: "text";
          label: string;
          description?: string;
          default: string;
          multiline?: boolean;
          /** What the value describes, so the form can show what it would produce.
           *  A tag rather than a function: the catalogue crosses to the browser. */
          preview?: "moment" | "address";
          /** Ready-made values to offer beside the field. */
          suggestions?: readonly string[];
          /** Beyond the shape: says why a well-formed value still will not do. */
          check?: (value: string) => string | undefined;
      }
    | { kind: "flag"; label: string; description?: string; default: boolean }
    | {
          kind: "number";
          label: string;
          description?: string;
          default: number;
          check?: (value: number) => string | undefined;
      }
    | {
          kind: "choice";
          label: string;
          description?: string;
          of: readonly string[];
          default: string;
          check?: (value: string) => string | undefined;
      };

export type SettingCatalogue = Record<string, SettingDeclaration>;

export type SettingValue<TDeclaration> =
    TDeclaration extends { kind: "flag" } ? boolean
    : TDeclaration extends { kind: "number" } ? number
    : TDeclaration extends { kind: "choice"; of: readonly (infer TOption)[] } ? TOption
    : string;

export type SettingValues<TCatalogue extends SettingCatalogue> = {
    [TKey in keyof TCatalogue]: SettingValue<TCatalogue[TKey]>;
};

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

export function mergeSettings(...catalogues: SettingCatalogue[]): SettingCatalogue {
    const merged: SettingCatalogue = {};

    for (const catalogue of catalogues) {
        for (const [key, declaration] of Object.entries(catalogue)) {
            if (key in merged) {
                throw new Error(`Two settings are both named "${key}".`);
            }

            merged[key] = declaration;
        }
    }

    return merged;
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
    }
});
