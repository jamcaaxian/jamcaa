"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, Archive, Ellipsis, FilePenLine, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface EditorialFormState {
    error?: string;
    saved?: boolean;
}

export interface EditorialStatusOption {
    value: string;
    label: string;
}

export interface EditorialWorkspaceMessages {
    more: string;
    settings: string;
    saveDraft: string;
    archive: string;
    cancel: string;
    saving: string;
    keyboardSave: string;
}

export function EditorialTitleInput({
    name,
    value,
    onChange,
    placeholder,
    label,
    required = true
}: {
    name: string;
    value: string;
    onChange(value: string): void;
    placeholder: string;
    label: string;
    required?: boolean;
}) {
    const input = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        if (input.current === null) {
            return;
        }

        input.current.style.height = "0";
        input.current.style.height = `${input.current.scrollHeight}px`;
    }, [value]);

    return (
        <textarea
            ref={input}
            className="editorial-title-input"
            name={name}
            value={value}
            onChange={event => onChange(event.currentTarget.value)}
            placeholder={placeholder}
            aria-label={label}
            rows={1}
            required={required}
        />
    );
}

export function EditorialWorkspace({
    action,
    formId,
    backHref,
    backLabel,
    initialStatus,
    reviewStatus,
    statuses,
    reviewLabel,
    settingsTitle,
    settingsDescription,
    statusLabel,
    statusDescription,
    submitLabel,
    messages,
    savedMessage,
    canSubmit = true,
    children,
    settings,
    moreActions,
    dangerZone,
    hiddenFields
}: {
    action: (state: EditorialFormState, formData: FormData) => Promise<EditorialFormState>;
    formId: string;
    backHref: string;
    backLabel: string;
    initialStatus: string;
    reviewStatus: string;
    statuses: readonly EditorialStatusOption[];
    reviewLabel: string;
    settingsTitle: string;
    settingsDescription: string;
    statusLabel: string;
    statusDescription?: string;
    submitLabel(status: string): string;
    messages: EditorialWorkspaceMessages;
    savedMessage?: string;
    canSubmit?: boolean;
    children: ReactNode;
    settings?: ReactNode;
    moreActions?: ReactNode;
    dangerZone?: ReactNode;
    hiddenFields?: ReactNode;
}) {
    const [savedStatus, setSavedStatus] = useState(initialStatus);
    const [submissionStatus, setSubmissionStatus] = useState(initialStatus);
    const [stagedStatus, setStagedStatus] = useState(initialStatus);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [dirty, setDirty] = useState(false);
    const form = useRef<HTMLFormElement>(null);
    const portalContainer = useRef<HTMLDivElement>(null);
    const submittedStatus = useRef(initialStatus);
    const currentStatus = statuses.find(option => option.value === savedStatus) ?? statuses[0];

    const submitAction = useCallback(
        async (previousState: EditorialFormState, formData: FormData) => {
            const nextState = await action(previousState, formData);

            if (nextState.error !== undefined) {
                setSubmissionStatus(savedStatus);
                setSettingsOpen(true);
            } else if (nextState.saved) {
                const nextStatus = submittedStatus.current;
                setSavedStatus(nextStatus);
                setSubmissionStatus(nextStatus);
                setStagedStatus(nextStatus);
                setDirty(false);
                setSettingsOpen(false);
            }

            return nextState;
        },
        [action, savedStatus]
    );
    const [state, formAction, pending] = useActionState<EditorialFormState, FormData>(submitAction, {});

    const openSettings = useCallback(
        (nextStatus = savedStatus) => {
            setStagedStatus(nextStatus);
            setSettingsOpen(true);
        },
        [savedStatus]
    );

    const submitWithStatus = useCallback(
        (nextStatus: string) => {
            if (pending || !canSubmit || form.current === null) {
                return;
            }

            submittedStatus.current = nextStatus;
            flushSync(() => {
                setSubmissionStatus(nextStatus);
                setDirty(true);
            });
            form.current.requestSubmit();
        },
        [canSubmit, pending]
    );

    useEffect(() => {
        const save = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() !== "s" || (!event.metaKey && !event.ctrlKey)) {
                return;
            }

            event.preventDefault();
            submitWithStatus(savedStatus);
        };

        window.addEventListener("keydown", save);
        return () => window.removeEventListener("keydown", save);
    }, [savedStatus, submitWithStatus]);

    return (
        <form
            ref={form}
            id={formId}
            action={formAction}
            className="editorial-workspace"
            aria-busy={pending}
            onInput={() => setDirty(true)}
        >
            <input type="hidden" name="status" value={submissionStatus} />
            {hiddenFields}

            <header className="editorial-workspace__bar">
                <SidebarTrigger type="button" />
                <Separator orientation="vertical" className="editorial-workspace__bar-separator" />
                <Button
                    variant="ghost"
                    size="icon"
                    nativeButton={false}
                    render={<Link href={backHref} aria-label={backLabel} />}
                >
                    <ArrowLeft />
                </Button>

                <div className="editorial-workspace__state" aria-live="polite">
                    <span className="editorial-workspace__state-dot" data-status={savedStatus} />
                    <span className="editorial-workspace__state-label">{currentStatus?.label ?? savedStatus}</span>
                    {pending ?
                        <span className="editorial-workspace__state-message text-muted-foreground">
                            {messages.saving}
                        </span>
                    : state.saved && !dirty && savedMessage ?
                        <span className="editorial-workspace__state-message text-muted-foreground">{savedMessage}</span>
                    :   null}
                </div>

                <div className="editorial-workspace__actions">
                    <span className="editorial-workspace__shortcut">{messages.keyboardSave}</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={
                                <Button type="button" variant="ghost" size="icon" aria-label={messages.more}>
                                    <Ellipsis />
                                </Button>
                            }
                        />
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => openSettings()}>
                                <SlidersHorizontal />
                                {messages.settings}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={!canSubmit || pending}
                                onClick={() => submitWithStatus("draft")}
                            >
                                <FilePenLine />
                                {messages.saveDraft}
                            </DropdownMenuItem>
                            {statuses.some(option => option.value === "archived") ?
                                <DropdownMenuItem
                                    disabled={!canSubmit || pending}
                                    onClick={() => submitWithStatus("archived")}
                                >
                                    <Archive />
                                    {messages.archive}
                                </DropdownMenuItem>
                            :   null}
                            {moreActions ?
                                <>
                                    <DropdownMenuSeparator />
                                    {moreActions}
                                </>
                            :   null}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        type="button"
                        disabled={!canSubmit || pending}
                        onClick={() => {
                            openSettings(reviewStatus);
                        }}
                    >
                        {reviewLabel}
                    </Button>
                </div>
            </header>

            <section className="editorial-workspace__canvas">{children}</section>

            <div ref={portalContainer} />
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetContent
                    className="gap-0 sm:max-w-lg"
                    portalProps={{ container: portalContainer, keepMounted: true }}
                >
                    <SheetHeader className="border-b px-5 py-5">
                        <SheetTitle>{settingsTitle}</SheetTitle>
                        <SheetDescription>{settingsDescription}</SheetDescription>
                    </SheetHeader>
                    <div className="editorial-workspace__settings">
                        {settings}
                        <div className="grid gap-2">
                            <label className="text-sm font-medium" htmlFor={`${formId}-status`}>
                                {statusLabel}
                            </label>
                            <Select
                                value={stagedStatus}
                                items={statuses}
                                onValueChange={value => {
                                    if (value !== null) {
                                        setStagedStatus(value);
                                    }
                                }}
                            >
                                <SelectTrigger id={`${formId}-status`} className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {statuses.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {statusDescription ?
                                <p className="text-muted-foreground text-sm leading-6">{statusDescription}</p>
                            :   null}
                        </div>
                        {state.error ?
                            <p className="text-destructive text-sm" role="alert">
                                {state.error}
                            </p>
                        :   null}
                        {dangerZone ?
                            <div className="border-destructive/20 bg-destructive/5 grid gap-3 rounded-xl border p-4">
                                {dangerZone}
                            </div>
                        :   null}
                    </div>
                    <SheetFooter className="border-t bg-muted/30 sm:flex-row sm:justify-end">
                        <SheetClose render={<Button type="button" variant="outline" />}>{messages.cancel}</SheetClose>
                        <Button
                            type="button"
                            disabled={!canSubmit || pending}
                            onClick={() => submitWithStatus(stagedStatus)}
                        >
                            {pending ? messages.saving : submitLabel(stagedStatus)}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </form>
    );
}

export function EditorialSettingsSection({
    title,
    description,
    className,
    children
}: {
    title: string;
    description?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={cn("grid gap-4 border-b pb-6 last:border-b-0 last:pb-0", className)}>
            <div className="grid gap-1">
                <h3 className="text-sm font-semibold">{title}</h3>
                {description ?
                    <p className="text-muted-foreground text-sm leading-6">{description}</p>
                :   null}
            </div>
            {children}
        </section>
    );
}
