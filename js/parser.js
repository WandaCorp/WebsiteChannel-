// ============================================
// parser.js
// Parseo de Markdown + Comandos personalizados
// Seguridad anti-XSS con DOMPurify
// ============================================

import { marked } from 'marked';
import DOMPurify from 'dompurify';

// ==================== CONFIGURACIÓN DE MARKED ====================

/**
 * Opciones de Marked.js.
 * Se configuran aquí para mantener todo centralizado.
 */
const markedOptions = {
  breaks: true,        // Saltos de línea simples se convierten en <br>
  gfm: true            // GitHub Flavored Markdown (tablas, listas, etc.)
};

marked.setOptions(markedOptions);

// ==================== LISTA DE COMANDOS ====================

/**
 * Registro de comandos personalizados.
 * Cada comando tiene:
 *   - regex: Expresión regular para detectarlo en el contenido
 *   - type:  Tipo de reproductor a generar ('iframe' | 'video')
 * 
 * Para añadir nuevos comandos en el futuro,
 * solo agrega un objeto a este array.
 */
const COMMANDS = [
  {
    name: 'embed',
    regex: /@embed\("([^"]+)"\)/g,
    type: 'iframe'
  },
  {
    name: 'video',
    regex: /@video\("([^"]+)"\)/g,
    type: 'video'
  },
  // ==================== COMANDOS DE CONFIGURACIÓN ====================
  {
    name: 'channel-avatar',
    regex: /\/channel-avatar\("([^"]+)"\)/g,
    type: 'config-avatar'
  },
  {
    name: 'channel-name',
    regex: /\/channel-name\("([^"]+)"\)/g,
    type: 'config-name'
  }
];

// ==================== FUNCIÓN PRINCIPAL DE PARSEO ====================

/**
 * Parsea contenido crudo (Markdown + comandos) a HTML seguro.
 * 
 * Flujo corregido:
 * 1. Extrae comandos del contenido y los reemplaza por placeholders ÚNICOS
 * 2. Convierte el Markdown restante a HTML con Marked.js
 * 3. Reemplaza los placeholders por los reproductores HTML reales
 * 4. Sanitiza todo el HTML con DOMPurify
 * 
 * @param {string} rawContent - Contenido crudo desde Firestore
 * @returns {Object} { html: string, hasMedia: boolean, mediaItems: Array }
 */
export function parseContent(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return {
      html: '',
      hasMedia: false,
      mediaItems: []
    };
  }

  let processedContent = rawContent;
  const mediaItems = [];

  // Paso 1: Extraer todos los comandos y guardarlos
  // Usamos un placeholder que Marked.js no modificará
  COMMANDS.forEach((command) => {
    let match;
    // Reiniciar lastIndex para cada comando
    command.regex.lastIndex = 0;

    while ((match = command.regex.exec(rawContent)) !== null) {
      const url = match[1];
      // Placeholder único con caracteres que Markdown no interpreta
      const placeholder = `<!--MEDIA_PLACEHOLDER_${mediaItems.length}-->`;

      mediaItems.push({
        type: command.type,
        url: url,
        placeholder: placeholder,
        fullMatch: match[0]
      });

      // Reemplazar comando por placeholder en el contenido
      processedContent = processedContent.replace(match[0], placeholder);
    }
  });

  // Paso 2: Convertir Markdown a HTML
  let html = marked.parse(processedContent);

  // Paso 3: Reemplazar placeholders por HTML de reproductores
  // Los comentarios HTML sobreviven al parseo de Marked.js
  mediaItems.forEach((item) => {
    const mediaHTML = generateMediaHTML(item.type, item.url);
    html = html.replace(item.placeholder, mediaHTML);
  });

  // Paso 4: Sanitizar HTML (anti-XSS)
  const sanitizedHTML = sanitize(html);

  return {
    html: sanitizedHTML,
    hasMedia: mediaItems.length > 0,
    mediaItems: mediaItems
  };
}

/**
 * Verifica si el contenido es un comando de configuración del canal.
 * Los comandos de configuración NO son publicaciones visibles en el feed.
 * 
 * @param {string} content - Contenido crudo del textarea
 * @returns {Object|null} { type: string, value: string } o null si no es comando de configuración
 */
