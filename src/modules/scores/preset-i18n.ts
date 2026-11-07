import { PROGRAM_PRESETS, presetNames } from "./presets";
import type { Stage } from "./types";

/**
 * Übersetzungen der eingebauten globalen Programme (Vorlagen aus presets.ts) für die Anzeige.
 * In der Datenbank steht weiterhin der deutsche Text; übersetzt wird nur, was noch genau dem
 * Text der Vorlage entspricht. Ein vom Super-Admin geänderter Name oder eine geänderte
 * Beschreibung bleibt so, wie sie erfasst wurde. Eigene Programme der Vereine bleiben unübersetzt.
 *
 * Französisch mit «tu» und schmalen geschützten Leerzeichen vor ! ? ; : (wie im Wörterbuch «shooting»).
 * Englisch steht in eigenen Tabellen (EN_PRESETS, EN_STAGES, EN_STAGE_PREFIXES) mit denselben Schlüsseln.
 */
type Lang = "fr" | "it" | "en";
type Pair = readonly [fr: string, it: string];
type TableLang = "fr" | "it";

const HINT_FR = "Merci de vérifier les valeurs avec les prescriptions actuelles (DDPS/FST/canton).";
const HINT_IT = "Verifica i valori con le prescrizioni attuali (DDPS/FST/Cantone).";
const RULES_FR = "Le règlement en vigueur fait foi.";
const RULES_IT = "Fa stato il regolamento in vigore.";
const PROPOSAL_FR = "Proposition, merci de vérifier le règlement.";
const PROPOSAL_IT = "Proposta, verifica il regolamento.";

