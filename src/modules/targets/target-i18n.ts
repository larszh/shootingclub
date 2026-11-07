import type { Locale } from "@/lib/i18n/core";
import { CROSSBOW_TARGET_PRESETS, TARGET_PRESETS } from "./presets";

/**
 * Anzeige-Übersetzungen der eingebauten Scheiben (wie scores/preset-i18n.ts für Programme).
 *
 * - Texte der Generatoren (Sujet-Beschreibungen, Formularfelder, Legenden, Beschriftungen und
 *   Hinweiszeilen im SVG) stehen im Code auf Deutsch; `translateTargetText` übersetzt sie für
 *   fr/it/en. Unbekannte Texte bleiben unverändert.
 * - Namen und Beschreibungen der globalen Vorlagen (presets.ts) übersetzt `localizeTarget`, aber nur
 *   für globale Scheiben und nur solange der Text noch genau dem der Vorlage entspricht. Vom
 *   Super-Admin geänderte Texte sowie eigene Scheiben der Vereine und Mitglieder bleiben, wie sie sind.
 *
 * Französisch mit «tu» und schmalen geschützten Leerzeichen vor : ; ! ? und in « » (frSpacing).
 * Rein und client-sicher (kein Wörterbuch-Import), damit Vorschau und Druck offline gleich rechnen.
 */
type Lang = "fr" | "it" | "en";
type Tr = readonly [fr: string, it: string, en: string];

const IDX: Record<Lang, 0 | 1 | 2> = { fr: 0, it: 1, en: 2 };

function frSpacing(s: string): string {
  return s
    .replace(/«[   ]?/g, "« ")
    .replace(/[   ]?»/g, " »")
    .replace(/ ([?!;:])(?=\s|$|\))/g, " $1");
}

function langOf(locale: Locale | string | null | undefined): Lang | null {
  return locale === "fr" || locale === "it" || locale === "en" ? locale : null;
}

function pick(tr: Tr, lang: Lang): string {
  const s = tr[IDX[lang]];
  return lang === "fr" ? frSpacing(s) : s;
}

// ---------------------------------------------------------------------------
// Feste Texte (ganze Texte, Sätze oder durch « · » getrennte Teile)
// ---------------------------------------------------------------------------

const TRAINING = "Für Ausbildung und Training, abstrakte Darstellung.";
const NOT_OFFICIAL = "Keine offizielle Scheibe.";
const CHECK_RULES = "bitte mit dem aktuellen Reglement prüfen.";

