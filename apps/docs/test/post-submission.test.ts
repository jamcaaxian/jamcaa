import { describe, expect, it } from "vitest";
import { richTextFromPlainText } from "@jamcaaxian/core/content";
import { readPostSubmission } from "@/app/admin/posts/post-submission";

function form(body: string, title = "A title") {
    const data = new FormData();
    data.set("title", title);
    data.set("body", body);
    data.set("status", "draft");
    data.set("categoryId", "jamcaa-default-category");
    return data;
}

describe("reading a Post submission", () => {
    it("accepts a validated ProseMirror document", () => {
        const body = richTextFromPlainText("A body");

        expect(readPostSubmission(form(JSON.stringify(body)))).toMatchObject({
            title: "A title",
            body: { version: 1, blocks: [{ id: "legacy-body", type: "builtin.richText", props: { document: body } }] }
        });
    });

    it("rejects malformed and visually empty bodies", () => {
        expect(readPostSubmission(form("not json"))).toEqual({ error: "The Post body is not valid rich text." });
        expect(readPostSubmission(form('{"type":"doc","content":[{"type":"paragraph","content":[]}]}'))).toEqual({
            error: "A Post needs a title and a body."
        });
    });

    it("rejects unsupported nodes before they reach storage", () => {
        expect(readPostSubmission(form('{"type":"doc","content":[{"type":"html"}]}'))).toEqual({
            error: "The Post body is not valid rich text."
        });
    });

    it("requires a Category and reads selected Tags", () => {
        const data = form(JSON.stringify(richTextFromPlainText("A body")));
        data.delete("categoryId");

        expect(readPostSubmission(data)).toEqual({ error: "Select a category." });

        data.set("categoryId", "category-one");
        data.append("tagIds", "tag-one");
        data.append("tagIds", "tag-two");

        expect(readPostSubmission(data)).toMatchObject({ categoryId: "category-one", tagIds: ["tag-one", "tag-two"] });
    });

    it("normalises optional declared text Fields through the Collection declaration", () => {
        const data = form(JSON.stringify(richTextFromPlainText("A body")));
        data.set("excerpt", "  A short summary  ");

        expect(readPostSubmission(data)).toMatchObject({ excerpt: "A short summary" });

        data.set("excerpt", "");
        expect(readPostSubmission(data)).toMatchObject({ excerpt: "" });
    });

    it("rejects repeated declared scalar Fields", () => {
        const data = form(JSON.stringify(richTextFromPlainText("A body")));
        data.append("title", "Another title");

        expect(readPostSubmission(data)).toEqual({ error: "One of the Post fields is not valid." });
    });
});
