export function isPermissionDeniedError(error: unknown) {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'permission-denied'
  );
}

export function toFirebaseErrorMessage(error: unknown, fallback: string) {
  if (isPermissionDeniedError(error)) {
    return 'Missing Firestore access. Make sure you are signed in with an owner or assistant profile and that firestore.rules is deployed.';
  }

  return error instanceof Error ? error.message : fallback;
}
