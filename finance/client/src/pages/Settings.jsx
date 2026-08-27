import { Check, Palette } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { SCHOOL } from '../config/school';

export default function Settings() {
  const { themeId, setThemeId, themes } = useTheme();

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="page-title">Settings</h2>
        <p className="muted mt-1">Appearance themes match Uniform Desk and are saved on this device.</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-5 h-5" style={{ color: 'var(--theme-accent)' }} />
          <h3 className="font-semibold">Appearance</h3>
        </div>
        <p className="text-sm muted mb-4">Choose a colour theme for Finance Desk.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {themes.map((t) => {
            const active = themeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={`text-left rounded-2xl border p-4 transition ${active ? 'ring-2' : ''}`}
                style={{
                  borderColor: active ? 'var(--theme-accent)' : 'var(--theme-border)',
                  ringColor: 'var(--theme-accent)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{t.name}</p>
                  {active && <Check className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />}
                </div>
                <p className="text-xs muted mt-1">{t.description}</p>
                <div className="flex gap-2 mt-3">
                  {t.preview.map((c) => (
                    <span key={c} className="w-8 h-8 rounded-full border" style={{ background: c, borderColor: 'var(--theme-border)' }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-2">School</h3>
        <p className="text-sm">{SCHOOL.name}</p>
        <p className="text-sm text-school-red font-semibold">{SCHOOL.motto}</p>
        <p className="text-xs muted mt-1">{SCHOOL.established} · {SCHOOL.deskTitle}</p>
      </div>
    </div>
  );
}
