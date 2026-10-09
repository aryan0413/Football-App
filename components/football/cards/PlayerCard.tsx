import { fallbackPhoto, optimizedPhotoUrl } from "@/lib/images";

type PlayerCardProps = {
  player: {
    id: string;
    display_name: string;
    username: string;
    preferred_position: string;
    profile_image: string | null;
  };
  role?: string;
};

export function PlayerCard({ player, role }: PlayerCardProps) {
  return (
    <div className="data-row flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <img src={optimizedPhotoUrl(player.profile_image, 88) ?? fallbackPhoto()} alt="" loading="lazy" decoding="async" className="h-11 w-11 rounded-lg object-cover" />
        <div className="min-w-0">
          <div className="truncate font-black">{player.display_name}</div>
          <div className="truncate text-sm text-[var(--muted)]">@{player.username} - {player.preferred_position}</div>
        </div>
      </div>
      {role ? <span className="rounded-lg bg-[#e8f5ef] px-2 py-1 text-xs font-black text-[var(--accent-dark)]">{role}</span> : null}
    </div>
  );
}
