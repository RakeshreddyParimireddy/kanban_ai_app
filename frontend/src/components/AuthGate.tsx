"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { getMe, logout } from "@/lib/api";

export const AuthGate = () => {
  // undefined = still checking the session
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getMe().then(setUsername);
  }, []);

  const handleLogout = async () => {
    await logout();
    setUsername(null);
  };

  if (username === undefined) {
    return null;
  }
  if (username === null) {
    return <LoginForm onSuccess={setUsername} />;
  }
  return <KanbanBoard onLogout={handleLogout} />;
};
