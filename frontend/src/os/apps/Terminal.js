import React, { useEffect, useRef, useState } from "react";

const HELP = "Available: help · clear · date · whoami · echo <text> · ls · neofetch · open <app> · reboot";

const NEOFETCH = [
  "         .__.       Astra OS v1.0",
  "        /    \\      ----------------",
  "       |  ◕◕  |     user:  guest@astra",
  "       |  ▽   |     shell: astra-sh",
  "        \\____/      theme: glass",
  "                    arch:  webkit-x86_64",
];

const APPS = ["Browser", "Settings", "Notes", "Terminal", "Files", "Calculator"];

export default function Terminal() {
  const [lines, setLines] = useState([
    { kind: "out", text: "Astra Terminal v1.0 — type 'help' for commands." },
  ]);
  const [input, setInput] = useState("");
  const [hist, setHist] = useState([]);
  const [hIdx, setHIdx] = useState(-1);
  const scroller = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [lines]);

  const run = (raw) => {
    const cmd = raw.trim();
    const next = [...lines, { kind: "cmd", text: raw }];
    if (!cmd) { setLines(next); return; }

    const [head, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");

    let out = "";
    switch (head.toLowerCase()) {
      case "help": out = HELP; break;
      case "clear": setLines([]); return;
      case "date": out = new Date().toString(); break;
      case "whoami": out = "guest@astra-os"; break;
      case "echo": out = arg; break;
      case "ls": out = "Documents  Downloads  Pictures  Music  Videos  readme.txt"; break;
      case "neofetch": out = NEOFETCH.join("\n"); break;
      case "open": {
        const match = APPS.find((a) => a.toLowerCase() === arg.toLowerCase());
        if (match && window.__astraLaunch) {
          window.__astraLaunch(match);
          out = `launching ${match}…`;
        } else {
          out = `usage: open <${APPS.join("|")}>`;
        }
        break;
      }
      case "reboot": window.location.reload(); return;
      default: out = `command not found: ${head}`;
    }
    setLines([...next, { kind: "out", text: out }]);
  };

  const onKey = (e) => {
    if (e.key === "Enter") {
      run(input);
      if (input.trim()) setHist((h) => [...h, input]);
      setInput("");
      setHIdx(-1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!hist.length) return;
      const ni = hIdx === -1 ? hist.length - 1 : Math.max(0, hIdx - 1);
      setHIdx(ni); setInput(hist[ni]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hIdx === -1) return;
      const ni = hIdx + 1;
      if (ni >= hist.length) { setHIdx(-1); setInput(""); }
      else { setHIdx(ni); setInput(hist[ni]); }
    }
  };

  return (
    <div
      className="nx-term"
      ref={scroller}
      onClick={() => inputRef.current && inputRef.current.focus()}
      data-testid="app-terminal"
    >
      {lines.map((l, i) =>
        l.kind === "cmd" ? (
          <div className="nx-term-line" key={i}>
            <span className="nx-term-prompt">guest@astra:~$</span> {l.text}
          </div>
        ) : (
          <div className="nx-term-line nx-term-out" key={i}>{l.text}</div>
        )
      )}
      <div className="nx-term-line nx-term-input-row">
        <span className="nx-term-prompt">guest@astra:~$</span>
        <input
          ref={inputRef}
          className="nx-term-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          autoFocus
          data-testid="terminal-input"
          spellCheck="false"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>
    </div>
  );
}
