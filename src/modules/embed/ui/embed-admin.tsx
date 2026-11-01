"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Code2, Eye, Power, RefreshCw, ShieldCheck } from "lucide-react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { CopyButton, Segmented } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/form";
import { confirmDialog, isNetworkError, toast } from "@/lib/ui-feedback";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { createEmbedTokenAction, regenerateEmbedTokenAction, revokeEmbedTokenAction, signWidgetAction, type EmbedTokenResult } from "../actions";
import { iframeSnippet, RESIZE_MESSAGE, resizeScriptSnippet, widgetPath, WIDGETS, type EmbedTheme, type WidgetKey } from "../logic";

type Option = { id: string; label: string };

export type EmbedAdminProps = {
  initialToken: string | null;
  appUrl: string;
  appOrigin: string;
  modules: Record<"events" | "scores" | "championship" | "range", boolean>;
  hasCalendarFeed: boolean;
  kinds: Array<{ key: string; label: string }>;
  programs: Option[];
  championships: Option[];
};

const PERIOD_OPTIONS = [
  { value: "month", label: "Monat" },
  { value: "year", label: "Jahr" },
  { value: "all", label: "Alle" },
] as const;

const MODULE_NAMES = { events: "Anlässe", scores: "Punkteerfassung", championship: "Jahresmeisterschaft", range: "Standbetrieb" } as const;

