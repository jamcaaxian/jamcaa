import type { Actor } from "@jamcaaxian/core/auth";
import { may } from "./permissions";
import { getSession } from "./session";

export async function currentConsoleActor(): Promise<Actor | undefined> {
    try {
        const session = await getSession();

        if (!session) {
            return undefined;
        }

        const actor = { id: session.user.id, role: session.user.role };

        return (await may(actor, "console", "access")) ? actor : undefined;
    } catch {
        return undefined;
    }
}

export async function canAccessConsole(): Promise<boolean> {
    return (await currentConsoleActor()) !== undefined;
}
