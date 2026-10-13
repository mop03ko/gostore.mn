'use strict';
// Code 39: locally rendered, readable by standard USB/Bluetooth barcode scanners.
function code39(value){
  const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*';
  const patterns=['nnnwwnwnn','wnnwnnnnw','nnwwnnnnw','wnwwnnnnn','nnnwwnnnw','wnnwwnnnn','nnwwwnnnn','nnnwnnwnw','wnnwnnwnn','nnwwnnwnn','wnnnnwnnw','nnwnnwnnw','wnwnnwnnn','nnnnwwnnw','wnnnwwnnn','nnwnwwnnn','nnnnnwwnw','wnnnnwwnn','nnwnnwwnn','nnnnwwwnn','wnnnnnnww','nnwnnnnww','wnwnnnnwn','nnnnwnnww','wnnnwnnwn','nnwnwnnwn','nnnnnnwww','wnnnnnwwn','nnwnnnwwn','nnnnwnwwn','wwnnnnnnw','nwwnnnnnw','wwwnnnnnn','nwnnwnnnw','wwnnwnnnn','nwwnwnnnn','nwnnnnwnw','wwnnnnwnn','nwwnnnwnn','nwnwnwnnn','nwnwnnnwn','nwnnnwnwn','nnnwnwnwn','nwnnwnwnn'];
  if(!/^[A-Z0-9-]{1,50}$/.test(value))return '';
  let x=12,bars='';for(const c of '*'+value+'*'){const p=patterns[alphabet.indexOf(c)];for(let i=0;i<9;i++){const w=p[i]==='w'?3:1;if(i%2===0)bars+=`<rect x="${x}" y="0" width="${w}" height="48"/>`;x+=w;}x++;}
  return `<svg class="code-bar" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x+12} 64" role="img" aria-label="${value}"><rect width="100%" height="100%" fill="white"/><g fill="black">${bars}</g><text x="${(x+12)/2}" y="61" text-anchor="middle" fill="black" font-size="9" font-family="monospace">${value}</text></svg>`;
}
