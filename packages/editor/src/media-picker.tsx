"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileImage, LoaderCircle, Upload, X } from "lucide-react";
import type { RichTextEditorMessages } from "./messages";
import { EditorMediaError, type EditorMediaItem, type RichTextMediaAdapter } from "./media";

function messageFor(error: unknown, fallback: string, messages: RichTextEditorMessages) {
    if (error instanceof EditorMediaError) {
        return error.code === "media-unavailable" ? messages.mediaUnavailable : messages.imageUploadFailed;
    }

    return fallback;
}

export function MediaPicker({
    media,
    messages,
    onSelect
}: {
    media: RichTextMediaAdapter;
    messages: RichTextEditorMessages;
    onSelect(media: EditorMediaItem): void;
}) {
    const input = useRef<HTMLInputElement>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<readonly EditorMediaItem[]>([]);
    const [selected, setSelected] = useState<EditorMediaItem>();
    const [alternative, setAlternative] = useState("");
    const [decorative, setDecorative] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [problem, setProblem] = useState("");
    const available = media.listImages !== undefined || media.uploadImage !== undefined;

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open) return;
        const current = dialog.current;

        if (!current) return;

        current.showModal();

        return () => {
            if (current.open) current.close();
            trigger.current?.focus();
        };
    }, [open]);

    async function load() {
        if (!media.listImages) return;

        setLoading(true);
        setProblem("");

        try {
            setItems(await media.listImages());
        } catch (error) {
            setProblem(messageFor(error, messages.mediaUnavailable, messages));
        } finally {
            setLoading(false);
        }
    }

    function openPicker() {
        if (!available) return;
        setSelected(undefined);
        setAlternative("");
        setDecorative(false);
        setOpen(true);
        void load();
    }

    function choose(item: EditorMediaItem) {
        setSelected(item);
        setAlternative(item.alt ?? "");
        setDecorative(false);
        setProblem("");
    }

    function insertSelected() {
        if (!selected) return;

        if (!decorative && !alternative.trim()) {
            setProblem(messages.imageAlternativeRequired);
            return;
        }

        onSelect({ ...selected, alt: decorative ? "" : alternative.trim() });
        setOpen(false);
    }

    async function store(file: File) {
        if (!media.uploadImage) return;

        setUploading(true);
        setProblem("");

        try {
            const stored = await media.uploadImage(file);
            setItems(current => [stored, ...current.filter(item => item.id !== stored.id)]);
            choose(stored);
        } catch (error) {
            setProblem(messageFor(error, messages.imageUploadFailed, messages));
        } finally {
            setUploading(false);
        }
    }

    return (
        <>
            <button
                ref={trigger}
                type="button"
                className="jamcaa-rich-text-editor__button"
                aria-label={messages.media}
                title={messages.media}
                disabled={!available}
                onClick={openPicker}
            >
                <FileImage />
                <span>{messages.media}</span>
            </button>

            {mounted && open ?
                createPortal(
                    <dialog
                        ref={dialog}
                        className="jamcaa-rich-text-media-picker"
                        aria-labelledby={titleId}
                        aria-describedby={descriptionId}
                        onCancel={event => {
                            event.preventDefault();
                            setOpen(false);
                        }}
                        onClick={event => {
                            if (event.target === event.currentTarget) setOpen(false);
                        }}
                    >
                        <section className="jamcaa-rich-text-media-picker__panel">
                            <button
                                type="button"
                                className="jamcaa-rich-text-media-picker__close"
                                aria-label={messages.close}
                                title={messages.close}
                                onClick={() => setOpen(false)}
                            >
                                <X />
                            </button>
                            <header className="jamcaa-rich-text-media-picker__header">
                                <h2 id={titleId} className="jamcaa-rich-text-media-picker__title">
                                    {messages.insertMedia}
                                </h2>
                                <p id={descriptionId} className="jamcaa-rich-text-media-picker__description">
                                    {messages.insertMediaDescription}
                                </p>
                            </header>

                            {media.uploadImage ?
                                <div className="jamcaa-rich-text-media-picker__actions">
                                    <button
                                        type="button"
                                        className="jamcaa-rich-text-editor__button"
                                        onClick={() => input.current?.click()}
                                        disabled={uploading}
                                    >
                                        {uploading ?
                                            <LoaderCircle aria-hidden="true" />
                                        :   <Upload aria-hidden="true" />}
                                        {uploading ? messages.storingImage : messages.storeImage}
                                    </button>
                                    <input
                                        ref={input}
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        onChange={event => {
                                            const file = event.target.files?.[0];
                                            if (file) void store(file);
                                            event.target.value = "";
                                        }}
                                    />
                                </div>
                            :   null}

                            <p className="jamcaa-rich-text-media-picker__status" role="status" aria-live="polite">
                                {uploading ?
                                    messages.storingImage
                                : loading ?
                                    messages.readingMedia
                                :   ""}
                            </p>

                            {problem ?
                                <p className="jamcaa-rich-text-media-picker__problem" role="alert">
                                    {problem}
                                </p>
                            :   null}

                            <div className="jamcaa-rich-text-media-picker__body">
                                {loading ?
                                    <p className="jamcaa-rich-text-media-picker__loading" aria-hidden="true">
                                        <LoaderCircle aria-hidden="true" /> {messages.readingMedia}
                                    </p>
                                : items.length === 0 ?
                                    <p className="jamcaa-rich-text-media-picker__empty">{messages.noImages}</p>
                                :   <ul className="jamcaa-rich-text-media-picker__grid">
                                        {items.map(item => (
                                            <li key={item.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => choose(item)}
                                                    className="jamcaa-rich-text-media-card"
                                                    aria-pressed={selected?.id === item.id}
                                                >
                                                    <img src={item.address} alt={item.alt ?? ""} />
                                                    <span>{item.filename}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                }
                            </div>

                            {selected ?
                                <div className="jamcaa-rich-text-media-picker__selection">
                                    <label className="jamcaa-rich-text-media-picker__field">
                                        <span>{messages.imageAlternative}</span>
                                        <input
                                            type="text"
                                            value={alternative}
                                            placeholder={messages.imageAlternativePlaceholder}
                                            disabled={decorative}
                                            onChange={event => setAlternative(event.target.value)}
                                        />
                                    </label>
                                    <label className="jamcaa-rich-text-media-picker__decorative">
                                        <input
                                            type="checkbox"
                                            checked={decorative}
                                            onChange={event => setDecorative(event.target.checked)}
                                        />
                                        <span>{messages.decorativeImage}</span>
                                    </label>
                                    <button
                                        type="button"
                                        className="jamcaa-rich-text-editor__button jamcaa-rich-text-media-picker__insert"
                                        onClick={insertSelected}
                                    >
                                        {messages.insertImage}
                                    </button>
                                </div>
                            :   null}
                        </section>
                    </dialog>,
                    document.body
                )
            :   null}
        </>
    );
}
