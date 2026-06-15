import { Component } from '@angular/core';

/**
 * Pantalla de bloqueo cuando NO hay sesión del CORE de Seguridad.
 * Regina no tiene login propio: la autenticación la provee el CORE
 * (Aquarius Security). Sin esa sesión, la app no arranca.
 */
@Component({
  selector: 'app-core-not-started',
  standalone: true,
  template: `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
                background:#f1f5f9;padding:24px;font-family:system-ui,Segoe UI,Roboto,sans-serif;">
      <div style="max-width:460px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:16px;
                  box-shadow:0 10px 30px rgba(2,6,23,.08);padding:32px;text-align:center;">
        <div style="width:64px;height:64px;margin:0 auto 20px;border-radius:9999px;background:#fef2f2;
                    display:flex;align-items:center;justify-content:center;">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ef4444"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          </svg>
        </div>
        <h1 style="font-size:20px;font-weight:800;color:#1e293b;margin:0 0 8px;">
          No ha iniciado el CORE de Seguridad
        </h1>
        <p style="font-size:14px;color:#64748b;margin:0;">La aplicación no se puede iniciar.</p>
        <p style="margin-top:20px;font-size:12px;color:#94a3b8;">
          Inicie sesión desde el CORE de Seguridad (Aquarius) para acceder a Regina.
        </p>
      </div>
    </div>
  `
})
export class CoreNotStartedComponent {}
