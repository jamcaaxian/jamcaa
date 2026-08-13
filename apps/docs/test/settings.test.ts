import { createDatabase } from "@jamcaaxian/core";
import { defineCollection, permalinkSettings, text } from "@jamcaaxian/core/content";
import {
    coreSettings,
    defineSettings,
    forgetCachedSettings,
    getSettings,
    loadSettings,
    writeSettings
} from "@jamcaaxian/core/settings";
import { siteSettings } from "@/content/settings";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const catalogue = defineSettings({
    "site.title": { kind: "text", label: "Title", default: "jamcaa" },
    "site.public": { kind: "flag", label: "Public", default: true },
    "post.perPage": { kind: "number", label: "Per page", default: 10 },
    "post.order": { kind: "choice", label: "Order", of: ["newest", "oldest"], default: "newest" }
});

function database() {
    return createDatabase(env.DB);
}

describe("settings", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM setting");
        forgetCachedSettings();
    });

    it("uses the declared default when nothing is stored", async () => {
        const settings = await loadSettings(database(), catalogue);

        expect(settings.get("site.title")).toBe("jamcaa");
        expect(settings.get("post.perPage")).toBe(10);
    });

    it("returns what was written", async () => {
        await writeSettings(database(), catalogue, { "site.title": "Docs", "post.perPage": 25 });

        const settings = await loadSettings(database(), catalogue);

        expect(settings.get("site.title")).toBe("Docs");
        expect(settings.get("post.perPage")).toBe(25);
    });

    it("gives each setting its own value when several are written at once", async () => {
        // A careless upsert gives every row the last one's value.
        await writeSettings(database(), catalogue, {
            "site.title": "First",
            "site.public": false,
            "post.order": "oldest"
        });
        await writeSettings(database(), catalogue, {
            "site.title": "Second",
            "site.public": true,
            "post.order": "newest"
        });

        const settings = await loadSettings(database(), catalogue);

        expect(settings.all()).toMatchObject({ "site.title": "Second", "site.public": true, "post.order": "newest" });
    });

    it("falls back to the default when a stored value no longer fits", async () => {
        await env.DB.prepare("INSERT INTO setting (key, value) VALUES ('post.perPage', ?)")
            .bind(JSON.stringify("lots"))
            .run();

        const settings = await loadSettings(database(), catalogue);

        expect(settings.get("post.perPage")).toBe(10);
    });

    it("survives a row that is not JSON at all", async () => {
        await env.DB.prepare("INSERT INTO setting (key, value) VALUES ('site.title', 'not json')").run();

        expect((await loadSettings(database(), catalogue)).get("site.title")).toBe("jamcaa");
    });

    it("refuses to store a setting nothing declares", async () => {
        await expect(writeSettings(database(), catalogue, { "site.mystery": "x" } as never)).rejects.toThrow(
            /not declared/
        );
    });

    it("refuses a value the setting would not accept", async () => {
        await expect(writeSettings(database(), catalogue, { "post.order": "sideways" } as never)).rejects.toThrow(
            /not a value it accepts/
        );
    });

    it("refuses a pattern the setting itself objects to", async () => {
        // The shape is right — it is a string — but nothing could format with it.
        await expect(writeSettings(database(), coreSettings, { "format.date": "YYYY-MM-DD" })).rejects.toThrow(
            /Use `yyyy` instead of `YYYY`/
        );
    });

    it("refuses an address that would be the same for every entry", async () => {
        const permalinks = permalinkSettings([
            defineCollection({
                name: "post",
                label: "Post",
                plural: "Posts",
                fields: { title: text({ required: true }) }
            })
        ]);

        await expect(writeSettings(database(), permalinks, { "permalink.post": "/blog" })).rejects.toThrow(
            /must include \{slug\}/
        );
    });

    it("refuses a permalink pattern inside a reserved Site namespace", async () => {
        await expect(writeSettings(database(), siteSettings, { "permalink.post": "/admin/{slug}" })).rejects.toThrow(
            /belongs to the Site/
        );
    });

    it("reuses what it read until the cache expires", async () => {
        const now = Date.now();

        await writeSettings(database(), catalogue, { "site.title": "Before" });
        expect((await getSettings(database(), catalogue, now)).get("site.title")).toBe("Before");

        await env.DB.prepare("UPDATE setting SET value = ? WHERE key = 'site.title'")
            .bind(JSON.stringify("After"))
            .run();

        expect((await getSettings(database(), catalogue, now + 1_000)).get("site.title")).toBe("Before");
        expect((await getSettings(database(), catalogue, now + 60_000)).get("site.title")).toBe("After");
    });

    it("stops serving the old values once something is written", async () => {
        await getSettings(database(), catalogue);
        await writeSettings(database(), catalogue, { "site.title": "Fresh" });

        expect((await getSettings(database(), catalogue)).get("site.title")).toBe("Fresh");
    });
});
