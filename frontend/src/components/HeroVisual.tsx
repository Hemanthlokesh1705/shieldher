import { useEffect, useState, useRef } from "react";

export function HeroVisual() {
  const [barHeights, setBarHeights] = useState([28, 40, 18, 44, 32, 22, 38, 14, 46, 30]);
  const [caseCount, setCaseCount] = useState(2418);
  const [scanPct, setScanPct] = useState(0);
  const rafRef = useRef<number>(0);
  const scanRef = useRef(0);

  // Animate equalizer bars
  useEffect(() => {
    const interval = setInterval(() => {
      setBarHeights(prev =>
        prev.map(() => Math.floor(Math.random() * 40 + 8))
      );
    }, 900);
    return () => clearInterval(interval);
  }, []);

  // Animate scan percentage
  useEffect(() => {
    const step = () => {
      scanRef.current = (scanRef.current + 0.4) % 100;
      setScanPct(Math.round(scanRef.current));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Tick case count
  useEffect(() => {
    const interval = setInterval(() => {
      setCaseCount(prev => prev + 1);
    }, 4200);
    return () => clearInterval(interval);
  }, []);

  // Particles config
  const particles = [
    { size: 8, top: "12%", left: "18%", color: "rgba(34,197,94,0.5)", dur: 5.5, delay: 0 },
    { size: 5, top: "78%", left: "24%", color: "rgba(74,222,128,0.45)", dur: 7, delay: -2 },
    { size: 6, top: "28%", left: "84%", color: "rgba(22,163,74,0.5)", dur: 6, delay: -1 },
    { size: 4, top: "65%", left: "78%", color: "rgba(34,197,94,0.4)", dur: 8, delay: -3 },
    { size: 7, top: "48%", left: "6%",  color: "rgba(74,222,128,0.4)", dur: 6.5, delay: -0.5 },
    { size: 4, top: "88%", left: "58%", color: "rgba(22,163,74,0.35)", dur: 9, delay: -4 },
    { size: 5, top: "8%",  left: "62%", color: "rgba(34,197,94,0.45)", dur: 7.5, delay: -1.5 },
  ];

  return (
    <div className="hero-visual">
      {/* Grid mesh overlay */}

      {/* Ambient glow blobs */}
      <div
        className="ambient-blob"
        style={{
          width: "280px", height: "280px",
          top: "10%", left: "15%",
          background: "radial-gradient(circle, rgba(22,163,74,0.18) 0%, transparent 70%)",
          ["--blob-dur" as string]: "12s",
          ["--blob-delay" as string]: "0s",
        }}
      />
      <div
        className="ambient-blob"
        style={{
          width: "220px", height: "220px",
          bottom: "10%", right: "10%",
          background: "radial-gradient(circle, rgba(74,222,128,0.14) 0%, transparent 70%)",
          ["--blob-dur" as string]: "9s",
          ["--blob-delay" as string]: "-3s",
        }}
      />

      {/* Floating particles */}
      <div className="particle-field">
        {particles.map((p, i) => (
          <div
            key={i}
            className="particle"
            style={{
              width: p.size,
              height: p.size,
              top: p.top,
              left: p.left,
              background: p.color,
              ["--p-dur" as string]: `${p.dur}s`,
              ["--p-delay" as string]: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Orbit rings */}
      <div className="orbit-ring orbit-ring-1" />
      <div className="orbit-ring orbit-ring-2" />
      <div className="orbit-ring orbit-ring-3" />

      {/* Orbiting satellite dots on ring-2 */}
      <div
        style={{
          position: "absolute",
          width: "75%",
          height: "75%",
          animation: "orbitRotate 20s linear infinite reverse",
          borderRadius: "50%",
        }}
      >
        <div
          className="orbit-satellite"
          style={{ top: "-5px", left: "50%", transform: "translateX(-50%)" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          width: "75%",
          height: "75%",
          animation: "orbitRotate 20s linear infinite reverse",
          animationDelay: "-10s",
          borderRadius: "50%",
        }}
      >
        <div
          className="orbit-satellite"
          style={{
            bottom: "-5px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #22c55e, #86efac)",
          }}
        />
      </div>

      {/* Satellite on ring-3 */}
      <div
        style={{
          position: "absolute",
          width: "56%",
          height: "56%",
          animation: "orbitRotate 14s linear infinite",
          borderRadius: "50%",
        }}
      >
        <div
          className="orbit-satellite"
          style={{
            top: "-5px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "8px",
            height: "8px",
            background: "linear-gradient(135deg, #4ade80, #22c55e)",
          }}
        />
      </div>

      {/* Central Shield Orb */}
      <div className="shield-orb" style={{ position: "relative" }}>
        <div className="shield-scan-ring" />
        <div className="shield-scan-beam" />
        <span className="shield-orb-icon">🛡️</span>
      </div>

      {/* ── HUD CARD 1: Live Scan progress (top-right) ── */}
      <div className="hud-card top-right">
        <div className="hud-label">
          <div className="hud-dot green" />
          Live Forensic Scan
        </div>
        <div className="hud-value green">{scanPct}%</div>
        <div className="hud-sub">Multi-layer analysis active</div>
        <div className="progress-bar" style={{ marginTop: "0.6rem", height: "5px" }}>
          <div
            className="progress-fill"
            style={{ width: `${scanPct}%`, transition: "width 0.05s linear" }}
          />
        </div>
        {/* Mini frequency bars */}
        <div className="hud-bars" style={{ marginTop: "0.6rem" }}>
          {barHeights.map((h, i) => (
            <div
              key={i}
              className="hud-bar"
              style={{
                height: `${h}px`,
                transition: "height 0.5s ease",
                opacity: 0.7 + i * 0.03,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── HUD CARD 2: Cases processed (bottom-left) ── */}
      <div className="hud-card bottom-left">
        <div className="hud-label">
          <div className="hud-dot green" />
          Cases Processed
        </div>
        <div className="hud-value">{caseCount.toLocaleString()}</div>
        <div className="hud-sub">100% local processing</div>
        <div className="hud-activity">
          <div className="hud-activity-row">
            <div className="hud-dot green" style={{ width: 6, height: 6 }} />
            <span>EFFORT Model — Ready</span>
          </div>
          <div className="hud-activity-row">
            <div className="hud-dot green" style={{ width: 6, height: 6 }} />
            <span>Smaug Detector — Ready</span>
          </div>
          <div className="hud-activity-row">
            <div className="hud-dot amber" style={{ width: 6, height: 6 }} />
            <span>Forensic Suite — Standby</span>
          </div>
        </div>
      </div>

      {/* ── HUD CARD 3: Detection scores (mid-right) ── */}
      <div className="hud-card mid-right">
        <div className="hud-label">
          <div className="hud-dot blue" />
          Detector Readiness
        </div>
        {[
          { name: "Face-Swap",  pct: 94, color: "#16a34a" },
          { name: "AI-Gen",     pct: 87, color: "#16a34a" },
          { name: "Forensics",  pct: 100, color: "#22c55e" },
        ].map(item => (
          <div key={item.name} style={{ marginTop: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
              <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>{item.name}</span>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: item.color }}>{item.pct}%</span>
            </div>
            <div className="progress-bar" style={{ height: "4px" }}>
              <div
                className="progress-fill"
                style={{ width: `${item.pct}%`, background: `linear-gradient(90deg, ${item.color}, #4ade80)` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── HUD CARD 4: Chain of custody (top-left) ── */}
      <div className="hud-card top-left">
        <div className="hud-label">
          <div className="hud-dot green" />
          Chain of Custody
        </div>
        <div className="hud-value green" style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)" }}>
          ISO/IEC 27037
        </div>
        <div className="hud-sub">Evidence vault active</div>
        <div style={{ marginTop: "0.45rem", display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {["SHA-256", "AES-256", "RBAC"].map(tag => (
            <span
              key={tag}
              style={{
                fontSize: "0.62rem",
                fontWeight: 700,
                padding: "0.1rem 0.4rem",
                borderRadius: "4px",
                background: "#f0fdf4",
                color: "#16a34a",
                border: "1px solid #86efac",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
