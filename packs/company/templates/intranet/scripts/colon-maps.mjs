// A list item YAML read as a map because its text holds ": ".
//
// `- Revenue: 2M` in a list of bullets is the map { Revenue: "2M" }, and the page that prints the
// bullet shows "[object Object]". It parses, builds and deploys cleanly; only a reader finds it.
// An unquoted single value (`title: Lead: Sam`) does not parse at all, so the read in
// check-content.mjs already catches that one: what is left is the list item.
//
// A list of records is legitimate YAML too (`- label: Site` with `href:` under it), so an item is
// only flagged when it is a map of one key holding one plain value, and something says it was a
// bullet: the list also holds plain strings, the key is a phrase (it has a space), or the list's
// one-key items do not share their key.

const plain = (x) => x === null || ['string', 'number', 'boolean'].includes(typeof x) || x instanceof Date;
const isMap = (x) => x !== null && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Date);

/** The paths (`key_facts[1]`, `links[0].notes[2]`) of every list item that looks like a bullet read as a map. */
export function colonMaps(v, at = '') {
  const out = [];
  if (Array.isArray(v)) {
    const oneKey = v.filter((x) => isMap(x) && Object.keys(x).length === 1 && plain(Object.values(x)[0]));
    const bullets = v.some((x) => typeof x === 'string') || new Set(oneKey.map((x) => Object.keys(x)[0])).size > 1;
    v.forEach((x, i) => {
      const path = `${at}[${i}]`;
      if (oneKey.includes(x) && (bullets || /\s/.test(Object.keys(x)[0]))) out.push(path);
      else out.push(...colonMaps(x, path));
    });
  } else if (isMap(v)) {
    for (const [k, x] of Object.entries(v)) out.push(...colonMaps(x, at ? `${at}.${k}` : k));
  }
  return out;
}

/** The sentence a check prints for one such item. */
export const colonMapProblem = (path, item) =>
  `${path} reads as a map (${JSON.stringify(item)}), so the page shows "[object Object]": quote the line, ` +
  `- "${Object.keys(item)[0]}: ${Object.values(item)[0]}"`;
