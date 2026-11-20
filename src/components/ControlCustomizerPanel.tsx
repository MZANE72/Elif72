import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Keyboard,
  Move,
  RotateCcw,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import {
  CONTROL_PRESETS,
  PSP_BUTTON_META,
  TOUCH_ACCENT_STYLES,
  formatKeyCode,
} from '../data/presets';
import {
  ButtonAccentColor,
  ControlProfile,
  FootballActionId,
  PspButtonId,
  ThroughFnMode,
  TouchActionId,
} from '../types/emulator';

interface ControlCustomizerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ControlProfile;
  onChangeProfile: (next: ControlProfile) => void;
  isEditingLayout: boolean;
  onToggleEditLayout: () => void;
  selectedTouchButton: TouchActionId;
  onSelectTouchButton: (id: TouchActionId) => void;
}

type KeyTarget = keyof ControlProfile['keyboard'];

const ACTION_ROWS: Array<{
  id: FootballActionId;
  title: string;
  subtitle: string;
  accent: string;
  hasPspMap: boolean;
}> = [
  {
    id: 'SHOOT',
    title: 'Şut (Özel Atama)',
    subtitle: 'Basılı tut: Güç barı · Defans: Kayarak müdahale',
    accent: 'text-rose-300',
    hasPspMap: true,
  },
  {
    id: 'PASS',
    title: 'Pas',
    subtitle: 'Kısa pas · Defans: Oyuncu değiştir',
    accent: 'text-emerald-300',
    hasPspMap: true,
  },
  {
    id: 'CROSS_BALL',
    title: 'Orta Açma',
    subtitle: 'Havadan orta & uzun pas · Defans: Uzaklaştırma',
    accent: 'text-amber-300',
    hasPspMap: true,
  },
  {
    id: 'THROUGH_FN',
    title: 'Ara Pas / Fonksiyon (FN)',
    subtitle: 'Tek basış: Ara pas · Basılı tut: FN kombo tuşu',
    accent: 'text-cyan-300',
    hasPspMap: true,
  },
  {
    id: 'SPRINT',
    title: 'Depar (Sprint)',
    subtitle: 'Hızlı koşu · Dayanıklılık harcar',
    accent: 'text-indigo-300',
    hasPspMap: true,
  },
  {
    id: 'PAUSE',
    title: 'Duraklat',
    subtitle: 'Maçı duraklatma / menü tuşu',
    accent: 'text-slate-300',
    hasPspMap: false,
  },
];

const PSP_ASSIGNABLE_BUTTONS: PspButtonId[] = [
  'SQUARE',
  'CROSS',
  'CIRCLE',
  'TRIANGLE',
  'L',
  'R',
];

const TOUCH_CUSTOMIZE_IDS: Array<{ id: TouchActionId; name: string }> = [
  { id: 'SHOOT', name: 'Şut' },
  { id: 'PASS', name: 'Pas' },
  { id: 'CROSS_BALL', name: 'Orta Açma' },
  { id: 'THROUGH_FN', name: 'Ara Pas / FN' },
  { id: 'SPRINT', name: 'Depar' },
];

