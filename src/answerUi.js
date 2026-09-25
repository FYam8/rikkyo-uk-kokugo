import {parseTextParts} from './textAnswer.js';
export const KANA_OPTIONS=['ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ'];

export function choiceOptions(format){
  if(!Array.isArray(format?.tokens)) return KANA_OPTIONS;
  const values=format.tokens.map(String);
  if(!values.length||values.some(x=>!x||/[|・→\s]/u.test(x))||new Set(values).size!==values.length)
    throw new Error('Invalid choice tokens');
  return values;
}

export function answerTokens(raw,options=KANA_OPTIONS){
  const text=String(raw??'');
  if(!text) return [];
  const escaped=[...options].sort((a,b)=>b.length-a.length).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if(!escaped.length) return [];
  return text.match(new RegExp(escaped.join('|'),'gu'))||[];
}

export function kanaTokens(raw){return answerTokens(raw);}


export function parsePartAnswer(raw,count,options=KANA_OPTIONS){
  const s=String(raw??'');
  if(s.includes('|')){
    const parts=s.split('|').slice(0,count);
    while(parts.length<count) parts.push('');
    return parts.map(v=>answerTokens(v,options)[0]||'');
  }
  const tokens=answerTokens(s,options);
  return Array.from({length:count},(_,i)=>tokens[i]||'');
}

export function serializePartAnswer(parts){
  return parts.map(v=>String(v??'')).join('|');
}

export function setPartAnswer(raw,index,token,count,options=KANA_OPTIONS){
  const parts=parsePartAnswer(raw,count,options);
  parts[index]=parts[index]===token?'':token;
  return serializePartAnswer(parts);
}

export function toggleSetAnswer(raw,token,options=KANA_OPTIONS){
  const tokens=[...new Set(answerTokens(raw,options))];
  const i=tokens.indexOf(token);
  if(i>=0) tokens.splice(i,1); else tokens.push(token);
  return tokens.join('・');
}

export function appendOrderAnswer(raw,token,options=KANA_OPTIONS){
  const tokens=answerTokens(raw,options);
  if(tokens.includes(token)) return tokens.join('→');
  return [...tokens,token].join('→');
}

export function undoOrderAnswer(raw,options=KANA_OPTIONS){
  const tokens=answerTokens(raw,options);
  tokens.pop();
  return tokens.join('→');
}


export function isChoiceIndexSelected(value,index){
  if(value===null||value===undefined||value==='') return false;
  const n=Number(value);
  return Number.isInteger(n)&&n===Number(index);
}

export function displayAnswer(raw,format){
  if(raw===undefined||raw===null||raw==='') return '';
  if(format?.kind==='text-parts') return parseTextParts(raw,Number(format.parts||1)).map(v=>v||'—').join(' / ');
  if(format?.kind==='parts'){
    return parsePartAnswer(raw,Number(format.parts||0),choiceOptions(format)).map(v=>v||'—').join(' / ');
  }
  return String(raw);
}

