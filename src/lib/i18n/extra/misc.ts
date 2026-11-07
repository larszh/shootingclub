/**
 * Zusatz-Wörterbuch «misc» (Welle E): kleinere Restpunkte, alle Schlüssel mit Präfix «misc.».
 * - misc.file.*    Fehlermeldungen beim Hochladen (Chat-Anhänge, Dokumente)
 * - misc.chat.*    Meldungen der Chat-Upload-Schnittstelle
 * - misc.share.*   Gemeinsame Anlagen mit Partnervereinen (Freigaben, Gastbuchungen)
 * - misc.booking.* Bestätigung nach abgeschlossener Online-Zahlung
 * - misc.weapon.*  Waffenkategorie für Feldschiessen-Auszeichnungen
 *
 * Aufbau pro Schlüssel [de, fr, it, en]. Französisch wird mit normalen Leerzeichen erfasst;
 * frenchSpacing() setzt die geschützten Leerzeichen (Guillemets, vor ? ! ; und :).
 * Platzhalter {name} usw. sind in allen Sprachen identisch.
 */
import uiRows from "./misc/ui";

type Row = readonly [de: string, fr: string, it: string, en: string];

function frenchSpacing(s: string): string {
  return s
    .replace(/«[   ]?/g, "« ")
    .replace(/[   ]?»/g, " »")
    .replace(/ :(?=\s|$)/g, " :")
    .replace(/ ([?!;])/g, " $1");
}

