"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileFingerprint, uploadMultipartWithFallback, type MultipartUploadPlan } from "@/lib/multipart-upload";

interface Attempt {
    key: string;
    filename: string;
    state: "preparing" | "sending" | "confirming" | "done" | "failed";
    progress?: number;
    problem?: string;
}

interface DirectUploadAnswer {
    mode?: "multipart" | "server";
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

        setAttempts(chosen.map(file => ({ key: fileFingerprint(file), filename: file.name, state: "preparing" })));

        // One at a time: the database serves queries serially, and a burst of parallel
        // uploads competes with the reads each of them needs.
        for (const file of chosen) {
            const attemptKey = fileFingerprint(file);
            const settle = (state: Attempt["state"], problem?: string) =>
                setAttempts(current =>
                    current.map(attempt => (attempt.key === attemptKey ? { ...attempt, state, problem } : attempt))
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

                if (plan.mode === "multipart") {
                    settle("sending");
                    try {
                        let currentMultipartId = "";

                        await uploadMultipartWithFallback({
                            file,
                            prepare: async () => {
                                const response = await fetch("/api/media/multipart", {
                                    method: "POST",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({
                                        name: file.name,
                                        type: file.type,
                                        size: file.size,
                                        fingerprint: fileFingerprint(file)
                                    })
                                });
                                const answer = (await response.json().catch(() => ({}))) as MultipartUploadPlan & {
                                    error?: string;
                                };

                                if (!response.ok || !answer.id || !Array.isArray(answer.parts)) {
                                    throw new Error(
                                        answer.error ?? `Multipart preparation answered ${response.status}.`
                                    );
                                }

                                currentMultipartId = answer.id;
                                return answer;
                            },
                            uploadPart: async (part, body) => {
                                const response = await fetch(part.putUrl, { method: "PUT", body });

                                if (!response.ok) {
                                    throw new Error(
                                        `Part ${part.partNumber} answered ${response.status}. Check the connection and bucket CORS rules.`
                                    );
                                }

                                const etag = response.headers.get("etag");

                                if (!etag) {
                                    throw new Error(`Part ${part.partNumber} did not return an ETag.`);
                                }

                                return etag;
                            },
                            recordPart: async part => {
                                const multipartId = currentMultipartId;

                                if (!multipartId) {
                                    throw new Error("The multipart upload identifier is missing.");
                                }

                                const response = await fetch("/api/media/multipart", {
                                    method: "PATCH",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ id: multipartId, ...part })
                                });

                                if (!response.ok) {
                                    throw new Error(`Part ${part.partNumber} could not be recorded.`);
                                }
                            },
                            onProgress: progress =>
                                setAttempts(current =>
                                    current.map(attempt =>
                                        attempt.key === attemptKey ?
                                            {
                                                ...attempt,
                                                state: "sending",
                                                progress: Math.round(
                                                    (progress.completedBytes / progress.totalBytes) * 100
                                                )
                                            }
                                        :   attempt
                                    )
                                ),
                            complete: async id => {
                                settle("confirming");
                                const response = await fetch("/api/media/multipart", {
                                    method: "PUT",
                                    headers: { "content-type": "application/json" },
                                    body: JSON.stringify({ id })
                                });

                                if (!response.ok) {
                                    const answer = (await response.json().catch(() => ({}))) as { error?: string };
                                    throw new Error(answer.error ?? `Confirmation answered ${response.status}.`);
                                }
                            },
                            uploadServer: async fallbackFile => {
                                settle("sending");
                                const body = new FormData();
                                body.set("file", fallbackFile);
                                const response = await fetch("/api/media", { method: "POST", body });

                                if (!response.ok) {
                                    const answer = (await response.json().catch(() => ({}))) as { error?: string };
                                    throw new Error(answer.error ?? `Server fallback answered ${response.status}.`);
                                }
                            }
                        });

                        settle("done");
                    } catch (error) {
                        settle("failed", error instanceof Error ? error.message : "The upload failed.");
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
                        <li key={attempt.key} className="flex flex-wrap items-baseline gap-2">
                            <span className="truncate font-medium">{attempt.filename}</span>
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
