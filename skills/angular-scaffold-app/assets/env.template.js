// Copy to src/assets/env.template.js. The container entrypoint runs envsubst to produce assets/environment/env.js.
(function (window) {
  window.env = window.env || {};

  window['env']['frontUri'] = '${FRONT_URI}';
  window['env']['apiUri'] = '${API_URI}';
  window['env']['authUri'] = '${AUTH_URI}';
  window['env']['scope'] = '${ACCESS_REQUEST_SCOPE}';
  window['env']['connectionString'] = '${APPINSIGHTS_CONNECTION_STRING}';
  window['env']['appRoleName'] = '${APP_ROLE_NAME}';
})(this);
