import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import AstraLogo from "../os/AstraLogo";
import { Eye, EyeOff, Code2 } from "lucide-react";
import "./auth.css";

export default function AuthGate() {
  const { user, login, register, formatDetail } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (user === null) {
    return (
      <div className="auth-screen" data-testid="auth-loading">
        <div className="auth-loading-ring" />
      </div>
    );
  }
  if (user) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        if (isDev && !devCode.trim()) {
          setErr("Enter the developer code or uncheck the box.");
          setBusy(false);
          return;
        }
        await register(username.trim(), password, isDev ? devCode.trim() : null);
      }
    } catch (ex) {
      setErr(formatDetail(ex.response?.data?.detail) || ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen" data-testid="auth-gate">
      <div className="auth-bg" aria-hidden />
      <div className="auth-card">
        <div className="auth-brand">
          <AstraLogo size={84} />
          <div className="auth-wordmark">
            astra<span>-os</span>
          </div>
          <div className="auth-tagline">Explore. Build. Elevate.</div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setErr(""); }}
            data-testid="auth-tab-login"
          >Sign in</button>
          <button
            type="button"
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => { setMode("register"); setErr(""); }}
            data-testid="auth-tab-register"
          >Create account</button>
        </div>

        <form className="auth-form" onSubmit={submit} autoComplete="off">
          <label className="auth-field">
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alice"
              required
              minLength={2}
              maxLength={24}
              data-testid="auth-username"
              spellCheck="false"
              autoCapitalize="off"
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-pw-wrap">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={4}
                data-testid="auth-password"
              />
              <button
                type="button"
                className="auth-pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                tabIndex={-1}
                aria-label="toggle password visibility"
                data-testid="auth-pw-toggle"
              >
                {showPw ? <EyeOff size={15} strokeWidth={1.6} /> : <Eye size={15} strokeWidth={1.6} />}
              </button>
            </div>
          </label>

          {mode === "register" && (
            <>
              <label className="auth-check">
                <input
                  type="checkbox"
                  checked={isDev}
                  onChange={(e) => setIsDev(e.target.checked)}
                  data-testid="auth-isdev"
                />
                <span><Code2 size={13} strokeWidth={1.7} /> I'm a developer</span>
              </label>
              {isDev && (
                <label className="auth-field auth-field-dev">
                  <span>Developer code</span>
                  <input
                    type="text"
                    value={devCode}
                    onChange={(e) => setDevCode(e.target.value)}
                    placeholder="enter code"
                    data-testid="auth-devcode"
                    spellCheck="false"
                    autoCapitalize="off"
                    autoComplete="off"
                  />
                </label>
              )}
            </>
          )}

          {err && <div className="auth-err" data-testid="auth-error">{err}</div>}

          <button type="submit" className="auth-submit" disabled={busy} data-testid="auth-submit">
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <div className="auth-foot">
            {mode === "login" ? (
              <>New here? <button type="button" className="auth-link" onClick={() => setMode("register")} data-testid="auth-switch-register">Create account</button></>
            ) : (
              <>Have an account? <button type="button" className="auth-link" onClick={() => setMode("login")} data-testid="auth-switch-login">Sign in</button></>
            )}
          </div>
        </form>
      </div>
      <div className="auth-meta">astra-os · v1.1 · session stays for 30 days</div>
    </div>
  );
}