/** Name der Vorlage (deutsch) → [Name, Beschreibung] auf Französisch und Italienisch. */
const PRESETS: Record<string, { name: Pair; description: Pair }> = {
  "Pistole 25 m – Präzision": {
    name: ["Pistolet 25 m – Précision", "Pistola 25 m – Precisione"],
    description: [
      "Programme de précision classique à 25 m. 6 séries de 5 coups, points 1–10.",
      "Programma di precisione classico a 25 m. 6 serie da 5 colpi, punti 1–10.",
    ],
  },
  "Pistole 25 m – Duell": {
    name: ["Pistolet 25 m – Duel", "Pistola 25 m – Duello"],
    description: [
      "Duel : 6 séries de 5 coups, cible visible 3 s / masquée 7 s.",
      "Duello: 6 serie da 5 colpi, bersaglio visibile 3 s / coperto 7 s.",
    ],
  },
  "Pistole 10 m – 40 Schuss": {
    name: ["Pistolet 10 m – 40 coups", "Pistola 10 m – 40 colpi"],
    description: ["Pistolet à air comprimé 10 m, 4 séries de 10 coups.", "Pistola ad aria compressa 10 m, 4 serie da 10 colpi."],
  },
  "Luftgewehr 10 m – 40 Schuss (Zehntel)": {
    name: ["Carabine à air comprimé 10 m – 40 coups (dixièmes)", "Carabina ad aria compressa 10 m – 40 colpi (decimi)"],
    description: [
      "Carabine à air comprimé 10 m avec comptage au dixième, 4 séries de 10 coups.",
      "Carabina ad aria compressa 10 m con conteggio ai decimi, 4 serie da 10 colpi.",
    ],
  },
  "Gewehr 300 m – Obligatorisch": {
    name: ["Fusil 300 m – Tir obligatoire", "Fucile 300 m – Tiro obbligatorio"],
    description: [
      `Exemple pour le programme fédéral 300 m (merci d’adapter les séries et le comptage selon les prescriptions actuelles). Merci d’indiquer la limite de réussite dans la société en fonction du comptage. ${HINT_FR}`,
      `Esempio per il programma federale 300 m (adatta le serie e il conteggio secondo le prescrizioni attuali). Indica il limite di superamento nella società in base al conteggio. ${HINT_IT}`,
    ],
  },
  "Pistole 25 m – Obligatorisch": {
    name: ["Pistolet 25 m – Tir obligatoire", "Pistola 25 m – Tiro obbligatorio"],
    description: [
      "Programme fédéral pistolet 25 m : 5 coups isolés, 2 séries de 5 coups, 1 série de 5 coups (feu rapide). Merci d’indiquer la limite de réussite dans la société selon les prescriptions actuelles.",
      "Programma federale pistola 25 m: 5 colpi singoli, 2 serie da 5 colpi, 1 serie da 5 colpi (fuoco rapido). Indica il limite di superamento nella società secondo le prescrizioni attuali.",
    ],
  },
  "Indoor – Distanzleiter 5 bis 20 m": {
    name: ["Indoor – Échelle de distances 5 à 20 m", "Indoor – Scala di distanze da 5 a 20 m"],
    description: [
      "Pour les stands indoor à distance variable : 5 coups chacun à 5, 10, 15 et 20 m.",
      "Per stand indoor con distanza variabile: 5 colpi ciascuno a 5, 10, 15 e 20 m.",
    ],
  },
  "Indoor – Parcours mit Hindernissen": {
    name: ["Indoor – Parcours avec obstacles", "Indoor – Percorso con ostacoli"],
    description: [
      "Entraînement dynamique : comptage touché/manqué sur plusieurs postes avec couverture et changement de position.",
      "Allenamento dinamico: conteggio colpito/mancato su più postazioni con copertura e cambio di posizione.",
    ],
  },
  "Feldschiessen 300 m (nachempfunden)": {
    name: ["Tir en campagne 300 m (inspiré)", "Tiro in campagna 300 m (ispirato)"],
    description: [
      `Inspiré du tir en campagne : 18 coups couché à 300 m en trois parties (coup par coup, série, feu rapide). ${RULES_FR}`,
      `Ispirato al tiro in campagna: 18 colpi a terra a 300 m in tre parti (colpo singolo, serie, fuoco rapido). ${RULES_IT}`,
    ],
  },
  "Feldschiessen Pistole 25 m (nachempfunden)": {
    name: ["Tir en campagne pistolet 25 m (inspiré)", "Tiro in campagna pistola 25 m (ispirato)"],
    description: [
      `Inspiré du tir en campagne au pistolet : 18 coups à 25 m, coup par coup et deux séries avec limite de temps. ${RULES_FR}`,
      `Ispirato al tiro in campagna con la pistola: 18 colpi a 25 m, colpo singolo e due serie con limite di tempo. ${RULES_IT}`,
    ],
  },
  "Jungschützen-Kurs – Übung": {
    name: ["Cours jeunes tireurs – Exercice", "Corso giovani tiratori – Esercizio"],
    description: [
      "Exercice simple pour jeunes tireurs : coups de réglage, coups isolés et une courte série à 300 m couché. Idéal pour apprendre la respiration et le départ du coup.",
      "Esercizio semplice per giovani tiratori: colpi di aggiustamento, colpi singoli e una breve serie a 300 m a terra. Ideale per imparare la respirazione e lo scatto.",
    ],
  },
  "Luftgewehr 10 m – 60 Schuss (Zehntel)": {
    name: ["Carabine à air comprimé 10 m – 60 coups (dixièmes)", "Carabina ad aria compressa 10 m – 60 colpi (decimi)"],
    description: [
      "Carabine à air comprimé 10 m debout avec comptage au dixième, 6 séries de 10 coups (volume de compétition ISSF).",
      "Carabina ad aria compressa 10 m in piedi con conteggio ai decimi, 6 serie da 10 colpi (volume di gara ISSF).",
    ],
  },
  "Luftpistole 10 m – 60 Schuss": {
    name: ["Pistolet à air comprimé 10 m – 60 coups", "Pistola ad aria compressa 10 m – 60 colpi"],
    description: [
      "Pistolet à air comprimé 10 m, 6 séries de 10 coups (volume de compétition ISSF).",
      "Pistola ad aria compressa 10 m, 6 serie da 10 colpi (volume di gara ISSF).",
    ],
  },
  "Pistole 50 m – 60 Schuss": {
    name: ["Pistolet 50 m – 60 coups", "Pistola 50 m – 60 colpi"],
    description: [
      "Pistolet libre / précision 50 m, 6 séries de 10 coups à une main, debout.",
      "Pistola libera / precisione 50 m, 6 serie da 10 colpi con una mano, in piedi.",
    ],
  },
  "Kleinkaliber 50 m liegend – 60 Schuss (Zehntel)": {
    name: ["Petit calibre 50 m couché – 60 coups (dixièmes)", "Piccolo calibro 50 m a terra – 60 colpi (decimi)"],
    description: [
      "Carabine petit calibre 50 m couché avec comptage au dixième, 6 séries de 10 coups.",
      "Carabina piccolo calibro 50 m a terra con conteggio ai decimi, 6 serie da 10 colpi.",
    ],
  },
  "Präzision 5 × 5 frei": {
    name: ["Précision 5 × 5 libre", "Precisione 5 × 5 libera"],
    description: [
      "Modèle pour un entraînement de précision libre : 5 séries de 5 coups. Adapte la distance et la cible au démarrage.",
      "Modello per un allenamento di precisione libero: 5 serie da 5 colpi. Adatta distanza e bersaglio all’avvio.",
    ],
  },
  "Drill – Drei-Ziele-Drill": {
    name: ["Drill – Drill à trois cibles", "Drill – Drill a tre bersagli"],
    description: [
      "Drill pratique : trois cibles côte à côte, deux touchés par cible. Comptage touché/manqué avec limite de temps.",
      "Drill pratico: tre bersagli affiancati, due colpi a segno per bersaglio. Conteggio colpito/mancato con limite di tempo.",
    ],
  },
  "Drill – Distanzwechsel 3-7-10 m": {
    name: ["Drill – Changement de distance 3-7-10 m", "Drill – Cambio di distanza 3-7-10 m"],
    description: [
      "Une série chacune à 3, 7 et 10 m avec peu de temps. Entraîne l’adaptation du rythme et de la précision à la distance.",
      "Una serie ciascuna a 3, 7 e 10 m con poco tempo. Allena l’adattamento di ritmo e precisione alla distanza.",
    ],
  },
  "Drill – Schwache Hand / Starke Hand": {
    name: ["Drill – Main faible / main forte", "Drill – Mano debole / mano forte"],
    description: [
      "Tir à une main : d’abord avec la main forte, puis avec la main faible, pour finir à deux mains.",
      "Tiro con una mano: prima con la mano forte, poi con la mano debole, infine con due mani.",
    ],
  },
  "Drill – Nachladen unter Zeit": {
    name: ["Drill – Rechargement chronométré", "Drill – Ricarica a tempo"],
    description: [
      "Deux coups, changement de chargeur, deux coups. Entraîne un changement de chargeur calme et rapide.",
      "Due colpi, cambio di caricatore, due colpi. Allena un cambio di caricatore calmo e rapido.",
    ],
  },
  "Pistole 25 m Sport (30+30, nachempfunden)": {
    name: ["Pistolet 25 m sport (30+30, inspiré)", "Pistola 25 m sport (30+30, ispirato)"],
    description: [
      `Inspiré du programme pistolet sport : 30 coups de précision (6 séries de 5 coups, 5 minutes chacune) et 30 coups en duel (6 séries de 5 coups, 3 s visible / 7 s masquée). ${RULES_FR}`,
      `Ispirato al programma pistola sport: 30 colpi di precisione (6 serie da 5 colpi, 5 minuti ciascuna) e 30 colpi di duello (6 serie da 5 colpi, 3 s visibile / 7 s coperto). ${RULES_IT}`,
    ],
  },
  "Zentralfeuer 30+30 (nachempfunden)": {
    name: ["Percussion centrale 30+30 (inspiré)", "Fuoco centrale 30+30 (ispirato)"],
    description: [
      `Inspiré du programme percussion centrale : 30 coups de précision et 30 coups en duel à 25 m avec un pistolet à percussion centrale. ${RULES_FR}`,
      `Ispirato al programma fuoco centrale: 30 colpi di precisione e 30 colpi di duello a 25 m con una pistola a fuoco centrale. ${RULES_IT}`,
    ],
  },
  "Standardpistole 150/20/10 s (nachempfunden)": {
    name: ["Pistolet standard 150/20/10 s (inspiré)", "Pistola standard 150/20/10 s (ispirato)"],
    description: [
      `Inspiré du pistolet standard : 4 séries de 5 coups chacune en 150 s, 20 s et 10 s à 25 m. ${RULES_FR}`,
      `Ispirato alla pistola standard: 4 serie da 5 colpi ciascuna in 150 s, 20 s e 10 s a 25 m. ${RULES_IT}`,
    ],
  },
  "Schnellfeuerpistole 25 m 8/6/4 s (nachempfunden)": {
    name: ["Pistolet de vitesse 25 m 8/6/4 s (inspiré)", "Pistola a fuoco rapido 25 m 8/6/4 s (ispirato)"],
    description: [
      `Inspiré du pistolet de vitesse : 2 séries de 5 coups chacune sur cinq cibles en 8 s, 6 s et 4 s. ${RULES_FR}`,
      `Ispirato alla pistola a fuoco rapido: 2 serie da 5 colpi ciascuna su cinque bersagli in 8 s, 6 s e 4 s. ${RULES_IT}`,
    ],
  },
  "Gewehr 50 m Dreistellung (nachempfunden, Zehntel)": {
    name: ["Carabine 50 m trois positions (inspiré, dixièmes)", "Carabina 50 m tre posizioni (ispirato, decimi)"],
    description: [
      `Petit calibre 50 m en trois positions avec comptage au dixième : 2 séries de 10 coups chacune à genou, couché et debout. ${RULES_FR}`,
      `Piccolo calibro 50 m in tre posizioni con conteggio ai decimi: 2 serie da 10 colpi ciascuna in ginocchio, a terra e in piedi. ${RULES_IT}`,
    ],
  },
  "Gewehr 300 m liegend – 60 Schuss (nachempfunden)": {
    name: ["Fusil 300 m couché – 60 coups (inspiré)", "Fucile 300 m a terra – 60 colpi (ispirato)"],
    description: [
      `Fusil de sport 300 m couché, 6 séries de 10 coups sur la cible A10. ${RULES_FR}`,
      `Fucile sportivo 300 m a terra, 6 serie da 10 colpi sul bersaglio A10. ${RULES_IT}`,
    ],
  },
  "Geiselnahme – Präzision unter Zeit": {
    name: ["Prise d’otage – Précision chronométrée", "Presa d’ostaggi – Precisione a tempo"],
    description: [
      "Agresseur derrière un otage : seule la zone libre de la tête peut être touchée. La précision avant la vitesse – un otage touché coûte 20 points.",
      "Aggressore dietro un ostaggio: si può colpire solo la zona libera della testa. Precisione prima della velocità – un ostaggio colpito costa 20 punti.",
    ],
  },
  "Shoot/No-Shoot Entscheidung": {
    name: ["Décision shoot/no-shoot", "Decisione shoot/no-shoot"],
    description: [
      "Six cibles, menaces et personnes non impliquées mélangées. La direction de tir n’annonce les menaces qu’au signal de départ. Ne pas tirer sur une menace = faute de procédure.",
      "Sei bersagli, minacce e persone estranee mescolate. La direzione di tiro annuncia le minacce solo al segnale di partenza. Non sparare a una minaccia = errore di procedura.",
    ],
  },
  "Teildeckung links/rechts": {
    name: ["Couverture partielle gauche/droite", "Copertura parziale sinistra/destra"],
    description: [
      "Tir depuis une couverture : contourner la barricade à gauche et à droite en montrant le moins possible le corps. Comptage par zones A/C/D.",
      "Tiro da una copertura: aggirare la barricata a sinistra e a destra mostrando il meno possibile il corpo. Conteggio per zone A/C/D.",
    ],
  },
  "Distanzwechsel 3–7–15 m": {
    name: ["Changement de distance 3–7–15 m", "Cambio di distanza 3–7–15 m"],
    description: [
      "Trois distances en un enchaînement : rapide à 3 m, contrôlé à 7 m, précis à 15 m. Touché/manqué avec limite de temps.",
      "Tre distanze in un’unica sequenza: veloce a 3 m, controllato a 7 m, preciso a 15 m. Colpito/mancato con limite di tempo.",
    ],
  },
  "Mehrfachziele Reihenfolge": {
    name: ["Cibles multiples dans l’ordre", "Bersagli multipli in sequenza"],
    description: [
      "Engager trois cibles dans l’ordre annoncé. Mauvais ordre = faute de procédure (−5 par faute).",
      "Ingaggiare tre bersagli nell’ordine annunciato. Ordine sbagliato = errore di procedura (−5 per errore).",
    ],
  },
  "Nachladen und Störung beheben": {
    name: ["Recharger et résoudre un incident de tir", "Ricaricare e risolvere un inceppamento"],
    description: [
      "Enrayage et chargeur vide sous la pression du temps : reconnaître l’incident, le résoudre, continuer à tirer. Mélanger d’abord des cartouches d’exercice (dummies) dans les chargeurs.",
      "Inceppamento e caricatore vuoto a tempo: riconoscere l’inceppamento, risolverlo, continuare a sparare. Mescolare prima cartucce da esercizio (dummy) nei caricatori.",
    ],
  },
  "Schwache Hand": {
    name: ["Main faible", "Mano debole"],
    description: [
      "À une main avec la main faible, p. ex. en cas de main de tir blessée. Avec comptage par zones pour que la précision compte.",
      "Con una mano usando la mano debole, p. es. con la mano di tiro ferita. Con conteggio a zone affinché conti la precisione.",
    ],
  },
  "Bewegung seitlich": {
    name: ["Déplacement latéral", "Movimento laterale"],
    description: [
      "Tir en se déplaçant latéralement : choisir un rythme qui permet encore de toucher. Touché/manqué avec limite de temps.",
      "Tiro durante uno spostamento laterale: scegliere un ritmo che permetta ancora di colpire. Colpito/mancato con limite di tempo.",
    ],
  },
  "Kopfzone 5 m": {
    name: ["Zone de la tête 5 m", "Zona testa 5 m"],
    description: [
      "Courte distance, petite zone : coups isolés contrôlés sur la zone de la tête. Comptage tête/poitrine avec points de pénalité pour les personnes non impliquées.",
      "Distanza breve, zona piccola: colpi singoli controllati sulla zona della testa. Conteggio testa/petto con punti di penalità per le persone estranee.",
    ],
  },
  "Kontrolliertes Paar und Kopfschuss": {
    name: ["Paire contrôlée et tir à la tête", "Coppia controllata e colpo alla testa"],
    description: [
      "Deux coups à la poitrine, un coup à la tête. Entraîne le passage de la vitesse à la précision sur la même silhouette.",
      "Due colpi al petto, un colpo alla testa. Allena il passaggio dalla velocità alla precisione sulla stessa sagoma.",
    ],
  },
  "Low-Light Grundlagen": {
    name: ["Bases du tir en faible luminosité", "Basi del tiro in scarsa luminosità"],
    description: [
      "Tir avec peu de lumière et une lampe de poche. Assombrir la halle, lampe dans la main faible. Touché/manqué avec limite de temps.",
      "Tiro con poca luce e una torcia. Oscurare la sala, torcia nella mano debole. Colpito/mancato con limite di tempo.",
    ],
  },
  "Qualifikation Dienstpistole (nachempfunden)": {
    name: ["Qualification pistolet de service (inspiré)", "Qualifica pistola di servizio (ispirato)"],
    description: [
      "Inspiré des qualifications courantes pour pistolets de service : 30 coups de 3 à 15 m avec comptage par zones A/C/D. Pas un programme officiel – les prescriptions de ton propre corps font foi.",
      "Ispirato alle qualifiche comuni per pistole di servizio: 30 colpi da 3 a 15 m con conteggio a zone A/C/D. Non è un programma ufficiale – fanno stato le prescrizioni del proprio corpo.",
    ],
  },
  "Teamübung 2 Schützen": {
    name: ["Exercice d’équipe à 2 tireurs", "Esercizio di squadra con 2 tiratori"],
    description: [
      "Deux tireurs travaillent ensemble : communication, répartition du feu et rechargement en alternance. Saisir les deux tireurs comme participants.",
      "Due tiratori lavorano insieme: comunicazione, ripartizione del fuoco e ricarica alternata. Registra entrambi i tiratori come partecipanti.",
    ],
  },
  "Stress-Parcours Behörden": {
    name: ["Parcours de stress autorités", "Percorso sotto stress per autorità"],
    description: [
      "Court parcours avec déplacement, couverture et personnes non impliquées. À tirer seulement après les exercices de base.",
      "Breve percorso con movimento, copertura e persone estranee. Da sparare solo dopo gli esercizi di base.",
    ],
  },
  "Armbrust 10 m – 30 Schuss": {
    name: ["Arbalète 10 m – 30 coups", "Balestra 10 m – 30 colpi"],
    description: [
      `Arbalète 10 m : 3 séries de 10 coups, points 0–10. La position (à genou/debout) n’est pas saisie séparément. ${PROPOSAL_FR}`,
      `Balestra 10 m: 3 serie da 10 colpi, punti 0–10. La posizione (in ginocchio/in piedi) non viene registrata separatamente. ${PROPOSAL_IT}`,
    ],
  },
  "Armbrust 30 m – 30 Schuss": {
    name: ["Arbalète 30 m – 30 coups", "Balestra 30 m – 30 colpi"],
    description: [
      `Arbalète 30 m : 3 séries de 10 coups, points 0–10. La position (à genou/debout) n’est pas saisie séparément. ${PROPOSAL_FR}`,
      `Balestra 30 m: 3 serie da 10 colpi, punti 0–10. La posizione (in ginocchio/in piedi) non viene registrata separatamente. ${PROPOSAL_IT}`,
    ],
  },
  "Armbrust 10 m – Probe + 20": {
    name: ["Arbalète 10 m – essais + 20", "Balestra 10 m – prova + 20"],
    description: [
      `Programme général d’arbalète : coups d’essai au préalable (sans saisie), puis 2 séries de 10 coups. ${PROPOSAL_FR}`,
      `Programma generale di balestra: colpi di prova prima (senza registrazione), poi 2 serie da 10 colpi. ${PROPOSAL_IT}`,
    ],
  },
  "Freies Training – 10 Schuss": {
    name: ["Entraînement libre – 10 coups", "Allenamento libero – 10 colpi"],
    description: [
      "Série rapide sans consignes. Adapte la distance au démarrage.",
      "Serie rapida senza vincoli. Adatta la distanza all’avvio.",
    ],
  },
};

