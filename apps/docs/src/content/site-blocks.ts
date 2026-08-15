import { defineBlock, type BlockDocument, type BlockRegistry } from "@jamcaaxian/core/content";
import { builtinBlockRegistry, builtinBlocks } from "@jamcaaxian/editor/blocks";

export const docsSidebarBlock = defineBlock({
    name: "docs.sidebar",
    label: "Documentation sidebar",
    description: "Controls this document's public navigation and is not rendered in the body.",
    props: {
        multiLevel: {
            kind: "flag",
            label: "Multi-level menu",
            description: "Groups related documents into collapsible sections.",
            default: true
        },
        autoCollapse: {
            kind: "flag",
            label: "Automatically collapse other sections",
            description: "Keeps only one sibling section open at a time.",
            default: true
        }
    }
});

export const siteBlockDefinitions = [...Object.values(builtinBlocks), docsSidebarBlock];

export const siteBlockRegistry: BlockRegistry = { ...builtinBlockRegistry, [docsSidebarBlock.name]: docsSidebarBlock };

export interface DocsSidebarOptions {
    multiLevel: boolean;
    autoCollapse: boolean;
}

export interface DocsDocumentPresentation {
    document: BlockDocument;
    sidebar: DocsSidebarOptions;
}

/** Separates Site presentation instructions from reader-facing Blocks. */
export function docsDocumentPresentation(document: BlockDocument): DocsDocumentPresentation {
    const blocks = [];
    let multiLevel = false;
    let autoCollapse = false;

    for (const block of document.blocks) {
        if (block.type === docsSidebarBlock.name) {
            multiLevel = block.props.multiLevel === true;
            autoCollapse = block.props.autoCollapse === true;
            continue;
        }

        blocks.push(block);
    }

    return { document: { version: 1, blocks }, sidebar: { multiLevel, autoCollapse } };
}

/** The portion of a body that produces public visual output. */
export function visibleSiteDocument(document: BlockDocument): BlockDocument {
    return docsDocumentPresentation(document).document;
}
