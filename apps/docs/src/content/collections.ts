import { blocks, defineCollection, text } from "@jamcaaxian/core/content";
import { siteBlockRegistry } from "./site-blocks";

export const post = defineCollection({
    name: "post",
    label: "Post",
    plural: "Posts",
    fields: {
        title: text({ required: true }),
        excerpt: text({ description: "Shown in listings and search results." }),
        body: blocks({
            required: true,
            description: "A body composed of blocks. Rich text is one block among others.",
            registry: siteBlockRegistry,
            searchVersion: 3
        })
    },
    summary: { fields: ["title", "excerpt"] },
    search: { fields: ["title", "excerpt", "body"] }
});
