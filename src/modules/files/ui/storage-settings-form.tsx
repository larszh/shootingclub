"use client";

import { useActionState, useState } from "react";
import { Cloud, HardDrive, Server, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { PasswordInput, Switch } from "@/components/ui/controls";
import { confirmDialog } from "@/components/ui/dialog";
import { Spinner, submitKeepingValues } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { cn } from "@/lib/utils";
import { HETZNER_REGIONS, hetznerEndpoint } from "@/lib/file-storage/types";
import { forgetStorageCredentialsAction, saveStorageSettingsAction } from "../actions";

export type StorageChoice = "LOCAL" | "S3_AWS" | "S3_HETZNER" | "S3_COMPAT" | "WEBDAV";

type Props = {
  activeChoice: StorageChoice;
  quotaMb: number | null;
  maxFileMb: number;
  hardMaxFileMb: number;
  credentialsBroken: boolean;
  s3: { variant: string; endpoint: string; region: string; bucket: string; accessKeyId: string; forcePathStyle: boolean; prefix: string; hasSecret: boolean } | null;
  webdav: { url: string; username: string; hasPassword: boolean } | null;
  fileCounts: { S3: number; WEBDAV: number };
};

const OPTIONS: Array<{ value: StorageChoice; title: string; text: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "LOCAL", title: "Server", text: "Auf dem Standchef-Server. Keine Einrichtung nötig.", icon: HardDrive },
  { value: "S3_HETZNER", title: "S3 / Hetzner", text: "Hetzner Object Storage, günstig und in Europa.", icon: Cloud },
  { value: "S3_AWS", title: "S3 / AWS", text: "Amazon S3, z.B. Region Zürich (eu-central-2).", icon: Cloud },
  { value: "S3_COMPAT", title: "S3-kompatibel", text: "Infomaniak, Exoscale, MinIO, Cloudflare R2 usw.", icon: Server },
  { value: "WEBDAV", title: "Nextcloud / WebDAV", text: "Ein Ordner in der Nextcloud des Vereins.", icon: Cloud },
];

const SECRET_HINT_S3 = "Leer lassen = unverändert (nur bei gleichem Endpoint und Access Key).";
const SECRET_HINT_DAV = "Leer lassen = unverändert (nur bei gleicher Adresse und gleichem Benutzer).";