/** Feste Seriennamen der Vorlagen. Distanzangaben wie «7 m» bleiben unverändert. */
const STAGES: Record<string, Pair> = {
  Serie: ["Série", "Serie"],
  "Einzelschüsse": ["Coups isolés", "Colpi singoli"],
  Schnellfeuer: ["Feu rapide", "Fuoco rapido"],
  "Station 1 – Deckung links": ["Poste 1 – couverture à gauche", "Postazione 1 – copertura a sinistra"],
  "Station 2 – Kniend": ["Poste 2 – à genou", "Postazione 2 – in ginocchio"],
  "Station 3 – Bewegung": ["Poste 3 – en mouvement", "Postazione 3 – in movimento"],
  "Station 4 – Weit": ["Poste 4 – longue distance", "Postazione 4 – lunga distanza"],
  Einzelfeuer: ["Coup par coup", "Colpo singolo"],
  "Serie 60 s": ["Série 60 s", "Serie 60 s"],
  "Schnellfeuer 40 s": ["Feu rapide 40 s", "Fuoco rapido 40 s"],
  Einschiessen: ["Coups de réglage", "Colpi di aggiustamento"],
  "Starke Hand": ["Main forte", "Mano forte"],
  "Schwache Hand": ["Main faible", "Mano debole"],
  "Beidhändig": ["À deux mains", "Con due mani"],
  "Geisel links, 5 m": ["Otage à gauche, 5 m", "Ostaggio a sinistra, 5 m"],
  "Geisel rechts, 5 m": ["Otage à droite, 5 m", "Ostaggio a destra, 5 m"],
  "Geisel rechts, 7 m": ["Otage à droite, 7 m", "Ostaggio a destra, 7 m"],
  "Geisel links, 10 m kniend": ["Otage à gauche, 10 m à genou", "Ostaggio a sinistra, 10 m in ginocchio"],
  "Deckung links, stehend": ["Couverture à gauche, debout", "Copertura a sinistra, in piedi"],
  "Deckung rechts, stehend": ["Couverture à droite, debout", "Copertura a destra, in piedi"],
  "Deckung links, kniend": ["Couverture à gauche, à genou", "Copertura a sinistra, in ginocchio"],
  "Deckung rechts, kniend": ["Couverture à droite, à genou", "Copertura a destra, in ginocchio"],
  "3 m – aus der Hüfte": ["3 m – à la hanche", "3 m – dall’anca"],
  "Links – Mitte – Rechts": ["Gauche – centre – droite", "Sinistra – centro – destra"],
  "Rechts – Links – Mitte": ["Droite – gauche – centre", "Destra – sinistra – centro"],
  "Ansage durch Schiessleitung": ["Annonce par la direction de tir", "Annuncio della direzione di tiro"],
  "Störung Typ 1": ["Incident de tir type 1", "Inceppamento tipo 1"],
  "Leeres Magazin": ["Chargeur vide", "Caricatore vuoto"],
  "Taktisches Nachladen": ["Rechargement tactique", "Ricarica tattica"],
  "Schwache Hand, 5 m": ["Main faible, 5 m", "Mano debole, 5 m"],
  "Schwache Hand, 7 m": ["Main faible, 7 m", "Mano debole, 7 m"],
  "Handwechsel unter Zeit": ["Changement de main chronométré", "Cambio di mano a tempo"],
  "Nach links": ["Vers la gauche", "Verso sinistra"],
  "Nach rechts": ["Vers la droite", "Verso destra"],
  "Hin und zurück": ["Aller et retour", "Andata e ritorno"],
  "Je 3 s": ["3 s chacun", "3 s ciascuno"],
  "Neben Unbeteiligter": ["À côté d’une personne non impliquée", "Accanto a una persona estranea"],
  "Lampe an, 5 m": ["Lampe allumée, 5 m", "Torcia accesa, 5 m"],
  "Lampe kurz, 7 m": ["Lampe brièvement, 7 m", "Torcia breve, 7 m"],
  "Identifizieren, 7 m": ["Identifier, 7 m", "Identificare, 7 m"],
  "3 m, einhändig": ["3 m, à une main", "3 m, con una mano"],
  "7 m mit Nachladen": ["7 m avec rechargement", "7 m con ricarica"],
  "10 m kniend": ["10 m à genou", "10 m in ginocchio"],
  "15 m aus Deckung": ["15 m depuis une couverture", "15 m da copertura"],
  Feuerverteilung: ["Répartition du feu", "Ripartizione del fuoco"],
  "Nachladen im Wechsel": ["Rechargement en alternance", "Ricarica alternata"],
  "Shoot/No-Shoot zu zweit": ["Shoot/no-shoot à deux", "Shoot/no-shoot in due"],
  "Start nach Belastung": ["Départ après effort", "Partenza dopo sforzo"],
  "Vorrücken zur Deckung": ["Avancer vers la couverture", "Avanzare verso la copertura"],
  "Geisel aus der Deckung": ["Otage depuis la couverture", "Ostaggio dalla copertura"],
  Abschluss: ["Final", "Finale"],
};

