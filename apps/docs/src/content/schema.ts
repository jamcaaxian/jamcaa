import { defineContentModel } from "@jamcaa/core/content";
import { post } from "./collections";

export const contentModel = defineContentModel([post]);

// Named exports because drizzle-kit reads tables from a module's exports, and the
// tables this site has are assembled rather than written out.
export const postTable = contentModel.tables.post;
