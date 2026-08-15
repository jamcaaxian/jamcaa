import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Languages } from "lucide-react";
import { docsLocales, localeAlternates, localizedPath } from "@/content/locales";
import { publicCopy } from "@/content/public-copy";

export const metadata: Metadata = {
    title: "Jamcaa Docs",
    description: "选择 Jamcaa 文档的阅读语言。Choose your preferred language for Jamcaa Docs.",
    alternates: { canonical: "/", languages: localeAlternates("/", true) }
};

const languages = docsLocales.definitions.map(definition => ({
    locale: definition.tag,
    label: definition.label,
    detail: publicCopy(definition.tag).languageChooserDetail
}));

export default function LanguageChooser() {
    return (
        <main
            id="main-content"
            className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-16 sm:px-6"
        >
            <div aria-hidden="true" className="docs-language-glow absolute inset-0 -z-10" />
            <section className="w-full max-w-3xl">
                <header className="mx-auto mb-10 max-w-2xl text-center">
                    <span className="bg-foreground text-background mx-auto mb-6 grid size-12 place-items-center rounded-2xl font-mono text-lg font-bold shadow-lifted">
                        J
                    </span>
                    <p className="text-primary mb-3 flex items-center justify-center gap-2 text-sm font-semibold">
                        <Languages className="size-4" />
                        Jamcaa 文档 · Jamcaa Documentation
                    </p>
                    <h1 className="text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-6xl">
                        选择阅读语言
                    </h1>
                    <p className="text-muted-foreground mt-5 text-lg leading-8 text-pretty">
                        简体中文优先维护，英文内容按同一信息架构进行本地化。Choose the language you prefer to read.
                    </p>
                </header>

                <div className="grid gap-4 sm:grid-cols-2">
                    {languages.map(language => (
                        <Link
                            key={language.locale}
                            href={localizedPath(language.locale)}
                            hrefLang={language.locale}
                            className="group bg-card/80 hover:bg-card focus-visible:ring-ring rounded-3xl border p-6 shadow-soft backdrop-blur-xl transition-[transform,box-shadow,background-color] duration-200 ease-spring-snappy hover:-translate-y-0.5 hover:shadow-lifted focus-visible:ring-3 focus-visible:outline-none active:scale-[0.99] sm:p-8"
                        >
                            <div className="flex items-start justify-between gap-5">
                                <div>
                                    <h2 className="text-2xl font-semibold tracking-tight">{language.label}</h2>
                                    <p className="text-muted-foreground mt-2 leading-7">{language.detail}</p>
                                </div>
                                <span className="bg-secondary group-hover:bg-primary group-hover:text-primary-foreground grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-200">
                                    <ArrowRight className="size-4 transition-transform duration-200 ease-spring-snappy group-hover:translate-x-0.5" />
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </main>
    );
}
