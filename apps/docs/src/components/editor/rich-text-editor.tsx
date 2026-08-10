"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
    Bold,
    Code,
    Heading2,
    Italic,
    Link as LinkIcon,
    List,
    ListOrdered,
    Quote,
    Redo2,
    Strikethrough,
    Undo2,
    Unlink
} from "lucide-react";
import { emptyRichText, parseRichText, type RichTextDocument } from "@jamcaa/core/content";
import { Button } from "@/components/ui/button";
import { MediaImage } from "./media-image";
import { MediaPicker } from "./media-picker";

function ToolbarButton({
    label,
    active = false,
    disabled = false,
    onClick,
    children
}: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick(): void;
    children: React.ReactNode;
}) {
    return (
        <Button
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            title={label}
        >
            {children}
        </Button>
    );
}

export function RichTextEditor({ name, initialValue }: { name: string; initialValue?: RichTextDocument }) {
    const [value, setValue] = useState(() => JSON.stringify(initialValue ?? emptyRichText()));
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [StarterKit.configure({ link: { openOnClick: false }, underline: false }), MediaImage],
        content: initialValue ?? emptyRichText(),
        editorProps: { attributes: { "class": "rich-text-editor__content", "aria-label": "Post body" } },
        onUpdate: ({ editor: current }) => setValue(JSON.stringify(parseRichText(current.getJSON())))
    });
    const state = useEditorState({
        editor,
        selector: context => ({
            bold: context.editor?.isActive("bold") ?? false,
            italic: context.editor?.isActive("italic") ?? false,
            strike: context.editor?.isActive("strike") ?? false,
            code: context.editor?.isActive("code") ?? false,
            heading: context.editor?.isActive("heading", { level: 2 }) ?? false,
            bulletList: context.editor?.isActive("bulletList") ?? false,
            orderedList: context.editor?.isActive("orderedList") ?? false,
            blockquote: context.editor?.isActive("blockquote") ?? false,
            link: context.editor?.isActive("link") ?? false,
            canUndo: context.editor?.can().undo() ?? false,
            canRedo: context.editor?.can().redo() ?? false
        })
    });
    const toolbar = state ?? {
        bold: false,
        italic: false,
        strike: false,
        code: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        link: false,
        canUndo: false,
        canRedo: false
    };

    function editLink() {
        if (!editor) return;
        const previous = editor.getAttributes("link").href as string | undefined;
        const href = window.prompt("Link address", previous ?? "https://");

        if (href === null) return;
        if (!href.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
        else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
    }

    return (
        <div className="rich-text-editor">
            <input type="hidden" name={name} value={value} />
            <div className="rich-text-editor__toolbar" role="toolbar" aria-label="Post body formatting">
                <ToolbarButton
                    label="Undo"
                    disabled={!toolbar.canUndo}
                    onClick={() => editor?.chain().focus().undo().run()}
                >
                    <Undo2 />
                </ToolbarButton>
                <ToolbarButton
                    label="Redo"
                    disabled={!toolbar.canRedo}
                    onClick={() => editor?.chain().focus().redo().run()}
                >
                    <Redo2 />
                </ToolbarButton>
                <span className="bg-border mx-1 h-5 w-px" />
                <ToolbarButton
                    label="Heading"
                    active={toolbar.heading}
                    onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                    <Heading2 />
                </ToolbarButton>
                <ToolbarButton
                    label="Bold"
                    active={toolbar.bold}
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                >
                    <Bold />
                </ToolbarButton>
                <ToolbarButton
                    label="Italic"
                    active={toolbar.italic}
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                >
                    <Italic />
                </ToolbarButton>
                <ToolbarButton
                    label="Strike"
                    active={toolbar.strike}
                    onClick={() => editor?.chain().focus().toggleStrike().run()}
                >
                    <Strikethrough />
                </ToolbarButton>
                <ToolbarButton
                    label="Inline code"
                    active={toolbar.code}
                    onClick={() => editor?.chain().focus().toggleCode().run()}
                >
                    <Code />
                </ToolbarButton>
                <ToolbarButton
                    label="Bullet list"
                    active={toolbar.bulletList}
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                >
                    <List />
                </ToolbarButton>
                <ToolbarButton
                    label="Numbered list"
                    active={toolbar.orderedList}
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                >
                    <ListOrdered />
                </ToolbarButton>
                <ToolbarButton
                    label="Quote"
                    active={toolbar.blockquote}
                    onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                >
                    <Quote />
                </ToolbarButton>
                <ToolbarButton label="Link" active={toolbar.link} onClick={editLink}>
                    <LinkIcon />
                </ToolbarButton>
                <ToolbarButton
                    label="Remove link"
                    disabled={!toolbar.link}
                    onClick={() => editor?.chain().focus().unsetLink().run()}
                >
                    <Unlink />
                </ToolbarButton>
                <MediaPicker
                    onSelect={media =>
                        editor
                            ?.chain()
                            .focus()
                            .insertContent({ type: "mediaImage", attrs: { mediaId: media.id, alt: media.alt ?? "" } })
                            .run()
                    }
                />
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}
