import { toSlug } from "../content/slug";

function twoDigits(value: number) {
    return String(value).padStart(2, "0");
}

/**
 * Dated folders keep a bucket listing usable as a site grows, and the identifier in
 * front means two files of the same name never contend. The readable part keeps its
 * own script, as post addresses do.
 */
export function objectKeyFor(options: { id: string; filename: string; at: Date }): string {
    const { id, filename, at } = options;
    const lastDot = filename.lastIndexOf(".");
    const hasExtension = lastDot > 0 && lastDot < filename.length - 1;
    const extension = hasExtension ? toSlug(filename.slice(lastDot + 1)) : "";
    const readable = toSlug(hasExtension ? filename.slice(0, lastDot) : filename);

    const name = readable ? `${id}-${readable}` : id;
    const folder = `${at.getUTCFullYear()}/${twoDigits(at.getUTCMonth() + 1)}`;

    return extension ? `${folder}/${name}.${extension}` : `${folder}/${name}`;
}
