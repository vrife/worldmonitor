import type { CorrelationSignal } from '@/services/correlation';
import type { UnifiedAlert } from '@/services/cross-module-integration';
import { suppressTrendingTerm } from '@/services/trending-keywords';
import { escapeHtml } from '@/utils/sanitize';
import { getCSSColor } from '@/utils';
import { getSignalContext, type SignalType } from '@/utils/analysis-constants';
import { t } from '@/services/i18n';

export class SignalModal {
  private element: HTMLElement;
  private currentSignals: CorrelationSignal[] = [];
  private audioEnabled = true;
  private audio: HTMLAudioElement | null = null;
  private onLocationClick?: (lat: number, lon: number) => void;
  private escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') this.hide(); };
  private inactivityTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly INACTIVITY_MS = 5 * 60 * 1000;
  private inactivityBound = () => this.resetInactivityTimer();
  private inactivityWatchStarted = false;
  private isStartupVisible = false;
  private pendingSignals: CorrelationSignal[] | null = null;
  private pendingAlert: UnifiedAlert | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'signal-modal-overlay';
    this.element.innerHTML = `
      <div class="signal-modal">
        <div class="signal-modal-header">
          <span class="signal-modal-title">🎯 ${t('modals.signal.title')}</span>
          <button class="signal-modal-close">×</button>
        </div>
        <div class="signal-modal-content"></div>
        <div class="signal-modal-footer">
          <label class="signal-audio-toggle">
            <input type="checkbox" checked>
            <span>${t('modals.signal.soundAlerts')}</span>
          </label>
          <button class="signal-dismiss-btn">${t('modals.signal.dismiss')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.element);
    this.setupEventListeners();
    this.initAudio();

    // Remove will-change after entrance animation to free GPU memory
    const modal = this.element.querySelector('.signal-modal') as HTMLElement | null;
    modal?.addEventListener('animationend', () => {
      modal.style.willChange = 'auto';
    }, { once: true });
  }

  private initAudio(): void {
    this.audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQYjfKapmWswEjCJvuPQfSoXZZ+3qqBJESSP0unGaxMJVYiytrFeLhR6p8znrFUXRW+bs7V3Qx1hn8Xjp1cYPnegprhkMCFmoLi1k0sZTYGlqqlUIA==');
    this.audio.volume = 0.3;
  }

  private setupEventListeners(): void {
    this.element.querySelector('.signal-modal-close')?.addEventListener('click', () => {
      this.hide();
    });

    this.element.querySelector('.signal-dismiss-btn')?.addEventListener('click', () => {
      this.hide();
    });

    this.element.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('signal-modal-overlay')) {
        this.hide();
      }
    });

    const checkbox = this.element.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox?.addEventListener('change', () => {
      this.audioEnabled = checkbox.checked;
    });

    // Delegate click handler for location links
    this.element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('location-link')) {
        const lat = parseFloat(target.dataset.lat || '0');
        const lon = parseFloat(target.dataset.lon || '0');
        if (this.onLocationClick && !isNaN(lat) && !isNaN(lon)) {
          this.onLocationClick(lat, lon);
          this.hide();
        }
        return;
      }

      if (target.classList.contains('suppress-keyword-btn')) {
        const term = (target.dataset.term || '').trim();
        if (!term) return;
        suppressTrendingTerm(term);
        this.currentSignals = this.currentSignals.filter(signal => {
          const signalTerm = (signal.data as Record<string, unknown>).term;
          return typeof signalTerm !== 'string' || signalTerm.toLowerCase() !== term.toLowerCase();
        });
        this.renderSignals();
      }
    });
  }

  public setLocationClickHandler(handler: (lat: number, lon: number) => void): void {
    this.onLocationClick = handler;
  }

  private activateEsc(): void {
    document.addEventListener('keydown', this.escHandler);
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimeout) clearTimeout(this.inactivityTimeout);
    this.inactivityTimeout = setTimeout(() => this.showStartupMessage(), this.INACTIVITY_MS);
  }

  private startInactivityWatch(): void {
    if (this.inactivityWatchStarted) return;
    this.inactivityWatchStarted = true;
    ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(event => {
      document.addEventListener(event, this.inactivityBound, { passive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.resetInactivityTimer();
    });
    this.resetInactivityTimer();
  }

  public showStartupMessage(): void {
    const titleEl = this.element.querySelector('.signal-modal-title') as HTMLElement | null;
    if (titleEl) titleEl.textContent = 'WE WANT TO KEEP THIS SERVICE FREE!';

    const content = this.element.querySelector('.signal-modal-content')!;
    content.innerHTML = `
      <div class="signal-item" style="border-left-color: #21a2d6">
        <div class="signal-description" style="line-height: 1.6; margin-bottom: 16px">
          Ever since our meteroric rise on Twitter, TikTok, Instagram, Linkedin, and Facebook,
          and especially in light of recent events, following February 28th, our
          resources and usage have been burning red-hot!<br><br>
          Help us by donating, or check out our premium geopolitical visual at geo-djinn.com
        </div>
        <div class="signal-actions" style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center">
          <a href="https://buymeacoffee.com/djinnai" target="_blank" rel="noopener noreferrer">
            <button class="startup-djinn-btn startup-donate-btn" type="button">
              <span class="startup-btn-top"></span>
              <span class="startup-btn-right"></span>
              <span class="startup-btn-bottom"></span>
              <span class="startup-btn-left"></span>
              <span class="startup-btn-text">DONATIONS🙂</span>
            </button>
          </a>
          <a href="https://www.geo-djinn.com" target="_blank" rel="noopener noreferrer">
            <button class="startup-djinn-btn startup-subscribe-btn" type="button">
              <span class="startup-btn-top"></span>
              <span class="startup-btn-right"></span>
              <span class="startup-btn-bottom"></span>
              <span class="startup-btn-left"></span>
              <span class="startup-btn-text">GEO-DJINN🌍</span>
            </button>
          </a>
          <div style="display: flex; gap: 6px; align-items: center; margin-left: auto">
            <a href="https://www.djinnai.co" target="_blank" rel="noopener noreferrer" class="startup-social-btn startup-social-djinn" aria-label="Djinn AI">
              <img src="/favico/favicon.ico" width="16" height="16" alt="" style="display:block"/>
            </a>
            <a href="https://www.instagram.com/djinnai.co/" target="_blank" rel="noopener noreferrer" class="startup-social-btn startup-social-instagram" aria-label="Instagram">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 1.441c2.136 0 2.389.009 3.233.047 2.17.099 3.181 1.128 3.28 3.28.038.844.047 1.097.047 3.232s-.009 2.389-.047 3.232c-.1 2.15-1.109 3.181-3.28 3.28-.844.038-1.095.047-3.233.047-2.136 0-2.389-.009-3.232-.047-2.174-.1-3.181-1.132-3.28-3.28C1.449 10.389 1.44 10.136 1.44 8s.009-2.388.047-3.232c.1-2.15 1.108-3.181 3.28-3.28C5.611 1.45 5.864 1.441 8 1.441zM8 0C5.827 0 5.555.01 4.702.048 1.968.172.173 1.966.048 4.7.01 5.555 0 5.827 0 8s.01 2.445.048 3.298c.125 2.732 1.917 4.527 4.653 4.653C5.555 15.99 5.827 16 8 16s2.445-.01 3.298-.048c2.732-.125 4.528-1.918 4.653-4.653C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.298c-.124-2.732-1.917-4.528-4.652-4.653C10.445.01 10.173 0 8 0zm0 3.892a4.108 4.108 0 1 0 0 8.216 4.108 4.108 0 0 0 0-8.216zm0 6.775a2.667 2.667 0 1 1 0-5.334 2.667 2.667 0 0 1 0 5.334zm5.23-6.937a.96.96 0 1 0-1.92 0 .96.96 0 0 0 1.92 0z"/></svg>
            </a>
            <a href="https://www.linkedin.com/company/djinn-ai/" target="_blank" rel="noopener noreferrer" class="startup-social-btn startup-social-linkedin" aria-label="LinkedIn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z"/></svg>
            </a>
            <a href="https://x.com/vladrife" target="_blank" rel="noopener noreferrer" class="startup-social-btn startup-social-twitter" aria-label="Twitter / X">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/></svg>
            </a>
          </div>
        </div>
      </div>
    `;

    this.isStartupVisible = true;
    this.element.classList.add('active', 'startup-active');
    this.activateEsc();
    this.startInactivityWatch();
  }

  public show(signals: CorrelationSignal[]): void {
    if (signals.length === 0) return;
    if (document.fullscreenElement) return;

    if (this.isStartupVisible) {
      this.pendingSignals = [...signals, ...(this.pendingSignals ?? [])].slice(0, 50);
      return;
    }

    this.element.classList.remove('startup-active');
    const titleEl = this.element.querySelector('.signal-modal-title') as HTMLElement | null;
    if (titleEl) titleEl.textContent = `🎯 ${t('modals.signal.title')}`;
    this.currentSignals = [...signals, ...this.currentSignals].slice(0, 50);
    this.renderSignals();
    this.element.classList.add('active');
    this.activateEsc();
    this.playSound();
  }

  public showSignal(signal: CorrelationSignal): void {
    if (this.isStartupVisible) {
      this.pendingSignals = [signal];
      return;
    }

    this.element.classList.remove('startup-active');
    const titleEl = this.element.querySelector('.signal-modal-title') as HTMLElement | null;
    if (titleEl) titleEl.textContent = `🎯 ${t('modals.signal.title')}`;
    this.currentSignals = [signal];
    this.renderSignals();
    this.element.classList.add('active');
    this.activateEsc();
  }

  public showAlert(alert: UnifiedAlert): void {
    if (document.fullscreenElement) return;

    if (this.isStartupVisible) {
      this.pendingAlert = alert;
      return;
    }

    const content = this.element.querySelector('.signal-modal-content')!;
    const priorityColors: Record<string, string> = {
      critical: getCSSColor('--semantic-critical'),
      high: getCSSColor('--semantic-high'),
      medium: getCSSColor('--semantic-low'),
      low: getCSSColor('--text-dim'),
    };
    const typeIcons: Record<string, string> = {
      cii_spike: '📊',
      convergence: '🌍',
      cascade: '⚡',
      composite: '🔗',
    };

    const icon = typeIcons[alert.type] || '⚠️';
    const color = priorityColors[alert.priority] || '#ff9944';

    let detailsHtml = '';

    // CII Change details
    if (alert.components.ciiChange) {
      const cii = alert.components.ciiChange;
      const changeSign = cii.change > 0 ? '+' : '';
      detailsHtml += `
        <div class="signal-context-item">
          <span class="context-label">${t('modals.signal.country')}</span>
          <span class="context-value">${escapeHtml(cii.countryName)}</span>
        </div>
        <div class="signal-context-item">
          <span class="context-label">${t('modals.signal.scoreChange')}</span>
          <span class="context-value">${cii.previousScore} → ${cii.currentScore} (${changeSign}${cii.change})</span>
        </div>
        <div class="signal-context-item">
          <span class="context-label">${t('modals.signal.instabilityLevel')}</span>
          <span class="context-value" style="text-transform: uppercase; color: ${color}">${cii.level}</span>
        </div>
        <div class="signal-context-item">
          <span class="context-label">${t('modals.signal.primaryDriver')}</span>
          <span class="context-value">${escapeHtml(cii.driver)}</span>
        </div>
      `;
    }

    // Convergence details
    if (alert.components.convergence) {
      const conv = alert.components.convergence;
      detailsHtml += `
        <div class="signal-context-item">
          <span class="context-label">${t('modals.signal.location')}</span>
          <button class="location-link" data-lat="${conv.lat}" data-lon="${conv.lon}">${conv.lat.toFixed(2)}°, ${conv.lon.toFixed(2)}° ↗</button>
        </div>
        <div class="signal-context-item">
          <span class="context-label">${t('modals.signal.eventTypes')}</span>
          <span class="context-value">${conv.types.join(', ')}</span>
        </div>
        <div class="signal-context-item">
          <span class="context-label">${t('modals.signal.eventCount')}</span>
          <span class="context-value">${t('modals.signal.eventCountValue', { count: conv.totalEvents })}</span>
        </div>
      `;
    }

    // Cascade details
    if (alert.components.cascade) {
      const cascade = alert.components.cascade;
      detailsHtml += `
        <div class="signal-context-item">
          <span class="context-label">${t('modals.signal.source')}</span>
          <span class="context-value">${escapeHtml(cascade.sourceName)} (${cascade.sourceType})</span>
        </div>
        <div class="signal-context-item">
          <span class="context-label">${t('modals.signal.countriesAffected')}</span>
          <span class="context-value">${cascade.countriesAffected}</span>
        </div>
        <div class="signal-context-item">
          <span class="context-label">${t('modals.signal.impactLevel')}</span>
          <span class="context-value">${escapeHtml(cascade.highestImpact)}</span>
        </div>
      `;
    }

    content.innerHTML = `
      <div class="signal-item" style="border-left-color: ${color}">
        <div class="signal-type">${icon} ${alert.type.toUpperCase().replace('_', ' ')}</div>
        <div class="signal-title">${escapeHtml(alert.title)}</div>
        <div class="signal-description">${escapeHtml(alert.summary)}</div>
        <div class="signal-meta">
          <span class="signal-confidence" style="background: ${color}22; color: ${color}">${alert.priority.toUpperCase()}</span>
          <span class="signal-time">${this.formatTime(alert.timestamp)}</span>
        </div>
        <div class="signal-context">
          ${detailsHtml}
        </div>
        ${alert.countries.length > 0 ? `
          <div class="signal-topics">
            ${alert.countries.map(c => `<span class="signal-topic">${escapeHtml(c)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    this.element.classList.remove('startup-active');
    const titleElA = this.element.querySelector('.signal-modal-title') as HTMLElement | null;
    if (titleElA) titleElA.textContent = `🎯 ${t('modals.signal.title')}`;
    this.element.classList.add('active');
    this.activateEsc();
  }

  public playSound(): void {
    if (this.audioEnabled && this.audio) {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {});
    }
  }

