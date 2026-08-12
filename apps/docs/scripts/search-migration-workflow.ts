import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Collection } from "@jamcaa/core/content";
import { searchMigrationSql } from "@jamcaa/core/search";
import { contentModel } from "../src/content/schema";

export interface SearchMigrationRecord {
    collection: string;
    migration: string;
    artifactSha256: string;
    migrationSha256: string;
    status: "active" | "removed";
}

export interface SearchMigrationManifest {
    version: 1;
    records: SearchMigrationRecord[];
}

export interface SearchMigrationArtifact {
    collection: string;
    sql: string;
    sha256: string;
}

export interface SearchMigrationVerification {
    artifacts: SearchMigrationArtifact[];
    records: SearchMigrationRecord[];
}

const execFileAsync = promisify(execFile);
const migrationFilePattern = /^\d+_[^/\\]+\.sql$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const sqlOperators = ["->>", "||", "<<", ">>", "<=", ">=", "==", "!=", "<>", "->"];

function sha256(value: string | Uint8Array): string {
    return createHash("sha256").update(value).digest("hex");
}

function searchRemovalMigrationSql(collection: string): string {
    const prefix = `_jamcaa_${collection}_fts`;

    return [
        `DROP TRIGGER IF EXISTS "${prefix}_ai";`,
        `DROP TRIGGER IF EXISTS "${prefix}_ad";`,
        `DROP TRIGGER IF EXISTS "${prefix}_au";`,
        `DROP TABLE IF EXISTS "${prefix}";`
    ].join("\n\n");
}

function parseSearchMigrationManifest(value: unknown, source: string): SearchMigrationManifest {
    if (typeof value !== "object" || value === null || !("version" in value) || !("records" in value)) {
        throw new Error(`${source} is not a search migration manifest.`);
    }

    const manifest = value as { version: unknown; records: unknown };

    if (manifest.version !== 1 || !Array.isArray(manifest.records)) {
        throw new Error(`${source} must use version 1 and contain a records array.`);
    }

    const records = manifest.records.map((value, index): SearchMigrationRecord => {
        if (typeof value !== "object" || value === null) {
            throw new Error(`${source} record ${index + 1} must be an object.`);
        }

        const record = value as Record<string, unknown>;

        if (typeof record.collection !== "string" || record.collection.length === 0) {
            throw new Error(`${source} record ${index + 1} has an invalid Collection name.`);
        }
        if (typeof record.migration !== "string" || !migrationFilePattern.test(record.migration)) {
            throw new Error(
                `${source} record ${index + 1} must reference a numbered migration file in this directory.`
            );
        }
        if (typeof record.artifactSha256 !== "string" || !sha256Pattern.test(record.artifactSha256)) {
            throw new Error(`${source} record ${index + 1} has an invalid artifact SHA-256.`);
        }
        if (typeof record.migrationSha256 !== "string" || !sha256Pattern.test(record.migrationSha256)) {
            throw new Error(`${source} record ${index + 1} has an invalid migration SHA-256.`);
        }
        if (record.status !== "active" && record.status !== "removed") {
            throw new Error(`${source} record ${index + 1} has an invalid status.`);
        }

        return {
            collection: record.collection,
            migration: record.migration,
            artifactSha256: record.artifactSha256,
            migrationSha256: record.migrationSha256,
            status: record.status
        };
    });

    return { version: 1, records };
}

export function canonicalSqlTokens(sql: string): string[] {
    const tokens: string[] = [];
    let index = 0;

    while (index < sql.length) {
        const character = sql[index]!;

        if (/\s/.test(character)) {
            index += 1;
            continue;
        }

        if (sql.startsWith("--", index)) {
            const lineEnd = sql.indexOf("\n", index + 2);
            index = lineEnd === -1 ? sql.length : lineEnd + 1;
            continue;
        }

        if (sql.startsWith("/*", index)) {
            const commentEnd = sql.indexOf("*/", index + 2);

            if (commentEnd === -1) {
                throw new Error("Search migration contains an unterminated SQL comment.");
            }

            index = commentEnd + 2;
            continue;
        }

        if (character === "'" || character === '"' || character === "`") {
            const quote = character;
            let value = "";

            index += 1;
            while (index < sql.length) {
                const quotedCharacter = sql[index]!;

                if (quotedCharacter === quote) {
                    if (sql[index + 1] === quote) {
                        value += quote;
                        index += 2;
                        continue;
                    }

                    index += 1;
                    break;
                }

                value += quotedCharacter;
                index += 1;
            }

            tokens.push(quote === "'" ? `string:${value}` : `identifier:${value.toLowerCase()}`);
            continue;
        }

        const word = /^[\p{L}\p{N}_$]+/u.exec(sql.slice(index))?.[0];

        if (word !== undefined) {
            tokens.push(word.toLowerCase());
            index += word.length;
            continue;
        }

        const operator = sqlOperators.find(operator => sql.startsWith(operator, index));

        if (operator !== undefined) {
            tokens.push(operator);
            index += operator.length;
            continue;
        }

        tokens.push(character);
        index += 1;
    }

    return tokens;
}

