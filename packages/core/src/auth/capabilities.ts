/**
 * The vocabulary of what can be granted. Roles decide which of these a user holds,
 * and those assignments live in the database so they can be adjusted per site.
 *
 * Ownership is explicit in the action name: `-own` covers the actor's own entries,
 * `-any` covers everyone's. A capability that omits the suffix is not scoped.
 */
export const coreCapabilities = {
    console: ["access"],
    post: ["create", "read", "update-own", "delete-own", "publish-own", "update-any", "delete-any", "publish-any"],
    media: ["upload", "read", "delete-own", "delete-any"],
    comment: ["create", "moderate", "delete-any"],
    // Names here mirror what the admin plugin expects for its own endpoints.
    user: ["create", "list", "get", "update", "delete", "set-role", "set-password", "ban"],
    session: ["list", "revoke"],
    taxonomy: ["read", "manage"],
    settings: ["read", "manage"],
    role: ["read", "manage"],
    page: ["create", "read", "update", "delete", "publish"]
} as const;

export type CapabilityCatalogue = Record<string, readonly string[]>;

/** A role's grants, in the shape the access controller consumes. */
export type CapabilityGrants = Record<string, string[]>;

/**
 * Plugins contribute their own resources by merging into the catalogue. Resource
 * names must be unique; a collision means two plugins are claiming the same noun.
 */
export function mergeCapabilities(...catalogues: CapabilityCatalogue[]): CapabilityCatalogue {
    const merged: CapabilityCatalogue = {};

    for (const catalogue of catalogues) {
        for (const [resource, actions] of Object.entries(catalogue)) {
            if (resource in merged) {
                throw new Error(`Duplicate capability resource: ${resource}`);
            }
            merged[resource] = actions;
        }
    }

    return merged;
}

/** Rejects grants naming a resource or action that no catalogue declares. */
export function assertGrantsAreDeclared(catalogue: CapabilityCatalogue, grants: CapabilityGrants): void {
    for (const [resource, actions] of Object.entries(grants)) {
        const declared = catalogue[resource];

        if (!declared) {
            throw new Error(`Unknown capability resource: ${resource}`);
        }

        for (const action of actions) {
            if (!declared.includes(action)) {
                throw new Error(`Unknown capability action: ${resource}:${action}`);
            }
        }
    }
}
