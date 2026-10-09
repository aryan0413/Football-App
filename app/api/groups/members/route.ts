import { jsonError, requireGroupRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const groupId = String(body.groupId ?? "");
    const userId = String(body.userId ?? "");

    if (!groupId || !userId) {
      return Response.json({ error: "Group and user are required." }, { status: 400 });
    }

    const { user, role } = await requireGroupRole(groupId, ["OWNER", "ADMIN"]);
    if (user.id === userId) {
      return Response.json({ error: "You cannot remove yourself from the group here." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: target, error: targetError } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) return Response.json({ error: "User is not in this group." }, { status: 404 });
    if (target.role === "OWNER") {
      return Response.json({ error: "The group owner cannot be removed." }, { status: 400 });
    }
    if (role === "ADMIN" && target.role !== "PLAYER") {
      return Response.json({ error: "Admins can remove players only." }, { status: 403 });
    }

    const { data: openMatches, error: matchError } = await supabase
      .from("matches")
      .select("id")
      .eq("group_id", groupId)
      .in("status", ["SCHEDULED", "AUCTION"]);
    if (matchError) throw matchError;

    const matchIds = (openMatches ?? []).map((match: any) => match.id).filter(Boolean);
    if (matchIds.length) {
      const { error: availabilityError } = await supabase
        .from("match_availability")
        .delete()
        .in("match_id", matchIds)
        .eq("user_id", userId);
      if (availabilityError) throw availabilityError;

      const { error: captainError } = await supabase
        .from("teams")
        .update({ captain_id: null })
        .in("match_id", matchIds)
        .eq("captain_id", userId);
      if (captainError) throw captainError;

      const { data: teams, error: teamError } = await supabase
        .from("teams")
        .select("id")
        .in("match_id", matchIds);
      if (teamError) throw teamError;

      const teamIds = (teams ?? []).map((team: any) => team.id).filter(Boolean);
      if (teamIds.length) {
        const { error: teamPlayerError } = await supabase
          .from("team_players")
          .delete()
          .in("team_id", teamIds)
          .eq("player_id", userId);
        if (teamPlayerError) throw teamPlayerError;
      }
    }

    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
