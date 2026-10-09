import { jsonError, requireGroupRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const teamId = String(body.teamId ?? "");
    const playerId = String(body.playerId ?? "");
    const assistPlayerId = String(body.assistPlayerId ?? "") || null;
    const minute = body.minute === "" || body.minute === undefined ? null : Number(body.minute);

    if (!matchId || !teamId || !playerId) {
      return Response.json({ error: "Match, team, and scorer are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, group_id, status")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) throw matchError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });
    if (match.status !== "LIVE") return Response.json({ error: "Start the match before recording goals." }, { status: 400 });

    await requireGroupRole(match.group_id, ["OWNER", "ADMIN"]);

    const [{ data: team }, { data: scorerMember }, { data: assistMember }] = await Promise.all([
      supabase.from("teams").select("id, team_players(player_id)").eq("id", teamId).eq("match_id", matchId).maybeSingle(),
      supabase.from("group_members").select("id").eq("group_id", match.group_id).eq("user_id", playerId).maybeSingle(),
      assistPlayerId
        ? supabase.from("group_members").select("id").eq("group_id", match.group_id).eq("user_id", assistPlayerId).maybeSingle()
        : Promise.resolve({ data: null } as any)
    ]);

    if (!team) return Response.json({ error: "Team does not belong to this match." }, { status: 400 });
    if (!scorerMember) return Response.json({ error: "Scorer must be in this group." }, { status: 400 });
    if (assistPlayerId && assistPlayerId === playerId) return Response.json({ error: "Scorer and assister must be different players." }, { status: 400 });
    if (assistPlayerId && !assistMember) return Response.json({ error: "Assister must be in this group." }, { status: 400 });
    const assignedPlayerIds = new Set((team.team_players ?? []).map((row: any) => row.player_id));
    if (assignedPlayerIds.size && !assignedPlayerIds.has(playerId)) {
      return Response.json({ error: "Scorer must belong to the selected team." }, { status: 400 });
    }
    if (assistPlayerId && assignedPlayerIds.size && !assignedPlayerIds.has(assistPlayerId)) {
      return Response.json({ error: "Assister must belong to the selected team." }, { status: 400 });
    }
    if (minute !== null && (!Number.isFinite(minute) || minute < 0 || minute > 180)) {
      return Response.json({ error: "Minute must be between 0 and 180." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("match_events")
      .insert({
        match_id: matchId,
        event_type: "GOAL",
        team_id: teamId,
        player_id: playerId,
        assist_player_id: assistPlayerId,
        minute
      })
      .select("id, event_type, team_id, player_id, assist_player_id, minute, created_at, scorer:player_id(id, display_name, preferred_position, profile_image), assister:assist_player_id(id, display_name, preferred_position, profile_image)")
      .single();

    if (error) throw error;
    return Response.json({ event: data });
  } catch (error) {
    return jsonError(error);
  }
}
