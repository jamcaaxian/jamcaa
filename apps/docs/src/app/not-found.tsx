import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <main id="main-content" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-16 sm:px-6">
            <p className="text-primary text-sm font-semibold">404</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Page not found</h1>
            <p className="text-muted-foreground mt-4 leading-7 text-pretty">
                The address may have changed, or the page may not exist on this Site.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
                <Button nativeButton={false} render={<Link href="/" />}>
                    Go home
                </Button>
                <Button variant="outline" nativeButton={false} render={<Link href="/admin" />}>
                    Open admin
                </Button>
            </div>
        </main>
    );
}
