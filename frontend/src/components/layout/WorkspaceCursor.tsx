import { useEffect, useRef, useState } from "react";
import "./WorkspaceCursor.css";

const interactiveSelector =
  "a, button, [role='button'], input[type='button'], input[type='submit'], select, summary";

export default function WorkspaceCursor() {
  const [enabled, setEnabled] = useState(false);
  const pointerRef = useRef<HTMLSpanElement>(null);
  const haloRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const updateAvailability = () => {
      setEnabled(pointerQuery.matches && motionQuery.matches);
    };

    updateAvailability();
    pointerQuery.addEventListener("change", updateAvailability);
    motionQuery.addEventListener("change", updateAvailability);

    return () => {
      pointerQuery.removeEventListener("change", updateAvailability);
      motionQuery.removeEventListener("change", updateAvailability);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const cursor = cursorRef.current;
    const pointer = pointerRef.current;
    const halo = haloRef.current;
    if (!cursor || !pointer || !halo) return;

    document.documentElement.classList.add("workspace-cursor-enabled");

    const moveCursor = (event: PointerEvent) => {
      const position = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      pointer.style.transform = position;
      halo.style.transform = `translate3d(${event.clientX - 18}px, ${event.clientY - 18}px, 0)`;
      cursor.classList.add("is-visible");
    };

    const handlePointerLeave = () => cursor.classList.remove("is-visible");
    const handlePointerEnter = () => cursor.classList.add("is-visible");
    const handlePointerDown = () => cursor.classList.add("is-pressed");
    const handlePointerUp = () => cursor.classList.remove("is-pressed");
    const updateHoverState = (event: PointerEvent) => {
      const target = event.target;
      cursor.classList.toggle(
        "is-hovering",
        target instanceof Element && Boolean(target.closest(interactiveSelector)),
      );
    };

    window.addEventListener("pointermove", moveCursor, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("pointerenter", handlePointerEnter);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointerover", updateHoverState, { passive: true });

    return () => {
      document.documentElement.classList.remove("workspace-cursor-enabled");
      window.removeEventListener("pointermove", moveCursor);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerenter", handlePointerEnter);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointerover", updateHoverState);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div ref={cursorRef} className="workspace-cursor" aria-hidden="true">
      <span ref={haloRef} className="workspace-cursor-halo" />
      <span ref={pointerRef} className="workspace-cursor-pointer">
        <svg viewBox="0 0 24 30" fill="none">
          <defs>
            <linearGradient id="cursor-glass-fill" x1="3" y1="2" x2="20" y2="27">
              <stop stopColor="#f5fdff" stopOpacity=".92" />
              <stop offset=".42" stopColor="#50eaff" stopOpacity=".72" />
              <stop offset="1" stopColor="#8778ff" stopOpacity=".88" />
            </linearGradient>
            <linearGradient id="cursor-glass-edge" x1="2" y1="2" x2="19" y2="27">
              <stop stopColor="#fff" />
              <stop offset=".48" stopColor="#50f5ff" />
              <stop offset="1" stopColor="#c58bff" />
            </linearGradient>
            <linearGradient id="cursor-shield-fill" x1="6" y1="6" x2="10" y2="14">
              <stop stopColor="#fff" stopOpacity=".98" />
              <stop offset="1" stopColor="#d5faff" stopOpacity=".76" />
            </linearGradient>
          </defs>
          <path
            d="M2.25 1.75v22.1l5.15-5.22 4.25 8.92 3.08-1.47-4.25-8.92h7.32L2.25 1.75Z"
            fill="url(#cursor-glass-fill)"
            stroke="url(#cursor-glass-edge)"
            strokeLinejoin="round"
            strokeWidth="1.35"
          />
          <path
            d="M5.2 7.1v3.05c0 1.66 1.02 2.85 2.57 3.5 1.55-.65 2.57-1.84 2.57-3.5V7.1L7.77 6 5.2 7.1Z"
            fill="url(#cursor-shield-fill)"
          />
          <path
            d="M7.77 8v3.15"
            stroke="#30b9db"
            strokeLinecap="round"
            strokeWidth=".8"
          />
        </svg>
      </span>
    </div>
  );
}
