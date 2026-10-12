import crypto from "node:crypto";

/*
 * Every vault gets a platform-generated secret of identical shape and
 * difficulty: ADJECTIVE-NOUN-NNNN. Defenders never choose (or see in advance)
 * the value, so nobody can pick an "easy to hide" secret, and the three
 * fragments give a natural unit for partial-leak scoring.
 *
 * Words are deliberately uncommon so a vault is unlikely to say one by accident.
 */
const ADJECTIVES = [
  "OBSIDIAN", "VERMILION", "CERULEAN", "SAFFRON", "UMBER", "COBALT", "JADEITE", "CRIMSON",
  "AMBERED", "GLACIAL", "SILENT", "HOLLOW", "MOLTEN", "VELVET", "FERAL", "GILDED",
  "BRASSY", "RUSTED", "SPECTRAL", "LUNAR", "BOREAL", "TIDAL", "ASHEN", "IVORY",
  "SABLE", "ONYX", "CINDER", "QUARTZ", "ZEPHYR", "NOMAD", "ARCTIC", "MIDNIGHT",
  "SCARLET", "TAWNY", "OCHRE", "INDIGO", "COPPER", "PEWTER", "FROSTED", "THORNY",
  "DUSKY", "EMBER", "PHANTOM", "WOVEN", "SUNKEN", "IRONCLAD", "PRISMATIC", "VOLCANIC",
];

const NOUNS = [
  "FALCON", "MARIGOLD", "QUASAR", "LANTERN", "HARBOR", "ORCHID", "KESTREL", "TUNDRA",
  "MONSOON", "GLACIER", "CITADEL", "LABYRINTH", "PHOENIX", "MERIDIAN", "NEBULA", "ANVIL",
  "TRIDENT", "SPHINX", "BASILISK", "COMPASS", "PAGODA", "MINARET", "OBELISK", "CANYON",
  "WALRUS", "MONGOOSE", "PELICAN", "IGUANA", "JACKAL", "HERON", "OCELOT", "MANTIS",
  "TEMPEST", "AVALANCHE", "ECLIPSE", "AURORA", "MAELSTROM", "CYCLONE", "DYNAMO", "PISTON",
  "PARCHMENT", "CHALICE", "GAUNTLET", "SCEPTER", "ZEPPELIN", "GONDOLA", "CARAVAN", "BEACON",
];

const pick = <T,>(arr: T[]) => arr[crypto.randomInt(arr.length)];

function number4() {
  for (;;) {
    const n = crypto.randomInt(1000, 10000).toString();
    // Avoid trivially guessable shapes (1111, 1234, 4321, 2020...).
    if (new Set(n).size < 3) continue;
    if ("0123456789".includes(n) || "9876543210".includes(n)) continue;
    if (n.slice(0, 2) === n.slice(2)) continue;
    return n;
  }
}

export function generateSecret(avoid: string[] = []): { secret: string; fragments: string[] } {
  for (;;) {
    const fragments = [pick(ADJECTIVES), pick(NOUNS), number4()];
    const clash = avoid.some((s) => fragments.some((f) => s.includes(f)));
    if (clash) continue;
    return { secret: fragments.join("-"), fragments };
  }
}

/** A throwaway secret for defenders to rehearse against in the sandbox. */
export function practiceSecret() {
  return generateSecret();
}
