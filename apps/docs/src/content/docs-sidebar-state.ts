import type { DocsNavigationSection } from "./docs-navigation";

export function initialDocsSidebarOpenState(
    sections: readonly DocsNavigationSection[],
    currentAddress: string,
    autoCollapse: boolean
): Record<string, boolean> {
    return Object.fromEntries(
        sections.map(section => [
            section.id,
            !autoCollapse
                || section.root.href === currentAddress
                || section.children.some(item => item.href === currentAddress)
        ])
    );
}

export function nextDocsSidebarOpenState(
    sections: readonly DocsNavigationSection[],
    current: Readonly<Record<string, boolean>>,
    sectionId: string,
    autoCollapse: boolean
): Record<string, boolean> {
    const open = current[sectionId] !== true;

    if (autoCollapse) {
        return Object.fromEntries(sections.map(section => [section.id, section.id === sectionId && open]));
    }

    return { ...current, [sectionId]: open };
}
