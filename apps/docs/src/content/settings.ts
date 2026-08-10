import { permalinkSettings } from "@jamcaa/core/content";
import { coreSettings, mergeSettings } from "@jamcaa/core/settings";
import { post } from "./collections";
import { checkPublicPermalink } from "./public-paths";
import { contentModel } from "./schema";

const permalinks = permalinkSettings(contentModel.collections);
const postPermalink = permalinks[`permalink.${post.name}`]!;

const sitePermalinks = { ...permalinks, [`permalink.${post.name}`]: { ...postPermalink, check: checkPublicPermalink } };

export const siteSettings = mergeSettings(coreSettings, sitePermalinks);
