/** Deutsch (Schweiz) – Basissprache. Flache Schlüssel → Text, Platzhalter als {name}. */
const de: Record<string, string> = {
  // Sprachen
  "locale.de": "Deutsch",
  "locale.fr": "Französisch",
  "locale.it": "Italienisch",

  // Rechnungsdokument
  "invoice.title": "Rechnung",
  "invoice.number": "Nr. {number}",
  "invoice.date": "Datum {date}",
  "invoice.due": "Fällig {date}",
  "invoice.ref": "Ref. {ref}",
  "invoice.memberNumber": "Mitglied Nr. {number}",
  "invoice.colItem": "Leistung",
  "invoice.colAmount": "Betrag",
  "invoice.total": "Total",
  "invoice.paid": "BEZAHLT",
  "invoice.cancelled": "STORNIERT",
  "invoice.payableUntil": "Zahlbar bis {date}",
  "invoice.iban": "IBAN {iban} · {name}",
  "invoice.askClub": "Zahlungsangaben beim Verein erfragen.",
  "invoice.reference": "Referenz:",
  "invoice.purpose": "Zahlungszweck: {title} {number}",
  "invoice.annualFee": "Jahresbeitrag",
  "invoice.annualFeeYear": "Jahresbeitrag {year}",
  "invoice.reminder": "Zahlungserinnerung",
  "invoice.booking": "Buchung",
  "invoice.ammo": "Munition",
  "invoice.discount": "Rabatt",
  "invoice.reminderIntro": "Für die Rechnung {number} haben wir bisher keinen Zahlungseingang festgestellt. Bitte begleichen Sie den Betrag innert 14 Tagen. Falls sich die Zahlung mit diesem Schreiben kreuzt, betrachten Sie es als gegenstandslos.",

  // Benachrichtigungen: Themen
  "notify.topic.chat": "Chat-Nachrichten",
  "notify.topic.announcements": "Mitteilungen",
  "notify.topic.bookings": "Buchungen",
  "notify.topic.invoices": "Rechnungen",
  "notify.topic.shifts": "Helfereinsätze",
  "notify.topic.events": "Anlässe",
  "notify.topic.reminders": "Erinnerungen",
  "notify.topic.system": "Konto und Sicherheit",

  // Benachrichtigungen: E-Mail-Rahmen
  "notify.mail.open": "In Standchef öffnen",
  "notify.mail.footer": "Du erhältst diese E-Mail, weil du bei {club} Mitglied bist. Benachrichtigungen kannst du unter «Mein Konto → Benachrichtigungen» anpassen.",
  "notify.mail.footerNoClub": "Benachrichtigungen kannst du unter «Mein Konto → Benachrichtigungen» anpassen.",

  // Testbenachrichtigung
  "notify.test.title": "Testbenachrichtigung",
  "notify.test.body": "Es funktioniert! So sehen Benachrichtigungen von Standchef aus.",

  // Chat
  "notify.chat.title": "{sender}",
  "notify.chat.titleGroup": "{sender} in «{group}»",
  "notify.chat.body": "{text}",
  "notify.chat.attachment": "hat eine Datei gesendet",
  "notify.chat.emailSubject": "Neue Chat-Nachricht von {sender}",
  "notify.chat.emailBody": "{sender} hat dir im Chat von {club} geschrieben. Aus Datenschutzgründen steht der Inhalt nicht in dieser E-Mail.",

  // Mitteilungen und Anlässe
  "notify.announcement.title": "Mitteilung: {title}",
  "notify.event.cancelled.title": "Abgesagt: {title}",
  "notify.event.cancelled.body": "Der Anlass vom {date} findet nicht statt.",
  "notify.event.restored.title": "Findet doch statt: {title}",
  "notify.event.restored.body": "Der Anlass vom {date} findet wie geplant statt.",

  // Buchungen
  "notify.booking.pending.title": "Neue Buchungsanfrage",
  "notify.booking.pending.body": "{name} möchte {resource} am {date} buchen.",
  "notify.booking.confirmed.title": "Buchung bestätigt",
  "notify.booking.confirmed.body": "Deine Buchung «{resource}» am {date} ist bestätigt.",
  "notify.booking.rejected.title": "Buchung abgelehnt",
  "notify.booking.rejected.body": "Deine Buchung «{resource}» am {date} wurde leider abgelehnt.",
  "notify.booking.created.title": "Neue Buchung für dich",
  "notify.booking.created.body": "Für dich wurde «{resource}» am {date} gebucht.",
  "notify.booking.cancelled.title": "Buchung storniert",
  "notify.booking.cancelled.body": "{name} hat die Buchung «{resource}» am {date} storniert.",

  // Rechnungen
  "notify.invoice.issued.title": "Neue Rechnung: {title}",
  "notify.invoice.issued.body": "Rechnung {number} über {amount}, zahlbar bis {date}. Alle Angaben und den QR-Einzahlungsschein findest du in Standchef unter «Zahlungen».",
  "notify.invoice.issued.subject": "{club}: Rechnung {number}",
  "notify.invoice.reminder.title": "Zahlungserinnerung",
  "notify.invoice.reminder.body": "Die Rechnung {number} über {amount} ist noch offen (fällig seit {date}). Falls du bereits bezahlt hast, ist diese Nachricht hinfällig.",
  "notify.invoice.reminder.subject": "{club}: Zahlungserinnerung Rechnung {number}",
};
export default de;
