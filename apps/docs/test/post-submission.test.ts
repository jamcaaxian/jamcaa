import { describe, expect, it } from "vitest";
import { richTextFromPlainText } from "@jamcaa/core/content";
import { readPostSubmission } from "@/app/admin/posts/post-submission";

function form(body: string, title = "A title") {
    const data = new FormData();
    data.set("title", title);
    data.set("body", body);
    data.set("status", "draft");
    return data;
}

describe("reading a Post submission", () => {
    it("accepts a validated ProseMirror document", () => {
        const body = richTextFromPlainText("A body");

        expect(readPostSubmission(form(JSON.stringify(body)))).toMatchObject({ title: "A title", body });
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
});
