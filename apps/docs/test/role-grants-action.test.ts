import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    createDatabase: vi.fn(),
    getCloudflareContext: vi.fn(),
    may: vi.fn(),
    replaceSystemRoleGrants: vi.fn(),
    requireSession: vi.fn(),
    revalidatePath: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocked.revalidatePath }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocked.getCloudflareContext }));
vi.mock("@jamcaaxian/core", () => ({ createDatabase: mocked.createDatabase }));
vi.mock("@jamcaaxian/core/auth", async importOriginal => ({
    ...(await importOriginal<typeof import("@jamcaaxian/core/auth")>()),
    replaceSystemRoleGrants: mocked.replaceSystemRoleGrants
}));
vi.mock("@/lib/permissions", () => ({ may: mocked.may }));
vi.mock("@/lib/session", () => ({ requireSession: mocked.requireSession }));

import { RoleGrantError } from "@jamcaaxian/core/auth";
import { saveRoleGrants } from "@/app/admin/roles/actions";

describe("saving system Role grants", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.requireSession.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
        mocked.may.mockResolvedValue(true);
        mocked.getCloudflareContext.mockReturnValue({ env: { DB: "binding" } });
        mocked.createDatabase.mockReturnValue("database");
        mocked.replaceSystemRoleGrants.mockResolvedValue(undefined);
    });

    it("requires role manage capability", async () => {
        mocked.may.mockResolvedValue(false);

        const result = await saveRoleGrants({}, new FormData());

        expect(result.error).toMatch(/permission/i);
        expect(mocked.replaceSystemRoleGrants).not.toHaveBeenCalled();
    });

    it("passes submitted capabilities through the Core validation seam", async () => {
        const formData = new FormData();
        formData.set("roleName", "contributor");
        formData.append("grant.post", "read");
        formData.append("grant.post", "create");
        formData.append("grant.unknown", "forge");

        await expect(saveRoleGrants({}, formData)).resolves.toEqual({ saved: true });
        expect(mocked.replaceSystemRoleGrants).toHaveBeenCalledWith("database", expect.any(Object), "contributor", {
            post: ["read", "create"],
            unknown: ["forge"]
        });
        expect(mocked.revalidatePath).toHaveBeenCalledWith("/admin/roles");
    });

    it("returns Core validation failures without claiming a save", async () => {
        mocked.replaceSystemRoleGrants.mockRejectedValue(new RoleGrantError("Unknown capability action: post:destroy"));
        const formData = new FormData();
        formData.set("roleName", "contributor");
        formData.append("grant.post", "destroy");

        await expect(saveRoleGrants({}, formData)).resolves.toEqual({
            error: "Unknown capability action: post:destroy"
        });
    });

    it("does not expose an unexpected database error", async () => {
        mocked.replaceSystemRoleGrants.mockRejectedValue(new Error("SQLITE_CONSTRAINT: internal details"));
        const formData = new FormData();
        formData.set("roleName", "contributor");

        await expect(saveRoleGrants({}, formData)).resolves.toEqual({
            error: "Those Role capabilities could not be saved."
        });
    });
});
