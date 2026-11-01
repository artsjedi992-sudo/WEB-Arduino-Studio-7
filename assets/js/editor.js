/* Управление на текстовия редактор, табовете и номерата на редовете. */
(function(){
  "use strict";
  const editor=document.getElementById("code-editor");
  const lineNumbers=document.getElementById("line-numbers");
  const tabs=document.getElementById("tabbar");
  const activeLabel=document.getElementById("active-file-label");
  const cursorLabel=document.getElementById("cursor-position");
  let files=[];
  let activeId=null;

  // Връща избрания в момента файл.
  function current(){return files.find(file=>file.id===activeId)||null;}

  // Обновява номерата на редовете според текста.
  function updateLines(){
    const count=editor.value.split("\n").length;
    lineNumbers.textContent=Array.from({length:count},(_,i)=>i+1).join("\n");
    lineNumbers.scrollTop=editor.scrollTop;
  }

  // Показва позицията на курсора в долната лента.
  function updateCursor(){
    const before=editor.value.slice(0,editor.selectionStart);
    const rows=before.split("\n");
    cursorLabel.textContent="Ред "+rows.length+", Колона "+(rows[rows.length-1].length+1);
  }

  // Записва текущия текст във файловия обект и известява приложението.
  function sync(){
    const file=current();
    if(!file)return;
    file.content=editor.value;
    file.dirty=true;
    renderTabs();
    updateLines();
    if(window.A7App)window.A7App.changed();
  }

  // Изчертава табовете за отворените файлове.
  function renderTabs(){
    tabs.innerHTML="";
    files.forEach(file=>{
      const tab=document.createElement("div");
      tab.className="tab"+(file.id===activeId?" active":"");
      const name=document.createElement("span");name.textContent=(file.dirty?"● ":"")+file.name;
      const close=document.createElement("span");close.className="close";close.textContent="×";close.title="Затвори файл";
      close.addEventListener("click",event=>{event.stopPropagation();closeFile(file.id);});
      tab.append(name,close);tab.addEventListener("click",()=>activate(file.id));tabs.appendChild(tab);
    });
  }

  // Отваря файл в редактора.
  function activate(id){
    const file=files.find(item=>item.id===id);if(!file)return;
    if(current())current().content=editor.value;
    activeId=id;editor.value=file.content;activeLabel.textContent=file.name;
    document.getElementById("editor-language").textContent=file.name.endsWith(".ino")||file.name.endsWith(".cpp")?"C++ / Arduino":"Текстов файл";
    renderTabs();updateLines();updateCursor();editor.focus();
  }

  // Добавя нов файл или обновява съществуващия със същото име.
  function addFile(file){
    const existing=files.find(item=>item.name===file.name);
    if(existing){existing.content=file.content;existing.dirty=false;activate(existing.id);return;}
    file.id=file.id||("f"+Date.now()+Math.random().toString(16).slice(2));
    file.dirty=false;files.push(file);activate(file.id);
  }

  // Затваря таба и избира съседен файл.
  function closeFile(id){
    const index=files.findIndex(file=>file.id===id);if(index<0)return;
    files.splice(index,1);
    if(activeId===id){activeId=null;if(files.length)activate(files[Math.max(0,index-1)].id);else{editor.value="";activeLabel.textContent="Няма отворен файл";}}
    renderTabs();updateLines();
  }

  // Обработка на Tab за отстъп вместо смяна на фокуса.
  editor.addEventListener("keydown",event=>{
    if(event.key==="Tab"){
      event.preventDefault();const start=editor.selectionStart,end=editor.selectionEnd;
      editor.setRangeText("  ",start,end,"end");sync();updateCursor();
    }
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="s"){event.preventDefault();if(window.A7App)window.A7App.save();}
  });
  editor.addEventListener("input",sync);
  editor.addEventListener("click",updateCursor);
  editor.addEventListener("keyup",updateCursor);
  editor.addEventListener("scroll",()=>{lineNumbers.scrollTop=editor.scrollTop;});

  // Публичен интерфейс за файловия мениджър.
  window.A7Editor={add:addFile,activate,files:()=>files,current,replaceAll(list){files=[];activeId=null;list.forEach(addFile);if(!list.length){editor.value="";renderTabs();}},getFiles(){if(current())current().content=editor.value;return files.map(file=>({name:file.name,content:file.content}));}};
})();