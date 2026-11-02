/* Проектът пази всички файлове отделно от отворените табове. */
(function(){
  "use strict";
  const tree=document.getElementById("file-tree"),projectName="Моят Arduino проект";
  let files=[{path:"sketch/sketch.ino",name:"sketch.ino",content:"// Arduino Studio 7 Web\n// Примерен скеч за Arduino Uno.\n\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n}\n"}];
  let activePath="sketch/sketch.ino";
  const codeExt=/\.(ino|cpp|c|h|hpp)$/i;
  function byPath(path){return files.find(f=>f.path===path);}
  function render(){tree.innerHTML="";const root=document.createElement("div");root.className="tree-folder";root.textContent="▾ "+projectName;tree.append(root);files.slice().sort((a,b)=>a.path.localeCompare(b.path)).forEach(file=>{const b=document.createElement("button");b.className="file-item"+(file.path===activePath?" active":"");const ext=file.name.split(".").pop().toLowerCase();const icon=document.createElement("span");icon.className="file-icon";icon.textContent=ext==="ino"?"◈":ext==="h"||ext==="hpp"?"◇":ext==="cpp"||ext==="c"?"C":"▤";b.append(icon,document.createTextNode(file.name));b.title=file.path;b.onclick=()=>open(file.path);b.oncontextmenu=e=>{e.preventDefault();activePath=file.path;window.A7App.fileContext(file,e.clientX,e.clientY);};tree.append(b);});}
  function open(path){const f=byPath(path);if(!f)return;activePath=path;window.A7Editor.add({...f});render();}
  async function save(){const opened=window.A7Editor.getFiles();opened.forEach(d=>{const f=byPath(d.path)||byPath(d.name);if(f){f.content=d.content;}else files.push({path:d.path||d.name,name:d.name,content:d.content});});await window.A7Storage.save({id:"last-project",name:projectName,files,updated:new Date().toISOString()});window.A7Editor.saveAll();render();}
  async function restore(){try{const p=await window.A7Storage.load("last-project");if(p&&Array.isArray(p.files)&&p.files.length){files=p.files.map((f,index)=>{const name=String(f?.name||f?.path||("file_"+(index+1)+".ino")).split(/[\\/]/).pop();const path=String(f?.path||f?.name||name);return {path,name,content:String(f?.content??"")};}).filter(f=>f.path&&f.name);}}catch(e){console.warn(e);}if(!files.length)files=[{path:"sketch/sketch.ino",name:"sketch.ino",content:"void setup(){}\nvoid loop(){}\n"}];open(files[0].path);}
  function add(file){let path=file.path||file.name||"new_file.ino";if(byPath(path)){let n=2,base=path.replace(/(\.[^.]+)?$/,""),ext=(path.match(/\.[^.]+$/)||[""])[0];while(byPath(base+"_"+n+ext))n++;path=base+"_"+n+ext;}const f={path,name:path.split(/[\\/]/).pop(),content:file.content||""};files.push(f);open(path);render();return f;}
  function documentChanged(doc){const f=byPath(doc.path)||byPath(doc.name);if(f)f.content=doc.content;}
  function remove(path){files=files.filter(f=>f.path!==path);if(!files.length)files.push({path:"sketch/sketch.ino",name:"sketch.ino",content:"void setup(){}\nvoid loop(){}\n"});if(activePath===path)open(files[0].path);render();}
  async function importFiles(list){
    // Изчакваме всички файлове, преди да визуализираме папката.
    const imported=await Promise.all(Array.from(list).map(async file=>{
      const path=file.webkitRelativePath||file.name;
      return {path,name:path.split(/[\\\\/]/).pop(),content:await file.text()};
    }));
    if(!imported.length)return;
    files=imported;
    activePath=files[0].path;
    render();
    open(activePath);
    await save();
  }
  function exportProject(){window.A7Editor.getFiles().forEach(d=>{const f=byPath(d.path);if(f)f.content=d.content;});const data=JSON.stringify({name:projectName,files},null,2);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type:"application/json"}));a.download="arduino-project.json";a.click();URL.revokeObjectURL(a.href);}
  function exportAll(){files.forEach(f=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([f.content],{type:"text/plain;charset=utf-8"}));a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});}
  window.A7Project={save,restore,add,open,remove,refresh:render,files:()=>files.slice(),documentChanged,importFiles,exportProject,exportAll,activePath:()=>activePath,rename(path,newPath){const f=byPath(path);if(!f||!newPath)return;f.path=newPath;f.name=newPath.split(/[\\/]/).pop();render();}};
})();