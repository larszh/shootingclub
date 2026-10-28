import { File, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet, FileText, FileVideo, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileKind, type FileKind } from "../types";

const ICONS: Record<FileKind, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  image: { icon: FileImage, tone: "bg-accent-soft text-accent" },
  pdf: { icon: FileText, tone: "bg-danger/10 text-danger" },
  text: { icon: FileText, tone: "bg-surface-2 text-ink-2" },
  sheet: { icon: FileSpreadsheet, tone: "bg-ok/10 text-ok" },
  slides: { icon: Presentation, tone: "bg-warn/10 text-warn" },
  archive: { icon: FileArchive, tone: "bg-surface-2 text-ink-2" },
  audio: { icon: FileAudio, tone: "bg-surface-2 text-ink-2" },
  video: { icon: FileVideo, tone: "bg-surface-2 text-ink-2" },
  code: { icon: FileCode, tone: "bg-surface-2 text-ink-2" },
  other: { icon: File, tone: "bg-surface-2 text-ink-2" },
};

export function FileTypeIcon({ mimeType, name, className }: { mimeType: string; name: string; className?: string }) {
  const { icon: Icon, tone } = ICONS[fileKind(mimeType, name)];
  return (
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-control", tone, className)} aria-hidden>
      <Icon className="h-5 w-5" />
    </span>
  );
}
