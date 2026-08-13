import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    createDatabase: vi.fn(),
    getCloudflareContext: vi.fn(),
    inspectSystemRoleGrants: vi.fn(),
    may: vi.fn(),
    requireSession: vi.fn()
}));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocked.getCloudflareContext }));
vi.mock("@jamcaaxian/core", () => ({ createDatabase: mocked.createDatabase }));
vi.mock("@jamcaaxian/core/auth", async importOriginal => ({
    ...(await importOriginal<typeof import("@jamcaaxian/core/auth")>()),
    inspectSystemRoleGrants: mocked.inspectSystemRoleGrants
}));
vi.mock("@/lib/permissions", () => ({ may: mocked.may }));
vi.mock("@/lib/session", () => ({ requireSession: mocked.requireSession }));
vi.mock("@/app/admin/roles/role-grants-form", () => ({ RoleGrantsForm: () => null }));

import RolesPage from "@/app/admin/roles/page";

describe("the system Role grants page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocked.requireSession.mockResolvedValue({ user: { id: "user-1", role: "editor" } });
        mocked.may.mockImplementation(async (_actor, _resource, action) => action === "read");
        mocked.getCloudflareContext.mockReturnValue({ env: { DB: "binding" } });
        mocked.createDatabase.mockReturnValue("database");
        mocked.inspectSystemRoleGrants.mockResolvedValue({
            catalogue: { role: ["read", "manage"] },
            roles: [{ name: "admin", label: "Administrator", description: null, grants: { role: ["read", "manage"] } }]
        });
    });

    it("requires role read capability before inspecting grants", async () => {
        mocked.may.mockResolvedValue(false);

        const rendered = await RolesPage();

        expect(rendered.props.children).toMatch(/permission/i);
        expect(mocked.inspectSystemRoleGrants).not.toHaveBeenCalled();
    });

    it("passes a read-only grant model to users without manage capability", async () => {
        const rendered = await RolesPage();
        const form = rendered.props.children[2];

        expect(mocked.may).toHaveBeenNthCalledWith(1, { id: "user-1", role: "editor" }, "role", "read");
        expect(mocked.may).toHaveBeenNthCalledWith(2, { id: "user-1", role: "editor" }, "role", "manage");
        expect(form.props.mayManage).toBe(false);
        expect(form.props.model.roles[0].name).toBe("admin");
    });
});
