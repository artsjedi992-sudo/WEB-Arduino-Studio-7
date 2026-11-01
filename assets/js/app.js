/* Главен контролер: менюта, файлови операции, редактор, диагностика и платки. */
(function(){
 "use strict";
 const $=id=>document.getElementById(id), output=$("output-console"), problems=$("problems-list");
 
 function log(s){output.textContent+="\n["+new Date().toLocaleTimeString()+"] "+s;output.scrollTop=output.scrollHeight;}
 function status(s){$("status-message").textContent=s;}
 function ask(title,message,initial){return window.prompt(title+"\n"+message,initial||"");}
 async function save(){try{await window.A7Project.save();status("Проектът е записан локално");log("Записани са всички файлове от проекта в IndexedDB.");}catch(e){log("Грешка при запис: "+e.message);}}
 function download(name,text,type){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([text],{type:type||"text/plain;charset=utf-8"}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);}
 async function saveActive(){
  const d=window.A7Editor.current();if(!d)return;
  d.content=$("code-editor").value;
  window.A7Project.documentChanged(d);
  try{await window.A7Project.save();download(d.name,d.content);status("Файлът е записан и изтеглен: "+d.name);}
  catch(e){log("Грешка при запис: "+e.message);}
}
 function newFile(ext){let name=ask("Нов файл","Име на файла:",ext===".ino"?"new_sketch.ino":"new_file"+ext);if(!name)return;if(!/\.[A-Za-z0-9]+$/.test(name))name+=ext;window.A7Project.add({name,path:name,content:ext===".ino"?"// Нов Arduino скеч\n\nvoid setup() {\n}\n\nvoid loop() {\n}\n":""});}
 function newSketch(){newFile(".ino");}
 function openFiles(){ $("file-input").click(); }
 function openFolder(){ $("project-input").click(); }
 function askFind(){const q=ask("Търсене","Текст за търсене:");if(q)window.A7Editor.findNext(q);}
 function askReplace(){const q=ask("Замяна","Текст, който да се търси:");if(q===null||q==="")return;const r=ask("Замяна","Замени с:","");if(r===null)return;const n=window.A7Editor.replaceAllText(q,r,false);log("Заменени срещания: "+n);}
 function gotoLine(){const n=parseInt(ask("Отиди на ред","Номер на ред:","1"),10);if(n>0&&!window.A7Editor.gotoLine(n))log("Няма такъв ред.");}
 function symbols(){const items=window.A7Editor.symbols();if(!items.length){log("Не са открити функции или типове.");return;}const choice=ask("Функции и символи",items.map((x,i)=>(i+1)+". "+x.name+" — "+x.kind+", ред "+x.line).join("\n")+"\n\nВъведете номер:","1");const i=parseInt(choice,10)-1;if(items[i])window.A7Editor.gotoLine(items[i].line);}
 function showProblems(list){problems.innerHTML="";if(!list.length){problems.textContent="Няма открити структурни проблеми.";return;}list.forEach(p=>{const b=document.createElement("button");b.className="problem-item";b.textContent=p.file+":"+p.line+" — "+p.message;b.onclick=()=>{const f=window.A7Project.files().find(x=>x.name===p.file);if(f)window.A7Project.open(f.path);window.A7Editor.gotoLine(p.line);};problems.append(b);});}
 function showOutputTab(name){document.querySelectorAll("[data-output-tab]").forEach(b=>b.classList.toggle("selected",b.dataset.outputTab===name));$("output-console").hidden=name!=="output";$("problems-list").hidden=name!=="problems";$("serial-panel").hidden=name!=="serial";if(name==="serial")serialInfo();}
 function serialInfo(){const supported="serial" in navigator;$("serial-info").textContent=supported?"Браузърът поддържа Web Serial. Натиснете „Избери порт“ от потребителско действие.":"Web Serial не се поддържа в този браузър. Firefox 115 под Windows 7 няма директен сериен достъп.";}
 async function choosePort(){if(!("serial" in navigator)){log("Web Serial липсва в този браузър.");return;}try{const port=await navigator.serial.requestPort();await port.open({baudRate:9600});window.A7SerialPort=port;$("connection-state").textContent="● Свързан сериен порт";$("serial-info").textContent="Свързан порт. Скорост: 9600 baud.";const reader=port.readable.getReader();window.A7SerialReader=reader;(async()=>{try{while(true){const {value,done}=await reader.read();if(done)break;if(value)$("serial-data").textContent+=new TextDecoder().decode(value);}}catch(e){log("Сериен порт: "+e.message);}})();}catch(e){log("Серийният порт не е отворен: "+e.message);}}
 function sendSerial(){const port=window.A7SerialPort;if(!port||!port.writable){log("Няма активна сериен връзка.");return;}const writer=port.writable.getWriter();writer.write(new TextEncoder().encode($("serial-send").value+"\n")).then(()=>log("Изпратени серийни данни.")).catch(e=>log(e.message)).finally(()=>writer.releaseLock());}
 function fileContext(file,x,y){const menu=document.createElement("div");menu.className="a7-popup";[["Отвори",()=>window.A7Project.open(file.path)],["Изтегли",()=>download(file.name,file.content)],["Преименувай",()=>{const n=ask("Преименуване","Ново име:",file.name);if(n)window.A7Project.rename(file.path,n);}],["Изтрий",()=>{if(confirm("Да се изтрие "+file.path+" от проекта?"))window.A7Project.remove(file.path);}],["Копирай пътя",()=>navigator.clipboard&&navigator.clipboard.writeText(file.path)]].forEach(([t,fn])=>{const b=document.createElement("button");b.textContent=t;b.onclick=()=>{fn();menu.remove();};menu.append(b);});document.body.append(menu);menu.style.left=Math.min(x,innerWidth-250)+"px";menu.style.top=Math.min(y,innerHeight-220)+"px";document.addEventListener("click",()=>menu.remove(),{once:true});}
 function buildMenu(){const commands={
 "Файл":[["Нов скеч",newSketch],["Нов C++ файл",()=>newFile(".cpp")],["Нов header файл",()=>newFile(".h")],["Отвори файл",openFiles],["Отвори папка проект",openFolder],["Запиши текущия файл",saveActive],["Запиши всички / проект",save],["Изтегли целия проект (JSON)",()=>window.A7Project.exportProject()],["Изтегли всички файлове",()=>window.A7Project.exportAll()],["Последно отваряни файлове",()=>log("Последните файлове са налични в текущата сесия.")]],
 "Редактиране":[["Отмени",()=>document.execCommand("undo")],["Повтори",()=>document.execCommand("redo")],["Търси",askFind],["Замени всички",askReplace],["Отиди на ред",gotoLine],["Функции / символи",symbols],["Дублирай ред или избор",()=>window.A7Editor.duplicate()],["Коментирай / разкоментирай Ctrl+/",()=>window.A7Editor.toggleCommentSelection()],["Блоков коментар /* */",()=>window.A7Editor.toggleBlockComment()],["Отстъп навътре",()=>window.A7Editor.indentSelection(true)],["Отстъп навън",()=>window.A7Editor.indentSelection(false)],["Премести ред нагоре",()=>window.A7Editor.moveCurrentLine(-1)],["Премести ред надолу",()=>window.A7Editor.moveCurrentLine(1)],["Премахни крайни интервали",()=>window.A7Editor.trimTrailingWhitespace()],["Сортирай избраните редове",()=>window.A7Editor.sortSelectedLines()],["Главни букви",()=>window.A7Editor.changeSelectionCase(true)],["Малки букви",()=>window.A7Editor.changeSelectionCase(false)],["Вмъкни дата и час",()=>window.A7Editor.insertDateTime()],["Отметка на ред",()=>window.A7Editor.toggleBookmark()],["Следваща отметка",()=>window.A7Editor.nextBookmark()],["Изчисти отметките",()=>window.A7Editor.clearBookmarks()],["Увеличи шрифта",()=>window.A7Editor.changeFont(1)],["Намали шрифта",()=>window.A7Editor.changeFont(-1)],["Нормален шрифт",()=>window.A7Editor.resetFont()],["Пренасяне на редове",()=>window.A7Editor.toggleWordWrap()]],
 "Проект":[["Отвори папка проект",openFolder],["Обнови дървото",()=>window.A7Project.refresh()],["Нов .ino файл",()=>newFile(".ino")],["Нов C++ файл",()=>newFile(".cpp")],["Нов header файл",()=>newFile(".h")],["Търси във всички файлове",()=>{const q=ask("Търсене в проекта","Текст:");if(!q)return;const hits=[];window.A7Project.files().forEach(f=>f.content.split("\n").forEach((line,i)=>{if(line.toLowerCase().includes(q.toLowerCase()))hits.push(f.path+":"+(i+1)+" "+line.trim());}));log("Резултати от търсене в проекта:\n"+hits.join("\n"));}]],
 "Скетч":[["Провери / Компилирай",compile],["Качи към платката",upload],["Обнови COM портове",choosePort],["Експортирай HEX / проект",()=>{log("HEX файл не е наличен, защото няма истинска AVR компилация.");window.A7Project.exportProject();}]],
 "Инструменти":[["Избор на платка",()=>{$("board-select").focus();}],["Избери сериен порт",choosePort],["Сериен монитор",()=>showOutputTab("serial")],["Настройки на компилатора",()=>log("В браузърната версия няма локален Arduino CLI път. Компилацията изисква WASM toolchain или сървър.")],["Поддръжка на AVR core",()=>log("Инсталирането на board core изисква Arduino CLI. Не е извършено от браузъра.")],["Arduino библиотеки",()=>log("Добавете .h/.cpp файловете на библиотеката към папката на проекта.")],["Справка за платките",boardHelp]],
 "Прозорец":[["Изход",()=>showOutputTab("output")],["Проблеми",()=>showOutputTab("problems")],["Сериен монитор",()=>showOutputTab("serial")],["Запази изхода във файл",()=>download("arduino-output.txt",output.textContent)],["Копирай целия изход",()=>navigator.clipboard&&navigator.clipboard.writeText(output.textContent)]],
 "Помощ":[["Платки и FQBN",boardHelp],["Клавишни комбинации",()=>alert("Ctrl+S Запис\nCtrl+F Търсене\nCtrl+H Замяна\nCtrl+Space Автодовършване\nCtrl+D Дублиране\nCtrl+/ Коментар\nCtrl+щракване — дефиниция")],["За Arduino Studio 7 Web",()=>alert("Arduino Studio 7 Web — браузърна IDE версия.")]]
 };document.querySelectorAll("[data-menu]").forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();document.querySelectorAll(".a7-menu-popup").forEach(x=>x.remove());const menuNames={file:"Файл",edit:"Редактиране",project:"Проект",sketch:"Скетч",tools:"Инструменти",window:"Прозорец",help:"Помощ"};const list=commands[menuNames[btn.dataset.menu]];const pop=document.createElement("div");pop.className="a7-popup a7-menu-popup";list.forEach(([name,fn])=>{const b=document.createElement("button");b.textContent=name;b.onclick=()=>{pop.remove();fn();};pop.append(b);});document.body.append(pop);const r=btn.getBoundingClientRect();pop.style.left=r.left+"px";pop.style.top=r.bottom+"px";setTimeout(()=>document.addEventListener("click",()=>pop.remove(),{once:true}),0);}));}
 function boardHelp(){alert("Често използвани FQBN:\nArduino Uno: arduino:avr:uno\nNano: arduino:avr:nano\nMega 2560: arduino:avr:mega\nLeonardo: arduino:avr:leonardo\nMicro: arduino:avr:micro\nMegaAVR Uno WiFi Rev2: arduino:megaavr:uno2018\nИзберете FQBN според точния модел и bootloader.");}
 async function compile(){const r=await window.A7Compiler.compile();log(r.message);showOutputTab("problems");}
 async function upload(){const r=await window.A7Compiler.upload();log(r.message);}
 $("file-input").addEventListener("change",async()=>{const list=Array.from($("file-input").files||[]);for(const f of list){const content=await f.text();window.A7Project.add({name:f.name,path:f.name,content});} $("file-input").value="";});
 $("project-input").addEventListener("change",async()=>{const list=Array.from($("project-input").files||[]);if(!list.length)return;window.A7Project.importFiles(list);$("project-input").value="";log("Зарежда се проектна папка: "+list.length+" файла.");});
 $("btn-new").onclick=newSketch;$("btn-open").onclick=openFiles;$("btn-save").onclick=save;$("btn-add-file").onclick=()=>newFile(".cpp");
 $("btn-verify").onclick=compile;$("btn-upload").onclick=upload;$("btn-clear-output").onclick=()=>output.textContent="Конзолата е изчистена.";
 $("board-select").addEventListener("change",()=>{const s=$("board-select"),o=s.options[s.selectedIndex];$("connection-state").textContent="● "+o.text;});
 document.querySelectorAll("[data-output-tab]").forEach(b=>b.onclick=()=>showOutputTab(b.dataset.outputTab));
 $("serial-connect").onclick=choosePort;$("serial-send-button").onclick=sendSerial;
 $("code-editor").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();save();}});
 window.A7App={save,changed(){status("Има незапазени промени");},askFind,askReplace,showProblems,fileContext};
 // Превключване на светла/тъмна тема с локално запомняне.
 const themeButton=$("btn-theme");
 try{if(localStorage.getItem("a7-theme")==="dark")document.body.classList.add("theme-dark");}catch(e){}
 if(themeButton)themeButton.onclick=()=>{
   document.body.classList.toggle("theme-dark");
   try{localStorage.setItem("a7-theme",document.body.classList.contains("theme-dark")?"dark":"light");}catch(e){}
   themeButton.textContent=document.body.classList.contains("theme-dark")?"Тъмна":"Светла";
 };
 if(themeButton)themeButton.textContent=document.body.classList.contains("theme-dark")?"Тъмна":"Светла";
 buildMenu();serialInfo();showProblems([]);
 window.A7Storage.open().then(()=>window.A7Project.restore()).then(()=>log("Проектът е зареден. Всички файлове се пазят отделно от отворените табове.")).catch(e=>log("Локалното хранилище: "+e.message));
 window.addEventListener("beforeunload",()=>{window.A7Project.save().catch(()=>{});});
})();
