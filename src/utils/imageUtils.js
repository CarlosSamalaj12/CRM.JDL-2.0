/**
 * Utilidades para procesamiento y compresión de imágenes en CRM-JDL.
 * Soporta conversión a WebP con alta resolución y fallback automático.
 */

export const readFileAsDataUrl = (file) => new Promise((resolve) => {
  if (!file) return resolve('');
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => resolve('');
  reader.readAsDataURL(file);
});

/**
 * Optimiza y comprime un archivo de imagen a formato WebP usando Canvas.
 * Si el navegador no soporta WebP, realiza fallback a JPEG.
 * 
 * @param {File|Blob} file - Archivo de imagen original
 * @param {number} maxDimension - Dimensión máxima en px (ancho o alto)
 * @param {number} quality - Calidad de compresión (0.1 a 1.0)
 * @returns {Promise<{ dataUrl: string, name: string, type: string }>}
 */
export const compressImageToWebp = (file, maxDimension = 1600, quality = 0.80) => new Promise((resolve) => {
  if (!file) return resolve({ dataUrl: '', name: '', type: '' });

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Intentar WebP
      try {
        const webpDataUrl = canvas.toDataURL('image/webp', quality);
        if (webpDataUrl.startsWith('data:image/webp')) {
          const newName = String(file.name || 'imagen').replace(/\.[^/.]+$/, '') + '.webp';
          return resolve({ dataUrl: webpDataUrl, name: newName, type: 'image/webp' });
        }
      } catch {
        // Ignorar y pasar a fallback
      }

      // Fallback a JPEG
      const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
      const newName = String(file.name || 'imagen').replace(/\.[^/.]+$/, '') + '.jpg';
      resolve({ dataUrl: jpegDataUrl, name: newName, type: 'image/jpeg' });
    };

    img.onerror = () => {
      readFileAsDataUrl(file).then(dataUrl => {
        resolve({ dataUrl, name: file.name || 'evidencia', type: file.type || '' });
      });
    };
    img.src = e.target.result;
  };

  reader.onerror = () => {
    readFileAsDataUrl(file).then(dataUrl => {
      resolve({ dataUrl, name: file.name || 'evidencia', type: file.type || '' });
    });
  };

  reader.readAsDataURL(file);
});

/**
 * Procesa archivos de evidencia (boletas de anticipo).
 * Si es PDF, lo mantiene intacto como documento PDF vectorial.
 * Si es imagen, lo optimiza a WebP (1600px) para máxima nitidez de números y mínimo peso.
 */
export const compressEvidenceFile = async (file) => {
  if (!file) return { dataUrl: '', name: '', type: '' };

  const isPdf = file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf');
  if (isPdf) {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      dataUrl,
      name: String(file.name || 'boleta.pdf').trim(),
      type: 'application/pdf'
    };
  }

  const isImage = (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|bmp|heic)$/i.test(file.name || '');
  if (isImage) {
    return compressImageToWebp(file, 1600, 0.80);
  }

  // Fallback para cualquier otro tipo
  const dataUrl = await readFileAsDataUrl(file);
  return {
    dataUrl,
    name: String(file.name || 'evidencia').trim(),
    type: String(file.type || '').trim()
  };
};