const ROWS: Record<string, Row> = {
  ...uiRows,
  // ---------------------------------------------------------------- Navigation Welle E (Claude, Übersetzungen)
  "misc.nav.superTranslations": ["Übersetzungen", "Traductions", "Traduzioni", "Translations"],
  "misc.nav.superAi": ["Claude (KI)", "Claude (IA)", "Claude (IA)", "Claude (AI)"],
  "misc.nav.superSupport": ["Support-Assistent", "Assistant de support", "Assistente di supporto", "Support assistant"],
  "misc.nav.adminAi": ["Claude", "Claude", "Claude", "Claude"],
  "misc.nav.adminAiHint": ["KI-Funktionen, Schlüssel, Verbrauch", "Fonctions IA, clé, consommation", "Funzioni IA, chiave, consumo", "AI features, key, usage"],
  "misc.nav.adminReports": ["Jahresbericht", "Rapport annuel", "Rapporto annuale", "Annual report"],
  "misc.nav.adminReportsHint": ["Zahlen des Jahres, Entwurf mit Claude", "Chiffres de l’année, brouillon avec Claude", "Cifre dell’anno, bozza con Claude", "Figures for the year, draft with Claude"],
  // ---------------------------------------------------------------- Dateien
  "misc.file.generic": [
    "Die Datei konnte nicht verarbeitet werden. Bitte nochmals versuchen.",
    "Le fichier n’a pas pu être traité. Merci de réessayer.",
    "Non è stato possibile elaborare il file. Riprova.",
    "The file could not be processed. Please try again.",
  ],
  "misc.file.invalidRequest": ["Ungültige Anfrage.", "Requête non valable.", "Richiesta non valida.", "Invalid request."],
  "misc.file.noFile": ["Keine Datei erhalten.", "Aucun fichier reçu.", "Nessun file ricevuto.", "No file received."],
  "misc.file.unreadable": [
    "Die Datei konnte nicht gelesen werden. Bitte nochmals versuchen.",
    "Le fichier n’a pas pu être lu. Merci de réessayer.",
    "Non è stato possibile leggere il file. Riprova.",
    "The file could not be read. Please try again.",
  ],
  "misc.file.empty": ["Die Datei ist leer.", "Le fichier est vide.", "Il file è vuoto.", "The file is empty."],
  "misc.file.tooBigMax": [
    "Die Datei ist zu gross. Erlaubt sind höchstens {max} MB pro Datei.",
    "Le fichier est trop volumineux. {max} Mo au maximum par fichier.",
    "Il file è troppo grande. Sono ammessi al massimo {max} MB per file.",
    "The file is too large. The maximum is {max} MB per file.",
  ],
  "misc.file.tooBig": [
    "Die Datei ist zu gross ({size}). Erlaubt sind höchstens {max} MB pro Datei.",
    "Le fichier est trop volumineux ({size}). {max} Mo au maximum par fichier.",
    "Il file è troppo grande ({size}). Sono ammessi al massimo {max} MB per file.",
    "The file is too large ({size}). The maximum is {max} MB per file.",
  ],
  "misc.file.quotaFull": [
    "Der Speicherplatz des Vereins ist voll ({used} von {quota} MB belegt). Bitte alte Dateien löschen oder das Kontingent erhöhen.",
    "L’espace de stockage de la société est plein ({used} sur {quota} Mo utilisés). Merci de supprimer d’anciens fichiers ou d’augmenter le quota.",
    "Lo spazio di archiviazione della società è pieno ({used} di {quota} MB occupati). Elimina file vecchi o aumenta il contingente.",
    "The club’s storage is full ({used} of {quota} MB used). Please delete old files or increase the quota.",
  ],
  "misc.file.quotaLow": [
    "Nicht genug Speicherplatz frei: Die Datei braucht {size}, frei sind noch {free} (von {quota} MB). Bitte alte Dateien löschen oder das Kontingent erhöhen.",
    "Espace de stockage insuffisant : le fichier nécessite {size}, il reste {free} (sur {quota} Mo). Merci de supprimer d’anciens fichiers ou d’augmenter le quota.",
    "Spazio di archiviazione insufficiente: il file richiede {size}, restano {free} (di {quota} MB). Elimina file vecchi o aumenta il contingente.",
    "Not enough storage space: the file needs {size}, {free} is still free (of {quota} MB). Please delete old files or increase the quota.",
  ],
  "misc.file.folderGone": ["Der Ordner existiert nicht mehr.", "Le dossier n’existe plus.", "La cartella non esiste più.", "The folder no longer exists."],
  "misc.file.badOrigin": ["Ungültige Herkunft der Anfrage.", "Origine de la requête non valable.", "Origine della richiesta non valida.", "Invalid request origin."],
  "misc.file.notSignedIn": ["Bitte zuerst anmelden.", "Merci de vous connecter d’abord.", "Effettua prima l’accesso.", "Please sign in first."],
  "misc.file.noClub": ["Kein Verein ausgewählt.", "Aucune société sélectionnée.", "Nessuna società selezionata.", "No club selected."],
  "misc.file.moduleOff": [
    "Die Dateiablage ist für diesen Verein nicht aktiv.",
    "Le classement de fichiers n’est pas activé pour cette société.",
    "L’archivio file non è attivo per questa società.",
    "File storage is not enabled for this club.",
  ],
  "misc.file.noRight": ["Du darfst keine Dateien hochladen.", "Tu n’as pas le droit de téléverser des fichiers.", "Non puoi caricare file.", "You are not allowed to upload files."],
  "misc.file.clubChanged": [
    "Du hast inzwischen den Verein gewechselt. Bitte Seite neu laden.",
    "Tu as changé de société entre-temps. Merci de recharger la page.",
    "Nel frattempo hai cambiato società. Ricarica la pagina.",
    "You have switched clubs in the meantime. Please reload the page.",
  ],
  "misc.file.storage.NOT_CONFIGURED": [
    "Die Dateiablage des Vereins ist nicht vollständig eingerichtet. Bitte die Verwaltung informieren.",
    "Le stockage de fichiers de la société n’est pas entièrement configuré. Merci d’en informer l’administration.",
    "L’archivio file della società non è configurato completamente. Informa l’amministrazione.",
    "The club’s file storage is not fully set up. Please let the club admins know.",
  ],
  "misc.file.storage.NOT_FOUND": [
    "Die Datei wurde im Speicher nicht gefunden.",
    "Le fichier est introuvable dans le stockage.",
    "Il file non è stato trovato nell’archivio.",
    "The file was not found in storage.",
  ],
  "misc.file.storage.AUTH": [
    "Der Speicher hat den Zugriff verweigert. Bitte die Verwaltung informieren.",
    "Le stockage a refusé l’accès. Merci d’en informer l’administration.",
    "L’archivio ha negato l’accesso. Informa l’amministrazione.",
    "The storage denied access. Please let the club admins know.",
  ],
  "misc.file.storage.NETWORK": [
    "Der Speicher ist zurzeit nicht erreichbar. Bitte später nochmals versuchen.",
    "Le stockage est momentanément inaccessible. Merci de réessayer plus tard.",
    "L’archivio non è raggiungibile al momento. Riprova più tardi.",
    "The storage cannot be reached right now. Please try again later.",
  ],

  // ---------------------------------------------------------------- Chat-Upload
  "misc.chat.badOrigin": ["Ungültige Herkunft", "Origine non valable", "Origine non valida", "Invalid origin"],
  "misc.chat.notSignedIn": ["Nicht angemeldet", "Non connecté", "Non connesso", "Not signed in"],
  "misc.chat.conversationGone": [
    "Diese Unterhaltung ist nicht mehr verfügbar.",
    "Cette conversation n’est plus disponible.",
    "Questa conversazione non è più disponibile.",
    "This conversation is no longer available.",
  ],
  "misc.chat.invalidClientId": ["Ungültige Nachrichten-ID.", "Identifiant de message non valable.", "ID del messaggio non valido.", "Invalid message ID."],
  "misc.chat.invalidMessage": ["Ungültige Nachricht", "Message non valable", "Messaggio non valido", "Invalid message"],
  "misc.chat.chooseFile": ["Bitte eine Datei wählen.", "Merci de choisir un fichier.", "Scegli un file.", "Please choose a file."],
  "misc.chat.attachment": ["Anhang", "Pièce jointe", "Allegato", "Attachment"],

  // ---------------------------------------------------------------- Gemeinsame Anlagen
  "misc.share.v.partner": [
    "Bitte Kurzname oder Beitrittscode des Partnervereins angeben.",
    "Merci d’indiquer le nom court ou le code d’adhésion de la société partenaire.",
    "Indica il nome breve o il codice d’adesione della società partner.",
    "Please enter the short name or join code of the partner club.",
  ],
  "misc.share.v.factorInt": [
    "Preisfaktor als ganze Zahl in Prozent",
    "Facteur de prix en pour cent, nombre entier",
    "Fattore di prezzo in percento, numero intero",
    "Price factor as a whole number in per cent",
  ],
  "misc.share.v.factorMin": ["Mindestens {min} %", "Au moins {min} %", "Almeno {min} %", "At least {min} %"],
  "misc.share.v.factorMax": ["Höchstens {max} %", "Au maximum {max} %", "Al massimo {max} %", "At most {max} %"],
  "misc.share.v.invalid": ["Ungültige Eingabe", "Saisie non valable", "Inserimento non valido", "Invalid input"],
  "misc.share.resourceNotFound": ["Ressource nicht gefunden.", "Ressource introuvable.", "Risorsa non trovata.", "Resource not found."],
  "misc.share.partnerFormat": [
    "Bitte den Kurznamen (z.B. sg-musterhausen) oder den Beitrittscode des Partnervereins angeben.",
    "Merci d’indiquer le nom court (p. ex. sg-musterhausen) ou le code d’adhésion de la société partenaire.",
    "Indica il nome breve (p. es. sg-musterhausen) o il codice d’adesione della società partner.",
    "Please enter the short name (e.g. sg-musterhausen) or the join code of the partner club.",
  ],
  "misc.share.partnerNotFound": [
    "Kein Verein mit diesem Kurznamen oder Beitrittscode gefunden.",
    "Aucune société trouvée avec ce nom court ou ce code d’adhésion.",
    "Nessuna società trovata con questo nome breve o codice d’adesione.",
    "No club found with this short name or join code.",
  ],
  "misc.share.ownClub": [
    "Die Anlage gehört bereits deinem Verein.",
    "L’installation appartient déjà à ta société.",
    "L’impianto appartiene già alla tua società.",
    "The facility already belongs to your club.",
  ],
  "misc.share.updated": ["Freigabe für {partner} aktualisiert.", "Partage avec {partner} mis à jour.", "Condivisione con {partner} aggiornata.", "Sharing with {partner} updated."],
  "misc.share.shared": ["Mit {partner} geteilt.", "Partagé avec {partner}.", "Condiviso con {partner}.", "Shared with {partner}."],
  "misc.share.moduleHint": [
    " Hinweis: Bei {partner} ist das Modul «Reservationen» noch aus; die Mitglieder können erst buchen, wenn der Verein es einschaltet.",
    " Remarque : chez {partner}, le module « Réservations » est encore désactivé ; les membres pourront réserver dès que la société l’active.",
    " Nota: presso {partner} il modulo «Prenotazioni» è ancora disattivato; i soci potranno prenotare solo quando la società lo attiva.",
    " Note: the “Bookings” module is still switched off at {partner}; its members can book once the club switches it on.",
  ],
  "misc.share.notFound": ["Nicht gefunden", "Introuvable", "Non trovato", "Not found"],
  "misc.share.resumed": ["Buchungen wieder erlaubt.", "Réservations à nouveau autorisées.", "Prenotazioni di nuovo consentite.", "Bookings allowed again."],
  "misc.share.paused": ["Buchungen pausiert.", "Réservations suspendues.", "Prenotazioni sospese.", "Bookings paused."],
  "misc.share.removed": ["Freigabe entfernt.", "Partage supprimé.", "Condivisione rimossa.", "Sharing removed."],
  "misc.share.rateSuffix": [" (Tarif {percent} %)", " (tarif {percent} %)", " (tariffa {percent} %)", " (rate {percent} %)"],
  "misc.share.notify.created.title": ["Neue gemeinsame Anlage", "Nouvelle installation partagée", "Nuovo impianto condiviso", "New shared facility"],
  "misc.share.notify.created.moduleOff": [
    "{owner} teilt «{resource}» mit eurem Verein. Aktiviert zuerst unter «Verein» das Modul «Reservationen», dann können eure Mitglieder sie buchen{rate}.",
    "{owner} partage « {resource} » avec votre société. Activez d’abord le module « Réservations » sous « Société », ensuite vos membres pourront la réserver{rate}.",
    "{owner} condivide «{resource}» con la vostra società. Attivate prima il modulo «Prenotazioni» sotto «Società», poi i vostri soci potranno prenotarlo{rate}.",
    "{owner} is sharing “{resource}” with your club. First switch on the “Bookings” module under “Club”, then your members can book it{rate}.",
  ],
  "misc.share.notify.created.bookable": [
    "{owner} teilt «{resource}» mit eurem Verein. Eure Mitglieder können sie unter «Reservationen» buchen{rate}.",
    "{owner} partage « {resource} » avec votre société. Vos membres peuvent la réserver sous « Réservations »{rate}.",
    "{owner} condivide «{resource}» con la vostra società. I vostri soci possono prenotarlo sotto «Prenotazioni»{rate}.",
    "{owner} is sharing “{resource}” with your club. Your members can book it under “Bookings”{rate}.",
  ],
  "misc.share.notify.created.paused": [
    "{owner} teilt «{resource}» mit eurem Verein{rate}.",
    "{owner} partage « {resource} » avec votre société{rate}.",
    "{owner} condivide «{resource}» con la vostra società{rate}.",
    "{owner} is sharing “{resource}” with your club{rate}.",
  ],
  "misc.share.notify.revoked.title": ["Gemeinsame Anlage beendet", "Fin du partage de l’installation", "Condivisione dell’impianto terminata", "Shared facility ended"],
  "misc.share.notify.revoked.body": [
    "{owner} teilt «{resource}» nicht mehr mit eurem Verein. Bestehende Reservationen bleiben gültig.",
    "{owner} ne partage plus « {resource} » avec votre société. Les réservations existantes restent valables.",
    "{owner} non condivide più «{resource}» con la vostra società. Le prenotazioni esistenti restano valide.",
    "{owner} no longer shares “{resource}” with your club. Existing bookings remain valid.",
  ],
  "misc.share.err.notShared": [
    "Diese Anlage ist für deinen Verein nicht freigegeben.",
    "Cette installation n’est pas partagée avec ta société.",
    "Questo impianto non è condiviso con la tua società.",
    "This facility is not shared with your club.",
  ],
  "misc.share.err.paused": [
    "Der Eigentümer hat Buchungen für deinen Verein pausiert.",
    "Le propriétaire a suspendu les réservations pour ta société.",
    "Il proprietario ha sospeso le prenotazioni per la tua società.",
    "The owner has paused bookings for your club.",
  ],
  "misc.share.err.ownerClosed": [
    "Der Verein dieser Anlage nimmt zurzeit keine Reservationen an.",
    "La société de cette installation n’accepte actuellement pas de réservations.",
    "La società di questo impianto al momento non accetta prenotazioni.",
    "The club that owns this facility is not taking bookings at the moment.",
  ],
  "misc.share.err.resourceUnavailable": ["Ressource nicht verfügbar.", "Ressource non disponible.", "Risorsa non disponibile.", "Resource not available."],
  "misc.share.err.ended": ["Buchung ist bereits beendet.", "La réservation est déjà terminée.", "La prenotazione è già conclusa.", "Booking has already ended."],
  "misc.share.err.cancelDeadline": [
    "Stornierung nur bis {hours} Stunden vor Beginn möglich.",
    "Annulation possible uniquement jusqu’à {hours} heures avant le début.",
    "Annullamento possibile solo fino a {hours} ore prima dell’inizio.",
    "Cancellation is only possible up to {hours} hours before the start.",
  ],
  "misc.share.err.incomplete": [
    "Bitte Ressource, Datum, Zeit, Dauer und Anzahl Personen wählen.",
    "Merci de choisir la ressource, la date, l’heure, la durée et le nombre de personnes.",
    "Scegli risorsa, data, ora, durata e numero di persone.",
    "Please choose resource, date, time, duration and number of people.",
  ],
  "misc.share.err.noInvoice": [
    "{owner} bietet für Partnervereine keine Bezahlung auf Rechnung an. Bitte direkt beim Verein reservieren.",
    "{owner} ne propose pas le paiement sur facture aux sociétés partenaires. Merci de réserver directement auprès de la société.",
    "{owner} non offre il pagamento con fattura alle società partner. Prenota direttamente presso la società.",
    "{owner} does not offer payment by invoice to partner clubs. Please book directly with the club.",
  ],
  "misc.share.rateLabel": ["Partnertarif {percent} %", "Tarif partenaire {percent} %", "Tariffa partner {percent} %", "Partner rate {percent} %"],
  "misc.share.ownerBadge": ["Anlage von {club}", "Installation de {club}", "Impianto di {club}", "Facility of {club}"],
  "misc.share.partnerBadge": ["Partner: {name}", "Partenaire : {name}", "Partner: {name}", "Partner: {name}"],
  "misc.share.partnerClub": ["Partnerverein", "Société partenaire", "Società partner", "Partner club"],
  "misc.share.partnerDeleted": ["Partnerverein (gelöscht)", "Société partenaire (supprimée)", "Società partner (eliminata)", "Partner club (deleted)"],

  // Formular «Mit Partnerverein teilen» und Liste der Freigaben
  "misc.share.form.partner": ["Partnerverein", "Société partenaire", "Società partner", "Partner club"],
  "misc.share.form.partnerHint": [
    "Kurzname (z.B. sg-musterhausen) oder Beitrittscode des Vereins. Ihr erhaltet ihn vom Vorstand des Partnervereins.",
    "Nom court (p. ex. sg-musterhausen) ou code d’adhésion de la société. Vous l’obtenez auprès du comité de la société partenaire.",
    "Nome breve (p. es. sg-musterhausen) o codice d’adesione della società. Lo ricevete dal comitato della società partner.",
    "Short name (e.g. sg-musterhausen) or join code of the club. You get it from the partner club’s committee.",
  ],
  "misc.share.form.partnerPlaceholder": ["Kurzname oder Beitrittscode", "Nom court ou code d’adhésion", "Nome breve o codice d’adesione", "Short name or join code"],
  "misc.share.form.factor": ["Preisfaktor in %", "Facteur de prix en %", "Fattore di prezzo in %", "Price factor in %"],
  "misc.share.form.factorHint": [
    "100 = gleiche Preise wie eigene Mitglieder, 120 = 20 % Zuschlag, 0 = gratis.",
    "100 = mêmes prix que pour vos membres, 120 = supplément de 20 %, 0 = gratuit.",
    "100 = stessi prezzi dei propri soci, 120 = supplemento del 20 %, 0 = gratuito.",
    "100 = same prices as your own members, 120 = 20 % surcharge, 0 = free.",
  ],
  "misc.share.form.note": ["Notiz (optional)", "Note (facultatif)", "Nota (facoltativa)", "Note (optional)"],
  "misc.share.form.noteHint": [
    "Für die Mitglieder des Partnervereins sichtbar, z.B. «Schlüssel beim Standwart».",
    "Visible pour les membres de la société partenaire, p. ex. « Clé chez le gérant du stand ».",
    "Visibile ai soci della società partner, p. es. «Chiave presso il gerente dello stand».",
    "Visible to the partner club’s members, e.g. “Key with the range warden”.",
  ],
  "misc.share.form.canBook": ["Mitglieder dürfen buchen", "Les membres peuvent réserver", "I soci possono prenotare", "Members may book"],
  "misc.share.form.canBookHint": [
    "Ausgeschaltet: Freigabe bleibt bestehen, neue Buchungen sind pausiert.",
    "Désactivé : le partage reste en place, les nouvelles réservations sont suspendues.",
    "Disattivato: la condivisione resta, le nuove prenotazioni sono sospese.",
    "Off: sharing stays in place, new bookings are paused.",
  ],
  "misc.share.form.submit": ["Mit Partnerverein teilen", "Partager avec une société partenaire", "Condividi con una società partner", "Share with partner club"],
  "misc.share.list.empty": ["Noch mit keinem Partnerverein geteilt.", "Pas encore partagé avec une société partenaire.", "Non ancora condiviso con alcuna società partner.", "Not shared with any partner club yet."],
  "misc.share.list.deleted": ["gelöscht", "supprimée", "eliminata", "deleted"],
  "misc.share.list.bookable": ["buchbar", "réservable", "prenotabile", "bookable"],
  "misc.share.list.paused": ["pausiert", "suspendu", "sospeso", "paused"],
  "misc.share.list.samePrices": ["gleiche Preise", "mêmes prix", "stessi prezzi", "same prices"],
  "misc.share.list.pause": ["Pausieren", "Suspendre", "Sospendi", "Pause"],
  "misc.share.list.allow": ["Buchen erlauben", "Autoriser les réservations", "Consenti prenotazioni", "Allow bookings"],
  "misc.share.list.remove": ["Entfernen", "Supprimer", "Rimuovi", "Remove"],
  "misc.share.list.removeTitle": ["Freigabe für {partner} entfernen?", "Supprimer le partage avec {partner} ?", "Rimuovere la condivisione con {partner}?", "Remove sharing with {partner}?"],
  "misc.share.list.removeText": [
    "Bestehende Reservationen bleiben gültig. Neue Buchungen sind nicht mehr möglich.",
    "Les réservations existantes restent valables. Les nouvelles réservations ne sont plus possibles.",
    "Le prenotazioni esistenti restano valide. Non sono più possibili nuove prenotazioni.",
    "Existing bookings remain valid. New bookings are no longer possible.",
  ],

  // ---------------------------------------------------------------- Online-Zahlung Reservation
  "misc.booking.pay.notConfigured": [
    "Online-Zahlung ist für diesen Verein nicht eingerichtet.",
    "Le paiement en ligne n’est pas configuré pour cette société.",
    "Il pagamento online non è configurato per questa società.",
    "Online payment is not set up for this club.",
  ],
  "misc.booking.pay.unreachable": [
    "Zahlungsanbieter nicht erreichbar. Bitte später nochmals versuchen.",
    "Le prestataire de paiement est injoignable. Merci de réessayer plus tard.",
    "Il fornitore di pagamento non è raggiungibile. Riprova più tardi.",
    "The payment provider cannot be reached. Please try again later.",
  ],
  "misc.booking.paid.title": ["Reservation bezahlt und bestätigt", "Réservation payée et confirmée", "Prenotazione pagata e confermata", "Booking paid and confirmed"],
  "misc.booking.paid.body": [
    "Danke! Deine Reservation «{resource}» am {date} ist online bezahlt ({amount}) und bestätigt.",
    "Merci ! Ta réservation « {resource} » du {date} est payée en ligne ({amount}) et confirmée.",
    "Grazie! La tua prenotazione «{resource}» del {date} è pagata online ({amount}) e confermata.",
    "Thank you! Your booking “{resource}” on {date} has been paid online ({amount}) and is confirmed.",
  ],

  // ---------------------------------------------------------------- Waffenkategorie (Feldschiessen)
  "misc.weapon.title": ["Waffenkategorien", "Catégories d’armes", "Categorie d’armi", "Weapon categories"],
  "misc.weapon.label": ["Waffenkategorie", "Catégorie d’arme", "Categoria d’arma", "Weapon category"],
  "misc.weapon.none": ["keine Angabe", "non indiquée", "non indicata", "not set"],
  "misc.weapon.selectFor": ["Waffenkategorie für {name}", "Catégorie d’arme pour {name}", "Categoria d’arma per {name}", "Weapon category for {name}"],
  "misc.weapon.hint": [
    "Gelten Limiten nur für eine Waffenkategorie, zählt die Kategorie des Schützen. Ohne Angabe gelten nur Limiten ohne Waffenkategorie.",
    "Si des limites ne valent que pour une catégorie d’arme, c’est la catégorie du tireur qui compte. Sans indication, seules les limites sans catégorie d’arme s’appliquent.",
    "Se dei limiti valgono solo per una categoria d’arma, conta la categoria del tiratore. Senza indicazione valgono solo i limiti senza categoria d’arma.",
    "If limits apply to one weapon category only, the shooter’s category counts. If none is set, only limits without a weapon category apply.",
  ],
  "misc.weapon.saved": ["Waffenkategorie gespeichert.", "Catégorie d’arme enregistrée.", "Categoria d’arma salvata.", "Weapon category saved."],
  "misc.weapon.err.notFound": ["Teilnahme nicht gefunden.", "Participation introuvable.", "Partecipazione non trovata.", "Entry not found."],
  "misc.weapon.err.noRight": [
    "Nur der Schütze selbst oder der Schützenmeister kann die Waffenkategorie ändern.",
    "Seul le tireur lui-même ou le chef de tir peut modifier la catégorie d’arme.",
    "Solo il tiratore stesso o il capo tiro può modificare la categoria d’arma.",
    "Only the shooter or the shooting master can change the weapon category.",
  ],
  "misc.weapon.err.unknown": [
    "Diese Waffenkategorie ist in den Limiten des Vereins nicht erfasst.",
    "Cette catégorie d’arme ne figure pas dans les limites de la société.",
    "Questa categoria d’arma non figura nei limiti della società.",
    "This weapon category is not part of the club’s limits.",
  ],
};

function build(index: 0 | 1 | 2 | 3, transform: (s: string) => string = (s) => s): Record<string, string> {
  return Object.fromEntries(Object.entries(ROWS).map(([k, row]) => [k, transform(row[index])]));
}

const dict: { de: Record<string, string>; fr: Record<string, string>; it: Record<string, string>; en: Record<string, string> } = {
  de: build(0),
  fr: build(1, frenchSpacing),
  it: build(2),
  en: build(3),
};

export default dict;
