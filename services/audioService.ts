
class AudioService {
  enabled: boolean;
  volume: number;
  sounds: Record<string, HTMLAudioElement>;

  constructor() {
    this.enabled = localStorage.getItem('soundEnabled') !== 'false';
    this.volume = parseFloat(localStorage.getItem('soundVolume') || '0.5');
    this.sounds = {};
    
    // Pre-initialize sounds logic (lazy load actual Audio to respect autoplay policies)
    this.soundUrls = {
      click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Subtle click
      success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Soft chime
      error: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3', // Soft thud
      open: 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3', // Swoosh
      notification: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', // Bell
    };
  }

  private load(name: string): HTMLAudioElement {
    if (!this.sounds[name]) {
      this.sounds[name] = new Audio(this.soundUrls[name as keyof typeof this.soundUrls]);
    }
    return this.sounds[name];
  }

  play(name: 'click' | 'success' | 'error' | 'open' | 'notification') {
    if (!this.enabled) return;

    try {
      const audio = this.load(name);
      
      // Volume mixing
      let vol = this.volume;
      if (name === 'click') vol = Math.min(vol * 0.4, 1); // Clicks should be quieter
      if (name === 'error') vol = Math.min(vol * 0.6, 1);
      
      audio.volume = vol;
      audio.currentTime = 0;
      audio.play().catch(e => {
        // Autoplay policy might block this, ignore
        console.debug('Audio play blocked', e);
      });
    } catch (e) {
      console.warn('Audio service error', e);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('soundEnabled', String(this.enabled));
    return this.enabled;
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('soundVolume', String(this.volume));
  }
  
  // Helper for SoundService URL mapping
  private soundUrls: Record<string, string>;
}

export const audioService = new AudioService();
