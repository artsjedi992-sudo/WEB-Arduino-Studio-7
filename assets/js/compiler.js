/* Адаптер за бъдеща интеграция на истински Arduino компилатор. */
(function(){
  "use strict";
  // В тази версия няма вграден AVR-GCC/WASM toolchain.
  // Функцията не симулира компилация и не връща измислен HEX файл.
  async function compile(){
    return {success:false,message:"Компилаторът още не е интегриран. Нужен е реален AVR-GCC toolchain за WebAssembly или сървърна компилация."};
  }
  // Качването не е налично, докато не бъде осигурен съвместим Serial API.
  async function upload(){
    return {success:false,message:"Качването към платка още не е реализирано. Текущият Firefox 115 под Windows 7 няма Web Serial API."};
  }
  window.A7Compiler={compile,upload};
})();