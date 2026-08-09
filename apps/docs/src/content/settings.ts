import { permalinkSettings } from "@jamcaa/core/content";
import { coreSettings, mergeSettings } from "@jamcaa/core/settings";
import { contentModel } from "./schema";

export const siteSettings = mergeSettings(coreSettings, permalinkSettings(contentModel.collections));
