/**
 * Zusatz-Wörterbuch «aihelp» (Welle E): Hilfe-Assistent, Plattform-Support und die allgemeinen
 * KI-Meldungen ai.unavailable.* / ai.error.* (Schlüssel aus @/lib/ai/types).
 * Französisch: normale Leerzeichen bei « » ? ! ; : – frenchSpacing() setzt die geschützten.
 */
import { frenchSpacing } from "./shell";

type Row = readonly [de: string, fr: string, it: string, en: string];

const ROWS: Record<string, Row> = {
  // Chat
  "aihelp.chat.intro": [
    "Frag mich, wie etwas in Standchef funktioniert – zum Beispiel, wo du etwas findest oder wie du etwas erledigst.",
    "Demande-moi comment fonctionne quelque chose dans Standchef – par exemple où trouver une fonction ou comment faire quelque chose.",
    "Chiedimi come funziona qualcosa in Standchef – per esempio dove trovi una funzione o come fare qualcosa.",
    "Ask me how something works in Standchef – for example where to find something or how to get something done.",
  ],
  "aihelp.chat.placeholder": ["Deine Frage …", "Ta question …", "La tua domanda …", "Your question …"],
  "aihelp.chat.inputLabel": ["Frage an den Assistenten", "Question à l’assistant", "Domanda all’assistente", "Question for the assistant"],
  "aihelp.chat.send": ["Senden", "Envoyer", "Invia", "Send"],
  "aihelp.chat.stop": ["Antwort stoppen", "Arrêter la réponse", "Interrompi la risposta", "Stop answer"],
  "aihelp.chat.thinking": ["Antwort wird geschrieben", "Réponse en cours de rédaction", "Risposta in preparazione", "Writing answer"],
  "aihelp.chat.disclaimer": [
    "Antworten von Claude (KI) können Fehler enthalten.",
    "Les réponses de Claude (IA) peuvent contenir des erreurs.",
    "Le risposte di Claude (IA) possono contenere errori.",
    "Answers from Claude (AI) may contain mistakes.",
  ],
  "aihelp.chat.newChat": ["Neues Gespräch", "Nouvelle conversation", "Nuova conversazione", "New conversation"],

  // Panel und schwebender Knopf
  "aihelp.panel.title": ["Hilfe-Assistent", "Assistant d’aide", "Assistente di aiuto", "Help assistant"],
  "aihelp.panel.subtitle": [
    "Beantwortet Fragen zur Bedienung von Standchef. Für Preise, Zeiten und Regeln deines Vereins zeigt er dir, wo du nachschauen kannst.",
    "Répond aux questions sur l’utilisation de Standchef. Pour les prix, horaires et règles de ta société, il t’indique où regarder.",
    "Risponde a domande sull’uso di Standchef. Per prezzi, orari e regole della tua società ti indica dove guardare.",
    "Answers questions about using Standchef. For your club’s prices, times and rules, it shows you where to look.",
  ],
  "aihelp.launcher.label": ["Fragen?", "Des questions ?", "Domande?", "Questions?"],

  // Vorschläge
  "aihelp.suggest.inviteMembers": [
    "Wie lade ich neue Mitglieder ein?",
    "Comment inviter de nouveaux membres ?",
    "Come invito nuovi membri?",
    "How do I invite new members?",
  ],
  "aihelp.suggest.booking": ["Wie reserviere ich eine Bahn?", "Comment réserver une ligne de tir ?", "Come prenoto una linea di tiro?", "How do I book a lane?"],
  "aihelp.suggest.scores": ["Wie erfasse ich meine Resultate?", "Comment saisir mes résultats ?", "Come registro i miei risultati?", "How do I record my results?"],
  "aihelp.suggest.events": ["Wo melde ich mich für einen Anlass an?", "Où m’inscrire à une manifestation ?", "Dove mi iscrivo a un evento?", "Where do I sign up for an event?"],
  "aihelp.suggest.offline": ["Funktioniert die App auch ohne Internet?", "L’app fonctionne-t-elle sans Internet ?", "L’app funziona anche senza Internet?", "Does the app work without internet?"],

  // Freundliche Meldungen im Vereins-Chat
  "aihelp.unavailable.notSetUp": [
    "Der Verein hat Claude noch nicht eingerichtet. Die Hilfe-Artikel unten beantworten die meisten Fragen.",
    "La société n’a pas encore configuré Claude. Les articles d’aide ci-dessous répondent à la plupart des questions.",
    "La società non ha ancora configurato Claude. Gli articoli di aiuto qui sotto rispondono alla maggior parte delle domande.",
    "Your club has not set up Claude yet. The help articles below answer most questions.",
  ],
  "aihelp.unavailable.limitReached": [
    "Das Monatskontingent des Vereins für den Assistenten ist aufgebraucht. Ab nächstem Monat geht es weiter – bis dahin helfen die Artikel unten.",
    "Le contingent mensuel de la société pour l’assistant est épuisé. Il sera de nouveau disponible le mois prochain – d’ici là, les articles ci-dessous t’aident.",
    "Il contingente mensile della società per l’assistente è esaurito. Sarà di nuovo disponibile il mese prossimo – nel frattempo ti aiutano gli articoli qui sotto.",
    "Your club’s monthly allowance for the assistant is used up. It will be available again next month – until then, the articles below can help.",
  ],
  "aihelp.unavailable.noAccess": [
    "Der Verein hat den Assistenten nur für Trainer und den Vorstand freigegeben.",
    "La société a réservé l’assistant aux entraîneurs et au comité.",
    "La società ha riservato l’assistente agli allenatori e al comitato.",
    "Your club has made the assistant available to trainers and the committee only.",
  ],
  "aihelp.error.invalidKey": [
    "Der Zugang des Vereins zu Claude funktioniert gerade nicht. Bitte informiere den Vorstand.",
    "L’accès de la société à Claude ne fonctionne pas pour le moment. Merci d’en informer le comité.",
    "L’accesso della società a Claude al momento non funziona. Per favore informa il comitato.",
    "Your club’s access to Claude is not working at the moment. Please let the committee know.",
  ],
  "aihelp.error.rateLimited": [
    "Du hast in kurzer Zeit viele Fragen gestellt. Bitte warte ein paar Minuten.",
    "Tu as posé beaucoup de questions en peu de temps. Merci d’attendre quelques minutes.",
    "Hai fatto molte domande in poco tempo. Attendi qualche minuto.",
    "You have asked a lot of questions in a short time. Please wait a few minutes.",
  ],
  "aihelp.error.signedOut": [
    "Du bist nicht mehr angemeldet. Bitte lade die Seite neu.",
    "Tu n’es plus connecté. Merci de recharger la page.",
    "Non sei più connesso. Ricarica la pagina.",
    "You are no longer signed in. Please reload the page.",
  ],

  // Hinweis für Admins auf /help
  "aihelp.setup.title": ["Hilfe-Assistent mit Claude", "Assistant d’aide avec Claude", "Assistente di aiuto con Claude", "Help assistant with Claude"],
  "aihelp.setup.text": [
    "Mitglieder können hier Fragen zur App stellen, sobald der Verein Claude eingerichtet und die Funktion «Hilfe» eingeschaltet hat.",
    "Les membres peuvent poser ici des questions sur l’app dès que la société a configuré Claude et activé la fonction « Aide ».",
    "I membri possono porre qui domande sull’app non appena la società ha configurato Claude e attivato la funzione «Aiuto».",
    "Members can ask questions about the app here once the club has set up Claude and switched on the “Help” feature.",
  ],
  "aihelp.setup.link": ["KI-Einstellungen öffnen", "Ouvrir les réglages IA", "Apri le impostazioni IA", "Open AI settings"],

  // Plattform-Support
  "aihelp.support.title": ["Support-Assistent", "Assistant de support", "Assistente di supporto", "Support assistant"],
  "aihelp.support.subtitle": [
    "Fragen von Vereinen beantworten – anhand der Dokumentation und der Hilfe-Artikel.",
    "Répondre aux questions des sociétés – à l’aide de la documentation et des articles d’aide.",
    "Rispondere alle domande delle società – in base alla documentazione e agli articoli di aiuto.",
    "Answer questions from clubs – based on the documentation and the help articles.",
  ],
  "aihelp.support.back": ["Plattform", "Plateforme", "Piattaforma", "Platform"],
  "aihelp.support.intro": [
    "Beschreibe die Frage eines Vereins. Ich erkläre, wie es in Standchef funktioniert, und formuliere auf Wunsch eine Antwort.",
    "Décris la question d’une société. J’explique comment cela fonctionne dans Standchef et rédige une réponse si tu le souhaites.",
    "Descrivi la domanda di una società. Spiego come funziona in Standchef e, se vuoi, formulo una risposta.",
    "Describe a club’s question. I explain how it works in Standchef and draft a reply if you like.",
  ],
  "aihelp.support.placeholder": ["Frage eines Vereins …", "Question d’une société …", "Domanda di una società …", "A club’s question …"],
  "aihelp.support.suggest.payments": [
    "Wie richtet ein Verein Online-Zahlungen für Reservationen ein?",
    "Comment une société configure-t-elle les paiements en ligne pour les réservations ?",
    "Come configura una società i pagamenti online per le prenotazioni?",
    "How does a club set up online payments for bookings?",
  ],
  "aihelp.support.suggest.ai": [
    "Was braucht ein Verein, um den KI-Assistenten zu nutzen?",
    "De quoi une société a-t-elle besoin pour utiliser l’assistant IA ?",
    "Di cosa ha bisogno una società per usare l’assistente IA?",
    "What does a club need to use the AI assistant?",
  ],
  "aihelp.support.suggest.reply": [
    "Formuliere eine kurze Antwort: Mitglieder bekommen keine E-Mails.",
    "Rédige une réponse courte : les membres ne reçoivent pas d’e-mails.",
    "Formula una breve risposta: i membri non ricevono e-mail.",
    "Draft a short reply: members are not receiving e-mails.",
  ],
  "aihelp.support.offTitle": ["Support-Assistent nicht verfügbar", "Assistant de support indisponible", "Assistente di supporto non disponibile", "Support assistant not available"],
  "aihelp.support.settingsLink": ["Zu den KI-Einstellungen", "Vers les réglages IA", "Alle impostazioni IA", "Go to AI settings"],

  // Allgemein: KI nicht verfügbar (ai.unavailable.<reason>)
  "ai.unavailable.platformOff": [
    "Die KI-Funktionen der Plattform sind ausgeschaltet.",
    "Les fonctions IA de la plateforme sont désactivées.",
    "Le funzioni IA della piattaforma sono disattivate.",
    "The platform’s AI features are switched off.",
  ],
  "ai.unavailable.clubsNotAllowed": [
    "KI-Funktionen für Vereine sind auf dieser Plattform nicht freigegeben.",
    "Les fonctions IA pour les sociétés ne sont pas autorisées sur cette plateforme.",
    "Le funzioni IA per le società non sono abilitate su questa piattaforma.",
    "AI features for clubs are not enabled on this platform.",
  ],
  "ai.unavailable.clubOff": [
    "Der KI-Assistent ist im Verein ausgeschaltet.",
    "L’assistant IA est désactivé dans la société.",
    "L’assistente IA è disattivato nella società.",
    "The AI assistant is switched off in this club.",
  ],
  "ai.unavailable.noKey": [
    "Es ist noch kein Claude-API-Schlüssel hinterlegt.",
    "Aucune clé API Claude n’est encore enregistrée.",
    "Non è ancora stata registrata una chiave API Claude.",
    "No Claude API key has been saved yet.",
  ],
  "ai.unavailable.featureOff": [
    "Diese KI-Funktion ist ausgeschaltet.",
    "Cette fonction IA est désactivée.",
    "Questa funzione IA è disattivata.",
    "This AI feature is switched off.",
  ],
  "ai.unavailable.limitReached": [
    "Das monatliche KI-Kontingent ist aufgebraucht.",
    "Le contingent IA mensuel est épuisé.",
    "Il contingente IA mensile è esaurito.",
    "The monthly AI allowance is used up.",
  ],
  "ai.unavailable.noConsent": [
    "Der Verein hat der Nutzung von Claude noch nicht zugestimmt.",
    "La société n’a pas encore accepté l’utilisation de Claude.",
    "La società non ha ancora acconsentito all’uso di Claude.",
    "The club has not yet agreed to the use of Claude.",
  ],
  "ai.unavailable.noAccess": [
    "Du hast keinen Zugriff auf diese KI-Funktion.",
    "Tu n’as pas accès à cette fonction IA.",
    "Non hai accesso a questa funzione IA.",
    "You do not have access to this AI feature.",
  ],

  // Allgemein: Fehler beim Aufruf (ai.error.<code>)
  "ai.error.invalidKey": [
    "Der Claude-API-Schlüssel ist ungültig oder hat keine Berechtigung.",
    "La clé API Claude est invalide ou n’a pas les autorisations nécessaires.",
    "La chiave API Claude non è valida o non ha le autorizzazioni necessarie.",
    "The Claude API key is invalid or lacks permission.",
  ],
  "ai.error.rateLimited": [
    "Zu viele Anfragen. Bitte versuche es in einem Moment nochmals.",
    "Trop de demandes. Merci de réessayer dans un instant.",
    "Troppe richieste. Riprova tra un momento.",
    "Too many requests. Please try again in a moment.",
  ],
  "ai.error.refused": [
    "Dazu kann Claude keine Antwort geben. Bitte formuliere die Frage anders.",
    "Claude ne peut pas répondre à cela. Merci de reformuler la question.",
    "Claude non può rispondere a questo. Riformula la domanda.",
    "Claude cannot answer that. Please rephrase the question.",
  ],
  "ai.error.overloaded": [
    "Claude ist gerade überlastet. Bitte versuche es später nochmals.",
    "Claude est actuellement surchargé. Merci de réessayer plus tard.",
    "Claude è momentaneamente sovraccarico. Riprova più tardi.",
    "Claude is overloaded right now. Please try again later.",
  ],
  "ai.error.badRequest": [
    "Die Anfrage konnte nicht verarbeitet werden (z.B. zu lang).",
    "La demande n’a pas pu être traitée (p. ex. trop longue).",
    "La richiesta non ha potuto essere elaborata (p. es. troppo lunga).",
    "The request could not be processed (e.g. too long).",
  ],
  "ai.error.network": [
    "Keine Verbindung zu Claude. Bitte prüfe die Internetverbindung und versuche es nochmals.",
    "Pas de connexion à Claude. Vérifie ta connexion Internet et réessaie.",
    "Nessuna connessione a Claude. Controlla la connessione Internet e riprova.",
    "No connection to Claude. Please check your internet connection and try again.",
  ],
  "ai.error.invalidOutput": [
    "Die Antwort von Claude war unbrauchbar. Bitte versuche es nochmals.",
    "La réponse de Claude était inutilisable. Merci de réessayer.",
    "La risposta di Claude non era utilizzabile. Riprova.",
    "Claude’s answer could not be used. Please try again.",
  ],
  "ai.error.aborted": ["Abgebrochen.", "Interrompu.", "Interrotto.", "Cancelled."],
  "ai.error.unknown": [
    "Etwas ist schiefgelaufen. Bitte versuche es nochmals.",
    "Une erreur s’est produite. Merci de réessayer.",
    "Qualcosa è andato storto. Riprova.",
    "Something went wrong. Please try again.",
  ],
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
