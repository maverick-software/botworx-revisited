// Keep chip labels bounded without splitting a Unicode code point.
export function compactLabel(value:string,limit=20){const characters=Array.from(value);return characters.length>limit?characters.slice(0,limit-1).join('')+'…':value;}
