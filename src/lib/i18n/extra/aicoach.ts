/**
 * Zusatz-Wörterbuch «aicoach» (Welle E): Schützen-Coach auf /scores/stats, Spaltenzuordnung mit Claude
 * (Resultat- und Mitglieder-Import) und die Texte des Resultat-Import-Assistenten (aicoach.imp.*).
 * Französisch: normale Leerzeichen bei « » ? ! ; : – frenchSpacing() setzt die geschützten.
 * Platzhalter {name} usw. sind in allen Sprachen identisch. Mehrzahl: Schlüssel .one / .other.
 */
import { frenchSpacing } from "./shell";

type Row = readonly [de: string, fr: string, it: string, en: string];

const FIELDS: Record<string, Row> = {
  ignore: ["– nicht übernehmen –", "– ne pas reprendre –", "– non riprendere –", "– do not import –"],
  name: ["Name (Vor- und Nachname)", "Nom (prénom et nom)", "Nome (nome e cognome)", "Name (first and last name)"],
  firstName: ["Vorname", "Prénom", "Nome", "First name"],
  lastName: ["Nachname", "Nom de famille", "Cognome", "Last name"],
  startNo: ["Startnummer", "Numéro de départ", "Numero di partenza", "Start number"],
  club: ["Verein (nur Info)", "Société (info seulement)", "Società (solo info)", "Club (information only)"],
  discipline: ["Disziplin / Stich", "Discipline / passe", "Disciplina / serie", "Discipline / match"],
  date: ["Datum", "Date", "Data", "Date"],
  shotNo: ["Schuss-Nr.", "N° du coup", "N. del colpo", "Shot no."],
  shotValue: ["Schusswert (Ring/Wert)", "Valeur du coup (points)", "Valore del colpo (punti)", "Shot value (ring/value)"],
  series: ["Serie (Nummer)", "Série (numéro)", "Serie (numero)", "Series (number)"],
  seriesTotal: ["Serientotal", "Total de la série", "Totale della serie", "Series total"],
  total: ["Total", "Total", "Totale", "Total"],
  x: ["Trefferlage X", "Position X", "Posizione X", "Hit position X"],
  y: ["Trefferlage Y", "Position Y", "Posizione Y", "Hit position Y"],
  teiler: ["Teiler (nur Info)", "Teiler (info seulement)", "Teiler (solo info)", "Teiler (information only)"],
};

const PRESETS: Record<string, { label: Row; hint: Row }> = {
  generic: {
    label: ["Allgemein (CSV)", "Générique (CSV)", "Generico (CSV)", "General (CSV)"],
    hint: [
      "Eigene Liste: eine Zeile pro Schuss (Name, Schuss, Wert) oder pro Schütze (Name, Serie 1 … Total).",
      "Liste personnelle : une ligne par coup (nom, coup, valeur) ou par tireur (nom, série 1 … total).",
      "Elenco proprio: una riga per colpo (nome, colpo, valore) o per tiratore (nome, serie 1 … totale).",
      "Your own list: one row per shot (name, shot, value) or per shooter (name, series 1 … total).",
    ],
  },
  meyton: {
    label: ["Meyton (Export)", "Meyton (export)", "Meyton (esportazione)", "Meyton (export)"],
    hint: [
      "Schussexport aus Meyton (z.B. Startnummer, Name, Vorname, Disziplin, Schuss, Ring/Wert, Teiler, X, Y).",
      "Export des coups depuis Meyton (p. ex. numéro de départ, nom, prénom, discipline, coup, valeur, Teiler, X, Y).",
      "Esportazione dei colpi da Meyton (p. es. numero di partenza, cognome, nome, disciplina, colpo, valore, Teiler, X, Y).",
      "Shot export from Meyton (e.g. start number, name, first name, discipline, shot, ring/value, Teiler, X, Y).",
    ],
  },
  sius: {
    label: ["SIUS (SIUSData Export)", "SIUS (export SIUSData)", "SIUS (esportazione SIUSData)", "SIUS (SIUSData export)"],
    hint: [
      "Export aus SIUSData (z.B. StartNr, Nachname, Vorname, Disziplin, Serie, Schuss, Wert, X, Y).",
      "Export depuis SIUSData (p. ex. n° de départ, nom, prénom, discipline, série, coup, valeur, X, Y).",
      "Esportazione da SIUSData (p. es. n. di partenza, cognome, nome, disciplina, serie, colpo, valore, X, Y).",
      "Export from SIUSData (e.g. start no., last name, first name, discipline, series, shot, value, X, Y).",
    ],
  },
  shotmarker: {
    label: ["ShotMarker (CSV)", "ShotMarker (CSV)", "ShotMarker (CSV)", "ShotMarker (CSV)"],
    hint: [
      "CSV-Export einer Serie (String) aus ShotMarker: Schuss-ID, Wert (z.B. 10, X, V), X/Y in mm. Ohne Namensspalte gehört alles zu einem Schützen.",
      "Export CSV d’une série (string) depuis ShotMarker : ID du coup, valeur (p. ex. 10, X, V), X/Y en mm. Sans colonne de nom, tout appartient à un seul tireur.",
      "Esportazione CSV di una serie (string) da ShotMarker: ID del colpo, valore (p. es. 10, X, V), X/Y in mm. Senza colonna del nome tutto appartiene a un solo tiratore.",
      "CSV export of one string from ShotMarker: shot ID, value (e.g. 10, X, V), X/Y in mm. Without a name column everything belongs to one shooter.",
    ],
  },
};

