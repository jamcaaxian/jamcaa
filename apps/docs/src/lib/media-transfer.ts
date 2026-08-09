export function transferModeFor(size: number, directMinimumBytes = 5 * 1024 * 1024): "direct" | "server" {
    return size >= directMinimumBytes ? "direct" : "server";
}
