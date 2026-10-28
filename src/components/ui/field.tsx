"use client";

import { Children, cloneElement, isValidElement, useEffect, useId, useRef } from "react";

const CONTROL_SELECTOR = "input:not([type=hidden]), select, textarea";

type ControlProps = { id?: string; name?: string; "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false" };

/**
 * Formularfeld mit Beschriftung, Hinweis und Fehlermeldung.
 * Das Label wird mit dem Eingabefeld verknüpft (htmlFor/id), Hinweis bzw. Fehler über
 * aria-describedby. Ist das Kind direkt ein Feld (Input, Select, Textarea, PasswordInput …),
 * bekommt es die id schon beim Rendern; sonst wird das erste Feld im Inhalt nachträglich verknüpft.
 */
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  const base = useId();
  const labelId = `${base}-label`;
  const descId = `${base}-desc`;
  const hasDesc = Boolean(error || hint);
  const ref = useRef<HTMLDivElement>(null);

  // Direktes Kind ist ein Feld → id und aria-Attribute gleich beim Rendern setzen.
  const only = Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  let controlId = `${base}-control`;
  let content = children;
  if (isValidElement<ControlProps>(only)) {
    const isHost = typeof only.type === "string";
    const isControl = isHost ? ["input", "select", "textarea"].includes(only.type as string) : only.props.name !== undefined;
    if (isControl) {
      if (only.props.id) controlId = only.props.id;
      const describedBy = [only.props["aria-describedby"], hasDesc ? descId : null].filter(Boolean).join(" ") || undefined;
      content = cloneElement(only, {
        id: controlId,
        "aria-describedby": describedBy,
        ...(error ? { "aria-invalid": true } : {}),
      });
    }
  }

  // Rückfall für verschachtelte Inhalte (z.B. Feld + Knopf in einer Zeile): erstes Feld verknüpfen.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (root.querySelector(`[id="${CSS.escape(controlId)}"]`)?.matches(CONTROL_SELECTOR)) return;
    const control = Array.from(root.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)).find((el) => !el.closest("label"));
    if (control) {
      if (!control.id) control.id = controlId;
      else if (!control.hasAttribute("aria-label") && !control.hasAttribute("aria-labelledby")) control.setAttribute("aria-labelledby", labelId);
      const desc = control.getAttribute("aria-describedby")?.split(" ").filter((d) => d && d !== descId) ?? [];
      if (hasDesc) desc.push(descId);
      if (desc.length) control.setAttribute("aria-describedby", desc.join(" "));
      else control.removeAttribute("aria-describedby");
      if (error) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
      return;
    }
    // Keine Eingabe gefunden (z.B. Auswahl-Knöpfe): Gruppe benennen.
    const group = root.querySelector<HTMLElement>("[role=radiogroup], [role=group], [role=listbox]");
    if (group && !group.hasAttribute("aria-label") && !group.hasAttribute("aria-labelledby")) group.setAttribute("aria-labelledby", labelId);
  });

  return (
    <div ref={ref} className={className}>
      <label id={labelId} htmlFor={controlId} className="block text-sm font-medium text-ink-2 mb-1.5">
        {label}
      </label>
      {content}
      {error ? (
        <p id={descId} role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="mt-1 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
