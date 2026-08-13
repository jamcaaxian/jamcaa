import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@jamcaaxian/core";
import { richTextFromPlainText } from "@jamcaaxian/core/content";
import { loadSettings } from "@jamcaaxian/core/settings";
import {
    compareAndIncrementPublicAddressRevision,
    comparePublicAddressRevision,
    incrementPublicAddressRevision,
    publicAddressRevision,
    publicAddressState
} from "@/content/public-address-revision";
import { publicPostAddresses } from "@/content/public-addresses";
import { siteSettings, writeSiteSettings } from "@/content/settings";
import { formerPostAddresses, posts } from "@/content/store";

const database = createDatabase(env.DB);

async function reset() {
    await database.$client.exec("DELETE FROM post; DELETE FROM setting; DELETE FROM user; DELETE FROM category;");
    await database.$client.exec(
        "INSERT INTO category (id, name, slug) VALUES ('jamcaa-default-category', 'General', 'general')"
    );
    await database.$client.exec(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('author', 'Author', 'author@example.com', 1, 1, 1)"
    );
}

async function published(slug: string) {
    return posts(database).create({
        slug,
        authorId: "author",
        categoryId: "jamcaa-default-category",
        status: "published",
        publishedAt: new Date("2026-08-12T00:00:00.000Z"),
        title: slug,
        excerpt: null,
        body: {
            version: 1,
            blocks: [{ id: "body", type: "builtin.richText", props: { document: richTextFromPlainText(slug) } }]
        }
    });
}

describe("Former Addresses", () => {
    beforeEach(reset);

    it("retains exact paths for an Entry and resolves the owner", async () => {
        const entry = await published("current");
        const addresses = formerPostAddresses(database);

        await addresses.retain(entry.id, "/former/path");

        await expect(addresses.entryAt("/former/path")).resolves.toBe(entry.id);
        await expect(addresses.pathsFor(entry.id)).resolves.toEqual(["/former/path"]);
    });

    it("does not let one Entry claim another Entry's Former Address", async () => {
        const first = await published("first");
        const second = await published("second");
        const addresses = formerPostAddresses(database);

        await addresses.retain(first.id, "/former");

        await expect(addresses.retain(second.id, "/former")).rejects.toThrow(/belongs to another Entry/i);
    });

    it("removes Former Addresses with their owning Entry", async () => {
        const entry = await published("current");
        const addresses = formerPostAddresses(database);
        await addresses.retain(entry.id, "/former");

        await posts(database).remove(entry.id);

        await expect(addresses.entryAt("/former")).resolves.toBeUndefined();
    });
});

