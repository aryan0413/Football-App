export default function Loading() {
  return (
    <div className="page-wrap" aria-busy="true" aria-label="Loading page">
      <div className="skeleton-hero mb-6 !min-h-16 max-w-sm" />
      <div className="stat-grid" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="skeleton-card !min-h-20" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]" aria-hidden="true">
        <div className="skeleton-card !min-h-60" />
        <div className="skeleton-card !min-h-60" />
      </div>
    </div>
  );
}
