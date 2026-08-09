import { entryStore } from "@jamcaa/core/content";
import type { Database } from "@jamcaa/core/db";
import { post } from "./collections";
import { postTable } from "./schema";

export function posts(database: Database) {
    return entryStore({ database, collection: post, table: postTable });
}
