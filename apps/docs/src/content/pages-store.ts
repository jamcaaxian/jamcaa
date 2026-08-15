import { pageStore } from "@jamcaaxian/core/content";
import type { Database } from "@jamcaaxian/core/db";
import { docsLocales } from "./locales";
import { siteBlockRegistry } from "./site-blocks";

/** The page store for this Site, wired to its complete Block registry. */
export function pages(database: Database) {
    return pageStore(database, siteBlockRegistry, docsLocales);
}
