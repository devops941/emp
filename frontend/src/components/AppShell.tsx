"use client";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AlertProvider } from "@/context/AlertContext";
import Sidebar from "./Sidebar";
import { Skeleton } from "@/components/ui/skeleton";

function ShellContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex bg-gray-50">
        <div className="hidden lg:flex w-64 border-r border-border bg-background p-4 flex-col gap-4">
          <Skeleton className="h-8 w-32" />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
        <main className="flex-1 p-6 lg:p-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-5 border border-border rounded-xl">
                  <Skeleton className="h-10 w-10 rounded-xl mb-3" />
                  <Skeleton className="h-8 w-20 mb-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        </main>
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
      <AlertProvider>
        <ShellContent>{children}</ShellContent>
      </AlertProvider>
    </AuthProvider>
  );
}