  public hide(): void {
    const wasStartup = this.isStartupVisible;
    this.isStartupVisible = false;
    this.element.classList.remove('active', 'startup-active');
    document.removeEventListener('keydown', this.escHandler);

    if (wasStartup) {
      if (this.pendingSignals && this.pendingSignals.length > 0) {
        const signals = this.pendingSignals;
        this.pendingSignals = null;
        this.show(signals);
      } else if (this.pendingAlert) {
        const alert = this.pendingAlert;
        this.pendingAlert = null;
        this.showAlert(alert);
      }
    }
  }

  private renderSignals(): void {
    const content = this.element.querySelector('.signal-modal-content')!;

    const signalTypeLabels: Record<string, string> = {
      prediction_leads_news: `🔮 ${t('modals.signal.predictionLeading')}`,
      news_leads_markets: `📰 ${t('modals.signal.newsLeading')}`,
      silent_divergence: `🔇 ${t('modals.signal.silentDivergence')}`,
      velocity_spike: `🔥 ${t('modals.signal.velocitySpike')}`,
      keyword_spike: `📊 ${t('modals.signal.keywordSpike')}`,
      convergence: `◉ ${t('modals.signal.convergence')}`,
      triangulation: `△ ${t('modals.signal.triangulation')}`,
      flow_drop: `🛢️ ${t('modals.signal.flowDrop')}`,
      flow_price_divergence: `📈 ${t('modals.signal.flowPriceDivergence')}`,
      geo_convergence: `🌐 ${t('modals.signal.geoConvergence')}`,
      explained_market_move: `✓ ${t('modals.signal.marketMove')}`,
      sector_cascade: `📊 ${t('modals.signal.sectorCascade')}`,
      military_surge: `🛩️ ${t('modals.signal.militarySurge')}`,
    };

    const html = this.currentSignals.map(signal => {
      const context = getSignalContext(signal.type as SignalType);
      // Military surge signals have additional properties in data
      const data = signal.data as Record<string, unknown>;
      const newsCorrelation = data?.newsCorrelation as string | null;
      const focalPoints = data?.focalPointContext as string[] | null;
      const locationData = { lat: data?.lat as number | undefined, lon: data?.lon as number | undefined, regionName: data?.regionName as string | undefined };

      return `
        <div class="signal-item ${escapeHtml(signal.type)}">
          <div class="signal-type">${signalTypeLabels[signal.type] || escapeHtml(signal.type)}</div>
          <div class="signal-title">${escapeHtml(signal.title)}</div>
          <div class="signal-description">${escapeHtml(signal.description)}</div>
          <div class="signal-meta">
            <span class="signal-confidence">${t('modals.signal.confidence')}: ${Math.round(signal.confidence * 100)}%</span>
            <span class="signal-time">${this.formatTime(signal.timestamp)}</span>
          </div>
          ${signal.data.explanation ? `
            <div class="signal-explanation">${escapeHtml(signal.data.explanation)}</div>
          ` : ''}
          ${focalPoints && focalPoints.length > 0 ? `
            <div class="signal-focal-points">
              <div class="focal-points-header">📡 ${t('modals.signal.focalPoints')}</div>
              ${focalPoints.map(fp => `<div class="focal-point-item">${escapeHtml(fp)}</div>`).join('')}
            </div>
          ` : ''}
          ${newsCorrelation ? `
            <div class="signal-news-correlation">
              <div class="news-correlation-header">📰 ${t('modals.signal.newsCorrelation')}</div>
              <pre class="news-correlation-text">${escapeHtml(newsCorrelation)}</pre>
            </div>
          ` : ''}
          ${locationData.lat && locationData.lon ? `
            <div class="signal-location">
              <button class="location-link" data-lat="${locationData.lat}" data-lon="${locationData.lon}">
                📍 ${t('modals.signal.viewOnMap')}: ${locationData.regionName || `${locationData.lat.toFixed(2)}°, ${locationData.lon.toFixed(2)}°`}
              </button>
            </div>
          ` : ''}
          <div class="signal-context">
            <div class="signal-context-item why-matters">
              <span class="context-label">${t('modals.signal.whyItMatters')}</span>
              <span class="context-value">${escapeHtml(context.whyItMatters)}</span>
            </div>
            <div class="signal-context-item actionable">
              <span class="context-label">${t('modals.signal.action')}</span>
              <span class="context-value">${escapeHtml(context.actionableInsight)}</span>
            </div>
            <div class="signal-context-item confidence-note">
              <span class="context-label">${t('modals.signal.note')}</span>
              <span class="context-value">${escapeHtml(context.confidenceNote)}</span>
            </div>
          </div>
          ${signal.data.relatedTopics?.length ? `
            <div class="signal-topics">
              ${signal.data.relatedTopics.map(t => `<span class="signal-topic">${escapeHtml(t)}</span>`).join('')}
            </div>
          ` : ''}
          ${signal.type === 'keyword_spike' && typeof data?.term === 'string' ? `
            <div class="signal-actions">
              <button class="suppress-keyword-btn" data-term="${escapeHtml(data.term)}">${t('modals.signal.suppress')}</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    content.innerHTML = html;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  public getElement(): HTMLElement {
    return this.element;
  }
}
