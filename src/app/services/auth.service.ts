import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, firstValueFrom, timeout } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from '../models/response';
import { RegSecUser } from '../models/reg-sec-user';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { NavItem } from '../models/globals/nav-item';
import { RegSecPermissions } from '../models/reg-sec-permissions';
import { RegSecProfilePermissions } from '../models/reg-sec-profile-permissions-dto';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient) {
    const savedPerms = sessionStorage.getItem('user_permissions');
    if (savedPerms) {
      this.permissionsSubject.next(JSON.parse(savedPerms));
    }
  }

  private secretKey = '4qvr1v520251234z'; // Debe ser de 16, 24 o 32 bytes
  private authStatusListener = new BehaviorSubject<boolean>(this.isLoggedIn());

  private permissionsSubject = new BehaviorSubject<RegSecProfilePermissions[]>([]);
  public permissions$ = this.permissionsSubject.asObservable();

  apiurlAuth = environment.apiUrlAuth;
  token = sessionStorage.getItem('authToken');

  login(dto: RegSecUser): Observable<any> {
    const url = this.apiurlAuth + "/api/auth/autenticar";
    return this.http.post(this.apiurlAuth + "/api/auth/autenticar", dto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    });
  }

  otp(dto: RegSecUser): Observable<any> {
    return this.http.post(this.apiurlAuth + "otp", dto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    });
  }

  // Método para verificar si el usuario está autenticado
  isLoggedIn(): boolean {
    const token = sessionStorage.getItem('authToken');
    return !!token && !this.isTokenExpired(token);
  }

  // Método para verificar si el token ha expirado.
  // Decodifica el payload como base64url (el JWT del CORE usa '-'/'_'), y si el
  // token está malformado lo trata como expirado en vez de reventar la app.
  isTokenExpired(token: string): boolean {
    try {
      const part = token.split('.')[1];
      if (!part) return true;
      const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
      const bin = atob(b64 + pad);
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      if (!payload || !payload.exp) return false;
      return new Date(payload.exp * 1000) <= new Date();
    } catch {
      return true;
    }
  }

  // Método para establecer el token y notificar el estado de autenticación
  setToken(token: string): void {
    sessionStorage.setItem('authToken', token);
    this.authStatusListener.next(true); // El usuario está autenticado
  }

  // Método para cerrar sesión
  logout(): void {
    sessionStorage.removeItem('authToken');
    this.authStatusListener.next(false); // El usuario ha cerrado sesión
  }

  getAuthStatusListener() {
    return this.authStatusListener.asObservable();
  }

  async setDataAuditoria() {
    this.obtieneIP().subscribe(
      (response: Response) => {
        sessionStorage.setItem('ip', response.resultado);
      }
    )

    const fp = await FingerprintJS.load();
    const result = await fp.get();
    sessionStorage.setItem('fingerprint', result.visitorId);
  }

  obtieneIP(): Observable<Response> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    });
    return this.http.get<Response>(`${this.apiurlAuth}obtenerIp`, {
      headers
    });
  }

  changePassword(dto: RegSecUser): Observable<any> {
    return this.http.put(`${this.apiurlAuth}/api/usuario/change-password`, dto, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json', 'X-Skip-Error-Handler': 'true' })
    });
  }

  obtenerItemsMenu(idUsuario: number, codEmpresa: string): Observable<NavItem[]> {
    const url = `${this.apiurlAuth}/api/permissions/listar-permisos?userId=${idUsuario}&codEmpresa=${codEmpresa}`;

    return this.http.get<{ resultado: RegSecPermissions[] }>(url).pipe(
      map(response => this.convertPermissionsToMenu(response.resultado))
    );
  }

  obtainProfilePermissions(profileId: number, codEmpresa: string): Observable<RegSecProfilePermissions[]> {
    const url = `${this.apiurlAuth}/api/permissions/listar-permisos-por-perfil?profileId=${profileId}&codEmpresa=${codEmpresa}`;

    return this.http.get<Response>(url).pipe(
      map((res: Response) => res.resultado as RegSecProfilePermissions[])
    );
  }

  saveProfilePermissions(permisos: RegSecProfilePermissions[]): Observable<Response> {
    const url = `${this.apiurlAuth}/api/permissions/guardar-permisos-perfil`;
    
    return this.http.post<Response>(url, permisos);
  }

  convertPermissionsToMenu(data: RegSecPermissions[]): NavItem[] {

    // 1️⃣ Filtrar solo visibles
    const visibles = data.filter(p => p.permitView === true);

    // 2️⃣ Crear mapa por ID
    const map = new Map<number, NavItem & { id: number; parentId: number | null }>();

    visibles.forEach(p => {
      if (typeof p.menuId === 'number') {
        map.set(p.menuId, {
          id: p.menuId,
          parentId: p.menuParentId ?? null,
          label: p.menuLabel,
          icon: p.menuIcon,
          route: p.menuRoute || undefined,
          expanded: false,
          subitems: []
        });
      }
    });

    const roots: NavItem[] = [];

    map.forEach(item => {
      if (item.parentId === null) {
        roots.push(item);
      } else {
        const parent = map.get(item.parentId);
        if (parent) {
          parent.subitems!.push(item);
        }
      }
    });

    roots.forEach(r => {
      if (r.subitems && r.subitems.length === 0) {
        delete r.subitems;
      }
    });
    return roots;
  }

  loadUserPermissions(profileId: number, codEmpresa: string): void {
    this.obtainProfilePermissions(profileId, codEmpresa).subscribe(perms => {
      this.permissionsSubject.next(perms);
      sessionStorage.setItem('user_permissions', JSON.stringify(perms));
    });
  }

  hasPermission(menuRoute: string, action: keyof RegSecProfilePermissions): boolean {
    const currentPerms = this.permissionsSubject.value;
    if (!currentPerms || currentPerms.length === 0) {
      return false;
    }

    const perm = currentPerms.find(p => p.menuRoute === menuRoute);

    return perm ? !!perm[action] : false;
  }

  // ───────────────────── SSO con el CORE de Seguridad ─────────────────────
  // La autenticación la hace el CORE (Aquarius Security). El token llega por
  // sessionStorage (traspaso #sso del catálogo) y el usuario completo se obtiene
  // de /api/auth/me para rearmar la sesión (perfil/empresa/permisos).
  private coreOpener: Window | null = null;
  private coreWatchTimer: any = null;
  private coreIntrospectTimer: any = null;

  // Garantiza que el init corra UNA sola vez; el guard y el APP_INITIALIZER
  // comparten la misma promesa para evitar la carrera con la navegación inicial.
  private initPromise: Promise<void> | null = null;

  /** Idempotente: lo llaman el APP_INITIALIZER y el authGuard. */
  initFromCore(): Promise<void> {
    // En modo LOCAL no existe el CORE: el login tradicional (/login)
    // se encarga de armar la sesión. Saltamos toda la lógica de SSO.
    if (!environment.production) {
      return Promise.resolve();
    }
    if (!this.initPromise) {
      this.initPromise = this.runInitFromCore();
    }
    return this.initPromise;
  }

  private async runInitFromCore(): Promise<void> {
    // BLINDAJE: este método lo espera el APP_INITIALIZER y el guard. Si lanzara
    // un error o se colgara, la app NO renderiza (pantalla en blanco). Por eso
    // todo va dentro de try/catch y el /me lleva timeout: ante cualquier fallo
    // limpiamos la sesión y el guard mostrará /no-core (nunca blanco).
    try {
      this.ingestSso();
      const token = sessionStorage.getItem('authToken');
      if (!token || this.isTokenExpired(token)) {
        this.clearCoreSession();
        return;
      }
      this.startCoreWatcher();
      const user = await firstValueFrom(this.getCurrentUser().pipe(timeout(8000)));
      if (!user) { this.clearCoreSession(); return; }

      sessionStorage.setItem('isLoggedIn', 'true');
      sessionStorage.setItem('authToken', token);
      // Token LEGACY emitido por regina-api en /auth/me: lo usan SOLO las
      // llamadas a los servicios legacy (utils/IA/OCR) vía el interceptor.
      const legacy = (user as any).authToken;
      if (legacy) sessionStorage.setItem('legacyToken', legacy);
      sessionStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('codempresa', (user as any).codEmpresa || '0001');

      const now = new Date();
      sessionStorage.setItem('periodo_year', String(now.getFullYear()).padStart(4, '0'));
      sessionStorage.setItem('periodo_month', String(now.getMonth() + 1).padStart(2, '0'));

      const profileId = (user as any).profileId;
      const codEmpresa = (user as any).codEmpresa || '0001';
      if (profileId != null) {
        this.loadUserPermissions(profileId, codEmpresa);
      }
      this.authStatusListener.next(true);
    } catch {
      this.clearCoreSession();
    }
  }

  /** Usuario autoritativo desde el backend (perfil/empresa). */
  getCurrentUser(): Observable<RegSecUser | null> {
    return this.http
      .get<Response>(`${this.apiurlAuth}/api/auth/me`, {
        headers: new HttpHeaders({ 'X-Skip-Error-Handler': 'true' })
      })
      .pipe(map(res => (res && res.error === 0 ? (res.resultado as RegSecUser) : null)));
  }

  /** Lee el traspaso #sso=<base64url> de la URL (sirve con hash routing). */
  private ingestSso(): void {
    const m = window.location.href.match(/[#&?]sso=([^&]+)/);
    if (!m) return;
    try {
      const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
      const bin = atob(b64 + pad);
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      const data = JSON.parse(json) as { a?: string; u?: string; c?: string };
      if (data.a) sessionStorage.setItem('authToken', data.a);
      if (data.u) sessionStorage.setItem('sg.user', data.u);
      if (data.c) sessionStorage.setItem('sg.context', data.c);
    } catch {
      /* sso malformado: caerá en /no-core */
    }
    // Quita el sso de la URL y deja la app en su base de hash routing.
    history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
  }

  private clearCoreSession(): void {
    if (this.coreWatchTimer) { clearInterval(this.coreWatchTimer); this.coreWatchTimer = null; }
    if (this.coreIntrospectTimer) { clearInterval(this.coreIntrospectTimer); this.coreIntrospectTimer = null; }
    sessionStorage.clear();
    this.authStatusListener.next(false);
  }

  /**
   * Vigila la sesión del CORE por DOS vías complementarias:
   *  1) window.opener.closed — si esta pestaña la abrió el CORE, detecta cuando
   *     se cierra su pestaña/navegador (legible entre orígenes).
   *  2) GET /auth/introspect del CORE — detecta el LOGOUT (token revocado vía
   *     fec_last_logout) aunque el CORE siga abierto o se haya perdido el opener.
   * En cualquiera de los dos casos se cierra esta app.
   */
  private startCoreWatcher(): void {
    const opener = window.opener as Window | null;
    if (opener && !this.coreWatchTimer) {
      this.coreOpener = opener;
      const checkOpener = () => {
        try {
          if (!this.coreOpener || this.coreOpener.closed) this.onCoreClosed();
        } catch {
          /* opener.closed es legible entre orígenes */
        }
      };
      this.coreWatchTimer = setInterval(checkOpener, 1500);
      document.addEventListener('visibilitychange', checkOpener);
      window.addEventListener('focus', checkOpener);
    }

    if (!this.coreIntrospectTimer) {
      this.checkCoreSession();
      this.coreIntrospectTimer = setInterval(() => this.checkCoreSession(), 8000);
    }
  }

  /**
   * Pregunta al CORE si el token sigue vivo. Solo cierra ante una respuesta
   * DEFINITIVA {active:false}; un error de red se ignora (transitorio).
   */
  private checkCoreSession(): void {
    const token = sessionStorage.getItem('authToken');
    if (!token) return;
    const coreApi = (environment as any).coreApiUrl;
    if (!coreApi) return;
    this.http.get<{ active: boolean }>(`${coreApi}/auth/introspect`, {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`,
        'X-Skip-Error-Handler': 'true'
      })
    }).subscribe({
      next: res => { if (res && res.active === false) this.onCoreClosed(); },
      error: () => { /* transitorio: no cerramos por un fallo de red */ }
    });
  }

  /** El CORE cerró sesión (logout o se cerró): limpiar y cerrar/bloquear. */
  private onCoreClosed(): void {
    if (this.coreWatchTimer) { clearInterval(this.coreWatchTimer); this.coreWatchTimer = null; }
    if (this.coreIntrospectTimer) { clearInterval(this.coreIntrospectTimer); this.coreIntrospectTimer = null; }
    try { sessionStorage.clear(); } catch { /* noop */ }
    try { localStorage.clear(); } catch { /* noop */ }
    this.authStatusListener.next(false);
    // La pestaña fue abierta por el CORE => intentamos cerrarla.
    try { window.close(); } catch { /* noop */ }
    // Si el navegador no permitió cerrarla, mostramos el bloqueo.
    window.location.hash = '/no-core';
    location.reload();
  }
}
