import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  try {
    const { error } = await getSupabaseAdmin()
      .from("users")
      .select("id", { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(5000));

    if (error) throw error;
    return Response.json({ ok: true, database: "available" }, { headers });
  } catch {
    return Response.json({ ok: false, database: "unavailable" }, { status: 503, headers });
  }
}
