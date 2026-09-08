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
    if(!originalSaveProducts) return;

    let pendingProduct=null;
    let lastServerError='';

    async function fetchRemote(){
      const res=await fetch(API+'?action=getProducts&_='+Date.now(),{cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status+' al verificar catálogo');
      const data=await res.json();
      if(!data||!data.ok||!Array.isArray(data.products)) throw new Error((data&&data.error)||'Respuesta inválida de Apps Script');
      return data.products;
    }

    async function persistCatalog(catalog){
      try{
        const token=typeof w.getSessionToken==='function'?w.getSessionToken():'';
        const productsForSheets=(Array.isArray(catalog)?catalog:[]).map(p=>({
          ...p,
          priceUsd:Number(p.priceUsd||p.usd||p.price||0),
          usd:Number(p.priceUsd||p.usd||p.price||0),
          price:Number(p.priceUsd||p.usd||p.price||0)
        }));

        if(typeof w.showToast==='function') w.showToast('Guardando en Google Sheets...','info');

        const res=await fetch(API,{
          method:'POST',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body:JSON.stringify({
            action:'saveProducts',
            sessionToken:token,
            products:productsForSheets
          })
        });

        const raw=await res.text();
        let data;
        try{ data=JSON.parse(raw); }
        catch(e){ throw new Error('Apps Script devolvió una respuesta no JSON: '+raw.slice(0,180)); }

        if(!res.ok) throw new Error('HTTP '+res.status+': '+(data.error||data.message||raw));
        if(!data.ok) throw new Error(data.error||data.message||'Apps Script rechazó el guardado');

        lastServerError='';
        if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(true);
        if(typeof w.showToast==='function') w.showToast('✓ Google Sheets confirmó el guardado','success');
        setTimeout(verifyPublished,900);
        return true;
      }catch(err){
        lastServerError=String(err&&err.message?err.message:err);
        if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(false);
        if(typeof w.showToast==='function') w.showToast('ERROR GOOGLE SHEETS: '+lastServerError,'error');
        // Keep the exact server error visible even if another toast fires afterwards.
        setTimeout(()=>w.alert('Error al guardar en Google Sheets:\n\n'+lastServerError),100);
        return false;
      }
    }

    async function verifyPublished(){
      if(!pendingProduct) return false;
      try{
        const remote=await fetchRemote();
        const targetId=String(pendingProduct.id||'');
        const found=targetId && remote.some(p=>String(p.id||'')===targetId);

        if(found){
          pendingProduct=null;
          lastServerError='';
          if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(true);
          if(typeof w.showToast==='function') w.showToast('✓ Producto confirmado en Google Sheets y listo para la web','success');
          return true;
        }

        if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(false);
        if(!lastServerError&&typeof w.showToast==='function') w.showToast('⚠️ Apps Script respondió OK, pero el producto aún no aparece al releer Google Sheets.','error');
        return false;
      }catch(err){
        if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(false);
        if(!lastServerError&&typeof w.showToast==='function') w.showToast('No se pudo verificar el catálogo: '+(err.message||err),'error');
        return false;
      }
    }

    w.saveProducts=function(p){
      if(Array.isArray(p)&&p.length) pendingProduct={...p[0]};
      const result=originalSaveProducts(p);
      // Persist the exact catalog supplied by the admin, independently of the legacy silent autoPush.
      persistCatalog(p);
      return result;
    };

    // saveProduct() calls autoPush() immediately after saveProducts(). Avoid a duplicate POST;
    // persistence is now handled above with exact error reporting.
    w.autoPush=function(){ return true; };

    if(originalSyncFromSheets){
      w.syncFromSheets=async function(silent=false){
        if(pendingProduct){
          const confirmed=await verifyPublished();
          if(!confirmed){
            const suffix=lastServerError?' Error: '+lastServerError:'';
            if(typeof w.showToast==='function') w.showToast('Sincronización bloqueada: el producto pendiente no está en Google Sheets.'+suffix,'error');
            return false;
          }
        }
        return originalSyncFromSheets(silent);
      };
    }
  });
})();