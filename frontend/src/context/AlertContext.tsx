"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CheckCircle, AlertCircle } from "lucide-react";

interface Alert {
  type: "success" | "error";
  message: string;
}

interface AlertContextType {
  success: (message: string) => void;
  error: (message: string) => void;
}

const AlertContext = createContext<AlertContextType>({ success: () => {}, error: () => {} });

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [open, setOpen] = useState(false);

  const success = useCallback((message: string) => {
    setAlert({ type: "success", message });
    setOpen(true);
    setTimeout(() => setOpen(false), 2000);
  }, []);

  const error = useCallback((message: string) => {
    setAlert({ type: "error", message });
    setOpen(true);
  }, []);

  return (
    <AlertContext.Provider value={{ success, error }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="flex flex-col items-center gap-3 pt-4">
            {alert?.type === "success" ? (
              <CheckCircle size={48} className="text-emerald-500" />
            ) : (
              <AlertCircle size={48} className="text-red-500" />
            )}
            <DialogTitle className="text-center">
              {alert?.type === "success" ? "Success" : "Error"}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {alert?.message}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  return useContext(AlertContext);
}
