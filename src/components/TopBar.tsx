import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, Sparkles } from "lucide-react";
import { useAiStatus } from "../hooks/useAi";
import { BuddyFace } from "./buddy/BuddyFace";
import { openBuddySheet } from "./buddy/BuddySheet";
import { useBuddy } from "./buddy/useBuddy";

function IconUser({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

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
  if (pathname === "/history") return { title: "Verlauf", back: { to: "/analytics", label: "Fortschritt" } };
  if (pathname === "/social") return { title: "Community" };
  if (pathname === "/feed") return { title: "Aktivitäten", back: { to: "/social", label: "Community" } };
  if (pathname === "/profile") return { title: "Profil", back: { to: "", label: "Zurück" } };
  return { title: "" };
}

export function TopBar() {
  const buddy = useBuddy();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const nav = navInfo(pathname, search);
  // Profil-Unterseiten (?s=…) gehen zurück zur Profil-Übersicht
  const back = pathname === "/profile" && search.includes("s=") ? { to: "/profile", label: "Profil" } : nav.back;
  const { data: ai } = useAiStatus();
  const aiOn = !!ai?.enabled;

  function openBuddy() {
    openBuddySheet();
  }

  return (
    <header className="sticky top-0 z-20 bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center gap-2 py-2.5">
        {/* Links: Bereichstitel bzw. Zurück zur übergeordneten Seite */}
        {back ? (
          <button
            type="button"
            onClick={() =>
              back.to ? navigate(back.to, { replace: back.to === "/profile" || back.to === "/plans" }) : navigate(-1)
            }
            className="-ml-1 flex min-w-0 flex-1 items-center gap-0.5 py-1 text-base font-semibold text-brand"
          >
            <ChevronLeft size={22} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate">{back.label}</span>
          </button>
        ) : (
          // Hauptseiten haben ihre eigene große Überschrift → hier frei lassen
          <div className="flex-1" />
        )}
        {/* Buddy = KI-Coach: öffnet das Buddy-Sheet (Stimmung, Tipps, Chat) */}
        <button
          type="button"
          onClick={openBuddy}
          aria-label={aiOn ? "KI-Coach Buddy fragen" : "Buddy öffnen"}
          title={aiOn ? "Frag Buddy – dein KI-Coach" : buddy.line}
          className={`relative flex shrink-0 items-center gap-1.5 rounded-full transition active:scale-95 ${
            aiOn ? "bg-brand/10 py-0.5 pl-0.5 pr-3 ring-1 ring-brand/25" : "bg-brand/15 ring-2 ring-brand/30"
          }`}
        >
          <BuddyFace size={aiOn ? 32 : 36} mood={buddy.mood} stage={buddy.stage} skin={buddy.skin} />
          {aiOn && (
            <span className="flex items-center gap-1 text-sm font-semibold text-brand">
              <Sparkles size={14} strokeWidth={2.5} />
              Frag Buddy
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate("/profile")}
          aria-label="Profil"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa"
        >
          <IconUser />
        </button>
      </div>
    </header>
  );
}
