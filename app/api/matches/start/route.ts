import { jsonError, requireGroupRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { duplicateEmptyTeamIds, uniqueNamedTeams } from "@/lib/teams";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const startedDate = String(body.startedDate ?? new Date().toISOString().slice(0, 10));
    const startedTime = String(body.startedTime ?? new Date().toISOString().slice(11, 16));
    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, group_id, status, scheduled_date, match_time, location")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) throw matchError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });
    if (match.status !== "SCHEDULED") {
      return Response.json({ error: "Schedule the match before starting it." }, { status: 400 });
    }
    if (!match.scheduled_date || !match.match_time || !String(match.location ?? "").trim() || match.location === "To be decided") {
      return Response.json({ error: "Add the match date, time, and ground before starting." }, { status: 400 });
    }

    await requireGroupRole(match.group_id, ["OWNER", "ADMIN"]);

    const { data: auction, error: auctionError } = await supabase
      .from("auctions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (auctionError) throw auctionError;
    if (auction && auction.status !== "ENDED") {
      return Response.json({ error: "Complete the auction and schedule the match before starting." }, { status: 400 });
    }

    const { data: teams, error: teamsReadError } = await supabase
      .from("teams")
      .select("id, name, captain_id, team_players(player_id)")
      .eq("match_id", matchId);
    if (teamsReadError) throw teamsReadError;

    const existingNames = new Set(uniqueNamedTeams(teams ?? []).map((team) => team.name.toLowerCase()));
    const missingTeams = ["Team A", "Team B"]
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name) => ({ match_id: matchId, name }));
    if (missingTeams.length) {
      const { error: teamError } = await supabase
        .from("teams")
        .insert(missingTeams);
      if (teamError) throw teamError;
    }

    const duplicateIds = duplicateEmptyTeamIds(teams ?? []);
    if (duplicateIds.length) {
      const { error: duplicateError } = await supabase.from("teams").delete().in("id", duplicateIds);
      if (duplicateError) throw duplicateError;
    }

    const { data, error } = await supabase
      .from("matches")
      .update({ status: "LIVE", scheduled_date: startedDate, match_time: startedTime })
      .eq("id", matchId)
      .select("*")
      .single();

    if (error) throw error;
    return Response.json({ match: data });
  } catch (error) {
    return jsonError(error);
  }
}
