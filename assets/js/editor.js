/* Редакторът управлява много документи, редактиране, подсказки и навигация. */
(function(){
  "use strict";
  const textarea=document.getElementById("code-editor"), numbers=document.getElementById("line-numbers");
  // CodeMirror 5 заменя стария textarea-overlay редактор; API адаптерът запазва
  // съвместимостта с командите на Arduino Studio 7.
  const cm=CodeMirror.fromTextArea(textarea,{
    mode:"text/x-c++src",theme:"default",lineNumbers:true,indentUnit:2,tabSize:2,
    indentWithTabs:false,lineWrapping:false,matchBrackets:true,styleActiveLine:true,
    foldGutter:true,gutters:["CodeMirror-linenumbers","CodeMirror-foldgutter"],
    autofocus:false,viewportMargin:20,extraKeys:{
      "Ctrl-/":"toggleComment","Cmd-/":"toggleComment",
      "Ctrl-Space":function(editor){if(window.A7Editor)window.A7Editor.complete();},
      "Ctrl-Q":"toggleComment"
    }
  });
  const wrapper=cm.getWrapperElement(),inputField=cm.getInputField();
  numbers.style.display="none";
  const editor={
    get value(){return cm.getValue();},set value(v){cm.setValue(v==null?"":String(v));},
    get selectionStart(){return cm.indexFromPos(cm.getCursor("from"));},
    get selectionEnd(){return cm.indexFromPos(cm.getCursor("to"));},
    set selectionStart(v){const p=cm.posFromIndex(v);cm.setCursor(p);},
    set selectionEnd(v){const p=cm.posFromIndex(v);cm.setCursor(p);},
    get scrollTop(){return cm.getScrollInfo().top;},set scrollTop(v){cm.scrollTo(null,v);},
    get scrollLeft(){return cm.getScrollInfo().left;},set scrollLeft(v){cm.scrollTo(v,null);},
    get style(){return wrapper.style;},get title(){return wrapper.title;},set title(v){wrapper.title=v;},
    focus(){cm.focus();},getBoundingClientRect(){return wrapper.getBoundingClientRect();},
    setSelectionRange(s,e){cm.setSelection(cm.posFromIndex(s),cm.posFromIndex(e));},
    setRangeText(value,start,end,mode){
      const a=cm.posFromIndex(start),b=cm.posFromIndex(end),text=String(value);
      cm.replaceRange(text,a,b,"+input");
      const finish=start+text.length;
      if(mode==="select")cm.setSelection(cm.posFromIndex(start),cm.posFromIndex(finish));
      else if(mode==="start")cm.setCursor(cm.posFromIndex(start));
      else cm.setCursor(cm.posFromIndex(finish));
    },
    addEventListener(type,fn){
      const send=(event)=>fn(event||{target:textarea});
      if(type==="input"){cm.on("change",()=>send({target:textarea}));return;}
      if(type==="scroll"){cm.on("scroll",()=>send({target:textarea}));return;}
      if(type==="click"){wrapper.addEventListener(type,send);return;}
      if(type==="contextmenu"||type==="mousemove"||type==="mousedown"){wrapper.addEventListener(type,send);return;}
      if(type==="keydown"||type==="keyup"){inputField.addEventListener(type,send);return;}
      wrapper.addEventListener(type,send);
    }
  };

  const tabs=document.getElementById("tabbar"), label=document.getElementById("active-file-label");
  const cursor=document.getElementById("cursor-position");
  let documents=[], activeId=null, bookmarks=new Map(), hintTimer=null, popup=null, context=null, fontSize=13, wrap=false;
  const extCode=/\.(ino|cpp|c|h|hpp)$/i;
  const uid=()=> "d"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  function current(){return documents.find(d=>d.id===activeId)||null;}
  function setStatus(s){const el=document.getElementById("status-message");if(el)el.textContent=s;}
  function sync(){const d=current();if(!d)return;d.content=editor.value;d.dirty=true;renderTabs();updateLines();if(window.A7Project)window.A7Project.documentChanged(d);}
  function updateLines(){const n=editor.value.split("\n").length;numbers.textContent=Array.from({length:n},(_,i)=>i+1).join("\n");numbers.scrollTop=editor.scrollTop;}
  function updateCursor(){const before=editor.value.slice(0,editor.selectionStart),a=before.split("\n");cursor.textContent="Ред "+a.length+", Колона "+(a[a.length-1].length+1); }
  function renderTabs(){tabs.innerHTML="";documents.forEach(d=>{const t=document.createElement("div");t.className="tab"+(d.id===activeId?" active":"");t.title=d.path||d.name;const n=document.createElement("span");n.textContent=(d.dirty?"● ":"")+d.name;const x=document.createElement("span");x.className="close";x.textContent="×";x.title="Затвори";x.onclick=e=>{e.stopPropagation();close(d.id);};t.append(n,x);t.onclick=()=>activate(d.id);tabs.append(t);});}
  function activate(id){const d=documents.find(x=>x.id===id);if(!d)return;if(current())current().content=editor.value;activeId=id;editor.value=d.content;label.textContent=d.name;document.getElementById("editor-language").textContent=extCode.test(d.name)?"C++ / Arduino":"Текстов файл";renderTabs();updateLines();updateCursor();editor.focus();highlight();}
  function add(file){const path=file.path||file.name||"untitled.ino",name=path.split(/[\\/]/).pop();let d=documents.find(x=>x.path===path||(!file.path&&x.name===name));if(d){d.content=file.content??d.content;d.dirty=false;activate(d.id);return d;}d={id:file.id||uid(),name,path,content:file.content||"",dirty:false};documents.push(d);activate(d.id);return d;}
  function close(id,force){const d=documents.find(x=>x.id===id);if(!d)return;if(d.dirty&&!force&&!confirm("Файлът "+d.name+" има незапазени промени. Затваряне без запис?"))return;const i=documents.indexOf(d);documents.splice(i,1);if(activeId===id){activeId=null;if(documents.length)activate(documents[Math.max(0,i-1)].id);else{editor.value="";label.textContent="Няма отворен файл";updateLines();}}renderTabs();}
  function closeOthers(id){documents.filter(d=>d.id!==id).slice().forEach(d=>close(d.id,true));}
  function replaceSelection(value){const s=editor.selectionStart,e=editor.selectionEnd;editor.setRangeText(value,s,e,"end");sync();updateCursor();}
  function selectedLines(){const s=editor.selectionStart,e=editor.selectionEnd;const start=editor.value.lastIndexOf("\n",s-1)+1;let end=editor.value.indexOf("\n",e);if(end<0)end=editor.value.length;return {start,end,text:editor.value.slice(start,end)};}
  function indent(out){const r=selectedLines();replaceRange(r.start,r.end,r.text.split("\n").map(x=>out?"  "+x:x.replace(/^\t|^ {1,2}/,"")).join("\n"));}
  function replaceRange(s,e,v){editor.setRangeText(v,s,e,"select");sync();updateCursor();}
  function toggleLineComment(){const r=selectedLines(),lines=r.text.split("\n"),remove=lines.every(x=>/^\s*\/\//.test(x));replaceRange(r.start,r.end,lines.map(x=>remove?x.replace(/^(\s*)\/\//,"$1"):x.replace(/^(\s*)/,"$1// ")).join("\n"));}
  function blockComment(){const s=editor.selectionStart,e=editor.selectionEnd;if(s===e){replaceSelection("/*  */");editor.selectionStart=editor.selectionEnd=s+3;}else replaceRange(s,e,"/*\n"+editor.value.slice(s,e)+"\n*/");}
  function duplicate(){const s=editor.selectionStart,e=editor.selectionEnd;if(s!==e){replaceRange(e,e,editor.value.slice(s,e));return;}const r=selectedLines();replaceRange(r.end,r.end,"\n"+r.text);}
  function moveLine(dir){const r=selectedLines(),before=editor.value.slice(0,r.start),after=editor.value.slice(r.end);if(dir<0){const p=before.lastIndexOf("\n");if(p<0)return;const prev=before.slice(p+1);replaceRange(p+1,r.end, r.text+"\n"+prev);}else{const q=after.indexOf("\n");if(q<0)return;const next=after.slice(0,q);replaceRange(r.start,r.end+q+1,next+"\n"+r.text);}}
  function findNext(q){if(!q)return false;let i=editor.value.indexOf(q,editor.selectionEnd);if(i<0)i=editor.value.indexOf(q,0);if(i<0)return false;editor.focus();editor.setSelectionRange(i,i+q.length);return true;}
  function replaceAll(q,r,caseSensitive){if(!q)return 0;const flags=caseSensitive?"g":"gi",re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),flags);const m=editor.value.match(re);if(!m)return 0;editor.value=editor.value.replace(re,r);sync();return m.length;}
  function gotoLine(n){const lines=editor.value.split("\n");if(n<1||n>lines.length)return false;let p=0;for(let i=1;i<n;i++)p+=lines[i-1].length+1;editor.focus();editor.setSelectionRange(p,p);updateCursor();return true;}
  function popupList(items,choose){removePopup();popup=document.createElement("div");popup.className="a7-popup";items.forEach((it,i)=>{const b=document.createElement("button");b.type="button";b.textContent=it.label||it;b.title=it.detail||"";b.onclick=()=>{choose(it,i);removePopup();};popup.append(b);});document.body.append(popup);const r=editor.getBoundingClientRect();popup.style.left=Math.min(r.left+Math.max(50,editor.selectionStart%80*8),innerWidth-300)+"px";popup.style.top=Math.min(r.top+Math.min(240,editor.selectionStart/Math.max(1,editor.value.length)*r.height),innerHeight-260)+"px";}
  function removePopup(){if(popup){popup.remove();popup=null;}}
  function wordAt(pos){const s=editor.value;let a=pos,b=pos;while(a>0&&/[\w:]/.test(s[a-1]))a--;while(b<s.length&&/[\w:]/.test(s[b]))b++;return s.slice(a,b);}
  function symbols(){const out=[],re=/^\s*(?:([\w:<>,*&]+)\s+)?([A-Za-z_]\w*)\s*\([^;]*\)\s*(?:const\s*)?(?:\{|$)|^\s*(class|struct|enum)\s+([A-Za-z_]\w*)/gm;let m;while((m=re.exec(editor.value))){out.push({name:m[2]||m[4],line:editor.value.slice(0,m.index).split("\n").length,kind:m[3]?"тип":"функция"});}return out;}
  // Търси дефиниция първо в активния файл, после във всички файлове на проекта.
  function gotoDefinition(word){
    if(!word)return false;
    const escaped=word.replace(/[^A-Za-z0-9_:]/g,"");
    const re=new RegExp("^[\\t ]*(?:[\\w:<>,*&]+[\\t ]+)?"+escaped+"[\\t ]*\\(","m");
    let match=re.exec(editor.value);
    if(match){gotoLine(editor.value.slice(0,match.index).split("\n").length);return true;}
    if(window.A7Project){
      const all=window.A7Project.files();
      for(let i=0;i<all.length;i++){
        const file=all[i];
        if(current()&&file.path===current().path)continue;
        match=re.exec(file.content||"");
        if(match){
          window.A7Project.open(file.path);
          gotoLine((file.content||"").slice(0,match.index).split("\n").length);
          setStatus("Дефиниция: "+file.path);
          return true;
        }
      }
    }
    setStatus("Няма намерена дефиниция за "+word);
    return false;
  }
  const keywords="void bool byte char int long short float double unsigned signed const static volatile if else for while do switch case break continue return class struct enum typedef using namespace public private protected virtual override constexpr auto sizeof new delete true false HIGH LOW INPUT OUTPUT INPUT_PULLUP";
  const builtins="pinMode digitalWrite digitalRead analogRead analogWrite delay delayMicroseconds millis micros attachInterrupt detachInterrupt Serial setup loop";
  function escape(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function highlight(){ /* CodeMirror извършва синтактичното оцветяване чрез C-like mode. */ }

  // Автодовършване с често използвани Arduino/C++ шаблони.
  function completion(){
    const w=wordAt(editor.selectionStart);
    const snippets={
      setup:{label:"setup() — основна инициализация",insert:"void setup() {\n  \n}"},
      loop:{label:"loop() — основен цикъл",insert:"void loop() {\n  \n}"},
      serial:{label:"Serial.begin(9600)",insert:"Serial.begin(9600);"},
      pinmode:{label:"pinMode(pin, OUTPUT)",insert:"pinMode(, OUTPUT);"},
      digitalwrite:{label:"digitalWrite(pin, HIGH)",insert:"digitalWrite(, HIGH);"},
      digitalread:{label:"digitalRead(pin)",insert:"digitalRead()"},
      analogread:{label:"analogRead(pin)",insert:"analogRead()"},
      delay:{label:"delay(milliseconds)",insert:"delay();"},
      for:{label:"for цикъл",insert:"for (int i = 0; i < ; i++) {\n  \n}"},
      if:{label:"if условие",insert:"if () {\n  \n}"},
      while:{label:"while цикъл",insert:"while () {\n  \n}"},
      switch:{label:"switch / case",insert:"switch () {\n  case :\n    break;\n  default:\n    break;\n}"},
      function:{label:"Нова void функция",insert:"void newFunction() {\n  \n}"},
      include:{label:"#include",insert:"#include <>"},
      serialprint:{label:"Serial.println()",insert:"Serial.println();"}
    };
    const base=(keywords+" "+builtins+" Serial.begin Serial.println Serial.print analogWrite digitalWrite pinMode INPUT_PULLUP").split(" ").filter(Boolean);
    const matches=base.filter(x=>x.toLowerCase().startsWith(w.toLowerCase())&&x!==w).map(x=>({label:x,insert:x,detail:"Arduino / C++"}));
    Object.keys(snippets).forEach(key=>{if(key.startsWith(w.toLowerCase())||snippets[key].label.toLowerCase().startsWith(w.toLowerCase()))matches.push({...snippets[key],detail:"Готов шаблон"});});
    const unique=[];const seen=new Set();
    matches.forEach(item=>{const key=item.label.toLowerCase();if(!seen.has(key)){seen.add(key);unique.push(item);}});
    if(!unique.length)return;
    popupList(unique.slice(0,24),it=>{
      const s=editor.selectionStart-wordAt(editor.selectionStart).length;
      editor.setRangeText(it.insert,s,editor.selectionStart,"end");
      sync();updateCursor();
    });
  }
  function showContext(x,y){removePopup();const items=[["Изрежи",()=>document.execCommand("cut")],["Копирай",()=>document.execCommand("copy")],["Постави",()=>document.execCommand("paste")],["Дублирай ред/избор",duplicate],["Коментирай / разкоментирай",toggleLineComment],["Огради с /* */",blockComment],["Отиди към дефиниция",()=>gotoDefinition(wordAt(editor.selectionStart))],["Намери",()=>window.A7App.askFind()],["Замени",()=>window.A7App.askReplace()]];popup=document.createElement("div");popup.className="a7-popup";items.forEach(([name,fn])=>{const b=document.createElement("button");b.textContent=name;b.onclick=()=>{fn();removePopup();};popup.append(b);});popup.style.left=Math.min(x,innerWidth-260)+"px";popup.style.top=Math.min(y,innerHeight-340)+"px";document.body.append(popup);}
  editor.addEventListener("input",()=>{sync();updateCursor();highlight();});
  editor.addEventListener("scroll",()=>{numbers.scrollTop=editor.scrollTop;});
  editor.addEventListener("click",()=>{updateCursor();highlight();});editor.addEventListener("keyup",()=>{updateCursor();highlight();});
  editor.addEventListener("contextmenu",e=>{e.preventDefault();showContext(e.clientX,e.clientY);});
  editor.addEventListener("mousemove",e=>{clearTimeout(hintTimer);const pos=editor.selectionStart,w=wordAt(pos);if(!w)return;hintTimer=setTimeout(()=>{const detail=keywords.split(" ").includes(w)?"Ключова дума на C++":builtins.split(" ").includes(w)?"Вградена Arduino функция":"Ctrl+щракване: търси дефиниция";editor.title=w+" — "+detail;},500);});
  editor.addEventListener("mousedown",e=>{
    if(!e.ctrlKey)return;
    // Вземаме позицията под мишката, а не старата позиция на курсора.
    let pos=editor.selectionStart;
    if(document.caretRangeFromPoint){
      const range=document.caretRangeFromPoint(e.clientX,e.clientY);
      if(range&&range.startContainer===editor)pos=range.startOffset;
    }
    const word=wordAt(pos);
    if(word){editor.setSelectionRange(pos,pos);if(gotoDefinition(word))e.preventDefault();}
  });
  editor.addEventListener("keydown",e=>{
    const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
    // Автоматично затваряне на скоби и кавички, както в настолна IDE.
    const pairs={"(":")","[":"]","{":"}","\"":"\"","'":"'"}; 
    if(!mod&&pairs[e.key]&&editor.selectionStart===editor.selectionEnd){
      e.preventDefault();
      const close=pairs[e.key],p=editor.selectionStart;
      editor.setRangeText(e.key+close,p,p,"end");
      editor.setSelectionRange(p+1,p+1);
      sync();updateCursor();return;
    }
    // При въвеждане на затваряща скоба прескача вече добавената автоматично скоба.
    if(!mod&&[")","]","}","\"","'"].includes(e.key)&&editor.selectionStart===editor.selectionEnd&&editor.value[editor.selectionStart]===e.key){
      e.preventDefault();editor.setSelectionRange(editor.selectionStart+1,editor.selectionStart+1);updateCursor();return;
    }
    // Enter между { } създава правилно подравнен празен ред.
    if(e.key==="Enter"&&editor.selectionStart===editor.selectionEnd&&editor.value[editor.selectionStart-1]==="{"&&editor.value[editor.selectionStart]==="}"){
      e.preventDefault();
      const p=editor.selectionStart,line=editor.value.slice(0,p).split("\n").pop(),base=(line.match(/^\s*/)||[""])[0];
      const insert="\n"+base+"  "+"\n"+base;
      editor.setRangeText(insert,p,p,"end");editor.setSelectionRange(p+1+base.length+2,p+1+base.length+2);
      sync();updateCursor();return;
    }
    // Автоматичен отстъп за затваряща }.
    if(e.key==="}"&&editor.selectionStart===editor.selectionEnd){
      const p=editor.selectionStart,lineStart=editor.value.lastIndexOf("\n",p-1)+1;
      const before=editor.value.slice(lineStart,p);
      if(/^\s{2,}$/.test(before)){e.preventDefault();editor.setRangeText("}",lineStart,p,"end");sync();updateCursor();return;}
    }
    if(e.key==="Tab"){e.preventDefault();if(editor.selectionStart!==editor.selectionEnd)indent(true);else replaceSelection("  ");}
    if(mod&&k==="s"){e.preventDefault();window.A7App.save();}
    if(mod&&k==="space"){e.preventDefault();completion();}
    if(mod&&k==="d"){e.preventDefault();duplicate();}
    if(mod&&k==="/"){e.preventDefault();toggleLineComment();}
    if(mod&&k==="f"){e.preventDefault();window.A7App.askFind();}
    if(mod&&k==="h"){e.preventDefault();window.A7App.askReplace();}
    if(mod&&e.key==="Enter"){e.preventDefault();completion();}
    if(e.key==="Escape")removePopup();
    if(e.key==="Enter"){const p=editor.selectionStart,ln=editor.value.slice(0,p).split("\n").pop(),indent=(ln.match(/^\s*/)||[""])[0];setTimeout(()=>{editor.setRangeText(indent,editor.selectionStart,editor.selectionStart,"end");sync();},0);}
  });
  window.A7Editor={add,activate,close,closeOthers,files:()=>documents,current,getValue:()=>cm.getValue(),complete:completion,replaceAll(list){documents=[];activeId=null;list.forEach(add);if(!list.length){editor.value="";renderTabs();}},getFiles(){if(current())current().content=editor.value;return documents.map(d=>({...d}));},findNext,replaceAllText:replaceAll,gotoLine,duplicate,toggleCommentSelection:toggleLineComment,toggleBlockComment:blockComment,indentSelection:indent,moveCurrentLine:moveLine,trimTrailingWhitespace(){editor.value=editor.value.split("\n").map(x=>x.replace(/[ \t]+$/g,"")).join("\n");sync();},sortSelectedLines(){const r=selectedLines();replaceRange(r.start,r.end,r.text.split("\n").sort().join("\n"));},changeSelectionCase(upper){const s=editor.selectionStart,e=editor.selectionEnd;replaceRange(s,e,upper?editor.value.slice(s,e).toUpperCase():editor.value.slice(s,e).toLowerCase());},insertDateTime(){replaceSelection(new Date().toLocaleString());},toggleBookmark(){const line=editor.value.slice(0,editor.selectionStart).split("\n").length-1;const set=bookmarks.get(activeId)||new Set();set.has(line)?set.delete(line):set.add(line);bookmarks.set(activeId,set);setStatus("Отметка за ред "+(line+1));},nextBookmark(){const set=[...(bookmarks.get(activeId)||[])].sort((a,b)=>a-b),line=editor.value.slice(0,editor.selectionStart).split("\n").length-1,n=set.find(x=>x>line)??set[0];if(n!==undefined)gotoLine(n+1);},clearBookmarks(){bookmarks.set(activeId,new Set());},symbols,gotoDefinition,changeFont(delta){fontSize=Math.max(9,Math.min(28,fontSize+delta));editor.style.fontSize=fontSize+"px";editor.style.lineHeight=(fontSize*1.62)+"px";numbers.style.fontSize=fontSize+"px";},toggleWordWrap(){wrap=!wrap;editor.style.whiteSpace=wrap?"pre-wrap":"pre";editor.style.overflowX=wrap?"hidden":"auto";},resetFont(){fontSize=13;editor.style.fontSize="13px";editor.style.lineHeight="21px";},saveAll(){documents.forEach(d=>{d.content=d.id===activeId?editor.value:d.content;d.dirty=false;});renderTabs();},refresh:highlight};
})();