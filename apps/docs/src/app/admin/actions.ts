"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export async function signOut() {
    const auth = await getAuth();

    await auth.api.signOut({ headers: await headers() });

    redirect("/login");
}
