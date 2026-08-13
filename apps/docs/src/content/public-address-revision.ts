import type { Database } from "@jamcaaxian/core/db";

const REVISION_KEY = "platform.publicAddressRevision";

function revisionValue(value: string | undefined): number {
    if (value === undefined) {
        return 0;
    }

    if (!/^\d+$/.test(value)) {
        throw new Error("The public address revision is invalid.");
    }

    return Number(value);
}

export async function publicAddressState(
    database: Database,
    settingKey: string
): Promise<{ revision: number; settingValue: string | undefined }> {
    const row = await database.$client
        .prepare(
            "SELECT "
                + "(SELECT value FROM setting WHERE key = ?) AS settingValue, "
                + "(SELECT value FROM setting WHERE key = ?) AS revisionValue"
        )
        .bind(settingKey, REVISION_KEY)
        .first<{ settingValue: string | null; revisionValue: string | null }>();

    return { revision: revisionValue(row?.revisionValue ?? undefined), settingValue: row?.settingValue ?? undefined };
}

export async function publicAddressRevision(database: Database): Promise<number> {
    const row = await database.$client
        .prepare("SELECT value FROM setting WHERE key = ?")
        .bind(REVISION_KEY)
        .first<{ value: string }>();

    return revisionValue(row?.value);
}

export function compareAndIncrementPublicAddressRevision(database: Database, expected: number): D1PreparedStatement[] {
    const now = Date.now();

    return [
        database.$client
            .prepare("INSERT INTO setting (key, value, updated_at) VALUES (?, '0', ?) ON CONFLICT(key) DO NOTHING")
            .bind(REVISION_KEY, now),
        database.$client
            .prepare(
                "UPDATE setting SET value = CASE WHEN value = ? THEN CAST(CAST(value AS INTEGER) + 1 AS TEXT) ELSE NULL END, updated_at = ? WHERE key = ?"
            )
            .bind(String(expected), now, REVISION_KEY)
    ];
}

export function comparePublicAddressRevision(database: Database, expected: number): D1PreparedStatement[] {
    const now = Date.now();

    return [
        database.$client
            .prepare("INSERT INTO setting (key, value, updated_at) VALUES (?, '0', ?) ON CONFLICT(key) DO NOTHING")
            .bind(REVISION_KEY, now),
        database.$client
            .prepare("UPDATE setting SET value = CASE WHEN value = ? THEN value ELSE NULL END WHERE key = ?")
            .bind(String(expected), REVISION_KEY)
    ];
}

export async function incrementPublicAddressRevision(database: Database): Promise<void> {
    const now = Date.now();

    await database.$client
        .prepare("INSERT INTO setting (key, value, updated_at) VALUES (?, '0', ?) ON CONFLICT(key) DO NOTHING")
        .bind(REVISION_KEY, now)
        .run();
    await database.$client
        .prepare("UPDATE setting SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = ? WHERE key = ?")
        .bind(now, REVISION_KEY)
        .run();
}
