/**
 * Utilidades para sanear archivos capturados desde la cámara del celular.
 *
 * Cuando el usuario usa `<input type="file" capture="environment">` en
 * un móvil, el File que entrega el navegador suele tener un nombre poco
 * fiable: en iOS Safari es `image.jpg`, en algunos Android es `1690…jpeg`
 * o incluso una ruta tipo `/storage/emulated/0/DCIM/Camera/IMG_…jpg`.
 *
 * Si el backend usa ese nombre tal cual para guardar el archivo en disco,
 * puede fallar por:
 *   - Caracteres no permitidos en el filesystem (espacios, acentos, `/`).
 *   - Nombre demasiado largo.
 *   - Extensión ausente o inconsistente con el `Content-Type`.
 *   - El nombre parece una ruta absoluta y el server intenta usarla.
 *
 * Esta utilidad reescribe el `File` con un nombre seguro y predecible
 * antes de enviarlo, sin tocar el contenido binario.
 */

/**
 * Devuelve un nuevo `File` con:
 *   - nombre saneado (sin path, sin acentos, sin espacios)
 *   - extensión coherente con el MIME type
 *   - mismo binario y mismo Content-Type
 *
 * Si el archivo ya tiene un nombre seguro, se devuelve uno equivalente
 * (mantener la misma referencia no es importante porque el `FormData`
 * se reconstruye en cada upload).
 *
 * @param file       File original del input
 * @param prefijoOpc Prefijo descriptivo opcional, ej: "rendir", "movilidad"
 */
export function normalizarArchivoCamara(file: File, prefijoOpc: string = 'doc'): File {
  if (!file) return file;

  const mime = (file.type || '').toLowerCase();
  const original = file.name || '';

  // Extensión deducida del MIME (más confiable que el name del móvil)
  const extPorMime: string =
    mime === 'application/pdf'  ? 'pdf'  :
    mime === 'image/jpeg'       ? 'jpg'  :
    mime === 'image/jpg'        ? 'jpg'  :
    mime === 'image/png'        ? 'png'  :
    mime === 'image/webp'       ? 'webp' :
    mime === 'image/heic'       ? 'heic' :
    mime === 'image/heif'       ? 'heif' :
    '';

  // Extensión deducida del nombre actual (último segmento tras el último ".")
  const sinPath = original.split(/[\\/]/).pop() || original;
  const dot = sinPath.lastIndexOf('.');
  const extPorNombre = dot > 0 && dot < sinPath.length - 1
    ? sinPath.substring(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';

  const ext = extPorMime || extPorNombre || 'jpg';

  // Nombre nuevo: <prefijo>-<timestamp>.<ext>
  const ts = Date.now();
  const prefijo = (prefijoOpc || 'doc').toLowerCase().replace(/[^a-z0-9]/g, '') || 'doc';
  const nuevoNombre = `${prefijo}-${ts}.${ext}`;

  // Si ya tenía un nombre seguro Y el binario no necesita ningún cambio,
  // igual reconstruimos para garantizar consistencia entre nombre y MIME.
  try {
    return new File([file], nuevoNombre, {
      type: mime || 'application/octet-stream',
      lastModified: file.lastModified || ts,
    });
  } catch {
    // Algunos navegadores muy antiguos no permiten `new File`. Fallback:
    // se devuelve el original con una propiedad readonly sobreescrita.
    Object.defineProperty(file, 'name', {
      writable: true,
      value: nuevoNombre,
    });
    return file;
  }
}

/**
 * Comprime una imagen capturada con la cámara del celular reduciendo su
 * resolución máxima y recodificando como JPEG con calidad ajustable.
 *
 * Las fotos modernas pesan 4-12 MB y vienen a 4032×3024 px o más; esto
 * genera dos cuellos de botella:
 *   1. Subida lenta por celular (varios segundos en 4G).
 *   2. PaddleOCR procesa cada píxel — más pixeles → más tiempo.
 *
 * Comprimir a ~1600 px de lado largo + JPEG 0.78 reduce el tamaño a
 * 300-800 KB sin perder legibilidad del texto del comprobante (PaddleOCR
 * trabaja excelente a 1200-1800 px). Velocidad típica de OCR cae a la
 * mitad o más.
 *
 * @param file       Imagen original (debe ser image/*; los PDF se devuelven
 *                   sin cambios porque ya están vectorizados).
 * @param maxLado    Dimensión máxima del lado largo (default 1600 px).
 * @param calidad    Calidad JPEG entre 0 y 1 (default 0.78).
 */
export async function comprimirImagenParaOcr(
  file: File,
  maxLado: number = 1600,
  calidad: number = 0.78,
): Promise<File> {
  // PDFs no se tocan: son texto vectorial, comprimir no aplica.
  if (file.type === 'application/pdf' || !file.type.startsWith('image/')) {
    return file;
  }
  // HEIC/HEIF no es soportado nativamente por canvas en navegadores
  // de escritorio — lo enviamos tal cual y que el backend decida.
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    return file;
  }
  // Si ya es chiquita (<400 KB) no vale la pena recodificar.
  if (file.size < 400_000) {
    return file;
  }

  try {
    const dataUrl = await leerArchivoComoDataUrl(file);
    const img = await cargarImagen(dataUrl);

    // Calcula el nuevo tamaño manteniendo el aspect ratio.
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    const escala = Math.min(1, maxLado / Math.max(w0, h0));
    const w = Math.round(w0 * escala);
    const h = Math.round(h0 * escala);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // Mejor calidad de resampling para que el texto no se difumine.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', calidad)
    );
    if (!blob) return file;

    // Si la "compresión" terminó pesando MÁS que el original (rara vez,
    // pero pasa con imágenes ya muy comprimidas), conservamos el original.
    if (blob.size >= file.size) {
      return file;
    }

    const nuevoNombre = file.name.replace(/\.[^.]+$/, '') + '-opt.jpg';
    return new File([blob], nuevoNombre, {
      type: 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    });
  } catch (e) {
    console.warn('[comprimirImagenParaOcr] falló, se envía original', e);
    return file;
  }
}

function leerArchivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
    img.src = src;
  });
}

/**
 * Verifica si el File tiene aspecto de "venir de la cámara" para decidir
 * si conviene aplicar `normalizarArchivoCamara`. Útil para log/debug.
 */
export function pareceArchivoDeCamara(file: File): boolean {
  if (!file || !file.name) return true;
  const n = file.name.toLowerCase();
  return (
    /^image\.(jpg|jpeg|png)$/.test(n) ||
    /^\d{10,}\.(jpg|jpeg|png)$/.test(n) ||
    n.includes('/') || n.includes('\\') ||
    n.length === 0
  );
}
