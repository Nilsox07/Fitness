import { useEffect, useState } from 'react'
import { Bell, BellRing, Check, Send } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { enablePush, pushSupported, sendTestPush, setShareCheatEnabled, shareCheatEnabled } from '../../lib/push'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { NOTIFY_GROUPS, NOTIFY_ITEMS, deviceTimeZone, type NotifyKind, type NotifySetting } from '../../lib/notify'
import { Group, Toggle } from './ui'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Ist auf DIESEM Gerät ein Push-Abo aktiv? */
function useDeviceSubscribed(): [boolean | null, () => void] {
  const [state, setState] = useState<boolean | null>(null)
  const check = () => {
    if (!pushSupported || Notification.permission !== 'granted') {
      setState(false)
      return
    }
    navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((s) => setState(!!s))
      .catch(() => setState(false))
  }
  useEffect(check, [])
  return [state, check]
}

/** Profil → Benachrichtigungen: Gerät aktivieren, dann jede Erinnerung einzeln an/aus + Uhrzeit. */
export function NotificationSettings() {
  const { user } = useAuth()
  const { prefs, save } = useUserPrefs()
  const [subscribed, recheck] = useDeviceSubscribed()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [shareCheat, setShareCheat] = useState(shareCheatEnabled)

  // Zeitzone mitschicken, damit der Server die Uhrzeiten richtig umrechnet
  useEffect(() => {
    const tz = deviceTimeZone()
    if (prefs.tz !== tz) void save({ tz })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.tz])

  function update(kind: NotifyKind, patch: Partial<NotifySetting>) {
    void save({ notify: { ...prefs.notify, [kind]: { ...prefs.notify[kind], ...patch } } })
  }

  async function activate() {
    if (!user) return
    setBusy(true)
    setMsg(null)
    try {
      await enablePush(user.id)
      recheck()
      setMsg('Aktiviert – teste es gleich mit „Testen“.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Aktivieren fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setMsg(null)
    try {
      setMsg(await sendTestPush())
    } catch {
      setMsg('Senden fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-cocoa p-4 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-on-brand">
            {subscribed ? <BellRing size={21} /> : <Bell size={21} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{subscribed ? 'Auf diesem Gerät aktiv' : 'Auf diesem Gerät noch aus'}</div>
            <div className="text-xs text-bg/65 dark:text-cocoa-light">
              {subscribed
                ? 'Buddy meldet sich nur, wenn wirklich etwas fehlt.'
                : 'Einmal erlauben – danach wählst du unten, was kommt.'}
            </div>
          </div>
        </div>
        <div className="relative mt-3 flex gap-2">
          {!subscribed && (
            <button className="btn-primary flex-1 gap-1.5" onClick={activate} disabled={busy || !pushSupported}>
              <Bell size={16} /> Aktivieren
            </button>
          )}
          {subscribed && (
            <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-success/20 py-2.5 text-sm font-semibold text-success">
              <Check size={16} /> Aktiv
            </span>
          )}
          <button
            className="btn flex-1 gap-1.5 bg-bg/10 text-bg dark:bg-white/5 dark:text-cocoa"
            onClick={test}
            disabled={busy}
          >
            <Send size={15} /> Testen
          </button>
        </div>
        {msg && <p className="relative mt-2 text-xs text-bg/75 dark:text-cocoa-light">{msg}</p>}
        {!pushSupported && (
          <p className="relative mt-2 text-xs text-bg/75 dark:text-cocoa-light">
            {isIos && !standalone
              ? 'Auf dem iPhone gehen Benachrichtigungen nur, wenn die App zum Home-Bildschirm hinzugefügt ist (Teilen → „Zum Home-Bildschirm“).'
              : 'Dieser Browser unterstützt keine Push-Benachrichtigungen.'}
          </p>
        )}
      </section>

      {NOTIFY_GROUPS.map((g) => (
        <Group
          key={g}
          title={g}
          footer={g === 'Community' ? 'Eigene Cheat-Meals teilst du nur, wenn der zweite Schalter an ist.' : undefined}
        >
          {NOTIFY_ITEMS.filter((i) => i.group === g).map((item) => {
            const s = prefs.notify[item.kind]
            return (
              <div key={item.kind} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold">{item.label}</div>
                    <div className="text-xs leading-snug text-cocoa-light">{item.hint}</div>
                  </div>
                  {s.on && s.time && (
                    <input
                      type="time"
                      step={300}
                      aria-label={`Uhrzeit ${item.label}`}
                      className="tabular w-[4.75rem] rounded-xl bg-sand px-2 py-1.5 text-center text-sm font-semibold outline-none focus:ring-2 focus:ring-ruby [&::-webkit-calendar-picker-indicator]:hidden"
                      value={s.time}
                      onChange={(e) => e.target.value && update(item.kind, { time: e.target.value })}
                    />
                  )}
                  <Toggle checked={s.on} onChange={(on) => update(item.kind, { on })} label={item.label} />
                </div>
                {s.on && s.days && (
                  <div className="mt-2.5 flex gap-1.5" role="group" aria-label={`Tage ${item.label}`}>
                    {WEEKDAYS.map((d, i) => {
                      const on = s.days!.includes(i)
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            const days = on ? s.days!.filter((x) => x !== i) : [...s.days!, i]
                            if (days.length) update(item.kind, { days: days.sort() })
                          }}
                          className={`h-8 flex-1 rounded-full text-xs font-semibold transition ${
                            on ? 'bg-brand text-on-brand' : 'bg-sand text-cocoa-light'
                          }`}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          {g === 'Community' && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">Meine Cheat-Meals teilen</div>
                <div className="text-xs leading-snug text-cocoa-light">Freunde bekommen dann einen Cheat-Alarm</div>
              </div>
              <Toggle
                checked={shareCheat}
                onChange={(on) => {
                  setShareCheat(on)
                  setShareCheatEnabled(on)
                }}
                label="Meine Cheat-Meals teilen"
              />
            </div>
          )}
        </Group>
      ))}

      <p className="px-1 text-xs leading-relaxed text-cocoa-muted">
        Jede Erinnerung kommt höchstens einmal am Tag – und nur, wenn noch etwas fehlt. Die Uhrzeiten gelten in deiner
        Zeitzone ({prefs.tz ?? deviceTimeZone()}).
      </p>
    </div>
  )
}
