"use server";

import { revalidatePath } from "next/cache";
import {
    createStorageConfiguration,
    type StorageConditions,
    type StorageConfiguration,
    type StorageConfigurationChange
} from "@jamcaaxian/core/media";
import { mediaRuntime } from "@/lib/media";
import { may } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export type StorageFormState = { error?: string; saved?: boolean };

async function configurationForManagement(): Promise<StorageConfiguration> {
    const session = await requireSession();
    const actor = { id: session.user.id, role: session.user.role };

    if (!(await may(actor, "settings", "manage"))) {
        throw new Error("You do not have permission to change storage.");
    }

    const { database, bindings } = mediaRuntime();

    return createStorageConfiguration({ database, bindings });
}

async function apply(change: StorageConfigurationChange): Promise<StorageFormState> {
    try {
        const configuration = await configurationForManagement();

        await configuration.apply(change);
        revalidatePath("/admin/storage");

        return { saved: true };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Storage could not be changed." };
    }
}

function text(formData: FormData, name: string) {
    return String(formData.get(name) ?? "").trim();
}

function values(formData: FormData, name: string) {
    return text(formData, name)
        .split(/[\n,]/)
        .map(value => value.trim())
        .filter(Boolean);
}

function optionalBytes(formData: FormData, name: string) {
    const raw = text(formData, name);

    if (!raw) {
        return undefined;
    }

    const megabytes = Number(raw);

    return Number.isFinite(megabytes) ? Math.round(megabytes * 1024 * 1024) : Number.NaN;
}

function conditionsFrom(formData: FormData): StorageConditions {
    return {
        collections: values(formData, "collections"),
        categories: values(formData, "categories"),
        tags: values(formData, "tags"),
        authorRoles: values(formData, "authorRoles"),
        authorIds: values(formData, "authorIds"),
        mimePrefixes: values(formData, "mimePrefixes"),
        minSize: optionalBytes(formData, "minMegabytes"),
        maxSize: optionalBytes(formData, "maxMegabytes"),
        from: text(formData, "from") || undefined,
        until: text(formData, "until") || undefined
    };
}

export async function createBucket(_previous: StorageFormState, formData: FormData): Promise<StorageFormState> {
    return apply({
        type: "create-binding-bucket",
        bucket: {
            id: text(formData, "id"),
            label: text(formData, "label"),
            binding: text(formData, "binding"),
            bucketName: text(formData, "bucketName"),
            publicUrl: text(formData, "publicUrl")
        }
    });
}

export async function saveBucket(_previous: StorageFormState, formData: FormData): Promise<StorageFormState> {
    return apply({
        type: "update-bucket",
        id: text(formData, "id"),
        label: text(formData, "label"),
        publicUrl: text(formData, "publicUrl")
    });
}

export async function deleteBucket(_previous: StorageFormState, formData: FormData): Promise<StorageFormState> {
    return apply({ type: "delete-bucket", id: text(formData, "id") });
}

export async function createRule(_previous: StorageFormState, formData: FormData): Promise<StorageFormState> {
    return apply({
        type: "create-rule",
        rule: {
            label: text(formData, "label"),
            bucketId: text(formData, "bucketId"),
            conditions: conditionsFrom(formData)
        }
    });
}

export async function saveRule(_previous: StorageFormState, formData: FormData): Promise<StorageFormState> {
    return apply({
        type: "update-rule",
        id: text(formData, "id"),
        rule: {
            label: text(formData, "label"),
            bucketId: text(formData, "bucketId"),
            conditions: conditionsFrom(formData)
        }
    });
}

export async function deleteRule(_previous: StorageFormState, formData: FormData): Promise<StorageFormState> {
    return apply({ type: "delete-rule", id: text(formData, "id") });
}

export async function saveFallback(_previous: StorageFormState, formData: FormData): Promise<StorageFormState> {
    return apply({ type: "update-fallback", bucketId: text(formData, "bucketId") });
}

export async function moveRule(formData: FormData): Promise<void> {
    const configuration = await configurationForManagement();
    const snapshot = await configuration.inspect();
    const ids = snapshot.rules.filter(rule => !rule.isFallback).map(rule => rule.id);
    const id = text(formData, "id");
    const direction = text(formData, "direction");
    const from = ids.indexOf(id);
    const to = direction === "up" ? from - 1 : from + 1;

    if (from < 0 || to < 0 || to >= ids.length) {
        return;
    }

    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    await configuration.apply({ type: "reorder-rules", orderedIds: ids });
    revalidatePath("/admin/storage");
}