/** Deutsch → [fr, it, en]. */
export const TARGET_PHRASES: Record<string, Tr> = {
  // --- wiederkehrende Sätze ---------------------------------------------------
  [TRAINING]: ["Pour la formation et l’entraînement, représentation abstraite.", "Per formazione e allenamento, rappresentazione astratta.", "For instruction and training, abstract depiction."],
  [NOT_OFFICIAL]: ["Ce n’est pas une cible officielle.", "Non è un bersaglio ufficiale.", "Not an official target."],

  // --- Kategorien (Rückfall, falls «shooting.targets.cat.*» fehlt) ------------
  "Ringscheiben": ["Cibles à anneaux", "Bersagli ad anelli", "Ring targets"],
  "Präzision": ["Précision", "Precisione", "Precision"],
  "Training/Drills": ["Entraînement/exercices", "Allenamento/esercizi", "Training/drills"],
  "Spiele": ["Jeux", "Giochi", "Games"],
  "Silhouetten": ["Silhouettes", "Sagome", "Silhouettes"],
  "Einschiessen": ["Réglage", "Azzeramento", "Zeroing"],
  "Taktik & Polizei": ["Tactique et police", "Tattica e polizia", "Tactical & police"],
  "Eigene": ["Personnalisées", "Personalizzati", "Custom"],

  // --- Parameter (PARAM_INFO) -------------------------------------------------
  "Durchmesser (mm)": ["Diamètre (mm)", "Diametro (mm)", "Diameter (mm)"],
  "Leer = so gross wie möglich (bei Distanz-Umrechnung: 300 mm)": ["Vide = aussi grand que possible (avec conversion de distance : 300 mm)", "Vuoto = il più grande possibile (con conversione della distanza: 300 mm)", "Blank = as large as possible (with distance conversion: 300 mm)"],
  "Leer = so gross wie möglich (bei Distanz-Umrechnung: 150 mm)": ["Vide = aussi grand que possible (avec conversion de distance : 150 mm)", "Vuoto = il più grande possibile (con conversione della distanza: 150 mm)", "Blank = as large as possible (with distance conversion: 150 mm)"],
  "Spalten": ["Colonnes", "Colonne", "Columns"],
  "Reihen": ["Rangées", "Righe", "Rows"],
  "Rasterweite (mm)": ["Pas de la grille (mm)", "Passo della griglia (mm)", "Grid spacing (mm)"],
  "Ringzahlen anzeigen": ["Afficher les numéros des anneaux", "Mostra i numeri degli anelli", "Show ring numbers"],
  "Schwarzer Spiegel ab Ring": ["Visuel noir à partir de l’anneau", "Visuale nero dall’anello", "Black aiming area from ring"],
  "Variante": ["Variante", "Variante", "Variant"],
  "Originaldistanz (m)": ["Distance d’origine (m)", "Distanza originale (m)", "Original distance (m)"],
  "Für diese Distanz ist die Scheibe gebaut": ["La cible est conçue pour cette distance", "Il bersaglio è concepito per questa distanza", "The distance the target is designed for"],
  "Schussdistanz (m)": ["Distance de tir (m)", "Distanza di tiro (m)", "Shooting distance (m)"],
  "Auf diese Distanz schiesst du": ["Tu tires à cette distance", "Spari a questa distanza", "The distance you shoot at"],
  "Anzahl Ringe": ["Nombre d’anneaux", "Numero di anelli", "Number of rings"],
  "Anzahl Ziele": ["Nombre de cibles", "Numero di bersagli", "Number of targets"],
  "Anordnung Nr.": ["Disposition n°", "Disposizione n.", "Layout no."],
  "Andere Zahl = andere Reihenfolge": ["Autre nombre = autre ordre", "Altro numero = altro ordine", "Different number = different order"],
  "Probescheibe": ["Cible d’essai", "Bersaglio di prova", "Sighter target"],
  "Distanzschritt (m)": ["Pas de distance (m)", "Passo di distanza (m)", "Distance step (m)"],
  "Anzahl Bedrohungen": ["Nombre de menaces", "Numero di minacce", "Number of threats"],
  "Bedrohung bei Nr.": ["Menace au n°", "Minaccia al n.", "Threat at no."],
  "0 = gemäss Anordnung Nr.": ["0 = selon la disposition n°", "0 = secondo la disposizione n.", "0 = according to layout no."],
  "Deckung (%)": ["Couverture (%)", "Copertura (%)", "Cover (%)"],
  "Wie viel der Figur verdeckt ist": ["Part de la silhouette qui est cachée", "Quanta parte della sagoma è coperta", "How much of the figure is covered"],
  "Legende und Kurzanleitung anzeigen": ["Afficher la légende et les instructions", "Mostra legenda e istruzioni brevi", "Show legend and quick guide"],
  "Leer = keine Skalierung": ["Vide = pas de mise à l’échelle", "Vuoto = nessun ridimensionamento", "Blank = no scaling"],
  "z.B. 10 oder 25 m im Stand": ["p. ex. 10 ou 25 m au stand", "p. es. 10 o 25 m al poligono", "e.g. 10 or 25 m at the range"],

  // --- Sujet-Beschreibungen ---------------------------------------------------
  "Klassische Ringscheibe 1–10 mit Zehner-Mouche.": ["Cible à anneaux classique 1–10 avec mouche.", "Bersaglio ad anelli classico 1–10 con mosca.", "Classic ring target 1–10 with inner ten."],
  "Grobe Ringe 6–10, gut sichtbar auf Distanz.": ["Gros anneaux 6–10, bien visibles à distance.", "Anelli grandi 6–10, ben visibili a distanza.", "Large rings 6–10, easy to see at distance."],
  "Mehrere kleine Scheiben für Präzisionstraining.": ["Plusieurs petites cibles pour l’entraînement de précision.", "Diversi piccoli bersagli per l’allenamento di precisione.", "Several small targets for precision training."],
  "Zentimeter-Raster mit Fadenkreuz zum Einschiessen.": ["Grille centimétrique avec réticule pour le réglage.", "Griglia centimetrica con reticolo per l’azzeramento.", "Centimetre grid with crosshair for zeroing."],
  "Ovale Zone mit Trefferzonen A/C/D.": ["Zone ovale avec zones de touché A/C/D.", "Zona ovale con zone di impatto A/C/D.", "Oval area with scoring zones A/C/D."],
  "Rautenförmige Ziele, kontrastreich.": ["Cibles en losange, très contrastées.", "Bersagli a rombo, molto contrastati.", "Diamond-shaped targets, high contrast."],
  "Nachempfunden der Präzisionsscheibe 25 m/50 m: 10er 50 mm, Ringe je 25 mm breiter, 1er 500 mm, Spiegel ab 7 (200 mm). Keine offizielle Scheibe; wird bei Bedarf verkleinert.": [
    "Reproduction de la cible de précision 25 m/50 m : 10 de 50 mm, chaque anneau 25 mm plus large, 1 de 500 mm, visuel dès le 7 (200 mm). Ce n’est pas une cible officielle ; elle est réduite si nécessaire.",
    "Riproduzione del bersaglio di precisione 25 m/50 m: 10 da 50 mm, ogni anello 25 mm più largo, 1 da 500 mm, visuale dal 7 (200 mm). Non è un bersaglio ufficiale; se necessario viene ridotto.",
    "Replica of the 25 m/50 m precision target: 10 ring 50 mm, each ring 25 mm wider, 1 ring 500 mm, black from 7 (200 mm). Not an official target; reduced if needed.",
  ],
  "Nachempfunden der Luftpistolenscheibe: 10er 11.5 mm, Ringe je 16 mm grösser, aussen 155.5 mm, Spiegel 7–10 (59.5 mm), Innenzehner 5 mm. Keine offizielle Scheibe.": [
    "Reproduction de la cible pistolet à air comprimé : 10 de 11.5 mm, chaque anneau 16 mm plus grand, extérieur 155.5 mm, visuel 7–10 (59.5 mm), mouche 5 mm. Ce n’est pas une cible officielle.",
    "Riproduzione del bersaglio per pistola ad aria compressa: 10 da 11.5 mm, ogni anello 16 mm più grande, esterno 155.5 mm, visuale 7–10 (59.5 mm), mosca 5 mm. Non è un bersaglio ufficiale.",
    "Replica of the air pistol target: 10 ring 11.5 mm, each ring 16 mm larger, outer 155.5 mm, black 7–10 (59.5 mm), inner ten 5 mm. Not an official target.",
  ],
  "Nachempfunden der Luftgewehrscheibe: 10er-Punkt 0.5 mm, 9er 5.5 mm, je 5 mm grösser, aussen 45.5 mm, Spiegel 4–9 (30.5 mm). Keine offizielle Scheibe.": [
    "Reproduction de la cible carabine à air comprimé : point du 10 de 0.5 mm, 9 de 5.5 mm, chaque anneau 5 mm plus grand, extérieur 45.5 mm, visuel 4–9 (30.5 mm). Ce n’est pas une cible officielle.",
    "Riproduzione del bersaglio per carabina ad aria compressa: punto del 10 da 0.5 mm, 9 da 5.5 mm, ogni anello 5 mm più grande, esterno 45.5 mm, visuale 4–9 (30.5 mm). Non è un bersaglio ufficiale.",
    "Replica of the air rifle target: 10 dot 0.5 mm, 9 ring 5.5 mm, each ring 5 mm larger, outer 45.5 mm, black 4–9 (30.5 mm). Not an official target.",
  ],
  "Mehrere Luftgewehrscheiben (nachempfunden) pro Blatt in nummerierten Feldern, wahlweise mit Probescheibe.": ["Plusieurs cibles carabine à air comprimé (reproductions) par feuille dans des cases numérotées, au choix avec cible d’essai.", "Diversi bersagli per carabina ad aria compressa (riproduzioni) per foglio in caselle numerate, a scelta con bersaglio di prova.", "Several air rifle targets (replicas) per sheet in numbered boxes, optionally with a sighter."],
  "Fünf Haltepunkte nebeneinander für Schnellfeuer- und Duell-Drills. Ringmarken (nachempfunden, 10er 100 mm) oder Ovale.": ["Cinq points de visée côte à côte pour exercices de tir rapide et de duel. Marques à anneaux (reproduction, 10 de 100 mm) ou ovales.", "Cinque punti di mira affiancati per esercizi di tiro rapido e duello. Marcature ad anelli (riproduzione, 10 da 100 mm) o ovali.", "Five aiming marks side by side for rapid-fire and duel drills. Ring marks (replica, 10 ring 100 mm) or ovals."],
  "Nachempfunden der Schweizer A-Scheibe 300 m mit 10er- oder 5er-Wertung. Masse angenähert (aussen ca. 1 m, Spiegel ca. 60 cm), keine offizielle Scheibe; wird verkleinert gedruckt.": ["Reproduction de la cible A suisse 300 m avec comptage à 10 ou à 5 points. Dimensions approximatives (extérieur env. 1 m, visuel env. 60 cm), ce n’est pas une cible officielle ; elle est imprimée en format réduit.", "Riproduzione del bersaglio A svizzero 300 m con conteggio a 10 o a 5 punti. Misure approssimative (esterno ca. 1 m, visuale ca. 60 cm), non è un bersaglio ufficiale; viene stampato ridotto.", "Replica of the Swiss 300 m A target with 10-point or 5-point scoring. Approximate dimensions (outer approx. 1 m, black approx. 60 cm), not an official target; printed at reduced size."],
  "Nachempfunden der Schweizer Pistolenscheibe P10 (50 m). Masse angenähert: 10er 50 mm, Ringbreite 25 mm, Spiegel ab 7. Keine offizielle Scheibe.": ["Reproduction de la cible pistolet suisse P10 (50 m). Dimensions approximatives : 10 de 50 mm, largeur d’anneau 25 mm, visuel dès le 7. Ce n’est pas une cible officielle.", "Riproduzione del bersaglio per pistola svizzero P10 (50 m). Misure approssimative: 10 da 50 mm, larghezza anello 25 mm, visuale dal 7. Non è un bersaglio ufficiale.", "Replica of the Swiss P10 pistol target (50 m). Approximate dimensions: 10 ring 50 mm, ring width 25 mm, black from 7. Not an official target."],
  "Nur Wertungsringe ohne Spiegel – für eigene Distanzen und Markierungen.": ["Uniquement les anneaux de comptage, sans visuel – pour tes propres distances et marquages.", "Solo anelli di punteggio senza visuale – per distanze e marcature proprie.", "Scoring rings only, no black – for your own distances and markings."],
  "Zentimeter-Raster mit Rauten-Haltepunkten und Hilfetext zu Zoll, MOA und mrad.": ["Grille centimétrique avec points de visée en losange et aide sur les pouces, MOA et mrad.", "Griglia centimetrica con punti di mira a rombo e testo di aiuto su pollici, MOA e mrad.", "Centimetre grid with diamond aiming points and help text on inches, MOA and mrad."],
  "Zehn nummerierte Kreise und Quadrate mit Aufgabe pro Nummer.": ["Dix cercles et carrés numérotés avec un exercice par numéro.", "Dieci cerchi e quadrati numerati con un esercizio per numero.", "Ten numbered circles and squares with one task per number."],
  "Kreise, Quadrate und Dreiecke mit Zahlen 1–9 und Buchstaben A–C. Ein Partner sagt an, du schiesst.": ["Cercles, carrés et triangles avec chiffres 1–9 et lettres A–C. Un partenaire annonce, tu tires.", "Cerchi, quadrati e triangoli con numeri 1–9 e lettere A–C. Un partner chiama, tu spari.", "Circles, squares and triangles with numbers 1–9 and letters A–C. A partner calls, you shoot."],
  "Dieselbe Scheibe in abnehmender Grösse: simuliert grössere Distanzen, z.B. 10/15/20/25 m beim Schiessen auf 10 m.": ["La même cible en taille décroissante : simule de plus grandes distances, p. ex. 10/15/20/25 m en tirant à 10 m.", "Lo stesso bersaglio in dimensioni decrescenti: simula distanze maggiori, p. es. 10/15/20/25 m sparando a 10 m.", "The same target in decreasing sizes: simulates longer distances, e.g. 10/15/20/25 m when shooting at 10 m."],
  "Reihe von runden Plates oder Kegeln für Speed-Drills.": ["Rangée de plates rondes ou de quilles pour exercices de vitesse.", "Fila di piatti rotondi o birilli per esercizi di velocità.", "Row of round plates or pins for speed drills."],
  "3×3-Spielfeld mit Haltepunkten – zwei Schützen spielen gegeneinander.": ["Grille de jeu 3×3 avec points de visée – deux tireurs jouent l’un contre l’autre.", "Campo di gioco 3×3 con punti di mira – due tiratori giocano uno contro l’altro.", "3×3 board with aiming points – two shooters play against each other."],
  "5×5-Feld mit gemischten Zahlen oder Bingo-Karte (B-I-N-G-O). Zahl ansagen und treffen.": ["Grille 5×5 avec nombres mélangés ou carte de bingo (B-I-N-G-O). Annonce un nombre et touche-le.", "Griglia 5×5 con numeri mescolati o cartella della tombola (B-I-N-G-O). Chiama un numero e colpiscilo.", "5×5 grid with mixed numbers or a bingo card (B-I-N-G-O). Call a number and hit it."],
  "Zwölf Ziele wie ein Zifferblatt. Ansage «3 Uhr» – Ziel 3 treffen.": ["Douze cibles comme un cadran. Annonce «3 heures» – toucher la cible 3.", "Dodici bersagli come un quadrante. Chiamata «ore 3» – colpire il bersaglio 3.", "Twelve targets like a clock face. Call “3 o’clock” – hit target 3."],
  "Neutrale Umriss-Silhouette (ohne Gesicht) mit Trefferzonen. Varianten: Zonen A/C/D, Kopf/Brust oder mit «NS»-Zone (nicht beschiessen).": ["Silhouette neutre (sans visage) avec zones de touché. Variantes : zones A/C/D, tête/poitrine ou avec zone «NS» (ne pas tirer).", "Sagoma neutra (senza volto) con zone di impatto. Varianti: zone A/C/D, testa/petto o con zona «NS» (non sparare).", "Neutral outline silhouette (no face) with scoring zones. Variants: zones A/C/D, head/chest or with an “NS” zone (do not shoot)."],
  "Hochgeladene Datei (PNG, JPG, SVG, PDF).": ["Fichier téléversé (PNG, JPG, SVG, PDF).", "File caricato (PNG, JPG, SVG, PDF).", "Uploaded file (PNG, JPG, SVG, PDF)."],
  "Bedroher teilweise verdeckt durch eine Geisel (grau schraffiert, NS). Nur Kopfseite und Schulter sind frei.": ["Agresseur partiellement caché par un otage (hachuré en gris, NS). Seuls le côté de la tête et l’épaule sont libres.", "Aggressore parzialmente coperto da un ostaggio (tratteggiato in grigio, NS). Sono liberi solo il lato della testa e la spalla.", "Threat partly covered by a hostage (grey hatching, NS). Only the side of the head and the shoulder are exposed."],
  "Vom Bedroher ist nur ein Teil des Kopfes neben der Geisel sichtbar – sehr hohe Schwierigkeit.": ["Seule une partie de la tête de l’agresseur est visible à côté de l’otage – difficulté très élevée.", "Dell’aggressore è visibile solo una parte della testa accanto all’ostaggio – difficoltà molto elevata.", "Only part of the threat’s head is visible next to the hostage – very high difficulty."],
  "Bedroher steht zwischen zwei Geiseln, frei ist nur der Kopf und ein schmaler Streifen.": ["L’agresseur se tient entre deux otages, seules la tête et une bande étroite sont libres.", "L’aggressore sta tra due ostaggi, sono liberi solo la testa e una striscia stretta.", "The threat stands between two hostages; only the head and a narrow strip are exposed."],
  "Geisel kniet vor dem Bedroher und verdeckt den unteren Teil. Kopf und obere Brust sind frei.": ["L’otage est à genoux devant l’agresseur et cache la partie inférieure. La tête et le haut de la poitrine sont libres.", "L’ostaggio è in ginocchio davanti all’aggressore e copre la parte inferiore. Testa e parte superiore del petto sono libere.", "The hostage kneels in front of the threat and covers the lower part. Head and upper chest are exposed."],
  "4–6 Figuren mit Symbolen in der Hand: Pistole = Bedrohung, Telefon, Portemonnaie, offene Hand oder Ausweis = keine Bedrohung. Anordnung Nr. ergibt reproduzierbare Varianten.": ["4–6 silhouettes avec des symboles dans la main : pistolet = menace, téléphone, porte-monnaie, main ouverte ou pièce d’identité = pas de menace. Le numéro de disposition donne des variantes reproductibles.", "4–6 sagome con simboli in mano: pistola = minaccia, telefono, portamonete, mano aperta o documento d’identità = nessuna minaccia. Il numero di disposizione dà varianti riproducibili.", "4–6 figures with symbols in hand: pistol = threat; phone, wallet, open hand or ID card = no threat. The layout number gives reproducible variants."],
  "5–7 Figuren in zwei oder drei gestaffelten Reihen, eine davon ist die Bedrohung (Pistolen-Symbol), alle anderen sind NS.": ["5–7 silhouettes sur deux ou trois rangées échelonnées, l’une d’elles est la menace (symbole pistolet), toutes les autres sont NS.", "5–7 sagome in due o tre file sfalsate, una di esse è la minaccia (simbolo della pistola), tutte le altre sono NS.", "5–7 figures in two or three staggered rows; one is the threat (pistol symbol), all others are NS."],
  "Figur hinter einer Mauer oder Kisten, nur der Oberkörper ist frei. Deckungshöhe einstellbar.": ["Silhouette derrière un mur ou des caisses, seul le haut du corps est libre. Hauteur de couverture réglable.", "Sagoma dietro un muro o delle casse, è libero solo il busto. Altezza della copertura regolabile.", "Figure behind a wall or crates, only the upper body is exposed. Adjustable cover height."],
  "Figur hinter einer seitlichen Deckung oder in einem Türrahmen, nur Schulter und Kopfseite sind frei.": ["Silhouette derrière une couverture latérale ou dans un encadrement de porte, seuls l’épaule et le côté de la tête sont libres.", "Sagoma dietro una copertura laterale o in un telaio della porta, sono liberi solo la spalla e il lato della testa.", "Figure behind side cover or in a door frame; only the shoulder and side of the head are exposed."],
  "Bei «rechts»/«links» bleiben Kopfseite und eine Schulter immer frei": ["Avec «droite»/«gauche», le côté de la tête et une épaule restent toujours libres", "Con «destra»/«sinistra» il lato della testa e una spalla restano sempre liberi", "With “right”/“left”, the side of the head and one shoulder always stay exposed"],
  "Figur hinter einer Wand, sichtbar nur durch eine Fensteröffnung – mittig, versetzt oder mit Fensterkreuz.": ["Silhouette derrière un mur, visible uniquement par une ouverture de fenêtre – centrée, décalée ou avec croisillon.", "Sagoma dietro un muro, visibile solo attraverso un’apertura della finestra – centrata, sfalsata o con crociera.", "Figure behind a wall, visible only through a window opening – centred, offset or with a window cross."],
  "Figur hinter einem abstrakten Fahrzeug-Umriss: hinter dem Dach oder hinter der Motorhaube.": ["Silhouette derrière un contour abstrait de véhicule : derrière le toit ou derrière le capot.", "Sagoma dietro il contorno astratto di un veicolo: dietro il tetto o dietro il cofano.", "Figure behind an abstract vehicle outline: behind the roof or behind the bonnet."],
  "Kleine Kopfzonen als Boxen oder Dreiecke, nummeriert. Grösse frei oder per Distanz-Umrechnung (Kopfbreite 1:1 = 150 mm).": ["Petites zones de tête en carrés ou triangles, numérotées. Taille libre ou par conversion de distance (largeur de tête 1:1 = 150 mm).", "Piccole zone della testa a riquadri o triangoli, numerate. Dimensione libera o tramite conversione della distanza (larghezza testa 1:1 = 150 mm).", "Small head zones as boxes or triangles, numbered. Free size or via distance conversion (head width 1:1 = 150 mm)."],
  "Nummerierte Figuren mit Muster-Code (Voll, Streifen, Punkte, Gitter, Leer) und Buchstaben für Reihenfolge-Drills ohne Farbe.": ["Silhouettes numérotées avec code de motif (plein, rayures, points, grille, vide) et lettres pour exercices d’ordre sans couleur.", "Sagome numerate con codice a motivo (pieno, strisce, punti, griglia, vuoto) e lettere per esercizi di sequenza senza colori.", "Numbered figures with pattern code (solid, stripes, dots, grid, blank) and letters for sequence drills without colour."],
  "Kreise, Quadrate, Dreiecke, Rauten und Sechsecke mit Muster, Buchstabe und Nummer – Ansage nach Form, Muster, Buchstabe oder Zahl.": ["Cercles, carrés, triangles, losanges et hexagones avec motif, lettre et numéro – annonce par forme, motif, lettre ou nombre.", "Cerchi, quadrati, triangoli, rombi ed esagoni con motivo, lettera e numero – chiamata per forma, motivo, lettera o numero.", "Circles, squares, triangles, diamonds and hexagons with pattern, letter and number – call by shape, pattern, letter or number."],
  "Dieselbe Figur in versetzten Positionen: Ist-Position plus Vorhalte-Positionen +1, +2 … für das Vorhalten auf bewegte Ziele.": ["La même silhouette en positions décalées : position actuelle plus positions d’anticipation +1, +2 … pour l’anticipation sur cibles mobiles.", "La stessa sagoma in posizioni sfalsate: posizione attuale più posizioni di anticipo +1, +2 … per l’anticipo su bersagli in movimento.", "The same figure in offset positions: current position plus lead positions +1, +2 … for leading moving targets."],
  "Figur seitlich (Profil) oder halb gedreht mit schmaler Trefferzone.": ["Silhouette de côté (profil) ou à moitié tournée avec zone de touché étroite.", "Sagoma di lato (profilo) o ruotata a metà con zona di impatto stretta.", "Figure side-on (profile) or half turned with a narrow scoring zone."],
  "Dunkel: fast schwarzes Blatt mit dünnen weissen Umrissen (braucht viel Toner!).": ["Sombre : feuille presque noire avec de fins contours blancs (consomme beaucoup de toner !).", "Scuro: foglio quasi nero con sottili contorni bianchi (consuma molto toner!).", "Dark: almost black sheet with thin white outlines (uses a lot of toner!)."],
  "Minimal: nur feine graue Linien, kaum Tinte.": ["Minimal : seulement de fines lignes grises, presque pas d’encre.", "Minimo: solo sottili linee grigie, quasi niente inchiostro.", "Minimal: fine grey lines only, hardly any ink."],

  // --- Feldbezeichnungen und Optionen der Sujets -------------------------------
  "Grösse je Ziel (mm)": ["Taille par cible (mm)", "Dimensione per bersaglio (mm)", "Size per target (mm)"],
  "Ringmarken": ["Marques à anneaux", "Marcature ad anelli", "Ring marks"],
  "Ovale": ["Ovales", "Ovali", "Ovals"],
  "Ziele pro Reihe": ["Cibles par rangée", "Bersagli per fila", "Targets per row"],
  "Serien (Reihen)": ["Séries (rangées)", "Serie (righe)", "Series (rows)"],
  "Nummern anzeigen": ["Afficher les numéros", "Mostra i numeri", "Show numbers"],
  "Wertung": ["Comptage", "Conteggio", "Scoring"],
  "10er-Wertung": ["Comptage à 10 points", "Conteggio a 10 punti", "10-point scoring"],
  "5er-Wertung": ["Comptage à 5 points", "Conteggio a 5 punti", "5-point scoring"],
  "Für die MOA/mrad-Umrechnung": ["Pour la conversion MOA/mrad", "Per la conversione MOA/mrad", "For the MOA/mrad conversion"],
  "Aufgaben anzeigen": ["Afficher les exercices", "Mostra gli esercizi", "Show tasks"],
  "Anzahl Stufen": ["Nombre de paliers", "Numero di livelli", "Number of steps"],
  "Grösse der ersten Stufe (mm)": ["Taille du premier palier (mm)", "Dimensione del primo livello (mm)", "Size of the first step (mm)"],
  "Plates (Kreise)": ["Plates (cercles)", "Piatti (cerchi)", "Plates (circles)"],
  "Kegel": ["Quilles", "Birilli", "Pins"],
  "Spielfelder": ["Grilles de jeu", "Campi di gioco", "Boards"],
  "Zahlen 1–25": ["Nombres 1–25", "Numeri 1–25", "Numbers 1–25"],
  "Bingo 1–75": ["Bingo 1–75", "Tombola 1–75", "Bingo 1–75"],
  "Zahlen anzeigen": ["Afficher les nombres", "Mostra i numeri", "Show numbers"],
  "Zonen A/C/D": ["Zones A/C/D", "Zone A/C/D", "Zones A/C/D"],
  "Kopf/Brust": ["Tête/poitrine", "Testa/petto", "Head/chest"],
  "Mit NS-Zone": ["Avec zone NS", "Con zona NS", "With NS zone"],
  "Geisel": ["Otage", "Ostaggio", "Hostage"],
  "Geisel rechts": ["Otage à droite", "Ostaggio a destra", "Hostage right"],
  "Geisel links": ["Otage à gauche", "Ostaggio a sinistra", "Hostage left"],
  "Szenen pro Blatt": ["Scènes par feuille", "Scene per foglio", "Scenes per sheet"],
  "Szenen nummerieren": ["Numéroter les scènes", "Numera le scene", "Number the scenes"],
  "leicht rechts": ["légèrement à droite", "leggermente a destra", "slightly right"],
  "leicht links": ["légèrement à gauche", "leggermente a sinistra", "slightly left"],
  "Anzahl Figuren": ["Nombre de silhouettes", "Numero di sagome", "Number of figures"],
  "Darstellung": ["Représentation", "Rappresentazione", "Display"],
  "Entscheidung (alle gleich)": ["Décision (toutes identiques)", "Decisione (tutte uguali)", "Decision (all alike)"],
  "Lernversion (NS markiert)": ["Version d’apprentissage (NS marquées)", "Versione didattica (NS contrassegnate)", "Learning version (NS marked)"],
  "Figuren nummerieren": ["Numéroter les silhouettes", "Numera le sagome", "Number the figures"],
  "Deckung": ["Couverture", "Copertura", "Cover"],
  "Mauer": ["Mur", "Muro", "Wall"],
  "Kisten": ["Caisses", "Casse", "Crates"],
  "rechts": ["droite", "destra", "right"],
  "links": ["gauche", "sinistra", "left"],
  "Türrahmen": ["Encadrement de porte", "Telaio della porta", "Door frame"],
  "Fenster": ["Fenêtre", "Finestra", "Window"],
  "mittig": ["centrée", "centrata", "centred"],
  "versetzt": ["décalée", "sfalsata", "offset"],
  "mit Fensterkreuz": ["avec croisillon", "con crociera", "with window cross"],
  "Wandanteil (%)": ["Part du mur (%)", "Quota del muro (%)", "Wall share (%)"],
  "Mehr = kleineres Fenster": ["Plus = fenêtre plus petite", "Di più = finestra più piccola", "More = smaller window"],
  "Position": ["Position", "Posizione", "Position"],
  "hinter dem Dach": ["derrière le toit", "dietro il tetto", "behind the roof"],
  "hinter der Motorhaube": ["derrière le capot", "dietro il cofano", "behind the bonnet"],
  "Form": ["Forme", "Forma", "Shape"],
  "Boxen": ["Carrés", "Riquadri", "Boxes"],
  "Dreiecke": ["Triangles", "Triangoli", "Triangles"],
  "gemischt": ["mixte", "misto", "mixed"],
  "Breite je Ziel (mm)": ["Largeur par cible (mm)", "Larghezza per bersaglio (mm)", "Width per target (mm)"],
  "Ziele nummerieren": ["Numéroter les cibles", "Numera i bersagli", "Number the targets"],
  "Reihenfolge-Nummern anzeigen": ["Afficher les numéros d’ordre", "Mostra i numeri di sequenza", "Show sequence numbers"],
  "Richtung": ["Direction", "Direzione", "Direction"],
  "nach rechts": ["vers la droite", "verso destra", "to the right"],
  "nach links": ["vers la gauche", "verso sinistra", "to the left"],
  "Positionen pro Bahn": ["Positions par ligne", "Posizioni per linea", "Positions per lane"],
  "Bahnen": ["Lignes", "Linee", "Lanes"],
  "Drehung": ["Rotation", "Rotazione", "Rotation"],
  "Profil (90°)": ["Profil (90°)", "Profilo (90°)", "Profile (90°)"],
  "halb (45°)": ["à moitié (45°)", "a metà (45°)", "half (45°)"],
  "Figuren pro Blatt": ["Silhouettes par feuille", "Sagome per foglio", "Figures per sheet"],
  "dunkel (viel Toner)": ["sombre (beaucoup de toner)", "scuro (molto toner)", "dark (lots of toner)"],
  "minimal (wenig Tinte)": ["minimal (peu d’encre)", "minimo (poco inchiostro)", "minimal (little ink)"],

  // --- Hinweiszeilen im SVG (Teile zwischen « · ») -----------------------------
  "Präzisionspistole 25/50 m": ["Pistolet précision 25/50 m", "Pistola precisione 25/50 m", "Precision pistol 25/50 m"],
  "nachempfunden": ["reproduction", "riproduzione", "replica"],
  "nachempfunden, Masse angenähert": ["reproduction, dimensions approximatives", "riproduzione, misure approssimative", "replica, approximate dimensions"],
  "Luftpistole 10 m": ["Pistolet à air comprimé 10 m", "Pistola ad aria compressa 10 m", "Air pistol 10 m"],
  "Luftgewehr 10 m": ["Carabine à air comprimé 10 m", "Carabina ad aria compressa 10 m", "Air rifle 10 m"],
  "A-Scheibe 5er (CH-Stil)": ["Cible A à 5 points (style CH)", "Bersaglio A a 5 punti (stile CH)", "A target, 5-point (Swiss style)"],
  "A-Scheibe 10er (CH-Stil)": ["Cible A à 10 points (style CH)", "Bersaglio A a 10 punti (stile CH)", "A target, 10-point (Swiss style)"],
  "P10 (CH-Stil)": ["P10 (style CH)", "P10 (stile CH)", "P10 (Swiss style)"],
  "Schnellfeuer-Marken": ["Marques de tir rapide", "Marcature per tiro rapido", "Rapid-fire marks"],
  "Duell-Ovale": ["Ovales de duel", "Ovali da duello", "Duel ovals"],
  "je Serie von links nach rechts": ["chaque série de gauche à droite", "ogni serie da sinistra a destra", "each series left to right"],
  "Punkte-Drill 1–10": ["Exercice de points 1–10", "Esercizio a punti 1–10", "Dot drill 1–10"],
  "Aufgabe pro Nummer": ["un exercice par numéro", "un esercizio per numero", "one task per number"],
  "Ansage-Training": ["Entraînement à l’annonce", "Allenamento su chiamata", "Call-out training"],
  "z.B. «Dreieck 4» oder «Kreis B»": ["p. ex. «triangle 4» ou «cercle B»", "p. es. «triangolo 4» o «cerchio B»", "e.g. “triangle 4” or “circle B”"],
  "Plates-Rack": ["Plates-Rack", "Plates-Rack", "Plate rack"],
  "Speed-Drill von links nach rechts": ["exercice de vitesse de gauche à droite", "esercizio di velocità da sinistra a destra", "speed drill left to right"],
  "Tic-Tac-Toe": ["Morpion", "Tris", "Noughts and crosses"],
  "abwechselnd je 1 Schuss – drei in einer Reihe gewinnt": ["1 coup chacun à tour de rôle – trois alignés gagnent", "1 colpo a testa a turno – tre in fila vince", "1 shot each in turn – three in a row wins"],
  "Bingo": ["Bingo", "Tombola", "Bingo"],
  "Zahl ansagen und treffen": ["annoncer un nombre et le toucher", "chiamare un numero e colpirlo", "call a number and hit it"],
  "Zahlenfeld 1–25": ["Grille de nombres 1–25", "Griglia di numeri 1–25", "Number grid 1–25"],
  "Uhr": ["Horloge", "Orologio", "Clock"],
  "Ansage «3 Uhr» – Ziel 3 treffen": ["annonce «3 heures» – toucher la cible 3", "chiamata «ore 3» – colpire il bersaglio 3", "call “3 o’clock” – hit target 3"],
  "Mitte = Startpunkt": ["centre = point de départ", "centro = punto di partenza", "centre = starting point"],
  "Silhouette": ["Silhouette", "Sagoma", "Silhouette"],
  "NS = nicht beschiessen": ["NS = ne pas tirer", "NS = non sparare", "NS = do not shoot"],
  "Geiselnahme": ["Prise d’otage", "Presa d’ostaggi", "Hostage"],
  "Bedroher teilweise verdeckt": ["agresseur partiellement caché", "aggressore parzialmente coperto", "threat partly covered"],
  "nur Kopf frei": ["seule la tête est libre", "solo la testa libera", "head only exposed"],
  "zwei Geiseln": ["deux otages", "due ostaggi", "two hostages"],
  "Geisel kniend": ["otage à genoux", "ostaggio in ginocchio", "kneeling hostage"],
  "Teildeckung tief": ["Couverture partielle basse", "Copertura parziale bassa", "Low partial cover"],
  "Barrikade / Türrahmen": ["Barricade / encadrement de porte", "Barricata / telaio della porta", "Barricade / door frame"],
  "Fenster-Öffnung": ["Ouverture de fenêtre", "Apertura della finestra", "Window opening"],
  "Fahrzeug-Deckung": ["Couverture véhicule", "Copertura veicolo", "Vehicle cover"],
  "Shoot/No-Shoot": ["Shoot/No-Shoot", "Shoot/No-Shoot", "Shoot/no-shoot"],
  "Gruppe mit Unbeteiligten": ["Groupe avec personnes non impliquées", "Gruppo con persone estranee", "Group with bystanders"],
  "Kopfzonen": ["Zones de tête", "Zone della testa", "Head zones"],
  "Reihenfolge": ["Ordre", "Sequenza", "Sequence"],
  "Formen mit Muster-Code": ["Formes avec code de motif", "Forme con codice a motivo", "Shapes with pattern code"],
  "Bewegung simuliert": ["Mouvement simulé", "Movimento simulato", "Simulated movement"],
  "Verdrehte Figur": ["Silhouette tournée", "Sagoma ruotata", "Turned figure"],
  "Profil 90°": ["profil 90°", "profilo 90°", "profile 90°"],
  "halb gedreht 45°": ["à moitié tournée 45°", "ruotata a metà 45°", "half turned 45°"],
  "Profil und halb gedreht": ["profil et à moitié tournée", "profilo e ruotata a metà", "profile and half turned"],
  "Low-Light": ["Faible luminosité", "Luce scarsa", "Low light"],
  "viel Toner – sparsam drucken": ["beaucoup de toner – imprimer avec parcimonie", "molto toner – stampa con parsimonia", "lots of toner – print sparingly"],
  "Kontrast minimal": ["Contraste minimal", "Contrasto minimo", "Minimal contrast"],
  "wenig Tinte": ["peu d’encre", "poco inchiostro", "little ink"],
  "1 Zoll = 25.4 mm": ["1 pouce = 25.4 mm", "1 pollice = 25.4 mm", "1 inch = 25.4 mm"],
  "Treffpunktlage messen, Visier korrigieren": ["mesurer la position des impacts, corriger la visée", "misura la posizione dei colpi, correggi la mira", "measure the point of impact, adjust the sights"],

  // --- Legenden (taktische Sujets) -------------------------------------------
  "Zonen: A = Zentrum (höchste Wertung)": ["Zones : A = centre (valeur la plus haute)", "Zone: A = centro (punteggio più alto)", "Zones: A = centre (highest score)"],
  "NS = No-Shoot (Treffer = Abzug)": ["NS = No-Shoot (touché = déduction)", "NS = No-Shoot (colpo = penalità)", "NS = no-shoot (hit = penalty)"],
  "C = Rest der Kopfzone": ["C = reste de la zone de tête", "C = resto della zona della testa", "C = rest of the head zone"],
  "ausserhalb = Fehler": ["à l’extérieur = manqué", "all’esterno = errore", "outside = miss"],
  "Geisel (grau schraffiert) = NS. Nur freie Flächen des Bedrohers werten.": ["Otage (hachuré en gris) = NS. Seules les surfaces libres de l’agresseur comptent.", "Ostaggio (tratteggiato in grigio) = NS. Contano solo le superfici libere dell’aggressore.", "Hostage (grey hatching) = NS. Only score the exposed areas of the threat."],
  "Geisel = NS. Nur der sichtbare Kopfteil des Bedrohers ist gültig – höchste Präzision.": ["Otage = NS. Seule la partie visible de la tête de l’agresseur est valable – précision maximale.", "Ostaggio = NS. Vale solo la parte visibile della testa dell’aggressore – massima precisione.", "Hostage = NS. Only the visible part of the threat’s head counts – highest precision."],
  "Beide Geiseln = NS. Nur Kopf und freier Streifen des Bedrohers werten.": ["Les deux otages = NS. Seules la tête et la bande libre de l’agresseur comptent.", "Entrambi gli ostaggi = NS. Contano solo la testa e la striscia libera dell’aggressore.", "Both hostages = NS. Only score the threat’s head and exposed strip."],
  "Kniende Geisel = NS. Kopf und obere Brust des Bedrohers sind frei.": ["Otage à genoux = NS. La tête et le haut de la poitrine de l’agresseur sont libres.", "Ostaggio in ginocchio = NS. Testa e parte superiore del petto dell’aggressore sono libere.", "Kneeling hostage = NS. The threat’s head and upper chest are exposed."],
  "Treffer in der Deckung zählen nicht.": ["Les touchés dans la couverture ne comptent pas.", "I colpi nella copertura non contano.", "Hits on the cover do not count."],
  "Nur freie Flächen werten.": ["Seules les surfaces libres comptent.", "Contano solo le superfici libere.", "Only score exposed areas."],
  "Nur Schulter und Kopfseite sind frei.": ["Seuls l’épaule et le côté de la tête sont libres.", "Sono liberi solo la spalla e il lato della testa.", "Only the shoulder and side of the head are exposed."],
  "Nur durch das Fenster schiessen.": ["Tire uniquement à travers la fenêtre.", "Spara solo attraverso la finestra.", "Shoot through the window only."],
  "Fahrzeug und Scheiben = Deckung.": ["Véhicule et vitres = couverture.", "Veicolo e vetri = copertura.", "Vehicle and windows = cover."],
  "Lernversion: Figuren ohne Waffe sind als NS markiert.": ["Version d’apprentissage : les silhouettes sans arme sont marquées NS.", "Versione didattica: le sagome senza arma sono contrassegnate come NS.", "Learning version: figures without a weapon are marked NS."],
  "Nur Figuren mit Pistolen-Symbol beschiessen.": ["Tire uniquement sur les silhouettes avec le symbole pistolet.", "Spara solo alle sagome con il simbolo della pistola.", "Only engage figures with the pistol symbol."],
  "Telefon, Portemonnaie, offene Hand, Ausweis = NS.": ["Téléphone, porte-monnaie, main ouverte, pièce d’identité = NS.", "Telefono, portamonete, mano aperta, documento d’identità = NS.", "Phone, wallet, open hand, ID card = NS."],
  "Nur die Figur mit Pistolen-Symbol ist die Bedrohung, alle anderen sind NS (grau schraffiert).": ["Seule la silhouette avec le symbole pistolet est la menace, toutes les autres sont NS (hachurées en gris).", "Solo la sagoma con il simbolo della pistola è la minaccia, tutte le altre sono NS (tratteggiate in grigio).", "Only the figure with the pistol symbol is the threat; all others are NS (grey hatching)."],
  "Nummer ansagen, dann ein präziser Schuss.": ["Annonce un numéro, puis un tir précis.", "Chiama un numero, poi un colpo preciso.", "Call a number, then one precise shot."],
  "Für kurze Distanzen und hohe Schwierigkeit.": ["Pour courtes distances et difficulté élevée.", "Per brevi distanze e difficoltà elevata.", "For short distances and high difficulty."],
  "Reihenfolge nach Nummer, Buchstabe oder Muster ansagen (Voll, Streifen, Punkte, Gitter, Leer).": ["Annonce l’ordre par numéro, lettre ou motif (plein, rayures, points, grille, vide).", "Chiama la sequenza per numero, lettera o motivo (pieno, strisce, punti, griglia, vuoto).", "Call the order by number, letter or pattern (solid, stripes, dots, grid, blank)."],
  "Ansage nach Form, Muster (Voll, Streifen, Punkte, Gitter, Leer), Buchstabe oder Nummer – z.B. «Dreieck Streifen» oder «C, dann 4».": ["Annonce par forme, motif (plein, rayures, points, grille, vide), lettre ou numéro – p. ex. «triangle rayures» ou «C, puis 4».", "Chiamata per forma, motivo (pieno, strisce, punti, griglia, vuoto), lettera o numero – p. es. «triangolo strisce» o «C, poi 4».", "Call by shape, pattern (solid, stripes, dots, grid, blank), letter or number – e.g. “triangle stripes” or “C, then 4”."],
  "Gewertet wird nur ein Treffer im angesagten Ziel.": ["Seul un touché dans la cible annoncée compte.", "Conta solo un colpo nel bersaglio chiamato.", "Only a hit on the called target scores."],
  "Ist = aktuelle Position (durchgezogen). +1, +2 … = Vorhalte-Positionen (gestrichelt) in Bewegungsrichtung.": ["Act. = position actuelle (trait plein). +1, +2 … = positions d’anticipation (pointillé) dans le sens du mouvement.", "Att. = posizione attuale (linea continua). +1, +2 … = posizioni di anticipo (tratteggiate) nella direzione del movimento.", "Now = current position (solid). +1, +2 … = lead positions (dashed) in the direction of movement."],
  "Gedrehte Figur: die Trefferzone A ist schmal.": ["Silhouette tournée : la zone A est étroite.", "Sagoma ruotata: la zona A è stretta.", "Turned figure: zone A is narrow."],
  "Nur Treffer innerhalb der Zonen werten.": ["Seuls les touchés dans les zones comptent.", "Contano solo i colpi all’interno delle zone.", "Only score hits inside the zones."],
  "Low-Light: dünne weisse Umrisse auf Schwarz.": ["Faible luminosité : fins contours blancs sur noir.", "Luce scarsa: sottili contorni bianchi su nero.", "Low light: thin white outlines on black."],
  "Achtung: braucht viel Toner.": ["Attention : consomme beaucoup de toner.", "Attenzione: consuma molto toner.", "Note: uses a lot of toner."],
  "Minimal: feine graue Linien, wenig Kontrast und kaum Tinte.": ["Minimal : fines lignes grises, peu de contraste et presque pas d’encre.", "Minimo: sottili linee grigie, poco contrasto e quasi niente inchiostro.", "Minimal: fine grey lines, low contrast and hardly any ink."],

  // --- Beschriftungen auf dem Blatt -----------------------------------------
  "PROBE": ["ESSAI", "PROVA", "SIGHTER"],
  "DECKUNG": ["COUVERTURE", "COPERTURA", "COVER"],
  "Kopf": ["Tête", "Testa", "Head"],
  "Brust": ["Poitrine", "Petto", "Chest"],
  "FREI": ["LIBRE", "LIBERO", "FREE"],
  "Ist": ["Act.", "Att.", "Now"],
  "5 Schuss langsam, ohne Zeitlimit": ["5 coups lentement, sans limite de temps", "5 colpi lenti, senza limite di tempo", "5 shots slow, no time limit"],
  "5 × 1 Schuss aus der Bereitschaft": ["5 × 1 coup depuis la position prête", "5 × 1 colpo dalla posizione di pronto", "5 × 1 shot from the ready"],
  "3 × Doublette (2 Schuss schnell)": ["3 × doublé (2 coups rapides)", "3 × doppietta (2 colpi rapidi)", "3 × double tap (2 quick shots)"],
  "4 → 5: je 1 Schuss mit Zielwechsel, 3 ×": ["4 → 5 : 1 coup chacune avec changement de cible, 3 ×", "4 → 5: 1 colpo ciascuno con cambio di bersaglio, 3 ×", "4 → 5: 1 shot each with target transition, 3 ×"],
  "zweites Ziel zu Nr. 4": ["deuxième cible du n° 4", "secondo bersaglio del n. 4", "second target for no. 4"],
  "5 Schuss nur schwache Hand": ["5 coups main faible uniquement", "5 colpi solo mano debole", "5 shots weak hand only"],
  "5 Schuss nur starke Hand": ["5 coups main forte uniquement", "5 colpi solo mano forte", "5 shots strong hand only"],
  "Anschlag + 1 Schuss, 5 ×": ["mise en joue + 1 coup, 5 ×", "messa in mira + 1 colpo, 5 ×", "present + 1 shot, 5 ×"],
  "9 → 10: je 2 Schuss mit Zielwechsel": ["9 → 10 : 2 coups chacune avec changement de cible", "9 → 10: 2 colpi ciascuno con cambio di bersaglio", "9 → 10: 2 shots each with target transition"],
  "zweites Ziel zu Nr. 9": ["deuxième cible du n° 9", "secondo bersaglio del n. 9", "second target for no. 9"],
};

