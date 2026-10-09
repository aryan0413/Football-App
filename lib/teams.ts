type TeamRow = {
  id: string;
  name: string;
  captain_id?: string | null;
  team_players?: Array<unknown> | null;
};

export function uniqueNamedTeams<T extends TeamRow>(teams: T[]) {
  const byName = new Map<string, T>();
  for (const team of teams) {
    const key = String(team.name ?? "").trim().toLowerCase();
    if ((key === "team a" || key === "team b") && !byName.has(key)) {
      byName.set(key, team);
    }
  }
  return ["team a", "team b"].map((key) => byName.get(key)).filter(Boolean) as T[];
}

export function duplicateEmptyTeamIds<T extends TeamRow>(teams: T[]) {
  return ["Team A", "Team B"].flatMap((name) => {
    const sameName = teams.filter((team) => team.name === name);
    if (sameName.length <= 1) return [];
    const sorted = [...sameName].sort((a, b) => {
      const aPlayers = (a.team_players ?? []).length;
      const bPlayers = (b.team_players ?? []).length;
      if (aPlayers !== bPlayers) return bPlayers - aPlayers;
      if (a.captain_id && !b.captain_id) return -1;
      if (!a.captain_id && b.captain_id) return 1;
      return String(a.id).localeCompare(String(b.id));
    });
    return sorted.slice(1).filter((team) => !(team.team_players ?? []).length && !team.captain_id).map((team) => team.id);
  });
}
