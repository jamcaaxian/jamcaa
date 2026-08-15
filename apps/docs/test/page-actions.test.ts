import { beforeEach, describe, expect, it, vi } from "vitest";

const copy = {
    pages: {
        errors: {
            permission: {
                create: "You do not have permission to create Pages.",
                update: "You do not have permission to update Pages.",
                delete: "You do not have permission to delete Pages.",
                publish: "You do not have permission to publish Pages."
            },
            bodyInvalid: "The Page body is invalid.",
            bodyUnreadable: "The Page body could not be read.",
            addressExists: (address: string) => `A Page already exists at ${address}.`,
            addressStart: "The Page address must start with a slash.",
            addressEnd: "The Page address must not end with a slash.",
            addressDoubleSlash: "The Page address must not contain a double slash.",
            titleRequired: "The Page needs a title.",
            missing: "That Page does not exist.",
            readBack: "The Page could not be read back.",
            createFailed: "The Page could not be created.",
            saveFailed: "The Page could not be saved."
        }
    }
};

const mocked = vi.hoisted(() => ({
    adminMessages: vi.fn(),
    byId: vi.fn(),
    createDatabase: vi.fn(),
    getCloudflareContext: vi.fn(),
    may: vi.fn(),
    requireSession: vi.fn(),
    revalidatePath: vi.fn(),
    update: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocked.revalidatePath }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocked.getCloudflareContext }));
vi.mock("@jamcaaxian/core", () => ({ createDatabase: mocked.createDatabase }));
vi.mock("@/content/admin-locale", () => ({ adminMessages: mocked.adminMessages }));
vi.mock("@/content/pages-store", () => ({ pages: () => ({ byId: mocked.byId, update: mocked.update }) }));
vi.mock("@/lib/permissions", () => ({ may: mocked.may }));
vi.mock("@/lib/session", () => ({ requireSession: mocked.requireSession }));

import { updatePage } from "@/app/admin/pages/actions";

function pageForm(status: "draft" | "published") {
    const formData = new FormData();

    formData.set("title", "Page title");
    formData.set("address", "/page");
    formData.set("status", status);
    formData.set("body", JSON.stringify({ version: 1, blocks: [] }));

    return formData;
}

describe("updating a Page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.adminMessages.mockResolvedValue({ copy });
        mocked.getCloudflareContext.mockReturnValue({ env: { DB: "binding" } });
        mocked.createDatabase.mockReturnValue("database");
        mocked.requireSession.mockResolvedValue({ user: { id: "editor-1", role: "editor" } });
        mocked.update.mockResolvedValue({ status: "updated", page: { id: "page-1", status: "draft" } });
    });

    it("requires publish capability to take a published Page offline", async () => {
        mocked.byId.mockResolvedValue({ id: "page-1", status: "published" });
        mocked.may.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        await expect(updatePage("page-1", {}, pageForm("draft"))).resolves.toEqual({
            error: copy.pages.errors.permission.publish
        });
        expect(mocked.update).not.toHaveBeenCalled();
    });

    it("allows draft-only updates without publish capability", async () => {
        mocked.byId.mockResolvedValue({ id: "page-1", status: "draft" });
        mocked.may.mockResolvedValue(true);

        await expect(updatePage("page-1", {}, pageForm("draft"))).resolves.toEqual({ saved: true });
        expect(mocked.may).toHaveBeenCalledTimes(1);
        expect(mocked.update).toHaveBeenCalledWith("page-1", {
            title: "Page title",
            address: "/page",
            body: { version: 1, blocks: [] },
            status: "draft"
        });
    });
});
