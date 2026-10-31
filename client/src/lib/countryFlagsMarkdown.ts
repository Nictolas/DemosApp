/**
 * Adds flag emojis to the first prose mention of each country in an opinion detail.
 * Presentation-only: no changes to canonical IDs, answers or stored opinion text.
 * Existing Markdown link labels and destinations are kept untouched.
 */
const COUNTRIES: ReadonlyArray<readonly [string, string]> = [
  ["Paesi Bassi","🇳🇱"],
  ["Nuova Zelanda","🇳🇿"],
  ["Regno Unito","🇬🇧"],
  ["Stati Uniti d'America","🇺🇸"],
  ["Stati Uniti","🇺🇸"],
  ["Corea del Sud","🇰🇷"],
  ["Repubblica Ceca","🇨🇿"],
  ["Arabia Saudita","🇸🇦"],
  ["Sudafrica","🇿🇦"],
  ["Italia","🇮🇹"],
  ["Irlanda","🇮🇪"],
  ["Germania","🇩🇪"],
  ["Francia","🇫🇷"],
  ["Spagna","🇪🇸"],
  ["Estonia","🇪🇪"],
  ["Belgio","🇧🇪"],
  ["Finlandia","🇫🇮"],
  ["Svezia","🇸🇪"],
  ["Danimarca","🇩🇰"],
  ["Norvegia","🇳🇴"],
  ["Portogallo","🇵🇹"],
  ["Canada","🇨🇦"],
  ["Australia","🇦🇺"],
  ["Svizzera","🇨🇭"],
  ["Giappone","🇯🇵"],
  ["Austria","🇦🇹"],
  ["Polonia","🇵🇱"],
  ["Ungheria","🇭🇺"],
  ["Lussemburgo","🇱🇺"],
  ["Slovenia","🇸🇮"],
  ["Croazia","🇭🇷"],
  ["Slovacchia","🇸🇰"],
  ["Cina","🇨🇳"],
  ["Brasile","🇧🇷"],
  ["Grecia","🇬🇷"],
  ["Turchia","🇹🇷"],
  ["Ucraina","🇺🇦"],
  ["Russia","🇷🇺"],
  ["India","🇮🇳"],
  ["Messico","🇲🇽"],
  ["Argentina","🇦🇷"],
  ["Olanda","🇳🇱"],
];
const flags = new Map(COUNTRIES.map(([name, flag]) => [name.toLocaleLowerCase("it"), flag]));
// All names contain only letters, spaces and apostrophes (no regex metacharacters).
const countriesPattern = COUNTRIES.map(([name]) => name).sort((a, b) => b.length - a.length).join("|");
const countryMention = new RegExp(`(^|[^\\p{L}\\p{N}])(${countriesPattern})(?=$|[^\\p{L}\\p{N}])`, "giu");
const markdownLink = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;

export function addCountryFlagsToMarkdown(markdown: string): string {
  const seen = new Set<string>();
  return markdown
    .split(markdownLink)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(countryMention, (match, prefix: string, name: string, offset: number, full: string) => {
        const key = name.toLocaleLowerCase("it");
        const flag = flags.get(key);
        if (!flag || seen.has(key)) return match;
        seen.add(key);
        if (full.slice(Math.max(0, offset - 8), offset).includes(flag)) return match;
        return `${prefix}${flag} ${name}`;
      });
    })
    .join("");
}
