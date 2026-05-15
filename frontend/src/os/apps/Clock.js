import React, { useEffect, useRef, useState } from "react";

function fmt(ms) {
  const total = Math.max(0, Math.floor(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const cs = Math.floor((total % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function ClockFace() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="ax-clock-face" data-testid="clock-face">
      <div className="ax-clock-time">
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      </div>
      <div className="ax-clock-date">
        {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </div>
    </div>
  );
}

function Stopwatch() {
  const [running, setRunning] = useState(false);
  const [ms, setMs] = useState(0);
  const [laps, setLaps] = useState([]);
  const startRef = useRef(0);
  const baseRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      setMs(baseRef.current + (performance.now() - startRef.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const toggle = () => {
    if (running) {
      baseRef.current += performance.now() - startRef.current;
      setRunning(false);
    } else setRunning(true);
  };
  const reset = () => { setRunning(false); baseRef.current = 0; setMs(0); setLaps([]); };
  const lap = () => setLaps((l) => [{ t: ms, n: l.length + 1 }, ...l]);

  return (
    <div className="ax-stop">
      <div className="ax-stop-display" data-testid="stopwatch-display">{fmt(ms)}</div>
      <div className="ax-stop-btns">
        <button className="nx-btn" onClick={toggle} data-testid="stopwatch-toggle">{running ? "Pause" : "Start"}</button>
        <button className="nx-btn" onClick={lap} disabled={!running} data-testid="stopwatch-lap">Lap</button>
        <button className="nx-btn" onClick={reset} data-testid="stopwatch-reset">Reset</button>
      </div>
      {laps.length > 0 && (
        <div className="ax-stop-laps">
          {laps.map((l) => (
            <div className="ax-stop-lap" key={l.n}><span>Lap {l.n}</span><span>{fmt(l.t)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "clock", label: "Clock" },
  { id: "stopwatch", label: "Stopwatch" },
];

export default function ClockApp() {
  const [tab, setTab] = useState("clock");
  return (
    <div className="ax-clockapp" data-testid="app-clock">
      <div className="nx-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nx-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
            data-testid={`clock-tab-${t.id}`}
          >{t.label}</button>
        ))}
      </div>
      <div className="nx-tab-body">
        {tab === "clock" && <ClockFace />}
        {tab === "stopwatch" && <Stopwatch />}
      </div>
    </div>
  );
}
