import type { Auth } from "./index";

export interface Actor {
    id: string;
    role: string | null | undefined;
}

/**
 * Answers a permission question through Better Auth's own access controller, so
 * there is one implementation of the rule rather than two that can drift.
 */
export async function actorMay(options: {
    auth: Auth;
    actor: Actor;
    resource: string;
    action: string;
}): Promise<boolean> {
    const { auth, actor, resource, action } = options;

    if (!actor.role) {
        return false;
    }

    // Passing the role rather than headers: with headers present the endpoint
    // insists on a live session, and callers here have already established one.
    const { success } = await auth.api.userHasPermission({
        body: { role: actor.role, permissions: { [resource]: [action] } }
    });

    return success;
}

/**
 * Applies the `-own` and `-any` convention the capability catalogue documents:
 * holding the unscoped power over everyone's entries, or the scoped one over
 * your own, both answer yes.
 */
export async function actorMayTouch(options: {
    auth: Auth;
    actor: Actor;
    resource: string;
    verb: string;
    ownerId: string;
}): Promise<boolean> {
    const { auth, actor, resource, verb, ownerId } = options;

    if (await actorMay({ auth, actor, resource, action: `${verb}-any` })) {
        return true;
    }

    if (ownerId !== actor.id) {
        return false;
    }

    return actorMay({ auth, actor, resource, action: `${verb}-own` });
}
