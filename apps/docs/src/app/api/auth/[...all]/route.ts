import { getAuth } from "@/lib/auth";

async function handler(request: Request): Promise<Response> {
    const auth = await getAuth();
    return auth.handler(request);
}

export { handler as GET, handler as POST };
