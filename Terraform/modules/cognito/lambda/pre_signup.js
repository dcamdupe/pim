// Cognito Pre Sign-up trigger (UBE-39). Federated sign-in (Google) auto-provisions a Cognito
// user on first login, invoking this trigger as part of that provisioning - this is the
// standard place to enforce an allow-list for a Google-federated pool, since Google itself will
// authenticate anyone with a Google account. ALLOWED_EMAILS is a comma-separated env var (see
// ../main.tf); anyone not on it never gets a Cognito user created, so they can never sign in.
exports.handler = async (event) => {
  const allowedEmails = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const email = (event.request.userAttributes.email || '').toLowerCase();

  if (!allowedEmails.includes(email)) {
    throw new Error('Access is restricted.');
  }

  // Google has already verified the email and authenticated the user - Cognito's own
  // confirmation/verification step would just be a redundant extra hop for a federated user.
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;

  return event;
};
