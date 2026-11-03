(() => {
  'use strict';

  const STORAGE_KEY = 'vertex_growth_system_v3';

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  let client = null;
  let currentUser = null;
  let handlingUserId = null;

  let syncTimer = null;
  let syncInProgress = false;
  let pendingSnapshot = null;

  let realtimeChannel = null;
  let applyingRemoteUpdate = false;

  const accountKey = (userId) =>
    `${STORAGE_KEY}_user_${userId}`;


  // =========================================
  // STATUS
  // =========================================

  function setStatus(message, type = 'muted') {
    const element = $('#vertexAuthStatus');

    if (!element) return;

    element.textContent = message;
    element.dataset.kind = type;
  }


  // =========================================
  // BUTTONS
  // =========================================

  function setButtons(loggedIn) {
    const login = $('#vertexLoginBtn');
    const signup = $('#vertexSignupBtn');
    const logout = $('#vertexLogoutBtn');

    const email = $('#vertexAuthEmail');
    const password = $('#vertexAuthPassword');

    if (login) {
      login.classList.toggle('hidden', loggedIn);
    }

    if (signup) {
      signup.classList.toggle('hidden', loggedIn);
    }

    if (logout) {
      logout.classList.toggle('hidden', !loggedIn);
    }

    if (email) email.disabled = loggedIn;
    if (password) password.disabled = loggedIn;

    const label = $('#vertexAccountLabel');

    if (label) {
      label.textContent = loggedIn
        ? currentUser?.email || 'Hisobga ulangan'
        : 'Mehmon rejimi';
    }
  }


  // =========================================
  // AUTH PANEL
  // =========================================

  function addPanel() {
    const settings = $('#page-settings');

    if (!settings || $('#vertexAuthPanel')) return;

    const layout = $('.settings-layout', settings);

    if (!layout) return;

    const panel = document.createElement('section');

    panel.className =
      'panel settings-panel vertex-auth-panel';

    panel.id = 'vertexAuthPanel';

    panel.innerHTML = `
      <div class="settings-section-head">
        <span class="settings-icon">☁</span>

        <div>
          <h2>Bulutli hisob</h2>
          <p>
            Hisobga kiring va ma’lumotlaringizni
            bulutda saqlang.
          </p>
        </div>
      </div>

      <div
        id="vertexAuthStatus"
        class="vertex-auth-status"
        aria-live="polite"
      >Ulanish tekshirilmoqda...</div>

      <form id="vertexAuthForm" class="settings-form">

        <label for="vertexAuthEmail">
          Email manzili
        </label>

        <input
          id="vertexAuthEmail"
          type="email"
          autocomplete="email"
          maxlength="254"
          placeholder="email@example.com"
          required
        >

        <label for="vertexAuthPassword">
          Parol
        </label>

        <input
          id="vertexAuthPassword"
          type="password"
          autocomplete="current-password"
          minlength="6"
          maxlength="128"
          placeholder="Kamida 6 ta belgi"
          required
        >

        <div class="vertex-auth-actions">

          <button
            class="button primary"
            id="vertexLoginBtn"
            type="submit"
          >Kirish</button>

          <button
            class="button secondary"
            id="vertexSignupBtn"
            type="button"
          >Ro‘yxatdan o‘tish</button>

          <button
            class="button secondary hidden"
            id="vertexLogoutBtn"
            type="button"
          >Chiqish</button>

        </div>
      </form>
    `;

    settings.insertBefore(panel, layout);
  }


  // =========================================
  // REALTIME CLEANUP
  // =========================================

  function removeRealtime() {
    if (!realtimeChannel || !client) return;

    client.removeChannel(realtimeChannel);

    realtimeChannel = null;
  }


  // =========================================
  // CLOUD SAVE
  // =========================================

  async function pushCloud(snapshot) {
    if (!client || !currentUser) return;

    if (syncInProgress) {
      pendingSnapshot = snapshot;
      return;
    }

    syncInProgress = true;

    const userId = currentUser.id;

    try {
      const data = snapshot ||
        window.VertexApp.getState();

      setStatus(
        'Ma’lumotlar bulutga saqlanmoqda...'
      );

      const { error } = await client
        .from('user_data')
        .upsert({
          user_id: userId,
          app_data: data,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      if (currentUser?.id === userId) {
        setStatus(
          '✓ Ma’lumotlar bulutda saqlandi.',
          'success'
        );
      }

    } catch (error) {
      console.error(
        'VERTEX cloud sync:',
        error
      );

      if (currentUser?.id === userId) {
        setStatus(
          'Bulutga saqlash amalga oshmadi. Internet va Supabase sozlamalarini tekshiring.',
          'error'
        );
      }

    } finally {
      syncInProgress = false;

      if (pendingSnapshot && currentUser) {
        const nextSnapshot = pendingSnapshot;

        pendingSnapshot = null;

        pushCloud(nextSnapshot);
      }
    }
  }


  // =========================================
  // CLOUD LOAD
  // =========================================

  async function loadCloud(user) {
    const { data, error } = await client
      .from('user_data')
      .select('app_data')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;

    return data?.app_data ?? null;
  }


  // =========================================
  // REALTIME SYNC
  // =========================================

  function subscribeRealtime(user) {

    removeRealtime();

    realtimeChannel = client
      .channel(`vertex-user-${user.id}`)

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_data',
          filter: `user_id=eq.${user.id}`
        },

        (payload) => {

          if (currentUser?.id !== user.id) return;

          if (!payload.new?.app_data) return;

          const app = window.VertexApp;

          if (!app) return;

          const remoteData = payload.new.app_data;
          const localData = app.getState();

          // Bir xil ma'lumotni qayta qo'llamaymiz.
          if (
            JSON.stringify(remoteData) ===
            JSON.stringify(localData)
          ) {
            return;
          }

          try {

            applyingRemoteUpdate = true;

            app.setState(
              remoteData,
              accountKey(user.id)
            );

            setStatus(
              '✓ Boshqa qurilmadagi o‘zgarishlar sinxronlandi.',
              'success'
            );

          } catch (error) {

            console.error(
              'VERTEX realtime update:',
              error
            );

            setStatus(
              'Sinxronlashda xatolik yuz berdi.',
              'error'
            );

          } finally {

            applyingRemoteUpdate = false;

          }
        }
      )

      .subscribe((status) => {

        console.log(
          'VERTEX realtime:',
          status
        );

        if (status === 'SUBSCRIBED') {

          setStatus(
            '✓ Real-time sinxronlash faol.',
            'success'
          );

        }

        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT'
        ) {

          setStatus(
            'Real-time ulanishda xatolik. Internetni tekshiring.',
            'error'
          );

        }
      });
  }


  // =========================================
  // ACCOUNT SESSION
  // =========================================

  async function applySession(user) {

    const app = window.VertexApp;

    if (!app || !client) return;

    // LOGOUT / GUEST MODE
    if (!user) {

      removeRealtime();

      currentUser = null;
      pendingSnapshot = null;

      clearTimeout(syncTimer);

      if (app.getGuestState) {

        app.setState(
          app.getGuestState(),
          STORAGE_KEY
        );

      }

      setButtons(false);

      setStatus(
        'Mehmon rejimi. Ma’lumotlar ushbu qurilmada saqlanadi.'
      );

      return;
    }


    // SAME USER
    if (currentUser?.id === user.id) {

      setButtons(true);

      return;
    }


    // PREVENT DUPLICATE SESSION
    if (handlingUserId === user.id) return;

    handlingUserId = user.id;

    try {

      // Old session cleanup
      removeRealtime();

      clearTimeout(syncTimer);

      pendingSnapshot = null;

      currentUser = null;

      setStatus(
        'Hisob ma’lumotlari yuklanmoqda...'
      );

      const cloudData = await loadCloud(user);

      // Account could have changed while loading.
      const {
        data: sessionData,
        error: sessionError
      } = await client.auth.getSession();

      if (sessionError) throw sessionError;

      if (
        sessionData.session?.user?.id !== user.id
      ) {
        return;
      }

      const key = accountKey(user.id);


      // EXISTING CLOUD DATA
      if (cloudData !== null) {

        currentUser = user;

        app.setState(
          cloudData,
          key
        );

        setStatus(
          '✓ Hisobga kirildi. Bulutdagi ma’lumotlar yuklandi.',
          'success'
        );

      } else {

        // GUEST DATA MIGRATION
        const guestData = app.getGuestState();

        const hasGuestData = Boolean(
          guestData.habits?.length ||
          guestData.logs?.length ||
          guestData.tasks?.length
        );

        let useGuestData = false;

        if (hasGuestData) {

          useGuestData = confirm(
            'Ushbu qurilmada mehmon ma’lumotlari bor. ' +
            'OK bossangiz, ular hisobingizga ko‘chiriladi. ' +
            'Cancel bossangiz, hisob yangi ma’lumotlar bilan boshlanadi.'
          );

        }

        currentUser = user;

        if (useGuestData) {

          app.setState(
            guestData,
            key
          );

        } else {

          app.setState(
            {},
            key
          );

        }

        setButtons(true);

        await pushCloud(app.getState());

      }


      // ENABLE REALTIME
      setButtons(true);

      subscribeRealtime(user);

    } catch (error) {

      console.error(
        'VERTEX account loading:',
        error
      );

      setStatus(
        'Hisob ma’lumotlarini yuklab bo‘lmadi. ' +
        'Supabase jadvali va RLS sozlamalarini tekshiring.',
        'error'
      );

    } finally {

      handlingUserId = null;

    }
  }


  // =========================================
  // LOGIN
  // =========================================

  async function login() {

    const email =
      $('#vertexAuthEmail')?.value.trim();

    const password =
      $('#vertexAuthPassword')?.value;

    if (!email || !password) {

      setStatus(
        'Email va parolni kiriting.',
        'error'
      );

      return;
    }

    setStatus('Hisobga kirilmoqda...');

    const { error } = await client.auth
      .signInWithPassword({
        email,
        password
      });

    if (error) {

      console.error(
        'VERTEX login:',
        error
      );

      setStatus(
        'Kirish amalga oshmadi: ' +
        error.message,
        'error'
      );

      return;
    }

    setStatus(
      'Kirish muvaffaqiyatli.',
      'success'
    );
  }


  // =========================================
  // SIGNUP
  // =========================================

  async function signup() {

    const email =
      $('#vertexAuthEmail')?.value.trim();

    const password =
      $('#vertexAuthPassword')?.value;

    if (!email || !password) {

      setStatus(
        'Email va parolni kiriting.',
        'error'
      );

      return;
    }

    if (password.length < 6) {

      setStatus(
        'Parol kamida 6 ta belgidan iborat bo‘lishi kerak.',
        'error'
      );

      return;
    }

    setStatus('Hisob yaratilmoqda...');

    const { data, error } = await client.auth
      .signUp({
        email,
        password
      });

    if (error) {

      console.error(
        'VERTEX signup:',
        error
      );

      setStatus(
        'Ro‘yxatdan o‘tish amalga oshmadi: ' +
        error.message,
        'error'
      );

      return;
    }

    if (!data.session) {

      setStatus(
        'Hisob yaratildi. Email manzilingizni tasdiqlang, so‘ng tizimga kiring.',
        'success'
      );

    } else {

      setStatus(
        'Hisob yaratildi. Ma’lumotlar yuklanmoqda...',
        'success'
      );

    }
  }


  // =========================================
  // LOGOUT
  // =========================================

  async function logout() {

    if (!client || !currentUser) return;

    setStatus('Hisobdan chiqilmoqda...');

    const { error } = await client.auth.signOut();

    if (error) {

      console.error(
        'VERTEX logout:',
        error
      );

      setStatus(
        'Hisobdan chiqishda xatolik: ' +
        error.message,
        'error'
      );

      return;
    }

    setStatus(
      'Hisobdan chiqildi.',
      'success'
    );
  }


  // =========================================
  // AUTOMATIC CLOUD SYNC
  // =========================================

  function bindSync() {

    window.addEventListener(
      'vertex:state-saved',

      (event) => {

        // Ignore remote updates.
        if (applyingRemoteUpdate) return;

        if (!currentUser) return;

        if (
          event.detail?.storageKey !==
          accountKey(currentUser.id)
        ) {
          return;
        }

        clearTimeout(syncTimer);

        syncTimer = setTimeout(() => {

          pushCloud(event.detail.state);

        }, 800);

      }
    );
  }


  // =========================================
  // INITIALIZATION
  // =========================================

  async function init() {

    addPanel();

    if (
      !window.supabase ||
      !window.VERTEX_SUPABASE_URL ||
      !window.VERTEX_SUPABASE_KEY ||
      window.VERTEX_SUPABASE_URL.includes('YOUR_') ||
      window.VERTEX_SUPABASE_KEY.includes('YOUR_')
    ) {

      setStatus(
        'Supabase sozlamalari kiritilmagan. supabase-config.js faylini tekshiring.',
        'error'
      );

      return;
    }

    if (!$('#vertexAuthForm')) {

      console.error(
        'VERTEX auth panel topilmadi.'
      );

      return;
    }


    // CREATE SUPABASE CLIENT
    client = window.supabase.createClient(
      window.VERTEX_SUPABASE_URL,
      window.VERTEX_SUPABASE_KEY
    );


    // LOGIN FORM
    $('#vertexAuthForm').addEventListener(
      'submit',

      async (event) => {

        event.preventDefault();

        await login();

      }
    );


    // SIGNUP BUTTON
    $('#vertexSignupBtn').addEventListener(
      'click',
      signup
    );


    // LOGOUT BUTTON
    $('#vertexLogoutBtn').addEventListener(
      'click',
      logout
    );


    // AUTO SYNC
    bindSync();


    // CHECK SESSION
    const {
      data,
      error
    } = await client.auth.getSession();

    if (error) {

      setStatus(
        'Hisob holatini tekshirib bo‘lmadi.',
        'error'
      );

      console.error(error);

      return;
    }


    // LOAD EXISTING SESSION
    await applySession(
      data.session?.user || null
    );


    // AUTH STATE LISTENER
    client.auth.onAuthStateChange(
      (_event, session) => {

        setTimeout(() => {

          applySession(
            session?.user || null
          );

        }, 0);

      }
    );

  }


  // =========================================
  // START APP
  // =========================================

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

})();
