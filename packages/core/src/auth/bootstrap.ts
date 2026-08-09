import { count, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { user } from "../db/schema";
import { coreCapabilities } from "./capabilities";
import { forgetCachedRoleGrants } from "./role-cache";
import { seedSystemRoles } from "./roles";
import type { Auth } from "./index";

export async function hasAnyUser(database: Database): Promise<boolean> {
    const [row] = await database.select({ total: count() }).from(user);

    return (row?.total ?? 0) > 0;
}

export type FirstAdministratorResult =
    | { status: "created" }
    | { status: "already-installed" }
    | { status: "rejected"; message: string };

/**
 * Bootstraps an empty installation: seeds the system roles and turns the first
 * account into an administrator. Refuses once any user exists, so the route
 * that exposes this closes itself permanently after one successful call.
 */
export async function claimFirstAdministrator(options: {
    auth: Auth;
    database: Database;
    name: string;
    email: string;
    password: string;
}): Promise<FirstAdministratorResult> {
    const { auth, database, name, email, password } = options;

    if (await hasAnyUser(database)) {
        return { status: "already-installed" };
    }

    await seedSystemRoles(database, coreCapabilities);
    forgetCachedRoleGrants();

    let created;

    try {
        created = await auth.api.signUpEmail({ body: { name, email, password } });
    } catch (error) {
        return { status: "rejected", message: error instanceof Error ? error.message : "Sign-up failed." };
    }

    await database.update(user).set({ role: "admin" }).where(eq(user.id, created.user.id));

    return { status: "created" };
}
