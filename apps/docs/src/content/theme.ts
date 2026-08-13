import { resolveTheme, themeToCss } from "@jamcaaxian/core/theme";
import { getSettings } from "@jamcaaxian/core/settings";
import type { Database } from "@jamcaaxian/core/db";
import { siteSettings } from "./settings";

/** The theme the administrator configured, as a stylesheet for the document root. */
export async function siteThemeCss(database: Database): Promise<string> {
    const settings = await getSettings(database, siteSettings);
    const accent = settings.get("theme.accent");

    if (!accent) {
        return "";
    }

    return themeToCss(resolveTheme({ primary: accent }));
}
