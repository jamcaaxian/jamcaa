import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Workspace packages ship TypeScript source rather than a build artifact.
    transpilePackages: ["@jamcaa/core"],
    typescript: {
        // Type checking runs as a separate `typecheck` task using TypeScript 7's tsc,
        // which has no compiler API for Next to call into. See docs/adr/0014.
        ignoreBuildErrors: true
    }
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
