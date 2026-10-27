"use client";

import { ArrowLeft, RefreshCw, WifiOff } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="page-wrap">
      <section className="grid min-h-80 content-center justify-items-start gap-5">
        <span className="quick-action-icon">
          <WifiOff size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">Unable to load this page</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            The app couldn&apos;t load the data for this page. Please try again shortly.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" type="button" disabled={pending} onClick={() => startTransition(retry)}>
            <RefreshCw size={15} />
            {pending ? "Retrying..." : "Try again"}
          </button>
          <Link className="btn-secondary" href="/">
            <ArrowLeft size={15} />
            Home
          </Link>
        </div>
      </section>
    </div>
  );
}
