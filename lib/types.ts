export type Position =
  | "GK"
  | "LB"
  | "CB"
  | "RB"
  | "LWB"
  | "RWB"
  | "CDM"
  | "CM"
  | "CAM"
  | "LM"
  | "RM"
  | "LW"
  | "RW"
  | "CF"
  | "ST"
  | "DEF"
  | "MID"
  | "FWD";
export type GroupRole = "OWNER" | "ADMIN" | "PLAYER";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED";
export type AvailabilityStatus = "PLAYING" | "NOT_PLAYING" | "MAYBE";

export type AppUser = {
  id: string;
  clerk_user_id: string;
  username: string;
  display_name: string;
  phone: string | null;
  profile_image: string | null;
  preferred_position: Position;
  secondary_position: Position | null;
  created_at: string;
};

export type FootballGroup = {
  id: string;
  name: string;
  logo: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
};

export type UserStats = {
  matches: number;
  goals: number;
  assists: number;
  wins: number;
  motm: number;
  averageRating: number;
};