export const ControlCustomizerPanel: React.FC<ControlCustomizerPanelProps> = ({
  isOpen,
  onClose,
  profile,
  onChangeProfile,
  isEditingLayout,
  onToggleEditLayout,
  selectedTouchButton,
  onSelectTouchButton,
}) => {
  const [activeTab, setActiveTab] = useState<'KEYS' | 'BUTTONS'>('KEYS');
  const [listeningKey, setListeningKey] = useState<KeyTarget | null>(null);

  useEffect(() => {
    if (!listeningKey) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const nextCode = e.code;
      const updatedKeyboard = { ...profile.keyboard };

      // Swap if already assigned to another action
      (Object.keys(updatedKeyboard) as KeyTarget[]).forEach((k) => {
        if (updatedKeyboard[k] === nextCode && k !== listeningKey) {
          updatedKeyboard[k] = updatedKeyboard[listeningKey];
        }
      });

      updatedKeyboard[listeningKey] = nextCode;
      onChangeProfile({
        ...profile,
        presetId: 'custom',
        keyboard: updatedKeyboard,
      });
      setListeningKey(null);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [listeningKey, profile, onChangeProfile]);

  if (!isOpen) return null;

  const selectedCfg = profile.touchButtons[selectedTouchButton];

  const updateTouchButton = (
    patch: Partial<ControlProfile['touchButtons'][TouchActionId]>
  ) => {
    onChangeProfile({
      ...profile,
      touchButtons: {
        ...profile.touchButtons,
        [selectedTouchButton]: {
          ...selectedCfg,
          ...patch,
        },
      },
    });
  };

  const handlePspMapChange = (
    action: Exclude<FootballActionId, 'PAUSE'>,
    pspBtn: PspButtonId
  ) => {
    const nextMap = { ...profile.pspMap };
    const prevBtn = nextMap[action];
    (Object.keys(nextMap) as Array<Exclude<FootballActionId, 'PAUSE'>>).forEach((k) => {
      if (nextMap[k] === pspBtn && k !== action) {
        nextMap[k] = prevBtn;
      }
    });
    nextMap[action] = pspBtn;
    onChangeProfile({ ...profile, presetId: 'custom', pspMap: nextMap });
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-800 bg-[#10141E] text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-wide text-white">
            KONTROL & BUTON ÖZELLEŞTİRME
          </h2>
          <p className="text-xs text-slate-400">
            Şut, Pas, Orta Açma ve Ara Pas (FN) ayrı ayrı ayarlanır
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-700 bg-slate-800/70 p-2 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
          aria-label="Paneli kapat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="grid grid-cols-2 gap-1 border-b border-slate-800 bg-slate-900/60 p-2">
        <button
          type="button"
          onClick={() => setActiveTab('KEYS')}
          className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'KEYS'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Keyboard className="h-3.5 w-3.5" />
          Tuş & FN Ataması
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('BUTTONS')}
          className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'BUTTONS'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Dokunmatik Butonlar
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {activeTab === 'KEYS' ? (
          <>
            {/* Quick Presets */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-300">
                Hazır Kontrol Profilleri
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'efootball_modern', label: 'eFootball (WASD)' },
                  { id: 'pes_arrows', label: 'PES (Ok Tuşları)' },
                  { id: 'fn_shoulder', label: 'Q · FN Tetik' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      const base = CONTROL_PRESETS[preset.id];
                      onChangeProfile({
                        ...structuredClone(base),
                        touchButtons: profile.touchButtons,
                        touchOverlayEnabled: profile.touchOverlayEnabled,
                      });
                    }}
                    className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                      profile.presetId === preset.id
                        ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Through Ball / Function Key Behavior */}
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Ara Pas · Fonksiyon Tuşu (FN) Davranışı
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {(
                  [
                    {
                      mode: 'HYBRID',
                      label: 'Hibrit (Önerilen): Tek Basış Ara Pas + Basılı Tutunca FN',
                    },
                    {
                      mode: 'MODIFIER_ONLY',
                      label: 'Sadece Fonksiyon Tuşu (FN + Pas / Orta / Şut)',
                    },
                    {
                      mode: 'DIRECT_ONLY',
                      label: 'Sadece Doğrudan Ara Pas Tuşu',
                    },
                  ] as Array<{ mode: ThroughFnMode; label: string }>
                ).map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() =>
                      onChangeProfile({ ...profile, throughFnMode: item.mode })
                    }
                    className={`rounded-md border px-3 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                      profile.throughFnMode === item.mode
                        ? 'border-cyan-400 bg-cyan-500/20 font-semibold text-white'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {profile.throughFnMode !== 'DIRECT_ONLY' && (
                <p className="text-[11px] leading-relaxed text-cyan-200/80">
                  FN Komboları: <strong className="text-white">FN + Pas</strong> = Keskin Ara
                  Pas · <strong className="text-white">FN + Orta</strong> = Havadan Ara Pas ·{' '}
                  <strong className="text-white">FN + Şut</strong> = Plase Falso Şut
                </p>
              )}
            </div>

            {/* Action Key Bindings */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300">
                Futbol Aksiyon Tuşları
              </p>
              {ACTION_ROWS.map((row) => {
                const keyTarget = row.id as KeyTarget;
                const isListening = listeningKey === keyTarget;
                const currentKey = profile.keyboard[keyTarget];
                const currentPsp =
                  row.hasPspMap
                    ? profile.pspMap[row.id as Exclude<FootballActionId, 'PAUSE'>]
                    : null;

                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3"
                  >
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${row.accent}`}>{row.title}</p>
                      <p className="truncate text-[11px] text-slate-400">{row.subtitle}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {row.hasPspMap && currentPsp && (
                        <select
                          value={currentPsp}
                          onChange={(e) =>
                            handlePspMapChange(
                              row.id as Exclude<FootballActionId, 'PAUSE'>,
                              e.target.value as PspButtonId
                            )
                          }
                          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-pointer"
                          aria-label={`${row.title} PSP butonu`}
                        >
                          {PSP_ASSIGNABLE_BUTTONS.map((btn) => (
                            <option key={btn} value={btn}>
                              PSP {PSP_BUTTON_META[btn].symbol}
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => setListeningKey(isListening ? null : keyTarget)}
                        className={`min-w-[74px] rounded-md border px-2.5 py-1.5 font-mono text-xs font-bold transition-colors cursor-pointer ${
                          isListening
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200 animate-pulse'
                            : 'border-slate-700 bg-slate-800 text-white hover:border-slate-500'
                        }`}
                      >
                        {isListening ? 'TUŞA BAS' : formatKeyCode(currentKey)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Movement Keys */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300">Yön Tuşları</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['UP', 'Yukarı'],
                    ['DOWN', 'Aşağı'],
                    ['LEFT', 'Sol'],
                    ['RIGHT', 'Sağ'],
                  ] as Array<[KeyTarget, string]>
                ).map(([dir, label]) => {
                  const isListening = listeningKey === dir;
                  return (
                    <div
                      key={dir}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2"
                    >
                      <span className="text-xs text-slate-300">{label}</span>
                      <button
                        type="button"
                        onClick={() => setListeningKey(isListening ? null : dir)}
                        className={`min-w-[60px] rounded border px-2 py-1 font-mono text-xs font-bold cursor-pointer ${
                          isListening
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border-slate-700 bg-slate-800 text-white hover:border-slate-500'
                        }`}
                      >
                        {isListening ? '...' : formatKeyCode(profile.keyboard[dir])}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Touch Overlay Master Toggle & Drag Mode */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
              <div>
                <p className="text-xs font-bold text-white">Ekran Üstü Sanal Butonlar</p>
                <p className="text-[11px] text-slate-400">
                  Şut, Pas, Orta ve FN butonlarını ayrı ayrı özelleştir
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onChangeProfile({
                    ...profile,
                    touchOverlayEnabled: !profile.touchOverlayEnabled,
                  })
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  profile.touchOverlayEnabled
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {profile.touchOverlayEnabled ? 'Açık' : 'Kapalı'}
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleEditLayout}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                isEditingLayout
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
              }`}
            >
              <Move className="h-4 w-4" />
              {isEditingLayout
                ? 'Sürükle & Bırak Düzenlemeyi Bitir'
                : 'Ekranda Sürükle & Bırak Konumlandır'}
            </button>

            {/* Individual Button Selector */}
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-300">
                Düzenlenecek Butonu Seç
              </p>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {TOUCH_CUSTOMIZE_IDS.map((item) => {
                  const active = selectedTouchButton === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectTouchButton(item.id)}
                      className={`rounded-md border px-2 py-2 text-center text-[11px] font-bold transition-colors cursor-pointer ${
                        active
                          ? 'border-white bg-slate-800 text-white'
                          : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Individual Button Properties */}
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/75 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  {
                    TOUCH_CUSTOMIZE_IDS.find((b) => b.id === selectedTouchButton)
                      ?.name
                  }{' '}
                  Butonu Ayarları
                </span>
                <button
                  type="button"
                  onClick={() => updateTouchButton({ visible: !selectedCfg.visible })}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  {selectedCfg.visible ? (
                    <>
                      <Eye className="h-3.5 w-3.5 text-emerald-400" /> Görünür
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5 text-slate-400" /> Gizli
                    </>
                  )}
                </button>
              </div>

              {/* Label */}
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Buton Etiketi
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={selectedCfg.label}
                  onChange={(e) => updateTouchButton({ label: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {/* Size Slider */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Boyut</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    %{Math.round(selectedCfg.size * 100)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.5}
                  step={0.05}
                  value={selectedCfg.size}
                  onChange={(e) =>
                    updateTouchButton({ size: parseFloat(e.target.value) })
                  }
                  className="mt-1 w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              {/* Opacity Slider */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Şeffaflık</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    %{Math.round(selectedCfg.opacity * 100)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={1.0}
                  step={0.05}
                  value={selectedCfg.opacity}
                  onChange={(e) =>
                    updateTouchButton({ opacity: parseFloat(e.target.value) })
                  }
                  className="mt-1 w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              {/* X / Y Fine Position */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Yatay (X)</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {Math.round(selectedCfg.x)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={92}
                    step={1}
                    value={selectedCfg.x}
                    onChange={(e) =>
                      updateTouchButton({ x: parseFloat(e.target.value) })
                    }
                    className="mt-1 w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Dikey (Y)</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {Math.round(selectedCfg.y)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={88}
                    step={1}
                    value={selectedCfg.y}
                    onChange={(e) =>
                      updateTouchButton({ y: parseFloat(e.target.value) })
                    }
                    className="mt-1 w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Color Swatches */}
              <div>
                <p className="mb-2 text-xs font-medium text-slate-300">Buton Rengi</p>
                <div className="flex items-center gap-2">
                  {(Object.keys(TOUCH_ACCENT_STYLES) as ButtonAccentColor[]).map(
                    (col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => updateTouchButton({ color: col })}
                        title={TOUCH_ACCENT_STYLES[col].name}
                        className={`h-7 w-7 rounded-full border-2 transition-transform cursor-pointer ${
                          TOUCH_ACCENT_STYLES[col].swatch
                        } ${
                          selectedCfg.color === col
                            ? 'scale-110 border-white ring-2 ring-white/40'
                            : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                        aria-label={TOUCH_ACCENT_STYLES[col].name}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/70 px-5 py-3">
        <button
          type="button"
          onClick={() => onChangeProfile(structuredClone(CONTROL_PRESETS.efootball_modern))}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Varsayılana Sıfırla
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
        >
          Tamam
        </button>
      </div>
    </aside>
  );
};
