(function(){
  const frame=document.getElementById('adminFrame');
  if(!frame) return;
  const API='https://script.google.com/macros/s/AKfycbzGGmCePitQSQPoNT4_Wpu6mHkXAjaYI6_F2sRvYy6LbaAPpRg1mpeojO_4hO1vcPCRog/exec';

  frame.addEventListener('load',()=>{
    const w=frame.contentWindow;
    if(!w||w.__syncVerifyPatched) return;
    w.__syncVerifyPatched=true;

    const originalSaveProducts=typeof w.saveProducts==='function'?w.saveProducts.bind(w):null;
    if(!originalSaveProducts) return;

    async function verifyPublished(savedProducts){
      try{
        const res=await fetch(API+'?action=getProducts&_='+Date.now(),{cache:'no-store'});
        if(!res.ok) throw new Error('HTTP '+res.status+' al verificar catálogo');
        const data=await res.json();
        if(!data||!data.ok||!Array.isArray(data.products)) throw new Error((data&&data.error)||'Respuesta inválida de Apps Script');

        const remote=data.products;
        const latest=Array.isArray(savedProducts)&&savedProducts.length?savedProducts[savedProducts.length-1]:null;
        let found=true;
        if(latest){
          const id=String(latest.id||'');
          const name=String(latest.name||'').trim().toLowerCase();
          found=remote.some(p=>{
            if(id&&String(p.id||'')===id) return true;
            return name&&String(p.name||'').trim().toLowerCase()===name;
          });
        }

        if(found){
          if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(true);
          if(typeof w.showToast==='function') w.showToast('✓ Guardado en Google Sheets y visible para la web','success');
        }else{
          if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(false);
          if(typeof w.showToast==='function') w.showToast('El producto quedó en el panel, pero Apps Script todavía no lo devolvió desde Google Sheets','error');
        }
      }catch(err){
        if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(false);
        if(typeof w.showToast==='function') w.showToast('No se pudo verificar la publicación: '+(err.message||err),'error');
      }
    }

    w.saveProducts=function(p){
      const result=originalSaveProducts(p);
      setTimeout(()=>verifyPublished(p),1400);
      return result;
    };
  });
})();