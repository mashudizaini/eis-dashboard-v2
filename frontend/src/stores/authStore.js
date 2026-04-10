import { create } from 'zustand';

const IS_DEV = import.meta.env.VITE_DEV_MODE === 'true' || import.meta.env.DEV;

const DEV_USER = {
  name: 'IT Admin (Dev)',
  email: 'admin@ckd-otto.com',
  username: 'admin.dev',
  roles: ['admin', 'it_staff'],
};

const useAuthStore = create((set, get) => ({
  keycloak: null,
  authenticated: false,
  user: null,
  token: null,
  loading: true,

  init: async () => {
    // ── Dev mode: skip Keycloak entirely ──
    if (IS_DEV) {
      set({
        authenticated: true,
        user: DEV_USER,
        token: 'dev-token',
        loading: false,
      });
      return;
    }

    // ── Production: use Keycloak ──
    try {
      const Keycloak = (await import('keycloak-js')).default;
      const keycloak = new Keycloak({
        url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080/auth',
        realm: import.meta.env.VITE_KEYCLOAK_REALM || 'ckdo',
        clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'eis-dashboard',
      });

      const authenticated = await keycloak.init({
        onLoad: 'login-required',
        checkLoginIframe: false,
        pkceMethod: 'S256',
      });

      if (authenticated) {
        const profile = await keycloak.loadUserProfile();
        set({
          keycloak,
          authenticated: true,
          user: {
            name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.username,
            email: profile.email,
            username: profile.username,
            roles: keycloak.realmAccess?.roles || [],
          },
          token: keycloak.token,
          loading: false,
        });

        setInterval(async () => {
          try {
            const refreshed = await keycloak.updateToken(60);
            if (refreshed) set({ token: keycloak.token });
          } catch {
            keycloak.login();
          }
        }, 30000);
      }
    } catch (err) {
      console.error('Keycloak init failed:', err);
      set({ loading: false });
    }
  },

  logout: () => {
    const { keycloak } = get();
    if (keycloak) {
      keycloak.logout({ redirectUri: window.location.origin });
    } else {
      // Dev mode: just reload
      window.location.reload();
    }
  },
}));

export default useAuthStore;
