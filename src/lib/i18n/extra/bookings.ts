/**
 * Zusatz-Wörterbuch «bookings» (Welle D): Reservationen auf den Mitgliederseiten, Mitteilungen zu
 * Reservationen und zum Beitritt mit Freigabe. Alle Schlüssel mit Präfix «bookings.».
 *
 * Aufbau wie «shell»: pro Schlüssel [de, fr, it]. Französisch wird mit normalen Leerzeichen erfasst
 * («␣Text␣», «Note :»); frenchSpacing() setzt das schmale geschützte Leerzeichen (U+202F) in den
 * Guillemets und vor ? ! ; sowie ein geschütztes Leerzeichen (U+00A0) vor dem Doppelpunkt.
 * Platzhalter {name} usw. sind in allen drei Sprachen identisch.
 */
type Row = readonly [de: string, fr: string, it: string];

export function frenchSpacing(s: string): string {
  return s
    .replace(/«[   ]?/g, "« ")
    .replace(/[   ]?»/g, " »")
    .replace(/ :(?=\s|$)/g, " :")
    .replace(/ ([?!;])/g, " $1");
}

const ROWS: Record<string, Row> = {
  // Rückkehr vom Zahlungsanbieter (/bookings/[id]/return)
  "bookings.return.meta": ["Zahlung", "Paiement", "Pagamento"],
  "bookings.return.h.late": ["Zahlung eingegangen", "Paiement reçu", "Pagamento ricevuto"],
  "bookings.return.h.paid": ["Bezahlt, danke!", "Payé, merci !", "Pagato, grazie!"],
  "bookings.return.h.failed": ["Zahlung fehlgeschlagen", "Paiement échoué", "Pagamento non riuscito"],
  "bookings.return.h.pending": ["Zahlung wird geprüft", "Paiement en cours de vérification", "Pagamento in verifica"],
  "bookings.return.t.late": [
    "Die Zahlung ist eingegangen, die Reservation war aber bereits storniert. Der Verein prüft die Rückerstattung und meldet sich bei dir.",
    "Le paiement est arrivé, mais la réservation était déjà annulée. La société examine le remboursement et te contacte.",
    "Il pagamento è arrivato, ma la prenotazione era già annullata. La società verifica il rimborso e ti contatta.",
  ],
  "bookings.return.t.paid": ["Deine Reservation ist bezahlt und bestätigt.", "Ta réservation est payée et confirmée.", "La tua prenotazione è pagata e confermata."],
  "bookings.return.t.failed": [
    "Die Zahlung wurde abgebrochen oder abgelehnt. Du kannst es erneut versuchen.",
    "Le paiement a été interrompu ou refusé. Tu peux réessayer.",
    "Il pagamento è stato interrotto o rifiutato. Puoi riprovare.",
  ],
  "bookings.return.t.pending": [
    "Der Zahlungsanbieter hat die Zahlung noch nicht bestätigt. Das kann einen Moment dauern.",
    "Le prestataire de paiement n’a pas encore confirmé le paiement. Cela peut prendre un moment.",
    "Il fornitore di pagamento non ha ancora confermato il pagamento. Può richiedere un momento.",
  ],
  "bookings.return.toBooking": ["Zur Reservation", "Vers la réservation", "Alla prenotazione"],

  // Allgemein
  "bookings.title": ["Reservationen", "Réservations", "Prenotazioni"],
  "bookings.free": ["gratis", "gratuit", "gratuito"],
  "bookings.partnerRate": ["Partnertarif {percent} %", "Tarif partenaire {percent} %", "Tariffa partner {percent} %"],
  "bookings.common.cancel": ["Abbrechen", "Annuler", "Annulla"],
  "bookings.common.keep": ["Behalten", "Conserver", "Mantieni"],
  "bookings.common.failed": ["Das hat nicht geklappt. Bitte nochmals versuchen.", "Cela n’a pas fonctionné. Merci de réessayer.", "Non ha funzionato. Riprova."],
  "bookings.common.offline": [
    "Keine Verbindung. Bitte versuche es nochmals, sobald du wieder online bist.",
    "Pas de connexion. Réessaie dès que tu es de nouveau en ligne.",
    "Nessuna connessione. Riprova appena sei di nuovo online.",
  ],
  "bookings.card.ownerBadge": ["Anlage von {club}", "Installation de {club}", "Impianto di {club}"],
  "bookings.series.badge": ["Serie", "Série", "Serie"],

  // Status
  "bookings.status.PENDING": ["Wartet auf Freigabe", "En attente de validation", "In attesa di approvazione"],
  "bookings.status.CONFIRMED": ["Bestätigt", "Confirmée", "Confermata"],
  "bookings.status.REJECTED": ["Abgelehnt", "Refusée", "Rifiutata"],
  "bookings.status.CANCELLED": ["Storniert", "Annulée", "Annullata"],
  "bookings.payment.NOT_REQUIRED": ["Kostenlos", "Gratuit", "Gratuito"],
  "bookings.payment.UNPAID": ["Offen", "Ouvert", "Aperto"],
  "bookings.payment.PENDING": ["Zahlung läuft", "Paiement en cours", "Pagamento in corso"],
  "bookings.payment.PAID": ["Bezahlt", "Payé", "Pagato"],
  "bookings.payment.FAILED": ["Fehlgeschlagen", "Échoué", "Non riuscito"],
  "bookings.payment.REFUNDED": ["Erstattet", "Remboursé", "Rimborsato"],
  "bookings.payment.void": ["Entfällt", "Caduc", "Decaduto"],
  "bookings.method.NONE": ["Keine Zahlung", "Aucun paiement", "Nessun pagamento"],
  "bookings.method.INVOICE": ["Rechnung", "Facture", "Fattura"],
  "bookings.method.ONLINE": ["Online-Zahlung", "Paiement en ligne", "Pagamento online"],
  "bookings.method.CASH": ["Bar / vor Ort", "Espèces / sur place", "Contanti / sul posto"],
  "bookings.invoice.paid": ["bezahlt", "payée", "pagata"],
  "bookings.invoice.cancelled": ["storniert", "annulée", "annullata"],
  "bookings.invoice.open": ["offen", "ouverte", "aperta"],

  // Ressourcen
  "bookings.kind.RANGE": ["Schiessanlage / Stand", "Installation de tir / stand", "Impianto di tiro / stand"],
  "bookings.kind.LANE": ["Bahn / Scheibe", "Ligne / cible", "Linea / bersaglio"],
  "bookings.kind.ROOM": ["Raum", "Salle", "Locale"],
  "bookings.kind.OTHER": ["Anderes", "Autre", "Altro"],
  "bookings.whole.RANGE": ["die ganze Anlage", "toute l’installation", "l’intero impianto"],
  "bookings.whole.LANE": ["die ganze Bahn", "toute la ligne", "l’intera linea"],
  "bookings.whole.ROOM": ["den ganzen Raum", "toute la salle", "l’intero locale"],
  "bookings.whole.OTHER": ["die ganze Ressource", "toute la ressource", "l’intera risorsa"],
  "bookings.persons.one": ["1 Person", "1 personne", "1 persona"],
  "bookings.persons.many": ["{count} Personen", "{count} personnes", "{count} persone"],
  "bookings.places.one": ["1 Platz", "1 place", "1 posto"],
  "bookings.places.many": ["{count} Plätze", "{count} places", "{count} posti"],
  "bookings.discount.lastMinute": ["Spontan-Rabatt {percent}%", "Rabais de dernière minute {percent} %", "Sconto last minute {percent}%"],
  "bookings.discount.freeAdmin": ["Gratis (Verwaltung)", "Gratuit (administration)", "Gratuito (amministrazione)"],

  // Gründe für nicht verfügbare Zeiten
  "bookings.reason.tooFar": ["Zu weit im Voraus", "Trop à l’avance", "Troppo in anticipo"],
  "bookings.reason.tooShort": ["Zu kurzfristig", "Trop tard", "Troppo a breve termine"],
  "bookings.reason.blocked": ["Gesperrt", "Bloqué", "Bloccato"],
  "bookings.reason.taken": ["Belegt", "Occupé", "Occupato"],
  "bookings.reason.notEnough": ["Nicht genug Plätze frei", "Pas assez de places libres", "Posti liberi insufficienti"],
  "bookings.reason.outsideWindow": ["Ausserhalb der Schiesszeiten", "Hors des heures de tir", "Fuori dagli orari di tiro"],
  "bookings.reason.unavailable": ["nicht verfügbar", "non disponible", "non disponibile"],

  // Übersicht
  "bookings.list.manage": ["Verwalten", "Gérer", "Gestisci"],
  "bookings.list.series": ["Serien", "Séries", "Serie"],
  "bookings.list.upcoming": ["Deine nächsten Termine", "Tes prochains rendez-vous", "I tuoi prossimi appuntamenti"],
  "bookings.list.again": ["Nochmals reservieren", "Réserver à nouveau", "Prenota di nuovo"],
  "bookings.list.new": ["Neu reservieren", "Nouvelle réservation", "Nuova prenotazione"],
  "bookings.list.repeatLead": ["Wie letztes Mal:", "Comme la dernière fois :", "Come l’ultima volta:"],
  "bookings.list.repeatTail": [
    ", eine Woche später. Prüfe Zeit und bestätige.",
    ", une semaine plus tard. Vérifie l’heure et confirme.",
    ", una settimana dopo. Controlla l’orario e conferma.",
  ],
  "bookings.list.repeatUnavailable": [
    "Diese Reservation kann nicht wiederholt werden (Ressource nicht mehr buchbar).",
    "Cette réservation ne peut pas être répétée (ressource plus réservable).",
    "Questa prenotazione non può essere ripetuta (risorsa non più prenotabile).",
  ],
  "bookings.list.emptyTitle": ["Noch keine Anlagen oder Bahnen erfasst", "Aucune installation ni ligne saisie", "Nessun impianto o linea registrato"],
  "bookings.list.emptyAdmin": [
    "Lege unter «Verwalten» die buchbaren Ressourcen an.",
    "Crée les ressources réservables sous « Gérer ».",
    "Crea le risorse prenotabili in «Gestisci».",
  ],
  "bookings.list.emptyMember": [
    "Die Verwaltung hat noch nichts zum Reservieren freigeschaltet.",
    "L’administration n’a encore rien ouvert à la réservation.",
    "L’amministrazione non ha ancora reso nulla prenotabile.",
  ],
  "bookings.list.createResource": ["Ressource anlegen", "Créer une ressource", "Crea risorsa"],
  "bookings.list.sharedTitle": ["Anlagen von {club}", "Installations de {club}", "Impianti di {club}"],
  "bookings.list.sharedHint": [
    "Gemeinsame Anlage: Es gelten die Regeln von {club}, die Rechnung kommt von dort.",
    "Installation partagée : les règles de {club} s’appliquent, la facture vient de là-bas.",
    "Impianto condiviso: valgono le regole di {club}, la fattura arriva da lì.",
  ],
  "bookings.list.all": ["Alle", "Toutes", "Tutte"],
  "bookings.list.past": ["Vergangene", "Passées", "Passate"],
  "bookings.history.title": ["Meine Reservationen", "Mes réservations", "Le mie prenotazioni"],
  "bookings.history.subtitle": ["Im eigenen Verein und auf gemeinsamen Anlagen", "Dans ma société et sur les installations partagées", "Nella mia società e sugli impianti condivisi"],
  "bookings.history.empty": ["Noch keine Reservationen.", "Pas encore de réservations.", "Ancora nessuna prenotazione."],

  // Assistent
  "bookings.wizard.windowHint": ["Bewilligte Schiesszeiten: {list}", "Horaires de tir autorisés : {list}", "Orari di tiro autorizzati: {list}"],
  "bookings.wizard.windowNone": ["{day}: keine Schiesszeit", "{day} : aucun horaire de tir", "{day}: nessun orario di tiro"],
  "bookings.wizard.stepWhat": ["1 · Was", "1 · Quoi", "1 · Cosa"],
  "bookings.wizard.stepDuration": ["2 · Wie lange", "2 · Durée", "2 · Durata"],
  "bookings.wizard.stepPersons": ["3 · Wie viele Personen", "3 · Combien de personnes", "3 · Quante persone"],
  "bookings.wizard.stepWhen": ["{n} · Wann", "{n} · Quand", "{n} · Quando"],
  "bookings.wizard.stepConfirm": ["{n} · Bestätigen", "{n} · Confirmer", "{n} · Conferma"],
  "bookings.wizard.sharedInfo": [
    "Anlage von {owner}. Es gelten deren Öffnungszeiten und Regeln; die Rechnung stellt {owner}.",
    "Installation de {owner}. Ses horaires et ses règles s’appliquent ; la facture est établie par {owner}.",
    "Impianto di {owner}. Valgono i suoi orari e le sue regole; la fattura è emessa da {owner}.",
  ],
  "bookings.wizard.lastMinute": [
    "{percent}% Rabatt bei Buchung innerhalb von {hours} Stunden vor Beginn.",
    "{percent} % de rabais pour une réservation dans les {hours} heures avant le début.",
    "{percent}% di sconto prenotando entro {hours} ore dall’inizio.",
  ],
  "bookings.wizard.priceFor": ["{price} für {persons}", "{price} pour {persons}", "{price} per {persons}"],
  "bookings.wizard.flatPrice": ["Pauschalpreis {price}", "Prix forfaitaire {price}", "Prezzo forfettario {price}"],
  "bookings.wizard.flatPriceShort": ["Pauschalpreis", "Prix forfaitaire", "Prezzo forfettario"],
  "bookings.wizard.flat": ["Pauschal", "Forfait", "Forfettario"],
  "bookings.wizard.flatFrom": [
    "Ab {from} Personen gilt der Pauschalpreis ({price}).",
    "Dès {from} personnes, le prix forfaitaire s’applique ({price}).",
    "Da {from} persone vale il prezzo forfettario ({price}).",
  ],
  "bookings.wizard.flatFromWhole": [
    "Ab {from} Personen gilt der Pauschalpreis für {whole} ({price}).",
    "Dès {from} personnes, le prix forfaitaire pour {whole} s’applique ({price}).",
    "Da {from} persone vale il prezzo forfettario per {whole} ({price}).",
  ],
  "bookings.wizard.prevDay": ["Vorheriger Tag", "Jour précédent", "Giorno precedente"],
  "bookings.wizard.nextDay": ["Nächster Tag", "Jour suivant", "Giorno successivo"],
  "bookings.wizard.pickDate": ["Datum wählen", "Choisir la date", "Scegli la data"],
  "bookings.wizard.today": ["Heute", "Aujourd’hui", "Oggi"],
  "bookings.wizard.tomorrow": ["Morgen", "Demain", "Domani"],
  "bookings.wizard.dayAfter": ["Übermorgen", "Après-demain", "Dopodomani"],
  "bookings.wizard.prefillFree": [
    "Gleiche Zeit wie letztes Mal ({time} Uhr) ist frei und vorausgewählt.",
    "Même heure que la dernière fois ({time}) : libre et présélectionnée.",
    "Stesso orario dell’ultima volta (ore {time}): libero e preselezionato.",
  ],
  "bookings.wizard.prefillTaken": [
    "{time} Uhr ist an diesem Tag nicht frei. Bitte eine andere Zeit wählen.",
    "{time} n’est pas libre ce jour-là. Merci de choisir une autre heure.",
    "Le ore {time} non sono libere in questo giorno. Scegli un altro orario.",
  ],
  "bookings.wizard.prefillTakenReason": [
    "{time} Uhr ist an diesem Tag nicht frei ({reason}). Bitte eine andere Zeit wählen.",
    "{time} n’est pas libre ce jour-là ({reason}). Merci de choisir une autre heure.",
    "Le ore {time} non sono libere in questo giorno ({reason}). Scegli un altro orario.",
  ],
  "bookings.wizard.loading": ["Verfügbarkeit wird geladen…", "Chargement des disponibilités…", "Caricamento disponibilità…"],
  "bookings.wizard.closed": ["An diesem Tag geschlossen oder keine passende Zeit.", "Fermé ce jour-là ou aucun horaire adapté.", "Chiuso in questo giorno o nessun orario adatto."],
  "bookings.wizard.timeAt": ["{time} Uhr", "{time}", "ore {time}"],
  "bookings.wizard.remaining": ["{count} frei", "{count} libres", "{count} liberi"],
  "bookings.wizard.tooFew": [
    "Durchgestrichene Zeiten: Nicht genug Plätze frei für {persons}.",
    "Horaires barrés : pas assez de places libres pour {persons}.",
    "Orari barrati: posti liberi insufficienti per {persons}.",
  ],
  "bookings.wizard.tooFewFlat": [
    "Durchgestrichene Zeiten: Nicht genug Plätze frei für {persons} (Pauschale belegt {whole}).",
    "Horaires barrés : pas assez de places libres pour {persons} (le forfait occupe {whole}).",
    "Orari barrati: posti liberi insufficienti per {persons} (il forfait occupa {whole}).",
  ],
  "bookings.wizard.windowOverride": [
    "Zeiten ausserhalb sind für die Verwaltung buchbar und erhalten einen Vermerk.",
    "Les horaires en dehors restent réservables par l’administration, avec une mention.",
    "Gli orari al di fuori sono prenotabili dall’amministrazione e ricevono un’annotazione.",
  ],
  "bookings.wizard.windowOutside": ["Zeiten ausserhalb sind durchgestrichen.", "Les horaires en dehors sont barrés.", "Gli orari al di fuori sono barrati."],
  "bookings.wizard.payOnline": ["Jetzt online zahlen", "Payer en ligne maintenant", "Paga ora online"],
  "bookings.wizard.payInvoice": ["Rechnung", "Facture", "Fattura"],
  "bookings.wizard.onlineAfter": ["Bezahlung online direkt nach der Buchung.", "Paiement en ligne juste après la réservation.", "Pagamento online subito dopo la prenotazione."],
  "bookings.wizard.invoiceFrom": ["Du erhältst eine Rechnung von {owner}.", "Tu recevras une facture de {owner}.", "Riceverai una fattura da {owner}."],
  "bookings.wizard.invoice": ["Du erhältst eine Rechnung.", "Tu recevras une facture.", "Riceverai una fattura."],
  "bookings.wizard.note": ["Bemerkung (optional)", "Remarque (facultatif)", "Osservazione (facoltativa)"],
  "bookings.wizard.notePlaceholder": ["z.B. Training mit Gästen", "p. ex. entraînement avec des invités", "p. es. allenamento con ospiti"],
  "bookings.wizard.approvalInfo": [
    "Die Buchung wird von der Verwaltung geprüft und freigegeben.",
    "La réservation est vérifiée et validée par l’administration.",
    "La prenotazione viene verificata e approvata dall’amministrazione.",
  ],
  "bookings.wizard.instantInfo": ["Die Buchung ist sofort gültig.", "La réservation est valable immédiatement.", "La prenotazione è subito valida."],
  "bookings.wizard.freeCancel": [
    "Kostenlose Stornierung bis {hours} Stunden vor Beginn.",
    "Annulation gratuite jusqu’à {hours} heures avant le début.",
    "Annullamento gratuito fino a {hours} ore prima dell’inizio.",
  ],
  "bookings.wizard.submitting": ["Wird gebucht…", "Réservation en cours…", "Prenotazione in corso…"],
  "bookings.wizard.submitPay": ["Buchen und bezahlen", "Réserver et payer", "Prenota e paga"],
  "bookings.wizard.submitRequest": ["Anfrage senden", "Envoyer la demande", "Invia richiesta"],
  "bookings.wizard.submit": ["Verbindlich buchen", "Réserver ferme", "Prenota in modo vincolante"],
  "bookings.stepper.label": ["Anzahl Personen", "Nombre de personnes", "Numero di persone"],
  "bookings.stepper.less": ["Eine Person weniger", "Une personne de moins", "Una persona in meno"],
  "bookings.stepper.more": ["Eine Person mehr", "Une personne de plus", "Una persona in più"],
  "bookings.stepper.person": ["Person · max. {max}", "personne · max. {max}", "persona · max. {max}"],
  "bookings.stepper.persons": ["Personen · max. {max}", "personnes · max. {max}", "persone · max. {max}"],

  // Detail
  "bookings.detail.title": ["Reservation", "Réservation", "Prenotazione"],
  "bookings.detail.home": ["Start", "Accueil", "Home"],
  "bookings.detail.partnerDeleted": ["Partnerverein (gelöscht)", "Société partenaire (supprimée)", "Società partner (eliminata)"],
  "bookings.detail.created": ["Buchung erfasst.", "Réservation enregistrée.", "Prenotazione registrata."],
  "bookings.detail.createdFor": ["Buchung erfasst für {name}.", "Réservation enregistrée pour {name}.", "Prenotazione registrata per {name}."],
  "bookings.detail.outsideWindow": [
    "Achtung: Diese Buchung liegt ausserhalb der bewilligten Schiesszeiten. Der Hinweis ist unter «Notiz Verwaltung» gespeichert.",
    "Attention : cette réservation se situe hors des heures de tir autorisées. La mention est enregistrée sous « Note de l’administration ».",
    "Attenzione: questa prenotazione è fuori dagli orari di tiro autorizzati. L’avviso è salvato in «Nota amministrazione».",
  ],
  "bookings.detail.paymentAborted": [
    "Zahlung abgebrochen. Du kannst sie unten erneut starten.",
    "Paiement interrompu. Tu peux le relancer ci-dessous.",
    "Pagamento interrotto. Puoi riavviarlo qui sotto.",
  ],
  "bookings.detail.guestVia": [
    "Gebucht über deinen Verein. Es gelten die Regeln von {owner}",
    "Réservé via ta société. Les règles de {owner} s’appliquent",
    "Prenotato tramite la tua società. Valgono le regole di {owner}",
  ],
  "bookings.detail.guestViaNamed": [
    "Gebucht über deinen Verein {partner}. Es gelten die Regeln von {owner}",
    "Réservé via ta société {partner}. Les règles de {owner} s’appliquent",
    "Prenotato tramite la tua società {partner}. Valgono le regole di {owner}",
  ],
  "bookings.detail.guestInvoice": [", die Rechnung stellt {owner}", ", la facture est établie par {owner}", ", la fattura è emessa da {owner}"],
  "bookings.detail.pending": ["Die Verwaltung prüft deine Anfrage.", "L’administration examine ta demande.", "L’amministrazione sta esaminando la tua richiesta."],
  "bookings.detail.payAfterApproval": ["Bezahlt wird nach der Freigabe.", "Le paiement se fait après la validation.", "Il pagamento avviene dopo l’approvazione."],
  "bookings.detail.rejected": ["Diese Anfrage wurde abgelehnt.", "Cette demande a été refusée.", "Questa richiesta è stata rifiutata."],
  "bookings.detail.rejectedReason": ["Diese Anfrage wurde abgelehnt. Grund: {reason}", "Cette demande a été refusée. Motif : {reason}", "Questa richiesta è stata rifiutata. Motivo: {reason}"],
  "bookings.detail.seriesInfo": [
    "Dieser Termin gehört zu einer wiederkehrenden Reservation.",
    "Ce rendez-vous fait partie d’une réservation récurrente.",
    "Questo appuntamento fa parte di una prenotazione ricorrente.",
  ],
  "bookings.detail.seriesOpen": ["Serie öffnen", "Ouvrir la série", "Apri la serie"],
  "bookings.detail.partner": ["Partnerverein", "Société partenaire", "Società partner"],
  "bookings.detail.owner": ["Anlage von", "Installation de", "Impianto di"],
  "bookings.detail.bookedBy": ["Gebucht von", "Réservé par", "Prenotato da"],
  "bookings.detail.unknown": ["Unbekannt", "Inconnu", "Sconosciuto"],
  "bookings.detail.persons": ["Personen", "Personnes", "Persone"],
  "bookings.detail.price": ["Preis", "Prix", "Prezzo"],
  "bookings.detail.payment": ["Zahlung", "Paiement", "Pagamento"],
  "bookings.detail.paidAt": ["Bezahlt am", "Payé le", "Pagato il"],
  "bookings.detail.note": ["Bemerkung", "Remarque", "Osservazione"],
  "bookings.detail.adminNote": ["Notiz Verwaltung", "Note de l’administration", "Nota amministrazione"],
  "bookings.detail.createdAt": ["Erstellt", "Créée", "Creata"],
  "bookings.detail.invoice": ["Rechnung", "Facture", "Fattura"],
  "bookings.detail.invoiceNumber": ["Rechnung {number}", "Facture {number}", "Fattura {number}"],
  "bookings.detail.invoiceDue": ["Fällig am {date}", "Échéance le {date}", "Scadenza il {date}"],
  "bookings.detail.reference": ["Ref.", "Réf.", "Rif."],
  "bookings.detail.openPrint": ["Öffnen / Drucken", "Ouvrir / imprimer", "Apri / stampa"],
  "bookings.detail.appointment": ["Termin", "Rendez-vous", "Appuntamento"],
  "bookings.detail.addCalendar": ["In meinen Kalender", "Dans mon agenda", "Nel mio calendario"],
  "bookings.detail.repeat": ["Wiederholen", "Répéter", "Ripeti"],
  "bookings.detail.repeatSame": ["gleiche Zeit, {date}", "même heure, {date}", "stesso orario, {date}"],
  "bookings.detail.bookAgain": ["Erneut buchen", "Réserver à nouveau", "Prenota di nuovo"],
  "bookings.detail.attempts": ["Zahlungsversuche", "Tentatives de paiement", "Tentativi di pagamento"],
  "bookings.detail.actions": ["Aktionen", "Actions", "Azioni"],
  "bookings.cancel.confirm": ["Buchung wirklich stornieren?", "Vraiment annuler la réservation ?", "Annullare davvero la prenotazione?"],
  "bookings.cancel.button": ["Stornieren", "Annuler la réservation", "Annulla prenotazione"],
  "bookings.pay.now": ["Jetzt bezahlen", "Payer maintenant", "Paga ora"],
  "bookings.pay.redirecting": ["Weiterleitung…", "Redirection…", "Reindirizzamento…"],
  "bookings.pay.title": ["Bezahlen", "Payer", "Pagare"],
  "bookings.pay.failedTitle": ["Zahlung nicht möglich", "Paiement impossible", "Pagamento non possibile"],
  "bookings.pay.failedText": [
    "Die Reservation bleibt 30 Minuten reserviert. Du kannst die Zahlung auf der Reservationsseite erneut starten.",
    "La réservation reste bloquée 30 minutes. Tu peux relancer le paiement depuis la page de la réservation.",
    "La prenotazione resta riservata per 30 minuti. Puoi riavviare il pagamento dalla pagina della prenotazione.",
  ],
  "bookings.pay.toBooking": ["Zur Reservation", "Vers la réservation", "Alla prenotazione"],

  // Partneranlagen
  "bookings.partner.metaTitle": ["Gemeinsame Anlage reservieren", "Réserver une installation partagée", "Prenota un impianto condiviso"],
  "bookings.partner.subtitle": ["Gemeinsame Anlage für {club}", "Installation partagée pour {club}", "Impianto condiviso per {club}"],
  "bookings.partner.repeatTitle": ["Reservation wiederholen", "Répéter la réservation", "Ripeti la prenotazione"],
  "bookings.partner.repeatGone": [
    "Diese Reservation kann nicht wiederholt werden: Die Anlage ist für deinen Verein nicht mehr freigegeben.",
    "Cette réservation ne peut pas être répétée : l’installation n’est plus ouverte à ta société.",
    "Questa prenotazione non può essere ripetuta: l’impianto non è più condiviso con la tua società.",
  ],
  "bookings.partner.repeatUnavailable": [
    "Diese Reservation kann nicht wiederholt werden (Anlage nicht mehr freigegeben).",
    "Cette réservation ne peut pas être répétée (installation plus partagée).",
    "Questa prenotazione non può essere ripetuta (impianto non più condiviso).",
  ],
  "bookings.partner.toBookings": ["Zu den Reservationen", "Vers les réservations", "Alle prenotazioni"],
  "bookings.partner.noInvoice": [
    "Hinweis: {club} bietet keine Bezahlung auf Rechnung an. Kostenpflichtige Termine bitte direkt beim Verein reservieren.",
    "Remarque : {club} ne propose pas le paiement sur facture. Réserve les créneaux payants directement auprès de la société.",
    "Nota: {club} non offre il pagamento con fattura. Prenota gli appuntamenti a pagamento direttamente presso la società.",
  ],

  // Meldungen der Aktionen
  "bookings.err.incomplete": [
    "Bitte Ressource, Datum, Zeit, Dauer und Anzahl Personen wählen.",
    "Merci de choisir la ressource, la date, l’heure, la durée et le nombre de personnes.",
    "Scegli risorsa, data, orario, durata e numero di persone.",
  ],
  "bookings.err.resourceUnavailable": ["Ressource nicht verfügbar.", "Ressource non disponible.", "Risorsa non disponibile."],
  "bookings.err.resourceNotFound": ["Ressource nicht gefunden", "Ressource introuvable", "Risorsa non trovata"],
  "bookings.err.durationUnavailable": ["Diese Dauer ist nicht buchbar.", "Cette durée n’est pas réservable.", "Questa durata non è prenotabile."],
  "bookings.err.maxPersonsOne": ["Höchstens 1 Person pro Buchung.", "1 personne au maximum par réservation.", "Al massimo 1 persona per prenotazione."],
  "bookings.err.maxPersonsMany": ["Höchstens {max} Personen pro Buchung.", "{max} personnes au maximum par réservation.", "Al massimo {max} persone per prenotazione."],
  "bookings.err.outsideOpening": ["Diese Zeit liegt ausserhalb der Öffnungszeiten.", "Cet horaire est en dehors des heures d’ouverture.", "Questo orario è fuori dagli orari d’apertura."],
  "bookings.err.slotUnavailable": ["Dieser Termin ist nicht verfügbar ({reason}).", "Ce créneau n’est pas disponible ({reason}).", "Questo appuntamento non è disponibile ({reason})."],
  "bookings.err.outsideWindow": [
    "Die Zeit liegt ausserhalb der bewilligten Schiesszeiten. Erlaubt: {allowed}.",
    "L’horaire est en dehors des heures de tir autorisées. Autorisé : {allowed}.",
    "L’orario è fuori dagli orari di tiro autorizzati. Consentito: {allowed}.",
  ],
  "bookings.err.noPaymentMethod": [
    "Für diesen Verein ist keine Zahlungsart eingerichtet. Bitte Admin kontaktieren.",
    "Aucun moyen de paiement n’est configuré pour cette société. Merci de contacter l’administration.",
    "Per questa società non è configurato alcun metodo di pagamento. Contatta l’amministrazione.",
  ],
  "bookings.err.choosePayment": ["Bitte Zahlungsart wählen.", "Merci de choisir le mode de paiement.", "Scegli il metodo di pagamento."],
  "bookings.err.slotTaken": [
    "Dieser Termin wurde soeben vergeben. Bitte eine andere Zeit wählen.",
    "Ce créneau vient d’être attribué. Merci de choisir une autre heure.",
    "Questo appuntamento è appena stato assegnato. Scegli un altro orario.",
  ],
  "bookings.err.notFound": ["Nicht gefunden", "Introuvable", "Non trovato"],
  "bookings.err.ended": ["Buchung ist bereits beendet.", "La réservation est déjà terminée.", "La prenotazione è già conclusa."],
  "bookings.err.cancelDeadline": [
    "Stornierung nur bis {hours} Stunden vor Beginn möglich.",
    "Annulation possible jusqu’à {hours} heures avant le début seulement.",
    "Annullamento possibile solo fino a {hours} ore prima dell’inizio.",
  ],
  "bookings.err.notConfirmed": ["Buchung ist noch nicht bestätigt.", "La réservation n’est pas encore confirmée.", "La prenotazione non è ancora confermata."],
  "bookings.err.alreadyPaid": ["Bereits bezahlt.", "Déjà payé.", "Già pagato."],
  "bookings.err.invoiceOnly": ["Diese Buchung wird per Rechnung bezahlt.", "Cette réservation est payée sur facture.", "Questa prenotazione si paga con fattura."],
  "bookings.err.invalidDate": ["Ungültiges Datum", "Date non valable", "Data non valida"],
  "bookings.err.invalidInput": ["Ungültige Eingabe", "Saisie non valable", "Inserimento non valido"],
  "bookings.err.invalidPersons": ["Ungültige Anzahl Personen", "Nombre de personnes non valable", "Numero di persone non valido"],
  "bookings.msg.cancelled": ["Buchung storniert.", "Réservation annulée.", "Prenotazione annullata."],

  // Mitteilungen (Push und E-Mail)
  "bookings.notify.self.confirmed.title": ["Reservation bestätigt", "Réservation confirmée", "Prenotazione confermata"],
  "bookings.notify.self.confirmed.body": [
    "Deine Reservation «{resource}» am {date} ist bestätigt.",
    "Ta réservation « {resource} » du {date} est confirmée.",
    "La tua prenotazione «{resource}» del {date} è confermata.",
  ],
  "bookings.notify.self.cancelled.title": ["Reservation storniert", "Réservation annulée", "Prenotazione annullata"],
  "bookings.notify.self.cancelled.body": [
    "Du hast deine Reservation «{resource}» am {date} storniert.",
    "Tu as annulé ta réservation « {resource} » du {date}.",
    "Hai annullato la tua prenotazione «{resource}» del {date}.",
  ],
  "bookings.notify.seriesCancelled.title": ["Serie storniert", "Série annulée", "Serie annullata"],
  "bookings.notify.seriesCancelled.body": [
    "{name} hat deine Serienreservation «{resource}» storniert. Betroffene künftige Termine: {count}.",
    "{name} a annulé ta série de réservations « {resource} ». Dates futures concernées : {count}.",
    "{name} ha annullato la tua serie di prenotazioni «{resource}». Date future interessate: {count}.",
  ],
  "bookings.notify.reminder.title": ["Erinnerung: Reservation morgen", "Rappel : réservation demain", "Promemoria: prenotazione domani"],
  "bookings.notify.reminder.titleToday": ["Erinnerung: Reservation heute", "Rappel : réservation aujourd’hui", "Promemoria: prenotazione oggi"],
  "bookings.notify.reminder.body": ["«{resource}» am {date}.", "« {resource} » le {date}.", "«{resource}» il {date}."],
  "bookings.notify.reminder.email": [
    "Deine Reservation «{resource}» beginnt am {date}.\n\nFalls du verhindert bist, storniere sie bitte rechtzeitig, damit andere den Platz nutzen können.",
    "Ta réservation « {resource} » commence le {date}.\n\nSi tu es empêché, annule-la à temps pour que d’autres puissent profiter de la place.",
    "La tua prenotazione «{resource}» inizia il {date}.\n\nSe non puoi venire, annullala per tempo così altri possono usare il posto.",
  ],

  // Beitritt mit Freigabe
  "bookings.join.notify.request.title": ["Neue Beitrittsanfrage", "Nouvelle demande d’adhésion", "Nuova richiesta di adesione"],
  "bookings.join.notify.request.body": [
    "{name} möchte dem Verein beitreten.",
    "{name} souhaite rejoindre la société de tir.",
    "{name} desidera entrare nella società di tiro.",
  ],
  "bookings.join.notify.approved.title": ["Beitritt freigegeben", "Adhésion validée", "Adesione approvata"],
  "bookings.join.notify.approved.body": [
    "Willkommen bei {club}! Du hast jetzt Zugang.",
    "Bienvenue à {club} ! Tu as maintenant accès.",
    "Benvenuto in {club}! Ora hai accesso.",
  ],
  "bookings.join.notify.rejected.title": ["Beitritt abgelehnt", "Adhésion refusée", "Adesione rifiutata"],
  "bookings.join.notify.rejected.body": [
    "{club} hat deine Beitrittsanfrage abgelehnt.",
    "{club} a refusé ta demande d’adhésion.",
    "{club} ha rifiutato la tua richiesta di adesione.",
  ],
  "bookings.join.notify.rejected.bodyReason": [
    "{club} hat deine Beitrittsanfrage abgelehnt. Grund: {reason}",
    "{club} a refusé ta demande d’adhésion. Motif : {reason}",
    "{club} ha rifiutato la tua richiesta di adesione. Motivo: {reason}",
  ],
  "bookings.join.waiting.title": ["Fast geschafft", "Presque terminé", "Quasi fatto"],
  "bookings.join.waiting.textOne": [
    "Deine Anfrage bei {club} wartet auf die Freigabe durch die Verwaltung. Du erhältst eine Mitteilung, sobald sie entschieden ist.",
    "Ta demande auprès de {club} attend la validation de l’administration. Tu recevras un message dès qu’elle sera traitée.",
    "La tua richiesta presso {club} attende l’approvazione dell’amministrazione. Riceverai un messaggio non appena sarà decisa.",
  ],
  "bookings.join.waiting.textMany": [
    "Deine Anfragen warten auf die Freigabe durch die Verwaltung. Du erhältst eine Mitteilung, sobald sie entschieden sind.",
    "Tes demandes attendent la validation de l’administration. Tu recevras un message dès qu’elles seront traitées.",
    "Le tue richieste attendono l’approvazione dell’amministrazione. Riceverai un messaggio non appena saranno decise.",
  ],
  "bookings.join.waiting.status": ["Wartet auf Freigabe", "En attente de validation", "In attesa di approvazione"],
  "bookings.join.waiting.since": ["Angefragt am {date}", "Demandé le {date}", "Richiesto il {date}"],
  "bookings.join.waiting.hint": [
    "Bis zur Freigabe hast du noch keinen Zugang zu den Inhalten des Vereins.",
    "Jusqu’à la validation, tu n’as pas encore accès aux contenus de la société de tir.",
    "Fino all’approvazione non hai ancora accesso ai contenuti della società di tiro.",
  ],
  "bookings.join.withdraw.button": ["Anfrage zurückziehen", "Retirer la demande", "Ritira la richiesta"],
  "bookings.join.withdraw.confirm": ["Anfrage bei {club} zurückziehen?", "Retirer la demande auprès de {club} ?", "Ritirare la richiesta presso {club}?"],
  "bookings.join.err.decided": ["Diese Anfrage ist bereits entschieden.", "Cette demande a déjà été traitée.", "Questa richiesta è già stata evasa."],
  "bookings.join.withdraw.done": ["Anfrage zurückgezogen.", "Demande retirée.", "Richiesta ritirata."],
};

const de: Record<string, string> = {};
const fr: Record<string, string> = {};
const it: Record<string, string> = {};
for (const [key, [d, f, i]] of Object.entries(ROWS)) {
  de[key] = d;
  fr[key] = frenchSpacing(f);
  it[key] = i;
}

const dict = { de, fr, it };
export default dict;
