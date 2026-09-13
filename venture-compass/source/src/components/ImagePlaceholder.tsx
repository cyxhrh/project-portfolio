export function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="image-placeholder" role="img" aria-label={label}>
      <span>[{label}]</span>
    </div>
  );
}