export function migrationCarriesArtifact(migrationSql: string, artifactSql: string): boolean {
    const migrationTokens = canonicalSqlTokens(migrationSql);
    const artifactTokens = canonicalSqlTokens(artifactSql);

    return migrationTokens.some((_, start) =>
        artifactTokens.every((token, offset) => migrationTokens[start + offset] === token)
    );
}

export function searchMigrationArtifacts(collections: readonly Collection[]): SearchMigrationArtifact[] {
    return collections
        .filter(collection => collection.search !== undefined)
        .map(collection => {
            const sql = searchMigrationSql(collection);

            return { collection: collection.name, sql, sha256: sha256(sql) };
        });
}

export function verifyUniqueMigrationNumbers(migrationFiles: readonly string[]): void {
    const byNumber = new Map<string, string>();

    for (const migration of migrationFiles) {
        const number = /^(\d+)_.*\.sql$/.exec(migration)?.[1];

        if (number === undefined) {
            throw new Error(`Migration file ${migration} must start with a numeric prefix and end in .sql.`);
        }

        const existing = byNumber.get(number);

        if (existing !== undefined) {
            throw new Error(`Migration number ${number} is used by both ${existing} and ${migration}.`);
        }

        byNumber.set(number, migration);
    }
}

function verifyManifestPrefix(manifest: SearchMigrationManifest, baseline: SearchMigrationManifest): void {
    for (const [index, record] of baseline.records.entries()) {
        if (JSON.stringify(manifest.records[index]) !== JSON.stringify(record)) {
            throw new Error(
                `Search migration record ${index + 1} changed after registration. `
                    + "The manifest is append-only; add a record instead."
            );
        }
    }
}

export function verifyAppendOnlyManifest(manifest: SearchMigrationManifest, baseline: SearchMigrationManifest): void {
    verifyManifestPrefix(manifest, baseline);

    const additionsByCollection = new Map<string, number>();

    for (const record of manifest.records.slice(baseline.records.length)) {
        const additions = (additionsByCollection.get(record.collection) ?? 0) + 1;

        if (additions > 1) {
            throw new Error(
                `Collection "${record.collection}" has more than one new search migration record. `
                    + "Register one final handoff per Collection in each change."
            );
        }

        additionsByCollection.set(record.collection, additions);
    }
}

