/* Главна логика: команди, запис, отваряне на файлове и конзола. */
(function(){
  "use strict";
  const output=document.getElementById("output-console");
  const fileInput=document.getElementById("file-input");

  // Добавя съобщение в конзолата с времеви маркер.
  function log(message){
    const stamp=new Date().toLocaleTimeString();
    output.textContent+="\n["+stamp+"] "+message;
    output.scrollTop=output.scrollHeight;
  }

  // Запазва проекта в IndexedDB и показва резултата.
  async function save(){
    try{await window.A7Project.save();document.getElementById("status-message").textContent="Проектът е записан локално";log("Проектът е записан в IndexedDB.");}
    catch(error){log("Грешка при запис: "+error.message);}
  }

  // Отваря избран локален текстов файл.
  fileInput.addEventListener("change",async()=>{
    const file=fileInput.files&&fileInput.files[0];if(!file)return;
    const content=await file.text();window.A7Project.add({name:file.name,content});
    document.getElementById("status-message").textContent="Отворен файл: "+file.name;fileInput.value="";
  });

  // Създава нов скетч с минимална Arduino структура.
  document.getElementById("btn-new").addEventListener("click",()=>{
    const name=prompt("Име на новия файл:","new_sketch.ino");if(!name)return;
    const safeName=name.includes(".")?name:name+".ino";
    window.A7Project.add({name:safeName,content:"// Нов Arduino скетч\n\nvoid setup() {\n}\n\nvoid loop() {\n}\n"});
  });
  document.getElementById("btn-open").addEventListener("click",()=>fileInput.click());
  document.getElementById("btn-save").addEventListener("click",save);
  document.getElementById("btn-add-file").addEventListener("click",()=>fileInput.click());
  document.getElementById("btn-clear-output").addEventListener("click",()=>{output.textContent="Конзолата е изчистена.";});

  // Проверява само базовата структура; това не замества компилатора.
  document.getElementById("btn-verify").addEventListener("click",async()=>{
    const result=await window.A7Compiler.compile();log(result.message);
  });
  document.getElementById("btn-upload").addEventListener("click",async()=>{
    const result=await window.A7Compiler.upload();log(result.message);
  });

  // Превключва изгледите в долния панел и дава честен статус.
  document.querySelectorAll("[data-output-tab]").forEach(button=>button.addEventListener("click",()=>{
    document.querySelectorAll("[data-output-tab]").forEach(item=>item.classList.remove("selected"));
    button.classList.add("selected");
    if(button.dataset.outputTab==="serial")log("Серийният монитор ще бъде активиран след добавяне на поддържан Serial API.");
    if(button.dataset.outputTab==="problems")log("Няма извършена компилация; списъкът с грешки е празен.");
  }));

  // Запазва редакцията при промяна на съдържанието.
  window.A7App={save,changed(){document.getElementById("status-message").textContent="Има незапазени промени";}};
  window.addEventListener("beforeunload",()=>{try{window.A7Project.save();}catch(ignore){}});
  window.A7Storage.open().then(()=>window.A7Project.restore()).then(()=>log("Локалният проект е готов.")).catch(error=>log("Локалното хранилище не е достъпно: "+error.message));
})();