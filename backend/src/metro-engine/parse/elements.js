// Index a raw Overpass element array into the three shapes the parser
// consumes. Pure; the raw envelope's `elements` goes in, nothing is mutated.
export function indexElements(elements) {
  const nodesById = new Map()
  const masters = []
  const routes = []
  for (const el of elements) {
    if (el.type === 'node') nodesById.set(el.id, el)
    else if (el.type === 'relation' && el.tags?.type === 'route_master') masters.push(el)
    else if (el.type === 'relation' && el.tags?.type === 'route') routes.push(el)
  }
  return { nodesById, masters, routes }
}