/** Nummerierte Serien der Vorlagen, z.B. «Serie 3», «Präzision 2», «20 s – Serie 1». */
const STAGE_PREFIXES: Record<string, Pair> = {
  Serie: ["Série", "Serie"],
  "Präzision": ["Précision", "Precisione"],
  Duell: ["Duel", "Duello"],
  Durchgang: ["Passage", "Ripresa"],
  Kniend: ["À genou", "In ginocchio"],
  Liegend: ["Couché", "A terra"],
  Stehend: ["Debout", "In piedi"],
};

const HINT_EN = "Please check the values against the current requirements (DDPS/SSV/canton).";
const RULES_EN = "The regulations in force are authoritative.";
const PROPOSAL_EN = "Suggestion, please check the regulations.";

/** Englisch: Name der Vorlage (deutsch) → Name und Beschreibung. Gleiche Schlüssel wie PRESETS. */
const EN_PRESETS: Record<string, { name: string; description: string }> = {
  "Pistole 25 m – Präzision": { name: "Pistol 25 m – precision", description: "Classic precision programme at 25 m. 6 series of 5 shots, points 1–10." },
  "Pistole 25 m – Duell": { name: "Pistol 25 m – duel", description: "Duel: 6 series of 5 shots, target visible 3 s / hidden 7 s." },
  "Pistole 10 m – 40 Schuss": { name: "Pistol 10 m – 40 shots", description: "Air pistol 10 m, 4 series of 10 shots." },
  "Luftgewehr 10 m – 40 Schuss (Zehntel)": { name: "Air rifle 10 m – 40 shots (tenths)", description: "Air rifle 10 m with decimal scoring, 4 series of 10 shots." },
  "Gewehr 300 m – Obligatorisch": {
    name: "Rifle 300 m – obligatory programme",
    description: `Example for the federal 300 m programme (please adapt series and scoring to the current requirements). Please set the pass limit in the club according to the scoring. ${HINT_EN}`,
  },
  "Pistole 25 m – Obligatorisch": {
    name: "Pistol 25 m – obligatory programme",
    description: "Federal pistol programme 25 m: 5 single shots, 2 series of 5 shots, 1 series of 5 shots (rapid fire). Please set the pass limit in the club according to the current requirements.",
  },
  "Indoor – Distanzleiter 5 bis 20 m": { name: "Indoor – distance ladder 5 to 20 m", description: "For indoor ranges with variable distance: 5 shots each at 5, 10, 15 and 20 m." },
  "Indoor – Parcours mit Hindernissen": { name: "Indoor – course with obstacles", description: "Dynamic training: hit/miss scoring across several stations with cover and changes of position." },
  "Feldschiessen 300 m (nachempfunden)": { name: "Field shooting 300 m (modelled)", description: `Modelled on field shooting: 18 shots prone at 300 m in three parts (single shots, series, rapid fire). ${RULES_EN}` },
  "Feldschiessen Pistole 25 m (nachempfunden)": { name: "Field shooting pistol 25 m (modelled)", description: `Modelled on pistol field shooting: 18 shots at 25 m, single shots and two series with a time limit. ${RULES_EN}` },
  "Jungschützen-Kurs – Übung": {
    name: "Junior shooters course – exercise",
    description: "Simple exercise for junior shooters: sighting shots, single shots and a short series at 300 m prone. Ideal for learning breathing and trigger release.",
  },
  "Luftgewehr 10 m – 60 Schuss (Zehntel)": { name: "Air rifle 10 m – 60 shots (tenths)", description: "Air rifle 10 m standing with decimal scoring, 6 series of 10 shots (ISSF match volume)." },
  "Luftpistole 10 m – 60 Schuss": { name: "Air pistol 10 m – 60 shots", description: "Air pistol 10 m, 6 series of 10 shots (ISSF match volume)." },
  "Pistole 50 m – 60 Schuss": { name: "Pistol 50 m – 60 shots", description: "Free pistol / precision 50 m, 6 series of 10 shots one-handed, standing." },
  "Kleinkaliber 50 m liegend – 60 Schuss (Zehntel)": { name: "Small-bore 50 m prone – 60 shots (tenths)", description: "Small-bore rifle 50 m prone with decimal scoring, 6 series of 10 shots." },
  "Präzision 5 × 5 frei": { name: "Precision 5 × 5 free", description: "Template for free precision training: 5 series of 5 shots. Adjust distance and target when starting." },
  "Drill – Drei-Ziele-Drill": { name: "Drill – three-target drill", description: "Practical drill: three targets side by side, two hits per target. Hit/miss scoring with a time limit." },
  "Drill – Distanzwechsel 3-7-10 m": {
    name: "Drill – distance change 3-7-10 m",
    description: "One series each at 3, 7 and 10 m with little time. Trains adapting pace and precision to the distance.",
  },
  "Drill – Schwache Hand / Starke Hand": { name: "Drill – weak hand / strong hand", description: "One-handed shooting: first with the strong hand, then with the weak hand, finally with both hands." },
  "Drill – Nachladen unter Zeit": { name: "Drill – timed reload", description: "Two shots, magazine change, two shots. Trains a calm and quick magazine change." },
  "Pistole 25 m Sport (30+30, nachempfunden)": {
    name: "Sport pistol 25 m (30+30, modelled)",
    description: `Modelled on the sport pistol programme: 30 precision shots (6 series of 5 shots, 5 minutes each) and 30 duel shots (6 series of 5 shots, 3 s visible / 7 s hidden). ${RULES_EN}`,
  },
  "Zentralfeuer 30+30 (nachempfunden)": {
    name: "Centre-fire 30+30 (modelled)",
    description: `Modelled on the centre-fire programme: 30 precision shots and 30 duel shots at 25 m with a centre-fire pistol. ${RULES_EN}`,
  },
  "Standardpistole 150/20/10 s (nachempfunden)": {
    name: "Standard pistol 150/20/10 s (modelled)",
    description: `Modelled on standard pistol: 4 series of 5 shots each in 150 s, 20 s and 10 s at 25 m. ${RULES_EN}`,
  },
  "Schnellfeuerpistole 25 m 8/6/4 s (nachempfunden)": {
    name: "Rapid fire pistol 25 m 8/6/4 s (modelled)",
    description: `Modelled on rapid fire pistol: 2 series of 5 shots each on five targets in 8 s, 6 s and 4 s. ${RULES_EN}`,
  },
  "Gewehr 50 m Dreistellung (nachempfunden, Zehntel)": {
    name: "Rifle 50 m three positions (modelled, tenths)",
    description: `Small-bore 50 m in three positions with decimal scoring: 2 series of 10 shots each kneeling, prone and standing. ${RULES_EN}`,
  },
  "Gewehr 300 m liegend – 60 Schuss (nachempfunden)": {
    name: "Rifle 300 m prone – 60 shots (modelled)",
    description: `Sport rifle 300 m prone, 6 series of 10 shots on the A10 target. ${RULES_EN}`,
  },
  "Geiselnahme – Präzision unter Zeit": {
    name: "Hostage – timed precision",
    description: "Attacker behind a hostage: only the exposed head zone may be hit. Precision before speed – a hit hostage costs 20 points.",
  },
  "Shoot/No-Shoot Entscheidung": {
    name: "Shoot/no-shoot decision",
    description: "Six targets, threats and bystanders mixed. The range control announces the threats only at the start signal. Not engaging a threat = procedural error.",
  },
  "Teildeckung links/rechts": {
    name: "Partial cover left/right",
    description: "Shooting from cover: work around the barricade to the left and right while exposing as little of the body as possible. A/C/D zone scoring.",
  },
  "Distanzwechsel 3–7–15 m": {
    name: "Distance change 3–7–15 m",
    description: "Three distances in one sequence: fast at 3 m, controlled at 7 m, precise at 15 m. Hit/miss with a time limit.",
  },
  "Mehrfachziele Reihenfolge": {
    name: "Multiple targets in sequence",
    description: "Engage three targets in the announced order. Wrong order = procedural error (−5 per error).",
  },
  "Nachladen und Störung beheben": {
    name: "Reloading and clearing a stoppage",
    description: "Stoppage and empty magazine under time pressure: recognise the stoppage, clear it, keep shooting. Mix dummy rounds into the magazines beforehand.",
  },
  "Schwache Hand": {
    name: "Weak hand",
    description: "One-handed with the weak hand, e.g. with an injured shooting hand. With zone scoring so that precision counts.",
  },
  "Bewegung seitlich": {
    name: "Lateral movement",
    description: "Shooting while moving sideways: choose a pace that still allows hits. Hit/miss with a time limit.",
  },
  "Kopfzone 5 m": {
    name: "Head zone 5 m",
    description: "Short distance, small zone: controlled single shots at the head zone. Head/chest scoring with penalty points for bystanders.",
  },
  "Kontrolliertes Paar und Kopfschuss": {
    name: "Controlled pair and head shot",
    description: "Two shots to the chest, one shot to the head. Trains switching from speed to precision on the same silhouette.",
  },
  "Low-Light Grundlagen": {
    name: "Low-light basics",
    description: "Shooting in low light with a torch. Darken the hall, torch in the weak hand. Hit/miss with a time limit.",
  },
  "Qualifikation Dienstpistole (nachempfunden)": {
    name: "Service pistol qualification (modelled)",
    description: "Modelled on common service pistol qualifications: 30 shots from 3 to 15 m with A/C/D zone scoring. Not an official programme – the requirements of your own corps are authoritative.",
  },
  "Teamübung 2 Schützen": {
    name: "Team exercise for 2 shooters",
    description: "Two shooters work together: communication, fire distribution and alternating reloads. Record both shooters as participants.",
  },
  "Stress-Parcours Behörden": {
    name: "Stress course for authorities",
    description: "Short course with movement, cover and bystanders. Only shoot it after the basic exercises.",
  },
  "Armbrust 10 m – 30 Schuss": {
    name: "Crossbow 10 m – 30 shots",
    description: `Crossbow 10 m: 3 series of 10 shots, points 0–10. The position (kneeling/standing) is not recorded separately. ${PROPOSAL_EN}`,
  },
  "Armbrust 30 m – 30 Schuss": {
    name: "Crossbow 30 m – 30 shots",
    description: `Crossbow 30 m: 3 series of 10 shots, points 0–10. The position (kneeling/standing) is not recorded separately. ${PROPOSAL_EN}`,
  },
  "Armbrust 10 m – Probe + 20": {
    name: "Crossbow 10 m – sighters + 20",
    description: `General crossbow programme: sighting shots first (not recorded), then 2 series of 10 shots. ${PROPOSAL_EN}`,
  },
  "Freies Training – 10 Schuss": { name: "Free training – 10 shots", description: "Quick series without requirements. Adjust the distance when starting." },
};

