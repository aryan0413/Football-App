import { jsonError, requireGroupRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const scheduledDate = String(body.scheduledDate ?? "");
    const matchTime = String(body.matchTime ?? "");
    const location = String(body.location ?? "").trim();
    const maximumPlayers = Number(body.maximumPlayers ?? 12);

    if (!matchId || !scheduledDate || !matchTime || !location) {
      return Response.json({ error: "Date, time, and location are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, group_id, status")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) throw matchError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });

    await requireGroupRole(match.group_id, ["OWNER", "ADMIN"]);

    const { data: auction, error: auctionError } = await supabase
      .from("auctions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (auctionError) throw auctionError;
    if (auction && auction.status !== "ENDED") {
      return Response.json({ error: "Complete the auction before scheduling this match." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("matches")
      .update({
        scheduled_date: scheduledDate,
        match_time: matchTime,
        location,
        maximum_players: maximumPlayers,
        status: "SCHEDULED"
      })
      .eq("id", matchId)
      .select("*")
      .single();

    if (error) throw error;
    return Response.json({ match: data });
  } catch (error) {
    return jsonError(error);
  }
}
