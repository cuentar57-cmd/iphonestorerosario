(function(){
  const frame=document.getElementById('adminFrame');
  if(!frame) return;
  const API='https://script.google.com/macros/s/AKfycbzGGmCePitQSQPoNT4_Wpu6mHkXAjaYI6_F2sRvYy6LbaAPpRg1mpeojO_4hO1vcPCRog/exec';

  frame.addEventListener('load',()=>{
    const w=frame.contentWindow;
    if(!w||w.__syncVerifyPatched) return;
    w.__syncVerifyPatched=true;

    const originalSaveProducts=typeof w.saveProducts==='function'?w.saveProducts.bind(w):null;
    const originalSyncFromSheets=typeof w.syncFromSheets==='function'?w.syncFromSheets.bind(w):null;
    const originalPushToSheets=typeof w.pushToSheets==='function'?w.pushToSheets.bind(w):null;
    if(!originalSaveProducts) return;

    // Never hide Google Sheets write errors. The original admin used silent=true,
    // which made a failed POST look like a successful local save.
    if(originalPushToSheets){
      w.pushToSheets=function(){
        return originalPushToSheets(false);
      };
      w.autoPush=function(){
        return w.pushToSheets(false);
      };
    }

    let pendingProduct=null;

    async function fetchRemote(){
      const res=await fetch(API+'?action=getProducts&_='+Date.now(),{cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status+' al verificar catálogo');
      const data=await res.json();
      if(!data||!data.ok||!Array.isArray(data.products)) throw new Error((data&&data.error)||'Respuesta inválida de Apps Script');
      return data.products;
    }

    async function verifyPublished(){
      if(!pendingProduct) return false;
      try{
        const remote=await fetchRemote();
        const targetId=String(pendingProduct.id||'');
        const found=targetId && remote.some(p=>String(p.id||'')===targetId);

        if(found){
          pendingProduct=null;
          if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(true);
          if(typeof w.showToast==='function') w.showToast('✓ Producto confirmado en Google Sheets','success');
          return true;
        }

        if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(false);
        if(typeof w.showToast==='function') w.showToast('⚠️ El producto NO quedó guardado en Google Sheets. Revisá el error de exportación.','error');
        return false;
      }catch(err){
        if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(false);
        if(typeof w.showToast==='function') w.showToast('No se pudo confirmar el guardado real: '+(err.message||err),'error');
        return false;
      }
    }

    w.saveProducts=function(p){
      if(Array.isArray(p)&&p.length){
        pendingProduct={...p[0]};
      }
      const result=originalSaveProducts(p);
      setTimeout(verifyPublished,1800);
      setTimeout(verifyPublished,4200);
      return result;
    };

    if(originalSyncFromSheets){
      w.syncFromSheets=async function(silent=false){
        if(pendingProduct){
          const confirmed=await verifyPublished();
          if(!confirmed){
            if(typeof w.showToast==='function') w.showToast('Sincronización bloqueada: el producto pendiente todavía no está en Google Sheets.','error');
            return false;
          }
        }
        return originalSyncFromSheets(silent);
      };
    }
  });
})();