/** Englisch: feste Seriennamen der Vorlagen (gleiche Schlüssel wie STAGES). */
const EN_STAGES: Record<string, string> = {
  Serie: "Series",
  "Einzelschüsse": "Single shots",
  Schnellfeuer: "Rapid fire",
  "Station 1 – Deckung links": "Station 1 – cover on the left",
  "Station 2 – Kniend": "Station 2 – kneeling",
  "Station 3 – Bewegung": "Station 3 – moving",
  "Station 4 – Weit": "Station 4 – long distance",
  Einzelfeuer: "Single shots",
  "Serie 60 s": "Series 60 s",
  "Schnellfeuer 40 s": "Rapid fire 40 s",
  Einschiessen: "Sighting shots",
  "Starke Hand": "Strong hand",
  "Schwache Hand": "Weak hand",
  "Beidhändig": "Both hands",
  "Geisel links, 5 m": "Hostage on the left, 5 m",
  "Geisel rechts, 5 m": "Hostage on the right, 5 m",
  "Geisel rechts, 7 m": "Hostage on the right, 7 m",
  "Geisel links, 10 m kniend": "Hostage on the left, 10 m kneeling",
  "Deckung links, stehend": "Cover on the left, standing",
  "Deckung rechts, stehend": "Cover on the right, standing",
  "Deckung links, kniend": "Cover on the left, kneeling",
  "Deckung rechts, kniend": "Cover on the right, kneeling",
  "3 m – aus der Hüfte": "3 m – from the hip",
  "Links – Mitte – Rechts": "Left – centre – right",
  "Rechts – Links – Mitte": "Right – left – centre",
  "Ansage durch Schiessleitung": "Called by range control",
  "Störung Typ 1": "Stoppage type 1",
  "Leeres Magazin": "Empty magazine",
  "Taktisches Nachladen": "Tactical reload",
  "Schwache Hand, 5 m": "Weak hand, 5 m",
  "Schwache Hand, 7 m": "Weak hand, 7 m",
  "Handwechsel unter Zeit": "Timed hand change",
  "Nach links": "To the left",
  "Nach rechts": "To the right",
  "Hin und zurück": "There and back",
  "Je 3 s": "3 s each",
  "Neben Unbeteiligter": "Next to a bystander",
  "Lampe an, 5 m": "Torch on, 5 m",
  "Lampe kurz, 7 m": "Torch briefly, 7 m",
  "Identifizieren, 7 m": "Identify, 7 m",
  "3 m, einhändig": "3 m, one-handed",
  "7 m mit Nachladen": "7 m with reload",
  "10 m kniend": "10 m kneeling",
  "15 m aus Deckung": "15 m from cover",
  Feuerverteilung: "Fire distribution",
  "Nachladen im Wechsel": "Alternating reload",
  "Shoot/No-Shoot zu zweit": "Shoot/no-shoot in pairs",
  "Start nach Belastung": "Start after exertion",
  "Vorrücken zur Deckung": "Advance to cover",
  "Geisel aus der Deckung": "Hostage from cover",
  Abschluss: "Final",
};

