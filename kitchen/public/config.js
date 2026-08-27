/** Configure standalone local development or the unified /kitchen mount. */
(function configureKitchen() {
  const isUnified = window.location.pathname.startsWith('/kitchen');
  const portalOrigin =
    window.location.port === '3005' || window.location.port === '3002'
      ? 'http://localhost:3000'
      : window.location.origin;

  window.KITCHEN_UNIFIED_LOGIN_URL = `${portalOrigin}/login?system=kitchen`;
  window.KITCHEN_API_BASE = isUnified ? '/kitchen' : '';
  window.KITCHEN_BASE_PATH = isUnified ? '/kitchen/' : '';
})();
