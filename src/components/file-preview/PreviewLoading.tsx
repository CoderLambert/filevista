import "./styles/PreviewLoading.css";

interface PreviewLoadingProps {
  label?: string;
}

export function PreviewLoading({
  label = "Loading preview...",
}: PreviewLoadingProps) {
  return (
    <div className="fv-loading">
      <div className="fv-spinner fv-spinner--lg" />
      <p className="fv-loading__label">{label}</p>
    </div>
  );
}
