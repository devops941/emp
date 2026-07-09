"use client";

import { useState, useRef } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Upload, X, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileItem {
  url: string;
  original_name: string;
  format: string;
}

interface FileUploadProps {
  onUploadComplete?: (file: FileItem) => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<FileItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/api/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const item = res.data;
      setPreview(item);
      onUploadComplete?.(item);
      toast.success("File uploaded");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={handleUpload}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted cursor-pointer text-sm font-medium text-foreground transition-colors"
        >
          <Upload size={16} />
          {uploading ? "Uploading..." : "Upload File"}
        </label>
        <span className="text-xs text-muted-foreground">Images, PDF, DOC, XLS, TXT (max 10MB)</span>
      </div>
      {preview && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted">
          {preview.format.match(/jpe?g|png|gif|webp/) ? (
            <Image size={20} className="text-emerald-600 shrink-0" />
          ) : (
            <FileText size={20} className="text-amber-600 shrink-0" />
          )}
          <span className="text-sm text-foreground truncate flex-1">{preview.original_name}</span>
          <a
            href={preview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium shrink-0"
          >
            View
          </a>
          <button onClick={() => setPreview(null)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
