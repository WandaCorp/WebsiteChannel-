// ============================================
// login.js
// Sistema de autenticación: Email/Google/Apple
// Modal obligatorio + verificación de roles
// Seguridad y validación de campos sensibles
// ============================================

import {
  auth,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  googleProvider,
  appleProvider,
  signInAnonymously,
  db,
  doc,
  getDoc,
  setDoc,
  increment
} from './firebase-config.js';

export { auth } from './firebase-config.js';

import { avatarIMG, channelName, header, subscribers } from './script-basic.js';

// ==================== CONSTANTES ====================

/** ID del documento de configuración */
const SETTINGS_DOC_ID = 'channel-items';

/** Referencia al documento de configuración en Firestore */
const settingsDocRef = doc(db, 'SettingsChannel', SETTINGS_DOC_ID);

/** Estado global de autorización (para que ui.js lo consulte) */
export let isAuthorized = false;

/** UID del usuario logeado actualmente */
export let currentUserUID = null;
/** Estado global: ¿es propietario? */
export let isOwner = false;

// ==================== CREACIÓN DEL MODAL ====================

/**
 * Crea el overlay y modal de login y los inyecta en el body.
 * El modal no se puede cerrar sin iniciar sesión.
 * Si ya existe un modal, no crea otro.
 */
function createLoginModal() {
  // Evitar duplicados
  if (document.getElementById('loginOverlay')) return;

  // --- Overlay ---
  const overlay = document.createElement('div');
  overlay.className = 'login-overlay';
  overlay.id = 'loginOverlay';

  // --- Modal ---
  overlay.innerHTML = `
    <div class="login-modal" id="loginModal">
      <!-- Header -->
      <div class="login-modal__header">
        <img
          class="login-modal__icon"
          src="${avatarIMG.src}"
          alt="Avatar del canal"
          loading="lazy"
        >
        <h2 class="login-modal__title">${channelName.textContent}</h2>
        <p class="login-modal__subtitle">Inicia sesión para acceder al canal y ver las publicaciones.</p>
      </div>

      <!-- Error general -->
      <div class="login-error" id="loginError"></div>

      <!-- Formulario Email/Contraseña -->
      <form class="login-form" id="loginForm" novalidate autocomplete="on">
        <div class="login-form__group">
          <label class="login-form__label" for="loginEmail">Correo electrónico</label>
          <input
            class="login-form__input"
            type="email"
            id="loginEmail"
            placeholder="correo@ejemplo.com"
            autocomplete="email"
            required
          >
          <p class="login-form__error" id="emailError"></p>
        </div>

        <div class="login-form__group">
          <label class="login-form__label" for="loginPassword">Contraseña</label>
          <input
            class="login-form__input"
            type="password"
            id="loginPassword"
            placeholder="••••••••"
            autocomplete="current-password"
            required
            minlength="6"
          >
          <p class="login-form__error" id="passwordError"></p>
        </div>

        <button class="login-form__submit" type="submit" id="loginSubmit">
          Iniciar sesión
        </button>
      </form>

      <!-- Divisor -->
      <div class="login-divider">
        <div class="login-divider__line"></div>
        <span class="login-divider__text">O</span>
        <div class="login-divider__line"></div>
      </div>

      <!-- Botones sociales -->
      <div class="login-social">
        <button class="login-social__btn" id="googleLogin" type="button">
          <svg class="login-social__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Iniciar sesión con Google
        </button>

        <button class="login-social__btn" id="appleLogin" type="button">
          <svg class="login-social__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="currentColor"/>
          </svg>
          Iniciar sesión con Apple
        </button>
        
        <!-- Botón invitado -->
      <button class="login-social__btn" id="guestLogin" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-round-icon lucide-user-round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
        Iniciar sesión como invitado
      </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // --- Event Listeners ---
  setupLoginFormListeners();
}

// ==================== VALIDACIÓN DE CAMPOS ====================

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeInput(input) {
  return input.replace(/[<>"'`]/g, '').trim();
}

function showFieldError(errorElement, message) {
  errorElement.textContent = message;
}