/** Musterbezeichnungen im Reihenfolge-Code («A=Voll B=Streifen …»). */
const FILL_WORDS: Record<string, Tr> = {
  Voll: ["Plein", "Pieno", "Solid"],
  Streifen: ["Rayures", "Strisce", "Stripes"],
  Punkte: ["Points", "Punti", "Dots"],
  Gitter: ["Grille", "Griglia", "Grid"],
  Leer: ["Vide", "Vuoto", "Blank"],
};

type Pattern = readonly [RegExp, (m: RegExpMatchArray, lang: Lang) => string];
const by = (fr: string, it: string, en: string) => (lang: Lang) => (lang === "fr" ? fr : lang === "it" ? it : en);

/** Texte mit Zahlen (Massstab, Distanzen, Anordnung …). */
const PATTERNS: readonly Pattern[] = [
  [/^Massstab (\S+)$/, (m, l) => by(`Échelle ${m[1]}`, `Scala ${m[1]}`, `Scale ${m[1]}`)(l)],
  [/^simuliert (\S+) m auf (\S+) m$/, (m, l) => by(`simule ${m[1]} m à ${m[2]} m`, `simula ${m[1]} m a ${m[2]} m`, `simulates ${m[1]} m at ${m[2]} m`)(l)],
  [/^zu gross für (\S+), verkleinert \(Soll (\S+)\)$/, (m, l) => by(`trop grand pour ${m[1]}, réduit (prévu ${m[2]})`, `troppo grande per ${m[1]}, ridotto (previsto ${m[2]})`, `too large for ${m[1]}, reduced (intended ${m[2]})`)(l)],
  [/^zu gross für (\S+), verkleinert$/, (m, l) => by(`trop grand pour ${m[1]}, réduit`, `troppo grande per ${m[1]}, ridotto`, `too large for ${m[1]}, reduced`)(l)],
  [/^verkleinert auf (\S+)$/, (m, l) => by(`réduit au format ${m[1]}`, `ridotto al formato ${m[1]}`, `reduced to ${m[1]}`)(l)],
  [/^Anordnung (\d+)$/, (m, l) => by(`Disposition ${m[1]}`, `Disposizione ${m[1]}`, `Layout ${m[1]}`)(l)],
  [/^Karte (\d+)$/, (m, l) => by(`Carte ${m[1]}`, `Cartella ${m[1]}`, `Card ${m[1]}`)(l)],
  [/^Serie (\d+)$/, (m, l) => by(`Série ${m[1]}`, `Serie ${m[1]}`, `Series ${m[1]}`)(l)],
  [/^Spiel (\d+)$/, (m, l) => by(`Partie ${m[1]}`, `Partita ${m[1]}`, `Game ${m[1]}`)(l)],
  [/^(\d+) Figuren$/, (m, l) => by(`${m[1]} silhouettes`, `${m[1]} sagome`, `${m[1]} figures`)(l)],
  [/^(\d+) Positionen$/, (m, l) => by(`${m[1]} positions`, `${m[1]} posizioni`, `${m[1]} positions`)(l)],
  [/^1 Bedrohung$/, (_m, l) => by("1 menace", "1 minaccia", "1 threat")(l)],
  [/^(\d+) Bedrohung(?:en)?(?: \((\d+) gewünscht, nur (\d+) Figuren\))?$/, (m, l) => {
    const one = m[1] === "1";
    const base = by(`${m[1]} ${one ? "menace" : "menaces"}`, `${m[1]} ${one ? "minaccia" : "minacce"}`, `${m[1]} ${one ? "threat" : "threats"}`)(l);
    if (!m[2]) return base;
    return `${base} ${by(`(${m[2]} souhaitées, seulement ${m[3]} silhouettes)`, `(${m[2]} richieste, solo ${m[3]} sagome)`, `(${m[2]} requested, only ${m[3]} figures)`)(l)}`;
  }],
  [/^Bedrohung Nr\. (\d+) nicht vorhanden, gemäss Anordnung$/, (m, l) => by(`menace n° ${m[1]} inexistante, selon la disposition`, `minaccia n. ${m[1]} inesistente, secondo la disposizione`, `threat no. ${m[1]} not present, using the layout`)(l)],
  [/^Bedrohung Nr\. (\d+)$/, (m, l) => by(`Menace n° ${m[1]}`, `Minaccia n. ${m[1]}`, `Threat no. ${m[1]}`)(l)],
  [/^Breite (\S+) mm$/, (m, l) => by(`largeur ${m[1]} mm`, `larghezza ${m[1]} mm`, `width ${m[1]} mm`)(l)],
  [/^Aus (\S+) m schiessen$/, (m, l) => by(`Tirer à ${m[1]} m`, `Tirare a ${m[1]} m`, `Shoot from ${m[1]} m`)(l)],
  [/^Grössen entsprechen (\S+) m$/, (m, l) => by(`tailles pour ${m[1]} m`, `dimensioni per ${m[1]} m`, `sizes match ${m[1]} m`)(l)],
  [/^(\S+) m \(Originalgrösse\)$/, (m, l) => by(`${m[1]} m (taille réelle)`, `${m[1]} m (dimensione originale)`, `${m[1]} m (original size)`)(l)],
  [/^simuliert (\S+) m$/, (m, l) => by(`simule ${m[1]} m`, `simula ${m[1]} m`, `simulates ${m[1]} m`)(l)],
  [/^Raster (\S+) mm$/, (m, l) => by(`Grille ${m[1]} mm`, `Griglia ${m[1]} mm`, `Grid ${m[1]} mm`)(l)],
  [/^Beschriftung in (\S+) ab Mitte$/, (m, l) => by(`graduation en ${m[1]} depuis le centre`, `graduazione in ${m[1]} dal centro`, `labels in ${m[1]} from the centre`)(l)],
  [/^1 MOA ≈ 29\.1 mm auf 100 m ≈ (\S+) mm auf (\S+) m$/, (m, l) => by(`1 MOA ≈ 29.1 mm à 100 m ≈ ${m[1]} mm à ${m[2]} m`, `1 MOA ≈ 29.1 mm a 100 m ≈ ${m[1]} mm a ${m[2]} m`, `1 MOA ≈ 29.1 mm at 100 m ≈ ${m[1]} mm at ${m[2]} m`)(l)],
  [/^1 mrad = (\S+) mm auf (\S+) m$/, (m, l) => by(`1 mrad = ${m[1]} mm à ${m[2]} m`, `1 mrad = ${m[1]} mm a ${m[2]} m`, `1 mrad = ${m[1]} mm at ${m[2]} m`)(l)],
  [/^Leer = (\S+) m$/, (m, l) => by(`Vide = ${m[1]} m`, `Vuoto = ${m[1]} m`, `Blank = ${m[1]} m`)(l)],
  [/^[A-L]=\S+(?: [A-L]=\S+)*$/, (m, l) => m[0].replace(/([A-L])=(\S+)/g, (all, letter: string, word: string) => (FILL_WORDS[word] ? `${letter}=${FILL_WORDS[word][IDX[l]]}` : all))],
];

