import React, { useEffect, useState } from "react";

export default function BootLoader() {
  const [fade, setFade] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFade(true), 1300);
    const t2 = setTimeout(() => setGone(true), 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (gone) return null;
  return (
    <div className={`nx-boot ${fade ? "fade" : ""}`} data-testid="boot-loader">
      <div className="nx-ring" />
      <div className="nx-boot-text">ASTRA OS</div>
      <div className="nx-boot-progress"><div className="nx-boot-bar" /></div>
    </div>
  );
}
