import React, { useState } from "react";

const BTNS = [
  { v: "C", c: "" }, { v: "±", c: "" }, { v: "%", c: "" }, { v: "÷", c: "op" },
  { v: "7", c: "" }, { v: "8", c: "" }, { v: "9", c: "" }, { v: "×", c: "op" },
  { v: "4", c: "" }, { v: "5", c: "" }, { v: "6", c: "" }, { v: "−", c: "op" },
  { v: "1", c: "" }, { v: "2", c: "" }, { v: "3", c: "" }, { v: "+", c: "op" },
  { v: "0", c: "zero" }, { v: ".", c: "" }, { v: "=", c: "eq" },
];

function safeEval(expr) {
  const cleaned = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  if (!/^[0-9+\-*/.() %]+$/.test(cleaned)) return "Error";
  try {
    // eslint-disable-next-line no-new-func
    const r = Function(`"use strict"; return (${cleaned.replace(/%/g, "/100")});`)();
    if (!isFinite(r)) return "Error";
    return String(+r.toFixed(10)).replace(/\.?0+$/, "");
  } catch { return "Error"; }
}

export default function Calculator() {
  const [disp, setDisp] = useState("0");

  const press = (v) => {
    if (v === "C") return setDisp("0");
    if (v === "=") return setDisp(safeEval(disp));
    if (v === "±") return setDisp((d) => (d.startsWith("-") ? d.slice(1) : "-" + d));
    setDisp((d) => (d === "0" && v !== "." ? v : d + v));
  };

  return (
    <div className="nx-calc" data-testid="app-calculator">
      <div className="nx-calc-display" data-testid="calc-display">{disp}</div>
      <div className="nx-calc-grid">
        {BTNS.map((b) => (
          <button
            key={b.v}
            className={`nx-calc-btn ${b.c}`}
            onClick={() => press(b.v)}
            data-testid={`calc-${b.v}`}
          >{b.v}</button>
        ))}
      </div>
    </div>
  );
}
