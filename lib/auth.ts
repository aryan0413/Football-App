import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { AppUser, GroupRole } from "@/lib/types";
import { cache } from "react";
import { withPlayerPhotoUrls } from "@/lib/playerPhotos";

export async function requireClerkUserId() {
  const { userId } = await auth();
  if (!userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return userId;
}

export const getCurrentAppUser = cache(async () => {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) throw error;
  return withPlayerPhotoUrls(data) as AppUser | null;
});

export async function requireAppUser() {
  const clerkUserId = await requireClerkUserId();
  const { data: user, error } = await getSupabaseAdmin().from("users")
    .select("id, clerk_user_id, username, display_name, preferred_position, secondary_position, created_at")
    .eq("clerk_user_id", clerkUserId).maybeSingle();
  if (error) throw error;
  if (!user) {
    throw new Response("Profile required", { status: 409 });
  }
  return user;
}

export async function requireGroupRole(groupId: string, allowed: GroupRole[]) {
  const user = await requireAppUser();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data || !allowed.includes(data.role as GroupRole)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return { user, role: data.role as GroupRole };
}

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "Unexpected error";
  return Response.json({ error: message }, { status: 500 });
}
