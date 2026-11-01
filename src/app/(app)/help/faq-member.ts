import type { FaqSource } from "./faq-types";

/** Hilfe für Mitglieder (Deutsch, Französisch, Italienisch). Auszeichnung siehe faq-types.ts. */
export const MEMBER_FAQ: FaqSource[] = [
  {
    id: "beitreten",
    audience: "member",
    de: {
      q: "Wie trete ich einem Verein bei?",
      keywords: "Beitrittscode vom Vorstand Einladungslink registrieren Mehr weiterem Verein beitreten mehrere Vereine wechseln",
      a: [
        { p: "Du brauchst den Beitrittscode deines Vereins (z.B. `7KQ2PX`). Den bekommst du vom Vorstand oder als Einladungslink." },
        {
          ol: [
            "Neu hier: Beim **Registrieren** den Code ins Feld «Beitrittscode» eintragen. Mit einem Einladungslink ist er schon ausgefüllt.",
            "Schon ein Konto: Unter [Mehr](/me) → «Weiterem Verein beitreten / neu anlegen» den Code eingeben.",
          ],
        },
        { p: "Du kannst in mehreren Vereinen sein und unter «Mehr» jederzeit wechseln." },
      ],
    },
    fr: {
      q: "Comment adhérer à une société ?",
      keywords: "code d’adhésion comité lien d’invitation inscription Plus rejoindre autre société plusieurs sociétés changer",
      a: [
        { p: "Il te faut le code d’adhésion de ta société (p. ex. `7KQ2PX`). Tu le reçois du comité ou sous forme de lien d’invitation." },
        {
          ol: [
            "Nouveau ici : lors de l’**inscription**, saisis le code dans le champ « Code d’adhésion ». Avec un lien d’invitation, il est déjà rempli.",
            "Tu as déjà un compte : sous [Plus](/me) → « Rejoindre une autre société / en créer une », saisis le code.",
          ],
        },
        { p: "Tu peux faire partie de plusieurs sociétés et en changer à tout moment sous « Plus »." },
      ],
    },
    it: {
      q: "Come aderisco a una società?",
      keywords: "codice di adesione comitato link d’invito registrazione Altro aderire altra società più società cambiare",
      a: [
        { p: "Ti serve il codice di adesione della tua società (p. es. `7KQ2PX`). Lo ricevi dal comitato o come link d’invito." },
        {
          ol: [
            "Sei nuovo: durante la **registrazione** inserisci il codice nel campo «Codice di adesione». Con un link d’invito è già compilato.",
            "Hai già un account: in [Altro](/me) → «Aderire a un’altra società / crearne una» inserisci il codice.",
          ],
        },
        { p: "Puoi far parte di più società e cambiare in qualsiasi momento in «Altro»." },
      ],
    },
  },
  {
    id: "offline",
    audience: "member",
    de: {
      q: "Wie erfasse ich Resultate offline (ohne Empfang im Stand)?",
      keywords: "offline ohne Internet Empfang Keller Stand Synchronisierung übertragen später Sync Cache Wolke",
      a: [
        { p: "Standchef funktioniert auch ohne Internet. Wichtig ist nur, dass du die App **einmal mit Verbindung** und angemeldet geöffnet hast – dann sind Programme und Mitglieder auf dem Gerät gespeichert." },
        {
          ul: [
            "Ohne Verbindung startest du Durchgänge und erfasst Schüsse wie gewohnt. Alles wird auf dem Gerät gespeichert.",
            "Sobald du wieder online bist, werden die Daten automatisch übertragen. Eine kleine Anzeige zeigt, wie viel noch wartet.",
            "Seiten, die du schon einmal geöffnet hast, kannst du offline weiter ansehen.",
          ],
        },
        { p: "Tipp: Auf dem Handy über das Teilen-Menü «Zum Home-Bildschirm» hinzufügen – dann startet Standchef wie eine App." },
      ],
    },
    fr: {
      q: "Comment saisir des résultats hors ligne (sans réseau au stand) ?",
      keywords: "hors ligne sans Internet réseau cave stand synchronisation transmettre plus tard sync cache nuage",
      a: [
        { p: "Standchef fonctionne aussi sans Internet. Il suffit d’avoir ouvert l’app **une fois avec une connexion** en étant connecté – les programmes et les membres sont alors enregistrés sur l’appareil." },
        {
          ul: [
            "Sans connexion, tu démarres des passes et saisis les coups comme d’habitude. Tout est enregistré sur l’appareil.",
            "Dès que tu es de nouveau en ligne, les données sont transmises automatiquement. Un petit indicateur montre ce qui est encore en attente.",
            "Les pages que tu as déjà ouvertes restent consultables hors ligne.",
          ],
        },
        { p: "Astuce : sur le téléphone, ajoute Standchef via le menu de partage « Sur l’écran d’accueil » – il démarre alors comme une app." },
      ],
    },
    it: {
      q: "Come registro i risultati offline (senza ricezione allo stand)?",
      keywords: "offline senza Internet ricezione cantina stand sincronizzazione trasmettere più tardi sync cache nuvola",
      a: [
        { p: "Standchef funziona anche senza Internet. L’importante è aver aperto l’app **una volta con la connessione** e dopo aver effettuato l’accesso – così programmi e membri sono salvati sul dispositivo." },
        {
          ul: [
            "Senza connessione avvii sessioni e registri i colpi come al solito. Tutto viene salvato sul dispositivo.",
            "Appena sei di nuovo online, i dati vengono trasmessi automaticamente. Un piccolo indicatore mostra quanto è ancora in attesa.",
            "Le pagine che hai già aperto restano consultabili offline.",
          ],
        },
        { p: "Suggerimento: sul telefono aggiungi Standchef tramite il menu Condividi «Aggiungi alla schermata Home» – così si avvia come un’app." },
      ],
    },
  },
  {
    id: "durchgang",
    audience: "member",
    de: {
      q: "Wie starte ich einen Durchgang und erfasse Schüsse?",
      keywords: "Durchgang starten Programm Favorit Stern Gegner Gast Tastenfeld Serie speichern abschliessen",
      a: [
        {
          ol: [
            "Auf der Startseite «Durchgang starten» tippen oder ein Favoriten-Programm wählen.",
            "Optional Vereinskollegen oder Gäste hinzufügen.",
            "Schüsse mit dem grossen Tastenfeld eingeben. Jede Serie wird automatisch gespeichert.",
            "Zum Schluss «Abschliessen». Bei Bedarf kannst du den Durchgang wieder öffnen.",
          ],
        },
        { p: "Mit dem Stern bei einem [Programm](/scores/programs) erscheint es auf der Startseite zum Schnellstart." },
      ],
    },
    fr: {
      q: "Comment démarrer une passe et saisir les coups ?",
      keywords: "passe démarrer programme favori étoile adversaire invité clavier série enregistrer terminer",
      a: [
        {
          ol: [
            "Sur la page d’accueil, touche « Démarrer une passe » ou choisis un programme favori.",
            "Ajoute si tu veux des collègues de la société ou des invités.",
            "Saisis les coups avec le grand clavier. Chaque série est enregistrée automatiquement.",
            "Pour finir, « Terminer ». Au besoin, tu peux rouvrir la passe.",
          ],
        },
        { p: "Avec l’étoile sur un [programme](/scores/programs), celui-ci apparaît sur la page d’accueil pour un démarrage rapide." },
      ],
    },
    it: {
      q: "Come avvio una sessione e registro i colpi?",
      keywords: "sessione avviare programma preferito stella avversario ospite tastierino serie salvare concludere",
      a: [
        {
          ol: [
            "Nella pagina iniziale tocca «Avvia una sessione» o scegli un programma preferito.",
            "Se vuoi, aggiungi colleghi della società o ospiti.",
            "Inserisci i colpi con il tastierino grande. Ogni serie viene salvata automaticamente.",
            "Alla fine «Concludi». Se necessario puoi riaprire la sessione.",
          ],
        },
        { p: "Con la stella su un [programma](/scores/programs), questo compare nella pagina iniziale per l’avvio rapido." },
      ],
    },
  },
  {
    id: "scheiben",
    audience: "member",
    de: {
      q: "Wie drucke ich Zielscheiben?",
      keywords: "Scheibe drucken Zielscheiben A4 A5 A6 Drucker Massstab 100% tatsächliche Grösse PDF eigene hochladen",
      a: [
        {
          ol: [
            "Unter [Scheiben](/targets) ein Sujet wählen.",
            "Unter «Druckoptionen» Papierformat (A4, A5 oder A6) und Anzahl Blätter wählen, dann drucken.",
            "Im Druckdialog **«Tatsächliche Grösse» bzw. Skalierung 100 %** wählen, damit die Ringe exakt stimmen.",
          ],
        },
        { p: "Eigene Scheiben kannst du als PNG, JPG, SVG oder PDF hochladen und mit dem Verein teilen." },
      ],
    },
    fr: {
      q: "Comment imprimer des cibles ?",
      keywords: "cible imprimer cibles A4 A5 A6 imprimante échelle 100% taille réelle PDF propres télécharger",
      a: [
        {
          ol: [
            "Sous [Cibles](/targets), choisis un motif.",
            "Sous « Options d’impression », choisis le format du papier (A4, A5 ou A6) et le nombre de feuilles, puis imprime.",
            "Dans la boîte de dialogue d’impression, choisis **« Taille réelle » ou une échelle de 100 %** pour que les cercles soient exacts.",
          ],
        },
        { p: "Tu peux télécharger tes propres cibles en PNG, JPG, SVG ou PDF et les partager avec la société." },
      ],
    },
    it: {
      q: "Come stampo i bersagli?",
      keywords: "bersaglio stampare bersagli A4 A5 A6 stampante scala 100% dimensioni reali PDF propri caricare",
      a: [
        {
          ol: [
            "In [Bersagli](/targets) scegli un soggetto.",
            "In «Opzioni di stampa» scegli il formato della carta (A4, A5 o A6) e il numero di fogli, poi stampa.",
            "Nella finestra di stampa scegli **«Dimensioni reali» o scala 100 %**, così i cerchi sono esatti.",
          ],
        },
        { p: "Puoi caricare bersagli tuoi in PNG, JPG, SVG o PDF e condividerli con la società." },
      ],
    },
  },
  {
    id: "reservieren",
    audience: "member",
    de: {
      q: "Wie reserviere ich eine Bahn oder die Anlage?",
      keywords: "reservieren Reservation Bahn Anlage Raum buchen Zeit stornieren Freigabe bezahlen online Rechnung",
      a: [
        {
          ol: [
            "Unter [Reservieren](/bookings) die Ressource wählen (z.B. Bahn 1).",
            "Tag, Dauer und freie Startzeit antippen.",
            "Bestätigen und – je nach Verein – per Rechnung oder online bezahlen.",
          ],
        },
        { p: "Muss der Verein freigeben, siehst du «wartet auf Freigabe». Stornieren kannst du bis zur Stornofrist direkt in der Reservation." },
      ],
    },
    fr: {
      q: "Comment réserver une cible ou le stand ?",
      keywords: "réserver réservation cible stand salle horaire annuler validation payer en ligne facture",
      a: [
        {
          ol: [
            "Sous [Réserver](/bookings), choisis la ressource (p. ex. cible 1).",
            "Touche le jour, la durée et une heure de début libre.",
            "Confirme et – selon la société – paie sur facture ou en ligne.",
          ],
        },
        { p: "Si la société doit valider, tu vois « en attente de validation ». Tu peux annuler directement dans la réservation jusqu’au délai d’annulation." },
      ],
    },
    it: {
      q: "Come prenoto una linea o l’impianto?",
      keywords: "prenotare prenotazione linea impianto locale orario annullare approvazione pagare online fattura",
      a: [
        {
          ol: [
            "In [Prenotare](/bookings) scegli la risorsa (p. es. linea 1).",
            "Tocca giorno, durata e un orario d’inizio libero.",
            "Conferma e – a seconda della società – paga con fattura o online.",
          ],
        },
        { p: "Se la società deve approvare, vedi «in attesa di approvazione». Puoi annullare direttamente nella prenotazione fino al termine di annullamento." },
      ],
    },
  },
  {
    id: "qr-rechnung",
    audience: "member",
    de: {
      q: "Wie bezahle ich Beiträge mit der QR-Rechnung?",
      keywords: "Beiträge Mitgliederbeitrag QR-Rechnung bezahlen Banking App scannen E-Banking Twint Einzahlungsschein Referenz",
      a: [
        {
          ol: [
            "Unter [Zahlungen](/payments) (oder [Beiträge](/billing)) die offene Rechnung öffnen.",
            "In deiner Banking-App «QR-Rechnung scannen» wählen und den QR-Code abfotografieren – Betrag, Konto und Referenz sind dann schon ausgefüllt.",
            "Am Computer: Rechnung drucken oder als PDF speichern und wie gewohnt einzahlen.",
          ],
        },
        { p: "Den Zahlungseingang trägt der Verein ein. Danach steht die Rechnung auf «bezahlt»." },
      ],
    },
    fr: {
      q: "Comment payer les cotisations avec la QR-facture ?",
      keywords: "cotisations cotisation de membre QR-facture payer app bancaire scanner e-banking Twint bulletin de versement référence",
      a: [
        {
          ol: [
            "Sous [Paiements](/payments) (ou [Cotisations](/billing)), ouvre la facture ouverte.",
            "Dans ton app bancaire, choisis « Scanner une QR-facture » et photographie le code QR – le montant, le compte et la référence sont alors déjà remplis.",
            "Sur l’ordinateur : imprime la facture ou enregistre-la en PDF et paie comme d’habitude.",
          ],
        },
        { p: "La société enregistre l’arrivée du paiement. La facture passe ensuite à « payée »." },
      ],
    },
    it: {
      q: "Come pago le quote con la QR-fattura?",
      keywords: "quote quota sociale QR-fattura pagare app bancaria scansionare e-banking Twint polizza di versamento riferimento",
      a: [
        {
          ol: [
            "In [Pagamenti](/payments) (o [Quote](/billing)) apri la fattura aperta.",
            "Nella tua app bancaria scegli «Scansiona QR-fattura» e fotografa il codice QR – importo, conto e riferimento sono già compilati.",
            "Al computer: stampa la fattura o salvala in PDF e paga come al solito.",
          ],
        },
        { p: "La società registra l’entrata del pagamento. In seguito la fattura risulta «pagata»." },
      ],
    },
  },
  {
    id: "zahlungen",
    audience: "member",
    de: {
      q: "Wo sehe ich alle meine Rechnungen und Zahlungen?",
      keywords: "Zahlungsübersicht Zahlungen Rechnungen offen bezahlt Beiträge Reservation Munition Online-Zahlung IBAN Referenz kopieren überfällig",
      a: [
        { p: "Unter [Zahlungen](/payments) (auf dem Handy unter «Mehr») siehst du alles an einem Ort: Mitgliederbeiträge, Rechnungen für Reservationen, Online-Zahlungen und Munitionsrechnungen." },
        {
          ul: [
            "**Offen** zeigt, was du noch bezahlen musst. Überfällige Rechnungen sind rot markiert.",
            "Bei offenen Rechnungen kopierst du IBAN und Referenz mit einem Tipp und fügst sie im E-Banking ein. Oder du öffnest die QR-Rechnung und scannst sie mit der Banking- oder TWINT-App.",
            "**Bezahlt** zeigt erledigte Rechnungen, oben steht die Summe für dieses Jahr.",
          ],
        },
        { p: "Bis der Verein deine Zahlung verbucht hat, kann es ein paar Tage dauern. Danach steht die Rechnung auf «bezahlt»." },
      ],
    },
    fr: {
      q: "Où vois-je toutes mes factures et tous mes paiements ?",
      keywords: "aperçu des paiements paiements factures ouvertes payées cotisations réservation munitions paiement en ligne IBAN référence copier échue",
      a: [
        { p: "Sous [Paiements](/payments) (sur le téléphone sous « Plus »), tu vois tout au même endroit : cotisations, factures de réservation, paiements en ligne et factures de munitions." },
        {
          ul: [
            "**Ouvertes** montre ce qu’il te reste à payer. Les factures échues sont marquées en rouge.",
            "Pour les factures ouvertes, tu copies l’IBAN et la référence d’une touche et tu les colles dans l’e-banking. Ou tu ouvres la QR-facture et la scannes avec l’app bancaire ou TWINT.",
            "**Payées** montre les factures réglées, avec en haut le total de l’année.",
          ],
        },
        { p: "Il peut s’écouler quelques jours jusqu’à ce que la société ait comptabilisé ton paiement. La facture passe ensuite à « payée »." },
      ],
    },
    it: {
      q: "Dove vedo tutte le mie fatture e i miei pagamenti?",
      keywords: "panoramica pagamenti fatture aperte pagate quote prenotazione munizioni pagamento online IBAN riferimento copiare scaduta",
      a: [
        { p: "In [Pagamenti](/payments) (sul telefono in «Altro») vedi tutto in un unico posto: quote sociali, fatture per prenotazioni, pagamenti online e fatture delle munizioni." },
        {
          ul: [
            "**Aperte** mostra cosa devi ancora pagare. Le fatture scadute sono segnate in rosso.",
            "Per le fatture aperte copi IBAN e riferimento con un tocco e li incolli nell’e-banking. Oppure apri la QR-fattura e la scansioni con l’app bancaria o TWINT.",
            "**Pagate** mostra le fatture saldate, in alto c’è il totale dell’anno.",
          ],
        },
        { p: "Possono passare alcuni giorni prima che la società registri il tuo pagamento. In seguito la fattura risulta «pagata»." },
      ],
    },
  },
  {
    id: "online-bezahlen",
    audience: "member",
    de: {
      q: "Kann ich Beiträge online bezahlen (TWINT, Karte)?",
      keywords: "online bezahlen TWINT PostFinance Karte Kreditkarte Payrexx Stripe Worldline SumUp Beitrag Ersatzabgabe Schützenstube Munition",
      a: [
        { p: "Wenn dein Verein einen Zahlungsanbieter eingerichtet hat, steht bei offenen Beitragsrechnungen (Jahresbeitrag, Ersatzabgabe, Schützenstube) der Knopf **«Online bezahlen»** – auf der Startseite, unter [Zahlungen](/payments) und unter [Beiträge](/billing)." },
        {
          ol: [
            "«Online bezahlen» tippen und auf der nächsten Seite bestätigen.",
            "Auf der Zahlungsseite des Anbieters mit TWINT, PostFinance oder Karte bezahlen (welche Zahlarten es gibt, hängt vom Verein ab).",
            "Danach kommst du zurück zu Standchef. Die Rechnung steht nach wenigen Sekunden auf «bezahlt».",
          ],
        },
        { p: "**Munitionsrechnungen** bezahlst du immer mit der QR-Rechnung – eine Online-Zahlung ist dafür nicht möglich." },
      ],
    },
    fr: {
      q: "Puis-je payer les cotisations en ligne (TWINT, carte) ?",
      keywords: "payer en ligne TWINT PostFinance carte carte de crédit Payrexx Stripe Worldline SumUp cotisation taxe de remplacement buvette munitions",
      a: [
        { p: "Si ta société a configuré un prestataire de paiement, le bouton **« Payer en ligne »** apparaît pour les factures de cotisation ouvertes (cotisation annuelle, taxe de remplacement, buvette) – sur la page d’accueil, sous [Paiements](/payments) et sous [Cotisations](/billing)." },
        {
          ol: [
            "Touche « Payer en ligne » et confirme à la page suivante.",
            "Paie sur la page du prestataire avec TWINT, PostFinance ou une carte (les moyens de paiement disponibles dépendent de la société).",
            "Tu reviens ensuite à Standchef. Après quelques secondes, la facture passe à « payée ».",
          ],
        },
        { p: "Les **factures de munitions** se paient toujours avec la QR-facture – un paiement en ligne n’est pas possible pour elles." },
      ],
    },
    it: {
      q: "Posso pagare le quote online (TWINT, carta)?",
      keywords: "pagare online TWINT PostFinance carta carta di credito Payrexx Stripe Worldline SumUp quota tassa sostitutiva buvette munizioni",
      a: [
        { p: "Se la tua società ha configurato un fornitore di pagamento, per le fatture delle quote aperte (quota annuale, tassa sostitutiva, buvette) compare il pulsante **«Paga online»** – nella pagina iniziale, in [Pagamenti](/payments) e in [Quote](/billing)." },
        {
          ol: [
            "Tocca «Paga online» e conferma nella pagina successiva.",
            "Paga sulla pagina del fornitore con TWINT, PostFinance o carta (i metodi disponibili dipendono dalla società).",
            "Poi torni a Standchef. Dopo pochi secondi la fattura risulta «pagata».",
          ],
        },
        { p: "Le **fatture delle munizioni** si pagano sempre con la QR-fattura – per queste non è possibile un pagamento online." },
      ],
    },
  },
  {
    id: "schuetzenstube",
    audience: "member",
    de: {
      q: "Wie funktioniert die Schützenstube (Konsumationen aufschreiben)?",
      keywords: "Schützenstube Kiosk Konsumation Getränke aufschreiben Theke bar bezahlen Abrechnung Rechnung Meine Konsumationen",
      a: [
        { p: "An der Theke schreibt das Thekenteam deine Getränke und Snacks auf deinen Namen auf – oder du bezahlst bar. Unter [Meine Konsumationen](/kiosk/me) siehst du, was noch offen ist und was schon verrechnet wurde." },
        { p: "Der Verein rechnet periodisch ab (z.B. monatlich). Du bekommst dann eine Rechnung «Schützenstube …», die du mit der QR-Rechnung oder – falls eingerichtet – online bezahlst." },
      ],
    },
    fr: {
      q: "Comment fonctionne la buvette (noter les consommations) ?",
      keywords: "buvette kiosque consommation boissons noter comptoir payer comptant décompte facture mes consommations",
      a: [
        { p: "Au comptoir, l’équipe note tes boissons et en-cas à ton nom – ou tu paies comptant. Sous [Mes consommations](/kiosk/me), tu vois ce qui est encore ouvert et ce qui a déjà été facturé." },
        { p: "La société fait un décompte périodique (p. ex. mensuel). Tu reçois alors une facture « Buvette … » que tu paies avec la QR-facture ou – si c’est configuré – en ligne." },
      ],
    },
    it: {
      q: "Come funziona la buvette (annotare le consumazioni)?",
      keywords: "buvette chiosco consumazione bevande annotare bancone pagare in contanti conteggio fattura le mie consumazioni",
      a: [
        { p: "Al bancone il team annota le tue bevande e gli spuntini a tuo nome – oppure paghi in contanti. In [Le mie consumazioni](/kiosk/me) vedi cosa è ancora aperto e cosa è già stato fatturato." },
        { p: "La società fa un conteggio periodico (p. es. mensile). Ricevi poi una fattura «Buvette …» che paghi con la QR-fattura o – se configurato – online." },
      ],
    },
  },
  {
    id: "partner-anlagen",
    audience: "member",
    de: {
      q: "Kann ich die Anlage eines Partnervereins reservieren?",
      keywords: "Partnerverein Partner-Anlage gemeinsame Anlage teilen fremder Verein reservieren buchen Partnertarif",
      a: [
        { p: "Teilt ein anderer Verein eine Anlage mit deinem Verein, erscheint sie unter [Buchen](/bookings) in der Gruppe «Anlagen von …». Du buchst wie gewohnt; es gelten die Regeln und Öffnungszeiten des anderen Vereins, der Preis mit dem vereinbarten Partnertarif." },
        { p: "Die Rechnung stellt der Verein, dem die Anlage gehört (QR-Rechnung, keine Online-Zahlung). Deine Partnerbuchungen siehst du unter «Meine Reservationen», markiert mit «Anlage von …»." },
      ],
    },
    fr: {
      q: "Puis-je réserver le stand d’une société partenaire ?",
      keywords: "société partenaire stand partenaire stand commun partager autre société réserver tarif partenaire",
      a: [
        { p: "Si une autre société partage un stand avec ta société, il apparaît sous [Réserver](/bookings) dans le groupe « Stands de … ». Tu réserves comme d’habitude ; les règles et horaires de l’autre société s’appliquent, et le prix suit le tarif partenaire convenu." },
        { p: "La facture est établie par la société propriétaire du stand (QR-facture, pas de paiement en ligne). Tu vois tes réservations partenaires sous « Mes réservations », marquées « Stand de … »." },
      ],
    },
    it: {
      q: "Posso prenotare l’impianto di una società partner?",
      keywords: "società partner impianto partner impianto comune condividere altra società prenotare tariffa partner",
      a: [
        { p: "Se un’altra società condivide un impianto con la tua, questo compare in [Prenotare](/bookings) nel gruppo «Impianti di …». Prenoti come al solito; valgono le regole e gli orari dell’altra società, il prezzo segue la tariffa partner concordata." },
        { p: "La fattura è emessa dalla società proprietaria dell’impianto (QR-fattura, nessun pagamento online). Le tue prenotazioni partner le vedi in «Le mie prenotazioni», contrassegnate con «Impianto di …»." },
      ],
    },
  },
  {
    id: "kalender-abo",
    audience: "member",
    de: {
      q: "Wie sehe ich Anlässe, Reservationen und Helfereinsätze in meinem Handy-Kalender?",
      keywords: "Kalender abonnieren iCal ics Google Kalender Apple Outlook Abo Anlässe Reservationen Helfereinsätze Kurse",
      a: [
        { p: "Unter [Anlässe](/events) findest du den Link «Kalender abonnieren». Dein persönlicher Kalender enthält deine Anmeldungen, Reservationen (auch bei Partnervereinen), Helfereinsätze und Kurstage. Abgesagte Termine werden im Kalender als abgesagt markiert." },
        { p: "Den Link nicht weitergeben – er ist persönlich." },
      ],
    },
    fr: {
      q: "Comment voir les manifestations, réservations et engagements bénévoles dans le calendrier de mon téléphone ?",
      keywords: "s’abonner au calendrier iCal ics Google Agenda Apple Outlook abonnement manifestations réservations engagements bénévoles cours",
      a: [
        { p: "Sous [Manifestations](/events), tu trouves le lien « S’abonner au calendrier ». Ton calendrier personnel contient tes inscriptions, réservations (aussi auprès de sociétés partenaires), engagements bénévoles et jours de cours. Les rendez-vous annulés y sont marqués comme annulés." },
        { p: "Ne transmets pas ce lien – il est personnel." },
      ],
    },
    it: {
      q: "Come vedo eventi, prenotazioni e turni di volontariato nel calendario del telefono?",
      keywords: "abbonarsi al calendario iCal ics Google Calendar Apple Outlook abbonamento eventi prenotazioni turni di volontariato corsi",
      a: [
        { p: "In [Eventi](/events) trovi il link «Abbonati al calendario». Il tuo calendario personale contiene iscrizioni, prenotazioni (anche presso società partner), turni di volontariato e giorni di corso. Gli appuntamenti annullati vi sono contrassegnati come annullati." },
        { p: "Non condividere il link – è personale." },
      ],
    },
  },
  {
    id: "chat",
    audience: "member",
    de: {
      q: "Wie funktioniert der Chat?",
      keywords: "Chat Nachricht schreiben Gruppe Direktnachricht ungelesen Zähler stumm Bild Datei anhängen bearbeiten löschen Vereinsgruppe",
      a: [
        {
          ol: [
            "Unter [Chat](/chat) «Neue Nachricht» tippen und ein Vereinsmitglied wählen – oder eine Gruppe mit mehreren Personen anlegen.",
            "Nachricht schreiben und senden. Fotos und Dokumente hängst du mit der Büroklammer an.",
            "Die Zahl beim Chat-Symbol zeigt, wie viele Nachrichten du noch nicht gelesen hast.",
          ],
        },
        {
          ul: [
            "Eigene Nachrichten kannst du kurz nach dem Senden noch bearbeiten oder löschen.",
            "Wird es zu viel, schaltest du eine Unterhaltung stumm. Sie zählt dann nicht mehr zu den ungelesenen.",
            "Ohne Empfang wird die Nachricht gesendet, sobald du wieder online bist.",
          ],
        },
        { p: "Den Chat sehen nur Mitglieder deines Vereins. Wer den Verein verlässt, wird aus allen Unterhaltungen entfernt." },
      ],
    },
    fr: {
      q: "Comment fonctionne le chat ?",
      keywords: "chat message écrire groupe message direct non lu compteur muet image fichier joindre modifier supprimer groupe de la société",
      a: [
        {
          ol: [
            "Sous [Chat](/chat), touche « Nouveau message » et choisis un membre de la société – ou crée un groupe avec plusieurs personnes.",
            "Écris le message et envoie-le. Tu joins photos et documents avec le trombone.",
            "Le chiffre sur l’icône du chat indique combien de messages tu n’as pas encore lus.",
          ],
        },
        {
          ul: [
            "Tu peux encore modifier ou supprimer tes propres messages peu après l’envoi.",
            "Si c’est trop, mets une conversation en sourdine. Elle ne compte alors plus parmi les messages non lus.",
            "Sans réseau, le message est envoyé dès que tu es de nouveau en ligne.",
          ],
        },
        { p: "Seuls les membres de ta société voient le chat. Qui quitte la société est retiré de toutes les conversations." },
      ],
    },
    it: {
      q: "Come funziona la chat?",
      keywords: "chat messaggio scrivere gruppo messaggio diretto non letto contatore silenzioso immagine file allegare modificare eliminare gruppo della società",
      a: [
        {
          ol: [
            "In [Chat](/chat) tocca «Nuovo messaggio» e scegli un membro della società – o crea un gruppo con più persone.",
            "Scrivi il messaggio e invialo. Foto e documenti li alleghi con la graffetta.",
            "Il numero sull’icona della chat indica quanti messaggi non hai ancora letto.",
          ],
        },
        {
          ul: [
            "Puoi ancora modificare o eliminare i tuoi messaggi poco dopo l’invio.",
            "Se diventa troppo, silenzia una conversazione. Non conta più tra i messaggi non letti.",
            "Senza ricezione il messaggio viene inviato appena sei di nuovo online.",
          ],
        },
        { p: "La chat la vedono solo i membri della tua società. Chi lascia la società viene rimosso da tutte le conversazioni." },
      ],
    },
  },
  {
    id: "dateien",
    audience: "member",
    de: {
      q: "Wo finde ich Reglemente, Protokolle und andere Dokumente?",
      keywords: "Dateiablage Dateien Dokumente Reglement Protokoll Formular herunterladen hochladen Ordner PDF Foto",
      a: [
        { p: "In der [Dateiablage](/files) legt der Verein Dokumente in Ordnern ab, z.B. Reglemente, Formulare oder Fotos. Tippe auf eine Datei, um sie anzusehen oder herunterzuladen." },
        { p: "Manche Ordner sind nur für Trainer oder den Vorstand sichtbar. Je nach Verein darfst du auch selbst Dateien hochladen." },
      ],
    },
    fr: {
      q: "Où trouver règlements, procès-verbaux et autres documents ?",
      keywords: "fichiers documents règlement procès-verbal formulaire télécharger déposer dossier PDF photo",
      a: [
        { p: "Dans les [fichiers](/files), la société range des documents dans des dossiers, p. ex. règlements, formulaires ou photos. Touche un fichier pour le voir ou le télécharger." },
        { p: "Certains dossiers ne sont visibles que pour les entraîneurs ou le comité. Selon la société, tu peux aussi déposer toi-même des fichiers." },
      ],
    },
    it: {
      q: "Dove trovo regolamenti, verbali e altri documenti?",
      keywords: "archivio file documenti regolamento verbale modulo scaricare caricare cartella PDF foto",
      a: [
        { p: "Nell’[archivio file](/files) la società deposita documenti in cartelle, p. es. regolamenti, moduli o foto. Tocca un file per vederlo o scaricarlo." },
        { p: "Alcune cartelle sono visibili solo per gli allenatori o il comitato. A seconda della società puoi anche caricare file tu stesso." },
      ],
    },
  },
  {
    id: "munition",
    audience: "member",
    de: {
      q: "Wie bestelle ich Munition – und warum nur auf Rechnung?",
      keywords: "Munition bestellen kaufen Rechnung bar Karte TWINT online Ausweis Abgabe Schiessplatz Waffengesetz Erwerbsberechtigung",
      a: [
        {
          ol: [
            "Unter [Munition](/ammo) Sorte und Anzahl wählen und bestellen.",
            "Beim nächsten Training gibt dir die zuständige Person die Munition ab. Bring einen amtlichen Ausweis mit, falls der Verein das verlangt.",
            "Bei der Abgabe entsteht automatisch eine Rechnung mit QR-Code. Du findest sie unter [Zahlungen](/payments).",
          ],
        },
        { p: "**Warum nur auf Rechnung?** Munition darf nur an berechtigte Personen abgegeben werden, und die Abgabe muss nachvollziehbar sein. Mit der Rechnung ist klar, wer wann was erhalten hat – ohne Bargeld in der Schützenstube und ohne Online-Kauf, bei dem niemand die Berechtigung prüfen kann." },
      ],
    },
    fr: {
      q: "Comment commander des munitions – et pourquoi uniquement sur facture ?",
      keywords: "munitions commander acheter facture comptant carte TWINT en ligne pièce d’identité remise stand de tir loi sur les armes droit d’acquisition",
      a: [
        {
          ol: [
            "Sous [Munitions](/ammo), choisis le type et la quantité et commande.",
            "Au prochain entraînement, la personne responsable te remet les munitions. Apporte une pièce d’identité officielle si la société l’exige.",
            "Lors de la remise, une facture avec code QR est créée automatiquement. Tu la trouves sous [Paiements](/payments).",
          ],
        },
        { p: "**Pourquoi uniquement sur facture ?** Les munitions ne peuvent être remises qu’à des personnes autorisées, et la remise doit être traçable. Avec la facture, on sait clairement qui a reçu quoi et quand – sans argent liquide à la buvette et sans achat en ligne où personne ne peut vérifier l’autorisation." },
      ],
    },
    it: {
      q: "Come ordino le munizioni – e perché solo con fattura?",
      keywords: "munizioni ordinare comprare fattura contanti carta TWINT online documento d’identità consegna poligono legge sulle armi diritto d’acquisto",
      a: [
        {
          ol: [
            "In [Munizioni](/ammo) scegli tipo e quantità e ordina.",
            "Al prossimo allenamento la persona responsabile ti consegna le munizioni. Porta un documento d’identità ufficiale se la società lo richiede.",
            "Alla consegna viene creata automaticamente una fattura con codice QR. La trovi in [Pagamenti](/payments).",
          ],
        },
        { p: "**Perché solo con fattura?** Le munizioni possono essere consegnate solo a persone autorizzate e la consegna deve essere tracciabile. Con la fattura è chiaro chi ha ricevuto cosa e quando – senza contanti alla buvette e senza acquisti online, dove nessuno può verificare l’autorizzazione." },
      ],
    },
  },
  {
    id: "profil",
    audience: "member",
    de: {
      q: "Wie ändere ich Profilbild, Darstellung oder Passwort?",
      keywords: "Profilbild Foto Avatar dunkel hell Darstellung Dark Mode Passwort Adresse Profil",
      a: [
        { p: "Unter [Mehr](/me) findest du dein Profil: Foto hochladen, Name, Telefon und Adresse (für QR-Rechnungen) und Darstellung (System, Hell, Dunkel). Passwort, Zwei-Faktor-Anmeldung und angemeldete Geräte findest du unter [Sicherheit](/me/security)." },
      ],
    },
    fr: {
      q: "Comment changer la photo de profil, l’affichage ou le mot de passe ?",
      keywords: "photo de profil photo avatar sombre clair affichage mode sombre mot de passe adresse profil",
      a: [
        { p: "Sous [Plus](/me), tu trouves ton profil : télécharger une photo, nom, téléphone et adresse (pour les QR-factures) et affichage (système, clair, sombre). Le mot de passe, la double authentification et les appareils connectés se trouvent sous [Sécurité](/me/security)." },
      ],
    },
    it: {
      q: "Come cambio foto del profilo, aspetto o password?",
      keywords: "foto del profilo foto avatar scuro chiaro aspetto modalità scura password indirizzo profilo",
      a: [
        { p: "In [Altro](/me) trovi il tuo profilo: caricare una foto, nome, telefono e indirizzo (per le QR-fatture) e aspetto (sistema, chiaro, scuro). Password, autenticazione a due fattori e dispositivi connessi li trovi in [Sicurezza](/me/security)." },
      ],
    },
  },
  {
    id: "benachrichtigungen",
    audience: "member",
    de: {
      q: "Wie schalte ich Benachrichtigungen ein oder aus? Wie wechsle ich die Sprache?",
      keywords: "Benachrichtigung Push Mitteilung E-Mail Mail Sprache Französisch Italienisch langue lingua iPhone Home-Bildschirm",
      a: [
        { p: "Unter [Mehr → Benachrichtigungen & Sprache](/me/notifications) wählst du die Sprache (Deutsch, Französisch, Italienisch) und pro Thema, ob du eine Push-Mitteilung und/oder eine E-Mail erhältst. Push schaltest du dort pro Gerät ein. Auf iPhone und iPad geht das erst, wenn Standchef über «Teilen → Zum Home-Bildschirm» installiert ist." },
      ],
    },
    fr: {
      q: "Comment activer ou désactiver les notifications ? Comment changer de langue ?",
      keywords: "notification push message e-mail mail langue allemand italien Sprache lingua iPhone écran d’accueil",
      a: [
        { p: "Sous [Plus → Notifications & langue](/me/notifications), tu choisis la langue (allemand, français, italien) et, pour chaque thème, si tu reçois une notification push et/ou un e-mail. Tu y actives le push par appareil. Sur iPhone et iPad, cela n’est possible qu’une fois Standchef installé via « Partager → Sur l’écran d’accueil »." },
      ],
    },
    it: {
      q: "Come attivo o disattivo le notifiche? Come cambio lingua?",
      keywords: "notifica push messaggio e-mail mail lingua tedesco francese Sprache langue iPhone schermata Home",
      a: [
        { p: "In [Altro → Notifiche e lingua](/me/notifications) scegli la lingua (tedesco, francese, italiano) e, per ogni tema, se ricevere una notifica push e/o un’e-mail. Lì attivi il push per dispositivo. Su iPhone e iPad è possibile solo dopo aver installato Standchef con «Condividi → Aggiungi alla schermata Home»." },
      ],
    },
  },
  {
    id: "zwei-faktor",
    audience: "member",
    de: {
      q: "Wie schütze ich mein Konto mit Zwei-Faktor-Anmeldung?",
      keywords: "Zwei-Faktor 2FA TOTP Authenticator Code Sicherheit Wiederherstellungscode Passwort vergessen",
      a: [
        { p: "Unter [Mehr → Sicherheit](/me/security) «Zwei-Faktor einschalten» wählen, den QR-Code mit einer Authenticator-App scannen (z.B. Aegis, Google oder Microsoft Authenticator) und den 6-stelligen Code eingeben. Die Wiederherstellungscodes gut aufbewahren: Sie helfen, wenn das Handy verloren geht. Für Admins und Inhaber sehr empfohlen." },
        { p: "Passwort vergessen? Auf der Anmeldeseite «Passwort vergessen?» wählen, du erhältst einen Link per E-Mail." },
      ],
    },
    fr: {
      q: "Comment protéger mon compte avec la double authentification ?",
      keywords: "double authentification 2FA TOTP authenticator code sécurité code de récupération mot de passe oublié",
      a: [
        { p: "Sous [Plus → Sécurité](/me/security), choisis « Activer la double authentification », scanne le code QR avec une app d’authentification (p. ex. Aegis, Google ou Microsoft Authenticator) et saisis le code à 6 chiffres. Conserve bien les codes de récupération : ils t’aident si tu perds ton téléphone. Vivement recommandé pour les admins et propriétaires." },
        { p: "Mot de passe oublié ? Sur la page de connexion, choisis « Mot de passe oublié ? », tu reçois un lien par e-mail." },
      ],
    },
    it: {
      q: "Come proteggo il mio account con l’autenticazione a due fattori?",
      keywords: "due fattori 2FA TOTP authenticator codice sicurezza codice di recupero password dimenticata",
      a: [
        { p: "In [Altro → Sicurezza](/me/security) scegli «Attiva l’autenticazione a due fattori», scansiona il codice QR con un’app di autenticazione (p. es. Aegis, Google o Microsoft Authenticator) e inserisci il codice a 6 cifre. Conserva bene i codici di recupero: ti aiutano se perdi il telefono. Fortemente consigliato per admin e titolari." },
        { p: "Password dimenticata? Nella pagina di accesso scegli «Password dimenticata?», riceverai un link per e-mail." },
      ],
    },
  },
  {
    id: "datenschutz",
    audience: "member",
    de: {
      q: "Wie lade ich meine Daten herunter oder lösche mein Konto?",
      keywords: "Datenschutz DSG revDSG Export Daten herunterladen Konto löschen Account löschen Austritt",
      a: [
        { p: "Unter [Mehr → Datenschutz](/me/privacy) lädst du alle deine Daten als ZIP herunter oder löschst dein Konto. Rechnungen, Buchungen und Resultate bleiben für den Verein erhalten, aber ohne deinen Namen (pseudonymisiert)." },
      ],
    },
    fr: {
      q: "Comment télécharger mes données ou supprimer mon compte ?",
      keywords: "protection des données LPD nLPD export données télécharger supprimer le compte démission",
      a: [
        { p: "Sous [Plus → Protection des données](/me/privacy), tu télécharges toutes tes données en ZIP ou tu supprimes ton compte. Les factures, réservations et résultats restent à disposition de la société, mais sans ton nom (pseudonymisés)." },
      ],
    },
    it: {
      q: "Come scarico i miei dati o elimino il mio account?",
      keywords: "protezione dei dati LPD nLPD esportazione dati scaricare eliminare account dimissione",
      a: [
        { p: "In [Altro → Protezione dei dati](/me/privacy) scarichi tutti i tuoi dati come ZIP o elimini il tuo account. Fatture, prenotazioni e risultati restano alla società, ma senza il tuo nome (pseudonimizzati)." },
      ],
    },
  },
  {
    id: "stand-checkin",
    audience: "member",
    de: {
      q: "Wie checke ich am Stand ein?",
      keywords: "Standbetrieb Check-in einchecken auschecken QR-Code Standordnung Standbuch Stand offen",
      a: [
        { p: "Scanne den QR-Code am Stand oder öffne [Standbetrieb](/range) → «Einchecken». Beim ersten Mal bestätigst du die aktuelle Standordnung. Beim Gehen tippst du auf «Auschecken»." },
        { p: "So weiss der Standchef, wer am Stand ist. Die Einträge landen im Standbuch des Vereins." },
      ],
    },
    fr: {
      q: "Comment faire le check-in au stand ?",
      keywords: "exploitation du stand check-in s’enregistrer check-out code QR règlement du stand journal du stand stand ouvert",
      a: [
        { p: "Scanne le code QR au stand ou ouvre [Exploitation du stand](/range) → « Check-in ». La première fois, tu confirmes le règlement du stand en vigueur. En partant, touche « Check-out »." },
        { p: "Ainsi, le chef de stand sait qui est présent. Les entrées sont consignées dans le journal du stand de la société." },
      ],
    },
    it: {
      q: "Come faccio il check-in allo stand?",
      keywords: "gestione dello stand check-in registrarsi check-out codice QR regolamento dello stand registro dello stand stand aperto",
      a: [
        { p: "Scansiona il codice QR allo stand o apri [Gestione dello stand](/range) → «Check-in». La prima volta confermi il regolamento dello stand in vigore. Quando te ne vai tocca «Check-out»." },
        { p: "Così il capo stand sa chi è presente. Le registrazioni finiscono nel registro dello stand della società." },
      ],
    },
  },
  {
    id: "helfer",
    audience: "member",
    de: {
      q: "Wie trage ich mich für einen Helfereinsatz ein?",
      keywords: "Helfereinsätze Schicht eintragen austragen Arbeitsstunden Ersatzabgabe Stunden erfassen Kalender",
      a: [
        { p: "Unter [Helfereinsätze](/shifts) siehst du offene Schichten. Mit «Ich helfe mit» übernimmst du einen Platz, bis zum Beginn kannst du dich wieder austragen. Unter «Meine» lädst du eine Schicht in deinen Kalender." },
        { p: "Hat dein Verein Pflicht-Arbeitsstunden, siehst du unter «Stunden», wie viele dir noch fehlen. Arbeit ausserhalb von Schichten erfasst du dort selbst, der Vorstand bestätigt sie." },
      ],
    },
    fr: {
      q: "Comment m’inscrire pour un engagement bénévole ?",
      keywords: "engagements bénévoles équipe s’inscrire se désinscrire heures de travail taxe de remplacement saisir des heures calendrier",
      a: [
        { p: "Sous [Engagements bénévoles](/shifts), tu vois les équipes ouvertes. Avec « Je participe », tu prends une place ; jusqu’au début, tu peux te désinscrire. Sous « Les miens », tu ajoutes un engagement à ton calendrier." },
        { p: "Si ta société a des heures de travail obligatoires, tu vois sous « Heures » combien il t’en manque. Le travail effectué en dehors des équipes, tu le saisis toi-même à cet endroit ; le comité le confirme." },
      ],
    },
    it: {
      q: "Come mi iscrivo a un turno di volontariato?",
      keywords: "turni di volontariato turno iscriversi disiscriversi ore di lavoro tassa sostitutiva registrare ore calendario",
      a: [
        { p: "In [Turni di volontariato](/shifts) vedi i turni aperti. Con «Partecipo» prendi un posto; fino all’inizio puoi disiscriverti. In «I miei» aggiungi un turno al tuo calendario." },
        { p: "Se la tua società prevede ore di lavoro obbligatorie, in «Ore» vedi quante te ne mancano. Il lavoro svolto fuori dai turni lo registri lì tu stesso, il comitato lo conferma." },
      ],
    },
  },
  {
    id: "obligatorisch",
    audience: "member",
    de: {
      q: "Wo sehe ich, ob mein Obligatorisch bestanden ist?",
      keywords: "Bundesübungen Obligatorisch Feldschiessen bestanden verblieben amtlich Schiessnachweis Bestätigung Waffenerwerb",
      a: [
        { p: "Unter [Bundesübungen](/federal) siehst du deinen Stand im laufenden Jahr. Er erscheint, sobald der Schützenmeister dein Resultat amtlich bestätigt hat. Bestätigte Resultate kannst du nicht mehr selbst ändern." },
        { p: "Unter «Schiessnachweis» findest du deine Schiesstage der letzten Jahre und eine Bestätigung zum Ausdrucken. Welche Nachweise eine Behörde verlangt, entscheidet die zuständige Stelle." },
      ],
    },
    fr: {
      q: "Où vois-je si j’ai réussi mon tir obligatoire ?",
      keywords: "tirs fédéraux tir obligatoire tir en campagne réussi restés officiel attestation de tir confirmation acquisition d’arme",
      a: [
        { p: "Sous [Tirs fédéraux](/federal), tu vois où tu en es pour l’année en cours. Ton état apparaît dès que le chef de tir a confirmé officiellement ton résultat. Tu ne peux plus modifier toi-même les résultats confirmés." },
        { p: "Sous « Attestation de tir », tu trouves tes jours de tir des dernières années et une confirmation à imprimer. Les justificatifs exigés par une autorité relèvent de l’instance compétente." },
      ],
    },
    it: {
      q: "Dove vedo se ho superato il tiro obbligatorio?",
      keywords: "tiri federali tiro obbligatorio tiro in campagna superato rimasti ufficiale attestato di tiro conferma acquisto di armi",
      a: [
        { p: "In [Tiri federali](/federal) vedi la tua situazione nell’anno in corso. Compare non appena il capo tiro ha confermato ufficialmente il tuo risultato. I risultati confermati non puoi più modificarli tu stesso." },
        { p: "In «Attestato di tiro» trovi i tuoi giorni di tiro degli ultimi anni e una conferma da stampare. Quali attestati richieda un’autorità lo decide l’ufficio competente." },
      ],
    },
  },
  {
    id: "meisterschaft",
    audience: "member",
    de: {
      q: "Wie wird die Jahresmeisterschaft berechnet?",
      keywords: "Jahresmeisterschaft Rangliste Rang Streichresultate beste Resultate Kategorie Bonus Pflichtprogramm nicht klassiert",
      a: [
        { p: "Für jedes Programm der Meisterschaft zählen deine besten Resultate (z.B. die besten 3), die übrigen werden gestrichen. Fehlt ein Pflichtprogramm, bist du «nicht klassiert». Die genauen Regeln stehen auf der Seite der [Meisterschaft](/championship); massgebend ist das Reglement deines Vereins." },
      ],
    },
    fr: {
      q: "Comment le championnat annuel est-il calculé ?",
      keywords: "championnat annuel classement rang résultats biffés meilleurs résultats catégorie bonus programme obligatoire non classé",
      a: [
        { p: "Pour chaque programme du championnat, tes meilleurs résultats comptent (p. ex. les 3 meilleurs), les autres sont biffés. S’il manque un programme obligatoire, tu es « non classé ». Les règles exactes figurent sur la page du [championnat](/championship) ; le règlement de ta société fait foi." },
      ],
    },
    it: {
      q: "Come viene calcolato il campionato annuale?",
      keywords: "campionato annuale classifica rango risultati stralciati migliori risultati categoria bonus programma obbligatorio non classificato",
      a: [
        { p: "Per ogni programma del campionato contano i tuoi migliori risultati (p. es. i 3 migliori), gli altri vengono stralciati. Se manca un programma obbligatorio sei «non classificato». Le regole esatte sono sulla pagina del [campionato](/championship); fa stato il regolamento della tua società." },
      ],
    },
  },
  {
    id: "kurse",
    audience: "member",
    de: {
      q: "Wo sehe ich meinen Stand im Kurs?",
      keywords: "Kurse Jungschützenkurs J+S Ausbildung Präsenz Pflichtprogramme Kursausweis",
      a: [
        { p: "Unter [Kurse](/courses) siehst du deine Kurse mit Präsenz und den Pflichtprogrammen, die du schon bestanden hast. Den Kursausweis erstellt die Kursleitung nach dem Abschluss." },
      ],
    },
    fr: {
      q: "Où vois-je où j’en suis dans mon cours ?",
      keywords: "cours cours de jeunes tireurs J+S formation présence programmes obligatoires attestation de cours",
      a: [
        { p: "Sous [Cours](/courses), tu vois tes cours avec les présences et les programmes obligatoires que tu as déjà réussis. L’attestation de cours est établie par la direction du cours à la fin." },
      ],
    },
    it: {
      q: "Dove vedo a che punto sono nel corso?",
      keywords: "corsi corso giovani tiratori G+S formazione presenze programmi obbligatori attestato del corso",
      a: [
        { p: "In [Corsi](/courses) vedi i tuoi corsi con le presenze e i programmi obbligatori che hai già superato. L’attestato del corso viene emesso dalla direzione del corso alla fine." },
      ],
    },
  },
];
