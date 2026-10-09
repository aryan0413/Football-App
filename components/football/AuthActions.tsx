"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { LogIn, UserPlus } from "lucide-react";

export function AuthActions() {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="btn-secondary" type="button">
            <LogIn size={18} />
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="btn-primary" type="button">
            <UserPlus size={18} />
            Join
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
