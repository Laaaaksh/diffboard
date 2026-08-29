import { useRef, useState } from "react";

type Mode = "slider" | "side-by-side" | "diff";

export function DiffViewer({
  beforeSrc,
  afterSrc,
  diffSrc,
}: {
  beforeSrc: string | null;
  afterSrc: string;
  diffSrc: string | null;
}) {
  const hasBefore = Boolean(beforeSrc);
  const [mode, setMode] = useState<Mode>(hasBefore ? "slider" : "side-by-side");
  const [percent, setPercent] = useState(50);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function updateFromClientX(clientX: number) {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(100, Math.max(0, pct)));
  }

  return (
    <div className="stack">
      <div className="diff-toggle">
        <button
          className={mode === "slider" ? "active" : ""}
          disabled={!hasBefore}
          onClick={() => setMode("slider")}
        >
          Slider
        </button>
        <button
          className={mode === "side-by-side" ? "active" : ""}
          onClick={() => setMode("side-by-side")}
        >
          Side by side
        </button>
        <button
          className={mode === "diff" ? "active" : ""}
          disabled={!diffSrc}
          onClick={() => setMode("diff")}
        >
          Diff overlay
        </button>
      </div>

      {mode === "slider" && hasBefore && (
        <div
          ref={frameRef}
          className="compare-frame slider-wrap"
          onMouseDown={(e) => {
            dragging.current = true;
            updateFromClientX(e.clientX);
          }}
          onMouseMove={(e) => {
            if (dragging.current) updateFromClientX(e.clientX);
          }}
          onMouseUp={() => (dragging.current = false)}
          onMouseLeave={() => (dragging.current = false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={afterSrc} alt="After" draggable={false} />
          <div className="after-img" style={{ width: `${percent}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={beforeSrc!} alt="Before" draggable={false} />
          </div>
          <div className="slider-handle" style={{ left: `${percent}%` }} />
        </div>
      )}

      {mode === "side-by-side" && (
        <div className="side-by-side">
          <figure className="compare-frame">
            <figcaption style={{ padding: "6px 10px" }}>
              {hasBefore ? "Baseline" : "No baseline yet"}
            </figcaption>
            {hasBefore ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={beforeSrc!} alt="Before" />
            ) : (
              <div className="muted" style={{ padding: 24 }}>
                This is the first capture for this screenshot - approving it creates the
                baseline.
              </div>
            )}
          </figure>
          <figure className="compare-frame">
            <figcaption style={{ padding: "6px 10px" }}>Current</figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={afterSrc} alt="After" />
          </figure>
        </div>
      )}

      {mode === "diff" && diffSrc && (
        <div className="compare-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={diffSrc} alt="Diff" />
        </div>
      )}
    </div>
  );
}
