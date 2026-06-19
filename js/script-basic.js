// ============================================
// script-basic.js
// DOM References — Canal Web NetTiss Software
// Todas las referencias a elementos del HTML
// se centralizan aquí para mantener el código
// limpio, mantenible y fácil de leer.
// ============================================

// ==================== HEADER ====================

/** Contenedor principal del header (sticky) */
export const header = document.getElementById('header');
export const headerInfo = document.getElementById('headerInfo');

// --- LEFT SECTION ---

/** Imagen del avatar del canal */
export const avatarIMG = document.getElementById('avatarIMG');

/** Nombre del canal (h1) */
export const channelName = document.getElementById('channelName');

/** Span que muestra el conteo de suscriptores */
export const subscribers = document.getElementById('subscribers');

// --- RIGHT SECTION ---
// Botón para cambiar el tema del canal
export const changeTheme = document.getElementById("aspect-theme");
/** Botón para compartir el canal */
export const shareChannelBtn = document.getElementById('share-channel');

/** Botón de más opciones (three dots) */
export const optionsBtn = document.getElementById('options-btn');

// ==================== MAIN CONTAINER ====================

/** Contenedor principal que envuelve feed + textarea */
export const mainChannelContainer = document.getElementById('mainChannelContainer');

// ==================== FEED ====================

/** Sección contenedora del feed de publicaciones */
export const channelFeed = document.getElementById('channelFeed');

/**
 * Artículo de post individual (el de ejemplo en HTML).
 * NOTA: Este es solo el post estático de muestra.
 * Los posts dinámicos desde Firestore se crearán
 * programáticamente con createElement.
 */
export const samplePost = document.querySelector('.channel-post');

/**
 * Chip que muestra la fecha de agrupación de posts.
 * NOTA: Es el chip estático de muestra.
 * Los chips de fecha dinámicos se generarán
 * según los datos que vengan de Firestore.
 */
export const sampleDateChip = document.querySelector('.date-post');

// ==================== TEXTAREA ====================

/** Textarea donde el usuario escribe nuevos posts */
export const textarea = document.getElementById('textarea');

/** Botón de envío de publicación (flecha hacia arriba) */
export const sendButton = document.getElementById('sendButton');