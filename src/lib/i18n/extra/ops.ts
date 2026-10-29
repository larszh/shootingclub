/** Mailtexte des Betriebs (Kontolöschung, Vereinslöschung). Platzhalter: {name}, {tenant}, {date}. */
const de: Record<string, string> = {
  "ops.accountDeleted.subject": "Dein Standchef-Konto wurde gelöscht",
  "ops.accountDeleted.title": "Konto gelöscht",
  "ops.accountDeleted.p1": "Wie gewünscht haben wir dein Standchef-Konto gelöscht. Name, E-Mail-Adresse, Telefon, Adresse und Profilbild sind entfernt; du kannst dich nicht mehr anmelden.",
  "ops.accountDeleted.p2": "Rechnungen, Buchungen und Resultate bleiben aus rechtlichen Gründen (Aufbewahrungspflicht von 10 Jahren) beim Verein, aber ohne deinen Namen.",
  "ops.accountDeleted.p3": "Warst du das nicht? Dann melde dich bitte umgehend bei deinem Verein.",

  "ops.tenantDeletion.subject": "Löschung von «{tenant}» geplant",
  "ops.tenantDeletion.title": "Verein wird gelöscht",
  "ops.tenantDeletion.p1": "Der Verein «{tenant}» wurde zur Löschung vorgemerkt und ist für Mitglieder nicht mehr erreichbar.",
  "ops.tenantDeletion.p2": "Am {date} werden alle Daten und Dateien endgültig gelöscht. Bis dahin kann der Verein über den Standchef-Support wiederhergestellt werden.",
};

const fr: Record<string, string> = {
  "ops.accountDeleted.subject": "Ton compte Standchef a été supprimé",
  "ops.accountDeleted.title": "Compte supprimé",
  "ops.accountDeleted.p1": "Comme demandé, nous avons supprimé ton compte Standchef. Nom, adresse e-mail, téléphone, adresse et photo de profil ont été effacés ; tu ne peux plus te connecter.",
  "ops.accountDeleted.p2": "Pour des raisons légales (obligation de conservation de 10 ans), les factures, réservations et résultats restent auprès de la société, mais sans ton nom.",
  "ops.accountDeleted.p3": "Ce n'était pas toi ? Contacte immédiatement ta société.",

  "ops.tenantDeletion.subject": "Suppression de «{tenant}» planifiée",
  "ops.tenantDeletion.title": "La société sera supprimée",
  "ops.tenantDeletion.p1": "La société «{tenant}» a été marquée pour suppression et n'est plus accessible aux membres.",
  "ops.tenantDeletion.p2": "Le {date}, toutes les données et tous les fichiers seront définitivement supprimés. D'ici là, la société peut être restaurée par le support Standchef.",
};

const it: Record<string, string> = {
  "ops.accountDeleted.subject": "Il tuo account Standchef è stato eliminato",
  "ops.accountDeleted.title": "Account eliminato",
  "ops.accountDeleted.p1": "Come richiesto, abbiamo eliminato il tuo account Standchef. Nome, indirizzo e-mail, telefono, indirizzo e foto del profilo sono stati rimossi; non puoi più accedere.",
  "ops.accountDeleted.p2": "Per motivi legali (obbligo di conservazione di 10 anni) fatture, prenotazioni e risultati restano presso la società, ma senza il tuo nome.",
  "ops.accountDeleted.p3": "Non sei stato tu? Contatta subito la tua società.",

  "ops.tenantDeletion.subject": "Eliminazione di «{tenant}» pianificata",
  "ops.tenantDeletion.title": "La società sarà eliminata",
  "ops.tenantDeletion.p1": "La società «{tenant}» è stata contrassegnata per l'eliminazione e non è più accessibile ai membri.",
  "ops.tenantDeletion.p2": "Il {date} tutti i dati e i file saranno eliminati definitivamente. Fino ad allora la società può essere ripristinata dal supporto Standchef.",
};

const dict: { de: Record<string, string>; fr: Record<string, string>; it: Record<string, string> } = { de, fr, it };
export default dict;
