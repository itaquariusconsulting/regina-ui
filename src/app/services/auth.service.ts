import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
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

  /**
   * 🟢 NO-OP: la integración SSO con aquarius-security fue retirada.
   *
   * Regina ahora maneja su propio login (pantalla /login → regina-api).
   * Este método se conserva como no-op por compatibilidad con cualquier
   * código que aún lo invoque, pero NO hace nada.
   */
  initFromCore(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Usuario actual desde regina-api. Útil para refrescar perfil/permisos
   * después del login tradicional, NO para SSO.
   */
  getCurrentUser(): Observable<RegSecUser | null> {
    return this.http
      .get<Response>(`${this.apiurlAuth}/api/auth/me`, {
        headers: new HttpHeaders({ 'X-Skip-Error-Handler': 'true' }),
      })
      .pipe(map(res => (res && res.error === 0 ? (res.resultado as RegSecUser) : null)));
  }
}
