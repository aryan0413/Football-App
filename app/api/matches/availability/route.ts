import { jsonError, requireAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { AvailabilityStatus } from "@/lib/types";

const statuses = new Set<AvailabilityStatus>(["PLAYING", "NOT_PLAYING", "MAYBE"]);

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const status = String(body.status ?? "") as AvailabilityStatus;

    if (!matchId || !statuses.has(status)) {
      return Response.json({ error: "Match and valid status are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, group_id")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) throw matchError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });

    const { data: member, error: memberError } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", match.group_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) return Response.json({ error: "Only group members can RSVP." }, { status: 403 });

    const { data, error } = await supabase
      .from("match_availability")
      .upsert({ match_id: matchId, user_id: user.id, status }, { onConflict: "match_id,user_id" })
      .select("*")
      .single();

    if (error) throw error;
    return Response.json({ availability: data });
  } catch (error) {
    return jsonError(error);
  }
}
