import React, { useCallback, useEffect, useRef, useState } from "react";

const COLS = 20;
const ROWS = 16;
const TICK = 110;

function rndCell(snake) {
  while (true) {
    const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!snake.some((s) => s.x === c.x && s.y === c.y)) return c;
  }
}

const initial = () => {
  const s = [{ x: 5, y: 8 }, { x: 4, y: 8 }, { x: 3, y: 8 }];
  return { snake: s, dir: { x: 1, y: 0 }, food: rndCell(s), alive: true, score: 0 };
};

export default function Snake() {
  const [state, setState] = useState(initial);
  const [running, setRunning] = useState(false);
  const [hi, setHi] = useState(() => Number(localStorage.getItem("astra-snake-hi") || 0));
  const dirRef = useRef(state.dir);
  const wrapRef = useRef(null);

  const start = useCallback(() => {
    setState(initial());
    dirRef.current = { x: 1, y: 0 };
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setState((s) => {
        if (!s.alive) return s;
        const nd = dirRef.current;
        const head = { x: s.snake[0].x + nd.x, y: s.snake[0].y + nd.y };
        if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) return { ...s, alive: false };
        if (s.snake.some((c) => c.x === head.x && c.y === head.y)) return { ...s, alive: false };
        const eaten = head.x === s.food.x && head.y === s.food.y;
        const newSnake = [head, ...s.snake];
        if (!eaten) newSnake.pop();
        const score = eaten ? s.score + 1 : s.score;
        return {
          ...s,
          snake: newSnake,
          dir: nd,
          food: eaten ? rndCell(newSnake) : s.food,
          score,
        };
      });
    }, TICK);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!state.alive && running) {
      setRunning(false);
      if (state.score > hi) {
        setHi(state.score);
        localStorage.setItem("astra-snake-hi", String(state.score));
      }
    }
  }, [state.alive, state.score, running, hi]);

  useEffect(() => {
    const onKey = (e) => {
      const map = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
      };
      const nd = map[e.key] || map[e.key?.toLowerCase()];
      if (!nd) return;
      e.preventDefault();
      const cur = dirRef.current;
      if (cur.x === -nd.x && cur.y === -nd.y) return; // ignore reverse
      dirRef.current = nd;
    };
    const node = wrapRef.current;
    if (node) node.addEventListener("keydown", onKey);
    return () => { if (node) node.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => { wrapRef.current && wrapRef.current.focus(); }, []);

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      className="ax-snake"
      data-testid="app-snake"
      style={{ outline: "none" }}
    >
      <div className="ax-snake-bar">
        <div className="ax-snake-score">SCORE <b data-testid="snake-score">{state.score}</b></div>
        <div className="ax-snake-score">HI <b data-testid="snake-hi">{hi}</b></div>
        <div style={{ flex: 1 }} />
        <button className="nx-btn" onClick={start} data-testid="snake-start">
          {running ? "Restart" : state.alive ? "Start" : "Play again"}
        </button>
      </div>
      <div
        className="ax-snake-board"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
      >
        {Array.from({ length: COLS * ROWS }).map((_, i) => {
          const x = i % COLS, y = Math.floor(i / COLS);
          const isHead = state.snake[0].x === x && state.snake[0].y === y;
          const isBody = !isHead && state.snake.some((c) => c.x === x && c.y === y);
          const isFood = state.food.x === x && state.food.y === y;
          let cls = "ax-snake-cell";
          if (isHead) cls += " head";
          else if (isBody) cls += " body";
          else if (isFood) cls += " food";
          return <div key={i} className={cls} />;
        })}
      </div>
      {!running && !state.alive && state.score > 0 && (
        <div className="ax-snake-end" data-testid="snake-gameover">Game over · score {state.score}</div>
      )}
      <div className="ax-snake-hint">arrows / WASD · click here first</div>
    </div>
  );
}
