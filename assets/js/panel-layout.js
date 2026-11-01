/* Управление на размерите и видимостта на панелите в IDE. */
(function(){
  "use strict";

  // Основните HTML елементи на панелите и плъзгачите.
  const body=document.body;
  const explorer=document.querySelector(".explorer");
  const explorerSplitter=document.getElementById("explorer-splitter");
  const bottom=document.querySelector(".bottom-panel");
  const bottomSplitter=document.getElementById("bottom-splitter");
  const hideExplorer=document.getElementById("btn-toggle-explorer");
  const hideBottom=document.getElementById("btn-hide-bottom");
  const showBottom=document.getElementById("btn-toggle-bottom");

  // Стойностите по подразбиране са близки до първоначалния изглед.
  let explorerWidth=225;
  let bottomHeight=164;
  let drag=null;

  // Възстановяване на настройките, ако браузърът разрешава локално хранилище.
  try{
    const saved=JSON.parse(localStorage.getItem("a7-panel-layout")||"{}");
    if(Number.isFinite(saved.explorerWidth)) explorerWidth=saved.explorerWidth;
    if(Number.isFinite(saved.bottomHeight)) bottomHeight=saved.bottomHeight;
    if(saved.explorerCollapsed) body.classList.add("explorer-collapsed");
    if(saved.bottomCollapsed) body.classList.add("bottom-collapsed");
  }catch(error){
    // При забранено хранилище IDE продължава с размерите по подразбиране.
  }

  // Прилага текущите размери към CSS променливите.
  function apply(){
    body.style.setProperty("--a7-explorer-width",explorerWidth+"px");
    body.style.setProperty("--a7-bottom-height",bottomHeight+"px");
    if(hideExplorer) hideExplorer.textContent=body.classList.contains("explorer-collapsed")?"▶":"◀";
    if(hideExplorer) hideExplorer.title=body.classList.contains("explorer-collapsed")?"Покажи Explorer":"Скрий Explorer";
    if(showBottom) showBottom.textContent=body.classList.contains("bottom-collapsed")?"Покажи долен панел":"Долен панел";
  }

  // Записва настройките отделно от файловете на проекта.
  function persist(){
    try{
      localStorage.setItem("a7-panel-layout",JSON.stringify({
        explorerWidth:explorerWidth,
        bottomHeight:bottomHeight,
        explorerCollapsed:body.classList.contains("explorer-collapsed"),
        bottomCollapsed:body.classList.contains("bottom-collapsed")
      }));
    }catch(error){
      // Липсата на localStorage не пречи на текущата сесия.
    }
  }

  // Започва плъзгане с мишката на съответния разделител.
  function beginDrag(event,axis){
    if(event.button!==0) return;
    event.preventDefault();
    drag={axis:axis,start:axis==="x"?event.clientX:event.clientY,
      initial:axis==="x"?explorerWidth:bottomHeight};
    body.classList.add("resizing",axis==="x"?"resizing-col":"resizing-row");
    (axis==="x"?explorerSplitter:bottomSplitter).classList.add("dragging");
  }

  // Променя ширината на Explorer или височината на долния панел.
  function moveDrag(event){
    if(!drag) return;
    if(drag.axis==="x"){
      explorerWidth=Math.max(145,Math.min(520,drag.initial+event.clientX-drag.start));
    }else{
      const max=Math.max(120,Math.floor(window.innerHeight*.65));
      bottomHeight=Math.max(90,Math.min(max,drag.initial+drag.start-event.clientY));
    }
    apply();
  }

  // Завършва плъзгането и запазва новите размери.
  function endDrag(){
    if(!drag) return;
    drag=null;
    body.classList.remove("resizing","resizing-col","resizing-row");
    if(explorerSplitter) explorerSplitter.classList.remove("dragging");
    if(bottomSplitter) bottomSplitter.classList.remove("dragging");
    persist();
  }

  // Свива или показва Explorer, без да губи избраната ширина.
  if(hideExplorer) hideExplorer.addEventListener("click",function(){
    body.classList.toggle("explorer-collapsed");
    apply();
    persist();
  });

  // Скрива долния панел от неговата лента.
  if(hideBottom) hideBottom.addEventListener("click",function(){
    body.classList.add("bottom-collapsed");
    apply();
    persist();
  });

  // Бутонът в горната лента връща долния панел.
  if(showBottom) showBottom.addEventListener("click",function(){
    body.classList.toggle("bottom-collapsed");
    apply();
    persist();
  });

  // Разделителите приемат стандартни събития на мишката за Firefox и Chromium.
  if(explorerSplitter) explorerSplitter.addEventListener("mousedown",function(event){beginDrag(event,"x");});
  if(bottomSplitter) bottomSplitter.addEventListener("mousedown",function(event){beginDrag(event,"y");});
  document.addEventListener("mousemove",moveDrag);
  document.addEventListener("mouseup",endDrag);
  window.addEventListener("blur",endDrag);

  // При промяна на размера на прозореца ограничаваме долния панел.
  window.addEventListener("resize",function(){
    bottomHeight=Math.min(bottomHeight,Math.max(90,Math.floor(window.innerHeight*.65)));
    apply();
  });

  // Първоначално визуализиране на запомненото разположение.
  apply();
})();