/** Englisch: nummerierte Serien der Vorlagen (gleiche Schlüssel wie STAGE_PREFIXES). */
const EN_STAGE_PREFIXES: Record<string, string> = {
  Serie: "Series",
  "Präzision": "Precision",
  Duell: "Duel",
  Durchgang: "Pass",
  Kniend: "Kneeling",
  Liegend: "Prone",
  Stehend: "Standing",
};

const idx = (lang: TableLang) => (lang === "fr" ? 0 : 1);

/** Französische Typografie wie im Wörterbuch: schmales geschütztes Leerzeichen vor ! ? ; : */
function frType(v: string) {
  return v.replace(/ ([!?;:])/g, " $1").replace(/« /g, "« ").replace(/ »/g, " »");
}

function pick(pair: Pair, lang: TableLang) {
  const v = pair[idx(lang)];
  return lang === "fr" ? frType(v) : v;
}

function langOf(locale: string | null | undefined): Lang | null {
  return locale === "fr" || locale === "it" || locale === "en" ? locale : null;
}

function presetText(key: string, field: "name" | "description", lang: Lang): string {
  return lang === "en" ? EN_PRESETS[key]![field] : pick(PRESETS[key]![field], lang);
}

function fixedStage(name: string, lang: Lang): string | undefined {
  if (lang === "en") return EN_STAGES[name];
  const pair = STAGES[name];
  return pair ? pick(pair, lang) : undefined;
}

