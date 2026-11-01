/* Локалното хранилище пази проекта в браузъра без външен сървър. */
(function(){
  "use strict";
  const DB_NAME="arduino-studio-7-web";
  const STORE="projects";
  let database=null;

  // Отваря базата данни и създава хранилището при първо стартиране.
  function openDatabase(){
    return new Promise((resolve,reject)=>{
      if(!("indexedDB" in window)){reject(new Error("Този браузър не поддържа IndexedDB."));return;}
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"id"});};
      request.onsuccess=()=>{database=request.result;resolve(database);};
      request.onerror=()=>reject(request.error||new Error("Грешка при отваряне на локалното хранилище."));
    });
  }

  // Записва цялото състояние на проекта като един обект.
  async function saveProject(project){
    const db=database||await openDatabase();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put(project);
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>reject(tx.error||new Error("Проектът не може да бъде записан."));
    });
  }

  // Зарежда последния записан проект.
  async function loadProject(id){
    const db=database||await openDatabase();
    return new Promise((resolve,reject)=>{
      const request=db.transaction(STORE,"readonly").objectStore(STORE).get(id);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||new Error("Проектът не може да бъде зареден."));
    });
  }

  // Предоставя малък публичен интерфейс на останалите модули.
  window.A7Storage={open:openDatabase,save:saveProject,load:loadProject};
})();