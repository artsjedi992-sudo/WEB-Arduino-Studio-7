/* Истинска локална компилация чрез Arduino CLI на компютъра на потребителя.
   Браузърът изпраща файловете към локалния PowerShell посредник. */
(function(){
 "use strict";
 const ENDPOINT_KEY = "a7-compiler-endpoint";
 const LOCAL_ENDPOINT = "http://127.0.0.1:8765";
 const $ = id => document.getElementById(id);

 function endpoint(){
  let value = "";
  try { value = localStorage.getItem(ENDPOINT_KEY) || ""; } catch (_) {}
  if (!value) {
   value = LOCAL_ENDPOINT;
   try { localStorage.setItem(ENDPOINT_KEY, value); } catch (_) {}
  }
  return value.replace(/\/$/, "");
 }

 function projectFiles(){
  const all = window.A7Project.files();
  const opened = window.A7Editor.getFiles();
  const current = window.A7Editor.current();
  const currentByPath = new Map(opened.map(f => [f.path || f.name, f]));
  const files = all.map(f => {
   const path = String(f.path || f.name).replace(/\\/g, "/");
   const doc = currentByPath.get(f.path) || currentByPath.get(path) || currentByPath.get(f.name);
   return { path, name: f.name || path.split("/").pop(), content: doc ? doc.content : f.content };
  });
  const isIno = f => /\.ino$/i.test(f.name || f.path);
  let main = current && isIno(current)
   ? files.find(f => f.path === String(current.path || current.name).replace(/\\/g, "/"))
   : null;
  if (!main) {
   const activePath = window.A7Project.activePath && String(window.A7Project.activePath()).replace(/\\/g, "/");
   main = files.find(f => f.path === activePath && isIno(f)) || files.find(isIno);
  }
  if (!main) return { files: [], main: null, excluded: [] };
  const parentOf = path => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const parent = parentOf(main.path);
  const siblings = files.filter(f => parentOf(f.path) === parent);
  const mainHasSetup = /\b(?:void\s+)?setup\s*\(/m.test(main.content || "");
  const mainHasLoop = /\b(?:void\s+)?loop\s*\(/m.test(main.content || "");
  const selected = [];
  const excluded = [];
  siblings.forEach(f => {
   if (isIno(f) && f.path !== main.path) {
    const hasSetup = /\b(?:void\s+)?setup\s*\(/m.test(f.content || "");
    const hasLoop = /\b(?:void\s+)?loop\s*\(/m.test(f.content || "");
    if ((hasSetup && mainHasSetup) || (hasLoop && mainHasLoop)) {
     excluded.push(f.path);
     return;
    }
   }
   selected.push(f);
  });
  return { files: selected, main, excluded };
 }

 function showLog(text){
  const output = $("output-console");
  output.textContent += "\n[" + new Date().toLocaleTimeString() + "] " + text;
  output.scrollTop = output.scrollHeight;
 }

 function downloadBase64(file){
  const binary = atob(file.base64);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], {type:"application/octet-stream"}));
  const a = document.createElement("a");
  a.href = url; a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
 }

 async function compile(){
  const selection = projectFiles();
  const files = selection.files;
  if (!selection.main) return {success:false, message:"В проекта няма избран Arduino .ino файл. Отворете основния скеч и опитайте отново."};
  showLog("Основен скеч: " + selection.main.path);
  if (selection.excluded.length) showLog("Пропуснати са .ino файлове с дублирани setup()/loop(): " + selection.excluded.join(", "));
  const url = endpoint();
  if (!url) return {success:false, message:"Не е зададен адрес на локалния компилатор."};
  const fqbn = $("board-select").value;
  showLog("Използва се локален Arduino CLI: " + url);
  showLog("Започва истинска компилация за " + fqbn + "…");
  $("status-message").textContent = "Компилиране…";
  try {
   const response = await fetch(url + "/api/compile", {
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=UTF-8"},
    body:JSON.stringify({fqbn, files})
   });
   const result = await response.json();
   if (!response.ok || !result.success) {
    showLog(result.log || result.message || ("HTTP " + response.status));
    $("status-message").textContent = "Грешка при компилация";
    return {success:false, message:"Компилацията е неуспешна. Вижте конзолата Изход."};
   }
   showLog(result.log || "Компилацията премина успешно.");
   showLog("Успешна компилация. HEX: " + result.hex.name + " (" + result.hex.bytes + " bytes).");
   downloadBase64(result.hex);
   if (result.elf) downloadBase64(result.elf);
   $("status-message").textContent = "Компилацията е успешна";
   return {success:true, message:"Компилацията е успешна. HEX файлът е изтеглен."};
  } catch(error) {
   $("status-message").textContent = "Няма връзка с компилатора";
   return {success:false, message:"Не може да се достигне локалният Arduino CLI. Стартирайте local-compiler\\Start-LocalCompiler.bat и опитайте отново. Подробности: " + error.message};
  }
 }

 async function upload(){
  return {success:false,message:"Качването към платката е изключено. Засега се генерира само HEX файл."};
 }

 function validate(){
  const files=projectFiles(),problems=[];
  if(!files.some(f=>/\.ino$/i.test(f.name||f.path))) problems.push({file:"*.ino",line:1,message:"Липсва Arduino .ino файл."});
  return problems;
 }
 window.A7Compiler={compile,upload,validate,configure(){let current=endpoint();let value=window.prompt("Адрес на локалния Arduino CLI посредник:",current||LOCAL_ENDPOINT);if(value===null)return current;value=value.trim().replace(/\/$/,"");if(value){try{localStorage.setItem(ENDPOINT_KEY,value);}catch(_){}}return value;}};
})();
