import type { FaqSource } from "./faq-types";

/** Hilfe für Leitung und Vorstand (Deutsch, Französisch, Italienisch). Auszeichnung siehe faq-types.ts. */
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
  },
];
