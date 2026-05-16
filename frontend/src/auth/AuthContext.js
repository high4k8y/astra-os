import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { getFingerprint } from "../lib/fingerprint";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TOKEN_KEY = "astra-token";

const AuthCtx = createContext(null);

function formatDetail(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  return String(detail);
}

export function AuthProvider({ children }) {
  // null = checking, false = logged out, object = user
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [fingerprint, setFingerprint] = useState("");

  useEffect(() => {
    let cancel = false;
    getFingerprint().then((fp) => { if (!cancel) setFingerprint(fp); }).catch(() => {});
    return () => { cancel = true; };
  }, []);

  const refreshMe = useCallback(async (t) => {
    const useTok = t || token;
    if (!useTok) {
      setUser(false);
      return;
    }
    try {
      const { data } = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${useTok}` },
      });
      setUser(data);
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(false);
    }
  }, [token]);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  const login = async (username, password) => {
    const fp = fingerprint || (await getFingerprint());
    const { data } = await axios.post(`${API}/auth/login`, { username, password, fingerprint: fp });
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (username, password, devCode) => {
    const fp = fingerprint || (await getFingerprint());
    const body = { username, password, fingerprint: fp };
    if (devCode) body.dev_code = devCode;
    const { data } = await axios.post(`${API}/auth/register`, body);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, token, login, register, logout, formatDetail, fingerprint }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
