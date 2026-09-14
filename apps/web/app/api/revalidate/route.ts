import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Called by the API after incident state changes. Secret is not the session —
 * this route is not a tenant data leak because it only busts a cache tag.
 */
export async function POST(request: Request) {
  const expected = process.env.STATUS_REVALIDATE_SECRET;
  const provided = request.headers.get("x-revalidate-secret");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orgSlug =
    typeof body === "object" && body && "orgSlug" in body && typeof body.orgSlug === "string"
      ? body.orgSlug
      : null;
  if (!orgSlug || !/^[a-z0-9-]+$/i.test(orgSlug)) {
    return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
  }

  revalidateTag(`public-status:${orgSlug}`);
  revalidatePath(`/status/${orgSlug}`);
  return NextResponse.json({ revalidated: true, orgSlug });
}
