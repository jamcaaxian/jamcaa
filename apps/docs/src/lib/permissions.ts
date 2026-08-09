import { actorMay, actorMayTouch, type Actor } from "@jamcaa/core/auth";
import { getAuth } from "./auth";

export async function may(actor: Actor, resource: string, action: string): Promise<boolean> {
    return actorMay({ auth: await getAuth(), actor, resource, action });
}

export async function mayTouch(actor: Actor, resource: string, verb: string, ownerId: string): Promise<boolean> {
    return actorMayTouch({ auth: await getAuth(), actor, resource, verb, ownerId });
}

export type { Actor };
