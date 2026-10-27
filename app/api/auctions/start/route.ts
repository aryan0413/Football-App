import { createHash } from "node:crypto";
import { jsonError, requireGroupRole } from "@/lib/auth";
import { AUCTION_STARTING_PURSE } from "@/lib/auctionRules";
import { emptyAuctionState, parseAuctionState, serializeAuctionState } from "@/lib/auctionLive";
import { getSupabaseAdmin } from "@/lib/supabase";
import { uniqueNamedTeams } from "@/lib/teams";

function nextRoomId(groupId: string, previousId: string) {
  // Concurrent create requests for the same round converge on one database row.
  const bytes = createHash("sha256").update(`football-auction:${groupId}:${previousId}`).digest();
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const groupId = String(body.groupId ?? "");
    const requestedId = String(body.matchId ?? "");
    await requireGroupRole(groupId, ["OWNER", "ADMIN"]);
    const supabase = getSupabaseAdmin();
    let query = supabase.from("matches").select("id, notes, status, auctions(status)").eq("group_id", groupId);
    if (requestedId) query = query.eq("id", requestedId);
    const { data: matches, error: readError } = await query.order("created_at", { ascending: false });
    if (readError) throw readError;
    if (requestedId && !matches?.length) return Response.json({ error: "Auction not found in this group." }, { status: 404 });
    if (requestedId && matches?.[0].status !== "AUCTION") {
      return Response.json({ error: "This match is no longer in auction setup." }, { status: 409 });
    }
    let match = requestedId ? matches?.[0] : matches?.find((row: any) => {
      const auction = Array.isArray(row.auctions) ? row.auctions[0] : row.auctions;
      return row.status === "AUCTION" && auction?.status !== "ENDED" && parseAuctionState(row.notes).status !== "ENDED";
    });
    const reused = Boolean(match);
    if (!match) {
      const now = new Date().toISOString();
      const maximumPlayers = Number(body.maximumPlayers ?? 12);
      if (!Number.isInteger(maximumPlayers) || maximumPlayers < 2 || maximumPlayers > 1000) {
        return Response.json({ error: "Choose a valid player limit." }, { status: 400 });
      }
      const id = nextRoomId(groupId, matches?.[0]?.id ?? "first");
      const { error } = await supabase.from("matches").insert({
        id, group_id: groupId, scheduled_date: now.slice(0, 10), auction_time: now.slice(11, 16),
        match_time: now.slice(11, 16), location: "To be decided", maximum_players: maximumPlayers,
        notes: serializeAuctionState(emptyAuctionState()), status: "AUCTION"
      });
      if (error && error.code !== "23505") throw error;
      const { data, error: matchError } = await supabase.from("matches").select("id, notes, status").eq("id", id).single();
      if (matchError) throw matchError;
      match = data;
    }
    // Never upsert DRAFT over an existing LIVE or completed auction.
    const existingState = parseAuctionState(match!.notes);
    const initialStatus = existingState.status === "ENDED" ? "ENDED" : ["LIVE", "PAUSED"].includes(existingState.status) ? "LIVE" : "DRAFT";
    const { error: auctionError } = await supabase.from("auctions").upsert({
      match_id: match!.id, status: initialStatus, starting_purse: AUCTION_STARTING_PURSE
    }, { onConflict: "match_id", ignoreDuplicates: true });
    if (auctionError) throw auctionError;
    const { data: auction, error } = await supabase.from("auctions").select("*").eq("match_id", match!.id).single();
    if (error) throw error;
    if (auction.status === "DRAFT" && parseAuctionState(match!.notes).status === "DRAFT") {
      const { data: teams, error: teamError } = await supabase.from("teams").select("id, name, captain_id").eq("match_id", match!.id);
      if (teamError) throw teamError;
      const names = new Set(uniqueNamedTeams(teams ?? []).map((team) => team.name));
      const missing = ["Team A", "Team B"].filter((name) => !names.has(name));
      for (const name of missing) {
        const teamId = nextRoomId(match!.id, name);
        const { error: createError } = await supabase.from("teams").upsert({ id: teamId, match_id: match!.id, name }, { onConflict: "id", ignoreDuplicates: true });
        if (createError) throw createError;
      }
    }
    return Response.json({ matchId: match!.id, auction, reused });
  } catch (error) {
    return jsonError(error);
  }
}
