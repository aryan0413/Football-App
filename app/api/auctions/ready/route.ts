import { jsonError, requireAppUser } from "@/lib/auth";
import { getAuctionSnapshot, nextAuctionPlayerId, parseAuctionState, writeAuctionStateCas } from "@/lib/auctionLive";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const { matchId, forceStart = false } = await request.json();
    if (!matchId) return Response.json({ error: "Match is required." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase.from("matches")
      .select("id, group_id, notes, status, groups(name)").eq("id", matchId).maybeSingle();
    if (matchError) throw matchError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });
    const { data: membership, error: memberError } = await supabase.from("group_members").select("role")
      .eq("group_id", match.group_id).eq("user_id", user.id).maybeSingle();
    if (memberError) throw memberError;
    if (!membership) return Response.json({ error: "You are not in this group." }, { status: 403 });

    const initial = await getAuctionSnapshot(supabase, matchId, match);
    if (!initial.auction) return Response.json({ error: "Auction not found." }, { status: 404 });
    if (initial.state.status === "ENDED" || match.status !== "AUCTION") {
      return Response.json({ error: "Auction is already completed." }, { status: 409 });
    }
    const captains = initial.teams.map((team: any) => team.captain_id).filter(Boolean) as string[];
    const participants = [...captains, initial.state.auctioneerId].filter(Boolean) as string[];
    const participant = participants.includes(user.id);
    const admin = ["OWNER", "ADMIN"].includes(membership.role);
    if ((!participant && !admin) || (forceStart && !admin && initial.state.auctioneerId !== user.id)) {
      return Response.json({ error: "Only selected captains and the auctioneer can join; only an admin or auctioneer can start." }, { status: 403 });
    }
    if (initial.state.status !== "DRAFT") {
      return Response.json({ ok: true, status: initial.state.status, snapshot: initial });
    }
    if (captains.length !== 2 || new Set(participants).size !== 3 || !initial.selectedPlayers.length ||
      initial.selectedPlayers.some((player: any) => participants.includes(player.id))) {
      return Response.json({ error: "Choose two different captains, a separate auctioneer and at least one auction player." }, { status: 400 });
    }
    // An observing admin must not overwrite their PLAYING entry in the player pool.
    if (participant) {
      const { error } = await supabase.from("match_availability").upsert({ match_id: matchId, user_id: user.id, status: "MAYBE" }, { onConflict: "match_id,user_id" });
      if (error) throw error;
    }
    let base = initial;
    let rows: Array<{ user_id: string }> = [];
    let roomReady = false;
    let written: { notes: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase.from("match_availability").select("user_id").eq("match_id", matchId).eq("status", "MAYBE");
      if (result.error) throw result.error;
      rows = result.data ?? [];
      const readyIds = new Set(rows.map((row) => row.user_id));
      roomReady = participants.every((id) => readyIds.has(id));
      const nextState = roomReady ? { ...base.state, status: "LIVE" as const,
        currentPlayerId: nextAuctionPlayerId(base.state, base.selectedPlayers.map((player: any) => player.id)) } : base.state;
      // A readiness change also publishes through the subscribed match row.
      written = await writeAuctionStateCas(supabase, matchId, base.match.notes ?? null, nextState);
      if (written) break;
      base = await getAuctionSnapshot(supabase, matchId);
      if (base.state.status !== "DRAFT") return Response.json({ ok: true, status: base.state.status, snapshot: base });
      if (base.state.auctioneerId !== initial.state.auctioneerId || base.teams.some((team: any, i: number) => team.captain_id !== initial.teams[i]?.captain_id)) {
        return Response.json({ error: "Auction setup changed. Rejoin the room." }, { status: 409 });
      }
    }
    if (!written) return Response.json({ error: "The room changed. Please try joining again." }, { status: 409 });
    if (roomReady) {
      const { error: liveError } = await supabase.from("auctions").update({ status: "LIVE" })
        .eq("id", initial.auction.id).eq("status", "DRAFT");
      if (liveError) throw liveError;
    }
    const state = parseAuctionState(written.notes);
    const playerById = new Map(initial.selectedPlayers.map((player: any) => [player.id, player]));
    const snapshot = { ...initial, state, match: { ...match, notes: written.notes },
      auction: { ...initial.auction, status: roomReady ? "LIVE" : initial.auction.status },
      currentPlayer: state.currentPlayerId ? playerById.get(state.currentPlayerId) ?? null : null,
      remainingPlayers: initial.selectedPlayers.filter((player: any) => player.id !== state.currentPlayerId && !state.completed[player.id]),
      readyRows: (rows ?? []).map((row: any) => ({ user_id: row.user_id, role: row.user_id === state.auctioneerId ? "AUCTIONEER" : "CAPTAIN" }))
    };
    return Response.json({ ok: true, status: state.status, waitingForRoom: !roomReady, snapshot });
  } catch (error) {
    return jsonError(error);
  }
}