function clearAllErrors() {
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const loginError = document.getElementById('loginError');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');

  if (emailError) emailError.textContent = '';
  if (passwordError) passwordError.textContent = '';
  if (loginError) loginError.classList.remove('login-error--visible');
  if (loginEmail) loginEmail.classList.remove('login-form__input--error');
  if (loginPassword) loginPassword.classList.remove('login-form__input--error');
}

function showGeneralError(message) {
  const errorEl = document.getElementById('loginError');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('login-error--visible');
  }
}

function validateForm(email, password) {
  let isValid = true;
  clearAllErrors();

  if (!email) {
    showFieldError(document.getElementById('emailError'), 'El correo es obligatorio.');
    document.getElementById('loginEmail')?.classList.add('login-form__input--error');
    isValid = false;
  } else if (!isValidEmail(email)) {
    showFieldError(document.getElementById('emailError'), 'Ingresa un correo válido.');
    document.getElementById('loginEmail')?.classList.add('login-form__input--error');
    isValid = false;
  }

  if (!password) {
    showFieldError(document.getElementById('passwordError'), 'La contraseña es obligatoria.');
    document.getElementById('loginPassword')?.classList.add('login-form__input--error');
    isValid = false;
  } else if (password.length < 6) {
    showFieldError(document.getElementById('passwordError'), 'Mínimo 6 caracteres.');
    document.getElementById('loginPassword')?.classList.add('login-form__input--error');
    isValid = false;
  }

  return isValid;
}

// ==================== EVENT LISTENERS DEL MODAL ====================

function setupLoginFormListeners() {
  const loginForm = document.getElementById('loginForm');
  const googleBtn = document.getElementById('googleLogin');
  const appleBtn = document.getElementById('appleLogin');
  const submitBtn = document.getElementById('loginSubmit');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAllErrors();

      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');
      if (!emailInput || !passwordInput) return;

      const email = sanitizeInput(emailInput.value);
      const password = passwordInput.value;

      if (!validateForm(email, password)) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verificando...';
      }

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        handleAuthError(error);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Iniciar sesión';
        }
      }
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      googleBtn.disabled = true;
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        handleAuthError(error);
        googleBtn.disabled = false;
      }
    });
  }

  if (appleBtn) {
    appleBtn.addEventListener('click', async () => {
      appleBtn.disabled = true;
      try {
        await signInWithPopup(auth, appleProvider);
      } catch (error) {
        handleAuthError(error);
        appleBtn.disabled = false;
      }
    });
  }
  
  // Invitado
const guestBtn = document.getElementById('guestLogin');
if (guestBtn) {
  guestBtn.addEventListener('click', async () => {
    guestBtn.disabled = true;
    try {
      await signInAnonymously(auth);
    } catch (error) {
      handleAuthError(error);
      guestBtn.disabled = false;
    }
  });
}
  
}

// ==================== MANEJO DE ERRORES ====================

function handleAuthError(error) {
  console.error('Error de autenticación:', error);

  const errorMessages = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/invalid-email': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No existe una cuenta con este correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-email-format': 'El formato del correo no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/popup-closed-by-user': 'Ventana cerrada. Intenta de nuevo.',
    'auth/popup-blocked': 'Permite ventanas emergentes en tu navegador.',
    'auth/account-exists-with-different-credential': 'Ya existe una cuenta con otro método de inicio.'
  };

  showGeneralError(errorMessages[error.code] || 'Error al iniciar sesión. Intenta de nuevo.');
}

