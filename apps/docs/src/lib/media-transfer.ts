export function transferModeFor(size: number, multipartMinimumBytes = 5 * 1024 * 1024): "multipart" | "server" {
    return size >= multipartMinimumBytes ? "multipart" : "server";
}
