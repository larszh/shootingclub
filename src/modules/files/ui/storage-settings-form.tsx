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
import { useT } from "@/components/locale";

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

/** Speicherorte; Titel und Text unter adm1.files.opt.<value>.title / .text */
const OPTIONS: Array<{ value: StorageChoice; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "LOCAL", icon: HardDrive },
  { value: "S3_HETZNER", icon: Cloud },
  { value: "S3_AWS", icon: Cloud },
  { value: "S3_COMPAT", icon: Server },
  { value: "WEBDAV", icon: Cloud },
];

export function StorageSettingsForm(props: Props) {
  const router = useRouter();
  const t = useT();
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
    const okd = await confirmDialog({ title: t("adm1.files.forgetTitle"), message: t("adm1.files.forgetMessage"), tone: "danger", confirmLabel: t("adm1.files.remove") });
    if (!okd) return;
    const r = await forgetStorageCredentialsAction(which);
    if (r.ok) {
      toast.success(r.message ?? t("adm1.files.removed"));
      router.refresh();
    } else toast.error(r.error);
  }

  return (
    <form onSubmit={submitKeepingValues(formAction)} className="space-y-4">
      {props.credentialsBroken ? (
        <Alert tone="warn" title={t("adm1.files.brokenTitle")}>
          {t("adm1.files.brokenText")}
        </Alert>
      ) : null}

      <Card className="p-4">
        <fieldset>
          <legend className="mb-1 font-semibold">{t("adm1.files.where")}</legend>
          <p className="mb-3 text-sm text-ink-3">{t("adm1.files.whereHint")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {OPTIONS.map((o) => {
              const on = choice === o.value;
              const Icon = o.icon;
              return (
                <label key={o.value} className={cn("press flex min-h-16 cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors", on ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2")}>
                  <input type="radio" name="choice" value={o.value} checked={on} onChange={() => setChoice(o.value)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Icon className="h-4 w-4 text-ink-3" aria-hidden /> {t(`adm1.files.opt.${o.value}.title`)}
                      {props.activeChoice === o.value ? <Badge tone="ok" className="ml-1">{t("adm1.files.active")}</Badge> : null}
                    </span>
                    <span className="block text-sm text-ink-3">{t(`adm1.files.opt.${o.value}.text`)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </Card>

      {choice === "LOCAL" ? (
        <Card className="p-4 text-sm text-ink-2">
          <p>{t("adm1.files.localText")}</p>
        </Card>
      ) : null}

      {choice.startsWith("S3_") ? (
        <Card key={choice} className="space-y-3 p-4">
          <h3 className="font-semibold">{t(`adm1.files.opt.${choice}.title`)}</h3>
          {choice === "S3_HETZNER" ? (
            <>
              <p className="text-sm text-ink-3">{t("adm1.files.hetznerHelp")}</p>
              <Field label={t("adm1.files.location")} error={fe?.hetznerRegion} hint={`Endpoint: ${hetznerEndpoint(hetznerRegion)}`}>
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
              <p className="text-sm text-ink-3">{t("adm1.files.awsHelp")}</p>
              <Field label={t("adm1.files.region")} error={fe?.region} hint={t("adm1.files.awsRegionHint")}>
                <Input name="region" defaultValue={s3Same("AWS")?.region ?? "eu-central-2"} autoComplete="off" className="font-mono text-sm" />
              </Field>
            </>
          ) : null}
          {choice === "S3_COMPAT" ? (
            <>
              <p className="text-sm text-ink-3">{t("adm1.files.compatHelp")}</p>
              <Field label="Endpoint" error={fe?.endpoint} hint={t("adm1.files.endpointHint")}>
                <Input name="endpoint" type="url" defaultValue={s3Same("COMPAT")?.endpoint ?? ""} autoComplete="off" placeholder="https://" className="font-mono text-sm" />
              </Field>
              <Field label={t("adm1.files.region")} error={fe?.region} hint={t("adm1.files.regionOptional")}>
                <Input name="region" defaultValue={s3Same("COMPAT")?.region ?? ""} autoComplete="off" placeholder="us-east-1" className="font-mono text-sm" />
              </Field>
              <Switch name="forcePathStyle" defaultChecked={s3Same("COMPAT")?.forcePathStyle ?? true} label={t("adm1.files.pathStyle")} description={t("adm1.files.pathStyleHint")} />
            </>
          ) : null}
          <Field label="Bucket" error={fe?.bucket}>
            <Input name="bucket" defaultValue={s3?.bucket ?? ""} autoComplete="off" className="font-mono text-sm" />
          </Field>
          <Field label="Access Key" error={fe?.accessKeyId}>
            <Input name="accessKeyId" defaultValue={s3?.accessKeyId ?? ""} autoComplete="off" spellCheck={false} className="font-mono text-sm" />
          </Field>
          <Field label="Secret Key" error={fe?.secretAccessKey} hint={s3?.hasSecret ? t("adm1.files.secretHintS3") : t("adm1.files.secretNew")}>
            <PasswordInput name="secretAccessKey" autoComplete="new-password" placeholder={s3?.hasSecret ? "••••••••" : ""} className="font-mono text-sm" />
          </Field>
          <Field label={t("adm1.files.prefix")} error={fe?.prefix} hint={t("adm1.files.prefixHint")}>
            <Input name="prefix" defaultValue={s3?.prefix ?? ""} autoComplete="off" className="font-mono text-sm" />
          </Field>
        </Card>
      ) : null}

      {choice === "WEBDAV" ? (
        <Card className="space-y-3 p-4">
          <h3 className="font-semibold">Nextcloud / WebDAV</h3>
          <p className="text-sm text-ink-3">
            {t("adm1.files.davHelp")}
          </p>
          <Field label={t("adm1.files.davUrl")} error={fe?.url} hint={t("adm1.files.davUrlHint")}>
            <Input name="url" type="url" defaultValue={props.webdav?.url ?? ""} autoComplete="off" placeholder="https://" className="font-mono text-sm" />
          </Field>
          <Field label={t("adm1.files.username")} error={fe?.username}>
            <Input name="username" defaultValue={props.webdav?.username ?? ""} autoComplete="off" spellCheck={false} />
          </Field>
          <Field label={t("adm1.files.appPassword")} error={fe?.password} hint={props.webdav?.hasPassword ? t("adm1.files.secretHintDav") : t("adm1.files.appPasswordHint")}>
            <PasswordInput name="password" autoComplete="new-password" placeholder={props.webdav?.hasPassword ? "••••••••" : ""} />
          </Field>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <h3 className="font-semibold">{t("adm1.files.limits")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("adm1.files.maxFile")} error={fe?.maxFileMb} hint={t("adm1.files.maxFileHint", { max: props.hardMaxFileMb })}>
            <Input name="maxFileMb" type="number" inputMode="numeric" min={1} max={props.hardMaxFileMb} defaultValue={String(props.maxFileMb)} />
          </Field>
          <Field label={t("adm1.files.quota")} error={fe?.quotaMb} hint={t("adm1.files.quotaHint")}>
            <Input name="quotaMb" type="number" inputMode="numeric" min={1} defaultValue={props.quotaMb != null ? String(props.quotaMb) : ""} placeholder={t("adm1.files.unlimited")} />
          </Field>
        </div>
      </Card>

      {fe?.acknowledge ? (
        <Card className="border-warn p-4">
          <Switch name="acknowledge" label={t("adm1.files.ack")} description={t("adm1.files.ackHint")} />
        </Card>
      ) : null}

      {state && !state.ok ? <Alert>{state.error}</Alert> : state?.ok && state.message ? <Alert tone="ok">{state.message}</Alert> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" name="intent" value="test" variant="secondary" disabled={pending} onClick={() => setIntent("test")} className="sm:flex-none" aria-busy={pending && intent === "test" ? true : undefined}>
          {pending && intent === "test" ? <><Spinner /> {t("adm1.files.testing")}</> : t("adm1.files.test")}
        </Button>
        <Button type="submit" name="intent" value="save" disabled={pending} onClick={() => setIntent("save")} className="sm:flex-none" aria-busy={pending && intent === "save" ? true : undefined}>
          {pending && intent === "save" ? <><Spinner /> {t("adm1.files.checkingSaving")}</> : t("adm1.common.save")}
        </Button>
      </div>
      <p className="text-xs text-ink-3">{t("adm1.files.saveNote")}</p>

      {showOtherS3 || showOtherDav ? (
        <Card className="space-y-2 p-4">
          <h3 className="font-semibold">{t("adm1.files.otherCreds")}</h3>
          <p className="text-sm text-ink-3">{t("adm1.files.otherCredsHint")}</p>
          {showOtherS3 && props.s3 ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">S3: {props.s3.bucket} · {t(props.fileCounts.S3 === 1 ? "adm1.files.count.one" : "adm1.files.count.other", { n: props.fileCounts.S3 })}</span>
              {props.fileCounts.S3 === 0 ? <Button type="button" variant="ghost" size="sm" className="min-h-11 text-danger" onClick={() => void forget("S3")}><Trash2 className="h-4 w-4" aria-hidden /> {t("adm1.files.remove")}</Button> : null}
            </div>
          ) : null}
          {showOtherDav && props.webdav ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">Nextcloud: {props.webdav.url} · {t(props.fileCounts.WEBDAV === 1 ? "adm1.files.count.one" : "adm1.files.count.other", { n: props.fileCounts.WEBDAV })}</span>
              {props.fileCounts.WEBDAV === 0 ? <Button type="button" variant="ghost" size="sm" className="min-h-11 text-danger" onClick={() => void forget("WEBDAV")}><Trash2 className="h-4 w-4" aria-hidden /> {t("adm1.files.remove")}</Button> : null}
            </div>
          ) : null}
        </Card>
      ) : null}
    </form>
  );
}
