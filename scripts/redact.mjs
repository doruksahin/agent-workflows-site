// Redaction for knowledge base folders that are synced from private sources. Each match of a disclosure
// rule becomes a black bar of the same length, so the text keeps its shape but not its value.
export const BAR = '█';
export const redactText = (text, rules) => rules.reduce((t, r) => t.replace(r.re, m => BAR.repeat(Math.max(m.length, 4))), text);
const matches = (text, rules) => rules.some(r => { r.re.lastIndex = 0; return r.re.test(text); });

/** Redacts every string, and every number that matches a rule (it becomes a string). Keys are kept. */
export function redactJson(value, rules) {
  if (typeof value === 'string') return redactText(value, rules);
  if (typeof value === 'number') return matches(String(value), rules) ? redactText(String(value), rules) : value;
  if (Array.isArray(value)) return value.map(v => redactJson(v, rules));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactJson(v, rules)]));
  return value;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^ {0,3}\1[`~]*[ \t]*$/gm;
/** Applies fn to the Markdown outside fenced code blocks. */
const outsideFences = (md, fn) => {
  let out = '', last = 0;
  for (const m of md.matchAll(FENCE)) { out += fn(md.slice(last, m.index)) + m[0]; last = m.index + m[0].length; }
  return out + fn(md.slice(last));
};

/** Unlinks Markdown links (not images) whose target is private or leaves the synced folder: keeps the text. */
export const unlinkPrivate = (md, rules, leavesFolder) => outsideFences(md, part =>
  part.replace(/(?<!!)\[([^\]]*)\]\(\s*(<[^>]*>|[^\s)]+)(?:\s+"[^"]*")?\s*\)/g, (link, text, url) => {
    const target = url.replace(/^<|>$/g, '');
    return matches(target, rules) || leavesFolder(target) ? text : link;
  }));

/** Splits a leading "# Title" from the body. */
export function takeTitle(md) {
  const m = md.match(/^\s*# +(.+?)\s*#*\s*\n/);
  return m ? { title: m[1], body: md.slice(m[0].length).replace(/^\s*\n/, '') } : { title: null, body: md };
}

/** Lifts a leading prose paragraph into one plain line for the page lead: { lead, body }. */
export function liftLead(md) {
  const m = md.match(/^\s*([\s\S]*?)(?:\n\s*\n|\s*$)/);
  const p = m?.[1].trim();
  if (!p || /^(?:[#|>*\-+`~]|\d+\.|!\[|<)/.test(p)) return { lead: null, body: md };
  const lead = p.replace(/\s*\n\s*/g, ' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`([^`]*)`/g, '$1').replace(/([*_]{1,2})([^*_]+)\1/g, '$2');
  return { lead, body: md.slice(m[0].length) };
}
