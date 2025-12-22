# Firestore Security Rules for Kitchen Invites

Add these rules to your `storage.rules` file or Firebase Console:

```javascript
match /kitchenInvites/{inviteId} {
  // Allow anyone to read invites (needed for validation)
  allow read: if true;

  // Only authenticated users can create invites
  allow create: if request.auth != null
    && request.resource.data.createdBy == request.auth.uid
    && request.resource.data.kitchenId is string
    && request.resource.data.used == false;

  // Only allow updates to mark invite as used (via backend/Cloud Function)
  // For now, we allow updates from authenticated users
  // You may want to restrict this further with Cloud Functions
  allow update: if request.auth != null
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['used'])
    && request.resource.data.used == true;

  // No deletes
  allow delete: if false;
}
```

## Notes

- **Read access**: Public read is needed so users can validate invites when they click the link
- **Create access**: Only authenticated users can create invites, and they must be the creator
- **Update access**: Only allows marking invites as "used" (prevents tampering with other fields)
- **Delete access**: Disabled to maintain invite history

## Optional: More Restrictive Rules

If you want tighter security, you can restrict reads to only the invite creator and the kitchen owner:

```javascript
match /kitchenInvites/{inviteId} {
  allow read: if request.auth != null
    && (resource.data.createdBy == request.auth.uid
        || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.defaultKitchenId == resource.data.kitchenId);

  allow create: if request.auth != null
    && request.resource.data.createdBy == request.auth.uid
    && request.resource.data.kitchenId is string
    && request.resource.data.used == false;

  allow update: if request.auth != null
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['used'])
    && request.resource.data.used == true;

  allow delete: if false;
}
```

However, this requires the user to be authenticated to validate invites, which means unauthenticated users clicking invite links won't be able to validate them until they sign in.