export function detectConfigCommand(content) {
  if (!content || typeof content !== 'string') return null;

  const trimmed = content.trim();

  // Verificar comando de avatar
  const avatarRegex = /^\/channel-avatar\("([^"]+)"\)$/;
  const avatarMatch = trimmed.match(avatarRegex);
  if (avatarMatch) {
    return {
      type: 'config-avatar',
      value: avatarMatch[1]
    };
  }

  // Verificar comando de nombre
  const nameRegex = /^\/channel-name\("([^"]+)"\)$/;
  const nameMatch = trimmed.match(nameRegex);
  if (nameMatch) {
    return {
      type: 'config-name',
      value: nameMatch[1]
    };
  }

  return null;
}

// ==================== GENERACIÓN DE HTML DE REPRODUCTORES ====================

/**
 * Genera el HTML para un reproductor multimedia.
 * Esta función decide qué tipo de elemento crear.
 * 
 * @param {string} type - Tipo de reproductor ('iframe' | 'video' | futuros)
 * @param {string} url - URL del contenido multimedia
 * @returns {string} HTML del reproductor
 */
 
function generateMediaHTML(type, url) {
  // Validación estricta: Toda URL embebida debe ser segura
  const isSecureURL = url.trim().startsWith('https://');
  
  if (!isSecureURL) {
    return `<p style="color:red; font-size:12px;">[Medio bloqueado por seguridad: Usa enlace https]</p>`;
  }

  switch (type) {
    case 'iframe':
      return createIframeHTML(url);
    case 'video':
      return createVideoHTML(url);
    default:
      return `<p>[Tipo de medio no soportado: ${type}]</p>`;
  }
}

/**
 * Crea HTML para un iframe (YouTube, Vimeo, etc.).
 * @param {string} url - URL del iframe
 * @returns {string} HTML del contenedor con iframe responsivo
 */
function createIframeHTML(url) {
  return `
    <div class="media-container media-container--iframe">
      <iframe
        src="${url}"
        class="media-iframe"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
        title="Contenido embebido"
      ></iframe>
    </div>
  `;
}

/**
 * Crea HTML para un reproductor de video nativo.
 * @param {string} url - URL del archivo de video (.mp4, .webm, etc.)
 * @returns {string} HTML del elemento <video>
 */
function createVideoHTML(url) {
  return `
    <div class="media-container media-container--video">
      <video
        class="media-video"
        controls
        preload="metadata"
        title="Video del canal"
      >
        <source src="${url}" type="video/mp4">
        Tu navegador no soporta la reproducción de video.
      </video>
    </div>
  `;
}

// ==================== SANITIZACIÓN ====================

/**
 * Sanitiza HTML para prevenir inyección de código malicioso (XSS).
 * Usa DOMPurify con configuración segura.
 * 
 * @param {string} dirtyHTML - HTML potencialmente peligroso
 * @returns {string} HTML limpio y seguro
 */
function sanitize(dirtyHTML) {
  const cleanHTML = DOMPurify.sanitize(dirtyHTML, {
    ALLOWED_TAGS: [
      // Etiquetas de Markdown
      'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr',
      // Etiquetas de reproductores
      'div', 'iframe', 'video', 'source'
    ],
    ALLOWED_ATTR: [
      // Atributos seguros
      'href', 'target', 'rel', 'title',
      'src', 'alt', 'loading',
      'class',
      'allow', 'allowfullscreen', 'frameborder',
      'controls', 'preload'
    ],
    ALLOW_DATA_ATTR: false,
    ADD_URI_SAFE_ATTR: ['src', 'href']
  });

  return cleanHTML;
}

// ==================== UTILIDAD PÚBLICA ====================

/**
 * Verifica rápidamente si un contenido tiene comandos multimedia.
 * Útil para decidir si se necesita procesamiento extra.
 * 
 * @param {string} content - Contenido crudo
 * @returns {boolean} True si contiene al menos un comando
 */
export function hasCommands(content) {
  return COMMANDS.some((command) => {
    command.regex.lastIndex = 0;
    return command.regex.test(content);
  });
}