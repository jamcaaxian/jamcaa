import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectionEditingControls, momentInputValue, momentSubmissionValue } from "./collection-editing-controls";
import { defaultCollectionEditingControlMessages } from "./messages";

describe("Collection Editing Controls", () => {
    it("formats moments for datetime-local without changing the represented local time", () => {
        const date = new Date("2026-08-12T08:45:00.000Z");
        const expected = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

        expect(momentInputValue(date)).toBe(expected);
        expect(momentInputValue(date.toISOString())).toBe(expected);
    });

    it("leaves absent and invalid moment values empty", () => {
        expect(momentInputValue(undefined)).toBe("");
        expect(momentInputValue(null)).toBe("");
        expect(momentInputValue("not-a-date")).toBe("");
    });

    it("submits a browser-local moment as an absolute ISO value", () => {
        const local = "2026-08-12T16:45";

        expect(momentSubmissionValue(local)).toBe(new Date(local).toISOString());
        expect(momentSubmissionValue("")).toBe("");
        expect(momentSubmissionValue("not-a-date")).toBe("");
    });

    it("provides localisable labels for nullable choices and toggle states", () => {
        expect(defaultCollectionEditingControlMessages).toEqual({
            none: "None",
            toggleUnset: "Not set",
            toggleYes: "Yes",
            toggleNo: "No"
        });
    });

    it("lets a Site label declared choice values without changing submitted values", () => {
        const markup = renderToStaticMarkup(
            createElement(CollectionEditingControls, {
                fields: [
                    { name: "state", label: "State", required: true, kind: "choice", choices: ["draft", "published"] }
                ],
                choices: {
                    state: [
                        { value: "draft", label: "Working copy" },
                        { value: "published", label: "Live" }
                    ]
                }
            })
        );

        expect(markup).toContain('<option value="draft">Working copy</option>');
        expect(markup).toContain('<option value="published">Live</option>');
    });
});
