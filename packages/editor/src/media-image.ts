import { mergeAttributes, Node } from "@tiptap/core";

const MEDIA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createMediaImage(address: (mediaId: string) => string) {
    return Node.create({
        name: "mediaImage",
        group: "block",
        atom: true,
        draggable: true,

        addAttributes() {
            return {
                mediaId: {
                    default: "",
                    validate: (value: unknown) => {
                        if (typeof value !== "string" || !MEDIA_ID.test(value.trim())) {
                            throw new RangeError("A rich text Media image needs a Media identifier.");
                        }
                    },
                    parseHTML: element => element.getAttribute("data-media-id")
                },
                alt: {
                    default: "",
                    validate: (value: unknown) => {
                        if (typeof value !== "string") {
                            throw new RangeError("A rich text Media image alternative must be text.");
                        }
                    },
                    parseHTML: element => element.getAttribute("alt") ?? ""
                }
            };
        },

        parseHTML() {
            return [{ tag: "img[data-media-id]" }];
        },

        renderHTML({ HTMLAttributes }) {
            const mediaId = String(HTMLAttributes.mediaId ?? "");
            const alt = String(HTMLAttributes.alt ?? "");

            return [
                "img",
                mergeAttributes({ alt }, { "src": address(mediaId), "data-media-id": mediaId, "loading": "lazy" })
            ];
        }
    });
}
