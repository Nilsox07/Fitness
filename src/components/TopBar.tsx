import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Sparkles, X } from "lucide-react";
import { useAiStatus } from "../hooks/useAi";
import { usePrefs, type World } from "../lib/prefs";
import { BuddyFace } from "./buddy/BuddyFace";
import { openBuddySheet } from "./buddy/BuddySheet";
import { useBuddy } from "./buddy/useBuddy";

function IconDumbbell({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M6.5 8v8M17.5 8v8M4 9.5v5M20 9.5v5M6.5 12h11" />
    </svg>
  );
}
function IconApple({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M12 8c-1.5-2.5-5-2.2-6 0-1.2 2.6.4 8 3 10 1 .8 2 .8 3 0 2.6-2 4.2-7.4 3-10-1-2.2-4.5-2.5-6 0Z" />
      <path d="M12 8V5M12 5c0-1 .8-2 2-2" />
    </svg>
  );
}
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

/** Zielseite beim Welt-Wechsel (jeweils „Heute" der Welt). */
const HOME: Record<World, string> = { fitness: "/", food: "/nutrition" };

const HINT_KEY = "buddy_ai_hint_seen";

function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true;
  }
}

export function TopBar() {
  const { world, setWorld, showNutrition } = usePrefs();
  const buddy = useBuddy();
  const navigate = useNavigate();
  const { data: ai } = useAiStatus();
  const aiOn = !!ai?.enabled;
  const [showHint, setShowHint] = useState(() => !hintSeen());

  function dismissHint() {
    setShowHint(false);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function openBuddy() {
    dismissHint();
    openBuddySheet();
  }

  function switchTo(w: World) {
    if (w !== world) {
      setWorld(w);
      navigate(HOME[w]);
    }
  }

  const tabBase =
    "flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200";

  return (
    <header className="sticky top-0 z-20 bg-bg/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex items-center gap-2 py-2.5">
        {/* Ruhiger Segment-Schalter: aktive Welt = helle Fläche, keine Signalfarbe */}
        {!showNutrition ? (
          <div className="flex flex-1 items-center gap-1.5 px-1 text-base font-bold">
            <IconDumbbell className="h-5 w-5 text-brand" />
            Fitness
          </div>
        ) : (
          <div className="flex flex-1 gap-1 rounded-full bg-sand p-1">
            <button
              type="button"
              onClick={() => switchTo("fitness")}
              aria-pressed={world === "fitness"}
              className={`${tabBase} ${
                world === "fitness"
                  ? "bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark"
                  : "text-cocoa-light"
              }`}
            >
              <IconDumbbell
                className={`h-4 w-4 ${world === "fitness" ? "text-brand" : ""}`}
              />
              Fitness
            </button>
            <button
              type="button"
              onClick={() => switchTo("food")}
              aria-pressed={world === "food"}
              className={`${tabBase} ${
                world === "food"
                  ? "bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark"
                  : "text-cocoa-light"
              }`}
            >
              <IconApple
                className={`h-4 w-4 ${world === "food" ? "text-brand" : ""}`}
              />
              Ernährung
            </button>
          </div>
        )}
        {/* Buddy = KI-Coach: öffnet das Buddy-Sheet (Stimmung, Tipps, Chat) */}
        <button
          type="button"
          onClick={openBuddy}
          aria-label={aiOn ? "KI-Coach Buddy fragen" : "Buddy öffnen"}
          title={aiOn ? "Frag Buddy – dein KI-Coach" : buddy.line}
          className="relative shrink-0 rounded-full bg-brand/15 ring-2 ring-brand/30 transition active:scale-90"
        >
          <BuddyFace size={36} mood={buddy.mood} stage={buddy.stage} skin={buddy.skin} />
          {aiOn && (
            <span className="absolute -bottom-1 -right-1.5 flex items-center gap-px rounded-full bg-brand px-1 py-px text-[9px] font-black leading-none text-on-brand shadow ring-2 ring-bg">
              <Sparkles size={8} strokeWidth={3} />
              KI
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
      {aiOn && showHint && (
        <div className="anim-fade absolute right-14 top-full z-30 w-64">
          <div className="relative rounded-2xl bg-cocoa p-3 pr-8 text-cream shadow-xl">
            <span className="absolute -top-1.5 right-5 h-3 w-3 rotate-45 bg-cocoa" />
            <button
              type="button"
              onClick={openBuddy}
              className="flex items-start gap-2 text-left"
            >
              <MessageCircle size={18} className="mt-0.5 shrink-0 text-brand" />
              <span>
                <span className="block text-sm font-bold">Frag Buddy – deinen KI-Coach</span>
                <span className="block text-xs opacity-80">
                  Fragen zu Training, Essen & Plänen – oder einfach „Was soll ich heute essen?"
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={dismissHint}
              aria-label="Hinweis schließen"
              className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full opacity-70"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
