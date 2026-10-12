import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/** Bereich (Tab) bzw. übergeordnete Seite zur aktuellen Route – für Titel und Zurück-Pfeil. */
type NavInfo = { title: string; back?: { to: string; label: string } }

export function navInfo(pathname: string, search = ""): NavInfo {
  if (pathname === "/plans" && /[?&](edit|rhythm)=/.test(search))
    return { title: "Plan", back: { to: "/plans", label: "Pläne" } };
  if (pathname === "/nutrition") return { title: "Ernährung" };
  if (pathname === "/recipes") return { title: "Rezepte", back: { to: "/nutrition", label: "Ernährung" } };
  if (pathname === "/shopping") return { title: "Wochenplan", back: { to: "/nutrition", label: "Ernährung" } };
  if (pathname === "/") return { title: "Training" };
  if (pathname === "/plans") return { title: "Pläne", back: { to: "/", label: "Training" } };
  if (pathname === "/exercises") return { title: "Übungen", back: { to: "/", label: "Training" } };
  if (pathname.startsWith("/exercises/")) return { title: "Übung", back: { to: "/exercises", label: "Übungen" } };
  if (pathname === "/quick") return { title: "Home-Workout", back: { to: "/", label: "Training" } };
  if (pathname === "/analytics" || pathname === "/badges") return { title: "Fortschritt" };
  if (pathname === "/body") return { title: "Körper", back: { to: "/analytics", label: "Fortschritt" } };
  if (pathname === "/history") return { title: "Verlauf", back: { to: "/analytics", label: "Fortschritt" } };
  if (pathname === "/social") return { title: "Community" };
  if (pathname === "/feed") return { title: "Aktivitäten", back: { to: "/social", label: "Community" } };
  if (pathname === "/profile") return { title: "Profil", back: { to: "", label: "Zurück" } };
  return { title: "" };
}

/**
 * Schmale Zurück-Zeile – nur auf Unterseiten (Rezepte, Pläne, Verlauf, Profil …).
 * Hauptseiten haben keine eigene Leiste: Buddy & Profil sitzen dort in der
 * Titelzeile (TabHeader), damit der Inhalt höher beginnt.
 */
export function TopBar() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const nav = navInfo(pathname, search);
  // Profil-Unterseiten (?s=…) gehen zurück zur Profil-Übersicht
  const back = pathname === "/profile" && search.includes("s=") ? { to: "/profile", label: "Profil" } : nav.back;
  if (!back) return null;

  return (
    <header className="sticky top-0 z-20 bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center py-1.5">
        <button
          type="button"
          onClick={() =>
            back.to ? navigate(back.to, { replace: back.to === "/profile" || back.to === "/plans" }) : navigate(-1)
          }
          className="-ml-1 flex min-w-0 items-center gap-0.5 py-1.5 pr-3 text-base font-semibold text-brand"
        >
          <ChevronLeft size={22} strokeWidth={2.5} className="shrink-0" />
          <span className="truncate">{back.label}</span>
        </button>
      </div>
    </header>
  );
}