function stagePrefix(word: string, lang: Lang): string | undefined {
  if (lang === "en") return EN_STAGE_PREFIXES[word];
  const pair = STAGE_PREFIXES[word];
  return pair ? pick(pair, lang) : undefined;
}

/** Deutscher Name (inkl. früherer Namen) → Eintrag in PRESETS und die deutsche Beschreibung der Vorlage. */
const BY_NAME: Map<string, { key: string; description: string | null }> = (() => {
  const m = new Map<string, { key: string; description: string | null }>();
  for (const p of PROGRAM_PRESETS) {
    if (!PRESETS[p.name]) continue;
    for (const n of presetNames(p)) m.set(n.trim(), { key: p.name, description: p.description?.trim() ?? null });
  }
  return m;
})();

/** Name eines Programms in der Sprache (nur eingebaute Vorlagen; sonst unverändert). */
export function localizedProgramName(name: string, locale: string | null | undefined): string {
  const lang = langOf(locale);
  if (!lang) return name;
  const hit = BY_NAME.get(name.trim());
  return hit ? presetText(hit.key, "name", lang) : name;
}

/** Beschreibung eines Programms in der Sprache, solange sie noch genau dem Text der Vorlage entspricht. */
export function localizedProgramDescription(name: string, description: string | null, locale: string | null | undefined): string | null {
  const lang = langOf(locale);
  if (!lang || !description) return description;
  const hit = BY_NAME.get(name.trim());
  if (!hit || hit.description !== description.trim()) return description;
  return presetText(hit.key, "description", lang);
}

