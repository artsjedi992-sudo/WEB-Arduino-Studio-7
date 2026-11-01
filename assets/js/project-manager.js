/* Файловият мениджър работи с локални файлове и IndexedDB. */
(function(){
  "use strict";
  const tree=document.getElementById("file-tree");
  const projectName="Моят Arduino проект";
  let files=[{name:"sketch.ino",content:"// Arduino Studio 7 Web\n// Примерен скетч за Arduino Uno.\n\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n}\n"}];

  // Рисува списъка с файлове и маркира активния файл.
  function render(){
    tree.innerHTML="";
    files.forEach(file=>{
      const button=document.createElement("button");button.className="file-item";
      const icon=document.createElement("span");icon.className="file-icon";icon.textContent=file.name.endsWith(".ino")?"◈":file.name.endsWith(".h")?"＃":"▤";
      button.append(icon,document.createTextNode(file.name));
      button.addEventListener("click",()=>{const item=window.A7Editor.files().find(f=>f.name===file.name);if(item)window.A7Editor.activate(item.id);});
      tree.appendChild(button);
    });
  }

  // Синхронизира файловия списък с отворените табове.
  function sync(){files=window.A7Editor.getFiles();render();}

  // Запазва проектните файлове в браузърната база.
  async function save(){
    sync();
    const project={id:"last-project",name:projectName,files:files,updated:new Date().toISOString()};
    await window.A7Storage.save(project);
  }

  // Зарежда последния проект, ако има такъв.
  async function restore(){
    try{const saved=await window.A7Storage.load("last-project");if(saved&&saved.files&&saved.files.length)files=saved.files;}catch(error){console.warn(error);}
    window.A7Editor.replaceAll(files.map(file=>({name:file.name,content:file.content})));
    render();
  }

  // Добавя файл от потребителя към проекта.
  function add(file){files.push(file);window.A7Editor.add({name:file.name,content:file.content});render();}

  window.A7Project={save,restore,add,refresh:sync,files:()=>files};
})();