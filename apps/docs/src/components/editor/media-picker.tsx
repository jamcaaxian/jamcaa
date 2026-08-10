"use client";

import { useRef, useState } from "react";
import { FileImage, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { uploadMedia, type StoredMediaAnswer } from "@/lib/media-upload";

export type MediaChoice = StoredMediaAnswer;

export function MediaPicker({ onSelect }: { onSelect(media: MediaChoice): void }) {
    const input = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<MediaChoice[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [problem, setProblem] = useState("");

    async function load() {
        setLoading(true);
        setProblem("");

        try {
            const response = await fetch("/api/media?type=image&limit=60");
            const answer = (await response.json().catch(() => ({}))) as { items?: MediaChoice[]; error?: string };

            if (!response.ok || !Array.isArray(answer.items)) {
                throw new Error(answer.error ?? "The Media library could not be read.");
            }

            setItems(answer.items);
        } catch (error) {
            setProblem(error instanceof Error ? error.message : "The Media library could not be read.");
        } finally {
            setLoading(false);
        }
    }

    async function store(file: File) {
        setUploading(true);
        setProblem("");

        try {
            const stored = await uploadMedia(file, { collection: "post" });
            setItems(current => [stored, ...current.filter(item => item.id !== stored.id)]);
            onSelect(stored);
            setOpen(false);
        } catch (error) {
            setProblem(error instanceof Error ? error.message : "The image could not be stored.");
        } finally {
            setUploading(false);
        }
    }

    return (
        <Sheet
            open={open}
            onOpenChange={nextOpen => {
                setOpen(nextOpen);
                if (nextOpen) void load();
            }}
        >
            <SheetTrigger render={<Button type="button" variant="ghost" size="sm" />}>
                <FileImage />
                Media
            </SheetTrigger>
            <SheetContent className="sm:max-w-xl">
                <SheetHeader>
                    <SheetTitle>Insert Media</SheetTitle>
                    <SheetDescription>
                        Select an image already managed by the platform or store a new one.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex items-center gap-2 px-4">
                    <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={uploading}>
                        {uploading ?
                            <LoaderCircle className="animate-spin" />
                        :   <Upload />}
                        {uploading ? "Storing…" : "Store image"}
                    </Button>
                    <input
                        ref={input}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={event => {
                            const file = event.target.files?.[0];
                            if (file) void store(file);
                            event.target.value = "";
                        }}
                    />
                </div>

                {problem ?
                    <p className="text-destructive px-4 text-sm">{problem}</p>
                :   null}

                <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">
                    {loading ?
                        <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
                            <LoaderCircle className="size-4 animate-spin" /> Reading Media…
                        </div>
                    : items.length === 0 ?
                        <p className="text-muted-foreground py-8 text-sm">No images have been stored yet.</p>
                    :   <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {items.map(item => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onSelect(item);
                                            setOpen(false);
                                        }}
                                        className="hover:border-primary focus-visible:ring-ring/50 group w-full overflow-hidden rounded-lg border text-left outline-none focus-visible:ring-3"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element -- streamed from our Media route */}
                                        <img
                                            src={item.address}
                                            alt={item.alt ?? ""}
                                            className="aspect-square w-full object-cover"
                                        />
                                        <span className="block truncate p-2 text-xs font-medium">{item.filename}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    }
                </div>
            </SheetContent>
        </Sheet>
    );
}
