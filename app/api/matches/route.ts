import { jsonError, requireGroupRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const groupId = String(body.groupId ?? "");
    await requireGroupRole(groupId, ["OWNER", "ADMIN"]);

    const startNow = Boolean(body.startNow);
    const withoutAuction = Boolean(body.withoutAuction);
    if (startNow) {
      return Response.json({ error: "Create and schedule the match first, then start it from the match room." }, { status: 400 });
    }

    const payload = {
      group_id: groupId,
      scheduled_date: String(body.scheduledDate ?? ""),
      auction_time: String(body.auctionTime ?? ""),
      match_time: String(body.matchTime ?? ""),
      location: String(body.location ?? "").trim(),
      maximum_players: Number(body.maximumPlayers ?? 12),
      notes: String(body.notes ?? "").trim() || null,
      status: "SCHEDULED"
    };

    if (!payload.scheduled_date || !payload.match_time || !payload.location) {
      return Response.json({ error: "Date, match time, and location are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("matches").insert(payload).select("*").single();
    if (error) throw error;

    if (withoutAuction) {
      const { error: teamsError } = await supabase
        .from("teams")
        .insert([
          { match_id: data.id, name: "Team A" },
          { match_id: data.id, name: "Team B" }
        ]);

      if (teamsError) throw teamsError;
    }

    return Response.json({ match: data });
  } catch (error) {
    return jsonError(error);
  }
}
