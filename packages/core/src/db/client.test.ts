import { env } from "cloudflare:test";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDatabase } from "./client";

describe("createDatabase", () => {
    it("returns a client that can execute against the given binding", async () => {
        const db = createDatabase(env.DB);

        const result = await db.get<{ answer: number }>(sql`select 1 as answer`);

        expect(result).toEqual({ answer: 1 });
    });

    it("binds to the database it was handed, not to a global", async () => {
        const db = createDatabase(env.DB);

        await db.run(sql`create table probe (id integer primary key)`);
        await db.run(sql`insert into probe (id) values (7)`);

        const rows = await db.all<{ id: number }>(sql`select id from probe`);

        expect(rows).toEqual([{ id: 7 }]);
    });
});
