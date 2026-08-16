"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Mark, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
    Bold,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Minus,
    Pilcrow,
    Quote,
    Redo2,
    SquareCode,
    Strikethrough,
    Undo2,
    Unlink
} from "lucide-react";
import { emptyRichText, parseRichText, safeRichTextHref, type RichTextDocument } from "@jamcaaxian/core/content";
import { createMediaImage } from "./media-image";
import { MediaPicker } from "./media-picker";
import type { RichTextMediaAdapter } from "./media";
import { defaultRichTextEditorMessages, type RichTextEditorMessages } from "./messages";

const CoreLink = Mark.create({
    name: "link",
    inclusive: false,

    addAttributes() {
        return {
            href: {
                default: null,
                validate: (value: unknown) => typeof value === "string" && safeRichTextHref(value) !== undefined,
                parseHTML: element => {
                    const href = element.getAttribute("href");
                    return href ? (safeRichTextHref(href) ?? null) : null;
                }
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: "a[href]",
                getAttrs: node => {
                    if (typeof node === "string" || !("getAttribute" in node)) return false;
                    const href = node.getAttribute("href");
                    const safeHref = href ? safeRichTextHref(href) : undefined;

                    return safeHref ? { href: safeHref } : false;
                }
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ["a", { href: HTMLAttributes.href }, 0];
    },

    addCommands() {
        return {
            setLink:
                attributes =>
                ({ commands }) =>
                    commands.setMark(this.name, attributes),
            toggleLink:
                attributes =>
                ({ commands }) =>
                    commands.toggleMark(this.name, attributes, { extendEmptyMarkRange: true }),
            unsetLink:
                () =>
                ({ commands }) =>
                    commands.unsetMark(this.name, { extendEmptyMarkRange: true })
        };
    }
});

const CoreOrderedList = Node.create({
    name: "orderedList",
    group: "block list",
    content: "listItem+",

    addAttributes() {
        return {
            start: {
                default: 1,
                validate: (value: unknown) => {
                    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
                        throw new RangeError("An ordered list needs a positive starting number.");
                    }
                },
                parseHTML: element => (element.hasAttribute("start") ? Number(element.getAttribute("start")) : 1)
            }
        };
    },

    parseHTML() {
        return [{ tag: "ol" }];
    },

    renderHTML({ HTMLAttributes }) {
        return ["ol", HTMLAttributes.start === 1 ? {} : { start: HTMLAttributes.start }, 0];
    },

    addCommands() {
        return {
            toggleOrderedList:
                () =>
                ({ commands }) =>
                    commands.toggleList(this.name, "listItem")
        };
    }
});

export function richTextExtensions(mediaAddress?: (mediaId: string) => string) {
    return [
        StarterKit.configure({ link: false, orderedList: false, underline: false }),
        CoreLink,
        CoreOrderedList,
        mediaAddress ? createMediaImage(mediaAddress) : undefined
    ].filter(extension => extension !== undefined);
}

export function richTextDocumentForSubmission(value: unknown): RichTextDocument {
    return parseRichText(value);
}

function ToolbarButton({
    label,
    active,
    disabled = false,
    onClick,
    children
}: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick(): void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            className="jamcaa-rich-text-editor__button"
            aria-label={label}
            aria-pressed={toolbarButtonPressedState(active)}
            disabled={disabled}
            onClick={onClick}
            title={label}
        >
            {children}
        </button>
    );
}

export function toolbarButtonPressedState(active?: boolean) {
    return active === undefined ? undefined : active;
}

export interface RichTextEditorProps {
    name: string;
    label: string;
    labelledBy?: string;
    defaultValue?: RichTextDocument;
    media?: RichTextMediaAdapter;
    messages?: Partial<RichTextEditorMessages>;
    className?: string;
    onChange?: (document: RichTextDocument) => void;
}

