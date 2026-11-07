/**
 * Zusatz-Wörterbuch «aicontent» (Welle E): Inhalte mit Claude – Übersetzen von Anlässen,
 * Mitteilungen und Standordnung, Schreibhilfe im Editor, Jahresbericht (/admin/reports).
 * Französisch: normale Leerzeichen bei « » ? ! ; : – frenchSpacing() setzt die geschützten.
 */
import { frenchSpacing } from "./shell";

type Row = readonly [de: string, fr: string, it: string, en: string];

const ROWS: Record<string, Row> = {
  "aicontent.back": ["Verwaltung", "Administration", "Amministrazione", "Administration"],
  "aicontent.retryIn": ["Bitte in {s} Sekunden nochmals versuchen.", "Réessaie dans {s} secondes.", "Riprova tra {s} secondi.", "Please try again in {s} seconds."],

  // Fehler
  "aicontent.err.invalid": ["Ungültige Anfrage.", "Requête invalide.", "Richiesta non valida.", "Invalid request."],
  "aicontent.err.noPermission": ["Dafür fehlt dir die Berechtigung.", "Tu n’as pas l’autorisation nécessaire.", "Non hai l’autorizzazione necessaria.", "You do not have permission to do this."],
  "aicontent.err.notFound": ["Inhalt nicht gefunden.", "Contenu introuvable.", "Contenuto non trovato.", "Content not found."],
  "aicontent.err.changed": [
    "Der Originaltext wurde inzwischen geändert. Bitte neu übersetzen.",
    "Le texte original a été modifié entre-temps. Merci de le retraduire.",
    "Il testo originale è stato modificato nel frattempo. Traducilo di nuovo.",
    "The original text has changed in the meantime. Please translate it again.",
  ],
  "aicontent.err.empty": ["Bitte alle Felder ausfüllen.", "Merci de remplir tous les champs.", "Compila tutti i campi.", "Please fill in all fields."],

  // Felder
  "aicontent.field.title": ["Titel", "Titre", "Titolo", "Title"],
  "aicontent.field.description": ["Beschreibung", "Description", "Descrizione", "Description"],
  "aicontent.field.body": ["Text", "Texte", "Testo", "Text"],
  "aicontent.field.rulesBody": ["Standordnung", "Règlement du stand", "Regolamento del poligono", "Range rules"],

  // Übersetzungen im Editor
  "aicontent.tr.title": ["Übersetzungen", "Traductions", "Traduzioni", "Translations"],
  "aicontent.tr.rulesDraftTitle": ["Übersetzungen Entwurf v{n}", "Traductions du projet v{n}", "Traduzioni bozza v{n}", "Translations of draft v{n}"],
  "aicontent.tr.rulesActiveTitle": ["Übersetzungen gültige Version v{n}", "Traductions de la version en vigueur v{n}", "Traduzioni versione in vigore v{n}", "Translations of current version v{n}"],
  "aicontent.tr.intro": [
    "Original: {lang}. Übersetzt wird die gespeicherte Fassung. Mitglieder sehen die Übersetzung in ihrer Sprache, solange sie zum Original passt.",
    "Original : {lang}. La version enregistrée est traduite. Les membres voient la traduction dans leur langue tant qu’elle correspond à l’original.",
    "Originale: {lang}. Viene tradotta la versione salvata. I soci vedono la traduzione nella loro lingua finché corrisponde all’originale.",
    "Original: {lang}. The saved version is translated. Members see the translation in their language as long as it matches the original.",
  ],
  "aicontent.tr.button": ["Übersetzen ({targets})", "Traduire ({targets})", "Tradurre ({targets})", "Translate ({targets})"],
  "aicontent.tr.translating": ["Claude übersetzt …", "Claude traduit …", "Claude sta traducendo …", "Claude is translating …"],
  "aicontent.tr.proposalsReady": [
    "Übersetzung bereit. Bitte prüfen und veröffentlichen.",
    "Traduction prête. Merci de la vérifier et de la publier.",
    "Traduzione pronta. Controllala e pubblicala.",
    "Translation ready. Please review and publish it.",
  ],
  "aicontent.tr.allFresh": ["Alle Übersetzungen sind aktuell.", "Toutes les traductions sont à jour.", "Tutte le traduzioni sono aggiornate.", "All translations are up to date."],
  "aicontent.tr.status.proposal": ["Neu, nicht veröffentlicht", "Nouveau, non publié", "Nuovo, non pubblicato", "New, not published"],
  "aicontent.tr.status.fresh": ["Automatisch, aktuell", "Automatique, à jour", "Automatica, aggiornata", "Automatic, up to date"],
  "aicontent.tr.status.reviewed": ["Geprüft, aktuell", "Vérifiée, à jour", "Verificata, aggiornata", "Reviewed, up to date"],
  "aicontent.tr.status.stale": ["Veraltet", "Obsolète", "Superata", "Out of date"],
  "aicontent.tr.status.partial": ["Unvollständig", "Incomplète", "Incompleta", "Incomplete"],
  "aicontent.tr.status.missing": ["Keine", "Aucune", "Nessuna", "None"],
  "aicontent.tr.staleHint": [
    "Das Original wurde seither geändert. Mitglieder sehen bis zur Aktualisierung das Original.",
    "L’original a été modifié depuis. Les membres voient l’original jusqu’à la mise à jour.",
    "L’originale è stato modificato nel frattempo. Fino all’aggiornamento i soci vedono l’originale.",
    "The original has changed since. Members see the original until the translation is updated.",
  ],
  "aicontent.tr.proposalHint": [
    "Vorschlag von Claude. Prüfe Namen, Zeiten und Fachbegriffe, bevor du veröffentlichst.",
    "Proposition de Claude. Vérifie les noms, les heures et les termes techniques avant de publier.",
    "Proposta di Claude. Controlla nomi, orari e termini tecnici prima di pubblicare.",
    "Suggestion by Claude. Check names, times and technical terms before publishing.",
  ],
  "aicontent.tr.showSource": ["Original anzeigen", "Afficher l’original", "Mostra l’originale", "Show original"],
  "aicontent.tr.publish": ["Veröffentlichen", "Publier", "Pubblica", "Publish"],
  "aicontent.tr.publishAll": ["Alle {n} veröffentlichen", "Publier les {n}", "Pubblica tutte e {n}", "Publish all {n}"],
  "aicontent.tr.saveEdit": ["Als aktuell speichern", "Enregistrer comme à jour", "Salva come aggiornata", "Save as up to date"],
  "aicontent.tr.retranslate": ["Neu übersetzen", "Retraduire", "Traduci di nuovo", "Translate again"],
  "aicontent.tr.discard": ["Verwerfen", "Rejeter", "Scarta", "Discard"],
  "aicontent.tr.remove": ["Entfernen", "Supprimer", "Rimuovi", "Remove"],
  "aicontent.tr.removeQ": ["Übersetzung {lang} entfernen?", "Supprimer la traduction {lang} ?", "Rimuovere la traduzione {lang}?", "Remove the {lang} translation?"],
  "aicontent.tr.removeText": [
    "Mitglieder mit dieser Sprache sehen danach das Original.",
    "Les membres de cette langue verront ensuite l’original.",
    "I soci con questa lingua vedranno poi l’originale.",
    "Members using this language will then see the original.",
  ],
  "aicontent.tr.saved": ["Übersetzung veröffentlicht.", "Traduction publiée.", "Traduzione pubblicata.", "Translation published."],
  "aicontent.tr.savedAll": ["{n} Übersetzungen veröffentlicht.", "{n} traductions publiées.", "{n} traduzioni pubblicate.", "{n} translations published."],
  "aicontent.tr.removed": ["Übersetzung entfernt.", "Traduction supprimée.", "Traduzione rimossa.", "Translation removed."],
  "aicontent.tr.footer": [
    "Die Übersetzung erstellt Claude mit dem API-Schlüssel des Vereins. Der Text wird dafür an Anthropic übermittelt.",
    "La traduction est faite par Claude avec la clé API de la société. Le texte est transmis à Anthropic à cet effet.",
    "La traduzione è creata da Claude con la chiave API della società. A tale scopo il testo viene trasmesso ad Anthropic.",
    "Claude creates the translation with the club’s API key. The text is sent to Anthropic for this.",
  ],

  // Anzeige für Mitglieder
  "aicontent.view.auto": ["Automatisch übersetzt", "Traduit automatiquement", "Tradotto automaticamente", "Automatically translated"],
  "aicontent.view.translated": ["Übersetzt", "Traduit", "Tradotto", "Translated"],
  "aicontent.view.original": ["Original ({lang})", "Original ({lang})", "Originale ({lang})", "Original ({lang})"],
  "aicontent.view.showOriginal": ["Original anzeigen", "Afficher l’original", "Mostra l’originale", "Show original"],
  "aicontent.view.showTranslation": ["Übersetzung anzeigen", "Afficher la traduction", "Mostra la traduzione", "Show translation"],
  "aicontent.view.rulesBinding": [
    "Verbindlich ist das Original der Standordnung.",
    "Seul l’original du règlement du stand fait foi.",
    "Fa fede solo l’originale del regolamento del poligono.",
    "Only the original version of the range rules is binding.",
  ],

  // Schreibhilfe
  "aicontent.write.title": ["Mit Claude entwerfen", "Rédiger avec Claude", "Scrivere con Claude", "Draft with Claude"],
  "aicontent.write.subtitle": [
    "Entwurf aus Stichworten oder Text verbessern",
    "Brouillon à partir de mots-clés ou améliorer le texte",
    "Bozza da parole chiave o migliorare il testo",
    "Draft from bullet points or improve the text",
  ],
  "aicontent.write.mode": ["Schreibhilfe", "Aide à la rédaction", "Aiuto alla scrittura", "Writing assistant"],
  "aicontent.write.modeDraft": ["Entwerfen", "Rédiger", "Bozza", "Draft"],
  "aicontent.write.modeImprove": ["Text verbessern", "Améliorer le texte", "Migliorare il testo", "Improve text"],
  "aicontent.write.notes": ["Stichworte", "Mots-clés", "Parole chiave", "Bullet points"],
  "aicontent.write.notesHint": [
    "Was, wann, wo, wer – Claude erfindet keine Angaben.",
    "Quoi, quand, où, qui – Claude n’invente aucune information.",
    "Cosa, quando, dove, chi – Claude non inventa informazioni.",
    "What, when, where, who – Claude does not invent any details.",
  ],
  "aicontent.write.notesPhEvent": [
    "z.B. Endschiessen, Programm 300 m, danach Absenden mit Nachtessen, Anmeldung bis 1. Oktober",
    "p. ex. tir de clôture, programme 300 m, ensuite proclamation des résultats avec souper, inscription jusqu’au 1er octobre",
    "p. es. tiro di chiusura, programma 300 m, poi premiazione con cena, iscrizione entro il 1° ottobre",
    "e.g. end-of-season shoot, 300 m programme, prize-giving dinner afterwards, register by 1 October",
  ],
  "aicontent.write.notesPhNews": [
    "z.B. Stand im Dezember geschlossen, Training wieder ab 10. Januar, Munition im Schützenhaus abholen",
    "p. ex. stand fermé en décembre, entraînements dès le 10 janvier, retirer les munitions au stand",
    "p. es. poligono chiuso a dicembre, allenamenti dal 10 gennaio, ritirare le munizioni al poligono",
    "e.g. range closed in December, training again from 10 January, collect ammunition at the clubhouse",
  ],
  "aicontent.write.tone": ["Ton", "Ton", "Tono", "Tone"],
  "aicontent.write.tone.factual": ["Sachlich", "Factuel", "Oggettivo", "Factual"],
  "aicontent.write.tone.friendly": ["Freundlich", "Amical", "Cordiale", "Friendly"],
  "aicontent.write.tone.short": ["Kurz", "Court", "Breve", "Short"],
  "aicontent.write.improveHint": [
    "Claude korrigiert Rechtschreibung und Zeichensetzung, macht den Text klarer und schreibt Schweizer Rechtschreibung (ss). Inhalt und Angaben bleiben gleich.",
    "Claude corrige l’orthographe et la ponctuation et rend le texte plus clair. Le contenu et les informations restent les mêmes.",
    "Claude corregge ortografia e punteggiatura e rende il testo più chiaro. Contenuto e indicazioni restano invariati.",
    "Claude corrects spelling and punctuation and makes the text clearer. Content and details stay the same.",
  ],
  "aicontent.write.notesMissing": ["Bitte zuerst ein paar Stichworte eingeben.", "Merci de saisir d’abord quelques mots-clés.", "Inserisci prima qualche parola chiave.", "Please enter a few bullet points first."],
  "aicontent.write.textMissing": ["Bitte zuerst einen Text eingeben.", "Merci de saisir d’abord un texte.", "Inserisci prima un testo.", "Please enter a text first."],
  "aicontent.write.runDraft": ["Entwurf erstellen", "Créer un brouillon", "Crea bozza", "Create draft"],
  "aicontent.write.runImprove": ["Text verbessern", "Améliorer le texte", "Migliora il testo", "Improve text"],
  "aicontent.write.working": ["Claude schreibt …", "Claude rédige …", "Claude sta scrivendo …", "Claude is writing …"],
  "aicontent.write.preview": ["Vorschlag", "Proposition", "Proposta", "Suggestion"],
  "aicontent.write.changes": ["Geändert", "Modifications", "Modifiche", "Changes"],
  "aicontent.write.noChanges": ["Keine Änderungen nötig.", "Aucune modification nécessaire.", "Nessuna modifica necessaria.", "No changes needed."],
  "aicontent.write.accept": ["Übernehmen", "Reprendre", "Applica", "Use this"],
  "aicontent.write.discard": ["Verwerfen", "Rejeter", "Scarta", "Discard"],
  "aicontent.write.applied": [
    "Ins Formular übernommen. Prüfen und speichern.",
    "Repris dans le formulaire. Vérifie puis enregistre.",
    "Inserito nel modulo. Controlla e salva.",
    "Added to the form. Check it and save.",
  ],
  "aicontent.write.checkNote": [
    "Nichts wird automatisch veröffentlicht. Prüfe Angaben wie Datum, Zeit und Ort vor dem Speichern.",
    "Rien n’est publié automatiquement. Vérifie la date, l’heure et le lieu avant d’enregistrer.",
    "Nulla viene pubblicato automaticamente. Controlla data, ora e luogo prima di salvare.",
    "Nothing is published automatically. Check details such as date, time and place before saving.",
  ],
  "aicontent.write.privacy": [
    "Der Text wird mit dem API-Schlüssel des Vereins an Anthropic (Claude) übermittelt. Keine Personendaten eingeben.",
    "Le texte est transmis à Anthropic (Claude) avec la clé API de la société. Ne saisis pas de données personnelles.",
    "Il testo viene trasmesso ad Anthropic (Claude) con la chiave API della società. Non inserire dati personali.",
    "The text is sent to Anthropic (Claude) using the club’s API key. Do not enter personal data.",
  ],

  // Jahresbericht
  "aicontent.report.metaTitle": ["Jahresbericht", "Rapport annuel", "Rapporto annuale", "Annual report"],
  "aicontent.report.title": ["Jahresbericht", "Rapport annuel", "Rapporto annuale", "Annual report"],
  "aicontent.report.defaultTitle": ["Jahresbericht {year}", "Rapport annuel {year}", "Rapporto annuale {year}", "Annual report {year}"],
  "aicontent.report.yearLabel": ["Jahr wählen", "Choisir l’année", "Scegli l’anno", "Choose year"],
  "aicontent.report.numbersNote": [
    "Alle Zahlen berechnet die App aus den Daten des Vereins. An Claude gehen nur diese Zahlen – keine Namen und keine Personendaten.",
    "Tous les chiffres sont calculés par l’application à partir des données de la société. Seuls ces chiffres sont transmis à Claude – aucun nom ni donnée personnelle.",
    "Tutte le cifre sono calcolate dall’app con i dati della società. A Claude vengono trasmesse solo queste cifre – nessun nome né dato personale.",
    "The app calculates all figures from the club’s data. Only these figures are sent to Claude – no names and no personal data.",
  ],
  "aicontent.report.figures": ["Zahlen {year}", "Chiffres {year}", "Cifre {year}", "Figures {year}"],
  "aicontent.report.textTitle": ["Berichtstext", "Texte du rapport", "Testo del rapporto", "Report text"],
  "aicontent.report.draftTitle": ["Entwurf mit Claude", "Brouillon avec Claude", "Bozza con Claude", "Draft with Claude"],
  "aicontent.report.draftIntro": [
    "Claude schreibt aus den Zahlen einen Entwurf in der Vereinssprache. Du kannst ihn danach bearbeiten, kopieren und drucken.",
    "Claude rédige un brouillon à partir des chiffres dans la langue de la société. Tu peux ensuite le modifier, le copier et l’imprimer.",
    "Claude scrive una bozza dalle cifre nella lingua della società. Puoi poi modificarla, copiarla e stamparla.",
    "Claude writes a draft from the figures in the club language. You can then edit, copy and print it.",
  ],
  "aicontent.report.generate": ["Entwurf {year} erstellen", "Créer le brouillon {year}", "Crea bozza {year}", "Create {year} draft"],
  "aicontent.report.generating": ["Claude schreibt den Bericht …", "Claude rédige le rapport …", "Claude sta scrivendo il rapporto …", "Claude is writing the report …"],
  "aicontent.report.regen": ["Neu entwerfen", "Nouveau brouillon", "Nuova bozza", "Draft again"],
  "aicontent.report.regenQ": ["Neuen Entwurf erstellen?", "Créer un nouveau brouillon ?", "Creare una nuova bozza?", "Create a new draft?"],
  "aicontent.report.regenText": [
    "Der bisherige Entwurf und deine Änderungen werden ersetzt.",
    "Le brouillon actuel et tes modifications seront remplacés.",
    "La bozza attuale e le tue modifiche saranno sostituite.",
    "The current draft and your changes will be replaced.",
  ],
  "aicontent.report.ready": ["Entwurf erstellt. Bitte prüfen.", "Brouillon créé. Merci de le vérifier.", "Bozza creata. Controllala.", "Draft created. Please check it."],
  "aicontent.report.stale": [
    "Die Zahlen haben sich seit diesem Entwurf geändert. Prüfe den Text oder entwirf ihn neu.",
    "Les chiffres ont changé depuis ce brouillon. Vérifie le texte ou crée un nouveau brouillon.",
    "Le cifre sono cambiate da questa bozza. Controlla il testo o crea una nuova bozza.",
    "The figures have changed since this draft. Check the text or draft it again.",
  ],
  "aicontent.report.checkNote": [
    "Entwurf von Claude: Die Zahlen stammen aus der App, der Text muss vor der GV geprüft werden.",
    "Brouillon de Claude : les chiffres proviennent de l’application, le texte doit être vérifié avant l’AG.",
    "Bozza di Claude: le cifre provengono dall’app, il testo va controllato prima dell’AG.",
    "Draft by Claude: the figures come from the app; the text must be checked before the general meeting.",
  ],
  "aicontent.report.titleLabel": ["Titel", "Titre", "Titolo", "Title"],
  "aicontent.report.heading": ["Abschnitt", "Section", "Sezione", "Section"],
  "aicontent.report.body": ["Text", "Texte", "Testo", "Text"],
  "aicontent.report.removeSection": ["Abschnitt entfernen", "Supprimer la section", "Rimuovi sezione", "Remove section"],
  "aicontent.report.addSection": ["Abschnitt hinzufügen", "Ajouter une section", "Aggiungi sezione", "Add section"],
  "aicontent.report.save": ["Zwischenspeichern", "Enregistrer", "Salva", "Save"],
  "aicontent.report.saved": ["Entwurf gespeichert.", "Brouillon enregistré.", "Bozza salvata.", "Draft saved."],
  "aicontent.report.copy": ["Kopieren", "Copier", "Copia", "Copy"],
  "aicontent.report.copied": ["Bericht kopiert.", "Rapport copié.", "Rapporto copiato.", "Report copied."],
  "aicontent.report.copyFailed": ["Kopieren nicht möglich.", "Copie impossible.", "Copia non riuscita.", "Copying failed."],
  "aicontent.report.print": ["Drucken", "Imprimer", "Stampa", "Print"],
  "aicontent.report.popupBlocked": [
    "Das Druckfenster wurde blockiert. Bitte Pop-ups erlauben.",
    "La fenêtre d’impression a été bloquée. Merci d’autoriser les fenêtres pop-up.",
    "La finestra di stampa è stata bloccata. Consenti i pop-up.",
    "The print window was blocked. Please allow pop-ups.",
  ],
  "aicontent.report.unsaved": ["Ungespeicherte Änderungen.", "Modifications non enregistrées.", "Modifiche non salvate.", "Unsaved changes."],
  "aicontent.report.storedNote": [
    "Der Entwurf bleibt 60 Tage gespeichert.",
    "Le brouillon reste enregistré 60 jours.",
    "La bozza resta salvata per 60 giorni.",
    "The draft is kept for 60 days.",
  ],
  "aicontent.report.honoursHeading": ["Ehrungen Jahresmeisterschaft", "Distinctions du championnat annuel", "Premiazioni del campionato annuale", "Annual championship honours"],
  "aicontent.report.aiOff": [
    "Für einen Textentwurf mit Claude den KI-Assistenten unter Verwaltung › KI-Assistent einschalten.",
    "Pour un brouillon avec Claude, active l’assistant IA sous Administration › Assistant IA.",
    "Per una bozza con Claude attiva l’assistente IA in Amministrazione › Assistente IA.",
    "To draft the text with Claude, switch on the AI assistant under Administration › AI assistant.",
  ],

  // Zahlen
  "aicontent.fig.membersEnd": ["Mitglieder Ende Jahr", "Membres en fin d’année", "Soci a fine anno", "Members at year end"],
  "aicontent.fig.joined": ["Eintritte", "Admissions", "Ammissioni", "Joined"],
  "aicontent.fig.left": ["Austritte", "Démissions", "Dimissioni", "Left"],
  "aicontent.fig.juniors": ["Junioren (bis 20)", "Juniors (jusqu’à 20 ans)", "Juniori (fino a 20 anni)", "Juniors (up to 20)"],
  "aicontent.fig.events": ["Anlässe", "Événements", "Eventi", "Events"],
  "aicontent.fig.eventsHeld": ["Durchgeführt", "Organisés", "Svolti", "Held"],
  "aicontent.fig.eventsCancelled": ["Abgesagt", "Annulés", "Annullati", "Cancelled"],
  "aicontent.fig.registrations": ["Anmeldungen (inkl. Begleitung)", "Inscriptions (accompagnants compris)", "Iscrizioni (accompagnatori inclusi)", "Registrations (incl. guests)"],
  "aicontent.fig.bookings": ["Reservationen", "Réservations", "Prenotazioni", "Bookings"],
  "aicontent.fig.bookingsConfirmed": ["Bestätigt", "Confirmées", "Confermate", "Confirmed"],
  "aicontent.fig.bookingsPersons": ["Personen", "Personnes", "Persone", "People"],
  "aicontent.fig.bookingsCancelled": ["Storniert", "Annulées", "Annullate", "Cancelled"],
  "aicontent.fig.federal": ["Bundesübungen", "Tirs fédéraux", "Tiri federali", "Federal programmes"],
  "aicontent.fig.opShooters": ["Obligatorisch: Schützen", "Tir obligatoire : tireurs", "Tiro obbligatorio: tiratori", "Obligatory programme: shooters"],
  "aicontent.fig.opPassed": ["Obligatorisch: bestanden", "Tir obligatoire : réussi", "Tiro obbligatorio: superato", "Obligatory programme: passed"],
  "aicontent.fig.opRemaining": ["Obligatorisch: verblieben", "Tir obligatoire : restés", "Tiro obbligatorio: rimasti", "Obligatory programme: not passed"],
  "aicontent.fig.opRate": ["Bestehensquote", "Taux de réussite", "Tasso di superamento", "Pass rate"],
  "aicontent.fig.fsParticipants": ["Feldschiessen: Teilnehmende", "Tir en campagne : participants", "Tiro in campagna: partecipanti", "Field shooting: participants"],
  "aicontent.fig.championships": ["Jahresmeisterschaft", "Championnat annuel", "Campionato annuale", "Annual championship"],
  "aicontent.fig.classified": ["{n} klassiert", "{n} classés", "{n} classificati", "{n} ranked"],
  "aicontent.fig.noChampionship": [
    "Keine veröffentlichte Meisterschaft in diesem Jahr.",
    "Aucun championnat publié cette année.",
    "Nessun campionato pubblicato quest’anno.",
    "No published championship this year.",
  ],
  "aicontent.fig.finance": ["Erträge (Buchhaltung)", "Produits (comptabilité)", "Ricavi (contabilità)", "Revenue (accounting)"],
  "aicontent.fig.invoiced": ["Verrechnet", "Facturé", "Fatturato", "Invoiced"],
  "aicontent.fig.received": ["Bezahlt", "Payé", "Pagato", "Received"],
  "aicontent.fig.total": ["Total", "Total", "Totale", "Total"],
  "aicontent.fig.financeNote": [
    "Nur Erträge, die über die App laufen (Beiträge, Reservationen, Munition, Schützenstube). Ausgaben und die Jahresrechnung kennt die App nicht.",
    "Uniquement les produits passant par l’application (cotisations, réservations, munitions, buvette). L’application ne connaît ni les charges ni les comptes annuels.",
    "Solo i ricavi che passano dall’app (quote, prenotazioni, munizioni, buvette). L’app non conosce le spese né il conto annuale.",
    "Only revenue handled in the app (fees, bookings, ammunition, kiosk). The app does not know expenses or the annual accounts.",
  ],
  "aicontent.fin.fee": ["Mitgliederbeiträge", "Cotisations", "Quote sociali", "Membership fees"],
  "aicontent.fin.workfee": ["Ersatzabgabe Arbeitsstunden", "Taxe de remplacement heures de travail", "Tassa sostitutiva ore di lavoro", "Work hours substitute fee"],
  "aicontent.fin.booking": ["Reservationen", "Réservations", "Prenotazioni", "Bookings"],
  "aicontent.fin.ammo": ["Munition", "Munitions", "Munizioni", "Ammunition"],
  "aicontent.fin.kiosk": ["Schützenstube", "Buvette", "Buvette", "Kiosk"],
  "aicontent.status.ACTIVE": ["Aktivmitglieder", "Membres actifs", "Soci attivi", "Active members"],
  "aicontent.status.PASSIVE": ["Passivmitglieder", "Membres passifs", "Soci passivi", "Passive members"],
  "aicontent.status.HONORARY": ["Ehrenmitglieder", "Membres d’honneur", "Soci onorari", "Honorary members"],
  "aicontent.status.JUNIOR": ["Jungschützen/Junioren", "Jeunes tireurs/juniors", "Giovani tiratori/juniori", "Young shooters/juniors"],
  "aicontent.status.SUPPORTER": ["Gönner", "Donateurs", "Sostenitori", "Supporters"],
};

const de: Record<string, string> = {};
const fr: Record<string, string> = {};
const it: Record<string, string> = {};
const en: Record<string, string> = {};
for (const [key, [d, f, i, e]] of Object.entries(ROWS)) {
  de[key] = d;
  fr[key] = frenchSpacing(f);
  it[key] = i;
  en[key] = e;
}

const dict: { de: Record<string, string>; fr: Record<string, string>; it: Record<string, string>; en: Record<string, string> } = { de, fr, it, en };

export default dict;
