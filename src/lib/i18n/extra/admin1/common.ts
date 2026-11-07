/** «adm1.common.», «adm1.http.»: ergänzende allgemeine Texte der Verwaltung. */
import type { Rows } from "./row";

const rows: Rows = {
  "adm1.common.pleaseWait": ["Bitte warten…", "Veuillez patienter…", "Attendere…", "Please wait…"],
  "adm1.common.optional": ["(optional)", "(facultatif)", "(facoltativo)", "(optional)"],
  "adm1.common.invalidRequest": ["Ungültige Anfrage.", "Requête non valable.", "Richiesta non valida.", "Invalid request."],
  "adm1.common.download": ["Herunterladen", "Télécharger", "Scarica", "Download"],
  "adm1.common.from": ["Von", "Du", "Dal", "From"],
  "adm1.common.to": ["Bis", "Au", "Al", "To"],
  "adm1.common.filter": ["Filtern", "Filtrer", "Filtra", "Filter"],
  "adm1.common.reset": ["Zurücksetzen", "Réinitialiser", "Reimposta", "Reset"],
  "adm1.common.deletedAccount": ["Gelöschtes Konto", "Compte supprimé", "Account eliminato", "Deleted account"],
  "adm1.http.moduleOff": ["Modul nicht aktiv", "Module non activé", "Modulo non attivo", "Module not active"],
  "adm1.http.notFound": ["Nicht gefunden", "Introuvable", "Non trovato", "Not found"],

  // Protokoll
  "adm1.audit.title": ["Protokoll", "Journal", "Protocollo", "Audit log"],
  "adm1.audit.subtitle": ["Wer hat wann was im Verein geändert", "Qui a modifié quoi et quand dans la société", "Chi ha modificato cosa e quando nella società", "Who changed what in the club, and when"],
  "adm1.audit.admin": ["Verwaltung", "Administration", "Amministrazione", "Administration"],
  "adm1.audit.archiveDownload": ["Vereinsarchiv herunterladen", "Télécharger l’archive de la société", "Scarica l’archivio della società", "Download club archive"],
  "adm1.audit.archive": ["Archiv", "Archive", "Archivio", "Archive"],
  "adm1.audit.archiveText": ["Das Vereinsarchiv enthält Mitglieder, Resultate, Anlässe, Reservationen, Rechnungen und die Liste der Dateien als CSV in einer ZIP-Datei. Bitte sicher aufbewahren.", "L’archive de la société contient les membres, résultats, manifestations, réservations, factures et la liste des fichiers en CSV dans un fichier ZIP. À conserver en lieu sûr.", "L’archivio della società contiene soci, risultati, eventi, prenotazioni, fatture e l’elenco dei file come CSV in un file ZIP. Conservarlo in un luogo sicuro.", "The club archive contains members, results, events, bookings, invoices and the list of files as CSV in a ZIP file. Please keep it somewhere safe."],
  "adm1.audit.area": ["Bereich", "Domaine", "Ambito", "Area"],
  "adm1.audit.allAreas": ["Alle Bereiche", "Tous les domaines", "Tutti gli ambiti", "All areas"],
  "adm1.audit.person": ["Person", "Personne", "Persona", "Person"],
  "adm1.audit.personPlaceholder": ["Person (Name)", "Personne (nom)", "Persona (nome)", "Person (name)"],
  "adm1.audit.entries.one": ["{n} Eintrag", "{n} entrée", "{n} voce", "{n} entry"],
  "adm1.audit.entries.other": ["{n} Einträge", "{n} entrées", "{n} voci", "{n} entries"],
  "adm1.audit.empty": ["Keine Einträge", "Aucune entrée", "Nessuna voce", "No entries"],
  "adm1.audit.emptyText": ["Sobald jemand Rollen ändert, löscht, importiert oder Einstellungen anpasst, erscheint es hier.", "Dès que quelqu’un modifie des rôles, supprime, importe ou adapte des paramètres, cela apparaît ici.", "Non appena qualcuno modifica ruoli, elimina, importa o adatta impostazioni, appare qui.", "As soon as someone changes roles, deletes, imports or adjusts settings, it appears here."],
  "adm1.audit.deletedClub": ["Gelöschter Verein", "Société supprimée", "Società eliminata", "Deleted club"],
  "adm1.audit.platform": ["Plattform", "Plateforme", "Piattaforma", "Platform"],
  "adm1.audit.unknown": ["Unbekannt", "Inconnu", "Sconosciuto", "Unknown"],
  "adm1.audit.system": ["System", "Système", "Sistema", "System"],
  "adm1.audit.csvFile": ["protokoll", "journal", "protocollo", "audit-log"],
  "adm1.audit.csv.time": ["Zeitpunkt (UTC)", "Moment (UTC)", "Momento (UTC)", "Time (UTC)"],
  "adm1.audit.csv.club": ["Verein", "Société", "Società", "Club"],
  "adm1.audit.csv.action": ["Aktion", "Action", "Azione", "Action"],
  "adm1.audit.csv.person": ["Person", "Personne", "Persona", "Person"],
  "adm1.audit.csv.personId": ["Personen-ID", "ID de la personne", "ID della persona", "Person ID"],
  "adm1.audit.csv.entity": ["Objekt", "Objet", "Oggetto", "Object"],
  "adm1.audit.csv.entityId": ["Objekt-ID", "ID de l’objet", "ID dell’oggetto", "Object ID"],
  "adm1.audit.csv.details": ["Details", "Détails", "Dettagli", "Details"],
  "adm1.audit.csv.ip": ["IP", "IP", "IP", "IP"],
};

export default rows;
