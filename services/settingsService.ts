
import { getApiUrl } from '../utils/api';

type Listener = () => void;

class SettingsServiceImpl {
  private listeners: Listener[] = [];
  private _wallpaper = 'carbon';
  private _nodeAlias = 'Pi-Alpha-Node';
  private _torEnabled = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const response = await fetch(getApiUrl('/api/settings'));
      if (response.ok) {
        const data = await response.json();
        this._wallpaper = data.wallpaper;
        this._nodeAlias = data.nodeAlias;
        this._torEnabled = data.torEnabled;
        this.emit();
      }
    } catch (e) {
      console.error("Failed to fetch settings:", e);
    }
  }

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit() { this.listeners.forEach(l => l()); }

  get wallpaper() { return this._wallpaper; }
  async setWallpaper(w: string) { 
    this._wallpaper = w; 
    this.emit(); 
    try {
      await fetch(getApiUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallpaper: w })
      });
    } catch (e) { console.error("Failed to save wallpaper:", e); }
  }

  get nodeAlias() { return this._nodeAlias; }
  async setNodeAlias(a: string) { 
    this._nodeAlias = a; 
    this.emit(); 
    try {
      await fetch(getApiUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeAlias: a })
      });
    } catch (e) { console.error("Failed to save alias:", e); }
  }

  get torEnabled() { return this._torEnabled; }
  async setTorEnabled(e: boolean) { 
    this._torEnabled = e; 
    this.emit(); 
    try {
      await fetch(getApiUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ torEnabled: e })
      });
    } catch (e) { console.error("Failed to save tor setting:", e); }
  }
}

export const settingsService = new SettingsServiceImpl();
