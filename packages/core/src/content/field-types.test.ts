import { text as sqliteText } from "drizzle-orm/sqlite-core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { defineCollection } from "./collection";
import { editingFields } from "./editing";
import { capsuleOf, slot, type FieldCapsule } from "./field-capsule";
import { defineFieldType, defineScalarFieldType, validateThirdPartyKind } from "./field-types";
import { text, type Field } from "./fields";
import { defineContentModel } from "./model";

const identityCapsule: FieldCapsule<string> = {
    slots: () => ({ value: slot({ affinity: "text", buildColumn: name => sqliteText(name) }) }),
    storageVersion: () => 1,
    searchVersion: () => 1,
    encode: value => ({ value }),
    decode: cells => cells.value,
    snapshotValue: value => value,
    valueFromSnapshot: value => value,
    revisionVersion: () => 1,
    revisionEncode: value => value,
    revisionDecode: (version, payload) => {
        if (version !== 1) {
            throw new Error(`Revision codec ${version} is not known.`);
        }

        return payload;
    },
    submissionValue: raw => raw,
    isBlankSubmission: raw => raw.length === 0,
    isRequiredValueMissing: () => false,
    editingExtras: () => undefined,
    searchText: () => ({ type: "column-text", slot: "value" })
};

describe("Field Types", () => {
    const identityParse = (value: unknown) => value as string;

    it("refuses to declare a built-in kind", () => {
        expect(() =>
            defineScalarFieldType({ kind: "text", affinity: "text", buildColumn: sqliteText, parse: identityParse })
        ).toThrow(/built in/);
        expect(() => defineFieldType({ kind: "number", parse: identityParse, capsule: identityCapsule })).toThrow(
            /built in/
        );
    });

    it("requires third-party kinds to be namespaced", () => {
        expect(() =>
            defineScalarFieldType({
                kind: "geo-point",
                affinity: "text",
                buildColumn: sqliteText,
                parse: identityParse
            })
        ).toThrow(/needs a namespace/);
        expect(() => validateThirdPartyKind("geo-point")).toThrow(/needs a namespace/);
        expect(() => validateThirdPartyKind("@/x")).toThrow(/needs a namespace/);
        expect(() => validateThirdPartyKind("text")).toThrow(/built in/);
        expect(() => validateThirdPartyKind("@acme/geo-point")).not.toThrow();
        expect(() => validateThirdPartyKind("acme/geo-point")).not.toThrow();
    });

    it("compiles a scalar Field Type with identity codecs", () => {
        const handle = defineScalarFieldType<string>({
            kind: "@acme/handle",
            affinity: "text",
            buildColumn: sqliteText,
            parse: identityParse,
            searchText: () => ({ type: "column-text", slot: "value" })
        });
        const field = handle.create({ required: true });

        expect(field.kind).toBe("@acme/handle");
        expect(field.editingKind).toBe("@acme/handle");
        expect(field.required).toBe(true);

        const capsule = capsuleOf(field);

        expect(capsule.encode("ada")).toEqual({ value: "ada" });
        expect(capsule.decode({ value: "ada" })).toBe("ada");
        expect(capsule.revisionEncode("ada")).toBe("ada");
        expect(capsule.revisionDecode(1, "ada")).toBe("ada");
        expect(capsule.storageVersion()).toBe(1);
        expect(capsule.searchText()).toEqual({ type: "column-text", slot: "value" });
    });

    it("dispatches an Editing Control by its declared editing kind", () => {
        const handle = defineScalarFieldType<string>({
            kind: "@acme/handle",
            editingKind: "text",
            affinity: "text",
            buildColumn: sqliteText,
            parse: identityParse
        });
        const collection = defineCollection({
            name: "member",
            label: "Member",
            plural: "Members",
            fields: { name: text(), handle: handle.create() }
        });

        expect(editingFields(collection)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ name: "handle", kind: "@acme/handle", editingKind: "text" })
            ])
        );
    });

    it("nests third-party Editing extras instead of spreading them", () => {
        const hint = defineFieldType<string>({
            kind: "@acme/hint",
            parse: identityParse,
            capsule: { ...identityCapsule, editingExtras: () => ({ maxLength: 64 }) }
        });
        const collection = defineCollection({
            name: "member",
            label: "Member",
            plural: "Members",
            fields: { name: text(), handle: hint.create() }
        });

        expect(editingFields(collection)[1]?.extras).toEqual({ maxLength: 64 });
    });

    it("spreads extras top-level when a built-in control renders the field", () => {
        const state = defineScalarFieldType<string>({
            kind: "@acme/state",
            editingKind: "choice",
            affinity: "text",
            buildColumn: sqliteText,
            parse: identityParse,
            editingExtras: () => ({ choices: ["draft", "published"] })
        });
        const collection = defineCollection({
            name: "member",
            label: "Member",
            plural: "Members",
            fields: { name: text(), state: state.create() }
        });

        expect(editingFields(collection)[1]).toEqual(
            expect.objectContaining({ kind: "@acme/state", editingKind: "choice", choices: ["draft", "published"] })
        );
    });

    it("refuses a collection whose field kind no Field Type installs", () => {
        const handle = defineScalarFieldType<string>({
            kind: "@acme/handle",
            affinity: "text",
            buildColumn: sqliteText,
            parse: identityParse
        });
        const member = defineCollection({
            name: "member",
            label: "Member",
            plural: "Members",
            fields: { name: text(), handle: handle.create() }
        });

        expect(() => defineContentModel({ collections: [member] })).toThrow(/no Field Type installs/);
    });

    it("accepts a collection once its Field Type is installed", () => {
        const handle = defineScalarFieldType<string>({
            kind: "@acme/handle",
            affinity: "text",
            buildColumn: sqliteText,
            parse: identityParse
        });
        const member = defineCollection({
            name: "member",
            label: "Member",
            plural: "Members",
            fields: { handle: handle.create(), name: text() }
        });

        const model = defineContentModel({ collections: [member], fieldTypes: [handle] });

        expect(model.table("member")).toBeDefined();
    });

    it("refuses two Field Types installed for one kind", () => {
        const first = defineScalarFieldType<string>({
            kind: "@acme/handle",
            affinity: "text",
            buildColumn: sqliteText,
            parse: identityParse
        });
        const second = defineScalarFieldType<string>({
            kind: "@acme/handle",
            affinity: "text",
            buildColumn: sqliteText,
            parse: identityParse
        });

        expect(() => defineContentModel({ collections: [], fieldTypes: [first, second] })).toThrow(
            /both installed for kind/
        );
    });

    it("maps required to the field value type", () => {
        const handle = defineScalarFieldType<string>({
            kind: "@acme/handle",
            affinity: "text",
            buildColumn: sqliteText,
            parse: identityParse
        });

        expectTypeOf(handle.create()).toMatchTypeOf<Field<string | null, string>>();
        expectTypeOf(handle.create({ required: true })).toMatchTypeOf<Field<string, string>>();
    });

    it("accepts namespaced kinds in search and summary declarations", () => {
        const handle = defineScalarFieldType<string>({
            kind: "@acme/handle",
            affinity: "text",
            buildColumn: sqliteText,
            parse: identityParse,
            searchText: () => ({ type: "column-text", slot: "value" })
        });
        const member = defineCollection({
            name: "member",
            label: "Member",
            plural: "Members",
            fields: { name: text(), handle: handle.create() },
            search: { fields: ["name", "handle"] },
            summary: { fields: ["name", "handle"] }
        });

        expect(() => defineContentModel({ collections: [member], fieldTypes: [handle] })).not.toThrow();
    });
});
