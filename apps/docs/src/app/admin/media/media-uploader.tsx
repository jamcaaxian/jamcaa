"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createHttpMediaAdapter } from "@jamcaa/editor/media";
import { Button } from "@/components/ui/button";
import { mediaUploadProblem } from "./media-upload-problem";

const media = createHttpMediaAdapter();

interface Attempt {
    key: string;
    filename: string;
    state: "preparing" | "sending" | "confirming" | "done" | "failed";
    progress?: number;
    problem?: string;
}

export function MediaUploader({ maxMegabytes }: { maxMegabytes: number }) {
    const router = useRouter();
    const input = useRef<HTMLInputElement>(null);
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [dragging, setDragging] = useState(false);

    async function send(files: FileList | File[]) {
        const chosen = [...files];

        if (chosen.length === 0) {
            return;
        }

        const uploads = chosen.map(file => ({ file, key: crypto.randomUUID() }));
        setAttempts(uploads.map(({ file, key }) => ({ key, filename: file.name, state: "preparing" })));

        // One at a time: the database serves queries serially, and a burst of parallel
        // uploads competes with the reads each of them needs.
        for (const { file, key: attemptKey } of uploads) {
            const settle = (state: Attempt["state"], problem?: string) =>
                setAttempts(current =>
                    current.map(attempt => (attempt.key === attemptKey ? { ...attempt, state, problem } : attempt))
                );

            try {
                settle("sending");
                await media.uploadImage?.(file, {
                    onProgress: progress =>
                        setAttempts(current =>
                            current.map(attempt =>
                                attempt.key === attemptKey ?
                                    {
                                        ...attempt,
                                        state: "sending",
                                        progress: Math.round((progress.completedBytes / progress.totalBytes) * 100)
                                    }
                                :   attempt
                            )
                        ),
                    onConfirming: () => settle("confirming")
                });
                settle("done");
            } catch (error) {
                settle("failed", mediaUploadProblem(error));
            }
        }

        router.refresh();
    }

    return (
        <div className="space-y-3">
            <div
                onDragOver={event => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={event => {
                    event.preventDefault();
                    setDragging(false);
                    void send(event.dataTransfer.files);
                }}
                className={`flex flex-col items-center gap-3 rounded-lg border border-dashed p-5 text-center sm:p-8 ${
                    dragging ? "border-primary bg-accent" : "border-border"
                }`}
            >
                <Upload className="text-muted-foreground size-6" />
                <div className="space-y-1">
                    <p className="text-sm font-medium">Drop files here</p>
                    <p className="text-muted-foreground text-xs">Up to {maxMegabytes} MB each.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => input.current?.click()}>
                    Choose files
                </Button>
                <input
                    ref={input}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={event => {
                        if (event.target.files) {
                            void send(event.target.files);
                        }

                        event.target.value = "";
                    }}
                />
            </div>

            {attempts.length > 0 ?
                <ul className="space-y-1 text-sm">
                    {attempts.map(attempt => (
                        <li key={attempt.key} className="flex min-w-0 flex-wrap items-baseline gap-2">
                            <span className="min-w-0 max-w-full flex-1 truncate font-medium">{attempt.filename}</span>
                            {attempt.state === "preparing" ?
                                <span className="text-muted-foreground text-xs">preparing…</span>
                            : attempt.state === "sending" ?
                                <span className="text-muted-foreground text-xs">
                                    sending{attempt.progress === undefined ? "…" : ` ${attempt.progress}%`}
                                </span>
                            : attempt.state === "confirming" ?
                                <span className="text-muted-foreground text-xs">confirming…</span>
                            : attempt.state === "done" ?
                                <span className="text-muted-foreground text-xs">stored</span>
                            :   <span className="text-destructive text-xs">{attempt.problem}</span>}
                        </li>
                    ))}
                </ul>
            :   null}
        </div>
    );
}
