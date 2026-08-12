import { createAuth } from "./src/auth/index";

/**
 * Read by the Better Auth CLI to generate the database schema. It shares the one
 * definition in src/auth so the generated tables cannot drift from the real policy.
 * Nothing here ever runs at request time.
 */
export const auth = createAuth({
    database: undefined as never,
    secret: "schema-generation-placeholder-secret",
    baseURL: "http://localhost:2727"
});
