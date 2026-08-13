import { pageStore } from "@jamcaaxian/core/content";
import { builtinBlockRegistry } from "@jamcaaxian/editor/blocks";
import type { Database } from "@jamcaaxian/core/db";

/** The page store for this Site, wired to the built-in Block registry. */
export function pages(database: Database) {
    return pageStore(database, builtinBlockRegistry);
}