export async function verifySearchMigrations(options: {
    collections: readonly Collection[];
    manifest: SearchMigrationManifest;
    migrationsDirectory: URL;
    baselineManifests?: readonly SearchMigrationManifest[];
}): Promise<SearchMigrationVerification> {
    const { baselineManifests = [], collections, migrationsDirectory } = options;
    const manifest = parseSearchMigrationManifest(options.manifest, "Search migration manifest");
    const artifacts = searchMigrationArtifacts(collections);
    const records = manifest.records;
    const currentNames = new Set(artifacts.map(artifact => artifact.collection));
    const latest = new Map<string, SearchMigrationRecord>();
    const migrationSql = new Map<string, string>();
    const migrationFiles = (await readdir(migrationsDirectory, { withFileTypes: true }))
        .filter(entry => entry.isFile() && entry.name.endsWith(".sql"))
        .map(entry => entry.name);

    const parsedBaselines = baselineManifests.map(baselineManifest =>
        parseSearchMigrationManifest(baselineManifest, "Baseline manifest")
    );

    for (const baselineManifest of parsedBaselines) {
        verifyManifestPrefix(manifest, baselineManifest);
    }

    const longestBaseline = parsedBaselines.reduce<SearchMigrationManifest | undefined>(
        (longest, baseline) =>
            longest === undefined || baseline.records.length > longest.records.length ? baseline : longest,
        undefined
    );

    if (longestBaseline !== undefined) {
        verifyAppendOnlyManifest(manifest, longestBaseline);
    }

    verifyUniqueMigrationNumbers(migrationFiles);

    for (const record of records) {
        if (latest.has(record.collection) && latest.get(record.collection)?.migration === record.migration) {
            throw new Error(`Search migration ${record.migration} is recorded twice for ${record.collection}.`);
        }

        latest.set(record.collection, record);

        if (!migrationFiles.includes(record.migration)) {
            throw new Error(
                `Search migration ${record.migration} is not a numbered SQL file in the migrations directory.`
            );
        }

        const path = new URL(record.migration, migrationsDirectory);
        const migration = await readFile(path);
        const actualMigrationHash = sha256(migration);

        migrationSql.set(record.migration, migration.toString("utf8"));

        if (actualMigrationHash !== record.migrationSha256) {
            throw new Error(
                `Search migration ${record.migration} changed after registration. `
                    + `Expected ${record.migrationSha256}, received ${actualMigrationHash}.`
            );
        }
    }

    for (const artifact of artifacts) {
        const record = latest.get(artifact.collection);

        if (record === undefined || record.status !== "active" || record.artifactSha256 !== artifact.sha256) {
            throw new Error(
                `Search declaration for Collection "${artifact.collection}" needs a new migration handoff. `
                    + `Current artifact SHA-256: ${artifact.sha256}. Do not edit a registered migration.\n\n`
                    + `${artifact.sql}\n`
            );
        }

        if (!migrationCarriesArtifact(migrationSql.get(record.migration)!, artifact.sql)) {
            throw new Error(
                `Search migration ${record.migration} does not carry the generated artifact for Collection `
                    + `"${artifact.collection}".`
            );
        }
    }

    for (const [collection, record] of latest) {
        if (record.status === "active" && !currentNames.has(collection)) {
            const removalSql = searchRemovalMigrationSql(collection);

            throw new Error(
                `Search migration for Collection "${collection}" is still active, but the Collection is no longer searchable. `
                    + `Append a removal migration record with artifact SHA-256 ${sha256(removalSql)} and this SQL:\n\n`
                    + `${removalSql}\n`
            );
        }

        if (record.status === "removed") {
            const removalSql = searchRemovalMigrationSql(collection);

            if (record.artifactSha256 !== sha256(removalSql)) {
                throw new Error(
                    `Removal migration handoff for Collection "${collection}" has the wrong artifact hash.`
                );
            }
            if (!migrationCarriesArtifact(migrationSql.get(record.migration)!, removalSql)) {
                throw new Error(
                    `Search migration ${record.migration} does not remove the generated search objects for Collection `
                        + `"${collection}".`
                );
            }
        }
    }

    return { artifacts, records };
}

function isMissingManifestAtRef(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("stderr" in error)) {
        return false;
    }

    const stderr = String((error as { stderr: unknown }).stderr);

    return /exists on disk, but not in|does not exist in/i.test(stderr);
}

async function manifestAtRef(ref: string, allowMissing: boolean): Promise<SearchMigrationManifest | undefined> {
    const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

    try {
        const { stdout } = await execFileAsync("git", ["show", `${ref}:apps/docs/migrations/search-manifest.json`], {
            cwd: repositoryRoot,
            encoding: "utf8"
        });

        return parseSearchMigrationManifest(JSON.parse(stdout) as unknown, `Search migration manifest at ${ref}`);
    } catch (error) {
        if (allowMissing && isMissingManifestAtRef(error)) {
            return undefined;
        }

        throw new Error(`Cannot read the search migration manifest from ${ref}.`, { cause: error });
    }
}

async function baselineSearchMigrationManifests(): Promise<SearchMigrationManifest[]> {
    const configuredRef = process.env.SEARCH_MIGRATION_BASE_REF;
    const targetRef = configuredRef ?? "origin/develop";
    const baselines = await Promise.all([
        manifestAtRef(targetRef, configuredRef === undefined),
        manifestAtRef("HEAD", true)
    ]);

    return baselines.filter((manifest): manifest is SearchMigrationManifest => manifest !== undefined);
}

export async function verifyCurrentSearchMigrations(): Promise<SearchMigrationVerification> {
    const migrationsDirectory = new URL("../migrations/", import.meta.url);
    const manifestPath = new URL("search-manifest.json", migrationsDirectory);
    const manifest = parseSearchMigrationManifest(
        JSON.parse(await readFile(manifestPath, "utf8")) as unknown,
        "Search migration manifest"
    );
    const baselineManifests = await baselineSearchMigrationManifests();

    return verifySearchMigrations({
        collections: contentModel.collections,
        manifest,
        migrationsDirectory,
        baselineManifests
    });
}
