/* Компилаторен адаптер: никога не симулира успешна компилация или HEX. */
(function(){
 "use strict";
 function validate(files){
  const problems=[];let hasSetup=false,hasLoop=false;
  files.filter(f=>/\.(ino|cpp|c|h|hpp)$/i.test(f.name)).forEach(f=>{
   const text=f.content||"",lines=text.split("\n");
   if(/\.ino$/i.test(f.name)){hasSetup=hasSetup||/\bvoid\s+setup\s*\(/.test(text);hasLoop=hasLoop||/\bvoid\s+loop\s*\(/.test(text);}
   let braces=0;for(let i=0;i<text.length;i++){if(text[i]==="{")braces++;if(text[i]==="}")braces--;if(braces<0){problems.push({file:f.name,line:text.slice(0,i).split("\n").length,message:"Затваряща } без съответстваща {"});braces=0;}}
   if(braces>0)problems.push({file:f.name,line:lines.length,message:"Липсва затваряща }"});
   lines.forEach((line,i)=>{if(/\bTODO_ERROR\b/.test(line))problems.push({file:f.name,line:i+1,message:"Маркер TODO_ERROR в изходния код"});});
  });
  if(!hasSetup)problems.push({file:"*.ino",line:1,message:"Не е открита функция setup() — проверете дали е необходима."});
  if(!hasLoop)problems.push({file:"*.ino",line:1,message:"Не е открита функция loop() — проверете дали е необходима."});
  return problems;
 }
 async function compile(){
  const files=window.A7Project.files(),p=validate(files);
  window.A7App.showProblems(p);
  if(p.length)return {success:false,message:"Предварителната проверка откри "+p.length+" забележки. Това не е истинска AVR компилация."};
  return {success:false,message:"Структурната проверка премина. Истинска компилация още не е налична: браузърът няма локален Arduino CLI/AVR-GCC, а проектът няма компилационен сървър. Не е генериран HEX файл."};
 }
 async function upload(){
  if(!("serial" in navigator))return {success:false,message:"Този браузър не поддържа Web Serial. Firefox 115 под Windows 7 не може директно да качва към Arduino. Използвайте експортиране на проекта и външен upload инструмент."};
  return {success:false,message:"Web Serial е наличен, но протоколът за bootloader (автоматичен reset, синхронизация и запис на HEX) не е интегриран. Няма да започна непълно качване."};
 }
 window.A7Compiler={compile,upload,validate};
})();