import { buildFormerAddressTable, buildRevisionTable, defineContentModel } from "@jamcaa/core/content";
import { post } from "./collections";

export const contentModel = defineContentModel({ collections: [post] });

// Named exports because drizzle-kit reads tables from a module's exports, and the
// tables this site has are assembled rather than written out.
export const postTable = contentModel.tables.post;
export const postTagTable = contentModel.tagTables.post;
export const formerPostAddressTable = buildFormerAddressTable(post.name, postTable);
export const postRevisionTable = buildRevisionTable(post.name, postTable);
