import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type Direction = "vertical" | "horizontal";

interface CustomScrollbarProps {
  direction: Direction;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  label: string;
}

interface Metrics {
  clientSize: number;
  scrollSize: number;
  scrollPosition: number;
  thumbSize: number;
  thumbOffset: number;
}

interface DragState {
  active: boolean;
  startPointer: number;
  startScroll: number;
}

const MIN_THUMB_SIZE = 24;

export default function CustomScrollbar({
  direction,
  children,
  className = "",
  contentClassName = "",
  label,
}: CustomScrollbarProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({
    active: false,
    startPointer: 0,
    startScroll: 0,
  });
  const viewportId = useId();
  const [dragging, setDragging] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({
    clientSize: 0,
    scrollSize: 0,
    scrollPosition: 0,
    thumbSize: 0,
    thumbOffset: 0,
  });

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const clientSize =
      direction === "vertical" ? viewport.clientHeight : viewport.clientWidth;
    const scrollSize =
      direction === "vertical" ? viewport.scrollHeight : viewport.scrollWidth;
    const scrollPosition =
      direction === "vertical" ? viewport.scrollTop : viewport.scrollLeft;
    const trackSize =
      direction === "vertical"
        ? track.clientHeight
        : track.clientWidth;

    const thumbSize =
      scrollSize > clientSize && clientSize > 0
        ? Math.min(
            trackSize,
            Math.max(MIN_THUMB_SIZE, (clientSize / scrollSize) * trackSize),
          )
        : trackSize;
    const scrollRange = Math.max(0, scrollSize - clientSize);
    const thumbRange = Math.max(0, trackSize - thumbSize);
    const thumbOffset =
      scrollRange > 0 ? (scrollPosition / scrollRange) * thumbRange : 0;

    setMetrics((current) => {
      if (
        current.clientSize === clientSize &&
        current.scrollSize === scrollSize &&
        current.scrollPosition === scrollPosition &&
        current.thumbSize === thumbSize &&
        current.thumbOffset === thumbOffset
      ) {
        return current;
      }

      return {
        clientSize,
        scrollSize,
        scrollPosition,
        thumbSize,
        thumbOffset,
      };
    });
  }, [direction]);

  useEffect(() => {
    updateMetrics();
    const observer = new ResizeObserver(updateMetrics);
    if (viewportRef.current) observer.observe(viewportRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [children, updateMetrics]);

  const pointerPosition = (event: ReactPointerEvent<HTMLDivElement>) =>
    direction === "vertical" ? event.clientY : event.clientX;

  const scrollPosition = (element: HTMLDivElement) =>
    direction === "vertical" ? element.scrollTop : element.scrollLeft;

  const setScrollPosition = (element: HTMLDivElement, value: number) => {
    if (direction === "vertical") element.scrollTop = value;
    else element.scrollLeft = value;
  };

  const handleThumbPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const viewport = viewportRef.current;
    if (!viewport) return;

    dragRef.current = {
      active: true,
      startPointer: pointerPosition(event),
      startScroll: scrollPosition(viewport),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handleThumbPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!dragRef.current.active) return;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const trackSize =
      direction === "vertical" ? track.clientHeight : track.clientWidth;
    const scrollRange = metrics.scrollSize - metrics.clientSize;
    const thumbRange = trackSize - metrics.thumbSize;
    if (thumbRange <= 0 || scrollRange <= 0) return;

    const delta = pointerPosition(event) - dragRef.current.startPointer;
    setScrollPosition(
      viewport,
      dragRef.current.startScroll + (delta / thumbRange) * scrollRange,
    );
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const positive = direction === "vertical" ? "ArrowDown" : "ArrowRight";
    const negative = direction === "vertical" ? "ArrowUp" : "ArrowLeft";
    const current = scrollPosition(viewport);
    let next: number | null = null;

    if (event.key === positive) next = current + 40;
    else if (event.key === negative) next = current - 40;
    else if (event.key === "PageDown") next = current + metrics.clientSize;
    else if (event.key === "PageUp") next = current - metrics.clientSize;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = metrics.scrollSize;

    if (next === null) return;
    event.preventDefault();
    setScrollPosition(viewport, next);
  };

  const hasOverflow = metrics.scrollSize > metrics.clientSize + 1;
  const thumbStyle =
    direction === "vertical"
      ? {
          height: `${metrics.thumbSize}px`,
          transform: `translateY(${metrics.thumbOffset}px)`,
        }
      : {
          width: `${metrics.thumbSize}px`,
          transform: `translateX(${metrics.thumbOffset}px)`,
        };

  return (
    <div className={`custom-scroll-wrapper ${direction} ${className}`}>
      <div
        ref={viewportRef}
        id={viewportId}
        className={`custom-scroll-viewport ${direction}`}
        onScroll={updateMetrics}
      >
        <div
          ref={contentRef}
          className={`custom-scroll-content ${direction} ${contentClassName}`}
        >
          {children}
        </div>
      </div>
      <div
        ref={trackRef}
        className={`custom-scroll-track ${direction}${hasOverflow ? "" : " inactive"}`}
        aria-hidden={!hasOverflow}
      >
        <div
          className={`custom-scroll-thumb ${direction}${dragging ? " dragging" : ""}`}
          style={thumbStyle}
          role="scrollbar"
          aria-label={label}
          aria-controls={viewportId}
          aria-orientation={direction}
          aria-valuemin={0}
          aria-valuemax={Math.max(0, metrics.scrollSize - metrics.clientSize)}
          aria-valuenow={metrics.scrollPosition}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPointerDown={handleThumbPointerDown}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        />
      </div>
    </div>
  );
}
