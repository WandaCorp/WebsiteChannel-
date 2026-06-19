// ============================================
// ui.js
// Renderizado del Feed del Canal + Publicación
// Sistema de reacciones, gestos y menú contextual
// Optimizado: menos llamadas a Firestore, caché local
// ============================================

import { isAuthorized, currentUserUID, isOwner } from './login.js';
import { parseContent, detectConfigCommand } from './parser.js';
import { auth } from './firebase-config.js';

import {
  headerInfo,
  shareChannelBtn,
  optionsBtn,
  channelFeed,
  textarea,
  sendButton,
  samplePost,
  sampleDateChip,
  avatarIMG,
  channelName,
  changeTheme
} from './script-basic.js';

import {
  db,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from './firebase-config.js';

// ==================== CONSTANTES ====================

/** ID del post que se está editando (null = creación nueva) */
let editingPostId = null;
let feedUnsubscribe = null;
/** Nombre de la colección en Firestore */
const COLLECTION_NAME = 'WebsiteChannel';

/** Referencia a la colección de Firestore */
const channelCollection = collection(db, COLLECTION_NAME);

/** ID fijo del documento único de configuración */
const SETTINGS_DOC_ID = 'channel-items';

/** Altura mínima del textarea en píxeles */
const TEXTAREA_MIN_HEIGHT = 30;

/** Altura máxima del textarea en píxeles */
const TEXTAREA_MAX_HEIGHT = 150;

/** Referencia al contenedor del textarea */
const textareaContainer = document.querySelector('.textarea-container');

/** Lista de emojis disponibles para reaccionar */
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '🎉', '💯'];

/** Caché local de configuración del canal para evitar consultas repetidas */
let channelConfigCache = null;

/** Regex para validar emojis (cualquier emoji estándar) */
const EMOJI_REGEX = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?)+$/u;

// ==================== BOTÓN COMPARTIR ====================

function setupShareButton() {
  if (!shareChannelBtn) return;

  shareChannelBtn.addEventListener('click', async () => {
    const shareData = {
      title: channelName.textContent,
      text: `Mira el canal de ${channelName.textContent}`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error.name !== 'AbortError') {
          fallbackCopyToClipboard(window.location.href);
        }
      }
    } else {
      fallbackCopyToClipboard(window.location.href);
    }
  });
}

// ==================== OBTENCIÓN DE CONFIGURACIÓN (CACHÉ) ====================

/**
 * Obtiene la configuración del canal desde caché o Firestore.
 * Evita consultas repetidas al mismo documento.
 * @returns {Promise<Object|null>}
 */
async function getChannelConfig() {
  if (channelConfigCache) return channelConfigCache;

  try {
    const { doc, getDoc } = await import('./firebase-config.js');
    const settingsRef = doc(db, 'SettingsChannel', SETTINGS_DOC_ID);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
      channelConfigCache = docSnap.data();
      return channelConfigCache;
    }
    return null;
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    return null;
  }
}

/**
 * Invalida la caché de configuración (usar después de cambios).
 */
function invalidateConfigCache() {
  channelConfigCache = null;
}

// ==================== CHIP DE ROL ====================

/**
 * Genera el chip de rol según el UID del autor.
 * Usa caché para evitar consultas repetidas.
 * @param {string} authorUID - UID del autor del post
 * @returns {Promise<string>} HTML del chip o vacío
 */
async function getRoleChip(authorUID) {
  if (!authorUID) return '';

  const config = await getChannelConfig();
  if (!config) return '';

  const ownerUID = config['owner-uid'];
  const authorizedUids = config['authorized-uids'] || [];

  if (authorUID === ownerUID) {
    return '<span class="role-chip role-chip--owner"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-crown-icon lucide-crown"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>Propietario</span>';
  }

  if (authorizedUids.includes(authorUID)) {
    return '<span class="role-chip role-chip--admin"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-badge-check-icon lucide-badge-check"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg> Admin</span>';
  }

  return '';
}

// ==================== UTILIDADES ====================

async function fallbackCopyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert('Enlace del canal copiado al portapapeles.');
  } catch (error) {
    const textareaEl = document.createElement('textarea');
    textareaEl.value = text;
    textareaEl.style.position = 'fixed';
    textareaEl.style.opacity = '0';
    document.body.appendChild(textareaEl);
    textareaEl.select();
    document.execCommand('copy');
    document.body.removeChild(textareaEl);
    alert('Enlace del canal copiado al portapapeles.');
  }
}

