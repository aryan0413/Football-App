import { jsonError, requireGroupRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const formations = new Set(["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const teams = Array.isArray(body.teams) ? body.teams : [];

    if (!matchId || teams.length < 1) {
      return Response.json({ error: "Match and teams are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, group_id")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError) throw matchError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });

    await requireGroupRole(match.group_id, ["OWNER", "ADMIN"]);

    const updates = teams.map((team: any) => ({
      id: String(team.id ?? ""),
      match_id: matchId,
      formation: formations.has(String(team.formation ?? "")) ? String(team.formation) : "4-3-3",
      captain_id: team.captainId ? String(team.captainId) : null
    })).filter((team: any) => team.id);

    if (!updates.length) return Response.json({ error: "No valid teams provided." }, { status: 400 });

    const updatedTeams = [];
    for (const team of updates) {
      const { data, error } = await supabase
        .from("teams")
        .update({ formation: team.formation, captain_id: team.captain_id })
        .eq("id", team.id)
        .eq("match_id", matchId)
        .select("id, name, formation, captain_id")
        .maybeSingle();

      if (error) {
        if (error.message?.includes("formation")) {
          return Response.json(
            { error: "Supabase needs the team formation column added. Run supabase/add-team-formations.sql once, then save again." },
            { status: 400 }
          );
        }
        throw error;
      }
      if (data) updatedTeams.push(data);
    }

    return Response.json({ teams: updatedTeams });
  } catch (error) {
    return jsonError(error);
  }
}
