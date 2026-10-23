import { ArrowLeft, Flag } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-wrap">
      <section className="grid min-h-80 content-center justify-items-start gap-5">
        <span className="quick-action-icon">
          <Flag size={22} />
        </span>
        <div>
          <p className="eyebrow">404</p>
          <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        </div>
        <Link className="btn-primary" href="/">
          <ArrowLeft size={15} />
          Back to matchday
        </Link>
      </section>
    </div>
  );
}
