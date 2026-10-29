/** Mailtexte der Plattform (Passwort, Einladungen, 2FA, Testmail). Platzhalter: {name}. */
const de: Record<string, string> = {
  "mail.footer": "Diese Nachricht wurde automatisch von Standchef versendet. Bitte nicht direkt auf diese Adresse antworten, ausser der Verein hat eine Antwortadresse hinterlegt.",
  "mail.greeting": "Hallo {name}",
  "mail.greetingAnon": "Hallo",

  "mail.reset.subject": "Passwort zurücksetzen",
  "mail.reset.title": "Neues Passwort festlegen",
  "mail.reset.p1": "Für dein Standchef-Konto wurde ein neues Passwort angefordert.",
  "mail.reset.p2": "Der Link ist {minutes} Minuten gültig und kann nur einmal verwendet werden.",
  "mail.reset.p3": "Hast du das nicht angefordert? Dann kannst du diese Mail ignorieren – dein Passwort bleibt unverändert.",
  "mail.reset.button": "Passwort festlegen",

  "mail.invite.subject": "Einladung: {tenant} auf Standchef",
  "mail.invite.title": "Du bist eingeladen",
  "mail.invite.p1": "{inviter} lädt dich ein, «{tenant}» auf Standchef beizutreten.",
  "mail.invite.p1anon": "Du wurdest eingeladen, «{tenant}» auf Standchef beizutreten.",
  "mail.invite.p2": "Deine Rolle: {role}. Mit Standchef siehst du Anlässe, Resultate, Reservationen und Rechnungen deines Vereins an einem Ort.",
  "mail.invite.p3": "Die Einladung ist {days} Tage gültig.",
  "mail.invite.button": "Einladung annehmen",

  "mail.setPassword.subject": "Dein Zugang zu {tenant}",
  "mail.setPassword.subjectNoTenant": "Dein Zugang zu Standchef",
  "mail.setPassword.title": "Passwort festlegen",
  "mail.setPassword.p1": "Für dich wurde ein Konto bei Standchef angelegt{tenantPart}.",
  "mail.setPassword.tenantPart": " – Verein «{tenant}»",
  "mail.setPassword.p2": "Lege jetzt dein Passwort fest. Danach meldest du dich mit deiner E-Mail-Adresse {email} an.",
  "mail.setPassword.p3": "Der Link ist {days} Tage gültig.",
  "mail.setPassword.button": "Passwort festlegen",

  "mail.passwordChanged.subject": "Dein Passwort wurde geändert",
  "mail.passwordChanged.title": "Passwort geändert",
  "mail.passwordChanged.p1": "Das Passwort deines Standchef-Kontos wurde soeben geändert. Andere Geräte wurden abgemeldet.",
  "mail.passwordChanged.p2": "Warst du das nicht? Dann setze dein Passwort sofort über «Passwort vergessen» zurück und informiere deinen Vereinsadmin.",

  "mail.twofaOn.subject": "Zwei-Faktor-Anmeldung aktiviert",
  "mail.twofaOn.title": "Zwei-Faktor-Anmeldung ist aktiv",
  "mail.twofaOn.p1": "Für dein Konto ist jetzt die Anmeldung mit Code aus der Authenticator-App aktiv. Bewahre deine Wiederherstellungscodes sicher auf.",
  "mail.twofaOff.subject": "Zwei-Faktor-Anmeldung deaktiviert",
  "mail.twofaOff.title": "Zwei-Faktor-Anmeldung ist aus",
  "mail.twofaOff.p1": "Für dein Konto wurde die Zwei-Faktor-Anmeldung ausgeschaltet. Warst du das nicht, ändere sofort dein Passwort.",
  "mail.security.button": "Sicherheit öffnen",

  "mail.test.subject": "Testmail von Standchef",
  "mail.test.title": "Der Mailversand funktioniert",
  "mail.test.p1": "Diese Testmail wurde in der Systemübersicht ausgelöst. Wenn du sie liest, ist der SMTP-Versand korrekt eingerichtet.",

  "role.OWNER": "Inhaber",
  "role.ADMIN": "Admin",
  "role.TRAINER": "Trainer",
  "role.MEMBER": "Mitglied",
};

