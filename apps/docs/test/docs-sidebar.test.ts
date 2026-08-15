import { describe, expect, it } from "vitest";
import { docsSidebarNavigation } from "@/content/docs-navigation";
import { initialDocsSidebarOpenState, nextDocsSidebarOpenState } from "@/content/docs-sidebar-state";

describe("documentation sidebar state", () => {
    const sections = docsSidebarNavigation("zh-Hans-CN");

    it("opens only the section containing the current page when auto-collapse is enabled", () => {
        expect(initialDocsSidebarOpenState(sections, "/zh-hans-cn/localization", true)).toEqual({
            docs: false,
            guides: true,
            reference: false
        });
    });

    it("opens every section initially when auto-collapse is disabled", () => {
        expect(initialDocsSidebarOpenState(sections, "/zh-hans-cn/localization", false)).toEqual({
            docs: true,
            guides: true,
            reference: true
        });
    });

    it("closes sibling sections only in auto-collapse mode", () => {
        expect(
            nextDocsSidebarOpenState(sections, { docs: true, guides: true, reference: false }, "reference", true)
        ).toEqual({ docs: false, guides: false, reference: true });

        expect(
            nextDocsSidebarOpenState(sections, { docs: true, guides: true, reference: false }, "reference", false)
        ).toEqual({ docs: true, guides: true, reference: true });
    });
});
