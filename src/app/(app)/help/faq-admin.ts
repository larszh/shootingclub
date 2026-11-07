import type { FaqSource } from "./faq-types";

/** Hilfe für Leitung und Vorstand (Deutsch, Französisch, Italienisch, Englisch). Auszeichnung siehe faq-types.ts. */
export const ADMIN_FAQ: FaqSource[] = [
  {
    id: "logo-farben",
    audience: "admin",
    de: {
      q: "Wie setze ich Logo und Vereinsfarben?",
      keywords: "Logo Farben Akzentfarbe Markenfarbe CI Corporate Design Branding Verein Einstellungen Zweitfarbe",
      a: [
        {
          ol: [
            "Unter [Verein](/admin) das Logo hochladen (quadratisch wirkt am besten, PNG oder JPG).",
            "Akzentfarbe und optional Zweitfarbe wählen. Die App passt Knöpfe, Hervorhebungen und die Browserleiste an – hell und dunkel.",
          ],
        },
        { p: "Mit dem Knopf «Standard» kehrst du jederzeit zu den Standchef-Farben zurück." },
      ],
    },
    fr: {
      q: "Comment définir le logo et les couleurs de la société ?",
      keywords: "logo couleurs couleur d’accent couleur de marque CI identité visuelle branding société réglages deuxième couleur",
      a: [
        {
          ol: [
            "Sous [Société](/admin), télécharge le logo (un format carré rend le mieux, PNG ou JPG).",
            "Choisis la couleur d’accent et, si tu veux, une deuxième couleur. L’app adapte les boutons, les mises en évidence et la barre du navigateur – en clair comme en sombre.",
          ],
        },
        { p: "Avec le bouton « Standard », tu reviens à tout moment aux couleurs de Standchef." },
      ],
    },
    it: {
      q: "Come imposto il logo e i colori della società?",
      keywords: "logo colori colore d’accento colore del marchio CI immagine coordinata branding società impostazioni secondo colore",
      a: [
        {
          ol: [
            "In [Società](/admin) carica il logo (un formato quadrato rende meglio, PNG o JPG).",
            "Scegli il colore d’accento e, se vuoi, un secondo colore. L’app adatta pulsanti, evidenziazioni e la barra del browser – in chiaro e in scuro.",
          ],
        },
        { p: "Con il pulsante «Standard» torni in qualsiasi momento ai colori di Standchef." },
      ],
    },
    en: {
      q: "How do I set the logo and club colours?",
      keywords: "logo colours accent colour brand colour CI corporate design branding club settings secondary colour",
      a: [
        {
          ol: [
            "Upload the logo under [Club](/admin) (square works best, PNG or JPG).",
            "Choose an accent colour and optionally a secondary colour. The app adapts buttons, highlights and the browser bar – light and dark.",
          ],
        },
        { p: "With the “Default” button you can return to the Standchef colours at any time." },
      ],
    },
  },
  {
    id: "mitglieder",
    audience: "admin",
    de: {
      q: "Wie lade ich Mitglieder ein und vergebe Rollen?",
      keywords: "Mitglieder einladen Beitrittscode Link teilen Rollen Admin Trainer Inhaber Mitglied entfernen",
      a: [
        { p: "Unter [Verein](/admin) findest du Beitrittscode und Einladungslink zum Teilen (z.B. per WhatsApp oder E-Mail). Unter [Mitglieder](/admin/members) fügst du bestehende Konten per E-Mail hinzu und vergibst Rollen." },
        {
          ul: [
            "**Mitglied**: eigene Resultate, Scheiben, Reservationen.",
            "**Trainer**: sieht alle Resultate, führt Anlässe.",
            "**Admin**: verwaltet Verein, Module, Mitglieder, Beiträge.",
            "**Inhaber**: wie Admin, darf zusätzlich Inhaber ernennen.",
          ],
        },
        { p: "Wurde der Code weitergegeben, kannst du einen neuen erzeugen – der alte gilt dann nicht mehr." },
      ],
    },
    fr: {
      q: "Comment inviter des membres et attribuer des rôles ?",
      keywords: "inviter des membres code d’adhésion partager le lien rôles admin entraîneur propriétaire retirer un membre",
      a: [
        { p: "Sous [Société](/admin), tu trouves le code d’adhésion et le lien d’invitation à partager (p. ex. par WhatsApp ou e-mail). Sous [Membres](/admin/members), tu ajoutes des comptes existants par e-mail et tu attribues des rôles." },
        {
          ul: [
            "**Membre** : ses propres résultats, cibles, réservations.",
            "**Entraîneur** : voit tous les résultats, dirige les manifestations.",
            "**Admin** : gère la société, les modules, les membres, les cotisations.",
            "**Propriétaire** : comme admin, peut en plus nommer des propriétaires.",
          ],
        },
        { p: "Si le code a été diffusé, tu peux en générer un nouveau – l’ancien n’est alors plus valable." },
      ],
    },
    it: {
      q: "Come invito i membri e assegno i ruoli?",
      keywords: "invitare membri codice di adesione condividere link ruoli admin allenatore titolare rimuovere membro",
      a: [
        { p: "In [Società](/admin) trovi il codice di adesione e il link d’invito da condividere (p. es. via WhatsApp o e-mail). In [Membri](/admin/members) aggiungi account esistenti per e-mail e assegni i ruoli." },
        {
          ul: [
            "**Membro**: i propri risultati, bersagli, prenotazioni.",
            "**Allenatore**: vede tutti i risultati, gestisce gli eventi.",
            "**Admin**: gestisce società, moduli, membri, quote.",
            "**Titolare**: come admin, può inoltre nominare titolari.",
          ],
        },
        { p: "Se il codice è stato diffuso, puoi generarne uno nuovo – quello vecchio non vale più." },
      ],
    },
    en: {
      q: "How do I invite members and assign roles?",
      keywords: "invite members join code share link roles admin trainer owner member remove",
      a: [
        { p: "Under [Club](/admin) you will find the join code and invitation link to share (e.g. via WhatsApp or email). Under [Members](/admin/members) you add existing accounts by email and assign roles." },
        {
          ul: [
            "**Member**: own results, targets, bookings.",
            "**Trainer**: sees all results, runs events.",
            "**Admin**: manages the club, modules, members, fees.",
            "**Owner**: like admin, can also appoint owners.",
          ],
        },
        { p: "If the code has been passed on, you can generate a new one – the old one then no longer works." },
      ],
    },
  },
  {
    id: "zahlungsanbieter",
    audience: "admin",
    de: {
      q: "Wie richte ich Online-Zahlung (Payrexx/TWINT, Stripe, Worldline, SumUp) ein?",
      keywords: "Zahlungsanbieter Online-Zahlung Payrexx TWINT PostFinance Stripe Worldline Saferpay SumUp Kreditkarte API Secret Instanz Webhook Beiträge Reservationen",
      a: [
        {
          ol: [
            "Unter [Reservationen → Zahlungsanbieter](/admin/bookings/payments) (ohne Modul «Reservationen»: [Rechnungsprofil](/admin/billing/settings)) den Anbieter wählen und die Zugangsdaten aus deinem Händlerkonto eintragen. Geheimnisse werden verschlüsselt gespeichert und nie wieder angezeigt.",
            "**Payrexx**: Instanzname (der Teil vor `.payrexx.com`) und API-Secret eintragen, «Verbindung testen». Im Payrexx-Backend unter Webhooks die angezeigte Adresse `/api/payments/payrexx/<Vereins-ID>` hinterlegen (Typ Transaktion). Zuschläge für Zahlende ausgeschaltet lassen.",
            "**Stripe**: die angezeigte Webhook-Adresse im Stripe-Dashboard hinterlegen (Ereignis checkout.session.completed).",
            "Für Reservationen: in den [Reservations-Einstellungen](/admin/bookings/settings) «Online-Zahlung» aktivieren und den Anbieter wählen.",
            "Für Beiträge: im [Rechnungsprofil](/admin/billing/settings) unter «Online-Zahlung für Beiträge» den Anbieter wählen.",
          ],
        },
        { p: "Das Geld fliesst direkt auf das Konto des Vereins; die Anbieter verrechnen dafür Gebühren. Munitionsrechnungen sind nie online bezahlbar (nur QR-Rechnung). Bitte vor dem Start eine Testzahlung machen." },
      ],
    },
    fr: {
      q: "Comment configurer le paiement en ligne (Payrexx/TWINT, Stripe, Worldline, SumUp) ?",
      keywords: "prestataire de paiement paiement en ligne Payrexx TWINT PostFinance Stripe Worldline Saferpay SumUp carte de crédit API secret instance webhook cotisations réservations",
      a: [
        {
          ol: [
            "Sous [Réservations → Prestataire de paiement](/admin/bookings/payments) (sans le module « Réservations » : [Profil de facturation](/admin/billing/settings)), choisis le prestataire et saisis les données d’accès de ton compte marchand. Les secrets sont enregistrés chiffrés et ne sont plus jamais affichés.",
            "**Payrexx** : saisis le nom de l’instance (la partie avant `.payrexx.com`) et l’API secret, puis « Tester la connexion ». Dans le back-end Payrexx, sous Webhooks, enregistre l’adresse affichée `/api/payments/payrexx/<ID de la société>` (type transaction). Laisse désactivés les suppléments pour les payeurs.",
            "**Stripe** : enregistre l’adresse webhook affichée dans le tableau de bord Stripe (événement checkout.session.completed).",
            "Pour les réservations : dans les [réglages des réservations](/admin/bookings/settings), active « Paiement en ligne » et choisis le prestataire.",
            "Pour les cotisations : dans le [profil de facturation](/admin/billing/settings), sous « Paiement en ligne des cotisations », choisis le prestataire.",
          ],
        },
        { p: "L’argent arrive directement sur le compte de la société ; les prestataires facturent des frais pour cela. Les factures de munitions ne sont jamais payables en ligne (QR-facture uniquement). Merci d’effectuer un paiement test avant le lancement." },
      ],
    },
    it: {
      q: "Come configuro il pagamento online (Payrexx/TWINT, Stripe, Worldline, SumUp)?",
      keywords: "fornitore di pagamento pagamento online Payrexx TWINT PostFinance Stripe Worldline Saferpay SumUp carta di credito API secret istanza webhook quote prenotazioni",
      a: [
        {
          ol: [
            "In [Prenotazioni → Fornitore di pagamento](/admin/bookings/payments) (senza il modulo «Prenotazioni»: [Profilo di fatturazione](/admin/billing/settings)) scegli il fornitore e inserisci i dati d’accesso del tuo conto commerciante. I segreti vengono salvati cifrati e non vengono mai più mostrati.",
            "**Payrexx**: inserisci il nome dell’istanza (la parte prima di `.payrexx.com`) e l’API secret, poi «Testa connessione». Nel back-end Payrexx, in Webhooks, registra l’indirizzo mostrato `/api/payments/payrexx/<ID della società>` (tipo transazione). Lascia disattivati i supplementi per chi paga.",
            "**Stripe**: registra l’indirizzo webhook mostrato nella dashboard di Stripe (evento checkout.session.completed).",
            "Per le prenotazioni: nelle [impostazioni delle prenotazioni](/admin/bookings/settings) attiva «Pagamento online» e scegli il fornitore.",
            "Per le quote: nel [profilo di fatturazione](/admin/billing/settings), in «Pagamento online delle quote», scegli il fornitore.",
          ],
        },
        { p: "Il denaro arriva direttamente sul conto della società; i fornitori addebitano commissioni. Le fatture delle munizioni non sono mai pagabili online (solo QR-fattura). Esegui un pagamento di prova prima di iniziare." },
      ],
    },
    en: {
      q: "How do I set up online payment (Payrexx/TWINT, Stripe, Worldline, SumUp)?",
      keywords: "payment provider online payment Payrexx TWINT PostFinance Stripe Worldline Saferpay SumUp credit card API secret instance webhook fees bookings",
      a: [
        {
          ol: [
            "Under [Bookings → Payment providers](/admin/bookings/payments) (without the “Bookings” module: [Billing profile](/admin/billing/settings)), choose the provider and enter the credentials from your merchant account. Secrets are stored encrypted and never shown again.",
            "**Payrexx**: enter the instance name (the part before `.payrexx.com`) and API secret, then “Test connection”. In the Payrexx back end under Webhooks, add the address shown `/api/payments/payrexx/<club ID>` (type transaction). Leave surcharges for payers switched off.",
            "**Stripe**: add the webhook address shown in the Stripe dashboard (event checkout.session.completed).",
            "For bookings: in the [booking settings](/admin/bookings/settings), activate “Online payment” and choose the provider.",
            "For fees: in the [billing profile](/admin/billing/settings) under “Online payment for fees”, choose the provider.",
          ],
        },
        { p: "The money goes directly to the club’s account; the providers charge fees for this. Ammunition invoices can never be paid online (QR bill only). Please make a test payment before going live." },
      ],
    },
  },
  {
    id: "rechnungsprofil",
    audience: "admin",
    de: {
      q: "Wie erstelle ich Beitragsrechnungen mit QR-Code?",
      keywords: "Rechnungsprofil IBAN QR-IBAN Zahlungsempfänger Beitragskategorien Jahreslauf Mahnung Erinnerung bezahlt",
      a: [
        {
          ol: [
            "Unter [Rechnungsprofil](/admin/billing/settings) Empfänger, Adresse und IBAN erfassen.",
            "[Kategorien](/admin/billing/categories) anlegen (z.B. Aktiv, Passiv, Jungschützen) und den Mitgliedern zuordnen.",
            "Unter [Beiträge](/admin/billing) den Jahreslauf starten – alle erhalten ihre Rechnung mit QR-Zahlteil.",
          ],
        },
        { p: "Mit einer QR-IBAN wird automatisch eine Referenznummer erzeugt, so lassen sich Zahlungen leicht zuordnen." },
      ],
    },
    fr: {
      q: "Comment établir des factures de cotisation avec code QR ?",
      keywords: "profil de facturation IBAN QR-IBAN bénéficiaire catégories de cotisation facturation annuelle sommation rappel payé",
      a: [
        {
          ol: [
            "Sous [Profil de facturation](/admin/billing/settings), saisis le bénéficiaire, l’adresse et l’IBAN.",
            "Crée des [catégories](/admin/billing/categories) (p. ex. actifs, passifs, jeunes tireurs) et attribue-les aux membres.",
            "Sous [Cotisations](/admin/billing), lance la facturation annuelle – chacun reçoit sa facture avec section de paiement QR.",
          ],
        },
        { p: "Avec un QR-IBAN, un numéro de référence est généré automatiquement, ce qui facilite l’attribution des paiements." },
      ],
    },
    it: {
      q: "Come creo fatture delle quote con codice QR?",
      keywords: "profilo di fatturazione IBAN QR-IBAN beneficiario categorie di quota fatturazione annuale sollecito promemoria pagato",
      a: [
        {
          ol: [
            "In [Profilo di fatturazione](/admin/billing/settings) inserisci beneficiario, indirizzo e IBAN.",
            "Crea le [categorie](/admin/billing/categories) (p. es. attivi, passivi, giovani tiratori) e assegnale ai membri.",
            "In [Quote](/admin/billing) avvia la fatturazione annuale – tutti ricevono la loro fattura con sezione di pagamento QR.",
          ],
        },
        { p: "Con un QR-IBAN viene generato automaticamente un numero di riferimento, così i pagamenti si attribuiscono facilmente." },
      ],
    },
    en: {
      q: "How do I create fee invoices with a QR code?",
      keywords: "billing profile IBAN QR-IBAN payee fee categories annual run reminder paid",
      a: [
        {
          ol: [
            "Under [Billing profile](/admin/billing/settings), enter the payee, address and IBAN.",
            "Create [categories](/admin/billing/categories) (e.g. active, passive, junior shooters) and assign them to the members.",
            "Under [Fees](/admin/billing), start the annual run – everyone receives their invoice with a QR payment part.",
          ],
        },
        { p: "With a QR-IBAN a reference number is generated automatically, which makes it easy to match payments." },
      ],
    },
  },
  {
    id: "speicherort",
    audience: "admin",
    de: {
      q: "Wo werden die Dateien gespeichert? (Server, S3/AWS, Hetzner, Nextcloud)",
      keywords: "Dateiablage Speicherort Speicher Server lokal S3 AWS Amazon Hetzner Object Storage Nextcloud WebDAV App-Passwort Bucket Access Key Kontingent",
      a: [
        { p: "Unter [Dateiablage & Speicherort](/admin/files) wählst du, wo die Dateien des Vereins liegen. Die Zugangsdaten werden verschlüsselt gespeichert." },
        {
          ul: [
            "**Server** (Standard): auf dem Standchef-Server. Nichts einzurichten.",
            "**S3 / AWS**: eigener Bucket bei Amazon, z.B. in Zürich (`eu-central-2`). Bucket, Region, Access Key und Secret Key eintragen. Der Schlüssel braucht nur Lesen, Schreiben und Löschen in diesem Bucket.",
            "**S3 / Hetzner**: Hetzner Object Storage. Standort wählen (Falkenstein, Nürnberg oder Helsinki), dann Bucket und S3-Zugangsschlüssel aus der Hetzner-Konsole eintragen.",
            "**Nextcloud** (WebDAV): Adresse des Ordners, z.B. `https://cloud.example.ch/remote.php/dav/files/verein/Standchef`, Benutzername und ein **App-Passwort** (Nextcloud → Persönliche Einstellungen → Sicherheit → Neues App-Passwort), nicht das normale Passwort.",
          ],
        },
        { p: "Beim Speichern prüft Standchef die Verbindung mit einer kleinen Testdatei. Wechselst du später den Speicherort, werden bestehende Dateien nicht automatisch verschoben." },
      ],
    },
    fr: {
      q: "Où les fichiers sont-ils enregistrés ? (serveur, S3/AWS, Hetzner, Nextcloud)",
      keywords: "fichiers emplacement de stockage stockage serveur local S3 AWS Amazon Hetzner Object Storage Nextcloud WebDAV mot de passe d’app bucket access key quota",
      a: [
        { p: "Sous [Fichiers & emplacement de stockage](/admin/files), tu choisis où se trouvent les fichiers de la société. Les données d’accès sont enregistrées chiffrées." },
        {
          ul: [
            "**Serveur** (par défaut) : sur le serveur Standchef. Rien à configurer.",
            "**S3 / AWS** : propre bucket chez Amazon, p. ex. à Zurich (`eu-central-2`). Saisis le bucket, la région, l’access key et la secret key. La clé n’a besoin que des droits de lecture, d’écriture et de suppression dans ce bucket.",
            "**S3 / Hetzner** : Hetzner Object Storage. Choisis l’emplacement (Falkenstein, Nuremberg ou Helsinki), puis saisis le bucket et la clé d’accès S3 de la console Hetzner.",
            "**Nextcloud** (WebDAV) : adresse du dossier, p. ex. `https://cloud.example.ch/remote.php/dav/files/verein/Standchef`, nom d’utilisateur et un **mot de passe d’app** (Nextcloud → Paramètres personnels → Sécurité → Nouveau mot de passe d’application), pas le mot de passe habituel.",
          ],
        },
        { p: "À l’enregistrement, Standchef vérifie la connexion avec un petit fichier test. Si tu changes plus tard d’emplacement, les fichiers existants ne sont pas déplacés automatiquement." },
      ],
    },
    it: {
      q: "Dove vengono salvati i file? (server, S3/AWS, Hetzner, Nextcloud)",
      keywords: "archivio file posizione di salvataggio memoria server locale S3 AWS Amazon Hetzner Object Storage Nextcloud WebDAV password per app bucket access key quota",
      a: [
        { p: "In [Archivio file e posizione di salvataggio](/admin/files) scegli dove si trovano i file della società. I dati d’accesso vengono salvati cifrati." },
        {
          ul: [
            "**Server** (predefinito): sul server di Standchef. Niente da configurare.",
            "**S3 / AWS**: bucket proprio presso Amazon, p. es. a Zurigo (`eu-central-2`). Inserisci bucket, regione, access key e secret key. La chiave necessita solo dei diritti di lettura, scrittura ed eliminazione in questo bucket.",
            "**S3 / Hetzner**: Hetzner Object Storage. Scegli la sede (Falkenstein, Norimberga o Helsinki), poi inserisci bucket e chiave d’accesso S3 della console Hetzner.",
            "**Nextcloud** (WebDAV): indirizzo della cartella, p. es. `https://cloud.example.ch/remote.php/dav/files/verein/Standchef`, nome utente e una **password per app** (Nextcloud → Impostazioni personali → Sicurezza → Nuova password per applicazione), non la password normale.",
          ],
        },
        { p: "Al salvataggio Standchef verifica la connessione con un piccolo file di prova. Se in seguito cambi posizione, i file esistenti non vengono spostati automaticamente." },
      ],
    },
    en: {
      q: "Where are the files stored? (server, S3/AWS, Hetzner, Nextcloud)",
      keywords: "file storage storage location storage server local S3 AWS Amazon Hetzner Object Storage Nextcloud WebDAV app password bucket access key quota",
      a: [
        { p: "Under [File storage & location](/admin/files) you choose where the club’s files are kept. The credentials are stored encrypted." },
        {
          ul: [
            "**Server** (default): on the Standchef server. Nothing to set up.",
            "**S3 / AWS**: your own bucket at Amazon, e.g. in Zurich (`eu-central-2`). Enter bucket, region, access key and secret key. The key only needs read, write and delete rights in this bucket.",
            "**S3 / Hetzner**: Hetzner Object Storage. Choose the location (Falkenstein, Nuremberg or Helsinki), then enter the bucket and S3 access key from the Hetzner console.",
            "**Nextcloud** (WebDAV): address of the folder, e.g. `https://cloud.example.ch/remote.php/dav/files/verein/Standchef`, user name and an **app password** (Nextcloud → Personal settings → Security → New app password), not the normal password.",
          ],
        },
        { p: "When saving, Standchef checks the connection with a small test file. If you change the storage location later, existing files are not moved automatically." },
      ],
    },
  },
  {
    id: "offene-posten",
    audience: "admin",
    de: {
      q: "Wie behalte ich den Überblick über offene Rechnungen?",
      keywords: "Offene Posten Debitoren überfällig Mahnung Bankimport camt CSV Export Beiträge Reservationen Munition bezahlt markieren",
      a: [
        { p: "Unter [Offene Posten](/admin/payments) siehst du alle unbezahlten Rechnungen aus Beiträgen, Reservationen und Munition mit Summen pro Bereich. Überfällige sind rot markiert, mit «Nur überfällige» filterst du sie. Über «CSV» exportierst du die Liste für die Buchhaltung." },
        { p: "Zahlungen verbuchst du am schnellsten mit dem [Bankimport](/admin/billing/import): Kontoauszug als camt.053 oder camt.054 aus dem E-Banking hochladen. Standchef ordnet die Zahlungen über die QR-Referenz oder Rechnungsnummer und Betrag zu – auch Munitionsrechnungen." },
      ],
    },
    fr: {
      q: "Comment garder une vue d’ensemble des factures ouvertes ?",
      keywords: "postes ouverts débiteurs échu sommation import bancaire camt CSV export cotisations réservations munitions marquer comme payé",
      a: [
        { p: "Sous [Postes ouverts](/admin/payments), tu vois toutes les factures impayées des cotisations, réservations et munitions avec les totaux par domaine. Les factures échues sont marquées en rouge ; « Échues uniquement » les filtre. Avec « CSV », tu exportes la liste pour la comptabilité." },
        { p: "Le plus rapide pour comptabiliser les paiements est l’[import bancaire](/admin/billing/import) : télécharge le relevé de compte camt.053 ou camt.054 de l’e-banking. Standchef attribue les paiements via la référence QR ou le numéro de facture et le montant – y compris les factures de munitions." },
      ],
    },
    it: {
      q: "Come mantengo la visione d’insieme sulle fatture aperte?",
      keywords: "partite aperte debitori scaduto sollecito importazione bancaria camt CSV esportazione quote prenotazioni munizioni segnare come pagato",
      a: [
        { p: "In [Partite aperte](/admin/payments) vedi tutte le fatture non pagate di quote, prenotazioni e munizioni con i totali per ambito. Quelle scadute sono segnate in rosso; con «Solo scadute» le filtri. Con «CSV» esporti l’elenco per la contabilità." },
        { p: "Il modo più rapido per registrare i pagamenti è l’[importazione bancaria](/admin/billing/import): carica l’estratto conto camt.053 o camt.054 dall’e-banking. Standchef attribuisce i pagamenti tramite riferimento QR o numero di fattura e importo – anche per le fatture delle munizioni." },
      ],
    },
    en: {
      q: "How do I keep track of outstanding invoices?",
      keywords: "outstanding items debtors overdue reminder bank import camt CSV export fees bookings ammunition mark as paid",
      a: [
        { p: "Under [Outstanding items](/admin/payments) you see all unpaid invoices from fees, bookings and ammunition with totals per area. Overdue ones are marked in red; filter them with “Overdue only”. Use “CSV” to export the list for the accounts." },
        { p: "The fastest way to record payments is the [bank import](/admin/billing/import): upload the account statement as camt.053 or camt.054 from your e-banking. Standchef matches the payments via the QR reference or invoice number and amount – including ammunition invoices." },
      ],
    },
  },
  {
    id: "munition-admin",
    audience: "admin",
    de: {
      q: "Wie richte ich den Munitionsverkauf ein?",
      keywords: "Munition Sortiment Produkte Kaliber Preis Bestand Ausgabe Ausweis prüfen Freigabe Rechnung Verkauf Theke",
      a: [
        {
          ol: [
            "Modul «Munition» unter [Verein](/admin) einschalten und das [Rechnungsprofil](/admin/billing/settings) mit IBAN ausfüllen.",
            "Unter [Munition verwalten](/admin/ammo) das Sortiment mit Kaliber, Verkaufseinheit und Preis erfassen, optional mit Bestand.",
            "In den Einstellungen festlegen, ob Bestellungen freigegeben werden müssen und ob bei der Abgabe der Ausweis geprüft wird.",
          ],
        },
        { p: "Bei der Abgabe entsteht die Rechnung mit QR-Zahlteil. Barzahlung, Karte oder Online-Zahlung gibt es für Munition bewusst nicht: Die Rechnung dokumentiert jede Abgabe an eine bestimmte Person. Für die Einhaltung der gesetzlichen Vorgaben bleibt der Verein verantwortlich." },
      ],
    },
    fr: {
      q: "Comment configurer la vente de munitions ?",
      keywords: "munitions assortiment produits calibre prix stock remise vérifier pièce d’identité validation facture vente comptoir",
      a: [
        {
          ol: [
            "Active le module « Munitions » sous [Société](/admin) et remplis le [profil de facturation](/admin/billing/settings) avec l’IBAN.",
            "Sous [Gérer les munitions](/admin/ammo), saisis l’assortiment avec calibre, unité de vente et prix, si tu veux avec le stock.",
            "Dans les réglages, définis si les commandes doivent être validées et si la pièce d’identité est vérifiée lors de la remise.",
          ],
        },
        { p: "Lors de la remise, la facture avec section de paiement QR est créée. Le paiement comptant, par carte ou en ligne n’existe volontairement pas pour les munitions : la facture documente chaque remise à une personne précise. La société reste responsable du respect des prescriptions légales." },
      ],
    },
    it: {
      q: "Come configuro la vendita di munizioni?",
      keywords: "munizioni assortimento prodotti calibro prezzo scorte consegna verificare documento approvazione fattura vendita bancone",
      a: [
        {
          ol: [
            "Attiva il modulo «Munizioni» in [Società](/admin) e compila il [profilo di fatturazione](/admin/billing/settings) con l’IBAN.",
            "In [Gestire le munizioni](/admin/ammo) registra l’assortimento con calibro, unità di vendita e prezzo, se vuoi con le scorte.",
            "Nelle impostazioni stabilisci se gli ordini devono essere approvati e se alla consegna si verifica il documento d’identità.",
          ],
        },
        { p: "Alla consegna viene creata la fattura con sezione di pagamento QR. Pagamento in contanti, con carta o online volutamente non esistono per le munizioni: la fattura documenta ogni consegna a una persona precisa. La società resta responsabile del rispetto delle prescrizioni legali." },
      ],
    },
    en: {
      q: "How do I set up ammunition sales?",
      keywords: "ammunition range of products products calibre price stock issue check ID approval invoice sale counter",
      a: [
        {
          ol: [
            "Switch on the “Ammunition” module under [Club](/admin) and fill in the [billing profile](/admin/billing/settings) with the IBAN.",
            "Under [Manage ammunition](/admin/ammo), enter the range of products with calibre, sales unit and price, optionally with stock.",
            "In the settings, decide whether orders must be approved and whether the ID is checked when the ammunition is issued.",
          ],
        },
        { p: "When the ammunition is issued, the invoice with a QR payment part is created. Cash, card or online payment deliberately do not exist for ammunition: the invoice documents every supply to a specific person. The club remains responsible for complying with the legal requirements." },
      ],
    },
  },
  {
    id: "amtlich-bestaetigen",
    audience: "admin",
    de: {
      q: "Wie bestätige ich amtliche Resultate (Obligatorisch, Feldschiessen)?",
      keywords: "amtlich bestätigen Schützenmeister Obligatorisch Feldschiessen Mindestpunktzahl Nuller Versuch SAT-Admin Export Verbliebene Fristen",
      a: [
        {
          ol: [
            "Beim Programm die amtliche Art (OP, FS) und die Bestehensregeln einstellen. Werte bitte mit den aktuellen Vorgaben (VBS/SSV/Kanton) prüfen.",
            "Unter [Bundesübungen](/federal) einen Durchgang zum Obligatorisch-Anlass starten; angemeldete Mitglieder werden übernommen.",
            "Im Durchgang pro Person «Amtlich bestätigen». Danach ist das Resultat für die Schützen gesperrt.",
          ],
        },
        { p: "Für die Meldung gibt es einen CSV-Export und eine Druckliste für SAT-Admin. AHV-Nummern speichert Standchef nicht. Die Verantwortung für die Meldung bleibt beim Schützenmeister." },
      ],
    },
    fr: {
      q: "Comment confirmer des résultats officiels (tir obligatoire, tir en campagne) ?",
      keywords: "confirmer officiellement chef de tir tir obligatoire tir en campagne minimum de points zéros tentative SAT-Admin export restés délais",
      a: [
        {
          ol: [
            "Dans le programme, définis le type officiel (OP, TC) et les règles de réussite. Vérifie les valeurs avec les prescriptions en vigueur (DDPS/FST/canton).",
            "Sous [Tirs fédéraux](/federal), démarre une passe pour la manifestation du tir obligatoire ; les membres inscrits sont repris.",
            "Dans la passe, « Confirmer officiellement » pour chaque personne. Le résultat est ensuite verrouillé pour les tireurs.",
          ],
        },
        { p: "Pour l’annonce, il existe un export CSV et une liste imprimable pour SAT-Admin. Standchef n’enregistre pas de numéros AVS. La responsabilité de l’annonce reste au chef de tir." },
      ],
    },
    it: {
      q: "Come confermo i risultati ufficiali (tiro obbligatorio, tiro in campagna)?",
      keywords: "confermare ufficialmente capo tiro tiro obbligatorio tiro in campagna punteggio minimo zeri tentativo SAT-Admin esportazione rimasti termini",
      a: [
        {
          ol: [
            "Nel programma imposta il tipo ufficiale (OP, TC) e le regole di superamento. Verifica i valori con le prescrizioni vigenti (DDPS/FST/Cantone).",
            "In [Tiri federali](/federal) avvia una sessione per l’evento del tiro obbligatorio; i membri iscritti vengono ripresi.",
            "Nella sessione «Conferma ufficialmente» per ogni persona. In seguito il risultato è bloccato per i tiratori.",
          ],
        },
        { p: "Per la notifica ci sono un’esportazione CSV e un elenco stampabile per SAT-Admin. Standchef non salva numeri AVS. La responsabilità della notifica resta al capo tiro." },
      ],
    },
    en: {
      q: "How do I confirm official results (obligatory programme, field shooting)?",
      keywords: "confirm officially range officer obligatory programme field shooting minimum score zeros attempt SAT-Admin export remaining deadlines",
      a: [
        {
          ol: [
            "In the programme, set the official type (OP, FS) and the pass rules. Please check the values against the current requirements (DDPS/SSV/canton).",
            "Under [Federal exercises](/federal), start a pass for the obligatory programme event; registered members are taken over.",
            "In the pass, tap “Confirm officially” for each person. The result is then locked for the shooters.",
          ],
        },
        { p: "For reporting there is a CSV export and a print list for SAT-Admin. Standchef does not store AHV numbers. Responsibility for the report remains with the range officer." },
      ],
    },
  },
  {
    id: "standbuch",
    audience: "admin",
    de: {
      q: "Wie führe ich als Standchef das Standbuch?",
      keywords: "Standbuch Standchef Standdienst öffnen schliessen Gäste Ausweis Minderjährige Halbtage Vorfall Übergabe",
      a: [
        {
          ol: [
            "Unter [Standbetrieb](/range) «Stand öffnen» – für eine Anlage oder die ganze Anlage.",
            "Mitglieder checken selbst per QR-Code ein, Gäste erfasst du direkt (Name, Jahrgang, «Ausweis geprüft»).",
            "Am Schluss «Tag abschliessen»: Offene Besuche werden ausgecheckt, die Schiesshalbtage werden vorgeschlagen.",
          ],
        },
        { p: "Vorfälle meldest du unter «Vorfälle». Die App hilft beim Dokumentieren, die Verantwortung am Stand bleibt beim Standchef." },
      ],
    },
    fr: {
      q: "Comment tenir le journal du stand en tant que chef de stand ?",
      keywords: "journal du stand chef de stand service de stand ouvrir fermer invités pièce d’identité mineurs demi-journées incident passation",
      a: [
        {
          ol: [
            "Sous [Exploitation du stand](/range), « Ouvrir le stand » – pour une installation ou le stand entier.",
            "Les membres font eux-mêmes le check-in par code QR ; tu saisis directement les invités (nom, année de naissance, « pièce d’identité vérifiée »).",
            "À la fin, « Clôturer la journée » : les visites ouvertes sont clôturées et les demi-journées de tir sont proposées.",
          ],
        },
        { p: "Tu signales les incidents sous « Incidents ». L’app aide à documenter ; la responsabilité au stand reste au chef de stand." },
      ],
    },
    it: {
      q: "Come tengo il registro dello stand come capo stand?",
      keywords: "registro dello stand capo stand servizio allo stand aprire chiudere ospiti documento minorenni mezze giornate incidente consegna",
      a: [
        {
          ol: [
            "In [Gestione dello stand](/range) «Apri lo stand» – per un impianto o per l’intero impianto.",
            "I membri fanno il check-in da soli con il codice QR; gli ospiti li registri direttamente (nome, anno di nascita, «documento verificato»).",
            "Alla fine «Chiudi la giornata»: le visite aperte vengono chiuse e vengono proposte le mezze giornate di tiro.",
          ],
        },
        { p: "Gli incidenti li segnali in «Incidenti». L’app aiuta a documentare, la responsabilità allo stand resta al capo stand." },
      ],
    },
    en: {
      q: "How do I keep the range log as range chief?",
      keywords: "range log range chief range duty open close guests ID minors half-days incident handover",
      a: [
        {
          ol: [
            "Under [Range operations](/range), tap “Open range” – for one range or the whole facility.",
            "Members check themselves in via QR code; you record guests directly (name, year of birth, “ID checked”).",
            "At the end, “Close day”: open visits are checked out and the shooting half-days are suggested.",
          ],
        },
        { p: "You report incidents under “Incidents”. The app helps with documentation; responsibility at the range remains with the range chief." },
      ],
    },
  },
  {
    id: "schiesszeiten",
    audience: "admin",
    de: {
      q: "Wo erfasse ich Standordnung, Schiesszeiten und Kontingent?",
      keywords: "Standordnung Schiesszeiten bewilligt Kontingent Halbtage Reservationen ausserhalb Version veröffentlichen",
      a: [
        { p: "Unter [Standordnung](/admin/range/rules) schreibst und veröffentlichst du die Standordnung; Mitglieder bestätigen sie beim Einchecken. Unter [Schiesszeiten](/admin/range/times) erfasst du die bewilligten Zeiten und das Halbtage-Kontingent pro Jahr." },
        { p: "Reservationen ausserhalb der bewilligten Zeiten werden für Mitglieder abgelehnt. Werte bitte mit der Bewilligung eurer Gemeinde bzw. des Kantons abgleichen." },
      ],
    },
    fr: {
      q: "Où saisir le règlement du stand, les heures de tir et le contingent ?",
      keywords: "règlement du stand heures de tir autorisées contingent demi-journées réservations en dehors version publier",
      a: [
        { p: "Sous [Règlement du stand](/admin/range/rules), tu rédiges et publies le règlement du stand ; les membres le confirment lors du check-in. Sous [Heures de tir](/admin/range/times), tu saisis les heures autorisées et le contingent annuel de demi-journées." },
        { p: "Les réservations en dehors des heures autorisées sont refusées pour les membres. Merci de comparer les valeurs avec l’autorisation de votre commune ou du canton." },
      ],
    },
    it: {
      q: "Dove registro regolamento dello stand, orari di tiro e contingente?",
      keywords: "regolamento dello stand orari di tiro autorizzati contingente mezze giornate prenotazioni fuori versione pubblicare",
      a: [
        { p: "In [Regolamento dello stand](/admin/range/rules) scrivi e pubblichi il regolamento; i membri lo confermano al check-in. In [Orari di tiro](/admin/range/times) registri gli orari autorizzati e il contingente annuale di mezze giornate." },
        { p: "Le prenotazioni fuori dagli orari autorizzati vengono rifiutate per i membri. Confronta i valori con l’autorizzazione del vostro Comune o del Cantone." },
      ],
    },
    en: {
      q: "Where do I enter range rules, shooting hours and quota?",
      keywords: "range rules shooting hours approved quota half-days bookings outside version publish",
      a: [
        { p: "Under [Range rules](/admin/range/rules) you write and publish the range rules; members confirm them when checking in. Under [Shooting hours](/admin/range/times) you enter the approved hours and the half-day quota per year." },
        { p: "Bookings outside the approved hours are declined for members. Please compare the values with the permit from your municipality or canton." },
      ],
    },
  },
  {
    id: "vereinswaffen",
    audience: "admin",
    de: {
      q: "Wie leihe ich eine Vereinswaffe aus?",
      keywords: "Vereinswaffen Ausleihe Quittung Rückgabe Schusszähler Wartung Minderjährige Meldung gesperrt",
      a: [
        { p: "Unter [Vereinswaffen](/weapons) eine verfügbare Waffe öffnen und «Ausleihen» wählen – an ein Mitglied oder mit freiem Namen. Die Quittung kannst du ausdrucken und unterschreiben lassen. Bei der Rückgabe trägst du die Schusszahl ein; ist die Wartung fällig, wird die Waffe automatisch auf «Wartung» gesetzt." },
        { p: "Bei Minderjährigen erinnert die App an eine allfällige Meldefrist. Ob und wie gemeldet werden muss, bitte mit den aktuellen Vorgaben (Waffengesetz, Kanton) prüfen." },
      ],
    },
    fr: {
      q: "Comment prêter une arme de la société ?",
      keywords: "armes de la société prêt quittance retour compteur de coups entretien mineurs annonce bloquée",
      a: [
        { p: "Sous [Armes de la société](/weapons), ouvre une arme disponible et choisis « Prêter » – à un membre ou avec un nom libre. Tu peux imprimer la quittance et la faire signer. Au retour, tu saisis le nombre de coups ; si l’entretien est dû, l’arme passe automatiquement à « Entretien »." },
        { p: "Pour les mineurs, l’app rappelle un éventuel délai d’annonce. Merci de vérifier avec les prescriptions en vigueur (loi sur les armes, canton) si et comment une annonce est nécessaire." },
      ],
    },
    it: {
      q: "Come presto un’arma della società?",
      keywords: "armi della società prestito ricevuta restituzione contacolpi manutenzione minorenni notifica bloccata",
      a: [
        { p: "In [Armi della società](/weapons) apri un’arma disponibile e scegli «Presta» – a un membro o con un nome libero. Puoi stampare la ricevuta e farla firmare. Alla restituzione inserisci il numero di colpi; se la manutenzione è dovuta, l’arma passa automaticamente a «Manutenzione»." },
        { p: "Per i minorenni l’app ricorda un eventuale termine di notifica. Verifica con le prescrizioni vigenti (legge sulle armi, Cantone) se e come occorre notificare." },
      ],
    },
    en: {
      q: "How do I lend out a club weapon?",
      keywords: "club weapons loan receipt return shot counter maintenance minors report blocked",
      a: [
        { p: "Under [Club weapons](/weapons), open an available weapon and choose “Lend” – to a member or with a free-text name. You can print the receipt and have it signed. On return you enter the number of shots; if maintenance is due, the weapon is automatically set to “Maintenance”." },
        { p: "For minors, the app reminds you of any reporting deadline. Please check against the current requirements (Weapons Act, canton) whether and how a report must be made." },
      ],
    },
  },
  {
    id: "munitionskontrolle",
    audience: "admin",
    de: {
      q: "Wie führe ich die Munitionskontrolle?",
      keywords: "Munitionskontrolle Bestand Eingang Abgabe Rücknahme Korrektur Inventur Jahresübersicht Bundesmunition subventioniert",
      a: [
        { p: "Unter [Munitionskontrolle](/admin/ammo/stock) buchst du Eingänge, Abgaben am Stand, Rücknahmen und Korrekturen. Verkäufe über das Munitionsmodul werden automatisch gebucht. Mit der Inventur gleichst du den gezählten Bestand ab." },
        { p: "Die Jahresübersicht zeigt die Bewegungen getrennt nach Finanzierung (Bund, subventioniert, kommerziell) – zum Ausdrucken oder als CSV." },
      ],
    },
    fr: {
      q: "Comment tenir le contrôle des munitions ?",
      keywords: "contrôle des munitions stock entrée remise reprise correction inventaire aperçu annuel munitions fédérales subventionnées",
      a: [
        { p: "Sous [Contrôle des munitions](/admin/ammo/stock), tu comptabilises les entrées, remises au stand, reprises et corrections. Les ventes via le module de munitions sont comptabilisées automatiquement. Avec l’inventaire, tu ajustes le stock compté." },
        { p: "L’aperçu annuel montre les mouvements séparés par financement (Confédération, subventionné, commercial) – à imprimer ou en CSV." },
      ],
    },
    it: {
      q: "Come tengo il controllo delle munizioni?",
      keywords: "controllo delle munizioni scorte entrata consegna ripresa correzione inventario panoramica annuale munizioni federali sovvenzionate",
      a: [
        { p: "In [Controllo delle munizioni](/admin/ammo/stock) registri entrate, consegne allo stand, riprese e correzioni. Le vendite tramite il modulo munizioni vengono registrate automaticamente. Con l’inventario allinei le scorte contate." },
        { p: "La panoramica annuale mostra i movimenti separati per finanziamento (Confederazione, sovvenzionato, commerciale) – da stampare o in CSV." },
      ],
    },
    en: {
      q: "How do I keep the ammunition control?",
      keywords: "ammunition control stock receipt issue return correction stocktaking annual overview federal ammunition subsidised",
      a: [
        { p: "Under [Ammunition control](/admin/ammo/stock) you book receipts, issues at the range, returns and corrections. Sales via the ammunition module are booked automatically. Use stocktaking to reconcile the counted stock." },
        { p: "The annual overview shows the movements separated by funding (federal, subsidised, commercial) – for printing or as CSV." },
      ],
    },
  },
  {
    id: "arbeitsstunden",
    audience: "admin",
    de: {
      q: "Wie plane ich Helfereinsätze und verrechne die Ersatzabgabe?",
      keywords: "Helfereinsätze Schichten planen kopieren Arbeitsstunden Pflicht Ersatzabgabe Rechnung bestätigen erledigt",
      a: [
        {
          ol: [
            "Unter [Helfereinsätze](/admin/shifts) Schichten erfassen – zu einem Anlass oder als Standdienst – und bei Bedarf auf mehrere Daten kopieren.",
            "Nach dem Einsatz «erledigt» bestätigen; die Stunden werden angerechnet.",
            "Unter [Einstellungen](/admin/shifts/settings) Pflichtstunden und Ansatz pro fehlende Stunde festlegen; unter «Stunden» die Ersatzabgabe als QR-Rechnung verrechnen.",
          ],
        },
        { p: "Massgebend sind die Statuten bzw. Beschlüsse eures Vereins." },
      ],
    },
    fr: {
      q: "Comment planifier les engagements bénévoles et facturer la taxe de remplacement ?",
      keywords: "engagements bénévoles équipes planifier copier heures de travail obligatoires taxe de remplacement facture confirmer effectué",
      a: [
        {
          ol: [
            "Sous [Engagements bénévoles](/admin/shifts), saisis des équipes – pour une manifestation ou comme service de stand – et copie-les au besoin sur plusieurs dates.",
            "Après l’engagement, confirme « effectué » ; les heures sont comptabilisées.",
            "Sous [Réglages](/admin/shifts/settings), définis les heures obligatoires et le tarif par heure manquante ; sous « Heures », facture la taxe de remplacement en QR-facture.",
          ],
        },
        { p: "Les statuts ou décisions de votre société font foi." },
      ],
    },
    it: {
      q: "Come pianifico i turni di volontariato e fatturo la tassa sostitutiva?",
      keywords: "turni di volontariato pianificare copiare ore di lavoro obbligatorie tassa sostitutiva fattura confermare svolto",
      a: [
        {
          ol: [
            "In [Turni di volontariato](/admin/shifts) registra i turni – per un evento o come servizio allo stand – e, se serve, copiali su più date.",
            "Dopo il turno conferma «svolto»; le ore vengono conteggiate.",
            "In [Impostazioni](/admin/shifts/settings) stabilisci le ore obbligatorie e la tariffa per ora mancante; in «Ore» fattura la tassa sostitutiva come QR-fattura.",
          ],
        },
        { p: "Fanno stato gli statuti o le decisioni della vostra società." },
      ],
    },
    en: {
      q: "How do I plan volunteer shifts and charge the compensation fee?",
      keywords: "volunteer shifts plan shifts copy working hours compulsory compensation fee invoice confirm done",
      a: [
        {
          ol: [
            "Under [Volunteer shifts](/admin/shifts), create shifts – for an event or as range duty – and copy them to several dates if needed.",
            "After the shift, confirm “done”; the hours are credited.",
            "Under [Settings](/admin/shifts/settings), set the compulsory hours and the rate per missing hour; under “Hours”, charge the compensation fee as a QR bill.",
          ],
        },
        { p: "Your club’s statutes or resolutions are authoritative." },
      ],
    },
  },
  {
    id: "qualifikationen",
    audience: "admin",
    de: {
      q: "Wofür sind Qualifikationen?",
      keywords: "Qualifikationen Schützenmeister J+S Leiter Erste Hilfe Standchef gültig bis abgelaufen Qualifikationsschiessen",
      a: [
        { p: "Unter [Qualifikationen](/admin/qualifications) erfasst du z.B. Schützenmeister, J+S-Leitung oder Erste Hilfe mit Gültigkeit. Schichten und Standdienst warnen, wenn niemand mit der nötigen Qualifikation eingeteilt ist; vor dem Ablauf gibt es eine Erinnerung." },
        { p: "Die App ersetzt keine offizielle Anerkennung. Bitte keine AHV-Nummern erfassen." },
      ],
    },
    fr: {
      q: "À quoi servent les qualifications ?",
      keywords: "qualifications chef de tir moniteur J+S premiers secours chef de stand valable jusqu’au expiré tir de qualification",
      a: [
        { p: "Sous [Qualifications](/admin/qualifications), tu saisis p. ex. chef de tir, moniteur J+S ou premiers secours avec leur validité. Les équipes et le service de stand avertissent si personne n’ayant la qualification requise n’est prévu ; un rappel est envoyé avant l’échéance." },
        { p: "L’app ne remplace aucune reconnaissance officielle. Merci de ne pas saisir de numéros AVS." },
      ],
    },
    it: {
      q: "A cosa servono le qualifiche?",
      keywords: "qualifiche capo tiro monitore G+S primo soccorso capo stand valido fino a scaduto tiro di qualificazione",
      a: [
        { p: "In [Qualifiche](/admin/qualifications) registri p. es. capo tiro, monitore G+S o primo soccorso con la relativa validità. Turni e servizio allo stand avvisano se nessuno con la qualifica necessaria è assegnato; prima della scadenza arriva un promemoria." },
        { p: "L’app non sostituisce alcun riconoscimento ufficiale. Non registrare numeri AVS." },
      ],
    },
    en: {
      q: "What are qualifications for?",
      keywords: "qualifications range officer J+S instructor first aid range chief valid until expired qualification shooting",
      a: [
        { p: "Under [Qualifications](/admin/qualifications) you record e.g. range officer, J+S instructor or first aid with validity. Shifts and range duty warn you if nobody with the required qualification is assigned; there is a reminder before expiry." },
        { p: "The app does not replace official recognition. Please do not record AHV numbers." },
      ],
    },
  },
  {
    id: "kurse-admin",
    audience: "admin",
    de: {
      q: "Wie führe ich einen Jungschützenkurs oder J+S-Kurs?",
      keywords: "Kurse Jungschützenkurs J+S NDS Teilnehmende Import Präsenz Pflichtprogramme Kursausweis Qualifikationsschiessen",
      a: [
        { p: "Unter [Kurse](/courses) legst du den Kurs an, erfasst Teilnehmende (auch per CSV-Import) und Kurstage. Die Präsenz nimmst du am Handy auf; die Präsenzliste gibt es als CSV für die Übertragung in die NDS. Pflichtprogramme zeigen, wer was bestanden hat." },
        { p: "Unter «Qualifikationsschiessen» definierst du Regeln und erteilst danach Qualifikationen. Details der Kursarten bitte mit den aktuellen Vorgaben (VBS, BASPO/J+S) prüfen." },
      ],
    },
    fr: {
      q: "Comment diriger un cours de jeunes tireurs ou un cours J+S ?",
      keywords: "cours cours de jeunes tireurs J+S BDNS participants import présence programmes obligatoires attestation de cours tir de qualification",
      a: [
        { p: "Sous [Cours](/courses), tu crées le cours, saisis les participants (aussi par import CSV) et les jours de cours. Tu relèves les présences sur le téléphone ; la liste des présences est disponible en CSV pour la transmission dans la BDNS. Les programmes obligatoires montrent qui a réussi quoi." },
        { p: "Sous « Tir de qualification », tu définis des règles puis attribues des qualifications. Merci de vérifier les détails des types de cours avec les prescriptions en vigueur (DDPS, OFSPO/J+S)." },
      ],
    },
    it: {
      q: "Come gestisco un corso per giovani tiratori o un corso G+S?",
      keywords: "corsi corso giovani tiratori G+S BDNS partecipanti importazione presenze programmi obbligatori attestato del corso tiro di qualificazione",
      a: [
        { p: "In [Corsi](/courses) crei il corso, registri i partecipanti (anche tramite importazione CSV) e i giorni di corso. Le presenze le rilevi sul telefono; l’elenco delle presenze è disponibile in CSV per la trasmissione nella BDNS. I programmi obbligatori mostrano chi ha superato cosa." },
        { p: "In «Tiro di qualificazione» definisci le regole e poi assegni le qualifiche. Verifica i dettagli dei tipi di corso con le prescrizioni vigenti (DDPS, UFSPO/G+S)." },
      ],
    },
    en: {
      q: "How do I run a junior shooters course or J+S course?",
      keywords: "courses junior shooters course J+S NDS participants import attendance required programmes course certificate qualification shooting",
      a: [
        { p: "Under [Courses](/courses) you create the course, record participants (also via CSV import) and course days. You take attendance on your phone; the attendance list is available as CSV for transfer to the NDS. Required programmes show who has passed what." },
        { p: "Under “Qualification shooting” you define rules and then grant qualifications. Please check the details of the course types against the current requirements (DDPS, FOSPO/J+S)." },
      ],
    },
  },
  {
    id: "live-rangliste",
    audience: "admin",
    de: {
      q: "Wie zeige ich die Live-Rangliste auf dem Bildschirm im Schützenhaus?",
      keywords: "Live-Rangliste Bildschirm TV Fernseher Link QR-Code Anzeige Wettkampf Resultate live",
      a: [
        { p: "Unter [Live-Rangliste](/admin/live) eine Anzeige für ein Programm oder einen Anlass anlegen. Den geheimen Link öffnest du im Browser des Bildschirms – ohne Anmeldung. Die Anzeige aktualisiert sich selbst und läuft zum eingestellten Zeitpunkt ab. Mit «Neuer Link» machst du einen weitergegebenen Link ungültig." },
      ],
    },
    fr: {
      q: "Comment afficher le classement en direct sur l’écran du stand ?",
      keywords: "classement en direct écran TV téléviseur lien code QR affichage concours résultats en direct",
      a: [
        { p: "Sous [Classement en direct](/admin/live), crée un affichage pour un programme ou une manifestation. Ouvre le lien secret dans le navigateur de l’écran – sans connexion. L’affichage se met à jour tout seul et expire au moment défini. Avec « Nouveau lien », tu rends invalide un lien qui a été diffusé." },
      ],
    },
    it: {
      q: "Come mostro la classifica live sullo schermo nella casa del tiro?",
      keywords: "classifica live schermo TV televisore link codice QR visualizzazione gara risultati live",
      a: [
        { p: "In [Classifica live](/admin/live) crea una visualizzazione per un programma o un evento. Apri il link segreto nel browser dello schermo – senza accesso. La visualizzazione si aggiorna da sola e scade all’ora impostata. Con «Nuovo link» rendi non valido un link che è stato diffuso." },
      ],
    },
    en: {
      q: "How do I show the live ranking on the screen in the clubhouse?",
      keywords: "live ranking screen TV television link QR code display competition results live",
      a: [
        { p: "Under [Live ranking](/admin/live), create a display for a programme or an event. Open the secret link in the screen’s browser – no sign-in needed. The display updates itself and expires at the time you set. With “New link” you invalidate a link that has been passed on." },
      ],
    },
  },
  {
    id: "meisterschaft-admin",
    audience: "admin",
    de: {
      q: "Wie richte ich die Jahresmeisterschaft ein?",
      keywords: "Jahresmeisterschaft einrichten Programme Gewichtung Streichresultate Kategorien Bonus veröffentlichen GV Rangliste drucken",
      a: [
        { p: "Unter [Jahresmeisterschaft](/championship) Zeitraum, Programme (Pflicht, Gewichtung) und Anzahl gewerteter Resultate festlegen, optional Kategorien mit Bonus. Die Rangliste rechnet sich laufend aus den abgeschlossenen Durchgängen. Mit «Veröffentlichen» sehen sie alle Mitglieder; für die GV gibt es eine Druckansicht." },
      ],
    },
    fr: {
      q: "Comment configurer le championnat annuel ?",
      keywords: "championnat annuel configurer programmes pondération résultats biffés catégories bonus publier AG classement imprimer",
      a: [
        { p: "Sous [Championnat annuel](/championship), définis la période, les programmes (obligatoire, pondération) et le nombre de résultats pris en compte, si tu veux des catégories avec bonus. Le classement se calcule en continu à partir des passes terminées. Avec « Publier », tous les membres le voient ; pour l’AG, il existe une vue d’impression." },
      ],
    },
    it: {
      q: "Come configuro il campionato annuale?",
      keywords: "campionato annuale configurare programmi ponderazione risultati stralciati categorie bonus pubblicare AG classifica stampare",
      a: [
        { p: "In [Campionato annuale](/championship) stabilisci periodo, programmi (obbligatorio, ponderazione) e numero di risultati considerati, se vuoi categorie con bonus. La classifica si calcola continuamente dalle sessioni concluse. Con «Pubblica» la vedono tutti i membri; per l’AG c’è una vista di stampa." },
      ],
    },
    en: {
      q: "How do I set up the annual championship?",
      keywords: "set up annual championship programmes weighting discarded results categories bonus publish AGM print ranking",
      a: [
        { p: "Under [Annual championship](/championship), set the period, programmes (required, weighting) and number of counted results, optionally categories with a bonus. The ranking is calculated continuously from the finished passes. With “Publish” all members can see it; there is a print view for the AGM." },
      ],
    },
  },
  {
    id: "buchhaltung",
    audience: "admin",
    de: {
      q: "Wie übernehme ich die Buchungen in Banana oder bexio?",
      keywords: "Buchhaltung Export Banana bexio Kontenplan Konten Journal CSV Debitoren Bank Jahresabschluss Quartal",
      a: [
        {
          ol: [
            "Unter [Buchhaltung](/admin/accounting) einmal den Kontenplan prüfen (Vorschlag nach KMU-Kontenrahmen, z.B. 1020 Bank, 1100 Debitoren, 3000 Beiträge).",
            "Zeitraum wählen (Jahr, Quartal, Monat) und die Vorschau kontrollieren.",
            "**Banana**: «Banana Buchhaltung» herunterladen (.txt, Spalten Date/Doc/Description/AccountDebit/AccountCredit/Amount, Datum JJJJ-MM-TT), in Banana «Aktionen → In Buchhaltung importieren → Buchungen», Format «Textdatei mit Spaltenüberschriften» wählen; die Konten müssen im Banana-Kontenplan existieren.",
            "**bexio**: «bexio (CSV für manuellen Import)» herunterladen und im Buchungsimport von bexio die Spalten zuordnen.",
          ],
        },
        { p: "Am besten nur abgeschlossene Zeiträume exportieren. Reservationen, die «Bar / vor Ort» bezahlt wurden, sind automatisch enthalten (Bank an Reservationen). Von Hand buchen müsst ihr nur noch die Gebühren der Zahlungsanbieter und die Barverkäufe der Schützenstube." },
      ],
    },
    fr: {
      q: "Comment reprendre les écritures dans Banana ou bexio ?",
      keywords: "comptabilité export Banana bexio plan comptable comptes journal CSV débiteurs banque bouclement annuel trimestre",
      a: [
        {
          ol: [
            "Sous [Comptabilité](/admin/accounting), vérifie une fois le plan comptable (proposition selon le plan comptable PME, p. ex. 1020 Banque, 1100 Débiteurs, 3000 Cotisations).",
            "Choisis la période (année, trimestre, mois) et contrôle l’aperçu.",
            "**Banana** : télécharge « Comptabilité Banana » (.txt, colonnes Date/Doc/Description/AccountDebit/AccountCredit/Amount, date AAAA-MM-JJ), dans Banana « Actions → Importer dans la comptabilité → Écritures », choisis le format « Fichier texte avec en-têtes de colonnes » ; les comptes doivent exister dans le plan comptable Banana.",
            "**bexio** : télécharge « bexio (CSV pour import manuel) » et attribue les colonnes dans l’import des écritures de bexio.",
          ],
        },
        { p: "Le mieux est de n’exporter que des périodes clôturées. Les réservations payées « Comptant / sur place » sont incluses automatiquement (Banque à Réservations). Il ne vous reste à comptabiliser à la main que les frais des prestataires de paiement et les ventes au comptant de la buvette." },
      ],
    },
    it: {
      q: "Come riprendo le registrazioni in Banana o bexio?",
      keywords: "contabilità esportazione Banana bexio piano dei conti conti giornale CSV debitori banca chiusura annuale trimestre",
      a: [
        {
          ol: [
            "In [Contabilità](/admin/accounting) verifica una volta il piano dei conti (proposta secondo il piano contabile PMI, p. es. 1020 Banca, 1100 Debitori, 3000 Quote).",
            "Scegli il periodo (anno, trimestre, mese) e controlla l’anteprima.",
            "**Banana**: scarica «Contabilità Banana» (.txt, colonne Date/Doc/Description/AccountDebit/AccountCredit/Amount, data AAAA-MM-GG), in Banana «Azioni → Importa in contabilità → Registrazioni», scegli il formato «File di testo con intestazioni di colonna»; i conti devono esistere nel piano dei conti di Banana.",
            "**bexio**: scarica «bexio (CSV per importazione manuale)» e assegna le colonne nell’importazione delle registrazioni di bexio.",
          ],
        },
        { p: "È meglio esportare solo periodi chiusi. Le prenotazioni pagate «In contanti / sul posto» sono incluse automaticamente (Banca a Prenotazioni). A mano dovete registrare solo le commissioni dei fornitori di pagamento e le vendite in contanti della buvette." },
      ],
    },
    en: {
      q: "How do I transfer the bookings to Banana or bexio?",
      keywords: "accounting export Banana bexio chart of accounts accounts journal CSV debtors bank annual accounts quarter",
      a: [
        {
          ol: [
            "Under [Accounting](/admin/accounting), check the chart of accounts once (suggestion based on the Swiss SME chart of accounts, e.g. 1020 bank, 1100 debtors, 3000 fees).",
            "Choose the period (year, quarter, month) and check the preview.",
            "**Banana**: download “Banana Accounting” (.txt, columns Date/Doc/Description/AccountDebit/AccountCredit/Amount, date YYYY-MM-DD); in Banana choose “Actions → Import into accounting → Transactions” and the format “Text file with column headers”; the accounts must exist in the Banana chart of accounts.",
            "**bexio**: download “bexio (CSV for manual import)” and map the columns in the bexio booking import.",
          ],
        },
        { p: "It is best to export only closed periods. Bookings paid “Cash / on site” are included automatically (bank to bookings). You only have to book the payment providers’ fees and the clubhouse cash sales by hand." },
      ],
    },
  },
  {
    id: "website-widgets",
    audience: "admin",
    de: {
      q: "Wie zeige ich Kalender, Schiesszeiten oder Ranglisten auf unserer Vereinswebsite?",
      keywords: "Website Widget einbetten iframe Homepage Kalender Schiesszeiten Rangliste Jahresmeisterschaft WordPress Jimdo Code",
      a: [
        {
          ol: [
            "Unter [Website-Widgets](/admin/embed) die Widgets einschalten.",
            "Widget wählen (Kalender, Zeiten, Rangliste, Meisterschaft), Optionen einstellen und den Code kopieren.",
            "Den Code auf der Website als HTML-Block einfügen. Das kleine Skript (optional) passt die Höhe automatisch an.",
          ],
        },
        { p: "Ranglisten zeigen Namen gekürzt («Anna M.») und nur, was du freigibst. Mit «Neu erzeugen» werden alle bisherigen Codes ungültig." },
      ],
    },
    fr: {
      q: "Comment afficher le calendrier, les heures de tir ou les classements sur le site de notre société ?",
      keywords: "site web widget intégrer iframe page d’accueil calendrier heures de tir classement championnat annuel WordPress Jimdo code",
      a: [
        {
          ol: [
            "Sous [Widgets pour le site web](/admin/embed), active les widgets.",
            "Choisis un widget (calendrier, horaires, classement, championnat), règle les options et copie le code.",
            "Colle le code sur le site comme bloc HTML. Le petit script (facultatif) adapte automatiquement la hauteur.",
          ],
        },
        { p: "Les classements affichent les noms abrégés (« Anna M. ») et uniquement ce que tu autorises. Avec « Régénérer », tous les codes précédents deviennent invalides." },
      ],
    },
    it: {
      q: "Come mostro calendario, orari di tiro o classifiche sul sito della nostra società?",
      keywords: "sito web widget incorporare iframe homepage calendario orari di tiro classifica campionato annuale WordPress Jimdo codice",
      a: [
        {
          ol: [
            "In [Widget per il sito web](/admin/embed) attiva i widget.",
            "Scegli un widget (calendario, orari, classifica, campionato), imposta le opzioni e copia il codice.",
            "Inserisci il codice nel sito come blocco HTML. Il piccolo script (facoltativo) adatta automaticamente l’altezza.",
          ],
        },
        { p: "Le classifiche mostrano i nomi abbreviati («Anna M.») e solo ciò che autorizzi. Con «Rigenera» tutti i codici precedenti diventano non validi." },
      ],
    },
    en: {
      q: "How do I show the calendar, shooting hours or rankings on our club website?",
      keywords: "website widget embed iframe homepage calendar shooting hours ranking annual championship WordPress Jimdo code",
      a: [
        {
          ol: [
            "Switch on the widgets under [Website widgets](/admin/embed).",
            "Choose a widget (calendar, hours, ranking, championship), set the options and copy the code.",
            "Paste the code into the website as an HTML block. The small script (optional) adjusts the height automatically.",
          ],
        },
        { p: "Rankings show names abbreviated (“Anna M.”) and only what you release. With “Regenerate” all previous codes become invalid." },
      ],
    },
  },
  {
    id: "resultat-import",
    audience: "admin",
    de: {
      q: "Wie importiere ich Resultate aus Meyton, SIUS oder ShotMarker?",
      keywords: "Resultate importieren Import elektronische Trefferanzeige Meyton SIUS ShotMarker CSV Export Datei Zuordnung",
      a: [
        {
          ol: [
            "Unter [Resultat-Import](/scores/import) die Exportdatei der Trefferanzeige hochladen.",
            "Vorlage und Programm wählen, die Spaltenzuordnung in der Vorschau prüfen.",
            "Schützen den Mitgliedern zuordnen (oder als Gast übernehmen) und importieren.",
          ],
        },
        { p: "Die Vorlagen für Meyton, SIUS und ShotMarker sind Vorschläge – die Spalten unterscheiden sich je nach Version. Bitte mit einer eigenen Exportdatei prüfen. Dieselbe Datei lässt sich nur einmal importieren." },
      ],
    },
    fr: {
      q: "Comment importer des résultats de Meyton, SIUS ou ShotMarker ?",
      keywords: "importer des résultats import marquage électronique Meyton SIUS ShotMarker CSV export fichier attribution",
      a: [
        {
          ol: [
            "Sous [Import des résultats](/scores/import), télécharge le fichier d’export du système de marquage.",
            "Choisis le modèle et le programme, vérifie l’attribution des colonnes dans l’aperçu.",
            "Attribue les tireurs aux membres (ou reprends-les comme invités) et importe.",
          ],
        },
        { p: "Les modèles pour Meyton, SIUS et ShotMarker sont des propositions – les colonnes diffèrent selon la version. Merci de vérifier avec ton propre fichier d’export. Un même fichier ne peut être importé qu’une fois." },
      ],
    },
    it: {
      q: "Come importo risultati da Meyton, SIUS o ShotMarker?",
      keywords: "importare risultati importazione segnalazione elettronica Meyton SIUS ShotMarker CSV esportazione file assegnazione",
      a: [
        {
          ol: [
            "In [Importazione risultati](/scores/import) carica il file di esportazione del sistema di segnalazione.",
            "Scegli modello e programma, verifica l’assegnazione delle colonne nell’anteprima.",
            "Assegna i tiratori ai membri (o riprendili come ospiti) e importa.",
          ],
        },
        { p: "I modelli per Meyton, SIUS e ShotMarker sono proposte – le colonne variano a seconda della versione. Verifica con un tuo file di esportazione. Lo stesso file può essere importato una sola volta." },
      ],
    },
    en: {
      q: "How do I import results from Meyton, SIUS or ShotMarker?",
      keywords: "import results import electronic scoring system Meyton SIUS ShotMarker CSV export file mapping",
      a: [
        {
          ol: [
            "Under [Result import](/scores/import), upload the export file from the scoring system.",
            "Choose the template and programme and check the column mapping in the preview.",
            "Assign the shooters to members (or take them over as guests) and import.",
          ],
        },
        { p: "The templates for Meyton, SIUS and ShotMarker are suggestions – the columns differ depending on the version. Please check with your own export file. The same file can only be imported once." },
      ],
    },
  },
  {
    id: "schuetzenstube-theke",
    audience: "admin",
    de: {
      q: "Wie erfasse ich Konsumationen an der Theke der Schützenstube?",
      keywords: "Schützenstube Theke Kiosk erfassen aufschreiben bar Gast offline rückgängig Tablet",
      a: [
        { p: "Unter [Schützenstube](/kiosk) Mitglied wählen (oder «Gast bar»), Produkte antippen und «Aufschreiben» oder «Bar erfassen». Der letzte Eintrag lässt sich 2 Minuten lang rückgängig machen." },
        { p: "Ohne Internet werden Einträge auf dem Gerät zwischengespeichert und automatisch gesendet, sobald wieder Verbindung besteht." },
      ],
    },
    fr: {
      q: "Comment saisir les consommations au comptoir de la buvette ?",
      keywords: "buvette comptoir kiosque saisir noter comptant invité hors ligne annuler tablette",
      a: [
        { p: "Sous [Buvette du stand](/kiosk), choisis un membre (ou « Invité comptant »), touche les produits puis « Noter » ou « Encaisser comptant ». La dernière entrée peut être annulée pendant 2 minutes." },
        { p: "Sans Internet, les entrées sont enregistrées temporairement sur l’appareil et envoyées automatiquement dès que la connexion revient." },
      ],
    },
    it: {
      q: "Come registro le consumazioni al bancone della buvette?",
      keywords: "buvette bancone chiosco registrare annotare contanti ospite offline annullare tablet",
      a: [
        { p: "In [Buvette del tiro](/kiosk) scegli un membro (o «Ospite in contanti»), tocca i prodotti e poi «Annota» o «Incassa in contanti». L’ultima registrazione si può annullare per 2 minuti." },
        { p: "Senza Internet le registrazioni vengono salvate temporaneamente sul dispositivo e inviate automaticamente appena torna la connessione." },
      ],
    },
    en: {
      q: "How do I record purchases at the clubhouse counter?",
      keywords: "clubhouse counter kiosk record on account cash guest offline undo tablet",
      a: [
        { p: "Under [Clubhouse](/kiosk), choose a member (or “Guest cash”), tap the products and choose “Put on account” or “Record cash”. The last entry can be undone for 2 minutes." },
        { p: "Without the internet, entries are stored temporarily on the device and sent automatically as soon as there is a connection again." },
      ],
    },
  },
  {
    id: "schuetzenstube-admin",
    audience: "admin",
    de: {
      q: "Wie rechne ich die Schützenstube ab?",
      keywords: "Schützenstube Abrechnung Sortiment Preise Rechnung Kasse Tagesumsatz Storno Export",
      a: [
        { p: "Unter [Schützenstube verwalten](/admin/kiosk) pflegst du das Sortiment. Unter «Abrechnung» Zeitraum wählen, Vorschau prüfen und Rechnungen erstellen: jedes Mitglied erhält eine Rechnung «Schützenstube …» mit QR-Code. Einträge werden nie doppelt verrechnet. «Kasse» zeigt die Barverkäufe pro Tag." },
        { p: "Für die Abrechnung braucht es das Modul «Mitgliederbeiträge» und ein ausgefülltes Rechnungsprofil." },
      ],
    },
    fr: {
      q: "Comment faire le décompte de la buvette ?",
      keywords: "buvette décompte assortiment prix facture caisse chiffre d’affaires du jour annulation export",
      a: [
        { p: "Sous [Gérer la buvette](/admin/kiosk), tu gères l’assortiment. Sous « Décompte », choisis la période, vérifie l’aperçu et crée les factures : chaque membre reçoit une facture « Buvette … » avec code QR. Les entrées ne sont jamais facturées deux fois. « Caisse » montre les ventes au comptant par jour." },
        { p: "Le décompte nécessite le module « Cotisations » et un profil de facturation rempli." },
      ],
    },
    it: {
      q: "Come faccio il conteggio della buvette?",
      keywords: "buvette conteggio assortimento prezzi fattura cassa incasso giornaliero storno esportazione",
      a: [
        { p: "In [Gestire la buvette](/admin/kiosk) curi l’assortimento. In «Conteggio» scegli il periodo, verifica l’anteprima e crea le fatture: ogni membro riceve una fattura «Buvette …» con codice QR. Le registrazioni non vengono mai fatturate due volte. «Cassa» mostra le vendite in contanti per giorno." },
        { p: "Per il conteggio servono il modulo «Quote sociali» e un profilo di fatturazione compilato." },
      ],
    },
    en: {
      q: "How do I bill the clubhouse?",
      keywords: "clubhouse billing range of products prices invoice till daily takings cancellation export",
      a: [
        { p: "Under [Manage clubhouse](/admin/kiosk) you maintain the range of products. Under “Billing”, choose the period, check the preview and create invoices: each member receives a “Clubhouse …” invoice with a QR code. Entries are never invoiced twice. “Till” shows the cash sales per day." },
        { p: "Billing requires the “Membership fees” module and a completed billing profile." },
      ],
    },
  },
  {
    id: "partner-teilen",
    audience: "admin",
    de: {
      q: "Wie teile ich eine Anlage mit einem Partnerverein?",
      keywords: "Anlage teilen Partnerverein gemeinsame Anlage Partnertarif Preisfaktor Beitrittscode Slug Abrechnung",
      a: [
        {
          ol: [
            "Unter [Reservationen → Anlagen](/admin/bookings/resources) die Anlage öffnen und «Mit Partnerverein teilen» wählen.",
            "Partnerverein über Kurzname oder Beitrittscode suchen, Buchen erlauben und den Partnertarif in % festlegen.",
          ],
        },
        { p: "Mitglieder des Partnervereins buchen nach deinen Regeln; die Buchungen und Rechnungen liegen bei deinem Verein. Unter [Partner-Anlagen](/admin/bookings/partners) siehst du Stunden und Beträge pro Partnerverein (mit CSV)." },
      ],
    },
    fr: {
      q: "Comment partager un stand avec une société partenaire ?",
      keywords: "partager un stand société partenaire stand commun tarif partenaire facteur de prix code d’adhésion slug décompte",
      a: [
        {
          ol: [
            "Sous [Réservations → Installations](/admin/bookings/resources), ouvre l’installation et choisis « Partager avec une société partenaire ».",
            "Recherche la société partenaire par son nom court ou son code d’adhésion, autorise les réservations et définis le tarif partenaire en %.",
          ],
        },
        { p: "Les membres de la société partenaire réservent selon tes règles ; les réservations et factures sont gérées par ta société. Sous [Stands partenaires](/admin/bookings/partners), tu vois les heures et montants par société partenaire (avec CSV)." },
      ],
    },
    it: {
      q: "Come condivido un impianto con una società partner?",
      keywords: "condividere impianto società partner impianto comune tariffa partner fattore di prezzo codice di adesione slug conteggio",
      a: [
        {
          ol: [
            "In [Prenotazioni → Impianti](/admin/bookings/resources) apri l’impianto e scegli «Condividi con una società partner».",
            "Cerca la società partner tramite nome breve o codice di adesione, consenti le prenotazioni e stabilisci la tariffa partner in %.",
          ],
        },
        { p: "I membri della società partner prenotano secondo le tue regole; prenotazioni e fatture restano alla tua società. In [Impianti partner](/admin/bookings/partners) vedi ore e importi per società partner (con CSV)." },
      ],
    },
    en: {
      q: "How do I share a facility with a partner club?",
      keywords: "share facility partner club shared facility partner rate price factor join code slug billing",
      a: [
        {
          ol: [
            "Under [Bookings → Facilities](/admin/bookings/resources), open the facility and choose “Share with partner club”.",
            "Search for the partner club by short name or join code, allow booking and set the partner rate in %.",
          ],
        },
        { p: "Members of the partner club book according to your rules; the bookings and invoices stay with your club. Under [Partner facilities](/admin/bookings/partners) you see hours and amounts per partner club (with CSV)." },
      ],
    },
  },
  {
    id: "module",
    audience: "admin",
    de: {
      q: "Welche Module gibt es und wie schalte ich sie ein?",
      keywords: "Module einschalten ausschalten Punkteerfassung Zielscheiben Anlässe Reservationen Mitgliederbeiträge Dateiablage Chat Munition Bundesübungen Standbetrieb Vereinswaffen Helfereinsätze Kurse Jahresmeisterschaft Schützenstube",
      a: [
        { p: "Unter [Verein](/admin) schaltest du Module pro Verein ein oder aus: Punkteerfassung, Zielscheiben, Anlässe & News, Reservationen, Mitgliederbeiträge, Dateiablage, Chat, Munition, Bundesübungen, Standbetrieb, Vereinswaffen, Helfereinsätze, Kurse, Jahresmeisterschaft und Schützenstube. Ausgeschaltete Module verschwinden für alle Mitglieder aus dem Menü – Daten bleiben erhalten." },
        { p: "Mobil liegen weniger genutzte Module unter «Mehr», auf dem Computer in der Seitenleiste unter «Schiessen» und «Verein»." },
      ],
    },
    fr: {
      q: "Quels modules existent et comment les activer ?",
      keywords: "modules activer désactiver saisie des résultats cibles manifestations réservations cotisations fichiers chat munitions tirs fédéraux exploitation du stand armes de la société engagements bénévoles cours championnat annuel buvette",
      a: [
        { p: "Sous [Société](/admin), tu actives ou désactives les modules par société : saisie des résultats, cibles, manifestations & actualités, réservations, cotisations, fichiers, chat, munitions, tirs fédéraux, exploitation du stand, armes de la société, engagements bénévoles, cours, championnat annuel et buvette. Les modules désactivés disparaissent du menu pour tous les membres – les données sont conservées." },
        { p: "Sur mobile, les modules moins utilisés se trouvent sous « Plus », sur l’ordinateur dans la barre latérale sous « Tir » et « Société »." },
      ],
    },
    it: {
      q: "Quali moduli esistono e come li attivo?",
      keywords: "moduli attivare disattivare registrazione punti bersagli eventi prenotazioni quote sociali archivio file chat munizioni tiri federali gestione dello stand armi della società turni di volontariato corsi campionato annuale buvette",
      a: [
        { p: "In [Società](/admin) attivi o disattivi i moduli per società: registrazione punti, bersagli, eventi e notizie, prenotazioni, quote sociali, archivio file, chat, munizioni, tiri federali, gestione dello stand, armi della società, turni di volontariato, corsi, campionato annuale e buvette. I moduli disattivati scompaiono dal menu per tutti i membri – i dati restano conservati." },
        { p: "Su mobile i moduli meno usati si trovano in «Altro», sul computer nella barra laterale in «Tiro» e «Società»." },
      ],
    },
    en: {
      q: "Which modules are there and how do I switch them on?",
      keywords: "modules switch on switch off score recording targets events bookings membership fees file storage chat ammunition federal exercises range operations club weapons volunteer shifts courses annual championship clubhouse",
      a: [
        { p: "Under [Club](/admin) you switch modules on or off per club: score recording, targets, events & news, bookings, membership fees, file storage, chat, ammunition, federal exercises, range operations, club weapons, volunteer shifts, courses, annual championship and clubhouse. Switched-off modules disappear from the menu for all members – data is kept." },
        { p: "On mobile, less used modules are under “More”; on the computer, in the sidebar under “Shooting” and “Club”." },
      ],
    },
  },
  {
    id: "beitritt-freigabe",
    audience: "admin",
    de: {
      q: "Wie prüfe ich neue Mitglieder, bevor sie Zugang erhalten?",
      keywords: "Beitritt mit Freigabe Beitrittsanfragen Beitrittscode freigeben ablehnen wartet PENDING Anfragen",
      a: [
        { p: "Unter [Beitrittsanfragen](/admin/members/requests) schaltest du «Beitritt mit Freigabe» ein. Wer danach mit dem Beitrittscode beitritt, wartet, bis eine Person mit Admin-Rolle die Anfrage freigibt oder ablehnt. Die Verwaltung erhält bei jeder neuen Anfrage eine Mitteilung." },
        { p: "Wartende Personen sehen keine Vereinsdaten, erhalten keine Rechnungen und zählen nicht als Mitglieder. Einladungen per E-Mail gelten weiterhin sofort." },
      ],
    },
    fr: {
      q: "Comment vérifier les nouveaux membres avant qu’ils aient accès ?",
      keywords: "adhésion avec validation demandes d’adhésion code d’adhésion valider refuser en attente demandes",
      a: [
        { p: "Sous [Demandes d’adhésion](/admin/members/requests), tu actives « Adhésion avec validation ». Ensuite, quiconque adhère avec le code attend qu’une personne avec le rôle admin valide ou refuse la demande. L’administration reçoit un message à chaque nouvelle demande." },
        { p: "Les personnes en attente ne voient aucune donnée de la société, ne reçoivent pas de factures et ne comptent pas comme membres. Les invitations par e-mail restent valables immédiatement." },
      ],
    },
    it: {
      q: "Come verifico i nuovi membri prima che abbiano accesso?",
      keywords: "adesione con approvazione richieste di adesione codice di adesione approvare rifiutare in attesa richieste",
      a: [
        { p: "In [Richieste di adesione](/admin/members/requests) attivi «Adesione con approvazione». In seguito chi aderisce con il codice attende che una persona con ruolo admin approvi o rifiuti la richiesta. L’amministrazione riceve un messaggio a ogni nuova richiesta." },
        { p: "Le persone in attesa non vedono dati della società, non ricevono fatture e non contano come membri. Gli inviti per e-mail restano validi subito." },
      ],
    },
    en: {
      q: "How do I check new members before they get access?",
      keywords: "membership with approval membership requests join code approve decline waiting PENDING requests",
      a: [
        { p: "Under [Membership requests](/admin/members/requests) you switch on “Membership with approval”. Anyone who then joins with the join code waits until a person with the admin role approves or declines the request. The administration is notified of every new request." },
        { p: "Waiting people see no club data, receive no invoices and do not count as members. Invitations by email still apply immediately." },
      ],
    },
  },
  {
    id: "serienbuchung",
    audience: "admin",
    de: {
      q: "Wie reserviere ich ein wöchentliches Training?",
      keywords: "Serie Serienbuchung wiederkehrend wöchentlich Training Reservation Wochentage Konflikte stornieren Trainer",
      a: [
        { p: "Unter [Serien](/bookings/series) legen Trainerinnen und Trainer eine Serie an: Anlage, Wochentage, Zeit, Zeitraum und Personen. «Termine prüfen» zeigt jeden Termin; Termine mit Konflikt (geschlossen, gesperrt, voll, ausserhalb der Schiesszeiten) werden übersprungen." },
        { p: "Serien-Reservationen sind kostenlos und sofort bestätigt. Du kannst einzelne Termine oder die ganze Serie stornieren; vergangene Termine bleiben erhalten." },
      ],
    },
    fr: {
      q: "Comment réserver un entraînement hebdomadaire ?",
      keywords: "série réservation récurrente hebdomadaire entraînement jours de la semaine conflits annuler entraîneur",
      a: [
        { p: "Sous [Séries](/bookings/series), les entraîneuses et entraîneurs créent une série : installation, jours de la semaine, heure, période et personnes. « Vérifier les dates » affiche chaque date ; les dates en conflit (fermé, bloqué, complet, hors des heures de tir) sont sautées." },
        { p: "Les réservations en série sont gratuites et confirmées tout de suite. Tu peux annuler des dates isolées ou toute la série ; les dates passées sont conservées." },
      ],
    },
    it: {
      q: "Come prenoto un allenamento settimanale?",
      keywords: "serie prenotazione ricorrente settimanale allenamento giorni della settimana conflitti annullare allenatore",
      a: [
        { p: "In [Serie](/bookings/series) allenatrici e allenatori creano una serie: impianto, giorni della settimana, orario, periodo e persone. «Verificare le date» mostra ogni data; le date in conflitto (chiuso, bloccato, pieno, fuori dagli orari di tiro) vengono saltate." },
        { p: "Le prenotazioni in serie sono gratuite e confermate subito. Puoi annullare singole date o l’intera serie; le date passate restano conservate." },
      ],
    },
    en: {
      q: "How do I book a weekly training session?",
      keywords: "series recurring booking recurring weekly training booking weekdays conflicts cancel trainer",
      a: [
        { p: "Under [Series](/bookings/series), trainers create a series: facility, weekdays, time, period and number of people. “Check dates” shows each date; dates with a conflict (closed, blocked, full, outside shooting hours) are skipped." },
        { p: "Series bookings are free of charge and confirmed immediately. You can cancel individual dates or the whole series; past dates are kept." },
      ],
    },
  },
  {
    id: "verband",
    audience: "admin",
    de: {
      q: "Wie verbinde ich den Verein mit dem Kantonal- oder Regionalverband?",
      keywords: "Verband Kantonalverband Regionalverband Verbandscode teilen Statistik Rangliste Einwilligung Namen teilen austreten",
      a: [
        { p: "Unter [Verband](/admin/association) gibst du den Code ein, den du vom Verband erhältst, und bestätigst die Einwilligung. Der Verband gibt die Anfrage frei. Danach sieht er zusammengefasste Zahlen: Mitgliederzahl, Obligatorisch- und Feldschiessen-Beteiligung, Fristen." },
        { p: "Namen in der Verbandsrangliste erscheinen nur, wenn du «Namen teilen» einschaltest. Kontaktdaten, Rechnungen, Chat und Dateien teilt Standchef nie. Du kannst die Verbindung jederzeit beenden, der Zugriff endet sofort." },
      ],
    },
    fr: {
      q: "Comment relier la société à l’association cantonale ou régionale ?",
      keywords: "association cantonale régionale code de l’association partager statistiques classement consentement partager les noms quitter",
      a: [
        { p: "Sous [Association](/admin/association), saisis le code reçu de l’association et confirme le consentement. L’association valide la demande. Ensuite, elle voit des chiffres agrégés : nombre de membres, participation au tir obligatoire et au tir en campagne, délais." },
        { p: "Les noms n’apparaissent dans le classement de l’association que si tu actives « Partager les noms ». Standchef ne partage jamais les coordonnées, les factures, le chat ni les fichiers. Tu peux mettre fin au lien à tout moment, l’accès cesse immédiatement." },
      ],
    },
    it: {
      q: "Come collego la società alla federazione cantonale o regionale?",
      keywords: "federazione cantonale regionale codice della federazione condividere statistiche classifica consenso condividere i nomi uscire",
      a: [
        { p: "In [Federazione](/admin/association) inserisci il codice ricevuto dalla federazione e confermi il consenso. La federazione approva la richiesta. In seguito vede cifre aggregate: numero di membri, partecipazione al tiro obbligatorio e al tiro in campagna, scadenze." },
        { p: "I nomi compaiono nella classifica della federazione solo se attivi «Condividere i nomi». Standchef non condivide mai dati di contatto, fatture, chat e file. Puoi terminare il collegamento in qualsiasi momento, l’accesso cessa subito." },
      ],
    },
    en: {
      q: "How do I connect the club with the cantonal or regional association?",
      keywords: "association cantonal association regional association association code share statistics ranking consent share names leave",
      a: [
        { p: "Under [Association](/admin/association) you enter the code you receive from the association and confirm the consent. The association approves the request. It then sees aggregated figures: number of members, participation in the obligatory programme and field shooting, deadlines." },
        { p: "Names only appear in the association ranking if you switch on “Share names”. Standchef never shares contact details, invoices, chat or files. You can end the connection at any time; access ends immediately." },
      ],
    },
  },
  {
    id: "feldschiessen-auszeichnungen",
    audience: "admin",
    de: {
      q: "Wie berechnet Standchef die Auszeichnungen im Feldschiessen?",
      keywords: "Feldschiessen Auszeichnungen Limiten Kranz Anerkennungskarte Kategorie Alter Ausschreibung Druckliste",
      a: [
        { p: "Unter [Auszeichnungen](/federal/awards) trägst du pro Programm und Jahr die Limiten gemäss Ausschreibung ein, je Zeile Kategorie, Alter von/bis, Limite und Auszeichnung. Standchef ordnet jede Teilnehmerin und jeden Teilnehmer nach Jahrgang der passenden Kategorie zu und zeigt die erreichte Auszeichnung." },
        { p: "Offizielle Limiten sind nicht eingebaut: die Vorlage ist ein Beispiel und muss geprüft werden. Für die Abgabe gibt es eine Druckliste und einen CSV-Export." },
      ],
    },
    fr: {
      q: "Comment Standchef calcule-t-il les distinctions du tir en campagne ?",
      keywords: "tir en campagne distinctions limites couronne carte-couronne catégorie âge plan de tir liste à imprimer",
      a: [
        { p: "Sous [Distinctions](/federal/awards), tu saisis par programme et par année les limites selon le plan de tir, une ligne par catégorie, âge de/à, limite et distinction. Standchef attribue chaque participante et chaque participant à la bonne catégorie selon l’année de naissance et affiche la distinction obtenue." },
        { p: "Aucune limite officielle n’est intégrée : le modèle est un exemple et doit être vérifié. Pour la remise, il y a une liste à imprimer et un export CSV." },
      ],
    },
    it: {
      q: "Come calcola Standchef le distinzioni del tiro in campagna?",
      keywords: "tiro in campagna distinzioni limiti corona carta di riconoscimento categoria età piano di tiro lista da stampare",
      a: [
        { p: "In [Distinzioni](/federal/awards) inserisci per programma e anno i limiti secondo il piano di tiro, una riga per categoria, età da/a, limite e distinzione. Standchef assegna ogni partecipante alla categoria giusta in base all’anno di nascita e mostra la distinzione ottenuta." },
        { p: "Non sono integrati limiti ufficiali: il modello è un esempio e va verificato. Per la consegna ci sono una lista da stampare e un’esportazione CSV." },
      ],
    },
    en: {
      q: "How does Standchef calculate the field shooting awards?",
      keywords: "field shooting awards limits wreath recognition card category age announcement print list",
      a: [
        { p: "Under [Awards](/federal/awards) you enter the limits per programme and year according to the announcement, one row each for category, age from/to, limit and award. Standchef assigns each participant to the matching category by year of birth and shows the award achieved." },
        { p: "Official limits are not built in: the template is an example and must be checked. There is a print list and a CSV export for the presentation." },
      ],
    },
  },
  {
    id: "claude-einrichten",
    audience: "admin",
    de: {
      q: "Wie richte ich Claude für den Verein ein und was kostet das?",
      keywords: "Claude KI künstliche Intelligenz Anthropic API-Schlüssel Key einrichten Kosten Tokens Limite Funktionen Hilfe Übersetzung Schreibhilfe Jahresbericht Trainingstipps Import",
      a: [
        {
          ol: [
            "Unter [Claude](/admin/ai) den Hinweis zum Datenschutz lesen und die Zustimmung geben.",
            "Einen eigenen API-Schlüssel von Anthropic (console.anthropic.com) eintragen und «Verbindung testen». Der Schlüssel wird verschlüsselt gespeichert und nie mehr angezeigt, nur die letzten vier Zeichen.",
            "Claude für den Verein einschalten, die Funktionen wählen (Hilfe-Assistent, Übersetzungen, Schreibhilfe, Trainingstipps, Jahresbericht, Import-Hilfe) und bei Bedarf eine Monatslimite in Tokens oder Franken setzen.",
          ],
        },
        { p: "Die Kosten rechnet Anthropic direkt mit dem Konto des Vereins ab, Standchef verdient daran nichts. Unter [Claude](/admin/ai) siehst du den Verbrauch pro Monat und Funktion; die Frankenbeträge sind Schätzungen. Ist die Limite erreicht, pausieren die Funktionen bis zum nächsten Monat." },
        { p: "Den [Jahresbericht](/admin/reports) erstellt Claude nur aus Zahlen, die Standchef berechnet; Entwürfe und Übersetzungen werden nie automatisch veröffentlicht." },
      ],
    },
    fr: {
      q: "Comment configurer Claude pour la société et combien cela coûte-t-il ?",
      keywords: "Claude IA intelligence artificielle Anthropic clé API configurer coûts tokens limite fonctions aide traduction aide à la rédaction rapport annuel conseils d’entraînement import",
      a: [
        {
          ol: [
            "Sous [Claude](/admin/ai), lis la note sur la protection des données et donne ton accord.",
            "Saisis une propre clé API d’Anthropic (console.anthropic.com) et clique sur « Tester la connexion ». La clé est enregistrée chiffrée et n’est plus jamais affichée, seulement ses quatre derniers caractères.",
            "Active Claude pour la société, choisis les fonctions (assistant d’aide, traductions, aide à la rédaction, conseils d’entraînement, rapport annuel, aide à l’import) et fixe si besoin une limite mensuelle en tokens ou en francs.",
          ],
        },
        { p: "Anthropic facture les coûts directement sur le compte de la société, Standchef ne gagne rien dessus. Sous [Claude](/admin/ai), tu vois la consommation par mois et par fonction ; les montants en francs sont des estimations. Une fois la limite atteinte, les fonctions sont suspendues jusqu’au mois suivant." },
        { p: "Claude rédige le [rapport annuel](/admin/reports) uniquement à partir de chiffres calculés par Standchef ; les brouillons et les traductions ne sont jamais publiés automatiquement." },
      ],
    },
    it: {
      q: "Come configuro Claude per la società e quanto costa?",
      keywords: "Claude IA intelligenza artificiale Anthropic chiave API configurare costi token limite funzioni aiuto traduzione aiuto alla redazione rapporto annuale consigli di allenamento importazione",
      a: [
        {
          ol: [
            "In [Claude](/admin/ai) leggi la nota sulla protezione dei dati e dai il consenso.",
            "Inserisci una chiave API propria di Anthropic (console.anthropic.com) e tocca «Testa connessione». La chiave viene salvata cifrata e non viene più mostrata, solo gli ultimi quattro caratteri.",
            "Attiva Claude per la società, scegli le funzioni (assistente di aiuto, traduzioni, aiuto alla redazione, consigli di allenamento, rapporto annuale, aiuto all’importazione) e se serve imposta un limite mensile in token o franchi.",
          ],
        },
        { p: "Anthropic fattura i costi direttamente sul conto della società, Standchef non ci guadagna nulla. In [Claude](/admin/ai) vedi il consumo per mese e funzione; gli importi in franchi sono stime. Raggiunto il limite, le funzioni restano in pausa fino al mese successivo." },
        { p: "Claude redige il [rapporto annuale](/admin/reports) solo dalle cifre calcolate da Standchef; bozze e traduzioni non vengono mai pubblicate automaticamente." },
      ],
    },
    en: {
      q: "How do I set up Claude for the club and what does it cost?",
      keywords: "Claude AI artificial intelligence Anthropic API key set up costs tokens limit features help translation writing aid annual report training tips import",
      a: [
        {
          ol: [
            "Under [Claude](/admin/ai), read the data protection notice and give your consent.",
            "Enter the club’s own API key from Anthropic (console.anthropic.com) and tap “Test connection”. The key is stored encrypted and never shown again, only its last four characters.",
            "Switch Claude on for the club, choose the features (help assistant, translations, writing aid, training tips, annual report, import helper) and set a monthly limit in tokens or francs if needed.",
          ],
        },
        { p: "Anthropic bills the costs directly to the club’s account; Standchef earns nothing from it. Under [Claude](/admin/ai) you see usage per month and feature; the franc amounts are estimates. Once the limit is reached, the features pause until the next month." },
        { p: "Claude writes the [annual report](/admin/reports) only from figures calculated by Standchef; drafts and translations are never published automatically." },
      ],
    },
  },
  {
    id: "claude-datenschutz",
    audience: "admin",
    de: {
      q: "Welche Daten gehen an Claude und was muss der Verein beachten?",
      keywords: "Claude KI Datenschutz revDSG Anthropic USA Datenübermittlung Einwilligung Zustimmung AHV Mitglieder informieren Auftragsbearbeitung",
      a: [
        { p: "Claude wird von Anthropic PBC in den USA betrieben. Übermittelt wird nur, was eine Funktion braucht: die Frage und die Hilfetexte, der zu übersetzende oder zu verbessernde Text, eigene Resultate als Zahlen, beim Jahresbericht zusammengefasste Zahlen ohne Namen, beim Import nur Spaltennamen und maskierte Beispielzeilen." },
        {
          ul: [
            "Nie übermittelt werden AHV-Nummern, Passwörter, Bankdaten und API-Schlüssel.",
            "Anthropic verwendet Daten aus der API standardmässig nicht zum Training.",
            "Der Verein informiert die Mitglieder (z.B. in der Datenschutzerklärung) und kann Claude unter [Claude](/admin/ai) jederzeit ausschalten oder die Zustimmung zurückziehen.",
          ],
        },
        { p: "Jede Anfrage wird mit Funktion, Datum und Tokens protokolliert, ohne Inhalt. Mitglieder sehen ihre eigenen Einträge in der Datenauskunft unter [Datenschutz](/me/privacy)." },
      ],
    },
    fr: {
      q: "Quelles données sont transmises à Claude et à quoi la société doit-elle veiller ?",
      keywords: "Claude IA protection des données nLPD Anthropic États-Unis transfert de données consentement accord AVS informer les membres sous-traitance",
      a: [
        { p: "Claude est exploité par Anthropic PBC aux États-Unis. Seul ce dont une fonction a besoin est transmis : la question et les textes d’aide, le texte à traduire ou à améliorer, tes propres résultats sous forme de chiffres, pour le rapport annuel des chiffres agrégés sans noms, pour l’import seulement les noms de colonnes et des lignes d’exemple masquées." },
        {
          ul: [
            "Ne sont jamais transmis : numéros AVS, mots de passe, coordonnées bancaires et clés API.",
            "Par défaut, Anthropic n’utilise pas les données de l’API pour l’entraînement.",
            "La société informe ses membres (p. ex. dans sa déclaration de protection des données) et peut désactiver Claude ou retirer son accord à tout moment sous [Claude](/admin/ai).",
          ],
        },
        { p: "Chaque requête est journalisée avec la fonction, la date et les tokens, sans le contenu. Les membres voient leurs propres entrées dans l’extraction de données sous [Protection des données](/me/privacy)." },
      ],
    },
    it: {
      q: "Quali dati vengono trasmessi a Claude e a che cosa deve fare attenzione la società?",
      keywords: "Claude IA protezione dei dati nLPD Anthropic USA trasmissione dei dati consenso AVS informare i soci trattamento su incarico",
      a: [
        { p: "Claude è gestito da Anthropic PBC negli USA. Viene trasmesso solo ciò che serve a una funzione: la domanda e i testi di aiuto, il testo da tradurre o migliorare, i propri risultati come cifre, per il rapporto annuale cifre aggregate senza nomi, per l’importazione solo i nomi delle colonne e righe di esempio mascherate." },
        {
          ul: [
            "Non vengono mai trasmessi numeri AVS, password, dati bancari e chiavi API.",
            "Per impostazione predefinita Anthropic non usa i dati dell’API per l’addestramento.",
            "La società informa i soci (p. es. nella dichiarazione sulla protezione dei dati) e può disattivare Claude o revocare il consenso in qualsiasi momento in [Claude](/admin/ai).",
          ],
        },
        { p: "Ogni richiesta viene registrata con funzione, data e token, senza il contenuto. I soci vedono le proprie voci nell’estratto dei dati in [Protezione dei dati](/me/privacy)." },
      ],
    },
    en: {
      q: "Which data is sent to Claude and what does the club need to consider?",
      keywords: "Claude AI data protection FADP privacy Anthropic USA data transfer consent AHV inform members processor",
      a: [
        { p: "Claude is operated by Anthropic PBC in the USA. Only what a feature needs is sent: the question and the help texts, the text to translate or improve, your own results as numbers, aggregated figures without names for the annual report, and for imports only the column names and masked sample rows." },
        {
          ul: [
            "AHV numbers, passwords, bank details and API keys are never sent.",
            "By default, Anthropic does not use API data for training.",
            "The club informs its members (e.g. in its privacy statement) and can switch Claude off or withdraw its consent at any time under [Claude](/admin/ai).",
          ],
        },
        { p: "Every request is logged with feature, date and tokens, without the content. Members see their own entries in the data export under [Privacy](/me/privacy)." },
      ],
    },
  },
];
