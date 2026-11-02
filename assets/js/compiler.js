/* Истинска компилация чрез отделен Arduino CLI сървър.
   Този сайт е статичен GitHub Pages сайт и не може сам да стартира AVR-GCC.
   Адресът на компилационната услуга се задава еднократно от потребителя. */
(function(){
 "use strict";
 const ENDPOINT_KEY = "a7-compiler-endpoint";
 const $ = id => document.getElementById(id);

 function endpoint(){
  let value = "";
  try { value = localStorage.getItem(ENDPOINT_KEY) || ""; } catch (_) {}
  if (!value) {
   value = window.prompt("Адрес на Arduino Studio 7 компилационния сървър (например https://your-service.onrender.com):", "");
   if (!value) return "";
   value = value.trim().replace(/\\/$/, "");
   try { localStorage.setItem(ENDPOINT_KEY, value); } catch (_) {}
  }
  return value.replace(/\\/$/, "");
 }

 function projectFiles(){
  const all = window.A7Project.files();
  const opened = window.A7Editor.getFiles();
  const currentByPath = new Map(opened.map(f => [f.path || f.name, f]));
  return all.map(f => {
   const current = currentByPath.get(f.path) || currentByPath.get(f.name);
   return { path: f.path || f.name, name: f.name, content: current ? current.content : f.content };
  });
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
  const files = projectFiles();
  const ino = files.filter(f => /\\.ino$/i.test(f.name || f.path));
  if (!ino.length) return {success:false, message:"В проекта няма .ino файл."};
  const url = endpoint();
  if (!url) return {success:false, message:"Компилацията е отказана: не е зададен адрес на компилационен сървър."};
  const fqbn = $("board-select").value;
  showLog("Започва истинска компилация с Arduino CLI за " + fqbn + "…");
  $("status-message").textContent = "Компилиране…";
  try {
   const response = await fetch(url + "/api/compile", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({fqbn, files})
   });
   const result = await response.json();
   if (!response.ok || !result.success) {
    const log = result.log || result.message || ("HTTP " + response.status);
    showLog(log);
    $("status-message").textContent = "Грешка при компилация";
    return {success:false, message:"Компилацията е неуспешна. Вижте разделите Изход и Проблеми.", log};
   }
   showLog(result.log || "Компилацията премина успешно.");
   showLog("Успешна компилация. HEX: " + result.hex.name + " (" + result.hex.bytes + " bytes).");
   downloadBase64(result.hex);
   if (result.elf) downloadBase64(result.elf);
   $("status-message").textContent = "Компилацията е успешна";
   return {success:true, message:"Компилацията е успешна. HEX файлът е изтеглен.", log:result.log};
  } catch(error) {
   $("status-message").textContent = "Няма връзка с компилатора";
   return {success:false, message:"Не може да се достигне компилационният сървър: " + error.message};
  }
 }

 async function upload(){
  return {success:false,message:"Качването към платката е изключено. На този етап се компилира и генерира HEX файл בלבד."};
 }

 function validate(){
  const files=projectFiles(),problems=[];
  if(!files.some(f=>/\\.ino$/i.test(f.name||f.path))) problems.push({file:"*.ino",line:1,message:"Липсва Arduino .ino файл."});
  return problems;
 }
 window.A7Compiler={compile,upload,validate,configure(){try{localStorage.removeItem(ENDPOINT_KEY);}catch(_){}return endpoint();}};
})();
