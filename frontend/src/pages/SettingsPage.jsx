import { useEffect, useState } from 'react';
import { Palette, Bell, Bot, Save, CheckCircle2, PlugZap, XCircle, Loader2 } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { api } from '../lib/api';

const PROVIDER_DEFAULTS = {
  ollama: { base_url: 'http://localhost:11434', model: 'llama3' },
  openai: { base_url: 'https://api.openai.com', model: 'gpt-4o-mini' },
  anthropic: { base_url: '', model: 'claude-sonnet-4-6' },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    api.getSettings().then((res) => {
      // Self-heal a config saved before this fix existed: provider switched
      // to openai/anthropic but base_url was left pointing at Ollama's
      // localhost address, so every request silently failed.
      if (res.ai_provider !== 'ollama' && res.ai_base_url === PROVIDER_DEFAULTS.ollama.base_url) {
        res.ai_base_url = PROVIDER_DEFAULTS[res.ai_provider]?.base_url ?? res.ai_base_url;
      }
      setSettings(res);
    });
  }, []);

  const update = (patch) => { setSettings((prev) => ({ ...prev, ...patch })); setTestResult(null); };

  // Switching providers must not silently leave the *previous* provider's
  // base_url/model behind - that's exactly what caused OpenAI requests to
  // still be sent to Ollama's localhost:11434. Only auto-replace a field
  // if it still matches the OLD provider's default (so a custom URL/model
  // the user deliberately typed is never clobbered).
  const changeProvider = (newProvider) => {
    const oldDefaults = PROVIDER_DEFAULTS[settings.ai_provider] || {};
    const newDefaults = PROVIDER_DEFAULTS[newProvider] || {};
    const patch = { ai_provider: newProvider };
    if (!settings.ai_base_url || settings.ai_base_url === oldDefaults.base_url) {
      patch.ai_base_url = newDefaults.base_url;
    }
    if (!settings.ai_model || settings.ai_model === oldDefaults.model) {
      patch.ai_model = newDefaults.model;
    }
    update(patch);
  };

  const save = async () => {
    const payload = { ...settings };
    if (apiKeyInput) payload.ai_api_key = apiKeyInput;
    delete payload.ai_api_key_set;
    const res = await api.updateSettings(payload);
    setSettings(res);
    setApiKeyInput('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first so the test checks the settings currently on screen, not stale ones.
      const payload = { ...settings };
      if (apiKeyInput) payload.ai_api_key = apiKeyInput;
      delete payload.ai_api_key_set;
      const updated = await api.updateSettings(payload);
      setSettings(updated);
      setApiKeyInput('');
      const res = await api.aiStatus();
      setTestResult(res);
    } catch (e) {
      setTestResult({ available: false, message: e.message });
    } finally {
      setTesting(false);
    }
  };

  if (!settings) return <div className="text-[#5C6A85] font-mono text-sm">Loading settings…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <GlassCard title="Appearance" icon={Palette} accent="purple">
        <div className="space-y-4">
          <div>
            <label className="font-mono text-xs text-[#7C8AA6] mb-1 block">Theme</label>
            <select className="input-cyber" value={settings.theme} onChange={(e) => update({ theme: e.target.value })}>
              <option>Light</option><option>Dark</option><option>Cyber</option>
            </select>
          </div>
          <div>
            <label className="font-mono text-xs text-[#7C8AA6] mb-1 block">Export Location</label>
            <input className="input-cyber font-mono text-xs" placeholder="C:\Users\you\Documents\WinSecReports"
              value={settings.export_location} onChange={(e) => update({ export_location: e.target.value })} />
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Behavior" icon={Bell} accent="blue">
        <div className="space-y-3">
          <Toggle label="Enable Notifications" desc="Popups for critical findings (firewall/Defender disabled, weak policy, etc.)"
            checked={settings.notifications_enabled} onChange={(v) => update({ notifications_enabled: v })} />
          <Toggle label="Automatic Scans" desc="Periodically run a quick scan in the background"
            checked={settings.automatic_scans} onChange={(v) => update({ automatic_scans: v })} />
        </div>
      </GlassCard>

      <GlassCard title="AI Assistant Configuration" icon={Bot} accent="green" className="lg:col-span-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-mono text-xs text-[#7C8AA6] mb-1 block">Provider</label>
            <select className="input-cyber" value={settings.ai_provider} onChange={(e) => changeProvider(e.target.value)}>
              <option value="ollama">Ollama (local, free)</option>
              <option value="openai">OpenAI-compatible endpoint</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>
          </div>
          <div>
            <label className="font-mono text-xs text-[#7C8AA6] mb-1 block">Model</label>
            <input className="input-cyber font-mono text-xs" value={settings.ai_model} onChange={(e) => update({ ai_model: e.target.value })} />
          </div>
          {settings.ai_provider !== 'anthropic' && (
            <div className="sm:col-span-2">
              <label className="font-mono text-xs text-[#7C8AA6] mb-1 block">
                Base URL {settings.ai_provider === 'openai' && <span className="text-[#5C6A85] normal-case">(only change this if you're using a proxy - otherwise leave as-is)</span>}
              </label>
              <input className="input-cyber font-mono text-xs" value={settings.ai_base_url} onChange={(e) => update({ ai_base_url: e.target.value })} />
            </div>
          )}
          {settings.ai_provider !== 'ollama' && (
            <div className="sm:col-span-2">
              <label className="font-mono text-xs text-[#7C8AA6] mb-1 block">
                API Key {settings.ai_api_key_set && <span className="text-glow-green">(currently set)</span>}
              </label>
              <input type="password" className="input-cyber font-mono text-xs" placeholder={settings.ai_api_key_set ? '••••••••••••••••' : 'Enter your own API key'}
                value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} />
              <p className="text-[10px] font-mono text-[#5C6A85] mt-1">Your key stays local in this app's SQLite database - it's never sent anywhere except your chosen provider.</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
          <button onClick={testConnection} disabled={testing} className="btn-ghost flex items-center gap-2">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
            Test Connection
          </button>
          {testResult && (
            <span className={`flex items-center gap-1.5 font-mono text-xs ${testResult.available ? 'text-glow-green' : 'text-glow-red'}`}>
              {testResult.available ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {testResult.message}
            </span>
          )}
        </div>
      </GlassCard>

      <div className="lg:col-span-2 flex items-center gap-3">
        <button onClick={save} className="btn-neon flex items-center gap-2"><Save size={15} /> Save Settings</button>
        {saved && <span className="flex items-center gap-1.5 font-mono text-xs text-glow-green"><CheckCircle2 size={14} /> Saved</span>}
      </div>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10 cursor-pointer">
      <div className="flex-1">
        <div className="font-mono text-sm text-white">{label}</div>
        <div className="font-mono text-[11px] text-[#5C6A85]">{desc}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#00FF88] mt-1" />
    </label>
  );
}
