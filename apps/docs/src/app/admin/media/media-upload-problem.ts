import { EditorMediaError, type EditorMediaErrorCode } from "@jamcaaxian/editor/media";

const messages: Record<EditorMediaErrorCode, string> = {
    "image-upload-failed": "The upload failed.",
    "media-unavailable": "The Media library could not be read."
};

export function mediaUploadProblem(error: unknown) {
    return error instanceof EditorMediaError ? messages[error.code] : "The upload failed.";
}
