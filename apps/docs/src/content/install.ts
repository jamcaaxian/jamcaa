import type { InstallPlan } from "@jamcaa/core/install";
import { fallbackBucketId, siteBuckets } from "./storage";

/** What this site needs in place before anyone can use it. */
export const installPlan: InstallPlan = { buckets: siteBuckets, fallbackBucketId };