const ROWS: Record<string, Row> = {
  // --- Schützen-Coach --------------------------------------------------------------
  "aicoach.coach.title": ["Auswertung mit Claude", "Analyse avec Claude", "Analisi con Claude", "Analysis with Claude"],
  "aicoach.coach.subtitle": [
    "Persönliche Einschätzung deiner letzten Resultate mit Trainingsvorschlag",
    "Évaluation personnelle de tes derniers résultats avec une proposition d’entraînement",
    "Valutazione personale dei tuoi ultimi risultati con una proposta di allenamento",
    "A personal review of your recent results with a training suggestion",
  ],
  "aicoach.coach.intro.one": [
    "Claude schaut sich deinen letzten abgeschlossenen Durchgang an und schlägt dir vor, woran du arbeiten kannst.",
    "Claude examine ta dernière passe terminée et te propose des points à travailler.",
    "Claude esamina la tua ultima ripresa conclusa e ti propone su cosa lavorare.",
    "Claude looks at your last completed session and suggests what to work on.",
  ],
  "aicoach.coach.intro.other": [
    "Claude schaut sich deine letzten {n} abgeschlossenen Durchgänge an und schlägt dir vor, woran du arbeiten kannst.",
    "Claude examine tes {n} dernières passes terminées et te propose des points à travailler.",
    "Claude esamina le tue ultime {n} riprese concluse e ti propone su cosa lavorare.",
    "Claude looks at your last {n} completed sessions and suggests what to work on.",
  ],
  "aicoach.coach.noData": [
    "Sobald du einen Durchgang abgeschlossen hast, kann Claude deine Resultate auswerten.",
    "Dès que tu auras terminé une passe, Claude pourra analyser tes résultats.",
    "Appena avrai concluso una ripresa, Claude potrà analizzare i tuoi risultati.",
    "As soon as you have completed a session, Claude can analyse your results.",
  ],
  "aicoach.coach.run": ["Auswertung erstellen", "Créer l’analyse", "Crea l’analisi", "Create analysis"],
  "aicoach.coach.running": ["Claude wertet aus …", "Claude analyse …", "Claude sta analizzando …", "Claude is analysing …"],
  "aicoach.coach.refresh": ["Mit neuen Resultaten auswerten", "Analyser avec les nouveaux résultats", "Analizza con i nuovi risultati", "Analyse with new results"],
  "aicoach.coach.staleHint": [
    "Seit dieser Auswertung sind neue Resultate dazugekommen.",
    "De nouveaux résultats ont été ajoutés depuis cette analyse.",
    "Da questa analisi sono stati aggiunti nuovi risultati.",
    "New results have been added since this analysis.",
  ],
  "aicoach.coach.basedOn.one": [
    "Erstellt aus deinem letzten Durchgang.",
    "Établie à partir de ta dernière passe.",
    "Creata dalla tua ultima ripresa.",
    "Based on your last session.",
  ],
  "aicoach.coach.basedOn.other": [
    "Erstellt aus deinen letzten {n} Durchgängen.",
    "Établie à partir de tes {n} dernières passes.",
    "Creata dalle tue ultime {n} riprese.",
    "Based on your last {n} sessions.",
  ],
  "aicoach.coach.privacy": [
    "Gesendet werden nur deine eigenen Resultate (Programm, Datum, Serien, Schüsse) – ohne Namen.",
    "Seuls tes propres résultats (programme, date, séries, coups) sont envoyés – sans nom.",
    "Vengono inviati solo i tuoi risultati (programma, data, serie, colpi) – senza nomi.",
    "Only your own results (programme, date, series, shots) are sent – no names.",
  ],
  "aicoach.coach.disclaimer": [
    "Claude (KI) kann sich irren; es gelten immer die Standordnung und die Anweisungen der Standaufsicht.",
    "Claude (IA) peut se tromper ; le règlement du stand et les consignes du chef de tir s’appliquent toujours.",
    "Claude (IA) può sbagliare; valgono sempre il regolamento dello stand e le istruzioni del direttore di tiro.",
    "Claude (AI) can make mistakes; the range rules and the range officer’s instructions always apply.",
  ],
  "aicoach.coach.strengths": ["Das läuft gut", "Ce qui va bien", "Cosa va bene", "Going well"],
  "aicoach.coach.focus": ["Daran arbeiten", "À travailler", "Su cosa lavorare", "To work on"],
  "aicoach.coach.training": ["Trainingsvorschlag", "Proposition d’entraînement", "Proposta di allenamento", "Training suggestion"],
  "aicoach.retryIn": ["Bitte in {s} Sekunden nochmals versuchen.", "Merci de réessayer dans {s} secondes.", "Riprova tra {s} secondi.", "Please try again in {s} seconds."],
  "aicoach.err.noPermission": ["Keine Berechtigung.", "Pas d’autorisation.", "Nessuna autorizzazione.", "No permission."],
  "aicoach.err.invalid": ["Ungültige Eingabe.", "Saisie invalide.", "Immissione non valida.", "Invalid input."],

  // --- Spaltenzuordnung mit Claude ----------------------------------------------------
  "aicoach.map.title": ["Spalten mit Claude zuordnen", "Attribuer les colonnes avec Claude", "Assegna le colonne con Claude", "Map columns with Claude"],
  "aicoach.map.privacy": [
    "Gesendet werden nur die Spaltennamen und drei Beispielzeilen – Namen, E-Mail-Adressen und Telefonnummern unkenntlich gemacht.",
    "Seuls les noms de colonnes et trois lignes d’exemple sont envoyés – noms, adresses e-mail et numéros de téléphone masqués.",
    "Vengono inviati solo i nomi delle colonne e tre righe di esempio – nomi, indirizzi e-mail e numeri di telefono resi irriconoscibili.",
    "Only the column names and three sample rows are sent – names, e-mail addresses and phone numbers are masked.",
  ],
  "aicoach.map.run": ["Zuordnung vorschlagen lassen", "Demander une proposition", "Chiedi una proposta", "Suggest a mapping"],
  "aicoach.map.running": ["Claude ordnet zu …", "Claude attribue …", "Claude sta assegnando …", "Claude is mapping …"],
  "aicoach.map.changes.one": ["Vorschlag: 1 Spalte anders zuordnen.", "Proposition : attribuer 1 colonne autrement.", "Proposta: assegnare 1 colonna in modo diverso.", "Suggestion: map 1 column differently."],
  "aicoach.map.changes.other": ["Vorschlag: {n} Spalten anders zuordnen.", "Proposition : attribuer {n} colonnes autrement.", "Proposta: assegnare {n} colonne in modo diverso.", "Suggestion: map {n} columns differently."],
  "aicoach.map.same": [
    "Claude schlägt dieselbe Zuordnung vor.",
    "Claude propose la même attribution.",
    "Claude propone la stessa assegnazione.",
    "Claude suggests the same mapping.",
  ],
  "aicoach.map.becomes": ["wird zu", "devient", "diventa", "becomes"],
  "aicoach.map.conf.high": ["sicher", "sûr", "sicuro", "certain"],
  "aicoach.map.conf.medium": ["wahrscheinlich", "probable", "probabile", "likely"],
  "aicoach.map.conf.low": ["unsicher", "incertain", "incerto", "uncertain"],
  "aicoach.map.layout": ["Aufbau der Datei: «{layout}»", "Structure du fichier : « {layout} »", "Struttura del file: «{layout}»", "File layout: “{layout}”"],
  "aicoach.map.check": [
    "Vorschlag von Claude (KI) – bitte prüfen. Nichts wird gespeichert, bevor du den Import bestätigst.",
    "Proposition de Claude (IA) – merci de vérifier. Rien n’est enregistré avant que tu confirmes l’import.",
    "Proposta di Claude (IA) – verifica per favore. Nulla viene salvato prima che tu confermi l’importazione.",
    "Suggestion by Claude (AI) – please check. Nothing is saved until you confirm the import.",
  ],
  "aicoach.map.apply": ["Übernehmen", "Reprendre", "Applica", "Apply"],
  "aicoach.map.discard": ["Verwerfen", "Rejeter", "Scarta", "Discard"],
  "aicoach.map.applied": ["Zuordnung übernommen – bitte prüfen", "Attribution reprise – merci de vérifier", "Assegnazione applicata – verifica per favore", "Mapping applied – please check"],
  "aicoach.map.nothing": [
    "Claude konnte keine Spalte sicher zuordnen. Bitte von Hand zuordnen.",
    "Claude n’a pu attribuer aucune colonne avec certitude. Merci de les attribuer manuellement.",
    "Claude non è riuscito ad assegnare alcuna colonna con certezza. Assegnale a mano.",
    "Claude could not map any column reliably. Please map them by hand.",
  ],

  // --- Resultat-Import: Seite ---------------------------------------------------------
  "aicoach.imp.title": ["Resultate importieren", "Importer des résultats", "Importa risultati", "Import results"],
  "aicoach.imp.subtitle": [
    "Aus elektronischen Trefferanzeigen (Meyton, SIUS, ShotMarker) oder CSV",
    "Depuis des cibleries électroniques (Meyton, SIUS, ShotMarker) ou un CSV",
    "Da bersagli elettronici (Meyton, SIUS, ShotMarker) o CSV",
    "From electronic scoring systems (Meyton, SIUS, ShotMarker) or CSV",
  ],
  "aicoach.imp.back": ["Schiessen", "Tir", "Tiro", "Shooting"],
  "aicoach.imp.history": ["Bisherige Importe", "Imports précédents", "Importazioni precedenti", "Previous imports"],
  "aicoach.imp.historyRows": ["{n} Zeilen", "{n} lignes", "{n} righe", "{n} rows"],
  "aicoach.imp.match": ["Durchgang", "Passe", "Ripresa", "Session"],
  "aicoach.imp.participants": ["{n} Teilnehmende", "{n} participants", "{n} partecipanti", "{n} participants"],
  "aicoach.imp.matchDeleted": ["Durchgang gelöscht", "Passe supprimée", "Ripresa eliminata", "Session deleted"],
  "aicoach.imp.noHistory": ["Noch keine Importe", "Aucun import pour l’instant", "Ancora nessuna importazione", "No imports yet"],
  "aicoach.imp.noHistoryText": [
    "Importierte Dateien erscheinen hier mit Link zum Durchgang.",
    "Les fichiers importés apparaissent ici avec un lien vers la passe.",
    "I file importati appaiono qui con un link alla ripresa.",
    "Imported files appear here with a link to the session.",
  ],

  // --- Resultat-Import: Assistent -----------------------------------------------------
  "aicoach.imp.steps": ["Schritte", "Étapes", "Passi", "Steps"],
  "aicoach.imp.step.upload": ["Datei", "Fichier", "File", "File"],
  "aicoach.imp.step.map": ["Spalten", "Colonnes", "Colonne", "Columns"],
  "aicoach.imp.step.assign": ["Zuordnen", "Attribuer", "Assegna", "Assign"],
  "aicoach.imp.step.done": ["Fertig", "Terminé", "Fatto", "Done"],
  "aicoach.imp.failed": ["Das hat nicht geklappt. Bitte nochmals versuchen.", "Cela n’a pas fonctionné. Merci de réessayer.", "Non ha funzionato. Riprova.", "That didn’t work. Please try again."],
  "aicoach.imp.presetDetected": ["Vorlage «{name}» erkannt", "Modèle « {name} » reconnu", "Modello «{name}» riconosciuto", "Template “{name}” detected"],
  "aicoach.imp.imported": ["Resultate importiert", "Résultats importés", "Risultati importati", "Results imported"],
  "aicoach.imp.dupTitle": ["Diese Datei wurde bereits importiert", "Ce fichier a déjà été importé", "Questo file è già stato importato", "This file has already been imported"],
  "aicoach.imp.dupText": [
    "«{file}» am {date}. Ein zweiter Import würde die Resultate doppelt erfassen. Um neu zu importieren, zuerst den Durchgang löschen.",
    "« {file} » le {date}. Un deuxième import enregistrerait les résultats à double. Pour importer à nouveau, supprime d’abord la passe.",
    "«{file}» il {date}. Una seconda importazione registrerebbe i risultati due volte. Per importare di nuovo, elimina prima la ripresa.",
    "“{file}” on {date}. A second import would record the results twice. To import again, delete the session first.",
  ],
  "aicoach.imp.chooseFile": ["Exportdatei auswählen", "Choisir le fichier d’export", "Scegli il file di esportazione", "Choose export file"],
  "aicoach.imp.fileLimits": [
    "CSV oder TXT, höchstens 5 MB (Trennzeichen ; , oder Tab)",
    "CSV ou TXT, 5 Mo au maximum (séparateur ; , ou tabulation)",
    "CSV o TXT, al massimo 5 MB (separatore ; , o tabulazione)",
    "CSV or TXT, max. 5 MB (separator ; , or tab)",
  ],
  "aicoach.imp.preset": ["Vorlage", "Modèle", "Modello", "Template"],
  "aicoach.imp.reading": ["Wird gelesen …", "Lecture …", "Lettura …", "Reading …"],
  "aicoach.imp.next": ["Weiter", "Continuer", "Avanti", "Next"],
  "aicoach.imp.back.step": ["Zurück", "Retour", "Indietro", "Back"],
  "aicoach.imp.howTo": ["So geht’s", "Comment faire", "Come funziona", "How it works"],
  "aicoach.imp.howTo1a": ["Vorlagen ordnen typische Spaltennamen vor.", "Les modèles pré-attribuent les noms de colonnes usuels.", "I modelli preassegnano i nomi di colonna tipici.", "Templates pre-map typical column names."],
  "aicoach.imp.howTo1b": ["– die Formate unterscheiden sich je nach Version.", "– les formats varient selon la version.", "– i formati variano a seconda della versione.", "– formats differ from version to version."],
  "aicoach.imp.howTo2": [
    "Zwei Aufbauten: eine Zeile pro Schuss (Schütze, Wert, optional Serie und X/Y) oder eine Zeile pro Schütze (Serientotale, Total).",
    "Deux structures : une ligne par coup (tireur, valeur, éventuellement série et X/Y) ou une ligne par tireur (totaux des séries, total).",
    "Due strutture: una riga per colpo (tiratore, valore, eventualmente serie e X/Y) o una riga per tiratore (totali delle serie, totale).",
    "Two layouts: one row per shot (shooter, value, optionally series and X/Y) or one row per shooter (series totals, total).",
  ],
  "aicoach.imp.howTo3": [
    "Nichts wird gespeichert, bevor du im letzten Schritt bestätigst. Dieselbe Datei kann nur einmal importiert werden – ausser der damals erstellte Durchgang wurde gelöscht.",
    "Rien n’est enregistré avant ta confirmation à la dernière étape. Un même fichier ne peut être importé qu’une fois – sauf si la passe créée alors a été supprimée.",
    "Nulla viene salvato prima della tua conferma nell’ultimo passo. Lo stesso file può essere importato una sola volta – a meno che la ripresa creata allora sia stata eliminata.",
    "Nothing is saved until you confirm in the last step. The same file can only be imported once – unless the session created back then has been deleted.",
  ],
  "aicoach.imp.disclaimer": ["Vorlage, bitte mit eigener Exportdatei prüfen", "Modèle, à vérifier avec ton propre fichier d’export", "Modello, da verificare con il proprio file di esportazione", "Template – please check with your own export file"],
  "aicoach.imp.rows.one": ["1 Zeile", "1 ligne", "1 riga", "1 row"],
  "aicoach.imp.rows.other": ["{n} Zeilen", "{n} lignes", "{n} righe", "{n} rows"],
  "aicoach.imp.delimiter": ["Trennzeichen «{d}»", "séparateur « {d} »", "separatore «{d}»", "separator “{d}”"],
  "aicoach.imp.tab": ["Tab", "tabulation", "tabulazione", "tab"],
  "aicoach.imp.layout": ["Aufbau der Datei", "Structure du fichier", "Struttura del file", "File layout"],
  "aicoach.imp.layout.shots": ["Zeile pro Schuss", "Ligne par coup", "Riga per colpo", "Row per shot"],
  "aicoach.imp.layout.totals": ["Zeile pro Schütze", "Ligne par tireur", "Riga per tiratore", "Row per shooter"],
  "aicoach.imp.discipline": ["Disziplin", "Discipline", "Disciplina", "Discipline"],
  "aicoach.imp.allDisciplines": ["Alle ({n})", "Toutes ({n})", "Tutte ({n})", "All ({n})"],
  "aicoach.imp.allWarn": [
    "Achtung: Bei «Alle» werden die Schüsse aller Disziplinen pro Schütze zusammengezählt.",
    "Attention : avec « Toutes », les coups de toutes les disciplines sont additionnés par tireur.",
    "Attenzione: con «Tutte» i colpi di tutte le discipline vengono sommati per tiratore.",
    "Note: with “All”, the shots of all disciplines are added up per shooter.",
  ],
  "aicoach.imp.disciplineHint": [
    "Pro Import entsteht ein Durchgang mit einem Programm. Weitere Disziplinen bitte einzeln importieren – dieselbe Datei geht nur einmal, deshalb pro Disziplin eine eigene Exportdatei verwenden.",
    "Chaque import crée une passe avec un programme. Importe les autres disciplines séparément – un même fichier ne passe qu’une fois, utilise donc un fichier d’export par discipline.",
    "Ogni importazione crea una ripresa con un programma. Importa le altre discipline separatamente – lo stesso file è accettato una sola volta, quindi usa un file di esportazione per disciplina.",
    "Each import creates one session with one programme. Import other disciplines separately – the same file only works once, so use a separate export file per discipline.",
  ],
  "aicoach.imp.emptyColumn": ["leer", "vide", "vuota", "empty"],
  "aicoach.imp.mapAs": ["Spalte «{col}» übernehmen als", "Reprendre la colonne « {col} » comme", "Riprendi la colonna «{col}» come", "Import column “{col}” as"],
  "aicoach.imp.toAssign": ["Weiter zur Zuordnung", "Continuer vers l’attribution", "Avanti all’assegnazione", "Continue to assignment"],
  "aicoach.imp.preview.one": ["Vorschau · 1 Schütze", "Aperçu · 1 tireur", "Anteprima · 1 tiratore", "Preview · 1 shooter"],
  "aicoach.imp.preview.other": ["Vorschau · {n} Schützen", "Aperçu · {n} tireurs", "Anteprima · {n} tiratori", "Preview · {n} shooters"],
  "aicoach.imp.skippedRows": ["{n} Zeilen übersprungen", "{n} lignes ignorées", "{n} righe saltate", "{n} rows skipped"],
  "aicoach.imp.startNo": ["Startnr. {no}", "N° de départ {no}", "N. di partenza {no}", "Start no. {no}"],
  "aicoach.imp.shots": ["{n} Schüsse", "{n} coups", "{n} colpi", "{n} shots"],
  "aicoach.imp.sighters": ["(+{n} Probe)", "(+{n} d’essai)", "(+{n} di prova)", "(+{n} sighters)"],
  "aicoach.imp.withXY": ["mit Trefferlage", "avec position des impacts", "con posizione dei colpi", "with hit positions"],
  "aicoach.imp.seriesList": ["Serien: {series}", "Séries : {series}", "Serie: {series}", "Series: {series}"],
  "aicoach.imp.onlyTotal": ["nur Total", "total seulement", "solo totale", "total only"],
  "aicoach.imp.more": ["… und {n} weitere", "… et {n} autres", "… e altri {n}", "… and {n} more"],
  "aicoach.imp.singleShooter": ["Schütze aus Datei", "Tireur du fichier", "Tiratore dal file", "Shooter from file"],
  "aicoach.imp.program": ["Programm", "Programme", "Programma", "Programme"],
  "aicoach.imp.chooseProgram": ["Programm wählen …", "Choisir un programme …", "Scegli un programma …", "Choose programme …"],
  "aicoach.imp.clubProgram": ["(Verein)", "(société)", "(società)", "(club)"],
  "aicoach.imp.programShots": ["{n} Schuss", "{n} coups", "{n} colpi", "{n} shots"],
  "aicoach.imp.stageDesc": ["{i}. {name}: {shots} × max. {max}", "{i}. {name} : {shots} × max. {max}", "{i}. {name}: {shots} × max. {max}", "{i}. {name}: {shots} × max. {max}"],
  "aicoach.imp.maximum": ["Maximum {max}", "Maximum {max}", "Massimo {max}", "Maximum {max}"],
  "aicoach.imp.date": ["Datum", "Date", "Data", "Date"],
  "aicoach.imp.members": ["Mitglieder", "Membres", "Soci", "Members"],
  "aicoach.imp.guests": ["Gäste", "Invités", "Ospiti", "Guests"],
  "aicoach.imp.withErrors": ["Mit Fehlern", "Avec erreurs", "Con errori", "With errors"],
  "aicoach.imp.notTaken": ["{n} nicht übernommen", "{n} non repris", "{n} non ripresi", "{n} not imported"],
  "aicoach.imp.mismatch.one": ["1 Schütze passt nicht zum Programm.", "1 tireur ne correspond pas au programme.", "1 tiratore non corrisponde al programma.", "1 shooter does not match the programme."],
  "aicoach.imp.mismatch.other": ["{n} Schützen passen nicht zum Programm.", "{n} tireurs ne correspondent pas au programme.", "{n} tiratori non corrispondono al programma.", "{n} shooters do not match the programme."],
  "aicoach.imp.skipErrors": ["Alle mit Fehlern nicht übernehmen", "Ne pas reprendre ceux avec erreurs", "Non riprendere quelli con errori", "Skip all with errors"],
  "aicoach.imp.showMore": ["Weitere {n} anzeigen", "Afficher {n} de plus", "Mostra altri {n}", "Show {n} more"],
  "aicoach.imp.committing": ["Wird übernommen …", "Reprise en cours …", "Importazione in corso …", "Importing …"],
  "aicoach.imp.needProgram": ["Programm wählen", "Choisir un programme", "Scegli un programma", "Choose programme"],
  "aicoach.imp.blocking": ["{n} mit Fehlern", "{n} avec erreurs", "{n} con errori", "{n} with errors"],
  "aicoach.imp.commit.one": ["1 Resultat übernehmen", "Reprendre 1 résultat", "Riprendi 1 risultato", "Import 1 result"],
  "aicoach.imp.commit.other": ["{n} Resultate übernehmen", "Reprendre {n} résultats", "Riprendi {n} risultati", "Import {n} results"],
  "aicoach.imp.error": ["Fehler", "Erreur", "Errore", "Error"],
  "aicoach.imp.warning": ["Hinweis", "Remarque", "Avviso", "Note"],
  "aicoach.imp.ok": ["In Ordnung", "En ordre", "In ordine", "OK"],
  "aicoach.imp.totals": ["Totale", "Totaux", "Totali", "Totals"],
  "aicoach.imp.lineShort": ["Z. {line}", "l. {line}", "r. {line}", "row {line}"],
  "aicoach.imp.ofMax": ["von {max}", "sur {max}", "su {max}", "of {max}"],
  "aicoach.imp.assignAria": ["{name}: zuordnen", "{name} : attribuer", "{name}: assegna", "{name}: assign"],
  "aicoach.imp.suggestions": ["Vorschläge", "Propositions", "Proposte", "Suggestions"],
  "aicoach.imp.asGuest": ["Als Gast", "Comme invité", "Come ospite", "As guest"],
  "aicoach.imp.skip": ["Nicht übernehmen", "Ne pas reprendre", "Non riprendere", "Do not import"],
  "aicoach.imp.doneTitle": ["Import abgeschlossen", "Import terminé", "Importazione conclusa", "Import complete"],
  "aicoach.imp.done.one": ["1 Resultat übernommen", "1 résultat repris", "1 risultato ripreso", "1 result imported"],
  "aicoach.imp.done.other": ["{n} Resultate übernommen", "{n} résultats repris", "{n} risultati ripresi", "{n} results imported"],
  "aicoach.imp.doneGuests.one": [", davon 1 Gast", ", dont 1 invité", ", di cui 1 ospite", ", including 1 guest"],
  "aicoach.imp.doneGuests.other": [", davon {n} Gäste", ", dont {n} invités", ", di cui {n} ospiti", ", including {n} guests"],
  "aicoach.imp.toMatch": ["Zum Durchgang", "Vers la passe", "Alla ripresa", "Go to session"],
  "aicoach.imp.another": ["Weitere Datei", "Autre fichier", "Altro file", "Another file"],

  // --- Resultat-Import: Server-Meldungen ----------------------------------------------
  "aicoach.imp.err.noPermission": ["Keine Berechtigung", "Pas d’autorisation", "Nessuna autorizzazione", "No permission"],
  "aicoach.imp.err.invalid": ["Ungültige Eingabe", "Saisie invalide", "Immissione non valida", "Invalid input"],
  "aicoach.imp.err.chooseDate": ["Datum wählen", "Choisir une date", "Scegli una data", "Choose a date"],
  "aicoach.imp.err.noFile": ["Bitte eine Datei auswählen.", "Merci de choisir un fichier.", "Scegli un file.", "Please choose a file."],
  "aicoach.imp.err.programUnavailable": ["Programm nicht verfügbar", "Programme non disponible", "Programma non disponibile", "Programme not available"],
  "aicoach.imp.err.noStages": ["Das Programm hat keine Serien.", "Le programme n’a pas de séries.", "Il programma non ha serie.", "The programme has no series."],
  "aicoach.imp.err.nothing": ["Keine Schützen zum Übernehmen.", "Aucun tireur à reprendre.", "Nessun tiratore da riprendere.", "No shooters to import."],
  "aicoach.imp.err.blocking.one": [
    "1 Schütze hat noch Fehler. Bitte korrigieren oder «Nicht übernehmen» wählen.",
    "1 tireur a encore des erreurs. Merci de corriger ou de choisir « Ne pas reprendre ».",
    "1 tiratore ha ancora errori. Correggi o scegli «Non riprendere».",
    "1 shooter still has errors. Please correct them or choose “Do not import”.",
  ],
  "aicoach.imp.err.blocking.other": [
    "{n} Schützen haben noch Fehler. Bitte korrigieren oder «Nicht übernehmen» wählen.",
    "{n} tireurs ont encore des erreurs. Merci de corriger ou de choisir « Ne pas reprendre ».",
    "{n} tiratori hanno ancora errori. Correggi o scegli «Non riprendere».",
    "{n} shooters still have errors. Please correct them or choose “Do not import”.",
  ],

  // --- Resultat-Import: Meldungen der Prüfung (messages.ts) ----------------------------
  "aicoach.imp.msg.empty": ["Die Datei ist leer.", "Le fichier est vide.", "Il file è vuoto.", "The file is empty."],
  "aicoach.imp.msg.tooLarge": [
    "Die Datei ist grösser als 5 MB. Bitte in mehrere Dateien aufteilen.",
    "Le fichier dépasse 5 Mo. Merci de le répartir en plusieurs fichiers.",
    "Il file supera 5 MB. Suddividilo in più file.",
    "The file is larger than 5 MB. Please split it into several files.",
  ],
  "aicoach.imp.msg.notText": [
    "Das sieht nicht nach einer Text- oder CSV-Datei aus. Bitte den Export als CSV oder TXT speichern.",
    "Cela ne ressemble pas à un fichier texte ou CSV. Merci d’enregistrer l’export en CSV ou TXT.",
    "Non sembra un file di testo o CSV. Salva l’esportazione come CSV o TXT.",
    "This does not look like a text or CSV file. Please save the export as CSV or TXT.",
  ],
  "aicoach.imp.msg.noData": [
    "Die Datei enthält keine Datenzeilen (erste Zeile = Spaltennamen).",
    "Le fichier ne contient aucune ligne de données (première ligne = noms des colonnes).",
    "Il file non contiene righe di dati (prima riga = nomi delle colonne).",
    "The file contains no data rows (first row = column names).",
  ],
  "aicoach.imp.msg.tooManyRows": ["Zu viele Zeilen ({n}). Höchstens {max} pro Import.", "Trop de lignes ({n}). {max} au maximum par import.", "Troppe righe ({n}). Al massimo {max} per importazione.", "Too many rows ({n}). At most {max} per import."],
  "aicoach.imp.msg.unreadable": ["Die Datei konnte nicht gelesen werden.", "Le fichier n’a pas pu être lu.", "Non è stato possibile leggere il file.", "The file could not be read."],
  "aicoach.imp.msg.needShotValue": ["Bitte eine Spalte als «Schusswert» zuordnen.", "Merci d’attribuer une colonne comme « valeur du coup ».", "Assegna una colonna come «valore del colpo».", "Please map one column as “shot value”."],
  "aicoach.imp.msg.needTotals": [
    "Bitte Spalten als «Serientotal», «Total» oder «Schusswert» zuordnen.",
    "Merci d’attribuer des colonnes comme « total de la série », « total » ou « valeur du coup ».",
    "Assegna colonne come «totale della serie», «totale» o «valore del colpo».",
    "Please map columns as “series total”, “total” or “shot value”.",
  ],
  "aicoach.imp.msg.tooManyShooters": ["Zu viele Schützen (höchstens {max} pro Import).", "Trop de tireurs ({max} au maximum par import).", "Troppi tiratori (al massimo {max} per importazione).", "Too many shooters (at most {max} per import)."],
  "aicoach.imp.msg.noShooters": [
    "Keine Schützen mit Resultaten gefunden. Bitte Spaltenzuordnung und Aufbau prüfen.",
    "Aucun tireur avec résultats trouvé. Merci de vérifier l’attribution des colonnes et la structure.",
    "Nessun tiratore con risultati trovato. Verifica l’assegnazione delle colonne e la struttura.",
    "No shooters with results found. Please check the column mapping and layout.",
  ],
  "aicoach.imp.msg.seriesUnreadable": ["Serie «{value}» nicht lesbar", "Série « {value} » illisible", "Serie «{value}» illeggibile", "Series “{value}” not readable"],
  "aicoach.imp.msg.shotUnreadable": ["Schusswert «{value}» nicht lesbar", "Valeur du coup « {value} » illisible", "Valore del colpo «{value}» illeggibile", "Shot value “{value}” not readable"],
  "aicoach.imp.msg.valueUnreadable": ["{label} «{value}» nicht lesbar", "{label} « {value} » illisible", "{label} «{value}» illeggibile", "{label} “{value}” not readable"],
  "aicoach.imp.msg.shotDupSeries": ["Schuss {no} (Serie {series}) kommt mehrfach vor (Zeile {line})", "Le coup {no} (série {series}) apparaît plusieurs fois (ligne {line})", "Il colpo {no} (serie {series}) compare più volte (riga {line})", "Shot {no} (series {series}) appears more than once (row {line})"],
  "aicoach.imp.msg.shotDup": ["Schuss {no} kommt mehrfach vor (Zeile {line})", "Le coup {no} apparaît plusieurs fois (ligne {line})", "Il colpo {no} compare più volte (riga {line})", "Shot {no} appears more than once (row {line})"],
  "aicoach.imp.msg.seriesTotalMissing": ["Serientotal fehlt", "Total de la série manquant", "Totale della serie mancante", "Series total missing"],
  "aicoach.imp.msg.seriesInvalid": ["Serie {series} ungültig", "Série {series} invalide", "Serie {series} non valida", "Series {series} invalid"],
  "aicoach.imp.msg.seriesDup": ["Serie {series} kommt mehrfach vor (Zeile {line})", "La série {series} apparaît plusieurs fois (ligne {line})", "La serie {series} compare più volte (riga {line})", "Series {series} appears more than once (row {line})"],
  "aicoach.imp.msg.multiRows": [
    "Mehrere Zeilen für denselben Schützen (Zeile {line}) – bei einer Zeile pro Schuss bitte «Zeile pro Schuss» wählen",
    "Plusieurs lignes pour le même tireur (ligne {line}) – pour une ligne par coup, choisis « Ligne par coup »",
    "Più righe per lo stesso tiratore (riga {line}) – con una riga per colpo scegli «Riga per colpo»",
    "Several rows for the same shooter (row {line}) – for one row per shot, choose “Row per shot”",
  ],
  "aicoach.imp.msg.noZone": ["Wert {value} passt zu keiner Zone", "La valeur {value} ne correspond à aucune zone", "Il valore {value} non corrisponde ad alcuna zona", "Value {value} matches no zone"],
  "aicoach.imp.msg.negativeValue": ["negativer Wert {value}", "valeur négative {value}", "valore negativo {value}", "negative value {value}"],
  "aicoach.imp.msg.overMax": ["Wert {value} über dem Maximum {max}", "Valeur {value} au-dessus du maximum {max}", "Valore {value} oltre il massimo {max}", "Value {value} above the maximum {max}"],
  "aicoach.imp.msg.labelNegative": ["{label}: negativer Wert", "{label} : valeur négative", "{label}: valore negativo", "{label}: negative value"],
  "aicoach.imp.msg.labelOverMax": ["{label}: {value} über dem Maximum {max}", "{label} : {value} au-dessus du maximum {max}", "{label}: {value} oltre il massimo {max}", "{label}: {value} above the maximum {max}"],
  "aicoach.imp.msg.labelDecimal": [
    "{label}: Zehntelwert {value}, das Programm wertet ganze Zahlen",
    "{label} : valeur décimale {value}, le programme compte en nombres entiers",
    "{label}: valore decimale {value}, il programma conta numeri interi",
    "{label}: decimal value {value}, the programme scores whole numbers",
  ],
  "aicoach.imp.msg.noStages": ["Programm ohne Serien", "Programme sans séries", "Programma senza serie", "Programme without series"],
  "aicoach.imp.msg.shotsNoSeries": ["{n} Schüsse ohne Serienangabe", "{n} coups sans indication de série", "{n} colpi senza indicazione della serie", "{n} shots without series"],
  "aicoach.imp.msg.seriesCount": ["{n} Serien in der Datei, das Programm hat {max}", "{n} séries dans le fichier, le programme en a {max}", "{n} serie nel file, il programma ne ha {max}", "{n} series in the file, the programme has {max}"],
  "aicoach.imp.msg.shotCount": ["{n} Schüsse, das Programm hat {max}", "{n} coups, le programme en a {max}", "{n} colpi, il programma ne ha {max}", "{n} shots, the programme has {max}"],
  "aicoach.imp.msg.stageNoShots": ["Serie {i} («{name}»): keine Schüsse", "Série {i} (« {name} ») : aucun coup", "Serie {i} («{name}»): nessun colpo", "Series {i} (“{name}”): no shots"],
  "aicoach.imp.msg.stageTooMany": ["Serie {i}: {n} Schüsse, erlaubt sind {max}", "Série {i} : {n} coups, {max} autorisés", "Serie {i}: {n} colpi, ammessi {max}", "Series {i}: {n} shots, {max} allowed"],
  "aicoach.imp.msg.stageTooFew": ["Serie {i}: {n} von {max} Schüssen", "Série {i} : {n} coups sur {max}", "Serie {i}: {n} colpi su {max}", "Series {i}: {n} of {max} shots"],
  "aicoach.imp.msg.stageNoTotal": ["Serie {i}: kein Total", "Série {i} : pas de total", "Serie {i}: nessun totale", "Series {i}: no total"],
  "aicoach.imp.msg.floored": ["Zehntelwerte auf ganze Ringe abgerundet", "Valeurs décimales arrondies à l’entier inférieur", "Valori decimali arrotondati per difetto all’intero", "Decimal values rounded down to whole rings"],
  "aicoach.imp.msg.totalVsShots": ["Total in der Datei {file}, aus den Schüssen berechnet {computed}", "Total dans le fichier {file}, calculé à partir des coups {computed}", "Totale nel file {file}, calcolato dai colpi {computed}", "Total in the file {file}, calculated from the shots {computed}"],
  "aicoach.imp.msg.totalVsSeries": ["Total in der Datei {file}, Summe der Serien {computed}", "Total dans le fichier {file}, somme des séries {computed}", "Totale nel file {file}, somma delle serie {computed}", "Total in the file {file}, sum of the series {computed}"],
  "aicoach.imp.msg.sighters.one": ["{n} Probeschuss nicht übernommen", "{n} coup d’essai non repris", "{n} colpo di prova non ripreso", "{n} sighter not imported"],
  "aicoach.imp.msg.sighters.other": ["{n} Probeschüsse nicht übernommen", "{n} coups d’essai non repris", "{n} colpi di prova non ripresi", "{n} sighters not imported"],
  "aicoach.imp.msg.onlyTotal": [
    "Nur das Gesamttotal ist bekannt – es wird bei Serie 1 gespeichert",
    "Seul le total général est connu – il est enregistré dans la série 1",
    "È noto solo il totale complessivo – viene salvato nella serie 1",
    "Only the overall total is known – it is saved in series 1",
  ],
  "aicoach.imp.msg.noResults": ["Keine Resultate", "Aucun résultat", "Nessun risultato", "No results"],
  "aicoach.imp.msg.memberTwice": ["Mitglied ist mehreren Schützen zugeordnet", "Le membre est attribué à plusieurs tireurs", "Il socio è assegnato a più tiratori", "Member is assigned to several shooters"],
  "aicoach.imp.msg.chooseProgram": ["Programm wählen", "Choisir un programme", "Scegli un programma", "Choose programme"],
  "aicoach.imp.msg.memberGone": ["Mitglied nicht (mehr) im Verein", "Membre ne fait (plus) partie de la société", "Socio non (più) nella società", "Member no longer in the club"],
  "aicoach.imp.msg.linePrefix": ["Zeile {line}: {text}", "Ligne {line} : {text}", "Riga {line}: {text}", "Row {line}: {text}"],
  "aicoach.imp.msg.stagePrefix": ["Serie {i}: {text}", "Série {i} : {text}", "Serie {i}: {text}", "Series {i}: {text}"],
};

for (const [f, row] of Object.entries(FIELDS)) ROWS[`aicoach.imp.field.${f}`] = row;
for (const [id, p] of Object.entries(PRESETS)) {
  ROWS[`aicoach.imp.preset.${id}.label`] = p.label;
  ROWS[`aicoach.imp.preset.${id}.hint`] = p.hint;
}

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
