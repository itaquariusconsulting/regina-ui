/**
 * Utilidad de diagnóstico de errores para mostrarlos en pantalla
 * cuando NO se puede usar DevTools del navegador (caso típico: celular).
 *
 * Toma cualquier error producido por:
 *   - `HttpClient` de Angular (`HttpErrorResponse`)
 *   - Excepciones JavaScript estándar (`Error`)
 *   - Strings sueltos lanzados como error
 *
 * y devuelve un objeto con:
 *   - `title`     : título humano para el Swal
 *   - `summary`   : una línea de resumen (la causa más probable)
 *   - `detail`    : texto multilínea con TODO lo que el backend reveló
 *                   (status HTTP, URL, mensaje, body completo, stack)
 *
 * Pensado para volcarse dentro de Swal usando `html: <pre>{{detail}}</pre>`.
 */
export interface ErrorBreakdown {
  title: string;
  summary: string;
  detail: string;
}

export function formatHttpError(err: any, contexto: string = ''): ErrorBreakdown {
  const lines: string[] = [];
  let title = '✖ Error';
  let summary = 'Ocurrió un error inesperado.';

  // 1) HttpErrorResponse de Angular
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as any).status;
    const statusText = (err as any).statusText || '';
    const url = (err as any).url || '';
    const errorBody = (err as any).error;
    const message = (err as any).message;

    if (status === 0) {
      title = '✖ No hay conexión con el servidor';
      summary = 'El navegador no pudo contactar al backend. ¿Estás en la red correcta?';
    } else if (status === 401 || status === 403) {
      title = '✖ Sin permisos / sesión vencida';
      summary = 'El servidor rechazó la petición por autenticación.';
    } else if (status === 404) {
      title = '✖ Recurso no encontrado (404)';
      summary = 'El endpoint solicitado no existe en el servidor.';
    } else if (status === 413) {
      title = '✖ Archivo demasiado grande (413)';
      summary = 'El servidor rechazó el archivo por superar el tamaño máximo.';
    } else if (status >= 500) {
      title = '✖ Error en el servidor (' + status + ')';
      summary = 'El backend falló procesando la petición.';
    } else {
      title = '✖ Error HTTP ' + status;
      summary = statusText || 'El servidor respondió con un error.';
    }

    lines.push('STATUS  : ' + status + ' ' + statusText);
    if (url) lines.push('URL     : ' + url);
    if (message) lines.push('MESSAGE : ' + message);

    if (errorBody !== undefined && errorBody !== null) {
      lines.push('---');
      lines.push('RESPUESTA DEL SERVIDOR:');
      if (typeof errorBody === 'string') {
        lines.push(truncar(errorBody, 1500));
      } else {
        try {
          lines.push(truncar(JSON.stringify(errorBody, null, 2), 1500));
        } catch {
          lines.push(String(errorBody));
        }
      }
    }
  }
  // 2) Excepciones JS estándar
  else if (err instanceof Error) {
    title = '✖ ' + (err.name || 'Error');
    summary = err.message || 'Error sin mensaje.';
    lines.push('NAME    : ' + err.name);
    lines.push('MESSAGE : ' + err.message);
    if (err.stack) {
      lines.push('---');
      lines.push('STACK   :');
      lines.push(truncar(err.stack, 1500));
    }
  }
  // 3) Strings u objetos planos
  else if (typeof err === 'string') {
    summary = err;
    lines.push(err);
  } else {
    try {
      lines.push(JSON.stringify(err, null, 2));
      summary = 'Ver detalle abajo.';
    } catch {
      lines.push(String(err));
    }
  }

  if (contexto) {
    lines.unshift('CONTEXTO: ' + contexto);
    lines.unshift('---');
  }
  lines.unshift('AGENTE  : ' + (navigator?.userAgent || '?'));

  return {
    title,
    summary,
    detail: lines.join('\n'),
  };
}

function truncar(s: string, max: number): string {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.substring(0, max) + '\n…[truncado, ' + (s.length - max) + ' chars más]';
}

/**
 * Devuelve el HTML listo para incrustar en Swal:
 *   Swal.fire({ icon:'error', title: b.title, html: errorHtml(b) });
 */
export function errorHtml(b: ErrorBreakdown): string {
  // Escapamos < > & para que el <pre> no rompa el render del Swal.
  const safe = (b.detail || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `
    <div style="text-align:left;font-size:0.85rem;">
      <div style="margin-bottom:8px;color:#c0392b;font-weight:600;">
        ${b.summary}
      </div>
      <details open style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:4px;padding:6px;">
        <summary style="cursor:pointer;font-weight:600;color:#1f3864;">Detalle técnico</summary>
        <pre style="white-space:pre-wrap;word-break:break-word;font-size:0.72rem;
                    margin:8px 0 0;color:#212529;max-height:40vh;overflow:auto;">${safe}</pre>
      </details>
    </div>`;
}
