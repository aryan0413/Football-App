import { jsonError, requireGroupRole } from "@/lib/auth";
import { emptyAuctionState, serializeAuctionState } from "@/lib/auctionLive";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const teams = Array.isArray(body.teams) ? body.teams : [];
    const playerIds: string[] = Array.isArray(body.playerIds) ? body.playerIds.map((id: unknown) => String(id)).filter(Boolean) : [];

    if (!matchId || teams.length < 2 || playerIds.length < 1) {
      return Response.json({ error: "Choose two captains and at least one auction player." }, { status: 400 });
    }

    const captainIds = teams.map((team: any) => String(team.captainId ?? "")).filter(Boolean);
    if (captainIds.length < 2 || new Set(captainIds).size !== captainIds.length) {
      return Response.json({ error: "Choose two different captains." }, { status: 400 });
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

    const { data: auction, error: auctionError } = await supabase
      .from("auctions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (auctionError) throw auctionError;
    if (auction && auction.status !== "DRAFT") {
      return Response.json({ error: "Auction setup can only be changed before the auction starts." }, { status: 400 });
    }

    const selectedUserIds = Array.from(new Set([...captainIds, ...playerIds]));
    const { data: groupMembers, error: memberError } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", match.group_id)
      .in("user_id", selectedUserIds);

    if (memberError) throw memberError;
    const validMemberIds = new Set((groupMembers ?? []).map((member: any) => member.user_id));
    if (selectedUserIds.some((id) => !validMemberIds.has(id))) {
      return Response.json({ error: "Captains and auction players must be from this group." }, { status: 400 });
    }

    const teamUpdates = teams.map((team: any) => ({
      id: String(team.id ?? ""),
      match_id: matchId,
      captain_id: String(team.captainId ?? "")
    })).filter((team: any) => team.id && team.captain_id);

    for (const team of teamUpdates) {
      const { error: teamError } = await supabase
        .from("teams")
        .update({ captain_id: team.captain_id })
        .eq("id", team.id)
        .eq("match_id", matchId);
      if (teamError) throw teamError;
    }

    const { error: clearAvailabilityError } = await supabase
      .from("match_availability")
      .delete()
      .eq("match_id", matchId);
    if (clearAvailabilityError) throw clearAvailabilityError;

    const availabilityRows = Array.from(new Set(playerIds)).map((userId) => ({
      match_id: matchId,
      user_id: userId,
      status: "PLAYING"
    }));

    const { error: availabilityError } = await supabase
      .from("match_availability")
      .upsert(availabilityRows, { onConflict: "match_id,user_id" });
    if (availabilityError) throw availabilityError;

    const setupState = {
      ...emptyAuctionState("DRAFT"),
      order: Array.from(new Set(playerIds))
    };
    const { error: notesError } = await supabase
      .from("matches")
      .update({ notes: serializeAuctionState(setupState) })
      .eq("id", matchId);
    if (notesError) throw notesError;

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
