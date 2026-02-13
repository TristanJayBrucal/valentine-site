"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type ConfettiPiece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  shade: number;
  alpha: number;
};

type BgHeart = {
  id: number;
  char: string;
  left: number;
  duration: number;
  delay: number;
  dx: number;
  rot: number;
};

type HeartStyle = React.CSSProperties & {
  "--dx": string;
  "--rot": string;
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function Page() {
  const heartChars = useMemo(() => ["💗", "💖", "💘", "💝", "💕", "❤️"], []);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [status, setStatus] = useState('Choose wisely… (the "No" button is shy)');
  const [noMoves, setNoMoves] = useState(0);

  // ✅ Hydration-safe background hearts
  const [mounted, setMounted] = useState(false);
  const [bgHearts, setBgHearts] = useState<BgHeart[]>([]);

  // Responsive: detect screen size
  const [isMobile, setIsMobile] = useState(false);

  const playAreaRef = useRef<HTMLDivElement | null>(null);
  const noBtnRef = useRef<HTMLButtonElement | null>(null);
  const yesBtnRef = useRef<HTMLButtonElement | null>(null);
  const confettiRef = useRef<HTMLCanvasElement | null>(null);

  const confettiPiecesRef = useRef<ConfettiPiece[]>([]);
  const confettiRunningRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const noDodgeLevel = Math.min(6, 1 + Math.floor(noMoves / 2));

  // ✅ Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ✅ Generate bg hearts only AFTER mount so SSR/CSR won't mismatch
  useEffect(() => {
    setMounted(true);

    const hearts: BgHeart[] = Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      char: heartChars[Math.floor(Math.random() * heartChars.length)],
      left: rand(0, 100),
      duration: rand(6, 13),
      delay: rand(0, 6),
      dx: rand(-80, 80),
      rot: rand(-40, 40),
    }));

    setBgHearts(hearts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canvas resize
  useEffect(() => {
    const canvas = confettiRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Escape closes modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverlayOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function moveNoButtonAwayFrom(clientX: number, clientY: number) {
    const playArea = playAreaRef.current;
    const noBtn = noBtnRef.current;
    if (!playArea || !noBtn) return;

    const rect = playArea.getBoundingClientRect();
    const btnRect = noBtn.getBoundingClientRect();

    // Responsive padding based on screen size
    const padding = isMobile ? 10 : 14;
    const maxX = rect.width - btnRect.width - padding;
    const maxY = rect.height - btnRect.height - padding;

    const px = clientX - rect.left;
    const py = clientY - rect.top;

    let best: { cx: number; cy: number; score: number } | null = null;

    // More attempts on larger screens for smoother movement
    const attempts = isMobile ? 8 : 12;

    for (let i = 0; i < attempts; i++) {
      const cx = rand(padding, Math.max(padding, maxX));
      const cy = rand(padding, Math.max(padding, maxY));
      const dx = cx - px;
      const dy = cy - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const score = dist + rand(0, 40);
      if (!best || score > best.score) best = { cx, cy, score };
    }

    if (!best) return;

    // Place absolutely inside play area
    noBtn.style.left = `${best.cx}px`;
    noBtn.style.top = `${best.cy}px`;
    noBtn.style.right = "auto";
    noBtn.style.transform = "translate(0,0)";

    setNoMoves((n) => n + 1);

    const lines = [
      "Nope 😌",
      "Too slow 😝",
      "Try again 😳",
      "That was close 😅",
      "I'm slippery 😈",
      "Okay… just press YES already 💖",
    ];

    const nextMoves = noMoves + 1;
    const nextLevel = Math.min(6, 1 + Math.floor(nextMoves / 2));
    setStatus(lines[Math.min(lines.length - 1, nextLevel - 1)]);
  }

  function startConfetti(durationMs = 1700) {
    const canvas = confettiRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Adjust confetti count based on screen size for performance
    const confettiCount = isMobile ? 120 : 180;

    confettiPiecesRef.current = Array.from({ length: confettiCount }, () => ({
      x: rand(0, w),
      y: rand(-h, 0),
      vx: rand(-2.2, 2.2),
      vy: rand(2.5, 6.5),
      size: rand(4, 9),
      rot: rand(0, Math.PI * 2),
      vr: rand(-0.2, 0.2),
      shade: Math.floor(rand(40, 220)),
      alpha: rand(0.6, 1),
    }));

    confettiRunningRef.current = true;
    const start = performance.now();

    const frame = (now: number) => {
      if (!confettiRunningRef.current) return;
      const t = now - start;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const p of confettiPiecesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.02;

        if (p.y > h + 20) p.y = rand(-40, -10);
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = `rgba(${p.shade}, ${Math.min(255, p.shade + 40)}, ${Math.min(
          255,
          p.shade + 80
        )}, ${p.alpha})`;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        ctx.restore();
      }

      if (t < durationMs) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        confettiRunningRef.current = false;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(frame);
  }

  function popHearts(x: number, y: number, count = 18) {
    // Reduce heart count on mobile for performance
    const heartCount = isMobile ? 12 : count;

    for (let i = 0; i < heartCount; i++) {
      const el = document.createElement("div");
      el.className = "heart-pop";
      el.textContent = heartChars[Math.floor(Math.random() * heartChars.length)];
      el.style.setProperty("--x", `${x + rand(-18, 18)}px`);
      el.style.setProperty("--y", `${y + rand(-18, 18)}px`);
      el.style.setProperty("--vx", `${rand(-60, 60)}px`);
      el.style.fontSize = `${rand(16, 26)}px`;
      document.body.appendChild(el);
      window.setTimeout(() => el.remove(), 950);
    }
  }

  function celebrateFromYes() {
    const yesBtn = yesBtnRef.current;
    if (!yesBtn) return;
    const r = yesBtn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;

    popHearts(x, y, 18);
    startConfetti(1700);
  }

  function onYes() {
    celebrateFromYes();
    setStatus("Correct answer 😌💞");
    setOverlayOpen(true);
  }

  return (
    <main className="page">
      {/* ✅ Background hearts (client-only) */}
      <div className="bg-hearts" aria-hidden="true" suppressHydrationWarning>
        {mounted &&
          bgHearts.map((h) => (
            <span
              key={h.id}
              style={
                {
                  left: `${h.left}vw`,
                  animationDuration: `${h.duration}s`,
                  animationDelay: `${h.delay}s`,
                  "--dx": `${h.dx}px`,
                  "--rot": `${h.rot}deg`,
                } as HeartStyle
              }
            >
              {h.char}
            </span>
          ))}
      </div>

      <canvas id="confetti" ref={confettiRef} />

      <section className="card" role="main" aria-label="Valentine page">
        <div className="shine" />

        <div className="title">
          <h1>Will you be my Valentine? 💘</h1>
        </div>

        <p className="subtitle">
          A tiny question… with a very serious requirement: your answer must be extremely cute. 😌
        </p>

        <div className="character" aria-label="Cute character">
          <div
            className="blob"
            style={{
              boxShadow:
                noDodgeLevel >= 4
                  ? "0 20px 50px rgba(255, 59, 122, 0.35)"
                  : "0 18px 40px rgba(255, 59, 122, 0.25)",
            }}
          >
            <div className="eyes">
              <div className="eye" />
              <div className="eye" />
            </div>
            <div className="mouth">
              <div
                className="smile"
                style={{
                  borderColor: noDodgeLevel >= 4 ? "#ff3b7a" : "#2b2b2b",
                }}
              />
            </div>
            <div className="blush left" />
            <div className="blush right" />
          </div>
        </div>

        <div className="status" aria-live="polite">
          {status}
        </div>

        <div className="play-area" ref={playAreaRef} aria-label="Answer buttons area">
          <button ref={yesBtnRef} className="btn btn-yes" type="button" onClick={onYes}>
            Yes 💖
          </button>

          <button
            ref={noBtnRef}
            className="btn btn-no"
            type="button"
            onPointerDown={(e) => moveNoButtonAwayFrom(e.clientX, e.clientY)}
            onClick={() => {
              setStatus("Wait… that's illegal 😭 (try YES)");
              moveNoButtonAwayFrom(window.innerWidth / 2, window.innerHeight / 2);
            }}
            onFocus={() => {
              const rect = playAreaRef.current?.getBoundingClientRect();
              if (!rect) return;
              moveNoButtonAwayFrom(rect.left + rect.width / 2, rect.top + rect.height / 2);
            }}
          >
            No 🙈
          </button>

          <div
            className="mouse-catcher"
            onMouseMove={(e) => {
              const noBtn = noBtnRef.current;
              if (!noBtn) return;
              const btnRect = noBtn.getBoundingClientRect();
              const distX = Math.abs(e.clientX - (btnRect.left + btnRect.width / 2));
              const distY = Math.abs(e.clientY - (btnRect.top + btnRect.height / 2));
              // Responsive danger radius
              const baseDanger = isMobile ? 70 : 90;
              const dangerRadius = baseDanger - noDodgeLevel * 6;
              if (distX < dangerRadius && distY < dangerRadius) {
                moveNoButtonAwayFrom(e.clientX, e.clientY);
              }
            }}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (!t) return;
              const noBtn = noBtnRef.current;
              if (!noBtn) return;
              const btnRect = noBtn.getBoundingClientRect();
              const distX = Math.abs(t.clientX - (btnRect.left + btnRect.width / 2));
              const distY = Math.abs(t.clientY - (btnRect.top + btnRect.height / 2));
              const baseDanger = isMobile ? 70 : 90;
              const dangerRadius = baseDanger - noDodgeLevel * 6;
              if (distX < dangerRadius && distY < dangerRadius) {
                moveNoButtonAwayFrom(t.clientX, t.clientY);
              }
            }}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (!t) return;
              moveNoButtonAwayFrom(t.clientX, t.clientY);
            }}
          />
        </div>

        <div className="hint">Tip: try to click &quot;No&quot;… if you can. 😏</div>
      </section>

      <div
        className={`overlay ${overlayOpen ? "show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Valentine accepted"
        onClick={(e) => {
          if (e.target === e.currentTarget) setOverlayOpen(false);
        }}
      >
        <div className="modal">
          <h2>YAYYYY! 💞</h2>
          <p>You just made my whole day. Officially locked in: we&apos;re each other&apos;s Valentine. 🥰</p>
          <button className="btn close" type="button" onClick={() => setOverlayOpen(false)}>
            Awww okay 😳
          </button>
        </div>
      </div>
    </main>
  );
}
