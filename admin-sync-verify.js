// Legacy compatibility shim.
// Publication is handled directly by admin-core.html.
// This file intentionally does not override saveProducts, pushToSheets or autoPush.
(function(){
  const frame=document.getElementById('adminFrame');
  if(!frame) return;

  frame.addEventListener('load',()=>{
    const w=frame.contentWindow;
    if(!w) return;
    w.__syncVerifyPatched=true;
  });
})();
