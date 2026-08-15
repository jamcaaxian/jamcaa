import { EditorMediaError, type EditorMediaErrorCode } from "@jamcaaxian/editor/media";
import { adminCopy, type AdminCopy } from "@/content/admin-copy";

export function mediaUploadProblem(error: unknown, copy: AdminCopy["media"] = adminCopy("en-US").media) {
    const messages: Record<EditorMediaErrorCode, string> = {
        "image-upload-failed": copy.uploadFailed,
        "media-unavailable": copy.unavailable
    };

    return error instanceof EditorMediaError ? messages[error.code] : copy.uploadFailed;
}
