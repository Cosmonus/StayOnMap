// Mirrors backend/src/features/properties/properties.service.js's
// editedSinceModeration — the rule that lets a REJECTED listing be submitted
// again. Applied client-side only so the button can say WHY it is disabled
// instead of handing the owner a 409; the server enforces it regardless.
// Mirror of frontend/src/features/listings/config/moderation.js.
export function editedSinceModeration(property) {
  if (!property?.moderatedAt) return true
  if (!property.ownerEditedAt) return false
  return new Date(property.ownerEditedAt) > new Date(property.moderatedAt)
}
