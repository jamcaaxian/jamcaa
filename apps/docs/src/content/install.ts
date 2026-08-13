import type { InstallPlan } from "@jamcaaxian/core/install";
import { coreCapabilities } from "@jamcaaxian/core/auth";
import { fallbackBucketId, siteBuckets } from "./storage";

export const siteCapabilities = coreCapabilities;

/** What this site needs in place before anyone can use it. */
export const installPlan: InstallPlan = { buckets: siteBuckets, fallbackBucketId, capabilities: siteCapabilities };
