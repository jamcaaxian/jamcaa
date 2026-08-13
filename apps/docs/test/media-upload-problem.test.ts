import { describe, expect, it } from "vitest";
import { EditorMediaError } from "@jamcaaxian/editor/media";
import { mediaUploadProblem } from "@/app/admin/media/media-upload-problem";

describe("the Site Media upload error copy", () => {
    it("maps adapter diagnostics to stable Site-owned copy", () => {
        const error = new EditorMediaError("image-upload-failed", "Bucket credentials expired.");

        expect(mediaUploadProblem(error)).toBe("The upload failed.");
    });
});