/** Name einer Serie in der Sprache (feste und nummerierte Namen der Vorlagen; sonst unverändert). */
export function localizedStageName(name: string, locale: string | null | undefined): string {
  const lang = langOf(locale);
  if (!lang) return name;
  const fixed = fixedStage(name, lang);
  if (fixed) return fixed;
  const m = /^(?:(\d+ s) – )?(\S+) (\d+)$/.exec(name);
  if (m) {
    const word = stagePrefix(m[2]!, lang);
    if (word) {
      return m[1] ? `${m[1]} – ${word.toLocaleLowerCase(lang)} ${m[3]}` : `${word} ${m[3]}`;
    }
  }
  return name;
}

/**
 * Anzeige eines Programms in der Sprache: Name, Beschreibung und Seriennamen der eingebauten Vorlagen.
 * Nur für die Anzeige verwenden, nie für Formulare, die das Programm wieder speichern.
 */
export function localizeProgram<T extends { name: string; description?: string | null; stages?: Stage[] }>(p: T, locale: string | null | undefined): T {
  if (!langOf(locale) || !BY_NAME.has(p.name.trim())) return p;
  const out: T = { ...p, name: localizedProgramName(p.name, locale) };
  if (p.description !== undefined) out.description = localizedProgramDescription(p.name, p.description ?? null, locale);
  if (p.stages) out.stages = p.stages.map((s) => ({ ...s, name: localizedStageName(s.name, locale) }));
  return out;
}

/** Für Tests: alle Vorlagen mit Übersetzung. */
export const PRESET_TRANSLATION_KEYS = Object.keys(PRESETS);