export function RichTextEditor({
    name,
    label,
    labelledBy,
    defaultValue,
    media,
    messages,
    className,
    onChange
}: RichTextEditorProps) {
    const copy = useMemo(() => ({ ...defaultRichTextEditorMessages, ...messages }), [messages]);
    const extensions = useMemo(() => richTextExtensions(media?.address), [media]);
    const initialDocument = defaultValue ?? emptyRichText();
    const [value, setValue] = useState(() => JSON.stringify(initialDocument));
    const editor = useEditor({
        immediatelyRender: false,
        extensions,
        content: initialDocument,
        editorProps: {
            attributes: {
                "class": "jamcaa-rich-text-editor__content",
                "id": `${name}-editor`,
                ...(labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": label }),
                "data-placeholder": copy.placeholder
            }
        },
        onUpdate: ({ editor: current }) => {
            const document = richTextDocumentForSubmission(current.getJSON());
            setValue(JSON.stringify(document));
            onChange?.(document);
        }
    });
    const state = useEditorState({
        editor,
        selector: context => ({
            bold: context.editor?.isActive("bold") ?? false,
            italic: context.editor?.isActive("italic") ?? false,
            strike: context.editor?.isActive("strike") ?? false,
            code: context.editor?.isActive("code") ?? false,
            paragraph: context.editor?.isActive("paragraph") ?? false,
            heading1: context.editor?.isActive("heading", { level: 1 }) ?? false,
            heading2: context.editor?.isActive("heading", { level: 2 }) ?? false,
            heading3: context.editor?.isActive("heading", { level: 3 }) ?? false,
            codeBlock: context.editor?.isActive("codeBlock") ?? false,
            bulletList: context.editor?.isActive("bulletList") ?? false,
            orderedList: context.editor?.isActive("orderedList") ?? false,
            blockquote: context.editor?.isActive("blockquote") ?? false,
            link: context.editor?.isActive("link") ?? false,
            canUndo: context.editor?.can().undo() ?? false,
            canRedo: context.editor?.can().redo() ?? false
        })
    });
    useEffect(() => {
        if (!editor || !labelledBy) return;
        const labelElement = globalThis.document.getElementById(labelledBy);

        if (!labelElement) return;
        const focusEditor = () => editor.commands.focus();
        labelElement.addEventListener("click", focusEditor);

        return () => labelElement.removeEventListener("click", focusEditor);
    }, [editor, labelledBy]);
    const toolbar = state ?? {
        bold: false,
        italic: false,
        strike: false,
        code: false,
        paragraph: false,
        heading1: false,
        heading2: false,
        heading3: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        link: false,
        canUndo: false,
        canRedo: false
    };
    const classes = ["jamcaa-rich-text-editor", className].filter(Boolean).join(" ");

    function editLink() {
        if (!editor) return;
        const previous = editor.getAttributes("link").href as string | undefined;
        const href = window.prompt(copy.linkAddress, previous ?? "https://");

        if (href === null) return;
        if (!href.trim()) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }

        const safeHref = safeRichTextHref(href);
        if (!safeHref) return;
        editor.chain().focus().extendMarkRange("link").setLink({ href: safeHref }).run();
    }

    return (
        <div className={classes}>
            <input id={`${name}-value`} type="hidden" name={name} value={value} />
            <div className="jamcaa-rich-text-editor__toolbar" role="toolbar" aria-label={`${label} ${copy.toolbar}`}>
                <div className="jamcaa-rich-text-editor__toolbar-group">
                    <ToolbarButton
                        label={copy.undo}
                        disabled={!toolbar.canUndo}
                        onClick={() => editor?.chain().focus().undo().run()}
                    >
                        <Undo2 />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.redo}
                        disabled={!toolbar.canRedo}
                        onClick={() => editor?.chain().focus().redo().run()}
                    >
                        <Redo2 />
                    </ToolbarButton>
                </div>
                <span className="jamcaa-rich-text-editor__separator" role="separator" />
                <div className="jamcaa-rich-text-editor__toolbar-group">
                    <ToolbarButton
                        label={copy.paragraph}
                        active={toolbar.paragraph}
                        onClick={() => editor?.chain().focus().setParagraph().run()}
                    >
                        <Pilcrow />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.heading1}
                        active={toolbar.heading1}
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                    >
                        <Heading1 />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.heading2}
                        active={toolbar.heading2}
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                    >
                        <Heading2 />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.heading3}
                        active={toolbar.heading3}
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                    >
                        <Heading3 />
                    </ToolbarButton>
                </div>
                <span className="jamcaa-rich-text-editor__separator" role="separator" />
                <div className="jamcaa-rich-text-editor__toolbar-group">
                    <ToolbarButton
                        label={copy.bold}
                        active={toolbar.bold}
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                    >
                        <Bold />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.italic}
                        active={toolbar.italic}
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                    >
                        <Italic />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.strike}
                        active={toolbar.strike}
                        onClick={() => editor?.chain().focus().toggleStrike().run()}
                    >
                        <Strikethrough />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.inlineCode}
                        active={toolbar.code}
                        onClick={() => editor?.chain().focus().toggleCode().run()}
                    >
                        <Code />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.codeBlock}
                        active={toolbar.codeBlock}
                        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                    >
                        <SquareCode />
                    </ToolbarButton>
                </div>
                <span className="jamcaa-rich-text-editor__separator" role="separator" />
                <div className="jamcaa-rich-text-editor__toolbar-group">
                    <ToolbarButton
                        label={copy.bulletList}
                        active={toolbar.bulletList}
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    >
                        <List />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.numberedList}
                        active={toolbar.orderedList}
                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                    >
                        <ListOrdered />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.quote}
                        active={toolbar.blockquote}
                        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                    >
                        <Quote />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.divider}
                        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                    >
                        <Minus />
                    </ToolbarButton>
                    <ToolbarButton label={copy.link} active={toolbar.link} onClick={editLink}>
                        <LinkIcon />
                    </ToolbarButton>
                    <ToolbarButton
                        label={copy.removeLink}
                        disabled={!toolbar.link}
                        onClick={() => editor?.chain().focus().unsetLink().run()}
                    >
                        <Unlink />
                    </ToolbarButton>
                    {media ?
                        <MediaPicker
                            media={media}
                            messages={copy}
                            onSelect={item =>
                                editor
                                    ?.chain()
                                    .focus()
                                    .insertContent({
                                        type: "mediaImage",
                                        attrs: { mediaId: item.id, alt: item.alt ?? "" }
                                    })
                                    .run()
                            }
                        />
                    :   null}
                </div>
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}