function exactOrPattern(s: string, lang: Lang): string | null {
  const hit = TARGET_PHRASES[s];
  if (hit) return pick(hit, lang);
  for (const [re, fn] of PATTERNS) {
    const m = s.match(re);
    if (m) {
      const out = fn(m, lang);
      return lang === "fr" ? frSpacing(out) : out;
    }
  }
  return null;
}

/** Sätze trennen («… Scheibe. Für …»), aber nicht nach «Nr.», «z.B.», «ca.» usw. (danach folgt keine Grossschreibung). */
const SENTENCE_SPLIT = /(?<=[.!])\s+(?=[A-ZÄÖÜ«])/;

/**
 * Satzweise übersetzen: von links her jeweils die längste bekannte Folge von Sätzen nehmen
 * (Tabelleneinträge dürfen mehrere Sätze umfassen). null, wenn ein Satz unbekannt ist.
 */
function joinKnownSentences(s: string, lookup: (x: string) => string | null): string | null {
  const direct = lookup(s);
  if (direct !== null) return direct;
  const parts = s.split(SENTENCE_SPLIT);
  if (parts.length < 2) return null;
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    let found: string | null = null;
    let j = parts.length;
    for (; j > i; j--) {
      found = lookup(parts.slice(i, j).join(" "));
      if (found !== null) break;
    }
    if (found === null) return null;
    out.push(found);
    i = j;
  }
  return out.join(" ");
}