describe("public Post address lifecycle", () => {
    beforeEach(reset);

    it("retains a published Post's previous canonical path after a slug change", async () => {
        const entry = await published("before");
        const addresses = publicPostAddresses(database);

        await addresses.recordEntryChange(entry, { ...entry, slug: "after" }, "/{slug}");
        await posts(database).update(entry.id, { slug: "after" });

        await expect(addresses.formerAt(["before"], "/{slug}")).resolves.toMatchObject({
            address: "/after",
            entry: { id: entry.id, slug: "after" }
        });
    });

    it.each(["draft", "archived"] as const)("keeps a Former Address hidden while its Post is %s", async status => {
        const entry = await published("before");
        const addresses = publicPostAddresses(database);
        await addresses.recordEntryChange(entry, { ...entry, slug: "after" }, "/{slug}");
        await posts(database).update(entry.id, { slug: "after", status });

        await expect(addresses.formerAt(["before"], "/{slug}")).resolves.toBeUndefined();
    });

    it("keeps the last published path when a draft changes its slug later", async () => {
        const entry = await published("before");
        const addresses = publicPostAddresses(database);

        await addresses.recordEntryChange(entry, { ...entry, status: "draft" }, "/{slug}");
        await posts(database).update(entry.id, { status: "draft" });
        const draft = await posts(database).byId(entry.id);

        expect(draft).toBeDefined();
        await addresses.recordEntryChange(draft!, { ...draft!, slug: "after" }, "/{slug}");
        await posts(database).update(entry.id, { slug: "after" });
        await posts(database).update(entry.id, { status: "published" });

        await expect(addresses.formerAt(["before"], "/{slug}")).resolves.toMatchObject({ address: "/after" });
    });

    it("rewrites every published Post directly through the latest permalink setting", async () => {
        const first = await published("first");
        const second = await published("second");
        const addresses = publicPostAddresses(database);

        await writeSiteSettings(database, { "permalink.post": "/journal/{slug}" });
        await writeSiteSettings(database, { "permalink.post": "/notes/{slug}" });

        await expect(addresses.formerAt(["first"], "/notes/{slug}")).resolves.toMatchObject({
            address: "/notes/first"
        });
        await expect(addresses.formerAt(["journal", "first"], "/notes/{slug}")).resolves.toMatchObject({
            address: "/notes/first"
        });
        await expect(addresses.formerAt(["second"], "/notes/{slug}")).resolves.toMatchObject({
            address: "/notes/second",
            entry: { id: second.id }
        });
        await expect(formerPostAddresses(database).pathsFor(first.id)).resolves.toEqual(["/first", "/journal/first"]);
    });

    it("refuses current and Former Address collisions in both directions", async () => {
        const first = await published("first");
        const second = await published("second");
        const addresses = publicPostAddresses(database);
        await formerPostAddresses(database).retain(first.id, "/claimed");

        await expect(addresses.assertCurrentAvailable(second.id, "/claimed")).rejects.toThrow(/Former Address/i);
        await expect(addresses.retain(first.id, "/second", "/{slug}")).rejects.toThrow(/canonical address/i);
    });

    it("writes a permalink change and its Former Addresses atomically", async () => {
        const entry = await published("first");

        await writeSiteSettings(database, { "permalink.post": "/journal/{slug}" });

        await expect(formerPostAddresses(database).pathsFor(entry.id)).resolves.toEqual(["/first"]);
        await expect(publicPostAddresses(database).formerAt(["first"], "/journal/{slug}")).resolves.toMatchObject({
            address: "/journal/first"
        });
    });

    it("reads the permalink and public address revision from one database snapshot", async () => {
        await database.$client.batch([
            database.$client
                .prepare("INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?)")
                .bind("permalink.post", JSON.stringify("/journal/{slug}"), 1),
            database.$client
                .prepare("INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?)")
                .bind("platform.publicAddressRevision", "7", 1)
        ]);

        await expect(publicAddressState(database, "permalink.post")).resolves.toEqual({
            settingValue: JSON.stringify("/journal/{slug}"),
            revision: 7
        });
    });

    it("retains the intermediate canonical address when permalink changes race", async () => {
        const entry = await published("first");

        await Promise.all([
            writeSiteSettings(database, { "permalink.post": "/journal/{slug}" }),
            writeSiteSettings(database, { "permalink.post": "/notes/{slug}" })
        ]);

        const finalPattern = (await loadSettings(database, siteSettings)).get("permalink.post");
        const intermediate = finalPattern === "/journal/{slug}" ? "/notes/first" : "/journal/first";
        const paths = await formerPostAddresses(database).pathsFor(entry.id);

        expect(paths).toContain("/first");
        expect(paths).toContain(intermediate);
    });

    it("does not let a concurrent stale no-op permalink write erase address history", async () => {
        const entry = await published("first");

        await Promise.all([
            writeSiteSettings(database, { "permalink.post": "/journal/{slug}" }),
            writeSiteSettings(database, { "permalink.post": "/{slug}" })
        ]);

        const finalPattern = (await loadSettings(database, siteSettings)).get("permalink.post");
        const intermediate = finalPattern === "/journal/{slug}" ? "/first" : "/journal/first";

        await expect(formerPostAddresses(database).pathsFor(entry.id)).resolves.toContain(intermediate);
    });

    it("does not discard the last published path when a draft's setting returns to it", async () => {
        const entry = await published("first");
        const addresses = publicPostAddresses(database);
        await addresses.recordEntryChange(entry, { ...entry, status: "draft" }, "/{slug}");
        await posts(database).update(entry.id, { status: "draft" });

        await writeSiteSettings(database, { "permalink.post": "/journal/{slug}" });
        await writeSiteSettings(database, { "permalink.post": "/{slug}" });

        await expect(formerPostAddresses(database).pathsFor(entry.id)).resolves.toContain("/first");
    });

    it("leaves settings and history unchanged when a new canonical address is already retained", async () => {
        const first = await published("first");
        await published("second");
        await formerPostAddresses(database).retain(first.id, "/journal/second");

        await expect(writeSiteSettings(database, { "permalink.post": "/journal/{slug}" })).rejects.toThrow(
            /Former Address/i
        );

        const stored = await database.$client
            .prepare("SELECT value FROM setting WHERE key = 'permalink.post'")
            .first<{ value: string }>();
        expect(stored).toBeNull();
        await expect(formerPostAddresses(database).pathsFor(first.id)).resolves.toEqual(["/journal/second"]);
    });

    it("rolls back a setting batch when its public address revision is stale", async () => {
        await incrementPublicAddressRevision(database);

        await expect(
            database.$client.batch([
                database.$client
                    .prepare("INSERT INTO setting (key, value, updated_at) VALUES ('site.title', ?, ?)")
                    .bind(JSON.stringify("Stale title"), Date.now()),
                ...compareAndIncrementPublicAddressRevision(database, 0)
            ])
        ).rejects.toThrow();

        await expect(publicAddressRevision(database)).resolves.toBe(1);
        await expect(
            database.$client.prepare("SELECT value FROM setting WHERE key = 'site.title'").first()
        ).resolves.toBeNull();
    });

    it("rolls back content-only address cleanup when its permalink snapshot is stale", async () => {
        const entry = await published("first");
        await formerPostAddresses(database).retain(entry.id, "/former");
        await incrementPublicAddressRevision(database);

        await expect(
            database.$client.batch([
                database.$client
                    .prepare("DELETE FROM _jamcaa_post_former_address WHERE entry_id = ? AND path = ?")
                    .bind(entry.id, "/former"),
                ...comparePublicAddressRevision(database, 0)
            ])
        ).rejects.toThrow();

        await expect(formerPostAddresses(database).pathsFor(entry.id)).resolves.toEqual(["/former"]);
        await expect(publicAddressRevision(database)).resolves.toBe(1);
    });
});
