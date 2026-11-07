/**
 * Benachrichtigungstexte des Verbandsbereichs in DE/FR/IT. Eigene kleine Tabelle statt eines
 * Wörterbuchs in src/lib/i18n, weil der Verbandsbereich ausserhalb der Vereinssprache läuft
 * (Empfänger bekommen die Texte in ihrer eigenen Sprache, siehe actions.ts).
 */
import type { Locale } from "@/lib/i18n/locales";

export type AssociationNoticeKey = "joinRequested" | "approved" | "rejected" | "removed" | "clubLeft" | "adminAssigned";

type Vars = { association: string; club?: string };

/** Schmales geschütztes Leerzeichen für französische Guillemets. */
const NNBSP = " ";

const TEXTS: Record<Locale, Record<AssociationNoticeKey, (v: Vars) => { title: string; body: string }>> = {
  de: {
    joinRequested: (v) => ({ title: `Beitrittsanfrage für ${v.association}`, body: `Der Verein «${v.club}» möchte dem Verband beitreten. Bitte im Verbandsbereich freigeben oder ablehnen.` }),
    approved: (v) => ({ title: `${v.association}: Beitritt freigegeben`, body: `Der Verband sieht ab sofort die Kennzahlen von «${v.club}», denen ihr zugestimmt habt. Austreten könnt ihr jederzeit unter Einstellungen → Verband.` }),
    rejected: (v) => ({ title: `${v.association}: Anfrage abgelehnt`, body: `Die Beitrittsanfrage von «${v.club}» wurde vom Verband abgelehnt. Es werden keine Daten geteilt.` }),
    removed: (v) => ({ title: `${v.association}: Verbindung beendet`, body: `Der Verband hat die Verbindung mit «${v.club}» beendet. Es werden keine Daten mehr geteilt.` }),
    clubLeft: (v) => ({ title: `${v.association}: Verein ausgetreten`, body: `Der Verein «${v.club}» hat die Verbindung beendet. Seine Kennzahlen sind nicht mehr sichtbar.` }),
    adminAssigned: (v) => ({ title: `Zugang zu ${v.association}`, body: `Du hast Zugang zum Verbandsbereich von «${v.association}» erhalten. Du findest ihn unter Mehr → Verband.` }),
  },
  fr: {
    joinRequested: (v) => ({ title: `Demande d’adhésion pour ${v.association}`, body: `La société de tir «${NNBSP}${v.club}${NNBSP}» souhaite adhérer à l’association. Merci de l’accepter ou de la refuser dans l’espace association.` }),
    approved: (v) => ({ title: `${v.association}${NNBSP}: adhésion acceptée`, body: `L’association voit désormais les chiffres de «${NNBSP}${v.club}${NNBSP}» que vous avez autorisés. Vous pouvez vous retirer à tout moment sous Paramètres → Association.` }),
    rejected: (v) => ({ title: `${v.association}${NNBSP}: demande refusée`, body: `La demande d’adhésion de «${NNBSP}${v.club}${NNBSP}» a été refusée par l’association. Aucune donnée n’est partagée.` }),
    removed: (v) => ({ title: `${v.association}${NNBSP}: lien terminé`, body: `L’association a mis fin au lien avec «${NNBSP}${v.club}${NNBSP}». Plus aucune donnée n’est partagée.` }),
    clubLeft: (v) => ({ title: `${v.association}${NNBSP}: société retirée`, body: `La société de tir «${NNBSP}${v.club}${NNBSP}» a mis fin au lien. Ses chiffres ne sont plus visibles.` }),
    adminAssigned: (v) => ({ title: `Accès à ${v.association}`, body: `Tu as reçu l’accès à l’espace association de «${NNBSP}${v.association}${NNBSP}». Tu le trouves sous Plus → Association.` }),
  },
  it: {
    joinRequested: (v) => ({ title: `Richiesta di adesione per ${v.association}`, body: `La società di tiro «${v.club}» desidera aderire alla federazione. Approvala o rifiutala nell’area federazione.` }),
    approved: (v) => ({ title: `${v.association}: adesione approvata`, body: `Da subito la federazione vede le cifre di «${v.club}» che avete autorizzato. Potete ritirarvi in qualsiasi momento in Impostazioni → Federazione.` }),
    rejected: (v) => ({ title: `${v.association}: richiesta rifiutata`, body: `La richiesta di adesione di «${v.club}» è stata rifiutata dalla federazione. Nessun dato viene condiviso.` }),
    removed: (v) => ({ title: `${v.association}: collegamento terminato`, body: `La federazione ha terminato il collegamento con «${v.club}». Nessun dato viene più condiviso.` }),
    clubLeft: (v) => ({ title: `${v.association}: società ritirata`, body: `La società di tiro «${v.club}» ha terminato il collegamento. Le sue cifre non sono più visibili.` }),
    adminAssigned: (v) => ({ title: `Accesso a ${v.association}`, body: `Hai ricevuto l’accesso all’area federazione di «${v.association}». La trovi in Altro → Federazione.` }),
  },
};

export function associationNotice(locale: Locale, key: AssociationNoticeKey, vars: Vars) {
  return (TEXTS[locale] ?? TEXTS.de)[key](vars);
}
