export function canAddListing(activeListingsCount) {
  return activeListingsCount < 3
}

export function getListingLimitMessage(count) {
  if (count >= 3) return 'You have reached the maximum of 3 listings.'
  return `${3 - count} listing slot${3 - count === 1 ? '' : 's'} remaining.`
}
