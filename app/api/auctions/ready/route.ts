import { jsonError, requireAppUser } from "@/lib/auth";
import { getAuctionSnapshot, nextAuctionPlayerId, parseAuctionState, writeAuctionStateCas } from "@/lib/auctionLive";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const matchId = String(body.matchId ?? "");
    const forceStart = Boolean(body.forceStart);

    if (!matchId) return Response.json({ error: "Match is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: match, error: matchError } = await supabase
      .from("matches")
      .select("id, group_id, notes")
      .eq("id", matchId)
      .maybeSingle();
    if (matchError) throw matchError;
    if (!match) return Response.json({ error: "Match not found." }, { status: 404 });

    const { data: auction, error: auctionError } = await supabase
      .from("auctions")
      .select("id, status")
      .eq("match_id", matchId)
      .maybeSingle();
    if (auctionError) throw auctionError;
    if (!auction) return Response.json({ error: "Auction not found." }, { status: 404 });
    if (auction.status === "ENDED") {
      return Response.json({ error: "Auction is already completed." }, { status: 400 });
    }

    const [{ data: membership, error: memberError }, { data: teams, error: teamError }] = await Promise.all([
      supabase.from("group_members").select("role").eq("group_id", match.group_id).eq("user_id", user.id).maybeSingle(),
      supabase.from("teams").select("id, name, captain_id").eq("match_id", matchId).order("name")
    ]);
    if (memberError) throw memberError;
    if (teamError) throw teamError;
    if (!membership) return Response.json({ error: "You are not in this group." }, { status: 403 });

    const captainTeam = (teams ?? []).find((team: any) => team.captain_id === user.id);
    const isOwnerOrAdmin = membership.role === "OWNER" || membership.role === "ADMIN";
    const persistedState = parseAuctionState(match.notes, auction.status === "LIVE" ? "LIVE" : "DRAFT");
    const auctioneerId = persistedState.auctioneerId;
    const isAuctioneer = auctioneerId === user.id;
    if (!isOwnerOrAdmin && !captainTeam && !isAuctioneer) {
      return Response.json({ error: "Only selected captains and the auctioneer can join this auction room." }, { status: 403 });
    }

    const captainIds = (teams ?? []).map((team: any) => team.captain_id).filter(Boolean) as string[];
    const uniqueCaptainIds = new Set(captainIds);
    const requiredReadyIds = Array.from(new Set([...captainIds, auctioneerId].filter(Boolean) as string[]));

    if (forceStart) {
      if (!isOwnerOrAdmin && !isAuctioneer) {
        return Response.json({ error: "Only the group admin or selected auctioneer can start the auction." }, { status: 403 });
      }
      if (uniqueCaptainIds.size < 2) {
        return Response.json({ error: "Choose two captains before starting the auction." }, { status: 400 });
      }
      if (!auctioneerId) {
        return Response.json({ error: "Choose one auctioneer before starting the auction." }, { status: 400 });
      }

      const { data: auctionPlayers, error: playerError } = await supabase
        .from("match_availability")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("status", "PLAYING")
        .limit(1);
      if (playerError) throw playerError;
      if (!auctionPlayers?.length) {
        return Response.json({ error: "Choose at least one auction player before starting." }, { status: 400 });
      }

      const { error: ownerReadyError } = await supabase
        .from("match_availability")
        .upsert({ match_id: matchId, user_id: user.id, status: "MAYBE" }, { onConflict: "match_id,user_id" });
      if (ownerReadyError) throw ownerReadyError;

      const { data: readyRows, error: readyReadError } = await supabase
        .from("match_availability")
        .select("user_id")
        .eq("match_id", matchId)
        .eq("status", "MAYBE");
      if (readyReadError) throw readyReadError;

      const readyIds = new Set((readyRows ?? []).map((row: any) => row.user_id));
      const roomReady = requiredReadyIds.length >= 3 && requiredReadyIds.every((id) => readyIds.has(id));
      if (!roomReady) {
        return Response.json({ ok: true, status: auction.status, waitingForRoom: true });
      }

      if (auction.status !== "LIVE") {
        const { error: liveError } = await supabase
          .from("auctions")
          .update({ status: "LIVE" })
          .eq("id", auction.id);
        if (liveError) throw liveError;
      }

      const snapshot = await getAuctionSnapshot(supabase, matchId);
      const nextState = {
        ...snapshot.state,
        status: "LIVE" as const,
        currentPlayerId: snapshot.state.currentPlayerId ?? nextAuctionPlayerId(snapshot.state, snapshot.selectedPlayers.map((player: any) => player.id))
      };
      await writeAuctionStateCas(supabase, matchId, snapshot.match.notes ?? null, nextState);

      return Response.json({ ok: true, status: "LIVE", snapshot: await getAuctionSnapshot(supabase, matchId) });
    }

    const { error: readyError } = await supabase
      .from("match_availability")
      .upsert({ match_id: matchId, user_id: user.id, status: "MAYBE" }, { onConflict: "match_id,user_id" });
    if (readyError) throw readyError;

    const { data: readyRows, error: readyReadError } = await supabase
      .from("match_availability")
      .select("user_id")
      .eq("match_id", matchId)
      .eq("status", "MAYBE");
    if (readyReadError) throw readyReadError;

    const readyIds = new Set((readyRows ?? []).map((row: any) => row.user_id));
    const roomReady = requiredReadyIds.length >= 3 && requiredReadyIds.every((id) => readyIds.has(id));

    if (new Set(captainIds).size >= 2 && auctioneerId && roomReady && auction.status !== "LIVE") {
      const { error: liveError } = await supabase
        .from("auctions")
        .update({ status: "LIVE" })
        .eq("id", auction.id);
      if (liveError) throw liveError;

      const snapshot = await getAuctionSnapshot(supabase, matchId);
      const nextState = {
        ...snapshot.state,
        status: "LIVE" as const,
        currentPlayerId: snapshot.state.currentPlayerId ?? nextAuctionPlayerId(snapshot.state, snapshot.selectedPlayers.map((player: any) => player.id))
      };
      await writeAuctionStateCas(supabase, matchId, snapshot.match.notes ?? null, nextState);
      return Response.json({ ok: true, status: "LIVE", snapshot: await getAuctionSnapshot(supabase, matchId) });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