function translateSentences(s: string, lang: Lang): string | null {
  return joinKnownSentences(s, (x) => exactOrPattern(x, lang));
}

/**
 * Übersetzt einen deutschen Generator-Text (ganzer Text, Sätze, oder Teile zwischen « · »).
 * Deutsch und unbekannte Texte bleiben unverändert.
 */
export function translateTargetText(de: string, locale: Locale | string | null | undefined): string {
  const lang = langOf(locale);
  if (!lang || !de) return de;
  const whole = translateSentences(de, lang);
  if (whole !== null) return whole;
  if (!de.includes(" · ")) return de;
  return de
    .split(" · ")
    .map((part) => translateSentences(part, lang) ?? part)
    .join(" · ");
}

/** Ob ein Generator-Text vollständig übersetzt werden kann (für Tests; einzelne Buchstaben/Zahlen zählen als neutral). */
export function isKnownTargetText(de: string): boolean {
  const neutral = (s: string) => s === "NS" || !/[A-Za-zÄÖÜäöü]{2,}/.test(s);
  if (neutral(de) || translateSentences(de, "en") !== null) return true;
  return de.includes(" · ") && de.split(" · ").every((p) => neutral(p) || translateSentences(p, "en") !== null);
}

/** Übersetzer-Funktion für eine Sprache (Deutsch: unverändert). */
export function targetTextTranslator(locale: Locale | string | null | undefined): (de: string) => string {
  const lang = langOf(locale);
  if (!lang) return (s) => s;
  return (s) => translateTargetText(s, lang);
}

