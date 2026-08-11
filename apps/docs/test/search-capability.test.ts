import { env } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";

describe("D1 full-text search capability", () => {
    afterEach(async () => {
        await env.DB.exec("DROP TRIGGER IF EXISTS search_probe_ai");
        await env.DB.exec("DROP TABLE IF EXISTS search_probe_fts");
        await env.DB.exec("DROP TABLE IF EXISTS search_probe");
    });

    it("supports the FTS5 features the search adapter relies on", async () => {
        await env.DB.prepare(
            `
            CREATE TABLE search_probe (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                body TEXT NOT NULL
            )
        `
        ).run();
        await env.DB.prepare(
            `
            CREATE VIRTUAL TABLE search_probe_fts USING fts5(
                title,
                body,
                tokenize = 'unicode61 remove_diacritics 2'
            )
        `
        ).run();
        await env.DB.prepare(
            `
            CREATE TRIGGER search_probe_ai AFTER INSERT ON search_probe BEGIN
                INSERT INTO search_probe_fts(rowid, title, body)
                VALUES (new.id, new.title, new.body);
            END
        `
        ).run();

        await env.DB.prepare("INSERT INTO search_probe (id, title, body) VALUES (?, ?, ?)")
            .bind(1, "Café on D1", "A full-text search body for the edge runtime.")
            .run();

        const row = await env.DB.prepare(
            `
            SELECT
                rowid,
                rank,
                bm25(search_probe_fts) AS score,
                snippet(search_probe_fts, -1, '', '', '…', 8) AS excerpt
            FROM search_probe_fts
            WHERE search_probe_fts MATCH ?
            ORDER BY rank, rowid
        `
        )
            .bind('"cafe" "runtime"')
            .first<{ rowid: number; rank: number; score: number; excerpt: string }>();

        expect(row).toBeDefined();
        expect(row?.rowid).toBe(1);
        expect(row?.rank).toBeTypeOf("number");
        expect(row?.score).toBeTypeOf("number");
        expect(row?.excerpt).toBe("Café on D1");
    });
});