export function EmbedAdmin(p: EmbedAdminProps) {
  const [token, setToken] = useState(p.initialToken);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<ActionResult<EmbedTokenResult>>) {
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) return void toast.error(r.error);
        setToken(r.data?.token ?? null);
        if (r.message) toast.success(r.message);
      } catch (err) {
        toast.error(isNetworkError(err) ? "Keine Verbindung. Bitte nochmals versuchen." : "Das hat nicht geklappt.");
      }
    });
  }

  if (!token) {
    return (
      <Card className="p-4">
        <h2 className="mb-1 font-semibold">Widgets einschalten</h2>
        <p className="mb-4 text-sm text-ink-3">
          Du erhältst einen geheimen Code für eure Website. Damit lassen sich Kalender, Schiesszeiten und – wenn du sie freigibst – Ranglisten einbetten.
          Ohne Anmeldung, ohne Cookies.
        </p>
        <Button type="button" className="w-full sm:w-auto" disabled={pending} onClick={() => run(createEmbedTokenAction)}>
          {pending ? <Spinner /> : <Power className="h-4 w-4" aria-hidden />} Widgets einschalten
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Builder {...p} token={token} />
      <Card className="p-4">
        <h2 className="mb-1 font-semibold">Code verwalten</h2>
        <p className="mb-3 text-sm text-ink-3">Ein neuer Code macht alle bisher eingebetteten Widgets ungültig. Ausschalten blendet sie sofort aus.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={pending}
            onClick={async () => { if (await confirmDialog({ title: "Neuen Code erzeugen?", message: "Die Widgets auf der Website funktionieren erst wieder, wenn du den neuen Code einfügst.", tone: "danger", confirmLabel: "Neu erzeugen" })) run(regenerateEmbedTokenAction); }}>
            {pending ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden />} Neuen Code erzeugen
          </Button>
          <Button type="button" variant="ghost" disabled={pending}
            onClick={async () => { if (await confirmDialog({ title: "Widgets ausschalten?", message: "Alle eingebetteten Widgets zeigen danach nur noch einen Hinweis.", tone: "danger", confirmLabel: "Ausschalten" })) run(revokeEmbedTokenAction); }}>
            <Power className="h-4 w-4" aria-hidden /> Ausschalten
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Builder(p: EmbedAdminProps & { token: string }) {
  const [widget, setWidget] = useState<WidgetKey>("calendar");
  const [theme, setTheme] = useState<EmbedTheme>("auto");
  const [kinds, setKinds] = useState<string[]>([]);
  const [limit, setLimit] = useState("8");
  const [program, setProgram] = useState(p.programs[0]?.id ?? "");
  const [period, setPeriod] = useState<string>("year");
  const [championship, setChampionship] = useState(p.championships[0]?.id ?? "");
  const [height, setHeight] = useState(String(WIDGETS.calendar.height));
  /** Signaturen pro Auswahl (Token + Widget + Parameter) */
  const [sigs, setSigs] = useState<Record<string, string>>({});
  const [signing, startSign] = useTransition();

  const meta = WIDGETS[widget];
  const moduleOn = p.modules[meta.module];
  const sigKey = widget === "ranking" ? `${p.token}|ranking|${program}|${period}` : widget === "championship" ? `${p.token}|championship|${championship}` : "";
  const sig = sigKey ? sigs[sigKey] : undefined;
  const themeParam = theme === "auto" ? null : theme;

  const path = useMemo(() => {
    if (widget === "calendar") return widgetPath(p.token, "calendar", { kind: kinds.join(",") || null, limit: limit && limit !== "8" ? limit : null, theme: themeParam });
    if (widget === "times") return widgetPath(p.token, "times", { theme: themeParam });
    if (!sig) return null;
    if (widget === "ranking") return widgetPath(p.token, "ranking", { program, period, theme: themeParam, sig });
    return widgetPath(p.token, "championship", { id: championship, theme: themeParam, sig });
  }, [widget, p.token, kinds, limit, themeParam, sig, program, period, championship]);

  const h = Math.min(Math.max(Number(height) || meta.height, 120), 3000);
  const iframe = path ? iframeSnippet({ src: p.appUrl + path, title: `${meta.label} – Standchef`, height: h }) : "";
  const script = resizeScriptSnippet(p.appOrigin);

  function pickWidget(w: WidgetKey) {
    setWidget(w);
    setHeight(String(WIDGETS[w].height));
  }

  function sign() {
    startSign(async () => {
      try {
        const r = await signWidgetAction(widget === "ranking" ? { widget, program, period } : { widget, id: championship });
        if (!r.ok) return void toast.error(r.error);
        if (r.data) setSigs((s) => ({ ...s, [sigKey]: r.data!.sig }));
        toast.success("Code erzeugt");
      } catch (err) {
        toast.error(isNetworkError(err) ? "Keine Verbindung. Bitte nochmals versuchen." : "Das hat nicht geklappt.");
      }
    });
  }

  const canSign = widget === "ranking" ? !!program : widget === "championship" ? !!championship : false;

  return (
    <>
      <Card className="space-y-4 p-4">
        <div>
          <h2 className="mb-1 font-semibold">Widget wählen</h2>
          <p className="text-sm text-ink-3">{meta.description}</p>
        </div>
        <Segmented<WidgetKey>
          label="Widget"
          value={widget}
          onChange={pickWidget}
          options={[
            { value: "calendar", label: "Kalender" },
            { value: "times", label: "Zeiten" },
            { value: "ranking", label: "Rangliste" },
            { value: "championship", label: "Meisterschaft" },
          ]}
        />
        {!moduleOn ? <Alert tone="warn">Das Modul «{MODULE_NAMES[meta.module]}» ist ausgeschaltet. Das Widget zeigt dann nur einen Hinweis.</Alert> : null}

        {widget === "calendar" ? (
          <>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Arten (leer = alle)</legend>
              <div className="flex flex-wrap gap-2">
                {p.kinds.map((k) => {
                  const on = kinds.includes(k.key);
                  return (
                    <button key={k.key} type="button" aria-pressed={on}
                      onClick={() => setKinds((list) => (on ? list.filter((x) => x !== k.key) : [...list, k.key]))}
                      className={cn("press min-h-11 rounded-full border px-4 text-sm font-medium", on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2 hover:bg-surface-2")}>
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Anzahl Anlässe" hint="1 bis 30">
              <Input type="number" inputMode="numeric" min={1} max={30} value={limit} onChange={(e) => setLimit(e.target.value)} />
            </Field>
            {!p.hasCalendarFeed ? <Alert tone="info">Tipp: Erstelle unter Anlässe den Vereinskalender-Link, dann zeigt das Widget «In Kalender übernehmen».</Alert> : null}
          </>
        ) : null}

        {widget === "ranking" ? (
          p.programs.length ? (
            <>
              <Field label="Programm">
                <Select value={program} onChange={(e) => setProgram(e.target.value)}>
                  {p.programs.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </Select>
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-medium">Zeitraum</p>
                <Segmented label="Zeitraum" value={period} onChange={setPeriod} options={PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              </div>
            </>
          ) : <Alert tone="info">Es gibt noch keine Programme.</Alert>
        ) : null}

        {widget === "championship" ? (
          p.championships.length ? (
            <Field label="Meisterschaft" hint="Nur veröffentlichte Meisterschaften">
              <Select value={championship} onChange={(e) => setChampionship(e.target.value)}>
                {p.championships.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
          ) : <Alert tone="info">Es gibt keine veröffentlichte Meisterschaft.</Alert>
        ) : null}

        <div>
          <p className="mb-1.5 text-sm font-medium">Darstellung</p>
          <Segmented<EmbedTheme> label="Darstellung" value={theme} onChange={setTheme} options={[{ value: "auto", label: "Automatisch" }, { value: "light", label: "Hell" }, { value: "dark", label: "Dunkel" }]} />
        </div>
        <Field label="Höhe in Pixel" hint={`Empfohlen ${meta.height}. Mit dem Skript passt sich die Höhe automatisch an.`}>
          <Input type="number" inputMode="numeric" min={120} max={3000} value={height} onChange={(e) => setHeight(e.target.value)} />
        </Field>

        {meta.signed && !sig ? (
          <div className="space-y-2">
            <Alert tone="info" icon={<ShieldCheck className="h-4 w-4" />}>Ranglisten zeigen Namen («Vorname N.»). Sie erscheinen nur mit einem Code, den du hier erzeugst – damit gibst du sie für die Website frei.</Alert>
            <Button type="button" disabled={!canSign || signing} onClick={sign} className="w-full sm:w-auto">
              {signing ? <Spinner /> : <Code2 className="h-4 w-4" aria-hidden />} Code erzeugen und freigeben
            </Button>
          </div>
        ) : null}
      </Card>

      {path ? (
        <>
          <Card className="space-y-4 p-4">
            <div>
              <h2 className="mb-1 font-semibold">Code für die Website</h2>
              <p className="text-sm text-ink-3">Füge den Code dort ein, wo das Widget erscheinen soll (z.B. als HTML-Block in WordPress, Wix oder Jimdo).</p>
            </div>
            <SnippetBlock label="1. Widget (iframe)" code={iframe} />
            <SnippetBlock label="2. Automatische Höhe (einmal pro Seite, optional)" code={script} />
          </Card>
          <section aria-label="Vorschau">
            <h2 className="mb-2 flex items-center gap-2 font-semibold"><Eye className="h-4 w-4" aria-hidden /> Vorschau</h2>
            <Preview key={path} path={path} height={h} title={`Vorschau ${meta.label}`} />
          </section>
        </>
      ) : null}
    </>
  );
}

function SnippetBlock({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <CopyButton text={code} label="Kopieren" copiedMessage="Code kopiert" />
      </div>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-control border border-line bg-surface-2 p-3 font-mono text-xs text-ink-2">{code}</pre>
    </div>
  );
}

/** Live-Vorschau: dieselbe URL wie auf der Website, Höhe per postMessage. */
function Preview({ path, height, title }: { path: string; height: number; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(height);
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || e.source !== ref.current?.contentWindow) return;
      const d = e.data as { type?: string; height?: number } | null;
      if (d?.type === RESIZE_MESSAGE && typeof d.height === "number") setH(Math.min(Math.max(d.height, 120), 5000));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <iframe ref={ref} src={path} title={title} className="block w-full border-0" style={{ height: h }} loading="lazy" referrerPolicy="no-referrer" />
    </div>
  );
}
