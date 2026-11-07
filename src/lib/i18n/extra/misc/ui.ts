/**
 * Restpunkte Welle E (Teil von «misc»): Verwaltung der Anlässe und Mitteilungen, Scheiben anlegen,
 * Programm kopieren, Akzentfarben, Platzhalter-Namen. Aufbau pro Schlüssel [de, fr, it, en].
 */
type Row = readonly [de: string, fr: string, it: string, en: string];

const rows: Record<string, Row> = {
  // ---------------------------------------------------------------- Anlässe und Mitteilungen (Verwaltung)
  "misc.events.manageTitle": ["Anlässe verwalten", "Gérer les manifestations", "Gestire gli eventi", "Manage events"],
  "misc.events.new": ["Neu", "Nouveau", "Nuovo", "New"],
  "misc.events.edit": ["Bearbeiten", "Modifier", "Modifica", "Edit"],
  "misc.events.duplicate": ["Duplizieren", "Dupliquer", "Duplica", "Duplicate"],
  "misc.events.listCsv": ["Liste (CSV)", "Liste (CSV)", "Elenco (CSV)", "List (CSV)"],
  "misc.events.csvAria": ["Anmeldeliste als CSV", "Liste des inscriptions en CSV", "Elenco iscrizioni in CSV", "Registration list as CSV"],
  "misc.events.reinstate": ["Wieder ansetzen", "Rétablir", "Ripristina", "Reinstate"],
  "misc.events.cancel": ["Absagen", "Annuler", "Annulla", "Cancel event"],
  "misc.events.cancelTitle": ["Anlass absagen?", "Annuler la manifestation ?", "Annullare l’evento?", "Cancel this event?"],
  "misc.events.cancelText": ["Er bleibt sichtbar und wird als «Abgesagt» markiert.", "Elle reste visible et est marquée «Annulée».", "Resta visibile e viene segnato come «Annullato».", "It stays visible and is marked as “Cancelled”."],
  "misc.events.delete": ["Löschen", "Supprimer", "Elimina", "Delete"],
  "misc.events.deleteTitle": ["Anlass endgültig löschen?", "Supprimer définitivement la manifestation ?", "Eliminare definitivamente l’evento?", "Delete this event permanently?"],
  "misc.events.deleteText": ["Alle An- und Abmeldungen gehen verloren.", "Toutes les inscriptions et désinscriptions seront perdues.", "Tutte le iscrizioni e disdette andranno perse.", "All registrations and sign-offs will be lost."],
  "misc.events.back": ["Zurück", "Retour", "Indietro", "Back"],
  "misc.events.pin": ["Anheften", "Épingler", "Fissa in alto", "Pin"],
  "misc.events.unpin": ["Nicht mehr anheften", "Ne plus épingler", "Non fissare più", "Unpin"],
  "misc.events.annDeleteTitle": ["Mitteilung löschen?", "Supprimer la communication ?", "Eliminare la comunicazione?", "Delete announcement?"],
  "misc.events.counts": ["{yes} dabei · {maybe} vielleicht · {no} abgemeldet", "{yes} présents · {maybe} peut-être · {no} excusés", "{yes} presenti · {maybe} forse · {no} assenti", "{yes} going · {maybe} maybe · {no} not going"],
  "misc.events.seriesCreated": ["{n} Anlässe erstellt.", "{n} manifestations créées.", "{n} eventi creati.", "{n} events created."],
  "misc.events.upcoming": ["Kommende ({n})", "À venir ({n})", "In arrivo ({n})", "Upcoming ({n})"],
  "misc.events.noUpcoming": ["Keine kommenden Anlässe", "Aucune manifestation à venir", "Nessun evento in arrivo", "No upcoming events"],
  "misc.events.noUpcomingText": ["Erfasse einen Anlass oder eine ganze Serie, z.B. jeden Dienstag Training bis zu den Sommerferien.", "Saisis une manifestation ou toute une série, p. ex. un entraînement chaque mardi jusqu’aux vacances d’été.", "Registra un evento o un’intera serie, p. es. allenamento ogni martedì fino alle vacanze estive.", "Add an event or a whole series, e.g. training every Tuesday until the summer holidays."],
  "misc.events.create": ["Anlass erfassen", "Saisir une manifestation", "Registra evento", "Add event"],
  "misc.events.all": ["Alle", "Toutes", "Tutti", "All"],
  "misc.events.past": ["Vergangene", "Passées", "Passati", "Past"],
  "misc.events.feed": ["Kalender-Abo", "Abonnement au calendrier", "Abbonamento al calendario", "Calendar subscription"],
  "misc.events.feedTitle": ["Öffentlicher Kalender-Link", "Lien public du calendrier", "Link pubblico del calendario", "Public calendar link"],
  "misc.events.feedText": ["Für Mitglieder, die den Vereinskalender abonnieren. Erzeuge einen neuen Link, falls der alte in falsche Hände geraten ist.", "Pour les membres qui s’abonnent au calendrier de la société. Crée un nouveau lien si l’ancien est tombé entre de mauvaises mains.", "Per i soci che si abbonano al calendario della società. Crea un nuovo link se quello vecchio è finito in mani sbagliate.", "For members who subscribe to the club calendar. Create a new link if the old one has fallen into the wrong hands."],
  "misc.events.feedRenew": ["Link erneuern", "Renouveler le lien", "Rinnova il link", "Renew link"],
  "misc.events.announcements": ["Mitteilungen", "Communications", "Comunicazioni", "Announcements"],
  "misc.events.announcementsSub": ["Infos an alle Mitglieder, sichtbar unter «Anlässe» und auf der Startseite.", "Infos pour tous les membres, visibles sous «Manifestations» et sur la page d’accueil.", "Informazioni per tutti i soci, visibili in «Eventi» e sulla pagina iniziale.", "Information for all members, visible under “Events” and on the home page."],
  "misc.events.annSaved": ["Mitteilung gespeichert.", "Communication enregistrée.", "Comunicazione salvata.", "Announcement saved."],
  "misc.events.noAnn": ["Noch keine Mitteilungen", "Pas encore de communications", "Ancora nessuna comunicazione", "No announcements yet"],
  "misc.events.noAnnText": ["Informiere alle über Neuigkeiten, geänderte Öffnungszeiten oder wichtige Termine.", "Informe tout le monde des nouveautés, d’horaires modifiés ou de dates importantes.", "Informa tutti su novità, orari modificati o date importanti.", "Let everyone know about news, changed opening hours or important dates."],
  "misc.events.annWrite": ["Mitteilung schreiben", "Rédiger une communication", "Scrivi una comunicazione", "Write announcement"],
  "misc.events.annNew": ["Neue Mitteilung", "Nouvelle communication", "Nuova comunicazione", "New announcement"],
  "misc.events.annEdit": ["Mitteilung bearbeiten", "Modifier la communication", "Modifica comunicazione", "Edit announcement"],
  "misc.events.newTitle": ["Neuer Anlass", "Nouvelle manifestation", "Nuovo evento", "New event"],
  "misc.events.newSub": ["Training, Wettkampf, Versammlung oder Arbeitseinsatz", "Entraînement, concours, assemblée ou corvée", "Allenamento, gara, assemblea o lavoro comune", "Training, competition, meeting or work session"],
  "misc.events.copyTitle": ["Anlass duplizieren", "Dupliquer la manifestation", "Duplica evento", "Duplicate event"],
  "misc.events.copySub": ["Kopie von «{title}», eine Woche später. Passe Datum und Details an.", "Copie de «{title}», une semaine plus tard. Adapte la date et les détails.", "Copia di «{title}», una settimana dopo. Adatta data e dettagli.", "Copy of “{title}”, one week later. Adjust the date and details."],
  "misc.events.editTitle": ["Anlass bearbeiten", "Modifier la manifestation", "Modifica evento", "Edit event"],

  // ---------------------------------------------------------------- Scheiben anlegen / bearbeiten
  "misc.targets.newMeta": ["Neue Scheibe", "Nouvelle cible", "Nuovo bersaglio", "New target"],
  "misc.targets.newOwn": ["Eigene Scheibe", "Cible personnelle", "Bersaglio personale", "Own target"],
  "misc.targets.newOwnSub": ["Generieren oder eigenes Sujet hochladen", "Générer ou téléverser un motif personnel", "Genera o carica un soggetto personale", "Generate or upload your own design"],
  "misc.targets.newTenant": ["Vereinsscheibe anlegen", "Créer une cible de la société", "Crea bersaglio della società", "Create club target"],
  "misc.targets.newTenantSub": ["Für alle Mitglieder sichtbar", "Visible pour tous les membres", "Visibile a tutti i soci", "Visible to all members"],
  "misc.targets.edit": ["Scheibe bearbeiten", "Modifier la cible", "Modifica bersaglio", "Edit target"],

  // ---------------------------------------------------------------- Programm kopieren
  "misc.program.copyToClub": ["Als Vereinsprogramm kopieren", "Copier comme programme de la société", "Copia come programma della società", "Copy as club programme"],
  "misc.program.hideOriginal": ["Original im Verein verstecken", "Masquer l’original dans la société", "Nascondi l’originale nella società", "Hide the original in the club"],

  // ---------------------------------------------------------------- Akzentfarben (BRAND_PRESETS, Schlüssel = Farbwert ohne #)
  "misc.brand.color.d6232d": ["Rot", "Rouge", "Rosso", "Red"],
  "misc.brand.color.8f1d21": ["Dunkelrot", "Rouge foncé", "Rosso scuro", "Dark red"],
  "misc.brand.color.1d64c8": ["Blau", "Bleu", "Blu", "Blue"],
  "misc.brand.color.1b2f5e": ["Dunkelblau", "Bleu foncé", "Blu scuro", "Dark blue"],
  "misc.brand.color.2a8a3e": ["Grün", "Vert", "Verde", "Green"],
  "misc.brand.color.1f4d33": ["Tannengrün", "Vert sapin", "Verde abete", "Fir green"],
  "misc.brand.color.1c1c1c": ["Schwarz", "Noir", "Nero", "Black"],
  "misc.brand.color.c99a2e": ["Gold", "Or", "Oro", "Gold"],
  "misc.brand.color.e8731c": ["Orange", "Orange", "Arancione", "Orange"],
  "misc.brand.color.6b3fa0": ["Violett", "Violet", "Viola", "Purple"],
  "misc.brand.color.0f6b73": ["Petrol", "Pétrole", "Petrolio", "Petrol"],
  "misc.brand.color.5d646c": ["Grau", "Gris", "Grigio", "Grey"],

  // ---------------------------------------------------------------- Platzhalter-Namen (displayUserName)
  "misc.user.deleted": ["Gelöschtes Mitglied", "Membre supprimé", "Membro eliminato", "Deleted member"],
  "misc.user.former": ["Ehemaliges Mitglied", "Ancien membre", "Ex socio", "Former member"],
  "misc.user.guest": ["Gast", "Invité", "Ospite", "Guest"],
};

export default rows;