const fr: Record<string, string> = {
  "mail.footer": "Ce message a été envoyé automatiquement par Standchef. Merci de ne pas répondre directement à cette adresse, sauf si la société a indiqué une adresse de réponse.",
  "mail.greeting": "Bonjour {name}",
  "mail.greetingAnon": "Bonjour",

  "mail.reset.subject": "Réinitialiser le mot de passe",
  "mail.reset.title": "Définir un nouveau mot de passe",
  "mail.reset.p1": "Un nouveau mot de passe a été demandé pour ton compte Standchef.",
  "mail.reset.p2": "Le lien est valable {minutes} minutes et ne peut être utilisé qu'une seule fois.",
  "mail.reset.p3": "Tu n'as rien demandé ? Tu peux ignorer ce message – ton mot de passe reste inchangé.",
  "mail.reset.button": "Définir le mot de passe",

  "mail.invite.subject": "Invitation : {tenant} sur Standchef",
  "mail.invite.title": "Tu es invité·e",
  "mail.invite.p1": "{inviter} t'invite à rejoindre « {tenant} » sur Standchef.",
  "mail.invite.p1anon": "Tu as été invité·e à rejoindre « {tenant} » sur Standchef.",
  "mail.invite.p2": "Ton rôle : {role}. Avec Standchef, tu retrouves les manifestations, résultats, réservations et factures de ta société au même endroit.",
  "mail.invite.p3": "L'invitation est valable {days} jours.",
  "mail.invite.button": "Accepter l'invitation",

  "mail.setPassword.subject": "Ton accès à {tenant}",
  "mail.setPassword.subjectNoTenant": "Ton accès à Standchef",
  "mail.setPassword.title": "Définir le mot de passe",
  "mail.setPassword.p1": "Un compte Standchef a été créé pour toi{tenantPart}.",
  "mail.setPassword.tenantPart": " – société « {tenant} »",
  "mail.setPassword.p2": "Définis maintenant ton mot de passe. Ensuite, tu te connectes avec ton adresse e-mail {email}.",
  "mail.setPassword.p3": "Le lien est valable {days} jours.",
  "mail.setPassword.button": "Définir le mot de passe",

  "mail.passwordChanged.subject": "Ton mot de passe a été modifié",
  "mail.passwordChanged.title": "Mot de passe modifié",
  "mail.passwordChanged.p1": "Le mot de passe de ton compte Standchef vient d'être modifié. Les autres appareils ont été déconnectés.",
  "mail.passwordChanged.p2": "Ce n'était pas toi ? Réinitialise immédiatement ton mot de passe via « Mot de passe oublié » et informe l'administrateur de ta société.",

  "mail.twofaOn.subject": "Connexion à deux facteurs activée",
  "mail.twofaOn.title": "La connexion à deux facteurs est active",
  "mail.twofaOn.p1": "La connexion avec un code de l'application d'authentification est désormais active pour ton compte. Conserve tes codes de récupération en lieu sûr.",
  "mail.twofaOff.subject": "Connexion à deux facteurs désactivée",
  "mail.twofaOff.title": "La connexion à deux facteurs est désactivée",
  "mail.twofaOff.p1": "La connexion à deux facteurs a été désactivée pour ton compte. Si ce n'était pas toi, change immédiatement ton mot de passe.",
  "mail.security.button": "Ouvrir la sécurité",

  "mail.test.subject": "E-mail de test de Standchef",
  "mail.test.title": "L'envoi d'e-mails fonctionne",
  "mail.test.p1": "Cet e-mail de test a été déclenché depuis l'aperçu système. Si tu le lis, l'envoi SMTP est correctement configuré.",

  "role.OWNER": "Propriétaire",
  "role.ADMIN": "Admin",
  "role.TRAINER": "Moniteur",
  "role.MEMBER": "Membre",
};

