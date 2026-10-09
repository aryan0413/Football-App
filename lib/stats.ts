import { getSupabaseAdmin } from "@/lib/supabase";
import type { UserStats } from "@/lib/types";

export async function getUserStats(userId: string, groupId?: string): Promise<UserStats> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("player_stat_summary").select("*").eq("user_id", userId);

  if (groupId) query = query.eq("group_id", groupId);

  const { data, error } = await query;
  if (error) throw error;

  const totals = (data ?? []).reduce(
    (stats: { matches: number; goals: number; assists: number; wins: number; motm: number; ratingWeight: number }, row: any) => {
      const matches = Number(row.matches ?? 0);
      const rating = Number(row.average_rating ?? 0);
      return {
        matches: stats.matches + matches,
        goals: stats.goals + Number(row.goals ?? 0),
        assists: stats.assists + Number(row.assists ?? 0),
        wins: stats.wins + Number(row.wins ?? 0),
        motm: stats.motm + Number(row.motm ?? 0),
        ratingWeight: stats.ratingWeight + (Number.isFinite(rating) ? rating * matches : 0)
      };
    },
    { matches: 0, goals: 0, assists: 0, wins: 0, motm: 0, ratingWeight: 0 }
  );

  return {
    matches: totals.matches,
    goals: totals.goals,
    assists: totals.assists,
    wins: totals.wins,
    motm: totals.motm,
    averageRating: totals.matches ? totals.ratingWeight / totals.matches : 0
  };
}
