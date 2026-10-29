/**
 * Texte der Mitgliederverwaltung, die in Mails oder Dokumenten in der Sprache des Empfängers
 * erscheinen können (Status, Haushaltsrechnung). Einladungs- und Passwort-Mails liegen bei der
 * Plattform (extra/platform.ts). Platzhalter: {name}, {count}.
 */
const de: Record<string, string> = {
  "members.status.ACTIVE": "Aktiv",
  "members.status.PASSIVE": "Passiv",
  "members.status.HONORARY": "Ehrenmitglied",
  "members.status.JUNIOR": "Jungschütze",
  "members.status.SUPPORTER": "Gönner",
  "members.status.LEFT": "Ausgetreten",
  "members.household.invoice": "{name} ({count} Mitglieder)",
  "members.household.payerNote": "Diese Rechnung umfasst die Beiträge aller Mitglieder deines Haushalts.",
  "members.left.noAccess": "Deine Mitgliedschaft in diesem Verein ist beendet. Bitte wende dich an den Vorstand.",
};

const fr: Record<string, string> = {
  "members.status.ACTIVE": "Actif",
  "members.status.PASSIVE": "Passif",
  "members.status.HONORARY": "Membre d’honneur",
  "members.status.JUNIOR": "Jeune tireur",
  "members.status.SUPPORTER": "Donateur",
  "members.status.LEFT": "Démissionnaire",
  "members.household.invoice": "{name} ({count} membres)",
  "members.household.payerNote": "Cette facture comprend les cotisations de tous les membres de ton ménage.",
  "members.left.noAccess": "Ton affiliation à cette société est terminée. Merci de t’adresser au comité.",
};

const it: Record<string, string> = {
  "members.status.ACTIVE": "Attivo",
  "members.status.PASSIVE": "Passivo",
  "members.status.HONORARY": "Membro onorario",
  "members.status.JUNIOR": "Giovane tiratore",
  "members.status.SUPPORTER": "Sostenitore",
  "members.status.LEFT": "Dimissionario",
  "members.household.invoice": "{name} ({count} membri)",
  "members.household.payerNote": "Questa fattura comprende le quote di tutti i membri della tua economia domestica.",
  "members.left.noAccess": "La tua affiliazione a questa società è terminata. Rivolgiti al comitato.",
};

const dict: { de: Record<string, string>; fr: Record<string, string>; it: Record<string, string> } = { de, fr, it };
export default dict;