// ---------------------------------------------------------------------------
// Globale Vorlagen (presets.ts): Name und Beschreibung
// ---------------------------------------------------------------------------

/** Name der Vorlage (deutsch) → Übersetzungen des Namens. Beschreibungen über TARGET_PHRASES/PRESET_DESCRIPTIONS. */
export const PRESET_NAMES: Record<string, Tr> = {
  "Armbrust 10 m": ["Arbalète 10 m", "Balestra 10 m", "Crossbow 10 m"],
  "Armbrust 30 m": ["Arbalète 30 m", "Balestra 30 m", "Crossbow 30 m"],
  "10-Ring Pistole": ["Pistolet 10 anneaux", "Pistola 10 anelli", "10-ring pistol"],
  "10-Ring Gewehr (klein)": ["Fusil 10 anneaux (petite)", "Fucile 10 anelli (piccolo)", "10-ring rifle (small)"],
  "5-Ring gross": ["5 anneaux grande", "5 anelli grande", "5-ring large"],
  "Punkte-Raster 3×4": ["Grille de points 3×4", "Griglia di punti 3×4", "Dot grid 3×4"],
  "Einschiessraster 10 mm": ["Grille de réglage 10 mm", "Griglia di azzeramento 10 mm", "Zeroing grid 10 mm"],
  "Oval-Silhouette": ["Silhouette ovale", "Sagoma ovale", "Oval silhouette"],
  "Rauten 2×3": ["Losanges 2×3", "Rombi 2×3", "Diamonds 2×3"],
  "Präzisionspistole 50 m auf 10 m": ["Pistolet précision 50 m à 10 m", "Pistola precisione 50 m a 10 m", "Precision pistol 50 m at 10 m"],
  "Präzisionspistole 25 m (verkleinert)": ["Pistolet précision 25 m (réduite)", "Pistola precisione 25 m (ridotta)", "Precision pistol 25 m (reduced)"],
  "Luftpistole 10 m": ["Pistolet à air comprimé 10 m", "Pistola ad aria compressa 10 m", "Air pistol 10 m"],
  "Luftgewehr 10 m": ["Carabine à air comprimé 10 m", "Carabina ad aria compressa 10 m", "Air rifle 10 m"],
  "Luftgewehr-Streifen 2×5 mit Probe": ["Bande carabine à air 2×5 avec essai", "Striscia carabina ad aria 2×5 con prova", "Air rifle strip 2×5 with sighter"],
  "Luftgewehr-Streifen A5 (2×3)": ["Bande carabine à air A5 (2×3)", "Striscia carabina ad aria A5 (2×3)", "Air rifle strip A5 (2×3)"],
  "A-Scheibe 10er: 300 m auf 25 m": ["Cible A à 10 points : 300 m à 25 m", "Bersaglio A a 10 punti: 300 m a 25 m", "A target 10-point: 300 m at 25 m"],
  "A-Scheibe 5er: 300 m auf 25 m": ["Cible A à 5 points : 300 m à 25 m", "Bersaglio A a 5 punti: 300 m a 25 m", "A target 5-point: 300 m at 25 m"],
  "P10: 50 m auf 10 m": ["P10 : 50 m à 10 m", "P10: 50 m a 10 m", "P10: 50 m at 10 m"],
  "Leere Ringscheibe 10 Ringe": ["Cible vierge 10 anneaux", "Bersaglio vuoto 10 anelli", "Blank ring target 10 rings"],
  "Schnellfeuer 5 Marken": ["Tir rapide 5 marques", "Tiro rapido 5 marcature", "Rapid fire 5 marks"],
  "Duell-Ovale 5er-Reihe": ["Ovales de duel, rangée de 5", "Ovali da duello, fila da 5", "Duel ovals, row of 5"],
  "Punkte-Drill 1–10": ["Exercice de points 1–10", "Esercizio a punti 1–10", "Dot drill 1–10"],
  "Ansage-Training Formen & Zahlen": ["Entraînement à l’annonce formes et nombres", "Allenamento su chiamata forme e numeri", "Call-out training shapes & numbers"],
  "Distanzleiter 10–25 m": ["Échelle de distances 10–25 m", "Scala di distanze 10–25 m", "Distance ladder 10–25 m"],
  "Plates-Rack 6er": ["Plates-Rack de 6", "Plates-Rack da 6", "Plate rack of 6"],
  "Kegel 6er": ["Quilles par 6", "Birilli da 6", "Pins, row of 6"],
  "Einschiessen mit Rauten": ["Réglage avec losanges", "Azzeramento con rombi", "Zeroing with diamonds"],
  "Tic-Tac-Toe": ["Morpion", "Tris", "Noughts and crosses"],
  "Zahlenfeld 1–25": ["Grille de nombres 1–25", "Griglia di numeri 1–25", "Number grid 1–25"],
  "Bingo-Karte": ["Carte de bingo", "Cartella della tombola", "Bingo card"],
  "Uhr 12 Ziele": ["Horloge 12 cibles", "Orologio 12 bersagli", "Clock 12 targets"],
  "Silhouette Zonen A/C/D": ["Silhouette zones A/C/D", "Sagoma zone A/C/D", "Silhouette zones A/C/D"],
  "Silhouette Kopf/Brust": ["Silhouette tête/poitrine", "Sagoma testa/petto", "Silhouette head/chest"],
  "Silhouette mit NS-Zone": ["Silhouette avec zone NS", "Sagoma con zona NS", "Silhouette with NS zone"],
  "Geiselnahme Geisel rechts": ["Prise d’otage, otage à droite", "Presa d’ostaggi, ostaggio a destra", "Hostage, hostage right"],
  "Geiselnahme Geisel links": ["Prise d’otage, otage à gauche", "Presa d’ostaggi, ostaggio a sinistra", "Hostage, hostage left"],
  "Geiselnahme nur Kopf frei": ["Prise d’otage, seule la tête libre", "Presa d’ostaggi, solo testa libera", "Hostage, head only exposed"],
  "Geiselnahme zwei Geiseln": ["Prise d’otage, deux otages", "Presa d’ostaggi, due ostaggi", "Hostage, two hostages"],
  "Geiselnahme Geisel kniend": ["Prise d’otage, otage à genoux", "Presa d’ostaggi, ostaggio in ginocchio", "Hostage, kneeling hostage"],
  "Shoot/No-Shoot 6 Figuren": ["Shoot/No-Shoot 6 silhouettes", "Shoot/No-Shoot 6 sagome", "Shoot/no-shoot 6 figures"],
  "Shoot/No-Shoot Lernversion": ["Shoot/No-Shoot version d’apprentissage", "Shoot/No-Shoot versione didattica", "Shoot/no-shoot learning version"],
  "Gruppe mit Unbeteiligten": ["Groupe avec personnes non impliquées", "Gruppo con persone estranee", "Group with bystanders"],
  "Teildeckung Mauer": ["Couverture partielle mur", "Copertura parziale muro", "Partial cover wall"],
  "Teildeckung Kisten": ["Couverture partielle caisses", "Copertura parziale casse", "Partial cover crates"],
  "Barrikade seitlich": ["Barricade latérale", "Barricata laterale", "Side barricade"],
  "Türrahmen": ["Encadrement de porte", "Telaio della porta", "Door frame"],
  "Fenster-Öffnung": ["Ouverture de fenêtre", "Apertura della finestra", "Window opening"],
  "Fenster mit Fensterkreuz": ["Fenêtre avec croisillon", "Finestra con crociera", "Window with window cross"],
  "Fahrzeug-Deckung Dach": ["Couverture véhicule, toit", "Copertura veicolo, tetto", "Vehicle cover, roof"],
  "Fahrzeug-Deckung Motorhaube": ["Couverture véhicule, capot", "Copertura veicolo, cofano", "Vehicle cover, bonnet"],
  "Kopfzonen-Präzision 6 Boxen": ["Précision zones de tête, 6 carrés", "Precisione zone della testa, 6 riquadri", "Head zone precision, 6 boxes"],
  "Kopfzonen 25 m auf 10 m": ["Zones de tête 25 m à 10 m", "Zone della testa 25 m a 10 m", "Head zones 25 m at 10 m"],
  "Mehrfachziele Reihenfolge": ["Cibles multiples, ordre", "Bersagli multipli, sequenza", "Multiple targets, sequence"],
  "Formen mit Muster-Code": ["Formes avec code de motif", "Forme con codice a motivo", "Shapes with pattern code"],
  "Bewegung simuliert nach rechts": ["Mouvement simulé vers la droite", "Movimento simulato verso destra", "Simulated movement to the right"],
  "Verdrehte Figur Profil/halb": ["Silhouette tournée profil/à moitié", "Sagoma ruotata profilo/a metà", "Turned figure profile/half"],
  "Low-Light dunkel": ["Faible luminosité sombre", "Luce scarsa scuro", "Low light dark"],
  "Kontrast minimal": ["Contraste minimal", "Contrasto minimo", "Minimal contrast"],
};

