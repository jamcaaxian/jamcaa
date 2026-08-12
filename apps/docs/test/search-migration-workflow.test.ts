import { defineCollection, richText, text } from "@jamcaa/core/content";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    migrationCarriesArtifact,
    searchMigrationArtifacts,
    verifyAppendOnlyManifest,
    verifyCurrentSearchMigrations,
    verifySearchMigrations,
    verifyUniqueMigrationNumbers,
    type SearchMigrationManifest
} from "../scripts/search-migration-workflow";
import { post } from "../src/content/collections";

describe("search migration workflow", () => {
    it("verifies the current declaration against the registered immutable migration", async () => {
        const verification = await verifyCurrentSearchMigrations();
        const latest = new Map(verification.records.map(record => [record.collection, record]));

        expect(verification.artifacts.map(artifact => artifact.collection).sort()).toEqual(
            [...latest.values()]
                .filter(record => record.status === "active")
                .map(record => record.collection)
                .sort()
        );
    });

    it("requires a new handoff when searchable Fields change", async () => {
        const changed = defineCollection({
            name: "post",
            label: "Post",
            plural: "Posts",
            fields: {
                title: text({ required: true }),
                excerpt: text(),
                body: richText({ required: true }),
                summary: text()
            },
            search: { fields: ["title", "summary", "body"] }
        });
        const current = await verifyCurrentSearchMigrations();
        const manifest: SearchMigrationManifest = { version: 1, records: current.records };

        await expect(
            verifySearchMigrations({
                collections: [changed],
                manifest,
                migrationsDirectory: new URL("../migrations/", import.meta.url)
            })
        ).rejects.toThrow(/needs a new migration handoff/i);
    });

    it("rejects duplicate migration numbers independently of the Drizzle journal", () => {
        expect(() => verifyUniqueMigrationNumbers(["0009_search.sql", "0009_other.sql"])).toThrow(
            /migration number 0009/i
        );
    });

    it("matches generated SQL through formatting and identifier quote changes", () => {
        expect(
            migrationCarriesArtifact(
                "CREATE TABLE `post` (\n  `title` TEXT\n); SELECT entry . id FROM `post` AS entry;",
                'CREATE TABLE "post"("title" TEXT); SELECT entry.id FROM "post" AS entry;'
            )
        ).toBe(true);
        expect(migrationCarriesArtifact("SELECT value||other;", "SELECT value | | other;")).toBe(false);
    });

    it("requires registered manifest records to remain an unchanged prefix", () => {
        const record = {
            collection: "post",
            migration: "0009_search.sql",
            artifactSha256: "artifact",
            migrationSha256: "migration",
            status: "active" as const
        };

        expect(() =>
            verifyAppendOnlyManifest(
                { version: 1, records: [{ ...record, artifactSha256: "changed" }] },
                { version: 1, records: [record] }
            )
        ).toThrow(/append-only/i);
    });

    it("allows only one new handoff per Collection in a change", () => {
        const record = {
            collection: "post",
            migration: "0009_search.sql",
            artifactSha256: "artifact",
            migrationSha256: "migration",
            status: "active" as const
        };

        expect(() =>
            verifyAppendOnlyManifest(
                {
                    version: 1,
                    records: [
                        record,
                        { ...record, migration: "0012_search.sql", status: "removed" },
                        { ...record, migration: "0013_search.sql" }
                    ]
                },
                { version: 1, records: [record] }
            )
        ).toThrow(/one final handoff/i);
    });

    it("counts new handoffs from the longest protected baseline", async () => {
        const current = await verifyCurrentSearchMigrations();
        const record = current.records[0]!;

        await expect(
            verifySearchMigrations({
                collections: [post],
                manifest: { version: 1, records: current.records },
                migrationsDirectory: new URL("../migrations/", import.meta.url),
                baselineManifests: [
                    { version: 1, records: [] },
                    { version: 1, records: current.records }
                ]
            })
        ).resolves.toBeDefined();
        expect(record.collection).toBe("post");
    });

    it("rejects a registered migration that does not carry its generated artifact", async () => {
        const directory = await mkdtemp(path.join(tmpdir(), "jamcaa-search-migration-"));
        const migration = "0001_search.sql";
        const migrationSql = "SELECT 1;";
        const artifact = searchMigrationArtifacts([post])[0]!;
        const manifest: SearchMigrationManifest = {
            version: 1,
            records: [
                {
                    collection: "post",
                    migration,
                    artifactSha256: artifact.sha256,
                    migrationSha256: "17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a",
                    status: "active"
                }
            ]
        };

        try {
            await writeFile(path.join(directory, migration), migrationSql, "utf8");
            await expect(
                verifySearchMigrations({
                    collections: [post],
                    manifest,
                    migrationsDirectory: pathToFileURL(`${directory}${path.sep}`)
                })
            ).rejects.toThrow(/does not carry the generated artifact/i);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });

    it("rejects invalid statuses and paths outside the migration directory", async () => {
        const current = await verifyCurrentSearchMigrations();
        const record = current.records[0]!;

        await expect(
            verifySearchMigrations({
                collections: [post],
                manifest: {
                    version: 1,
                    records: [{ ...record, status: "inactive" }]
                } as unknown as SearchMigrationManifest,
                migrationsDirectory: new URL("../migrations/", import.meta.url)
            })
        ).rejects.toThrow(/invalid status/i);
        await expect(
            verifySearchMigrations({
                collections: [post],
                manifest: { version: 1, records: [{ ...record, migration: "../scripts/search.sql" }] },
                migrationsDirectory: new URL("../migrations/", import.meta.url)
            })
        ).rejects.toThrow(/numbered migration file/i);
    });
});
