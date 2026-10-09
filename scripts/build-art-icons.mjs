import { mkdirSync, writeFileSync } from 'node:fs';

// Original, deliberately asymmetrical ink drawings. The shared glaze and
// rounded line language come from docs/ART_SYSTEM.md, not an icon library.
const drawings = {
  home: `<path d="m4.6 14.1 10.8-8.2 11.9 7.3-1.1 1.7-10.7-6.3-9.8 7z" fill="url(#terracotta)"/><path d="M8.2 14.9 8.4 26l15-.3-.2-11" fill="url(#paper)"/><path d="M13.2 25.8v-6.3c0-3.4 5.3-3.7 5.3-.2v6.4" fill="url(#wood)"/><path d="m10.9 15.6 2.3-.2" stroke="#fff2ce" stroke-width="1.05"/>`,
  rules: `<path d="M5.4 7.2c4.5-1.6 7.7-.8 10.5 1.1 3.2-1.9 6.7-2.3 10.7-.7l-.3 19c-4.2-1.5-7.5-1-10.5.5-3.1-1.8-6.1-2.3-10.5-.8z" fill="url(#paper)"/><path d="m15.9 8.3-.1 18.8M8.5 12.3l4.2.2m-4.2 4.2 4 .2m6.3-4.6 4.2-.5m-4.2 4.7 4.1-.3M8.4 21l4 .3"/><path d="m19.1 21.1 1.4 1.4 2.7-3.2" stroke="#727958"/>`,
  clock: `<path d="M17.4 4.7c7.9.8 12 7.4 10.6 14.8-1.4 7.4-8.7 11-15.6 8.5C6 25.8 2.9 19.7 4.7 13.1 6.3 7.2 11.3 4.1 17.4 4.7z" fill="url(#paper)"/><path d="m16 8.2.1 8.1 5 2.8M8.2 15.8h1.1m6.7 8v-1.1m7.8-6.8h-1.1"/><path d="M8 10c1.7-2.1 3.9-3.1 6.5-3.2" stroke="#fff6db" stroke-width="1.05"/>`,
  settings: `<path d="m12.5 5.1 6.6-.2 1.1 4 3.6 1.5 3.5-1.5 2.3 5.8-3.3 2.3-.9 3.9 2.4 3-5 4-2.9-2.5-4 .5-2.4 3.1-5.6-3.1 1.5-3.8-1.8-3.4-4-.8.4-6.5 4-1.2 2.4-3z" fill="url(#brass)"/><path d="M21.4 16.6c.3 3.1-1.9 5.3-4.8 5.2-2.6-.1-4.7-2.3-4.6-5.1.1-2.7 2.4-4.8 5-4.7 2.5.1 4.1 1.9 4.4 4.6z" fill="url(#paper)"/>`,
  sound_on: `<path d="m5.1 12.6 5.1-.2 6.8-5.1.2 18.4-7-5.1-5-.3z" fill="url(#blue)"/><path d="M21.1 11.6c3.2 2.4 3.1 6.4-.1 8.7m3.6-12.1c5.5 4.2 5.4 11.4-.3 15.5"/><path d="M7 14.6h2.2" stroke="#fff0ca" stroke-width="1.05"/>`,
  sound_off: `<path d="m4.7 12.7 5-.2 6.4-4.8.2 17.8-6.8-4.9-4.7-.3z" fill="url(#blue)"/><path d="m21 12.5 7.1 7.8m-.1-7.9-6.7 8" stroke="#ad5d49"/><path d="M6.5 14.7h2.1" stroke="#fff0ca" stroke-width="1.05"/>`,
  turn: `<path d="M5.5 16.9c-.4-7.6 8.1-13 15.1-9.6 2.7 1.3 4.3 3.2 5.1 5.9m-5.3-1.6 5.7 2.1 1.3-5.6"/><path d="M26.5 18.5c.3 7.5-8.3 12.5-15.2 9.1-2.4-1.2-4.1-3-5-5.4m5.3 1.2-5.9-1.6-1.1 5.6" stroke="#84708c"/><path d="m13.7 15.2 4.4.1-.1 4.2-4.2-.1z" fill="url(#paper)"/>`,
  personal: `<path d="M21 11.6c.2 3.4-1.9 6-4.9 6.1-3 .1-5.2-2.7-5-6 .2-3.2 2.3-5.4 5.2-5.4 2.7.1 4.5 2.2 4.7 5.3z" fill="url(#paper)"/><path d="M10.7 10.3c1-1.9 2.7-2.8 4.7-2.5 2 .4 3.5-.1 4.7-1.1"/><path d="M6.7 26c.5-5.2 4.2-7.7 9.6-7.6 5.1.1 8.7 3.1 9.1 7.9l-18.7-.3z" fill="url(#blue)"/><path d="m11.3 20.6 4.7 2 4.5-1.8" stroke="#fff0ca" stroke-width="1.05"/>`,
  crossed: `<path d="M7 26c8.2-8.5 11.3-12.8 17.9-19.4M24.9 26c-6.8-8.4-11-13.8-18.1-19.6"/><path d="M9.5 12.4c-3.1.6-5.1-1-5.5-4.1 3-.4 4.8 1.1 5.5 4.1zm3.4 4.1c-3.9-.6-5.3 1.8-4.8 4.7 3.1-.1 4.8-1.6 4.8-4.7zm9.7-4.4c3 .5 5-1.3 5.2-4.4-2.9-.4-4.9 1.2-5.2 4.4zm-3.5 4.7c3.2-.8 5.1 1.4 4.7 4.5-3.1-.1-4.7-1.8-4.7-4.5z" fill="url(#olive)"/><path d="m13.4 14.2 5.1 5.6" stroke="#f4dfb1" stroke-width="1.05"/>`,
  tp: `<path d="M13.8 10c.1 2.8-1.5 4.7-3.7 4.6-2.2-.1-3.8-2-3.6-4.4.1-2.6 1.5-4.2 3.7-4.3 2.1-.1 3.5 1.7 3.6 4.1z" fill="url(#paper)"/><path d="M3.9 25.7c.3-5.8 1.9-9 6.1-9.1 3.7-.1 6.5 3.2 6.6 9.5l-12.7-.4z" fill="url(#blue)"/><path d="M25.5 10.2c.1 2.6-1.4 4.7-3.6 4.6-2.3-.1-3.8-2.1-3.7-4.5.2-2.6 1.8-4.1 3.9-4.1 2 .1 3.3 1.7 3.4 4z" fill="url(#paper)"/><path d="M16.5 26c.2-6.3 2.1-9.4 5.5-9.2 4.5.2 6.1 3.6 6.2 9.3z" fill="url(#rose)"/><path d="m13.3 19.8 2.7 2.3 2.3-2.1" stroke="#f5e3bc" stroke-width="1.05"/>`,
  question: `<path d="M17.2 4.8c7.3.5 11.7 6 10.2 13.4-1.4 6.8-7.7 10.8-14.8 8.8C6 25.2 3.2 20 4.5 13.8 5.8 7.5 10.8 4.3 17.2 4.8z" fill="url(#paper)"/><path d="M11.7 12c.7-4.1 8.5-4.3 8.6.2 0 2.7-4.7 3.1-4.5 6.6m.1 3.2h.1"/><path d="m8.6 9.6 1.8-1.4" stroke="#fff5d6" stroke-width="1.05"/>`,
  correct: `<path d="M17.2 4.8c7.3.5 11.7 6 10.2 13.4-1.4 6.8-7.7 10.8-14.8 8.8C6 25.2 3.2 20 4.5 13.8 5.8 7.5 10.8 4.3 17.2 4.8z" fill="url(#paper)"/><path d="m9.4 16.1 4.3 5 9-10.1" stroke="#55735a"/><path d="m8.6 9.6 1.8-1.4" stroke="#fff5d6" stroke-width="1.05"/>`,
  incorrect: `<path d="M17.2 4.8c7.3.5 11.7 6 10.2 13.4-1.4 6.8-7.7 10.8-14.8 8.8C6 25.2 3.2 20 4.5 13.8 5.8 7.5 10.8 4.3 17.2 4.8z" fill="url(#paper)"/><path d="m10.7 10.8 10.7 10.6m-.3-10.8-10.3 11" stroke="#ad5d49"/><path d="m8.6 9.6 1.8-1.4" stroke="#fff5d6" stroke-width="1.05"/>`,
  drink: `<path d="m7 6.8 18-.3-2.3 20.1c-3.6 2-9.6 1.8-13 .1z" fill="url(#glass)"/><path d="M8 13.6c5.2 2.1 10.9 2.3 15.6-.2M11.2 10l1.4 13.8m4.1-13.9.1 14.2m4-14.1-1.1 13.7" stroke="#b68b43"/><path d="M9.2 8.5 10.5 20" stroke="#fff5d4" stroke-width="1.05"/>`,
  double_drink: `<path d="m3.2 7.9 12-.3-1.5 17.3c-2.7 1.5-6.2 1.4-9 0z" fill="url(#glass)"/><path d="m17 6.4 12-.2-1.7 18.7c-2.8 1.5-6.7 1.4-9.3 0z" fill="url(#glass)"/><path d="m4.5 13.5 9.8-.1m3.8-1.3 10 .1m-19-2.1.5 12.2m13.4-14 .2 14.5" stroke="#b68b43"/><path d="m5 10 .6 8.4m13.7-9.6.6 9.1" stroke="#fff4d2" stroke-width="1.05"/>`,
  plus_one: `<path d="m7.1 5.7 18 .6 2.3 19.1-21.9 1.1z" fill="url(#brass)"/><path d="M10.4 15.8h7.3m-3.6-3.6v7.2m6-6.3 2.3-1.7v9"/><path d="m9 8 14.1.6" stroke="#f9ebc7" stroke-width="1.05"/>`,
  finish: `<path d="m8.2 19.8-3.8-9.4 7 3.2 4.5-7.4 4.8 7.5 7-3.1-3.6 9.4z" fill="url(#brass)"/><path d="m8.2 19.8 16-.1-.4 4.8-14.9.3z" fill="url(#wood)"/><path d="m11.2 16.5 1.8.3m6.2 0 1.7-.2" stroke="#fff0bc" stroke-width="1.05"/><path d="M4.9 23.5c.8 3.1 3.1 4.7 5.8 5m16.2-5.2c-.8 3-3 4.6-5.8 5.1" stroke="#727958"/>`,
  connection: `<path d="M4.2 11.8c6.7-6 16.8-6.4 23.8-.3m-19.5 5c4.5-3.8 10.6-3.7 15.1.1m-11.2 4.6c2.2-1.8 5.3-1.8 7.5.1"/><path d="M17.8 25.4c0 1.1-.9 1.8-1.9 1.7-1.1 0-1.8-.8-1.7-1.8 0-1.1.8-1.8 1.8-1.7 1 0 1.8.8 1.8 1.8z" fill="url(#olive)"/><path d="m11.1 7.7 9.4 16.1" stroke="#ad5d49"/>`,
  reconnect: `<path d="M4.2 11.8c6.7-6 16.8-6.4 23.8-.3m-19.5 5c4.5-3.8 10.6-3.7 15.1.1m-11.2 4.6c2.2-1.8 5.3-1.8 7.5.1"/><path d="m12 25 3.1 3.2 6.1-6.7" stroke="#55735a"/>`,
  copy: `<path d="m10 4.8 15.2.5 1.1 20.5-15.8-.2z" fill="url(#paper)"/><path d="m5 9.2 15.9-.5.2 20.3-16.7-.4z" fill="url(#paper)"/><path d="m8.5 13.4 9-.3m-8.9 4.7 8.5-.2m-8.4 4.6 6.3-.1" stroke="#84708c"/>`,
  share: `<path d="m9.5 16.6 11-8m-11 8.4 11.5 7.8"/><path d="M11.6 16.6c.1 2.4-1.7 4.1-4 4-2.3-.1-3.7-1.8-3.7-4.1.1-2.3 1.7-3.8 3.9-3.7 2.3 0 3.8 1.5 3.8 3.8z" fill="url(#olive)"/><path d="M27.5 6.9c.1 2.3-1.5 4-3.8 3.9-2.2-.1-3.8-1.8-3.7-4 .1-2.3 1.7-3.8 3.8-3.7 2.2 0 3.7 1.6 3.7 3.8z" fill="url(#blue)"/><path d="M27.9 25.4c.1 2.2-1.6 3.8-3.7 3.7-2.3-.1-3.8-1.7-3.8-3.9.1-2.2 1.6-3.7 3.8-3.6 2.1.1 3.6 1.6 3.7 3.8z" fill="url(#rose)"/>`,
  back: `<path d="m15.3 7.8-10 8.6 10.1 8.2M6.4 16.4l20-.1"/><path d="m9.8 12.6 4.8-4.1" stroke="#b68b43" stroke-width="1.05"/>`,
  close: `<path d="m8.4 7.9 15.3 16.2M24 8.1 8.5 24.5"/><path d="m10 9.5 3.5 3.6m9-3.5-3.4 3.5" stroke="#d7ba7f" stroke-width="1.05"/>`,
  rotate: `<path d="m10.1 9.5 12.7 1 .1 17-12.7-.9z" fill="url(#paper)"/><path d="m14.9 24.2 3 .2M13.3 13l.1 7" stroke="#b68b43"/><path d="M5.5 15.8C3.6 9.3 7.5 3.9 13.2 3.6m-4.1-1.3 4.9 1.4-2 4.1M27.3 17.3c1.5 6.3-1.9 11.2-7.7 12.1m3.7 1-4.2-1.3 1.4-4"/>`,
  online: `<path d="M5.3 16.3c-.1-6.2 4.3-10.9 10.8-10.9 6.4.1 11 4.7 10.6 11-.2 6.1-4.3 10.4-10.7 10.3-6.2-.1-10.6-4.4-10.7-10.4z" fill="url(#blue)"/><path d="M15.6 5.8c-5.6 5.1-5.4 14.9.5 20.4M17 5.9c5.2 5.6 4.9 14.6-.9 20.5M5.7 16.2l20.6.1" stroke="#f1ddb3"/>`,
  person: `<path d="M20.7 10.4c0 3.1-2 5.3-4.7 5.2-2.8-.1-4.6-2.5-4.4-5.5.1-2.8 2.1-4.7 4.6-4.6 2.7.1 4.5 2 4.5 4.9z" fill="url(#paper)"/><path d="M6.4 25.8c.7-5.5 4.3-8.2 9.7-8.2 5.2.1 8.8 2.8 9.5 8.6z" fill="url(#olive)"/><path d="m10.7 20.6 5 2.1 5.6-2.2" stroke="#fff0ca" stroke-width="1.05"/>`,
  start: `<path d="M15.9 25.9 16 15.8M16 16c-8.1 1.3-11.6-2.7-11.9-8.7 6.9-.7 11.2 2.6 11.9 8.7zm.2-3.1C16.7 6.4 20.4 3.3 26.4 4c-.4 6.4-4.1 9.7-10.2 8.9z" fill="url(#olive)"/><path d="M9.2 27.4c3.2-2 10.3-2 13.6.4" stroke="#b68b43"/><path d="m7.2 9.1 5.7 4.5M23.9 6.3l-4.8 4.2" stroke="#eee0b5" stroke-width="1.05"/>`,
};

const gradients = {
  paper: ['#fff4d6', '#e6cfa2'], terracotta: ['#cc8e69', '#ad604a'], wood: ['#c49a63', '#815233'],
  brass: ['#d5b476', '#a98142'], blue: ['#7794a0', '#426c82'], rose: ['#c49291', '#ac6570'],
  olive: ['#a0a17c', '#727958'], glass: ['#fff0cc', '#dfc393'],
};
for (const directory of ['assets/production/art/icons', 'public/assets/production/art/icons']) mkdirSync(directory, { recursive: true });
for (const [name, drawing] of Object.entries(drawings)) {
  const used = Object.keys(gradients).filter(id => drawing.includes(`url(#${id})`));
  const defs = used.map(id => `<linearGradient id="${id}" x1=".15" y1="0" x2=".65" y2="1"><stop stop-color="${gradients[id][0]}"/><stop offset="1" stop-color="${gradients[id][1]}"/></linearGradient>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs>${defs}</defs><g stroke="#523928" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${drawing}</g></svg>\n`;
  for (const directory of ['assets/production/art/icons', 'public/assets/production/art/icons']) writeFileSync(`${directory}/${name}.svg`, svg);
}
console.log(`Generated ${Object.keys(drawings).length} original art icons and public mirrors.`);
