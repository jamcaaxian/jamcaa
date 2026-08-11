import { defineCollection, richText, text } from "@jamcaa/core/content";

export const post = defineCollection({
    name: "post",
    label: "Post",
    plural: "Posts",
    fields: {
        title: text({ required: true }),
        excerpt: text({ description: "Shown in listings and search results." }),
        body: richText({ required: true })
    },
    search: { fields: ["title", "excerpt", "body"] }
});
