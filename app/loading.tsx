export default function Loading() {
  return (
    <div className="page-wrap">
      <div className="skeleton-hero" />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    </div>
  );
}
