import { redirect } from "next/navigation";

/** Verwaltung Vereinswaffen: Inventar unter /weapons, hier nur die Einstellungen. */
export default function AdminWeaponsPage() {
  redirect("/admin/weapons/settings");
}
