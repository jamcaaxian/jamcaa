import { env } from "cloudflare:test";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../db/client";
import { checkPageAddress, pageStore, type PageRecord } from "./pages";
import type { BlockDocument } from "./blocks";
import { builtinBlocksForTest } from "./pages-test-blocks";

async function prepareTable() {
    const db = createDatabase(env.DB);

    await db.run(sql`drop table if exists page`);
    await db.run(sql`
        create table page (
            id text primary key,
            locale text not null default 'und',
            translation_id text,
            title text not null,
            address text not null,
            body text not null,
            status text not null default 'draft',
            created_at integer not null,
            updated_at integer not null,
            unique(locale, address),
            unique(translation_id, locale)
        )
    `);

    return db;
}

function body(blocks: BlockDocument["blocks"]): BlockDocument {
    return { version: 1, blocks };
}

describe("checkPageAddress", () => {
    it("accepts the root and simple paths", () => {
        expect(checkPageAddress("/")).toBeUndefined();
        expect(checkPageAddress("/about")).toBeUndefined();
        expect(checkPageAddress("/work/portfolio")).toBeUndefined();
    });

    it("rejects relative, trailing-slash and doubled-slash addresses", () => {
        expect(checkPageAddress("about")).toBeDefined();
        expect(checkPageAddress("/about/")).toBeDefined();
        expect(checkPageAddress("/a//b")).toBeDefined();
    });
});

describe("pageStore", () => {
    beforeEach(async () => {
        await prepareTable();
    });

    function store() {
        return pageStore(createDatabase(env.DB), builtinBlocksForTest);
    }

    function pageOf(result: Awaited<ReturnType<ReturnType<typeof store>["create"]>>): PageRecord {
        expect(result.status).not.toBe("rejected");

        return (result as { page: PageRecord }).page;
    }

    it("creates a page and reads it back", async () => {
        const page = pageOf(
            await store().create({
                title: "Home",
                address: "/",
                body: body([{ id: "a", type: "builtin.divider", props: {} }])
            })
        );

        expect(page.title).toBe("Home");
        expect(page.locale).toBe("und");
        expect(page.translationId).toBe(page.id);
        expect(page.body.blocks).toHaveLength(1);
    });

    it("rejects a body with an invalid block", async () => {
        const result = await store().create({
            title: "Home",
            address: "/",
            body: body([{ id: "a", type: "builtin.heading", props: { level: 9 } }])
        });

        expect(result.status).toBe("rejected");
    });

    it("rejects a duplicate address but allows a page to keep its own", async () => {
        const created = await store().create({ title: "Home", address: "/", body: body([]) });
        const page = pageOf(created);

        const duplicate = await store().create({ title: "Other", address: "/", body: body([]) });

        expect(duplicate.status).toBe("rejected");

        const kept = await store().update(page.id, { title: "Renamed home" });

        expect(kept.status).toBe("updated");
        expect((kept as { page: PageRecord }).page.title).toBe("Renamed home");
    });

    it("only serves published pages by address", async () => {
        const created = await store().create({ title: "Draft", address: "/draft", body: body([]) });
        const page = pageOf(created);

        expect(await store().byAddress("/draft")).toBeUndefined();

        await store().update(page.id, { status: "published" });

        expect(await store().byAddress("/draft")).toBeDefined();
    });

    it("allows the same address in different Locales within one Translation Set", async () => {
        const english = pageOf(
            await store().create({ title: "Docs", address: "/docs", locale: "en-US", body: body([]) })
        );
        const chinese = pageOf(
            await store().create({
                title: "文档",
                address: "/docs",
                locale: "zh-Hans-CN",
                translationId: english.translationId,
                body: body([])
            })
        );

        expect(chinese.translationId).toBe(english.translationId);
        expect((await store().translations(english.translationId)).map(item => item.locale)).toEqual([
            "en-US",
            "zh-Hans-CN"
        ]);
    });
});