const it: Record<string, string> = {
  "mail.footer": "Questo messaggio è stato inviato automaticamente da Standchef. Per favore non rispondere direttamente a questo indirizzo, a meno che la società non abbia indicato un indirizzo di risposta.",
  "mail.greeting": "Ciao {name}",
  "mail.greetingAnon": "Ciao",

  "mail.reset.subject": "Reimpostare la password",
  "mail.reset.title": "Impostare una nuova password",
  "mail.reset.p1": "È stata richiesta una nuova password per il tuo account Standchef.",
  "mail.reset.p2": "Il link è valido {minutes} minuti e può essere usato una sola volta.",
  "mail.reset.p3": "Non l'hai richiesto tu? Puoi ignorare questa e-mail – la tua password resta invariata.",
  "mail.reset.button": "Imposta la password",

  "mail.invite.subject": "Invito: {tenant} su Standchef",
  "mail.invite.title": "Sei invitato/a",
  "mail.invite.p1": "{inviter} ti invita a unirti a «{tenant}» su Standchef.",
  "mail.invite.p1anon": "Sei stato/a invitato/a a unirti a «{tenant}» su Standchef.",
  "mail.invite.p2": "Il tuo ruolo: {role}. Con Standchef trovi manifestazioni, risultati, prenotazioni e fatture della tua società in un unico posto.",
  "mail.invite.p3": "L'invito è valido {days} giorni.",
  "mail.invite.button": "Accetta l'invito",

  "mail.setPassword.subject": "Il tuo accesso a {tenant}",
  "mail.setPassword.subjectNoTenant": "Il tuo accesso a Standchef",
  "mail.setPassword.title": "Imposta la password",
  "mail.setPassword.p1": "È stato creato un account Standchef per te{tenantPart}.",
  "mail.setPassword.tenantPart": " – società «{tenant}»",
  "mail.setPassword.p2": "Imposta ora la tua password. Poi accedi con il tuo indirizzo e-mail {email}.",
  "mail.setPassword.p3": "Il link è valido {days} giorni.",
  "mail.setPassword.button": "Imposta la password",

  "mail.passwordChanged.subject": "La tua password è stata modificata",
  "mail.passwordChanged.title": "Password modificata",
  "mail.passwordChanged.p1": "La password del tuo account Standchef è appena stata modificata. Gli altri dispositivi sono stati disconnessi.",
  "mail.passwordChanged.p2": "Non sei stato/a tu? Reimposta subito la password con «Password dimenticata» e informa l'amministratore della tua società.",

  "mail.twofaOn.subject": "Accesso a due fattori attivato",
  "mail.twofaOn.title": "L'accesso a due fattori è attivo",
  "mail.twofaOn.p1": "Per il tuo account è ora attivo l'accesso con codice dall'app di autenticazione. Conserva i codici di recupero in un luogo sicuro.",
  "mail.twofaOff.subject": "Accesso a due fattori disattivato",
  "mail.twofaOff.title": "L'accesso a due fattori è disattivato",
  "mail.twofaOff.p1": "L'accesso a due fattori è stato disattivato per il tuo account. Se non sei stato/a tu, cambia subito la password.",
  "mail.security.button": "Apri sicurezza",

  "mail.test.subject": "E-mail di prova da Standchef",
  "mail.test.title": "L'invio di e-mail funziona",
  "mail.test.p1": "Questa e-mail di prova è stata avviata dalla panoramica di sistema. Se la stai leggendo, l'invio SMTP è configurato correttamente.",

  "role.OWNER": "Titolare",
  "role.ADMIN": "Admin",
  "role.TRAINER": "Monitore",
  "role.MEMBER": "Membro",
};

const dict: { de: Record<string, string>; fr: Record<string, string>; it: Record<string, string> } = { de, fr, it };
export default dict;
