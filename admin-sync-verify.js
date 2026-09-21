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

    let pendingCatalog=null;
    let lastServerError='';

    function normalizeCatalog(catalog){
      return (Array.isArray(catalog)?catalog:[]).map(p=>({
        ...p,
        priceUsd:Number(p.priceUsd||p.usd||p.price||0),
        usd:Number(p.priceUsd||p.usd||p.price||0),
        price:Number(p.priceUsd||p.usd||p.price||0)
      }));
    }

    function asBoolean(value, defaultValue=true){
      if(value === true || value === 1) return true;
      if(value === false || value === 0) return false;
      const raw=String(value ?? '').toLowerCase().trim();
      if(['true','1','si','sí','activo','disponible','con stock','verdadero'].includes(raw)) return true;
      if(['false','0','no','inactivo','sin stock','agotado','falso'].includes(raw)) return false;
      return defaultValue;
    }

    function canonicalCatalog(catalog){
      return normalizeCatalog(catalog)
        .map(p=>({
          id:String(p.id||''),
          name:String(p.name||''),
          category:String(p.category||''),
          brand:String(p.brand||''),
          model:String(p.model||''),
          storage:String(p.storage||''),
          condition:String(p.condition||''),
          battery:String(p.battery||''),
          color:String(p.color||''),
          priceUsd:Number(p.priceUsd||0),
          image:String(p.image||''),
          badge:String(p.badge||''),
          stock:asBoolean(p.stock,true),
          active:asBoolean(p.active,true),
          description:String(p.description||'')
        }))
        .sort((a,b)=>a.id.localeCompare(b.id));
    }

    function catalogsMatch(a,b){
      return JSON.stringify(canonicalCatalog(a))===JSON.stringify(canonicalCatalog(b));
    }

    async function fetchRemote(){
      const res=await fetch(API+'?action=getProducts&_='+Date.now(),{
        cache:'no-store',
        headers:{
          'Cache-Control':'no-cache, no-store, max-age=0',
          'Pragma':'no-cache'
        }
      });
      if(!res.ok) throw new Error('HTTP '+res.status+' al verificar catálogo');
      const data=await res.json();
      if(!data||!data.ok||!Array.isArray(data.products)){
        throw new Error((data&&data.error)||'Respuesta inválida de Apps Script');
      }
      return data.products;
    }

    async function verifyPublished(){
      if(!pendingCatalog) return true;
      try{
        const remote=await fetchRemote();

        if(catalogsMatch(remote,pendingCatalog)){
          pendingCatalog=null;
          lastServerError='';
          if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(true);
          if(typeof w.showToast==='function'){
            w.showToast('✓ Catálogo confirmado en Google Sheets y publicado','success');
          }
          return true;
        }

        if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(false);
        if(typeof w.showToast==='function'){
          w.showToast('⚠️ El catálogo guardado todavía no coincide con Google Sheets.','error');
        }
        return false;
      }catch(err){
        if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(false);
        if(typeof w.showToast==='function'){
          w.showToast('No se pudo verificar el catálogo: '+(err.message||err),'error');
        }
        return false;
      }
    }

    async function persistCatalog(catalog){
      pendingCatalog=normalizeCatalog(catalog);

      try{
        const token=typeof w.getSessionToken==='function'?w.getSessionToken():'';

        if(typeof w.showToast==='function'){
          w.showToast('Guardando cambios en la tienda...','info');
        }

        const res=await fetch(API,{
          method:'POST',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body:JSON.stringify({
            action:'saveProducts',
            sessionToken:token,
            products:pendingCatalog
          })
        });

        const raw=await res.text();
        let data;
        try{ data=JSON.parse(raw); }
        catch(e){ throw new Error('Apps Script devolvió una respuesta no JSON: '+raw.slice(0,180)); }

        if(!res.ok){
          throw new Error('HTTP '+res.status+': '+(data.error||data.message||raw));
        }
        if(!data.ok){
          throw new Error(data.error||data.message||'Apps Script rechazó el guardado');
        }

        lastServerError='';

        // Releer hasta confirmar exactamente el catálogo que se acaba de guardar.
        for(let attempt=0;attempt<4;attempt++){
          if(await verifyPublished()) return true;
          await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)));
        }

        throw new Error('Google Sheets respondió, pero al releer todavía no coincide con los cambios realizados.');
      }catch(err){
        lastServerError=String(err&&err.message?err.message:err);
        if(typeof w.updateSheetsBadge==='function') w.updateSheetsBadge(false);
        if(typeof w.showToast==='function'){
          w.showToast('ERROR AL PUBLICAR: '+lastServerError,'error');
        }
        setTimeout(()=>w.alert(
          'No se pudo confirmar la publicación de los cambios.\n\n'+
          lastServerError+
          '\n\nLa web pública NO dará por válido un catálogo viejo.'
        ),100);
        return false;
      }
    }

    // Evita el POST silencioso heredado. A partir de ahora hay una sola escritura
    // controlada y luego se relee Google Sheets para verificar el catálogo exacto.
    w.pushToSheets=function(){ return Promise.resolve(true); };
    w.autoPush=function(){ return Promise.resolve(true); };

    w.saveProducts=function(p){
      const result=originalSaveProducts(p);
      persistCatalog(p);
      return result;
    };

    if(originalSyncFromSheets){
      w.syncFromSheets=async function(silent=false){
        if(pendingCatalog){
          const confirmed=await verifyPublished();
          if(!confirmed){
            const suffix=lastServerError?' Error: '+lastServerError:'';
            if(typeof w.showToast==='function'){
              w.showToast('Sincronización bloqueada: hay cambios todavía no confirmados.'+suffix,'error');
            }
            return false;
          }
        }
        return originalSyncFromSheets(silent);
      };
    }
  });
})();