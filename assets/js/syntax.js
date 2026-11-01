/* Синтактично оцветяване за Arduino/C++.
   Слоят е точно под textarea и споделя неговите размери и превъртане. */
(function(){
 "use strict";
 const keywords=new Set(("alignas alignof asm auto bool break case catch char class const constexpr const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator private protected public register reinterpret_cast return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while").split(/\s+/));
 const types=new Set(("String StringSumHelper HardwareSerial Stream Print File IPAddress byte word size_t uint8_t uint16_t uint32_t int8_t int16_t int32_t").split(/\s+/));
 const builtins=new Set(("setup loop pinMode digitalWrite digitalRead analogRead analogWrite delay delayMicroseconds millis micros attachInterrupt detachInterrupt pulseIn shiftIn shiftOut tone noTone random randomSeed map constrain min max abs pow sqrt sin cos tan Serial Serial1 Serial2 Serial3 Wire SPI EEPROM PROGMEM HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN A0 A1 A2 A3 A4 A5 F_CPU").split(/\s+/));
 const re=/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|^\s*#\s*[A-Za-z_]\w*|\b(?:0[xX][\da-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)[uUlLfF]*\b|[A-Za-z_]\w*|::|->|==|!=|<=|>=|&&|\|\||\+\+|--|[{}()[\]<>+*/%=&|!~^?:;,.#-]/gm;
 function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
 function bracketPair(text,pos){
  let ch=text[pos];if("{}[]()".indexOf(ch)<0){if("{}[]()".indexOf(text[pos-1])>=0){pos--;ch=text[pos];}else return [];}
  const pairs={"(":")","[":"]","{":"}"},forward=!!pairs[ch],target=forward?pairs[ch]:({"}":"{","]":"[",")":"("})[ch],step=forward?1:-1;
  let depth=0;
  for(let i=pos;i>=0&&i<text.length;i+=step){const c=text[i];if(c===ch)depth++;if(c===target){depth--;if(depth===0)return [pos,i];}}
  return [];
 }
 function render(editor){
  const wrap=editor.parentNode;let layer=wrap.querySelector("#syntax-layer");
  if(!layer){layer=document.createElement("pre");layer.id="syntax-layer";layer.setAttribute("aria-hidden","true");wrap.insertBefore(layer,editor);}
  const source=editor.value||"",pair=bracketPair(source,editor.selectionStart),marks=new Set(pair);
  let html="",last=0,m;re.lastIndex=0;
  while((m=re.exec(source))){
   if(m.index>last)html+=esc(source.slice(last,m.index));
   const token=m[0];let cls="";
   if(token.startsWith("//")||token.startsWith("/*"))cls="tok-comment";
   else if(token[0]==='"'||token[0]==="'")cls="tok-string";
   else if(/^\s*#/.test(token))cls="tok-preproc";
   else if(/^(?:0[xX]|0[bB]|\d)/.test(token))cls="tok-number";
   else if(keywords.has(token))cls="tok-keyword";
   else if(types.has(token))cls="tok-type";
   else if(builtins.has(token))cls="tok-builtin";
   else if(/^[A-Za-z_]\w*$/.test(token)&&/^\s*\(/.test(source.slice(re.lastIndex)))cls="tok-function";
   if(cls)html+='<span class="'+cls+'">';
   for(let j=0;j<token.length;j++){const absolute=m.index+j;if(marks.has(absolute))html+='<span class="tok-bracket">';html+=esc(token[j]);if(marks.has(absolute))html+="</span>";}
   if(cls)html+="</span>";
   last=re.lastIndex;if(token.length===0)re.lastIndex++;
  }
  html+=esc(source.slice(last));layer.innerHTML=html+"\n";
  layer.scrollTop=editor.scrollTop;layer.scrollLeft=editor.scrollLeft;
 }
 window.A7Syntax={render};
})();