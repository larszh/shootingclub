"use client";

import { Dialog, confirmDialog } from "@/components/ui/dialog";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Maximize2, Minus, Plus, Square, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { Avatar } from "@/components/avatar";
import { Alert, Button } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";
import { translateServerMessage } from "@/components/server-messages";

/**
 * Bild auswählen, quadratisch zuschneiden (Ziehen, Pinch, Mausrad, Regler) und als
 * 512×512 WebP (Fallback JPEG) hochladen. Für Logos zusätzlich «Ganz einpassen»
 * (transparent aufgefüllt), weil Vereinslogos oft nicht quadratisch sind.
 */

const OUTPUT_SIZE = 512;
const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/heic,image/heif,image/gif,image/avif";

type Fit = "cover" | "contain";

type Loaded = { url: string; img: HTMLImageElement; w: number; h: number };

type View = { zoom: number; x: number; y: number }; // x/y als Anteil der Viewport-Breite

function zoomRange(fit: Fit) {
  return fit === "cover" ? { min: 1, max: 4 } : { min: 0.4, max: 3 };
}

/** Breite/Höhe des Bildes relativ zum quadratischen Ausschnitt. */
function displaySize(l: Loaded, fit: Fit, zoom: number) {
  const base = fit === "cover" ? 1 / Math.min(l.w, l.h) : 1 / Math.max(l.w, l.h);
  return { dw: l.w * base * zoom, dh: l.h * base * zoom };
}