function isValidURL(url) {
  try { new URL(url); return true; } catch { return false; }
}

/**
 * Valida si un string es un emoji válido.
 * @param {string} text
 * @returns {boolean}
 */
function isValidEmoji(text) {
  if (!text || typeof text !== 'string') return false;
  return EMOJI_REGEX.test(text.trim());
}

// ==================== HEADER: CLICK PARA MODAL ====================

headerInfo.addEventListener("click", () => {
  openOptionsModal();
});

// ==================== MODAL MÁS OPCIONES ====================

function openOptionsModal() {
  if (document.getElementById('optionsOverlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'options-overlay';
  overlay.id = 'optionsOverlay';

  overlay.innerHTML = `
    <div class="options-modal" id="optionsModal">
      <div class="options-modal__header">
        <button class="options-modal__close" id="closeOptionsModal" title="Cerrar" aria-label="Cerrar" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="options-modal__profile">
        <img class="options-modal__avatar" src="${avatarIMG.src}" alt="Avatar de ${channelName.textContent}" loading="lazy">
        <h3 class="options-modal__channel-name">${channelName.textContent}</h3>
        <span class="total-subscribers">${subscribers ? subscribers.textContent : ''}</span>
      </div>
      <div class="options-modal__actions">
        <button class="options-modal__btn options-modal__btn--share" id="shareChannelModalBtn" type="button">
          <svg class="options-modal__btn-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-share2-icon lucide-share-2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
          Compartir el canal 
        </button>
        <button class="options-modal__btn options-modal__btn--logout" id="logoutBtn" type="button">
          <svg class="options-modal__btn-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-out-icon lucide-log-out"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>
          Abandonar el canal
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  setupOptionsModalEvents(overlay);
}

function setupOptionsModalEvents(overlay) {
  document.getElementById('closeOptionsModal').addEventListener('click', () => closeOptionsModal(overlay));

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeOptionsModal(overlay);
  });

  document.getElementById('shareChannelModalBtn').addEventListener('click', async () => {
    const shareData = {
      title: channelName.textContent,
      text: `Mira el canal de ${channelName.textContent}`,
      url: window.location.href
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (error) {
        if (error.name !== 'AbortError') fallbackCopyToClipboard(window.location.href);
      }
    } else {
      fallbackCopyToClipboard(window.location.href);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await handleLogout(document.getElementById('logoutBtn'), overlay);
  });
}

function closeOptionsModal(overlay) {
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.2s ease';
  setTimeout(() => overlay.remove(), 200);
}

async function handleLogout(button, overlay) {
  const originalText = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `
    <svg class="options-modal__btn-icon" style="animation: spin 0.8s linear infinite; xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-icon lucide-loader"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
    Abandonando canal...
  `;
  try {
    const { abandonChannel } = await import('./login.js');
    await abandonChannel(currentUserUID);
    closeOptionsModal(overlay);
  } catch (error) {
    console.error('Error al abandonar canal:', error);
    button.disabled = false;
    button.innerHTML = originalText;
    alert('Error al abandonar el canal. Intenta de nuevo.');
  }
}

function setupOptionsButton() {
  if (!optionsBtn) return;
  optionsBtn.addEventListener('click', () => openOptionsModal());
}

// ==================== MENÚ DE OPCIONES DE POST ====================

function openPostOptionsMenu(articleElement, postId, content) {
  const existingOverlay = document.getElementById('postOptionsOverlay');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.className = 'post-options-overlay';
  overlay.id = 'postOptionsOverlay';

  const menu = document.createElement('div');
  menu.className = 'post-options-menu';
  menu.id = 'postOptionsMenu';

  menu.innerHTML = `
    <button class="post-options-item post-options-item--copy" id="copyPostBtn" type="button">
      <svg class="post-options-item__icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-icon lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      Copiar
    </button>
    <button class="post-options-item post-options-item--edit" id="editPostBtn" type="button">
      <svg class="post-options-item__icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pen-line-icon lucide-pen-line"><path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
      Editar
    </button>
    <button class="post-options-item post-options-item--danger" id="deletePostBtn" type="button">
      <svg class="post-options-item__icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-icon lucide-trash"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Eliminar
    </button>
  `;

  overlay.appendChild(menu);
  document.body.appendChild(overlay);

  positionMenuNearElement(menu, articleElement);
  setupPostOptionsEvents(overlay, menu, postId, content);
}

function positionMenuNearElement(menu, element) {
  const rect = element.getBoundingClientRect();
  const menuHeight = 150;
  const menuWidth = 200;
  const gap = 8;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  let left = rect.left + rect.width / 2 - menuWidth / 2;
  if (left < 16) left = 16;
  if (left + menuWidth > viewportWidth - 16) left = viewportWidth - menuWidth - 16;

  const spaceAbove = rect.top;
  const spaceBelow = viewportHeight - rect.bottom;
  let top;

  if (spaceBelow >= menuHeight + gap) {
    top = rect.bottom + gap;
  } else if (spaceAbove >= menuHeight + gap) {
    top = rect.top - menuHeight - gap;
  } else {
    top = viewportHeight / 2 - menuHeight / 2;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function setupPostOptionsEvents(overlay, menu, postId, content) {
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closePostOptionsMenu(overlay, menu);
  });

  document.getElementById('copyPostBtn').addEventListener('click', async () => {
    await copyPostContent(content);
    closePostOptionsMenu(overlay, menu);
  });

  document.getElementById('editPostBtn').addEventListener('click', () => {
    startEditingPost(postId, content);
    closePostOptionsMenu(overlay, menu);
  });

  document.getElementById('deletePostBtn').addEventListener('click', async () => {
    await deletePost(postId);
    closePostOptionsMenu(overlay, menu);
  });
}

function closePostOptionsMenu(overlay, menu) {
  overlay.classList.add('post-options-overlay--hiding');
  menu.classList.add('post-options-menu--hiding');
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
    if (menu.parentNode) menu.remove();
  }, 150);
}

// ==================== ACCIONES DE POST ====================

async function copyPostContent(content) {
  try {
    await navigator.clipboard.writeText(content);
  } catch (error) {
    const textareaEl = document.createElement('textarea');
    textareaEl.value = content;
    textareaEl.style.position = 'fixed';
    textareaEl.style.opacity = '0';
    document.body.appendChild(textareaEl);
    textareaEl.select();
    document.execCommand('copy');
    document.body.removeChild(textareaEl);
  }
}

function startEditingPost(postId, content) {
  editingPostId = postId;
  const textareaEl = document.getElementById('textarea');
  if (textareaEl) {
    textareaEl.value = content;
    textareaEl.focus();
    textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
    textareaEl.placeholder = 'Editando publicación...';
  }
}

async function deletePost(postId) {
  if (!confirm('¿Eliminar esta publicación? Esta acción no se puede deshacer.')) return;

  try {
    const { doc: docFn, deleteDoc } = await import('./firebase-config.js');
    const postRef = docFn(db, 'WebsiteChannel', postId);
    await deleteDoc(postRef);

    const articleElement = document.querySelector(`[data-post-id="${postId}"]`);
    const postContainer = articleElement?.closest('.post-container');
    const elementToRemove = postContainer || articleElement;

    if (elementToRemove) {
      elementToRemove.style.opacity = '0';
      elementToRemove.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      elementToRemove.style.transform = 'scale(0.95)';
      setTimeout(() => elementToRemove.remove(), 200);
    }

  } catch (error) {
    console.error('Error al eliminar post:', error);
    alert('Error al eliminar la publicación.');
  }
}

async function updateExistingPost(postId, newContent, textareaEl, buttonEl) {
  const publishElements = showPublishOverlay();
  if (buttonEl) buttonEl.disabled = true;

  try {
    const { doc: docFn, updateDoc } = await import('./firebase-config.js');
    const postRef = docFn(db, 'WebsiteChannel', postId);
    await updateDoc(postRef, { content: newContent, timestamp: serverTimestamp() });

    editingPostId = null;
    textareaEl.value = '';
    textareaEl.style.height = `${TEXTAREA_MIN_HEIGHT}px`;
    textareaEl.style.overflowY = 'hidden';
    textareaEl.placeholder = 'Escribe algo';

    showPublishSuccess(publishElements);
  } catch (error) {
    console.error('Error al actualizar post:', error);
    hidePublishOverlay(publishElements.overlay);
    alert('Error al actualizar. Intenta de nuevo.');
  } finally {
    if (buttonEl) buttonEl.disabled = false;
    textareaEl.focus();
  }
}

/**
 * Establece, cambia o elimina la reacción del usuario en un post.
 * @param {string} postId
 * @param {string|null} emoji - Emoji a establecer o null para quitar
 */
 
async function setReaction(postId, emoji) {
  if (!currentUserUID || auth.currentUser?.isAnonymous) return;

  if (emoji && !isValidEmoji(emoji)) return;

  try {
    const { doc: docFn, getDoc, updateDoc } = await import('./firebase-config.js');
    const postRef = docFn(db, 'WebsiteChannel', postId);

    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;

    // Obtenemos el objeto de reacciones o creamos uno nuevo
    const reactions = postSnap.data().reactions || {};

    if (emoji) {
      reactions[currentUserUID] = emoji; // Añadimos/cambiamos reacción
    } else {
      delete reactions[currentUserUID];  // Quitamos reacción
    }

    await updateDoc(postRef, { reactions });
    if (navigator.vibrate) navigator.vibrate(emoji ? 50 : [30, 20, 30]);

  } catch (error) {
    console.error('Error al establecer reacción:', error);
  }
}

// ==================== SELECTOR DE EMOJIS (CON TECLADO NATIVO) ====================

/**
 * Abre el selector de emojis cerca de una burbuja.
 * Incluye botón "+" para abrir teclado nativo de emojis.
 */
function openEmojiPicker(articleElement, postId, currentEmoji) {
  const existing = document.getElementById('emojiPickerOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'emoji-picker-overlay';
  overlay.id = 'emojiPickerOverlay';

  const picker = document.createElement('div');
  picker.className = 'emoji-picker';
  picker.id = 'emojiPicker';

  // Emojis predeterminados
  REACTION_EMOJIS.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.className = 'emoji-picker__btn';
    if (emoji === currentEmoji) btn.classList.add('emoji-picker__btn--selected');
    btn.textContent = emoji;
    btn.type = 'button';
    btn.setAttribute('aria-label', `Reaccionar con ${emoji}`);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleEmojiSelection(postId, emoji, currentEmoji, overlay);
    });
    picker.appendChild(btn);
  });

  // Botón "+" para teclado nativo de emojis
  const plusBtn = document.createElement('button');
  plusBtn.className = 'emoji-picker__btn';
  plusBtn.textContent = '+';
  plusBtn.type = 'button';
  plusBtn.setAttribute('aria-label', 'Abrir teclado de emojis');
  plusBtn.style.fontSize = '18px';
  plusBtn.style.fontWeight = '700';
  plusBtn.style.color = '#6B7280';
  plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openNativeEmojiInput(postId, currentEmoji, overlay);
  });
  picker.appendChild(plusBtn);

  overlay.appendChild(picker);
  document.body.appendChild(overlay);

  // Vibración al abrir
  if (navigator.vibrate) navigator.vibrate(20);

  requestAnimationFrame(() => positionPickerNearElement(picker, articleElement));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/**
 * Maneja la selección de un emoji predeterminado.
 */
function handleEmojiSelection(postId, emoji, currentEmoji, overlay) {
  if (emoji === currentEmoji) {
    setReaction(postId, null);
  } else {
    setReaction(postId, emoji);
  }
  overlay.remove();
}

/**
 * Abre un input nativo para capturar cualquier emoji del teclado.
 */
function openNativeEmojiInput(postId, currentEmoji, overlay) {
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'text';
  input.setAttribute('enterkeyhint', 'done');
  input.style.position = 'fixed';
  input.style.top = '-100px';
  input.style.left = '0';
  input.style.width = '1px';
  input.style.height = '1px';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  input.setAttribute('aria-hidden', 'true');

  document.body.appendChild(input);

  // Timeout para que el DOM se actualice antes del focus
  setTimeout(() => {
    input.focus();

    // En Android, abrir el teclado y esperar emoji
    const handleInput = () => {
      const value = input.value.trim();
      if (value && isValidEmoji(value)) {
        handleEmojiSelection(postId, value, currentEmoji, overlay);
      }
      cleanup();
    };

    const handleBlur = () => {
      // Si no se seleccionó nada, solo limpiar
      setTimeout(cleanup, 200);
    };

    const cleanup = () => {
      input.removeEventListener('input', handleInput);
      input.removeEventListener('blur', handleBlur);
      if (input.parentNode) input.remove();
    };

    input.addEventListener('input', handleInput);
    input.addEventListener('blur', handleBlur);
  }, 100);
}

/**
 * Posiciona el selector de emojis cerca de la burbuja.
 */
function positionPickerNearElement(picker, element) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const pickerWidth = Math.min(picker.offsetWidth || 440, viewportWidth - 32);
  const pickerHeight = 56;
  const gap = 8;

  let left = rect.left + rect.width / 2 - pickerWidth / 2;
  if (left < 16) left = 16;
  if (left + pickerWidth > viewportWidth - 16) left = viewportWidth - pickerWidth - 16;

  const spaceAbove = rect.top;
  const spaceBelow = viewportHeight - rect.bottom;
  let top;

  if (spaceBelow >= pickerHeight + gap) {
    top = rect.bottom + gap;
  } else if (spaceAbove >= pickerHeight + gap) {
    top = rect.top - pickerHeight - gap;
  } else {
    top = viewportHeight / 2 - pickerHeight / 2;
  }

  picker.style.left = `${left}px`;
  picker.style.top = `${top}px`;
}

// ==================== GESTOS DE POST ====================

function setupPostGestures(article, container, postId, content, userReaction) {
  let pressTimer = null;
  let lastTapTime = 0;
  const DOUBLE_TAP_DELAY = 300;
  const LONG_PRESS_DURATION = 500;

  // Doble tap → selector de emojis
  article.addEventListener('click', async (event) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
      event.preventDefault();
      event.stopPropagation();

      if (currentUserUID && !auth.currentUser?.isAnonymous) {
        openEmojiPicker(article, postId, userReaction);
      }

      lastTapTime = 0;
      return;
    }

    lastTapTime = now;
  });

  // Click prolongado → menú contextual (solo admins)
  if (isAuthorized) {
    const startPress = () => {
      pressTimer = setTimeout(() => {
        openPostOptionsMenu(article, postId, content);
      }, LONG_PRESS_DURATION);
    };

    const cancelPress = () => clearTimeout(pressTimer);

    article.addEventListener('touchstart', startPress, { passive: true });
    article.addEventListener('touchend', cancelPress);
    article.addEventListener('touchmove', cancelPress);
    article.addEventListener('mousedown', startPress);
    article.addEventListener('mouseup', cancelPress);
    article.addEventListener('mouseleave', cancelPress);

    article.addEventListener('contextmenu', (event) => event.preventDefault());
  }
}

// ==================== CAMBIO DE TEMA ====================

/**
 * Configura el botón de cambio de tema (claro/oscuro).
 * Usa localStorage para persistir la preferencia.
 * Ícono: ☁️ (claro) / 🌙 (oscuro)
 */
// ==================== CAMBIO DE TEMA ====================

/** SVG: Ícono de nube (tema claro) */
const CLOUD_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun-icon lucide-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
`;

/** SVG: Ícono de luna (tema oscuro) */
const MOON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-moon-icon lucide-moon"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
`;

/**
 * Configura el botón de cambio de tema (claro/oscuro).
 * Usa SVGs inline en lugar de Material Symbols.
 * Persiste en localStorage.
 */
function setupThemeToggle() {
  if (!changeTheme) return;
  const iconContainer = changeTheme.querySelector('.header__pill-icon');
  if (!iconContainer) return;

  // Leer tema guardado
  const savedTheme = localStorage.getItem('channel-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Aplicar tema inicial
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    iconContainer.innerHTML = MOON_SVG;
  } else {
    document.documentElement.removeAttribute('data-theme');
    iconContainer.innerHTML = CLOUD_SVG;
  }

  // Cambiar tema al hacer clic
  changeTheme.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      iconContainer.innerHTML = CLOUD_SVG;
      localStorage.setItem('channel-theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      iconContainer.innerHTML = MOON_SVG;
      localStorage.setItem('channel-theme', 'dark');
    }
  });
}

// ==================== INICIALIZACIÓN ====================

function init() {
  removeSampleContent();
  loadChannelSettings();
  loadFeedPosts();
  setupShareButton();
  setupOptionsButton();
  setupThemeToggle();

  window.addEventListener('authStateChanged', () => {
    updateTextareaVisibility();
    invalidateConfigCache();
  });

  updateTextareaVisibility();
}

// ==================== TEXTAREA CONDICIONAL ====================

function updateTextareaVisibility() {
  if (!textareaContainer) return;

  if (isAuthorized) {
    textareaContainer.innerHTML = `
      <div class="textarea-wrapper">
        <textarea class="textarea" id="textarea" placeholder="Escribe algo" aria-label="Enviar nuevo Post a Firebase" rows="1"></textarea>
      </div>
      <button class="send-button" id="sendButton" title="Enviar publicación" aria-label="Enviar publicación" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send-horizontal-icon lucide-send-horizontal"><path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/></svg>
      </button>
    `;
    refreshTextareaEvents();
  } else {
    textareaContainer.innerHTML = `
      <div class="textarea-wrapper" style="justify-content: center; padding: 8px 5px;">
        <p style="margin: 0; font-size: 14px; color: #6B7280; text-align: center;">
          Solo el propietario y los administradores pueden enviar contenido al canal.
        </p>
      </div>
    `;
  }
}

function refreshTextareaEvents() {
  const newTextarea = document.getElementById('textarea');
  const newSendButton = document.getElementById('sendButton');
  if (!newTextarea || !newSendButton) return;

  newTextarea.addEventListener('input', () => {
    newTextarea.style.height = `${TEXTAREA_MIN_HEIGHT}px`;
    const scrollHeight = newTextarea.scrollHeight;
    const newHeight = Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT);
    newTextarea.style.height = `${newHeight}px`;
    newTextarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    
    // ✅ Si el textarea se vacía completamente en modo edición, 
    // no cancelamos la edición (el usuario puede querer borrar y reescribir)
    // Solo restauramos el placeholder si no hay modo edición
    if (!editingPostId && newTextarea.value.trim() === '') {
      newTextarea.placeholder = 'Escribe algo';
    }
  });

  newSendButton.addEventListener('click', () => publishPost(newTextarea, newSendButton));

  newTextarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      publishPost(newTextarea, newSendButton);
    }
  });
}

// ==================== RENDERIZADO DEL UI + FEED ====================

async function loadChannelSettings() {
  try {
    const { doc: docFn, getDoc: getDocFn, setDoc: setDocFn } = await import('./firebase-config.js');
    const docRef = docFn(db, 'SettingsChannel', SETTINGS_DOC_ID);
    const docSnap = await getDocFn(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      channelConfigCache = data;

      if (data['avatar-channel']) avatarIMG.src = data['avatar-channel'];
      if (data['channel-name']) channelName.textContent = data['channel-name'];

      const { updateLoginModalInfo } = await import('./login.js');
      updateLoginModalInfo(
        data['avatar-channel'] || 'img/default-profile-channel.jpg',
        data['channel-name'] || 'Don Nadie'
      );
    } else {
      const defaultConfig = {
        'owner-uid': '4AhcSTXjspRA3H8EI2EyDrQYif33',
        'avatar-channel': 'img/default-profile-channel.jpg',
        'channel-name': 'Don Nadie',
        'authorized-uids': ['4AhcSTXjspRA3H8EI2EyDrQYif33'],
        'subscriber-count': 0
      };
      await setDocFn(docRef, defaultConfig);
      channelConfigCache = defaultConfig;
    }
  } catch (error) {
    console.error('Error al cargar configuración del canal:', error);
  }
}

async function executeConfigCommand(command, textareaEl, buttonEl) {
  const { doc: docFn, setDoc: setDocFn } = await import('./firebase-config.js');
  const docRef = docFn(db, 'SettingsChannel', SETTINGS_DOC_ID);
  if (buttonEl) buttonEl.disabled = true;

  try {
    switch (command.type) {
      case 'config-avatar':
        if (!command.value || !isValidURL(command.value)) {
          alert('La URL del avatar no es válida.');
          if (buttonEl) buttonEl.disabled = false;
          return;
        }
        await setDocFn(docRef, { 'avatar-channel': command.value }, { merge: true });
        avatarIMG.src = command.value;
        invalidateConfigCache();
        const { updateLoginModalInfo: u1 } = await import('./login.js');
        u1(command.value, channelName.textContent);
        break;

      case 'config-name':
        if (!command.value || command.value.trim() === '') {
          alert('El nombre del canal no puede estar vacío.');
          if (buttonEl) buttonEl.disabled = false;
          return;
        }
        await setDocFn(docRef, { 'channel-name': command.value.trim() }, { merge: true });
        channelName.textContent = command.value.trim();
        invalidateConfigCache();
        const { updateLoginModalInfo: u2 } = await import('./login.js');
        u2(avatarIMG.src, command.value.trim());
        break;

      default:
        console.warn('Comando de configuración no reconocido:', command.type);
    }

    textareaEl.value = '';
    textareaEl.style.height = `${TEXTAREA_MIN_HEIGHT}px`;
    textareaEl.style.overflowY = 'hidden';
  } catch (error) {
    console.error('Error al ejecutar comando de configuración:', error);
    alert('Error al actualizar la configuración. Intenta de nuevo.');
  } finally {
    if (buttonEl) buttonEl.disabled = false;
    textareaEl.focus();
  }
}

function removeSampleContent() {
  if (samplePost) samplePost.remove();
  if (sampleDateChip) sampleDateChip.remove();
}

async function loadFeedPosts() {
  try {
    const q = query(channelCollection, orderBy('timestamp', 'asc'));

    // Si ya hay un listener activo, lo limpiamos para evitar duplicados
    if (feedUnsubscribe) {
      feedUnsubscribe();
    }

    // onSnapshot mantiene una conexión en tiempo real
    feedUnsubscribe = onSnapshot(q, async (querySnapshot) => {
      channelFeed.innerHTML = '';

      if (querySnapshot.empty) {
        renderEmptyState();
        versionStatus();
        return;
      }

      const posts = [];
      querySnapshot.forEach((docSnap) => {
        posts.push({ id: docSnap.id, ...docSnap.data() });
      });

      await renderAllPosts(posts);
      scrollToBottom();
    });
  } catch (error) {
    console.error('Error al iniciar el feed en tiempo real:', error);
    renderErrorState();
  }
}

// Convertimos la función en asíncrona
async function renderAllPosts(posts) {
  let currentDate = null;

  // Usamos for...of para poder pausar el flujo correctamente por cada elemento
  for (const post of posts) {
    const postDate = getDateFromTimestamp(post.timestamp);
    const postTime = getTimeFromTimestamp(post.timestamp);

    if (postDate !== currentDate) {
      currentDate = postDate;
      renderDateChip(post.timestamp);
    }

    // Esperamos a que el post se renderice por completo antes de pasar al siguiente
    await renderPostBubble(post.content, postTime, post.publisherName, post.id, post.authorUID, post.reactions || {});
  }
}


function renderDateChip(timestamp) {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date();
  const formattedDate = formatDateLong(date);
  const dateChip = document.createElement('div');
  dateChip.className = 'date-post';
  dateChip.textContent = formattedDate;
  channelFeed.appendChild(dateChip);
}

async function renderPostBubble(content, time, publisherName, postId, authorUID, reactions) {
  // ✅ Asegurar que reactions sea un objeto
  const safeReactions = reactions || {};
  const postContainer = document.createElement('div');
  postContainer.className = 'post-container';

  const article = document.createElement('article');
  article.className = 'channel-post';
  article.dataset.postId = postId;

  const contentWithBreaks = content.replace(/\n/g, '<br>');
  const { html } = parseContent(contentWithBreaks);
  const roleChip = await getRoleChip(authorUID);

  article.innerHTML = `
    ${publisherName ? `
      <div class="channel-post__header">
        <span class="channel-post__author">${publisherName}</span>
        ${roleChip}
      </div>
    ` : ''}
    <div class="channel-post__text">${html}</div>
    <div class="post-time">${time}</div>
  `;

  // === NUEVA LÓGICA DE REACCIONES (Sin peticiones a Firebase) ===
  const reactionsDiv = document.createElement('div');
  reactionsDiv.className = 'reactions-post';

  const counts = {};
  let userReaction = null;

  // Procesamos el objeto que ya descargó onSnapshot
  Object.entries(safeReactions).forEach(([uid, emoji]) => {
    counts[emoji] = (counts[emoji] || 0) + 1;
    if (uid === currentUserUID) userReaction = emoji;
  });

  const fragment = document.createDocumentFragment();
  Object.entries(counts).forEach(([emoji, count]) => {
    const chip = document.createElement('div');
    chip.className = 'reaction-chip';
    if (emoji === userReaction) chip.classList.add('reaction-chip--active');

    chip.innerHTML = `
      <span class="reaction-chip__emoji">${emoji}</span>
      <span class="reaction-chip__count">${count}</span>
    `;

    if (currentUserUID && !auth.currentUser?.isAnonymous) {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        setReaction(postId, emoji === userReaction ? null : emoji);
      });
    }

    fragment.appendChild(chip);
  });

  reactionsDiv.appendChild(fragment);
  // ==============================================================

  postContainer.appendChild(article);
  postContainer.appendChild(reactionsDiv);
  channelFeed.appendChild(postContainer);

  setupPostGestures(article, postContainer, postId, content, userReaction);
}

function renderEmptyState() {
  if (document.getElementById('emptyStateMsg')) return;
  const emptyMsg = document.createElement('p');
  emptyMsg.id = 'emptyStateMsg';
  emptyMsg.textContent = 'Este es un espacio inspirado en WhatsApp Channels, pensado para compartir contenido con más libertad.';
  emptyMsg.style.cssText = 'color: #f8cf4a; background: #f93f3f; text-align: center; padding: 10px 20px; font-size: 13px; opacity: 0.9; border-radius: 8px;';
  channelFeed.appendChild(emptyMsg);
}

function versionStatus() {
  if (document.getElementById('versionStatusMsg')) return;
  const vStatus = document.createElement('p');
  vStatus.id = 'versionStatusMsg';
  vStatus.textContent = `El canal "${channelName.textContent}", se encuentra en una versión experimental. Poco a poco se añadirán más funcionalidades.`;
  vStatus.style.cssText = 'color: #333; background: #f7f7f7; text-align: center; padding: 10px 20px; font-size: 13px; opacity: 0.9; border-radius: 8px;';
  channelFeed.appendChild(vStatus);
}

function renderErrorState() {
  const errorMsg = document.createElement('p');
  errorMsg.textContent = 'Error al cargar las publicaciones. Intenta recargar la página.';
  errorMsg.style.cssText = 'color: #FCA5A5; text-align: center; padding: 40px 20px; font-size: 15px;';
  channelFeed.appendChild(errorMsg);
}

// ==================== ENVÍO A FIRESTORE ====================

async function publishPost(textareaEl, buttonEl) {
  const content = textareaEl.value.trim();
  if (!content) return;

  const configCommand = detectConfigCommand(content);
  if (configCommand) {
    await executeConfigCommand(configCommand, textareaEl, buttonEl);
    return;
  }

  if (editingPostId) {
    await updateExistingPost(editingPostId, content, textareaEl, buttonEl);
    return;
  }

  const publishElements = showPublishOverlay();
  if (buttonEl) buttonEl.disabled = true;

  try {
    const publisherName = auth.currentUser?.displayName || `${channelName.textContent}`;
    const docRef = await addDoc(channelCollection, {
      content: content,
      timestamp: serverTimestamp(),
      authorUID: currentUserUID,
      publisherName: publisherName
    });
    
    // ✅ Asegurar que no quede en modo edición
    editingPostId = null;
    textareaEl.placeholder = 'Escribe algo';

    textareaEl.value = '';
    textareaEl.style.height = `${TEXTAREA_MIN_HEIGHT}px`;
    textareaEl.style.overflowY = 'hidden';

    showPublishSuccess(publishElements);
  } catch (error) {
    console.error('Error al publicar:', error);
    hidePublishOverlay(publishElements.overlay);
    alert('Error al publicar. Intenta de nuevo.');
  } finally {
    if (buttonEl) buttonEl.disabled = false;
    textareaEl.focus();
  }
}

// ==================== OVERLAY DE PUBLICACIÓN ====================

function showPublishOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'publish-overlay';
  overlay.id = 'publishOverlay';

  overlay.innerHTML = `
    <div class="publish-spinner-container">
      <div class="publish-spinner" id="publishSpinner"></div>
      <span class="publish-text" id="publishText">Enviando...</span>
    </div>
  `;

  document.body.appendChild(overlay);

  return {
    overlay,
    textEl: document.getElementById('publishText'),
    spinnerEl: document.getElementById('publishSpinner')
  };
}

function showPublishSuccess(elements) {
  const { overlay, textEl, spinnerEl } = elements;
  textEl.textContent = 'Enviado exitosamente';
  spinnerEl.classList.add('publish-spinner--success');

  setTimeout(() => {
    overlay.classList.add('publish-overlay--hidden');
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
    }, 300);
  }, 800);
}

function hidePublishOverlay(overlay) {
  if (overlay && overlay.parentNode) overlay.remove();
}

// ==================== UTILIDADES DE FECHA Y HORA ====================

function getDateFromTimestamp(timestamp) {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date();
  return formatDateLong(date);
}

function getTimeFromTimestamp(timestamp) {
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDateLong(date) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return `${date.getDate()} de ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function scrollToBottom() {
  channelFeed.scrollTop = channelFeed.scrollHeight;
}

// ==================== ARRANQUE ====================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}