/** Beschreibungen der Vorlagen (deutsch) → Übersetzungen. Sätze wie «Für Ausbildung …» stehen in TARGET_PHRASES. */
export const PRESET_DESCRIPTIONS: Record<string, Tr> = {
  "Ringscheibe 1–10 für Armbrust 10 m, nachempfunden. Masse angenähert (ca. 60 mm), bitte mit dem aktuellen Reglement prüfen.": ["Cible à anneaux 1–10 pour l’arbalète 10 m, reproduction. Dimensions approximatives (env. 60 mm), merci de vérifier avec le règlement en vigueur.", "Bersaglio ad anelli 1–10 per balestra 10 m, riproduzione. Misure approssimative (ca. 60 mm), verifica con il regolamento in vigore.", "Ring target 1–10 for 10 m crossbow, replica. Approximate dimensions (approx. 60 mm), please check against the current rules."],
  "Ringscheibe 1–10 für Armbrust 30 m, nachempfunden. Masse angenähert (ca. 120 mm), bitte mit dem aktuellen Reglement prüfen.": ["Cible à anneaux 1–10 pour l’arbalète 30 m, reproduction. Dimensions approximatives (env. 120 mm), merci de vérifier avec le règlement en vigueur.", "Bersaglio ad anelli 1–10 per balestra 30 m, riproduzione. Misure approssimative (ca. 120 mm), verifica con il regolamento in vigore.", "Ring target 1–10 for 30 m crossbow, replica. Approximate dimensions (approx. 120 mm), please check against the current rules."],
  "Ringscheibe 1–10, schwarzer Spiegel ab 7.": ["Cible à anneaux 1–10, visuel noir dès le 7.", "Bersaglio ad anelli 1–10, visuale nero dal 7.", "Ring target 1–10, black from 7."],
  "Kleine Ringscheibe 1–10 mit Spiegel ab 4, für Luftgewehr und Kleinkaliber.": ["Petite cible à anneaux 1–10 avec visuel dès le 4, pour carabine à air comprimé et petit calibre.", "Piccolo bersaglio ad anelli 1–10 con visuale dal 4, per carabina ad aria compressa e piccolo calibro.", "Small ring target 1–10 with black from 4, for air rifle and smallbore."],
  "Grobe Ringe 6–10, gut sichtbar auf Distanz.": ["Gros anneaux 6–10, bien visibles à distance.", "Anelli grandi 6–10, ben visibili a distanza.", "Large rings 6–10, easy to see at distance."],
  "Zwölf kleine Scheiben für Präzisionsserien.": ["Douze petites cibles pour séries de précision.", "Dodici piccoli bersagli per serie di precisione.", "Twelve small targets for precision series."],
  "Zentimeterraster mit Fadenkreuz.": ["Grille centimétrique avec réticule.", "Griglia centimetrica con reticolo.", "Centimetre grid with crosshair."],
  "Trefferzonen A/C/D für dynamisches Training.": ["Zones de touché A/C/D pour l’entraînement dynamique.", "Zone di impatto A/C/D per l’allenamento dinamico.", "Scoring zones A/C/D for dynamic training."],
  "Sechs Rauten, kontrastreich.": ["Six losanges, très contrastés.", "Sei rombi, molto contrastati.", "Six diamonds, high contrast."],
  "Präzisionsscheibe 25/50 m nachempfunden, verkleinert für 10 m (Massstab 1:5).": ["Reproduction de la cible de précision 25/50 m, réduite pour 10 m (échelle 1:5).", "Riproduzione del bersaglio di precisione 25/50 m, ridotto per 10 m (scala 1:5).", "Replica of the 25/50 m precision target, reduced for 10 m (scale 1:5)."],
  "Präzisionsscheibe 25/50 m nachempfunden, so gross wie das Papier erlaubt. Massstab steht oben links.": ["Reproduction de la cible de précision 25/50 m, aussi grande que le papier le permet. L’échelle figure en haut à gauche.", "Riproduzione del bersaglio di precisione 25/50 m, grande quanto consente la carta. La scala è indicata in alto a sinistra.", "Replica of the 25/50 m precision target, as large as the paper allows. The scale is shown top left."],
  "Luftpistolenscheibe nachempfunden, Originalgrösse 155.5 mm.": ["Reproduction de la cible pistolet à air comprimé, taille réelle 155.5 mm.", "Riproduzione del bersaglio per pistola ad aria compressa, dimensione originale 155.5 mm.", "Replica of the air pistol target, original size 155.5 mm."],
  "Luftgewehrscheibe nachempfunden, Originalgrösse 45.5 mm.": ["Reproduction de la cible carabine à air comprimé, taille réelle 45.5 mm.", "Riproduzione del bersaglio per carabina ad aria compressa, dimensione originale 45.5 mm.", "Replica of the air rifle target, original size 45.5 mm."],
  "Zehn Luftgewehrscheiben (nachempfunden) pro A4 in nummerierten Feldern, erste Scheibe als Probe.": ["Dix cibles carabine à air comprimé (reproductions) par A4 dans des cases numérotées, la première comme cible d’essai.", "Dieci bersagli per carabina ad aria compressa (riproduzioni) per A4 in caselle numerate, il primo come prova.", "Ten air rifle targets (replicas) per A4 in numbered boxes, the first as a sighter."],
  "Sechs Luftgewehrscheiben pro A5, ohne Probe.": ["Six cibles carabine à air comprimé par A5, sans essai.", "Sei bersagli per carabina ad aria compressa per A5, senza prova.", "Six air rifle targets per A5, no sighter."],
  "A-Scheibe (CH-Stil) nachempfunden, Masse angenähert. Massstab 1:12 für das Training auf 25 m.": ["Reproduction de la cible A (style CH), dimensions approximatives. Échelle 1:12 pour l’entraînement à 25 m.", "Riproduzione del bersaglio A (stile CH), misure approssimative. Scala 1:12 per l’allenamento a 25 m.", "Replica of the A target (Swiss style), approximate dimensions. Scale 1:12 for training at 25 m."],
  "A-Scheibe mit 5er-Wertung (CH-Stil) nachempfunden, Masse angenähert. Massstab 1:12.": ["Reproduction de la cible A avec comptage à 5 points (style CH), dimensions approximatives. Échelle 1:12.", "Riproduzione del bersaglio A con conteggio a 5 punti (stile CH), misure approssimative. Scala 1:12.", "Replica of the A target with 5-point scoring (Swiss style), approximate dimensions. Scale 1:12."],
  "Pistolenscheibe P10 (CH-Stil) nachempfunden, Masse angenähert, Massstab 1:5 für 10 m.": ["Reproduction de la cible pistolet P10 (style CH), dimensions approximatives, échelle 1:5 pour 10 m.", "Riproduzione del bersaglio per pistola P10 (stile CH), misure approssimative, scala 1:5 per 10 m.", "Replica of the P10 pistol target (Swiss style), approximate dimensions, scale 1:5 for 10 m."],
  "Nur Wertungsringe ohne Spiegel – zum Markieren und für eigene Distanzen.": ["Uniquement les anneaux de comptage, sans visuel – pour marquer et pour tes propres distances.", "Solo anelli di punteggio senza visuale – per marcare e per distanze proprie.", "Scoring rings only, no black – for marking and your own distances."],
  "Drei Serien mit je fünf Schnellfeuer-Marken (nachempfunden) für Zielwechsel-Drills.": ["Trois séries de cinq marques de tir rapide (reproductions) pour exercices de changement de cible.", "Tre serie da cinque marcature per tiro rapido (riproduzioni) per esercizi di cambio di bersaglio.", "Three series of five rapid-fire marks (replicas) for target transition drills."],
  "Fünf Ovale pro Reihe für Duell- und Schnellfeuer-Drills.": ["Cinq ovales par rangée pour exercices de duel et de tir rapide.", "Cinque ovali per fila per esercizi di duello e tiro rapido.", "Five ovals per row for duel and rapid-fire drills."],
  "Zehn nummerierte Kreise und Quadrate mit Aufgabe pro Nummer.": ["Dix cercles et carrés numérotés avec un exercice par numéro.", "Dieci cerchi e quadrati numerati con un esercizio per numero.", "Ten numbered circles and squares with one task per number."],
  "Kreise, Quadrate, Dreiecke mit 1–9 und A–C. Partner sagt an, du schiesst.": ["Cercles, carrés, triangles avec 1–9 et A–C. Le partenaire annonce, tu tires.", "Cerchi, quadrati, triangoli con 1–9 e A–C. Il partner chiama, tu spari.", "Circles, squares, triangles with 1–9 and A–C. Partner calls, you shoot."],
  "Gleiche Scheibe in vier Grössen: simuliert 10, 15, 20 und 25 m beim Schiessen auf 10 m.": ["La même cible en quatre tailles : simule 10, 15, 20 et 25 m en tirant à 10 m.", "Lo stesso bersaglio in quattro dimensioni: simula 10, 15, 20 e 25 m sparando a 10 m.", "The same target in four sizes: simulates 10, 15, 20 and 25 m when shooting at 10 m."],
  "Sechs Plates in einer Reihe, zwei Reihen pro Blatt – für Speed-Drills.": ["Six plates en rangée, deux rangées par feuille – pour exercices de vitesse.", "Sei piatti in fila, due file per foglio – per esercizi di velocità.", "Six plates in a row, two rows per sheet – for speed drills."],
  "Sechs Kegel in einer Reihe für Speed-Drills.": ["Six quilles en rangée pour exercices de vitesse.", "Sei birilli in fila per esercizi di velocità.", "Six pins in a row for speed drills."],
  "Zentimeter-Raster, Rauten als Haltepunkte und Hilfetext zu Zoll, MOA und mrad.": ["Grille centimétrique, losanges comme points de visée et aide sur les pouces, MOA et mrad.", "Griglia centimetrica, rombi come punti di mira e testo di aiuto su pollici, MOA e mrad.", "Centimetre grid, diamonds as aiming points and help text on inches, MOA and mrad."],
  "Spielfeld 3×3 – zwei Schützen spielen gegeneinander.": ["Grille de jeu 3×3 – deux tireurs jouent l’un contre l’autre.", "Campo di gioco 3×3 – due tiratori giocano uno contro l’altro.", "3×3 board – two shooters play against each other."],
  "Gemischte Zahlen 1–25 im 5×5-Feld. Zahl ansagen und treffen.": ["Nombres 1–25 mélangés dans une grille 5×5. Annonce un nombre et touche-le.", "Numeri 1–25 mescolati in una griglia 5×5. Chiama un numero e colpiscilo.", "Mixed numbers 1–25 in a 5×5 grid. Call a number and hit it."],
  "B-I-N-G-O-Karte mit Zahlen 1–75 und freiem Mittelfeld.": ["Carte B-I-N-G-O avec nombres 1–75 et case centrale libre.", "Cartella B-I-N-G-O con numeri 1–75 e casella centrale libera.", "B-I-N-G-O card with numbers 1–75 and a free centre square."],
  "Zwölf Ziele wie ein Zifferblatt – Ansage «3 Uhr», Ziel 3 treffen.": ["Douze cibles comme un cadran – annonce «3 heures», toucher la cible 3.", "Dodici bersagli come un quadrante – chiamata «ore 3», colpire il bersaglio 3.", "Twelve targets like a clock face – call “3 o’clock”, hit target 3."],
  "Neutrale Umriss-Silhouette ohne Gesicht mit Trefferzonen A, C und D.": ["Silhouette neutre sans visage avec zones de touché A, C et D.", "Sagoma neutra senza volto con zone di impatto A, C e D.", "Neutral outline silhouette without a face, with scoring zones A, C and D."],
  "Neutrale Silhouette mit zwei Zonen: Kopf und Brust.": ["Silhouette neutre avec deux zones : tête et poitrine.", "Sagoma neutra con due zone: testa e petto.", "Neutral silhouette with two zones: head and chest."],
  "Silhouette mit schraffierter «NS»-Zone, die nicht getroffen werden darf.": ["Silhouette avec une zone «NS» hachurée qui ne doit pas être touchée.", "Sagoma con una zona «NS» tratteggiata che non deve essere colpita.", "Silhouette with a hatched “NS” zone that must not be hit."],
  "Bedroher hinter Geisel, frei sind Kopfseite und Schulter.": ["Agresseur derrière l’otage, le côté de la tête et l’épaule sont libres.", "Aggressore dietro l’ostaggio, sono liberi il lato della testa e la spalla.", "Threat behind the hostage; the side of the head and the shoulder are exposed."],
  "Gespiegelte Variante: Geisel links vor dem Bedroher.": ["Variante inversée : otage à gauche devant l’agresseur.", "Variante speculare: ostaggio a sinistra davanti all’aggressore.", "Mirrored variant: hostage on the left in front of the threat."],
  "Vom Bedroher ist nur ein Teil des Kopfes sichtbar – sehr hohe Schwierigkeit.": ["Seule une partie de la tête de l’agresseur est visible – difficulté très élevée.", "Dell’aggressore è visibile solo una parte della testa – difficoltà molto elevata.", "Only part of the threat’s head is visible – very high difficulty."],
  "Bedroher zwischen zwei Geiseln, frei sind Kopf und schmaler Streifen.": ["Agresseur entre deux otages, la tête et une bande étroite sont libres.", "Aggressore tra due ostaggi, sono liberi la testa e una striscia stretta.", "Threat between two hostages; the head and a narrow strip are exposed."],
  "Kniende Geisel vor dem Bedroher, Kopf und obere Brust frei.": ["Otage à genoux devant l’agresseur, tête et haut de la poitrine libres.", "Ostaggio in ginocchio davanti all’aggressore, testa e parte superiore del petto libere.", "Kneeling hostage in front of the threat; head and upper chest exposed."],
  "Sechs Figuren, zwei mit Pistolen-Symbol. Anordnung Nr. ändern für neue Versionen.": ["Six silhouettes, deux avec le symbole pistolet. Change le numéro de disposition pour de nouvelles versions.", "Sei sagome, due con il simbolo della pistola. Cambia il numero di disposizione per nuove versioni.", "Six figures, two with the pistol symbol. Change the layout number for new versions."],
  "Vier Figuren, NS-Figuren markiert – zum Erklären vor dem Entscheidungstraining.": ["Quatre silhouettes, silhouettes NS marquées – pour expliquer avant l’entraînement à la décision.", "Quattro sagome, sagome NS contrassegnate – per spiegare prima dell’allenamento decisionale.", "Four figures, NS figures marked – for briefing before decision training."],
  "Sechs Figuren in Reihen, eine davon ist die Bedrohung, alle anderen NS.": ["Six silhouettes en rangées, l’une d’elles est la menace, toutes les autres NS.", "Sei sagome in file, una di esse è la minaccia, tutte le altre NS.", "Six figures in rows; one is the threat, all others NS."],
  "Figur hinter einer Mauer, nur Oberkörper frei.": ["Silhouette derrière un mur, seul le haut du corps est libre.", "Sagoma dietro un muro, solo il busto è libero.", "Figure behind a wall, upper body only exposed."],
  "Figur hinter Kisten mit unregelmässiger Oberkante.": ["Silhouette derrière des caisses au bord supérieur irrégulier.", "Sagoma dietro casse con bordo superiore irregolare.", "Figure behind crates with an uneven top edge."],
  "Seitliche Deckung, frei sind nur Schulter und Kopfseite.": ["Couverture latérale, seuls l’épaule et le côté de la tête sont libres.", "Copertura laterale, sono liberi solo la spalla e il lato della testa.", "Side cover; only the shoulder and side of the head are exposed."],
  "Figur im Türrahmen, beidseitig teilweise verdeckt.": ["Silhouette dans l’encadrement de porte, partiellement cachée des deux côtés.", "Sagoma nel telaio della porta, parzialmente coperta su entrambi i lati.", "Figure in a door frame, partly covered on both sides."],
  "Figur hinter Wand, sichtbar nur durch das Fenster.": ["Silhouette derrière un mur, visible uniquement par la fenêtre.", "Sagoma dietro un muro, visibile solo attraverso la finestra.", "Figure behind a wall, visible only through the window."],
  "Fenster-Öffnung mit Kreuz als zusätzliche Deckung.": ["Ouverture de fenêtre avec croisillon comme couverture supplémentaire.", "Apertura della finestra con crociera come copertura aggiuntiva.", "Window opening with a cross as extra cover."],
  "Figur hinter einem Fahrzeug, nur Kopf und Schultern über dem Dach frei.": ["Silhouette derrière un véhicule, seules la tête et les épaules au-dessus du toit sont libres.", "Sagoma dietro un veicolo, sono liberi solo testa e spalle sopra il tetto.", "Figure behind a vehicle; only the head and shoulders above the roof are exposed."],
  "Figur hinter der Motorhaube, teilweise durch die Frontscheibe verdeckt.": ["Silhouette derrière le capot, partiellement cachée par le pare-brise.", "Sagoma dietro il cofano, parzialmente coperta dal parabrezza.", "Figure behind the bonnet, partly covered by the windscreen."],
  "Sechs nummerierte Kopfzonen als Boxen.": ["Six zones de tête numérotées en carrés.", "Sei zone della testa numerate a riquadri.", "Six numbered head zones as boxes."],
  "Vier Kopfzonen gemischt (Boxen und Dreiecke), Grösse für 25 m simuliert beim Schiessen auf 10 m.": ["Quatre zones de tête mixtes (carrés et triangles), taille simulée pour 25 m en tirant à 10 m.", "Quattro zone della testa miste (riquadri e triangoli), dimensione simulata per 25 m sparando a 10 m.", "Four mixed head zones (boxes and triangles), size simulated for 25 m when shooting at 10 m."],
  "Nur A4, damit die simulierte Grösse passt.": ["Uniquement A4, pour que la taille simulée soit juste.", "Solo A4, affinché la dimensione simulata sia corretta.", "A4 only, so the simulated size fits."],
  "Fünf Figuren mit Muster-Code, Buchstaben und Reihenfolge-Nummern.": ["Cinq silhouettes avec code de motif, lettres et numéros d’ordre.", "Cinque sagome con codice a motivo, lettere e numeri di sequenza.", "Five figures with pattern code, letters and sequence numbers."],
  "Neun Formen mit Muster, Buchstabe und Nummer für Ansage-Drills ohne Farbe.": ["Neuf formes avec motif, lettre et numéro pour exercices d’annonce sans couleur.", "Nove forme con motivo, lettera e numero per esercizi su chiamata senza colori.", "Nine shapes with pattern, letter and number for call-out drills without colour."],
  "Ist-Position und zwei Vorhalte-Positionen, zwei Bahnen.": ["Position actuelle et deux positions d’anticipation, deux lignes.", "Posizione attuale e due posizioni di anticipo, due linee.", "Current position and two lead positions, two lanes."],
  "Eine Figur im Profil, eine halb gedreht – schmale Trefferzone.": ["Une silhouette de profil, une à moitié tournée – zone de touché étroite.", "Una sagoma di profilo, una ruotata a metà – zona di impatto stretta.", "One figure in profile, one half turned – narrow scoring zone."],
  "Fast schwarzes Blatt mit dünnen weissen Umrissen.": ["Feuille presque noire avec de fins contours blancs.", "Foglio quasi nero con sottili contorni bianchi.", "Almost black sheet with thin white outlines."],
  "Nur feine graue Linien – wenig Kontrast und kaum Tinte.": ["Seulement de fines lignes grises – peu de contraste et presque pas d’encre.", "Solo sottili linee grigie – poco contrasto e quasi niente inchiostro.", "Fine grey lines only – low contrast and hardly any ink."],
  [CHECK_RULES]: ["merci de vérifier avec le règlement en vigueur.", "verifica con il regolamento in vigore.", "please check against the current rules."],
};