function clampView(l: Loaded, fit: Fit, v: View): View {
  const { min, max } = zoomRange(fit);
  const zoom = Math.min(max, Math.max(min, v.zoom));
  const { dw, dh } = displaySize(l, fit, zoom);
  const mx = Math.abs(dw - 1) / 2;
  const my = Math.abs(dh - 1) / 2;
  return { zoom, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function renderOutput(l: Loaded, fit: Fit, v: View): Promise<{ blob: Blob; ext: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  const draw = (background: string | null) => {
    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    }
    const { dw, dh } = displaySize(l, fit, v.zoom);
    const left = (0.5 + v.x - dw / 2) * OUTPUT_SIZE;
    const top = (0.5 + v.y - dh / 2) * OUTPUT_SIZE;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(l.img, left, top, dw * OUTPUT_SIZE, dh * OUTPUT_SIZE);
  };

  draw(null);
  for (const q of [0.86, 0.75, 0.6]) {
    const webp = await toBlob(canvas, "image/webp", q);
    if (webp && webp.type === "image/webp") {
      if (webp.size <= MAX_BYTES) return { blob: webp, ext: "webp" };
      continue;
    }
    break; // Browser kann kein WebP → JPEG
  }
  // JPEG kennt keine Transparenz: weiss hinterlegen.
  draw("#ffffff");
  for (const q of [0.88, 0.75, 0.6]) {
    const jpg = await toBlob(canvas, "image/jpeg", q);
    if (jpg && jpg.size <= MAX_BYTES) return { blob: jpg, ext: "jpg" };
  }
  throw new Error("Bild konnte nicht verkleinert werden");
}

export function ImageUploader({
  kind,
  currentUrl,
  name,
  uploadAction,
  removeAction,
  title,
  hint,
}: {
  kind: "avatar" | "logo";
  currentUrl: string | null;
  name: string;
  uploadAction: (formData: FormData) => Promise<ActionResult>;
  removeAction: () => Promise<ActionResult>;
  title?: string;
  hint?: string;
}) {
  const router = useRouter();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fit, setFit] = useState<Fit>("cover");
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, startRemove] = useTransition();

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startView: View; startDist: number; startMid: { x: number; y: number } } | null>(null);
  /** Zeitpunkt des letzten Gestenendes: ein Ziehen, das ausserhalb endet, soll den Dialog nicht schliessen. */
  const lastGestureEnd = useRef(-Infinity);

  const isLogo = kind === "logo";

  const close = () => {
    if (loaded) URL.revokeObjectURL(loaded.url);
    setLoaded(null);
    pointers.current.clear();
    gesture.current = null;
  };

  const requestClose = () => {
    if (busy || performance.now() - lastGestureEnd.current < 350) return;
    close();
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setMessage(null);
    if (file.size > 30 * 1024 * 1024) {
      setError(t("shell.image.tooLarge"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        URL.revokeObjectURL(url);
        setError(t("shell.image.unreadable"));
        return;
      }
      const l: Loaded = { url, img, w: img.naturalWidth, h: img.naturalHeight };
      const startFit: Fit = isLogo && Math.abs(l.w / l.h - 1) > 0.15 ? "contain" : "cover";
      setFit(startFit);
      setView(clampView(l, startFit, { zoom: 1, x: 0, y: 0 }));
      setLoaded(l);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError(t("shell.image.format"));
    };
    img.src = url;
  };

  const update = (next: View) => {
    if (loaded) setView(clampView(loaded, fit, next));
  };

  const changeFit = (f: Fit) => {
    if (!loaded) return;
    setFit(f);
    setView(clampView(loaded, f, { zoom: 1, x: 0, y: 0 }));
  };

  const rectWidth = () => viewportRef.current?.getBoundingClientRect().width || 1;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startGesture();
  };

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 0) {
      gesture.current = null;
      return;
    }
    const mid = pts.length >= 2 ? { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 } : pts[0]!;
    const dist = pts.length >= 2 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 0;
    gesture.current = { startView: view, startDist: dist, startMid: mid };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    const w = rectWidth();
    if (pts.length >= 2 && g.startDist > 0) {
      const mid = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      update({ zoom: g.startView.zoom * (dist / g.startDist), x: g.startView.x + (mid.x - g.startMid.x) / w, y: g.startView.y + (mid.y - g.startMid.y) / w });
    } else {
      update({ zoom: g.startView.zoom, x: g.startView.x + (e.clientX - g.startMid.x) / w, y: g.startView.y + (e.clientY - g.startMid.y) / w });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) lastGestureEnd.current = performance.now();
    startGesture();
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    update({ ...view, zoom: view.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 0.02;
    const map: Record<string, View> = {
      ArrowLeft: { ...view, x: view.x - step },
      ArrowRight: { ...view, x: view.x + step },
      ArrowUp: { ...view, y: view.y - step },
      ArrowDown: { ...view, y: view.y + step },
      "+": { ...view, zoom: view.zoom * 1.1 },
      "-": { ...view, zoom: view.zoom / 1.1 },
    };
    const next = map[e.key];
    if (next) {
      e.preventDefault();
      update(next);
    }
  };

  const save = async () => {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, ext } = await renderOutput(loaded, fit, view);
      const fd = new FormData();
      fd.append("file", new File([blob], `bild.${ext}`, { type: blob.type }));
      const res = await uploadAction(fd);
      if (!res.ok) {
        setError(translateServerMessage(res.error, t));
      } else {
        setMessage(translateServerMessage(res.message, t) || t("shell.common.saved"));
        close();
        router.refresh();
      }
    } catch {
      setError(t("shell.image.failed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: isLogo ? t("shell.image.removeLogoConfirm") : t("shell.image.removeAvatarConfirm"), tone: "danger", confirmLabel: t("shell.image.remove") }))) return;
    setError(null);
    setMessage(null);
    startRemove(async () => {
      const res = await removeAction();
      if (!res.ok) setError(translateServerMessage(res.error, t));
      else {
        setMessage(translateServerMessage(res.message, t) || t("shell.image.removed"));
        router.refresh();
      }
    });
  };

  const { min, max } = zoomRange(fit);
  const size = loaded ? displaySize(loaded, fit, view.zoom) : { dw: 1, dh: 1 };

  return (
    <div>
      <div className="flex items-center gap-4">
        {isLogo ? (
          <span className="checker relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line">
            {currentUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xl font-semibold text-ink-3">{name.slice(0, 2).toUpperCase()}</span>
            )}
          </span>
        ) : (
          <Avatar name={name} src={currentUrl} size={80} />
        )}
        <div className="min-w-0 flex-1">
          {title ? <div className="font-medium">{title}</div> : null}
          <p className="text-xs text-ink-3">{hint ?? (isLogo ? t("shell.image.logoHint") : t("shell.image.avatarHint"))}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={busy || removing}>
              <Camera className="h-4 w-4" /> {currentUrl ? t("shell.image.change") : t("shell.image.choose")}
            </Button>
            {currentUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy || removing}>
                {removing ? <Spinner /> : <Trash2 className="h-4 w-4" />} {t("shell.image.remove")}
              </Button>
            ) : null}
          </div>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={onPick} tabIndex={-1} aria-hidden />
      </div>
      {error && !loaded ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      {message && !error ? <div className="mt-3"><Alert tone="ok">{message}</Alert></div> : null}

      {/* Gemeinsamer Dialog (<dialog> im Top-Layer): volle Fläche, Fokusfalle, Scroll-Sperre, Fokus-Rückgabe. */}
      <Dialog
        open={!!loaded}
        onClose={requestClose}
        title={isLogo ? t("shell.image.cropLogo") : t("shell.image.cropAvatar")}
        dismissible={!busy}
        initialFocusRef={viewportRef}
        footer={
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>{t("shell.common.cancel")}</Button>
            <Button type="button" onClick={save} disabled={busy}>
              {busy ? <><Spinner /> {t("shell.image.saving")}</> : t("shell.image.apply")}
            </Button>
          </div>
        }
      >
        {loaded ? (
          <>
            {isLogo ? (
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-control bg-surface-2 p-1" role="radiogroup" aria-label={t("shell.image.crop")}>
                {([["cover", t("shell.image.square"), Square], ["contain", t("shell.image.fit"), Maximize2]] as const).map(([f, label, Icon]) => (
                  <button key={f} type="button" role="radio" aria-checked={fit === f} onClick={() => changeFit(f)}
                    className={cn("press flex h-10 items-center justify-center gap-2 rounded-[0.65rem] text-sm font-medium transition-colors", fit === f ? "bg-surface text-ink shadow-sm" : "text-ink-3")}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            ) : null}

            <div
              ref={viewportRef}
              className={cn("relative mx-auto aspect-square w-full max-w-[320px] cursor-grab touch-none select-none overflow-hidden rounded-2xl active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-accent", isLogo ? "checker" : "bg-surface-2")}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
              onKeyDown={onKeyDown}
              tabIndex={0}
              aria-label={t("shell.image.viewportAria")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={loaded.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{
                  width: `${size.dw * 100}%`,
                  height: `${size.dh * 100}%`,
                  left: `${(0.5 + view.x - size.dw / 2) * 100}%`,
                  top: `${(0.5 + view.y - size.dh / 2) * 100}%`,
                }}
              />
              {!isLogo ? <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" /> : <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/10" />}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button type="button" className="press flex h-11 w-11 items-center justify-center rounded-full border border-line" onClick={() => update({ ...view, zoom: view.zoom / 1.15 })} aria-label={t("shell.image.zoomOut")}><Minus className="h-4 w-4" /></button>
              <input
                type="range"
                min={min}
                max={max}
                step={0.01}
                value={view.zoom}
                onChange={(e) => update({ ...view, zoom: Number(e.target.value) })}
                className="h-11 flex-1 accent-[var(--accent)]"
                aria-label="Zoom"
              />
              <button type="button" className="press flex h-11 w-11 items-center justify-center rounded-full border border-line" onClick={() => update({ ...view, zoom: view.zoom * 1.15 })} aria-label={t("shell.image.zoomIn")}><Plus className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-center text-xs text-ink-3">{t("shell.image.gestureHint")}</p>

            {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
