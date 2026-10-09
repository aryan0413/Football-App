import { jsonError, requireGroupRole } from "@/lib/auth";
import { AUCTION_STARTING_PURSE } from "@/lib/auctionRules";
import { emptyAuctionState, parseAuctionState, serializeAuctionState } from "@/lib/auctionLive";
import { getSupabaseAdmin } from "@/lib/supabase";
import { duplicateEmptyTeamIds, uniqueNamedTeams } from "@/lib/teams";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function timeNow() {
  return new Date().toISOString().slice(11, 16);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const groupId = String(body.groupId ?? "");
    const matchId = String(body.matchId ?? "");
    await requireGroupRole(groupId, ["OWNER", "ADMIN"]);

    const supabase = getSupabaseAdmin();
    let auctionMatchId = matchId;

    if (!auctionMatchId) {
      const { data: existingAuctionMatch, error: existingAuctionError } = await supabase
        .from("matches")
        .select("id")
        .eq("group_id", groupId)
        .eq("status", "AUCTION")
        .order("scheduled_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingAuctionError) throw existingAuctionError;
      if (existingAuctionMatch) {
        return Response.json({ matchId: existingAuctionMatch.id, reused: true });
      }

      const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert({
          group_id: groupId,
          scheduled_date: today(),
          auction_time: timeNow(),
          match_time: timeNow(),
          location: "To be decided",
          maximum_players: Number(body.maximumPlayers ?? 12),
          notes: "Auction started immediately",
          status: "AUCTION"
        })
        .select("*")
        .single();

      if (matchError) throw matchError;
      auctionMatchId = match.id;
    } else {
      const { error: updateError } = await supabase
        .from("matches")
        .update({ status: "AUCTION", auction_time: timeNow() })
        .eq("id", auctionMatchId)
        .eq("group_id", groupId);

      if (updateError) throw updateError;
    }

    const { data: auction, error } = await supabase
      .from("auctions")
      .upsert({ match_id: auctionMatchId, status: "DRAFT", starting_purse: Number(body.startingPurse ?? AUCTION_STARTING_PURSE) }, { onConflict: "match_id" })
      .select("*")
      .single();

    if (error) throw error;

    const { data: matchNotes, error: notesReadError } = await supabase
      .from("matches")
      .select("notes")
      .eq("id", auctionMatchId)
      .maybeSingle();
    if (notesReadError) throw notesReadError;
    const existingState = parseAuctionState(matchNotes?.notes, "DRAFT");
    if (existingState.kind !== "football-auction-state-v1" || !matchNotes?.notes?.includes("football-auction-state-v1")) {
      const { error: notesError } = await supabase
        .from("matches")
        .update({ notes: serializeAuctionState(emptyAuctionState("DRAFT")) })
        .eq("id", auctionMatchId);
      if (notesError) throw notesError;
    }

    const { data: existingTeams, error: teamReadError } = await supabase
      .from("teams")
      .select("id, name, team_players(player_id)")
      .eq("match_id", auctionMatchId);

    if (teamReadError) throw teamReadError;

    const existingNames = new Set(uniqueNamedTeams(existingTeams ?? []).map((team) => String(team.name).toLowerCase()));
    const missingTeams = ["Team A", "Team B"]
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name) => ({ match_id: auctionMatchId, name }));

    if (missingTeams.length) {
      const { error: teamCreateError } = await supabase
        .from("teams")
        .insert(missingTeams);

      if (teamCreateError) throw teamCreateError;
    }

    const { data: allTeams, error: allTeamsError } = await supabase
      .from("teams")
      .select("id, name, captain_id, team_players(player_id)")
      .eq("match_id", auctionMatchId)
      .order("name");
    if (allTeamsError) throw allTeamsError;

    const duplicateIds = duplicateEmptyTeamIds(allTeams ?? []);

    if (duplicateIds.length) {
      const { error: duplicateDeleteError } = await supabase.from("teams").delete().in("id", duplicateIds);
      if (duplicateDeleteError) throw duplicateDeleteError;
    }

    return Response.json({ auction, matchId: auctionMatchId });
  } catch (error) {
    return jsonError(error);
  }
}
