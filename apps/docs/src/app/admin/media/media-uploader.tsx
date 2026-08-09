"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Attempt {
    filename: string;
    state: "preparing" | "sending" | "confirming" | "done" | "failed";
    problem?: string;
}

interface DirectUploadAnswer {
    mode?: "direct" | "server";
    id?: string;
    putUrl?: string;
    contentType?: string;
    error?: string;
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

        setAttempts(chosen.map(file => ({ filename: file.name, state: "preparing" })));

        // One at a time: the database serves queries serially, and a burst of parallel
        // uploads competes with the reads each of them needs.
        for (const file of chosen) {
            const settle = (state: Attempt["state"], problem?: string) =>
                setAttempts(current =>
                    current.map(attempt => (attempt.filename === file.name ? { ...attempt, state, problem } : attempt))
                );

            try {
                const preparation = await fetch("/api/media", {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ name: file.name, type: file.type, size: file.size })
                });
                const plan = (await preparation.json().catch(() => ({}))) as DirectUploadAnswer;

                if (!preparation.ok) {
                    settle("failed", plan.error ?? `The server answered ${preparation.status}.`);
                    continue;
                }

                if (plan.mode === "direct" && plan.id && plan.putUrl) {
                    settle("sending");
                    try {
                        const uploaded = await fetch(plan.putUrl, {
                            method: "PUT",
                            headers: { "content-type": plan.contentType ?? file.type ?? "application/octet-stream" },
                            body: file
                        });

                        if (!uploaded.ok) {
                            throw new Error(`The bucket answered ${uploaded.status}. Check its browser CORS rules.`);
                        }

                        settle("confirming");
                        const confirmation = await fetch("/api/media", {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: plan.id })
                        });

                        if (!confirmation.ok) {
                            const answer = (await confirmation.json().catch(() => ({}))) as { error?: string };
                            throw new Error(answer.error ?? `Confirmation answered ${confirmation.status}.`);
                        }

                        settle("done");
                    } catch (error) {
                        await fetch("/api/media", {
                            method: "DELETE",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ id: plan.id })
                        }).catch(() => undefined);
                        settle("failed", error instanceof Error ? error.message : "The direct upload failed.");
                    }

                    continue;
                }

                settle("sending");
                const body = new FormData();
                body.set("file", file);
                const response = await fetch("/api/media", { method: "POST", body });

                if (response.ok) {
                    settle("done");
                } else {
                    const answer = (await response.json().catch(() => ({}))) as { error?: string };

                    settle("failed", answer.error ?? `The server answered ${response.status}.`);
                }
            } catch {
                settle("failed", "The upload could not be sent. Check the connection and try again.");
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
                className={`flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center ${
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
                        <li key={attempt.filename} className="flex flex-wrap items-baseline gap-2">
                            <span className="truncate font-medium">{attempt.filename}</span>
                            {attempt.state === "preparing" ?
                                <span className="text-muted-foreground text-xs">preparing…</span>
                            : attempt.state === "sending" ?
                                <span className="text-muted-foreground text-xs">sending…</span>
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