// ==================== VERIFICACIÓN DE ROL ====================
async function checkAuthorization(uid) {
  try {
    const docSnap = await getDoc(settingsDocRef);

    if (!docSnap.exists()) {
      await setDoc(settingsDocRef, {
        'owner-uid': '4AhcSTXjspRA3H8EI2EyDrQYif33',
        'avatar-channel': 'img/default-profile-channel.jpg',
        'channel-name': 'Don Nadie',
        'authorized-uids': ['4AhcSTXjspRA3H8EI2EyDrQYif33'],
        'subscriber-count': 0
      });
      const isOwnerResult = uid === '4AhcSTXjspRA3H8EI2EyDrQYif33';
      isOwner = isOwnerResult;
      return isOwnerResult || uid === '4AhcSTXjspRA3H8EI2EyDrQYif33';
    }

    const data = docSnap.data();
    const ownerUID = data['owner-uid'];
    const authorizedUids = data['authorized-uids'] || [];
    
    isOwner = ownerUID === uid;
    return isOwner || authorizedUids.includes(uid);
  } catch (error) {
    console.error('Error al verificar autorización:', error);
    return false;
  }
}

// ==================== MODAL VISIBILITY ====================

function hideLoginModal() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.remove();
      }
    }, 300);
  }
}

// ==================== OBSERVADOR DE AUTH ====================

function setupAuthObserver() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const isNewLogin = currentUserUID === null;

      currentUserUID = user.uid;
      isAuthorized = await checkAuthorization(user.uid);
      
      if (isNewLogin && !user.isAnonymous) {
        await incrementSubscriberCount(user.uid);
      }

      hideLoginModal();

      window.dispatchEvent(new CustomEvent('authStateChanged', {
        detail: { isAuthorized, uid: user.uid }
      }));

      console.log(`Usuario: ${user.email} | Autorizado: ${isAuthorized} | Nuevo: ${isNewLogin}`);
    } else {
      if (currentUserUID) {
       await decrementSubscriberCount(currentUserUID);
      }

      currentUserUID = null;
      isAuthorized = false;

      createLoginModal();

      window.dispatchEvent(new CustomEvent('authStateChanged', {
        detail: { isAuthorized: false, uid: null }
      }));

      console.log('Usuario no logeado');
    }
  });
}

// ==================== ACTUALIZAR MODAL ====================
export { abandonChannel };
export function updateLoginModalInfo(avatarSrc, channelNameText) {
  const modalIcon = document.querySelector('.login-modal__icon');
  const modalTitle = document.querySelector('.login-modal__title');

  if (modalIcon) modalIcon.src = avatarSrc;
  if (modalTitle) modalTitle.textContent = channelNameText;
}

// ==================== CONTADOR DE SUSCRIPTORES ====================
async function incrementSubscriberCount(uid) {
  try {
    const docSnap = await getDoc(settingsDocRef);
    const data = docSnap.exists() ? docSnap.data() : {};
    
    // Obtenemos el array de suscritos (si no existe, creamos uno vacío)
    const subscribedUids = data['subscribed-uids'] || [];

    // Solo incrementamos si este usuario NO está en la lista
    if (!subscribedUids.includes(uid)) {
      subscribedUids.push(uid); // Añadimos el UID
      
      await setDoc(settingsDocRef, {
        'subscriber-count': increment(1),
        'subscribed-uids': subscribedUids
      }, { merge: true });
      
      await updateSubscriberDisplay();
    }
  } catch (error) {
    console.error('Error al incrementar suscriptores:', error);
  }
}

/**
 * Decrementa el contador de suscriptores y limpia el UID del array.
 * @param {string} uid - UID del usuario que abandona
 */
async function decrementSubscriberCount(uid) {
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const currentCount = data['subscriber-count'] || 0;
    const subscribedUids = data['subscribed-uids'] || [];

    // Solo decrementar si el UID está en la lista y hay al menos 1
    if (currentCount > 0 && subscribedUids.includes(uid)) {
      const updatedUids = subscribedUids.filter(id => id !== uid);
      
      await setDoc(settingsDocRef, {
        'subscriber-count': increment(-1),
        'subscribed-uids': updatedUids
      }, { merge: true });
    }
    
    await updateSubscriberDisplay();
  } catch (error) {
    console.error('Error al decrementar suscriptores:', error);
  }
}

/**
 * Abandona el canal completamente:
 * - Elimina UID de subscribed-uids
 * - Decrementa contador
 * - Elimina todas las reacciones del usuario
 * - Cierra sesión
 * @param {string} uid - UID del usuario
 */
