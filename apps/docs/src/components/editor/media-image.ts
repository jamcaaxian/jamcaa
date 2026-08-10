import { mergeAttributes, Node } from "@tiptap/core";

export const MediaImage = Node.create({
    name: "mediaImage",
    group: "block",
    atom: true,
    draggable: true,

    addAttributes() {
        return { mediaId: { default: "" }, alt: { default: "" } };
    },

    parseHTML() {
        return [{ tag: "img[data-media-id]" }];
    },

    renderHTML({ HTMLAttributes }) {
        const mediaId = String(HTMLAttributes.mediaId ?? "");

        return [
            "img",
            mergeAttributes(HTMLAttributes, {
                "src": `/media/${encodeURIComponent(mediaId)}`,
                "data-media-id": mediaId,
                "loading": "lazy"
            })
        ];
    }
});
