/* Google sign-in for Drive sync. Fill these from Google Cloud Console → APIs & Services → Credentials
   (project clearli-8c132). Client IDs are public by design; the Desktop "secret" is not a real secret
   for installed apps (Google documents this), it's only used together with PKCE. */
window.GCONFIG = {
  webClientId: '',      // OAuth client type "Web application"  — used by the web dashboard
  appClientId: '',      // OAuth client type "Desktop app"      — used by the Android app (stays signed in)
  appClientSecret: '',
};
