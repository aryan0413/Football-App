import { jsonError, requireAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

type RatingInput = {
  ratedPlayerId?: string;
  rating?: number;
};

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const ratings: RatingInput[] = Array.isArray(body.ratings) ? body.ratings : [];

    const supabase = getSupabaseAdmin();
    const { data: raterParticipant, error: raterError } = await supabase
      .from("team_players")
      .select("player_id, teams!inner(match_id)")
      .eq("player_id", user.id)
      .eq("teams.match_id", matchId)
      .maybeSingle();

    if (raterError) throw raterError;
    if (!raterParticipant) {
      return Response.json({ error: "Only match participants can submit ratings." }, { status: 403 });
    }

    const ratedIds = ratings.map((item) => String(item.ratedPlayerId ?? ""));
    if (ratedIds.includes(user.id)) {
      return Response.json({ error: "You cannot rate yourself." }, { status: 400 });
    }

    const { data: participants, error: participantError } = await supabase
      .from("team_players")
      .select("player_id, teams!inner(match_id)")
      .eq("teams.match_id", matchId)
      .in("player_id", ratedIds);

    if (participantError) throw participantError;
    const participantIds = new Set((participants ?? []).map((item: any) => item.player_id));

    const rows = ratings.map((item) => {
      const ratedPlayerId = String(item.ratedPlayerId ?? "");
      const rating = Number(item.rating);
      if (!participantIds.has(ratedPlayerId)) throw new Error("Can only rate match participants.");
      if (Number.isNaN(rating) || rating < 1 || rating > 10) throw new Error("Ratings must be 1-10.");
      return { match_id: matchId, rater_id: user.id, rated_player_id: ratedPlayerId, rating };
    });

    const { error } = await supabase
      .from("player_ratings")
      .insert(rows);

    if (error) {
      if (error.code === "23505") return Response.json({ error: "A player can only be rated once per match." }, { status: 409 });
      throw error;
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
