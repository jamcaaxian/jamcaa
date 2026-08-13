import { createDatabase } from "@jamcaaxian/core";
import { createAuth } from "@jamcaaxian/core/auth";
import { richTextFromPlainText } from "@jamcaaxian/core/content";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { commitPostState, restorePostRevision } from "@/content/post-writes";
import { postRevisions, posts, type PostRevisionSnapshot } from "@/content/store";

const categoryId = "jamcaa-default-category";

function database() {
    return createDatabase(env.DB);
}

async function anAuthor() {
    const auth = createAuth({ database: database(), secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });
    const { user } = await auth.api.signUpEmail({
        body: {
            name: "Revision Author",
            email: "revision-author@example.com",
            password: "correct-horse-battery-staple"
        }
    });

    return user.id;
}

function snapshot(title: string, tagIds: string[] = []): PostRevisionSnapshot {
    return {
        slug: title.toLowerCase().replaceAll(" ", "-"),
        status: "draft",
        publishedAt: null,
        categoryId,
        fields: {
            title,
            excerpt: null,
            body: {
                version: 1,
                blocks: [
                    {
                        id: "body",
                        type: "builtin.richText",
                        props: { document: richTextFromPlainText(`${title} body`) }
                    }
                ]
            }
        },
        tagIds
    };
}