export function StorageSettingsForm(props: Props) {
  const router = useRouter();
  const [choice, setChoice] = useState<StorageChoice>(props.activeChoice);
  const [intent, setIntent] = useState<"save" | "test">("save");
  const [hetznerRegion, setHetznerRegion] = useState(props.s3?.variant === "HETZNER" && props.s3.region ? props.s3.region : "fsn1");
  const [state, formAction, pending] = useActionState(saveStorageSettingsAction, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  const s3 = props.s3;
  const s3Same = (variant: string) => (s3 && s3.variant === variant ? s3 : null);
  const showOtherS3 = !!props.s3 && !props.activeChoice.startsWith("S3_");
  const showOtherDav = !!props.webdav && props.activeChoice !== "WEBDAV";

  async function forget(which: "S3" | "WEBDAV") {
    const okd = await confirmDialog({ title: "Zugangsdaten entfernen?", message: "Die gespeicherten Zugangsdaten dieses Speichers werden gelöscht.", tone: "danger", confirmLabel: "Entfernen" });
    if (!okd) return;
    const r = await forgetStorageCredentialsAction(which);
    if (r.ok) {
      toast.success(r.message ?? "Entfernt.");
      router.refresh();
    } else toast.error(r.error);
  }

  return (
    <form onSubmit={submitKeepingValues(formAction)} className="space-y-4">
      {props.credentialsBroken ? (
        <Alert tone="warn" title="Zugangsdaten nicht lesbar">
          Die gespeicherten Zugangsdaten lassen sich nicht mehr entschlüsseln (z.B. weil AUTH_SECRET geändert wurde). Bitte neu eintragen.
        </Alert>
      ) : null}

      <Card className="p-4">
        <fieldset>
          <legend className="mb-1 font-semibold">Wo sollen neue Dateien liegen?</legend>
          <p className="mb-3 text-sm text-ink-3">Bereits hochgeladene Dateien bleiben dort, wo sie gespeichert wurden, und sind weiterhin abrufbar.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {OPTIONS.map((o) => {
              const on = choice === o.value;
              const Icon = o.icon;
              return (
                <label key={o.value} className={cn("press flex min-h-16 cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors", on ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2")}>
                  <input type="radio" name="choice" value={o.value} checked={on} onChange={() => setChoice(o.value)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Icon className="h-4 w-4 text-ink-3" aria-hidden /> {o.title}
                      {props.activeChoice === o.value ? <Badge tone="ok" className="ml-1">aktiv</Badge> : null}
                    </span>
                    <span className="block text-sm text-ink-3">{o.text}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </Card>

      {choice === "LOCAL" ? (
        <Card className="p-4 text-sm text-ink-2">
          <p>Die Dateien liegen auf dem Server, auf dem Standchef läuft, im Upload-Ordner. Sie sind in der normalen Server-Sicherung enthalten. Für viele oder grosse Dateien lohnt sich ein eigener S3-Speicher.</p>
        </Card>
      ) : null}

      {choice.startsWith("S3_") ? (
        <Card key={choice} className="space-y-3 p-4">
          <h3 className="font-semibold">{OPTIONS.find((o) => o.value === choice)?.title}</h3>
          {choice === "S3_HETZNER" ? (
            <>
              <p className="text-sm text-ink-3">In der Hetzner Console unter «Object Storage» einen Bucket erstellen und unter «Security → S3-Zugangsdaten» einen Schlüssel anlegen.</p>
              <Field label="Standort" error={fe?.hetznerRegion} hint={`Endpoint: ${hetznerEndpoint(hetznerRegion)}`}>
                <Select name="hetznerRegion" value={hetznerRegion} onChange={(e) => setHetznerRegion(e.target.value)}>
                  {HETZNER_REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Select>
              </Field>
            </>
          ) : null}
          {choice === "S3_AWS" ? (
            <>
              <p className="text-sm text-ink-3">In der AWS-Konsole einen Bucket anlegen und einen IAM-Benutzer mit Rechten auf diesen Bucket (GetObject, PutObject, DeleteObject).</p>
              <Field label="Region" error={fe?.region} hint="z.B. eu-central-2 (Zürich) oder eu-central-1 (Frankfurt)">
                <Input name="region" defaultValue={s3Same("AWS")?.region ?? "eu-central-2"} autoComplete="off" className="font-mono text-sm" />
              </Field>
            </>
          ) : null}
          {choice === "S3_COMPAT" ? (
            <>
              <p className="text-sm text-ink-3">Für jeden Anbieter mit S3-Schnittstelle. Endpoint und Region stehen in der Dokumentation des Anbieters.</p>
              <Field label="Endpoint" error={fe?.endpoint} hint="z.B. https://s3.pub1.infomaniak.cloud">
                <Input name="endpoint" type="url" defaultValue={s3Same("COMPAT")?.endpoint ?? ""} autoComplete="off" placeholder="https://" className="font-mono text-sm" />
              </Field>
              <Field label="Region" error={fe?.region} hint="Leer lassen, wenn der Anbieter keine Region verlangt.">
                <Input name="region" defaultValue={s3Same("COMPAT")?.region ?? ""} autoComplete="off" placeholder="us-east-1" className="font-mono text-sm" />
              </Field>
              <Switch name="forcePathStyle" defaultChecked={s3Same("COMPAT")?.forcePathStyle ?? true} label="Pfad-Stil verwenden" description="Bei MinIO und vielen anderen Anbietern nötig (Bucket im Pfad statt in der Adresse)." />
            </>
          ) : null}
          <Field label="Bucket" error={fe?.bucket}>
            <Input name="bucket" defaultValue={s3?.bucket ?? ""} autoComplete="off" className="font-mono text-sm" />
          </Field>
          <Field label="Access Key" error={fe?.accessKeyId}>
            <Input name="accessKeyId" defaultValue={s3?.accessKeyId ?? ""} autoComplete="off" spellCheck={false} className="font-mono text-sm" />
          </Field>
          <Field label="Secret Key" error={fe?.secretAccessKey} hint={s3?.hasSecret ? SECRET_HINT_S3 : "Wird verschlüsselt gespeichert und nie wieder angezeigt."}>
            <PasswordInput name="secretAccessKey" autoComplete="new-password" placeholder={s3?.hasSecret ? "••••••••" : ""} className="font-mono text-sm" />
          </Field>
          <Field label="Präfix (optional)" error={fe?.prefix} hint="Unterordner im Bucket, z.B. standchef. Praktisch, wenn der Bucket auch für anderes genutzt wird.">
            <Input name="prefix" defaultValue={s3?.prefix ?? ""} autoComplete="off" className="font-mono text-sm" />
          </Field>
        </Card>
      ) : null}

      {choice === "WEBDAV" ? (
        <Card className="space-y-3 p-4">
          <h3 className="font-semibold">Nextcloud / WebDAV</h3>
          <p className="text-sm text-ink-3">
            In der Nextcloud einen Ordner anlegen, z.B. «Standchef». Unter «Persönliche Einstellungen → Sicherheit» ein App-Passwort erstellen. Die WebDAV-Adresse steht in der Dateiansicht unten links unter «Dateien-Einstellungen».
          </p>
          <Field label="WebDAV-Adresse" error={fe?.url} hint="z.B. https://cloud.example.ch/remote.php/dav/files/verein/Standchef">
            <Input name="url" type="url" defaultValue={props.webdav?.url ?? ""} autoComplete="off" placeholder="https://" className="font-mono text-sm" />
          </Field>
          <Field label="Benutzername" error={fe?.username}>
            <Input name="username" defaultValue={props.webdav?.username ?? ""} autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="App-Passwort" error={fe?.password} hint={props.webdav?.hasPassword ? SECRET_HINT_DAV : "Bitte ein App-Passwort verwenden, nicht das normale Passwort."}>
            <PasswordInput name="password" autoComplete="new-password" placeholder={props.webdav?.hasPassword ? "••••••••" : ""} />
          </Field>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <h3 className="font-semibold">Grenzen</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Max. Grösse pro Datei (MB)" error={fe?.maxFileMb} hint={`1 bis ${props.hardMaxFileMb} MB`}>
            <Input name="maxFileMb" type="number" inputMode="numeric" min={1} max={props.hardMaxFileMb} defaultValue={String(props.maxFileMb)} />
          </Field>
          <Field label="Kontingent für den Verein (MB)" error={fe?.quotaMb} hint="Leer = unbegrenzt. Chat-Anhänge zählen mit.">
            <Input name="quotaMb" type="number" inputMode="numeric" min={1} defaultValue={props.quotaMb != null ? String(props.quotaMb) : ""} placeholder="unbegrenzt" />
          </Field>
        </div>
      </Card>

      {fe?.acknowledge ? (
        <Card className="border-warn p-4">
          <Switch name="acknowledge" label="Ich habe die bestehenden Dateien selbst übertragen" description="Sonst sind ältere Dateien nach dem Speichern nicht mehr abrufbar." />
        </Card>
      ) : null}

      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" name="intent" value="test" variant="secondary" disabled={pending} onClick={() => setIntent("test")} className="sm:flex-none" aria-busy={pending && intent === "test" ? true : undefined}>
          {pending && intent === "test" ? <><Spinner /> Teste…</> : "Verbindung testen"}
        </Button>
        <Button type="submit" name="intent" value="save" disabled={pending} onClick={() => setIntent("save")} className="sm:flex-none" aria-busy={pending && intent === "save" ? true : undefined}>
          {pending && intent === "save" ? <><Spinner /> Prüfe und speichere…</> : "Speichern"}
        </Button>
      </div>
      <p className="text-xs text-ink-3">Beim Speichern wird die Verbindung automatisch geprüft: Standchef schreibt eine kleine Testdatei, liest sie und löscht sie wieder.</p>

      {showOtherS3 || showOtherDav ? (
        <Card className="space-y-2 p-4">
          <h3 className="font-semibold">Weitere gespeicherte Zugangsdaten</h3>
          <p className="text-sm text-ink-3">Werden für ältere Dateien gebraucht, die noch dort liegen.</p>
          {showOtherS3 && props.s3 ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">S3: {props.s3.bucket} · {props.fileCounts.S3} Datei(en)</span>
              {props.fileCounts.S3 === 0 ? <Button type="button" variant="ghost" size="sm" className="min-h-11 text-danger" onClick={() => void forget("S3")}><Trash2 className="h-4 w-4" aria-hidden /> Entfernen</Button> : null}
            </div>
          ) : null}
          {showOtherDav && props.webdav ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">Nextcloud: {props.webdav.url} · {props.fileCounts.WEBDAV} Datei(en)</span>
              {props.fileCounts.WEBDAV === 0 ? <Button type="button" variant="ghost" size="sm" className="min-h-11 text-danger" onClick={() => void forget("WEBDAV")}><Trash2 className="h-4 w-4" aria-hidden /> Entfernen</Button> : null}
            </div>
          ) : null}
        </Card>
      ) : null}
    </form>
  );
}
