"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex bg-gray-50 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-12 w-48 rounded-lg" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
