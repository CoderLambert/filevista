import "./styles/AudioPreview.css";

interface AudioPreviewProps {
  url: string;
  fileName: string;
}

export function AudioPreview({ url, fileName }: AudioPreviewProps) {
  return (
    <div className="fv-audio">
      <div className="fv-audio__icon-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
      <div className="fv-audio__info">
        <p className="fv-audio__name">{fileName}</p>
        <p className="fv-audio__label">Audio file</p>
      </div>
      <audio
        src={url}
        controls
        className="fv-audio__player"
        aria-label={fileName}
      >
        Your browser does not support the audio tag.
      </audio>
    </div>
  );
}