async function abandonChannel(uid) {
  try {
    // 1. Eliminar todas las reacciones del usuario
    await deleteAllUserReactions(uid);
    
    // 2. Decrementar contador y limpiar UID
    await decrementSubscriberCount(uid);
    
    // 3. Cerrar sesión
    await signOut(auth);
    
    console.log('Usuario abandonó el canal:', uid);
  } catch (error) {
    console.error('Error al abandonar canal:', error);
    throw error;
  }
}

/**
 * Elimina todas las reacciones de un usuario en todos los posts.
 * Ahora funciona con el modelo de mapa reactions: { uid: emoji }
 * @param {string} uid - UID del usuario
 */
async function deleteAllUserReactions(uid) {
  try {
    const { collection, getDocs, doc, updateDoc } = await import('./firebase-config.js');
    
    // Obtener todos los posts
    const postsSnapshot = await getDocs(collection(db, 'WebsiteChannel'));
    
    // Para cada post, eliminar la reacción del usuario del mapa
    const updatePromises = [];
    
    postsSnapshot.forEach((postDoc) => {
      const data = postDoc.data();
      const reactions = data.reactions || {};
      
      // Solo actualizar si el usuario tiene reacción en este post
      if (reactions[uid]) {
        delete reactions[uid];
        const postRef = doc(db, 'WebsiteChannel', postDoc.id);
        updatePromises.push(
          updateDoc(postRef, { reactions }).catch((error) => {
            console.warn('Error al limpiar reacción de', uid, 'en post', postDoc.id, error);
          })
        );
      }
    });
    
    await Promise.all(updatePromises);
    console.log('Reacciones eliminadas para:', uid);
  } catch (error) {
    console.error('Error al eliminar reacciones:', error);
  }
}

/**
 * Escucha cambios en tiempo real del contador de suscriptores.
 * Usa onSnapshot para reflejar cambios sin recargar.
 */
async function setupSubscriberListener() {
  const { onSnapshot } = await import('./firebase-config.js');
  
  // Como onSnapshot necesita imports dinámicos, lo envolvemos
  import('./firebase-config.js').then(({ onSnapshot }) => {
    onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const count = docSnap.data()['subscriber-count'] || 0;
        const safeCount = Math.max(0, count);
        
        if (subscribers) {
          subscribers.textContent = `Canal • ${safeCount} ${safeCount === 1 ? 'seguidor' : 'seguidores'}`;
        }
      }
    }, (error) => {
      console.error('Error en listener de suscriptores:', error);
    });
  });
}

/**
 * Actualiza el display de suscriptores (usado como respaldo).
 */
async function updateSubscriberDisplay() {
  try {
    const docSnap = await getDoc(settingsDocRef);
    const count = docSnap.exists() ? (docSnap.data()['subscriber-count'] || 0) : 0;
    const safeCount = Math.max(0, count);

    if (subscribers) {
      subscribers.textContent = `Canal • ${safeCount} ${safeCount === 1 ? 'seguidor' : 'seguidores'}`;
    }
  } catch (error) {
    console.error('Error al actualizar display:', error);
  }
}

// ==================== INICIALIZACIÓN ====================
function init() {
  let initialCheckDone = false;

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!initialCheckDone) {
      initialCheckDone = true;

      if (user) {
        
        if (user.isAnonymous) {
          await signOut(auth);
          createLoginModal();
          setupSubscriberListener();
          unsubscribe();
          setupAuthObserver();
          return;
        }
        
        // Solo marcar el UID, NO incrementar aquí
        currentUserUID = user.uid;
        isAuthorized = await checkAuthorization(user.uid);
        
        await updateSubscriberDisplay();
        
        window.dispatchEvent(new CustomEvent('authStateChanged', {
          detail: { isAuthorized, uid: user.uid }
        }));
        
        setupSubscriberListener();

        console.log(`Sesión restaurada: ${user.email} | Autorizado: ${isAuthorized}`);
      } else {
        await updateSubscriberDisplay();
        createLoginModal();
      }

      unsubscribe();
      setupAuthObserver();
    }
  });
}

// Arranque
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}