describe("Post Revisions", () => {
    beforeEach(async () => {
        await env.DB.exec("DELETE FROM _jamcaa_post_revision");
        await env.DB.exec("DELETE FROM _jamcaa_post_tag");
        await env.DB.exec("DELETE FROM post");
        await env.DB.exec("DELETE FROM tag");
        await env.DB.exec("DELETE FROM category WHERE id <> 'jamcaa-default-category'");
        await env.DB.exec("DELETE FROM setting");
        await env.DB.exec("DELETE FROM session");
        await env.DB.exec("DELETE FROM account");
        await env.DB.exec("DELETE FROM user");
    });

    it("keeps append-only snapshots isolated to their Entry and newest first", async () => {
        const authorId = await anAuthor();
        const first = await posts(database()).create({
            slug: "first",
            authorId,
            categoryId,
            title: "First",
            body: {
                version: 1,
                blocks: [
                    { id: "body", type: "builtin.richText", props: { document: richTextFromPlainText("First body") } }
                ]
            }
        });
        const second = await posts(database()).create({
            slug: "second",
            authorId,
            categoryId,
            title: "Second",
            body: {
                version: 1,
                blocks: [
                    { id: "body", type: "builtin.richText", props: { document: richTextFromPlainText("Second body") } }
                ]
            }
        });
        const revisions = postRevisions(database());

        const older = await revisions.append(first.id, snapshot("Older"));
        const newer = await revisions.append(first.id, snapshot("Newer", ["tag-1"]));
        await revisions.append(second.id, snapshot("Other Entry"));

        await expect(revisions.list(first.id)).resolves.toMatchObject([
            { id: newer.id, snapshot: { fields: { title: "Newer" }, tagIds: ["tag-1"] } },
            { id: older.id, snapshot: { fields: { title: "Older" }, tagIds: [] } }
        ]);
        await expect(revisions.byId(first.id, newer.id)).resolves.toMatchObject({
            snapshot: { fields: { title: "Newer" }, tagIds: ["tag-1"] }
        });
        await expect(revisions.byId(second.id, newer.id)).resolves.toBeUndefined();
    });

    it("removes Revision history when its Entry is deleted", async () => {
        const authorId = await anAuthor();
        const entry = await posts(database()).create({
            slug: "temporary",
            authorId,
            categoryId,
            title: "Temporary",
            body: {
                version: 1,
                blocks: [
                    {
                        id: "body",
                        type: "builtin.richText",
                        props: { document: richTextFromPlainText("Temporary body") }
                    }
                ]
            }
        });
        const revisions = postRevisions(database());

        await revisions.append(entry.id, snapshot("Temporary"));
        await posts(database()).remove(entry.id);

        await expect(revisions.list(entry.id)).resolves.toEqual([]);
    });

    it("captures each successfully stored Post state once", async () => {
        const authorId = await anAuthor();
        await env.DB.prepare("INSERT INTO tag (id, name, slug) VALUES (?, ?, ?)")
            .bind("tag-1", "First tag", "first-tag")
            .run();

        const created = await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                title: "First title",
                excerpt: "First excerpt",
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("First body") }
                        }
                    ]
                },
                status: "draft",
                slug: "first-title",
                categoryId,
                tagIds: ["tag-1", "tag-1"]
            }
        });

        await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                id: created.id,
                title: "Published title",
                excerpt: "Published excerpt",
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Published body") }
                        }
                    ]
                },
                status: "published",
                slug: "published-title",
                categoryId,
                tagIds: []
            }
        });

        const history = await postRevisions(database()).list(created.id);

        expect(history).toHaveLength(2);
        expect(history[0]?.snapshot).toMatchObject({
            slug: "published-title",
            status: "published",
            categoryId,
            fields: {
                title: "Published title",
                excerpt: "Published excerpt",
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Published body") }
                        }
                    ]
                }
            },
            tagIds: []
        });
        expect(history[0]?.snapshot.publishedAt).toEqual(expect.any(Number));
        expect(history[1]?.snapshot).toEqual({
            slug: "first-title",
            status: "draft",
            publishedAt: null,
            categoryId,
            fields: {
                title: "First title",
                excerpt: "First excerpt",
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("First body") }
                        }
                    ]
                }
            },
            tagIds: ["tag-1"]
        });
    });

    it("restores a source Revision by appending the actual resulting state", async () => {
        const authorId = await anAuthor();
        const entry = await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                title: "Original",
                excerpt: "Original excerpt",
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Original body") }
                        }
                    ]
                },
                status: "published",
                slug: "original",
                categoryId,
                tagIds: []
            }
        });
        const source = (await postRevisions(database()).list(entry.id))[0];

        expect(source).toBeDefined();

        await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                id: entry.id,
                title: "Changed",
                excerpt: "Changed excerpt",
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Changed body") }
                        }
                    ]
                },
                status: "draft",
                slug: "changed",
                categoryId,
                tagIds: []
            }
        });

        const restored = await restorePostRevision({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            entryId: entry.id,
            revisionId: source!.id
        });
        const history = await postRevisions(database()).list(entry.id);

        expect(restored).toMatchObject({
            id: entry.id,
            authorId,
            title: "Original",
            excerpt: "Original excerpt",
            body: {
                version: 1,
                blocks: [
                    {
                        id: "body",
                        type: "builtin.richText",
                        props: { document: richTextFromPlainText("Original body") }
                    }
                ]
            },
            status: "published",
            slug: "original",
            publishedAt: source!.snapshot.publishedAt === null ? null : new Date(source!.snapshot.publishedAt)
        });
        expect(history).toHaveLength(3);
        expect(history[0]?.id).not.toBe(source!.id);
        expect(history[0]?.snapshot).toEqual(source!.snapshot);
        await expect(postRevisions(database()).byId(entry.id, source!.id)).resolves.toEqual(source);
    });

    it("leaves the Post and history unchanged when restored Taxonomy no longer exists", async () => {
        const authorId = await anAuthor();
        await env.DB.prepare("INSERT INTO tag (id, name, slug) VALUES (?, ?, ?)")
            .bind("temporary-tag", "Temporary", "temporary")
            .run();
        const entry = await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                title: "Tagged",
                excerpt: null,
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Tagged body") }
                        }
                    ]
                },
                status: "draft",
                slug: "tagged",
                categoryId,
                tagIds: ["temporary-tag"]
            }
        });
        const source = (await postRevisions(database()).list(entry.id))[0];
        await env.DB.prepare("DELETE FROM _jamcaa_post_tag WHERE tag_id = ?").bind("temporary-tag").run();
        await env.DB.prepare("DELETE FROM tag WHERE id = ?").bind("temporary-tag").run();
        await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                id: entry.id,
                title: "Current",
                excerpt: null,
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Current body") }
                        }
                    ]
                },
                status: "draft",
                slug: "current",
                categoryId,
                tagIds: []
            }
        });

        await expect(
            restorePostRevision({
                database: database(),
                actorId: authorId,
                mayPublish: true,
                entryId: entry.id,
                revisionId: source!.id
            })
        ).rejects.toThrow(/tag.*no longer exists/i);

        await expect(posts(database()).byId(entry.id)).resolves.toMatchObject({ title: "Current", slug: "current" });
        await expect(postRevisions(database()).list(entry.id)).resolves.toHaveLength(2);
    });

    it("does not partially restore a published state without publish capability", async () => {
        const authorId = await anAuthor();
        const entry = await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                title: "Published",
                excerpt: null,
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Published body") }
                        }
                    ]
                },
                status: "published",
                slug: "published",
                categoryId,
                tagIds: []
            }
        });
        const source = (await postRevisions(database()).list(entry.id))[0];

        await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                id: entry.id,
                title: "Draft",
                excerpt: null,
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Draft body") }
                        }
                    ]
                },
                status: "draft",
                slug: "draft",
                categoryId,
                tagIds: []
            }
        });

        await expect(
            restorePostRevision({
                database: database(),
                actorId: authorId,
                mayPublish: false,
                entryId: entry.id,
                revisionId: source!.id
            })
        ).rejects.toThrow(/publish/i);

        await expect(posts(database()).byId(entry.id)).resolves.toMatchObject({ title: "Draft", slug: "draft" });
        await expect(postRevisions(database()).list(entry.id)).resolves.toHaveLength(2);
    });

    it("does not let Restore take a published Post offline without publish capability", async () => {
        const authorId = await anAuthor();
        const entry = await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                title: "Archived source",
                excerpt: null,
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Archived body") }
                        }
                    ]
                },
                status: "archived",
                slug: "same-address",
                categoryId,
                tagIds: [],
                publishedAt: new Date("2026-08-12T00:00:00.000Z")
            }
        });
        const source = (await postRevisions(database()).list(entry.id))[0];

        await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                id: entry.id,
                title: "Published now",
                excerpt: null,
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Published body") }
                        }
                    ]
                },
                status: "published",
                slug: "same-address",
                categoryId,
                tagIds: [],
                publishedAt: new Date("2026-08-12T00:00:00.000Z")
            }
        });

        await expect(
            restorePostRevision({
                database: database(),
                actorId: authorId,
                mayPublish: false,
                entryId: entry.id,
                revisionId: source!.id
            })
        ).rejects.toThrow(/publish/i);

        await expect(posts(database()).byId(entry.id)).resolves.toMatchObject({
            title: "Published now",
            status: "published"
        });
        await expect(postRevisions(database()).list(entry.id)).resolves.toHaveLength(2);
    });

    it("does not let an ordinary save clear publication time without publish capability", async () => {
        const authorId = await anAuthor();
        const publishedAt = new Date("2026-08-12T00:00:00.000Z");
        const entry = await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                title: "Archived",
                excerpt: null,
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Archived body") }
                        }
                    ]
                },
                status: "archived",
                slug: "archived",
                categoryId,
                tagIds: [],
                publishedAt
            }
        });

        await expect(
            commitPostState({
                database: database(),
                actorId: authorId,
                mayPublish: false,
                desired: {
                    id: entry.id,
                    title: "Draft attempt",
                    excerpt: null,
                    body: {
                        version: 1,
                        blocks: [
                            {
                                id: "body",
                                type: "builtin.richText",
                                props: { document: richTextFromPlainText("Draft body") }
                            }
                        ]
                    },
                    status: "draft",
                    slug: entry.slug,
                    categoryId,
                    tagIds: []
                }
            })
        ).rejects.toThrow(/publish/i);

        await expect(posts(database()).byId(entry.id)).resolves.toMatchObject({
            title: "Archived",
            status: "archived",
            publishedAt
        });
        await expect(postRevisions(database()).list(entry.id)).resolves.toHaveLength(1);
    });

    it("rolls back Entry and Tag changes when Revision append fails", async () => {
        const authorId = await anAuthor();
        await env.DB.prepare("INSERT INTO tag (id, name, slug) VALUES (?, ?, ?)")
            .bind("valid-tag", "Valid", "valid")
            .run();
        const entry = await commitPostState({
            database: database(),
            actorId: authorId,
            mayPublish: true,
            desired: {
                title: "Before",
                excerpt: null,
                body: {
                    version: 1,
                    blocks: [
                        {
                            id: "body",
                            type: "builtin.richText",
                            props: { document: richTextFromPlainText("Before body") }
                        }
                    ]
                },
                status: "draft",
                slug: "before",
                categoryId,
                tagIds: []
            }
        });

        await env.DB.exec(
            "CREATE TRIGGER refuse_post_revision BEFORE INSERT ON _jamcaa_post_revision BEGIN SELECT RAISE(ABORT, 'revision refused'); END"
        );

        await expect(
            commitPostState({
                database: database(),
                actorId: authorId,
                mayPublish: true,
                desired: {
                    id: entry.id,
                    title: "After",
                    excerpt: null,
                    body: {
                        version: 1,
                        blocks: [
                            {
                                id: "body",
                                type: "builtin.richText",
                                props: { document: richTextFromPlainText("After body") }
                            }
                        ]
                    },
                    status: "draft",
                    slug: "after",
                    categoryId,
                    tagIds: ["valid-tag"]
                }
            })
        ).rejects.toThrow(/revision refused/i);

        await env.DB.exec("DROP TRIGGER refuse_post_revision");

        await expect(posts(database()).byId(entry.id)).resolves.toMatchObject({ title: "Before", slug: "before" });
        await expect(postRevisions(database()).list(entry.id)).resolves.toHaveLength(1);
        const memberships = await env.DB.prepare("SELECT tag_id AS tagId FROM _jamcaa_post_tag WHERE entry_id = ?")
            .bind(entry.id)
            .all<{ tagId: string }>();
        expect(memberships.results).toEqual([]);
    });
});