function translatePresetDescription(de: string, lang: Lang): string | null {
  return joinKnownSentences(de, (x) => {
    const tr = PRESET_DESCRIPTIONS[x] ?? TARGET_PHRASES[x];
    return tr ? pick(tr, lang) : null;
  });
}

const PRESET_BY_NAME: ReadonlyMap<string, string | undefined> = new Map(
  [...TARGET_PRESETS, ...CROSSBOW_TARGET_PRESETS.map((p) => p.target)].map((p) => [p.name, p.description]),
);

/**
 * Name und Beschreibung einer Scheibe für die Anzeige. Übersetzt nur globale Scheiben, deren Name
 * (bzw. Beschreibung) noch genau dem Text der eingebauten Vorlage entspricht.
 */
export function localizeTarget<T extends { name: string; description: string | null; scope?: string; tenantId?: string | null; ownerUserId?: string | null }>(
  target: T,
  locale: Locale | string | null | undefined,
): T {
  const lang = langOf(locale);
  if (!lang) return target;
  const isGlobal = target.scope !== undefined ? target.scope === "global" : target.tenantId === null && target.ownerUserId === null;
  if (!isGlobal || !PRESET_BY_NAME.has(target.name)) return target;
  const presetDescription = PRESET_BY_NAME.get(target.name);
  const nameTr = PRESET_NAMES[target.name];
  const name = nameTr ? pick(nameTr, lang) : target.name;
  const description =
    target.description && target.description === presetDescription
      ? (translatePresetDescription(target.description, lang) ?? target.description)
      : target.description;
  return { ...target, name, description };
}

/** Nur den Namen einer Vorlage übersetzen (z.B. für Auswahllisten), sofern es eine globale Vorlage ist. */
export function localizeTargetName(name: string, isGlobal: boolean, locale: Locale | string | null | undefined): string {
  const lang = langOf(locale);
  if (!lang || !isGlobal) return name;
  const tr = PRESET_NAMES[name];
  return tr ? pick(tr, lang) : name;
}
