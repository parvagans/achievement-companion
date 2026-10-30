import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

interface FittedTitleState {
  readonly fontSize: number;
  readonly width: number;
  readonly wrapped: boolean;
}

export function DeckyResponsiveGameTitle({
  title,
  preferredFontSize,
  minimumFontSize,
  style,
}: {
  readonly title: string;
  readonly preferredFontSize: number;
  readonly minimumFontSize: number;
  readonly style?: CSSProperties;
}): JSX.Element {
  const titleRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<FittedTitleState>();

  useLayoutEffect(() => {
    const element = titleRef.current;
    const ownerWindow = element?.ownerDocument.defaultView;
    if (element === null || ownerWindow === null || ownerWindow === undefined) return;

    const measure = (): void => {
      const width = element.clientWidth;
      if (width <= 0) return;
      const computed = ownerWindow.getComputedStyle(element);
      const probe = element.ownerDocument.createElement("span");
      probe.textContent = title;
      Object.assign(probe.style, {
        position: "fixed",
        visibility: "hidden",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        fontFamily: computed.fontFamily,
        fontWeight: computed.fontWeight,
        fontStyle: computed.fontStyle,
        letterSpacing: computed.letterSpacing,
        fontSize: `${preferredFontSize}px`,
      });
      element.ownerDocument.body.appendChild(probe);
      const naturalWidth = probe.getBoundingClientRect().width;
      probe.remove();

      const fittedFontSize = naturalWidth <= width
        ? preferredFontSize
        : Math.max(minimumFontSize, Math.floor((preferredFontSize * width / naturalWidth) * 10) / 10);
      const wrapped = naturalWidth * minimumFontSize / preferredFontSize > width + 1;
      const next = { fontSize: wrapped ? minimumFontSize : fittedFontSize, width, wrapped };
      setFit((current) => current?.fontSize === next.fontSize && current.width === next.width && current.wrapped === next.wrapped
        ? current
        : next);
    };

    measure();
    const observer = typeof ownerWindow.ResizeObserver === "function" ? new ownerWindow.ResizeObserver(measure) : undefined;
    observer?.observe(element);
    ownerWindow.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      ownerWindow.removeEventListener("resize", measure);
    };
  }, [minimumFontSize, preferredFontSize, title]);

  const wrapped = fit?.wrapped ?? true;
  return (
    <div
      aria-label={title}
      ref={titleRef}
      title={title}
      style={{
        ...style,
        minWidth: 0,
        fontSize: fit?.fontSize ?? preferredFontSize,
        overflow: "visible",
        ...(wrapped
          ? { display: "block", WebkitBoxOrient: "unset", WebkitLineClamp: "unset", whiteSpace: "normal", overflowWrap: "anywhere" }
          : { display: "block", WebkitBoxOrient: "unset", WebkitLineClamp: "unset", overflowWrap: "normal", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
      }}
    >
      {title}
    </div>
  );
}
