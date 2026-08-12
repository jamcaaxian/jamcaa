export interface RichTextEditorMessages {
    toolbar: string;
    placeholder: string;
    undo: string;
    redo: string;
    heading: string;
    bold: string;
    italic: string;
    strike: string;
    inlineCode: string;
    bulletList: string;
    numberedList: string;
    quote: string;
    link: string;
    removeLink: string;
    linkAddress: string;
    media: string;
    insertMedia: string;
    insertMediaDescription: string;
    storeImage: string;
    storingImage: string;
    readingMedia: string;
    noImages: string;
    mediaUnavailable: string;
    imageUploadFailed: string;
    imageAlternative: string;
    imageAlternativePlaceholder: string;
    decorativeImage: string;
    insertImage: string;
    imageAlternativeRequired: string;
    close: string;
}

export interface CollectionEditingControlMessages {
    none: string;
    toggleUnset: string;
    toggleYes: string;
    toggleNo: string;
}

export const defaultCollectionEditingControlMessages: CollectionEditingControlMessages = {
    none: "None",
    toggleUnset: "Not set",
    toggleYes: "Yes",
    toggleNo: "No"
};

export const defaultRichTextEditorMessages: RichTextEditorMessages = {
    toolbar: "Formatting",
    placeholder: "Write…",
    undo: "Undo",
    redo: "Redo",
    heading: "Heading",
    bold: "Bold",
    italic: "Italic",
    strike: "Strike",
    inlineCode: "Inline code",
    bulletList: "Bullet list",
    numberedList: "Numbered list",
    quote: "Quote",
    link: "Link",
    removeLink: "Remove link",
    linkAddress: "Link address",
    media: "Media",
    insertMedia: "Insert Media",
    insertMediaDescription: "Select an image already managed by the platform or store a new one.",
    storeImage: "Store image",
    storingImage: "Storing…",
    readingMedia: "Reading Media…",
    noImages: "No images have been stored yet.",
    mediaUnavailable: "The Media library could not be read.",
    imageUploadFailed: "The image could not be stored.",
    imageAlternative: "Image description",
    imageAlternativePlaceholder: "Describe what the image communicates",
    decorativeImage: "This image is decorative",
    insertImage: "Insert image",
    imageAlternativeRequired: "Describe the image or mark it as decorative.",
    close: "Close"
};
