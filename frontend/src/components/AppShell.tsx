"use client";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import Sidebar from "./Sidebar";
import { Toaster } from "react-hot-toast";

function ShellContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <main className="flex-1 lg:ml-0 ml-0 p-6 lg:p-8 pt-16 lg:pt-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            fontSize: "14px",
            borderRadius: "12px",
          },
        }}
      />
      <ShellContent>{children}</ShellContent>
    </AuthProvider>
  );
}
