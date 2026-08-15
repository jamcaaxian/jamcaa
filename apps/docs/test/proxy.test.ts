import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";

describe("public Locale routing", () => {
    it("redirects a case-insensitive Locale match to its canonical URL key", () => {
        const response = middleware(new NextRequest("https://example.com/EN-US/docs?from=test"));

        expect(response.status).toBe(308);
        expect(response.headers.get("location")).toBe("https://example.com/en-us/docs?from=test");
    });

    it("keeps an already canonical Locale path in place", () => {
        const response = middleware(new NextRequest("https://example.com/zh-hans-cn/docs"));

        expect(response.status).toBe(200);
        expect(response.headers.get("content-language")).toBe("zh-Hans-CN");
    });
});
