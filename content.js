function _calcMidjourneyAspectRatio(w,h){
  if(!w||!h||typeof w!=='number'||typeof h!=='number'||w<=0||h<=0)return "16:9";
  var r=w/h;
  if(r>=2.0)return "21:9";
  if(r>=1.55)return "16:9";
  if(r>=1.35)return "3:2";
  if(r>=1.15)return "4:3";
  if(r>=0.92&&r<=1.08)return "1:1";
  if(r>=0.72&&r<0.92)return "4:5";
  if(r>=0.58&&r<0.72)return "2:3";
  if(r<0.58)return "9:16";
  return "16:9";
}
(function(){if(window._pmContentLoaded){return;}window._pmContentLoaded=true;var _MID='pm-glass-modal',_BID='pm-hover-btn',_cImg=null,_hTmr=null,_cpTmr=null,_PM_MAX_B64=5600000,_PM_MIN_B64=120;
function _pmSetHoverEnabled(enabled){
  window._pmHE=enabled!==false;
  var btn=document.getElementById(_BID);
  if(!btn)return;
  if(window._pmHE){
    btn.classList.remove('pm-force-hide');
  }else{
    btn.classList.add('pm-force-hide');
    _hBtn();
  }
}
function _pmCanonUrl(u){try{return new URL(String(u||''),location.href).href;}catch(e){return String(u||'');}}
function _pmDataUrlUnderCap(dataUrl){var b64=String(dataUrl||'').split(',')[1]||'';return b64.length>=_PM_MIN_B64&&b64.length<_PM_MAX_B64;}
async function _pmFetchAsDataUrl(url,credentials){
  if(!url||!/^https?:\/\//i.test(url))return null;
  try{
    var r=await fetch(String(url),{mode:'cors',credentials:credentials||'include',cache:'no-store',referrerPolicy:'strict-origin-when-cross-origin'});
    if(!r.ok)return null;
    var b=await r.blob();
    if(!b||!b.size||b.size<200)return null;
    var ct=(b.type||'').toLowerCase();
    if(ct.indexOf('text/')>=0)return null;
    if(ct.indexOf('image/')!==0&&ct.indexOf('octet-stream')<0&&b.size<2000)return null;
    return await new Promise(function(res){var fr=new FileReader();fr.onload=function(){res(fr.result);};fr.onerror=function(){res(null);};fr.readAsDataURL(b);});
  }catch(e){return null;}
}
async function _pmEnsureDecode(img){if(!img)return;try{if(img.decode)await img.decode();}catch(e){}}
function _findBestImgForSrc(targetUrls){
  var targets=[],seenT={},i,u;
  for(i=0;i<targetUrls.length;i++){u=_pmCanonUrl(targetUrls[i]);if(u&&!seenT[u]){seenT[u]=1;targets.push(u);}}
  if(!targets.length)return null;
  var all=document.querySelectorAll('img'),best=null,bestArea=0,ti,img,urls,j,match,strip=function(x){var p=x.indexOf('?');return p>=0?x.slice(0,p):x;};
  for(i=0;i<all.length;i++){
    img=all[i];
    if(!_vImg(img))continue;
    urls=[img.src,img.currentSrc,img.getAttribute('data-src')||'',img.getAttribute('data-lazy-src')||''].map(_pmCanonUrl).filter(Boolean);
    match=false;
    for(ti=0;ti<targets.length;ti++){
      for(j=0;j<urls.length;j++){
        if(urls[j]===targets[ti]){match=true;break;}
        if(strip(urls[j])===strip(targets[ti])){match=true;break;}
      }
      if(match)break;
    }
    if(!match)continue;
    var w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,area=(w||0)*(h||0);
    if(area>bestArea){bestArea=area;best=img;}
  }
  return best;
}
function _pmCanvasDataUrl(img){
  if(!img)return null;
  var w=img.naturalWidth||img.width||0,h=img.naturalHeight||img.height||0;
  if(w<2||h<2)return null;
  var maxD=768,scale=Math.min(1,maxD/Math.max(w,h)),cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale)),c,ctx,q,data,attempt,pngTry;
  c=document.createElement('canvas');c.width=cw;c.height=ch;ctx=c.getContext('2d');
  try{
    ctx.drawImage(img,0,0,cw,ch);
    q=0.88;
    for(attempt=0;attempt<5;attempt++){
      data=c.toDataURL('image/jpeg',q);
      if(_pmDataUrlUnderCap(data))return data;
      q-=0.14;
      cw=Math.max(64,Math.round(cw*0.86));ch=Math.max(64,Math.round(ch*0.86));
      c.width=cw;c.height=ch;ctx=c.getContext('2d');ctx.drawImage(img,0,0,cw,ch);
    }
    data=c.toDataURL('image/jpeg',0.72);
    if(_pmDataUrlUnderCap(data))return data;
    try{
      pngTry=c.toDataURL('image/png');
      if(_pmDataUrlUnderCap(pngTry))return pngTry;
    }catch(eP){}
    return data;
  }catch(e){return null;}
}
async function _pmCaptureImageMsg(msg){
  var src=String((msg&&msg.src)||''),norm=String((msg&&msg.normalizedSrc)||''),tryUrls=[],seen={},i,u,du,img;
  if(!src)return{ok:false};
  if(norm&&norm!==src)tryUrls.push(norm);
  tryUrls.push(src);
  for(i=0;i<tryUrls.length;i++){
    u=tryUrls[i];
    if(!u||seen[u])continue;seen[u]=1;
    if(!/^https?:\/\//i.test(u))continue;
    du=await _pmFetchAsDataUrl(u,'include');
    if(du&&_pmDataUrlUnderCap(du))return{ok:true,dataUrl:du};
    du=await _pmFetchAsDataUrl(u,'omit');
    if(du&&_pmDataUrlUnderCap(du))return{ok:true,dataUrl:du};
  }
  img=_findBestImgForSrc(norm&&norm!==src?[norm,src]:[src]);
  if(img){
    await _pmEnsureDecode(img);
    du=_pmCanvasDataUrl(img);
    if(du&&_pmDataUrlUnderCap(du))return{ok:true,dataUrl:du};
  }
  return{ok:false};
}
chrome.storage.local.get(['hover_button_enabled','hoverButtonEnabled'],function(d){
  var v=(d.hover_button_enabled!==undefined)?d.hover_button_enabled:d.hoverButtonEnabled;
  _pmSetHoverEnabled(v!==false);
});
chrome.runtime.onMessage.addListener(function(msg,sender,sendResponse){
  if(msg.type==="PM_CAPTURE_IMAGE"){
    _pmCaptureImageMsg(msg).then(function(r){try{sendResponse(r||{ok:false});}catch(e){}}).catch(function(){try{sendResponse({ok:false});}catch(e2){}});
    return true;
  }
  if(msg.type==="SHOW_LOADING")_shLd();
  if(msg.type==="SHOW_RESULT")_shRs(msg.prompt,msg.detectedStyle,msg.elapsed);
  if(msg.type==="SHOW_ERROR")_shEr(msg.message);
  if(msg.type==="FIND_AND_GENERATE")_fAG();
  if(msg.type==="HOVER_BUTTON_TOGGLE"){window._pmHE=msg.enabled;if(!msg.enabled){_hBtn();clearTimeout(_hTmr);}}
  if(msg.type==="START_BULK_SELECT")_startBulkSelect();
});
async function _fAG(){
  var img=_fBI();
  if(!img){_shEr('No suitable image found on this page. Try hovering over an image and using the \u2728 button instead.');return;}
  var src=img.src||img.currentSrc||img.getAttribute('data-src')||img.getAttribute('data-lazy-src')||'';
  if(!src){_shEr('Could not get image URL. Try the hover button on the image directly.');return;}
  _shLd();
  try{
    var r=await chrome.runtime.sendMessage({type:"GENERATE_FROM_CONTENT",src:src,aspectRatio:_calcMidjourneyAspectRatio((_cImg?(_cImg.naturalWidth||_cImg.width):0)||(img?(img.naturalWidth||img.width):0), (_cImg?(_cImg.naturalHeight||_cImg.height):0)||(img?(img.naturalHeight||img.height):0)),provider:null,key:null});
    if(r&&r.error)_shEr(r.error);
    else if(r&&r.prompt)_shRs(r.prompt);
    else _shEr('No response. Please try again.');
  }catch(e){_shEr(e.message||'Something went wrong.');}
}
function _fBI(){
  var all=Array.from(document.querySelectorAll('img')),vw=window.innerWidth,vh=window.innerHeight;
  var mx=window._pmMX||vw/2,my=window._pmMY||vh/2;
  var cands=all.filter(function(img){
    var s=img.src||img.currentSrc||'';
    if(!s||s.startsWith('data:image/gif')||s.includes('1x1')||s.includes('pixel'))return false;
    var r=img.getBoundingClientRect();
    if(r.width<80||r.height<80)return false;
    if(r.bottom<0||r.top>vh||r.right<0||r.left>vw)return false;
    return true;
  });
  if(!cands.length)return null;
  var sc=cands.map(function(img){
    var r=img.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    var d=Math.sqrt(Math.pow(cx-mx,2)+Math.pow(cy-my,2));
    return{img:img,score:(r.width*r.height)/(d+1)};
  });
  sc.sort(function(a,b){return b.score-a.score;});
  return sc[0].img;
}
function _iHB(){
  if(document.getElementById('pm-hover-styles'))return;
  var s=document.createElement('style');s.id='pm-hover-styles';
  s.textContent='#pm-hover-btn{position:absolute;z-index:2147483646;display:none;align-items:center;gap:6px;padding:6px 13px 6px 10px;background:rgba(10,10,20,0.92);border:1px solid rgba(255,255,255,0.15);border-radius:20px;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Display\',sans-serif;font-size:12px;font-weight:600;color:rgba(255,255,255,0.88);letter-spacing:0.1px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 2px 12px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.07);pointer-events:all;white-space:nowrap;opacity:0;transform:translateY(-4px);transition:opacity 0.18s ease,transform 0.18s ease,background 0.18s ease,box-shadow 0.18s ease;}#pm-hover-btn.pm-visible{opacity:1;transform:translateY(0);}#pm-hover-btn.pm-force-hide{display:none!important;opacity:0!important;pointer-events:none!important;}#pm-hover-btn:hover{background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-color:transparent;box-shadow:0 4px 18px rgba(99,102,241,0.45);}#pm-hover-btn:active{transform:scale(0.97);}#pm-hover-btn .pm-btn-icon{font-size:13px;line-height:1;display:inline-block;transition:transform 0.15s ease;}#pm-hover-btn:hover .pm-btn-icon{transform:rotate(-8deg) scale(1.15);}';
  document.head.appendChild(s);
  var _PM_ICON_IDLE='<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z"/><path d="M19 15l.8 2.4L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.6z"/></svg>';
  var _PM_ICON_HOVER='<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>';
  var _PM_ICON_BUSY='<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-9-9"/></svg>';
  var btn=document.createElement('div');btn.id=_BID;
  btn.innerHTML='<span class="pm-btn-icon">'+_PM_ICON_IDLE+'</span> Generate Prompt';
  document.body.appendChild(btn);
  btn.addEventListener('mouseenter',function(){clearTimeout(_hTmr);btn.querySelector('.pm-btn-icon').innerHTML=_PM_ICON_HOVER;});
  btn.addEventListener('mouseleave',function(){btn.querySelector('.pm-btn-icon').innerHTML=_PM_ICON_IDLE;_sHd();});
  btn.addEventListener('mousedown',async function(e){
    e.stopPropagation();e.preventDefault();
    if(!_cImg)return;
    try{
      var st=await chrome.storage.local.get(['pm_is_pro','pm_system','pm_remaining','pm_daily_limit','pm_access_gate','pm_total','pm_plan_display','pm_plan']);
      var _isPowerPlan=(String(st.pm_plan_display||'').trim().toLowerCase()==='golden'||String(st.pm_plan||'').trim().toLowerCase()==='power');
      var gate=st.pm_access_gate;
      if(gate&&gate.code&&gate.message){
        if(_isPowerPlan&&gate.code==='DAILY_LIMIT_REACHED'){
          // Power (Golden) plan: limit disabled for testing — clear gate and proceed
          try{chrome.storage.local.set({pm_access_gate:null});}catch(_cg){}
        } else if(gate.code==='DAILY_LIMIT_REACHED'){
          // Do a fresh sync first \u2014 gate may be stale from a previous day
          var _syncRes=null;
          try{_syncRes=await chrome.runtime.sendMessage({type:'SYNC_SERVER_QUOTA'});}catch(_sg){}
          // If server confirmed limit reached \u2192 do NOT clear gate, block immediately
          if(_syncRes&&_syncRes.allowed===false&&_syncRes.errorCode==='DAILY_LIMIT_REACHED'){
            btn.querySelector('.pm-btn-icon').innerHTML=_PM_ICON_IDLE;
            _shEr('PM_ERR:'+String(gate.code)+'\n'+String(gate.message));
            return;
          }
          var _gFresh=await chrome.storage.local.get(['pm_remaining','pm_access_gate']).catch(function(){return {};});
          if(!_gFresh.pm_access_gate&&typeof _gFresh.pm_remaining==='number'&&_gFresh.pm_remaining>0){
            // Gate cleared by sync \u2014 proceed with generation
          } else if(!_syncRes||_syncRes.ok===false){
            // Sync failed (network error) \u2014 if remaining > 0 locally, clear stale gate and proceed
            if(typeof _gFresh.pm_remaining==='number'&&_gFresh.pm_remaining>0){
              try{chrome.storage.local.set({pm_access_gate:null});}catch(_cg){}
            } else {
              btn.querySelector('.pm-btn-icon').innerHTML=_PM_ICON_IDLE;
              _shEr('PM_ERR:'+String(gate.code)+'\n'+String(gate.message));
              return;
            }
          } else {
            btn.querySelector('.pm-btn-icon').innerHTML=_PM_ICON_IDLE;
            _shEr('PM_ERR:'+String(gate.code)+'\n'+String(gate.message));
            return;
          }
        } else {
          btn.querySelector('.pm-btn-icon').innerHTML=_PM_ICON_IDLE;
          _shEr('PM_ERR:'+String(gate.code)+'\n'+String(gate.message));
          return;
        }
      }
      var cap=st.pm_daily_limit!=null&&st.pm_daily_limit>0?st.pm_daily_limit:(st.pm_total!=null&&st.pm_total>0?st.pm_total:null);
      var rem=typeof st.pm_remaining==='number'?st.pm_remaining:null;
      var unl=rem!=null&&rem>=999;
      if(!unl&&cap!=null&&rem!=null&&rem<=0&&!_isPowerPlan){
        // pm_remaining=0 locally \u2014 admin may have raised the limit since last sync.
        // Do a fresh server sync before blocking, so we never falsely block on stale data.
        var _syncOk=false;
        try{
          await chrome.runtime.sendMessage({type:'SYNC_SERVER_QUOTA'});
          var _fSt=await chrome.storage.local.get(['pm_remaining','pm_access_gate']);
          var _fRem=typeof _fSt.pm_remaining==='number'?_fSt.pm_remaining:0;
          if(_fRem>0&&_fRem<999&&!_fSt.pm_access_gate){_syncOk=true;rem=_fRem;}
        }catch(_se){}
        if(!_syncOk){
          btn.querySelector('.pm-btn-icon').innerHTML=_PM_ICON_IDLE;
          _shEr('PM_ERR:DAILY_LIMIT_REACHED\nDaily Limit Reached: You have used all your prompts for today. Your limit will reset at midnight. Upgrade to a higher plan for more daily prompts.');
          return;
        }
      }
    }catch(_e){}
    var targetImg=_cImg;
    var targetW=0,targetH=0;
    try{if(targetImg){targetW=targetImg.naturalWidth||targetImg.width||0;targetH=targetImg.naturalHeight||targetImg.height||0;}}catch(_){}
    var targetAr=_calcMidjourneyAspectRatio(targetW,targetH);
    var src=(targetImg&&(targetImg.src||targetImg.currentSrc||targetImg.getAttribute('data-src')))||'';
    if(!src||(src.startsWith('data:')&&src.length<200))return;
    btn.querySelector('.pm-btn-icon').innerHTML=_PM_ICON_BUSY;btn.style.opacity='0.7';
    _hBtn();_shLd();
    try{
      var r=await chrome.runtime.sendMessage({type:"GENERATE_FROM_CONTENT",src:src,aspectRatio:targetAr,provider:null,key:null});
      if(r&&r.error)_shEr(r.error);
      else if(r&&r.prompt)_shRs(r.prompt,r.detectedStyle);
      else _shEr('No response received. Please try again.');
    }catch(e){_shEr(e.message||'Something went wrong. Check your API keys.');}
  });
}
function _gIS(img){return img.src||img.currentSrc||img.getAttribute('data-src')||'';}
function _pmRealSrc(img){
  return img.currentSrc||img.src||
    img.getAttribute('data-src')||
    img.getAttribute('data-lazy-src')||
    img.getAttribute('data-original')||
    img.getAttribute('data-lazy')||
    img.getAttribute('data-url')||
    (function(){var ss=(img.getAttribute('srcset')||img.getAttribute('data-srcset')||'').trim();if(!ss)return '';var p=ss.split(',')[0].trim().split(/\s+/)[0];return p||'';})()||
    '';
}
function _vImg(img){
  if(!img||img.tagName!=='IMG')return false;
  var s=_pmRealSrc(img);
  if(!s||s.startsWith('data:image/gif')||s.includes('1x1')||s.includes('pixel'))return false;
  var r=img.getBoundingClientRect();
  return r.width>=80&&r.height>=80;
}
function _findImg(el){
  if(!el)return null;
  if(el.tagName==='IMG')return _vImg(el)?el:null;
  var img=el.querySelector('img');
  if(img&&_vImg(img))return img;
  var cur=el.parentElement;
  for(var i=0;i<6;i++){
    if(!cur||cur===document.body)break;
    img=cur.querySelector('img');
    if(img&&_vImg(img))return img;
    cur=cur.parentElement;
  }
  return null;
}
function _sBtn(img){
  try{
    chrome.storage.local.get(['hover_button_enabled','hoverButtonEnabled'],function(d){
      try{
        if(chrome.runtime.lastError)return;
        var v=(d.hover_button_enabled!==undefined)?d.hover_button_enabled:d.hoverButtonEnabled;
        _pmSetHoverEnabled(v!==false);
        if(window._pmHE===false){_hBtn();return;}
        clearTimeout(_hTmr);_cImg=img;
        var btn=document.getElementById(_BID);if(!btn)return;
        if(btn.classList.contains('pm-force-hide')){_hBtn();return;}
        var r=img.getBoundingClientRect(),sx=window.scrollX,sy=window.scrollY,bW=148;
        var left=r.left+sx+(r.width/2)-(bW/2),top=r.top+sy+10;
        if(left<sx+8)left=sx+8;
        if(left+bW>sx+window.innerWidth-8)left=sx+window.innerWidth-bW-8;
        btn.style.position='absolute';btn.style.left=left+'px';btn.style.top=top+'px';btn.style.display='flex';
        requestAnimationFrame(function(){btn.classList.add('pm-visible');});
      }catch(_e){}
    });
  }catch(e){}
}
function _sHd(){_hTmr=setTimeout(_hBtn,300);}
function _hBtn(){
  var btn=document.getElementById(_BID);if(!btn)return;
  btn.classList.remove('pm-visible');
  setTimeout(function(){if(!btn.classList.contains('pm-visible'))btn.style.display='none';},200);
  _cImg=null;
}
chrome.storage.onChanged.addListener(function(changes,area){
  if(area!=='local')return;
  var hasSnake=Object.prototype.hasOwnProperty.call(changes,'hover_button_enabled');
  var hasCamel=Object.prototype.hasOwnProperty.call(changes,'hoverButtonEnabled');
  if(!hasSnake&&!hasCamel)return;
  var enabled=true;
  if(hasSnake)enabled=changes.hover_button_enabled&&changes.hover_button_enabled.newValue!==false;
  else enabled=changes.hoverButtonEnabled&&changes.hoverButtonEnabled.newValue!==false;
  _pmSetHoverEnabled(enabled);
  if(!enabled){
    clearTimeout(_mvTmr);
    clearTimeout(_hTmr);
    _hBtn();
  }
});
var _mvTmr=null;
function _onMM(e){
  if(window._pmHE===false)return;
  window._pmMX=e.clientX;window._pmMY=e.clientY;
  var btn=document.getElementById(_BID);
  if(btn&&(e.target===btn||btn.contains(e.target))){clearTimeout(_hTmr);return;}
  clearTimeout(_mvTmr);
  _mvTmr=setTimeout(function(){
    var el=document.elementFromPoint(e.clientX,e.clientY);
    if(!el)return;
    if(el.id===_BID||el.closest&&el.closest('#'+_BID+',[id="'+_MID+'"]'))return;
    var img=_findImg(el);
    if(!img){if(_cImg)_sHd();return;}
    if(img===_cImg)return;
    clearTimeout(_hTmr);
    _sBtn(img);
  },25);
}
function _aIL(){document.querySelectorAll('img').forEach(_aTI);}
function _aTI(img){
  if(img._pmA)return;img._pmA=true;
  img.addEventListener('mouseenter',function(){
    if(!_vImg(img)||window._pmHE===false)return;
    clearTimeout(_hTmr);clearTimeout(_mvTmr);_sBtn(img);
  });
  img.addEventListener('load',function(){},{ once:true });
}
function _oNI(){
  var ob=new MutationObserver(function(muts){
    muts.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if(n.tagName==='IMG')_aTI(n);
        else if(n.querySelectorAll)n.querySelectorAll('img').forEach(_aTI);
      });
    });
  });
  ob.observe(document.body,{childList:true,subtree:true});
}
chrome.storage.local.get(['hover_button_enabled','hoverButtonEnabled'],function(d){
  var v=(d.hover_button_enabled!==undefined)?d.hover_button_enabled:d.hoverButtonEnabled;
  _pmSetHoverEnabled(v!==false);
});
document.addEventListener('mousemove',_onMM,{passive:true});
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){_iHB();_aIL();_oNI();});
}else{_iHB();_aIL();_oNI();}
function _iSt(){
  if(document.getElementById('pm-styles'))return;
  var s=document.createElement('style');s.id='pm-styles';
  s.textContent='@keyframes pm-slideUp{from{transform:translateY(40px) scale(0.94);opacity:0;filter:blur(4px);}to{transform:translateY(0) scale(1);opacity:1;filter:blur(0);}}@keyframes pm-fadeOut{to{transform:translateY(20px) scale(0.96);opacity:0;filter:blur(4px);}}@keyframes pm-breathe{0%,100%{transform:scale(1);opacity:0.6;}50%{transform:scale(1.2);opacity:1;}}@keyframes pm-shimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}#pm-glass-modal{position:fixed!important;bottom:28px!important;right:28px!important;width:380px!important;max-width:calc(100vw - 24px)!important;z-index:2147483647!important;font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Display\',\'Helvetica Neue\',sans-serif!important;animation:pm-slideUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards;box-sizing:border-box!important;}#pm-glass-modal .pm-card{background:#ffffff!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important;border:1px solid rgba(0,0,0,0.12)!important;border-radius:22px!important;box-shadow:0 20px 50px -10px rgba(0,0,0,0.25),0 0 0 1px rgba(0,0,0,0.06)!important;overflow:hidden!important;position:relative!important;max-width:100%!important;}#pm-glass-modal .pm-card::before{content:\'\'!important;position:absolute!important;top:-60px;right:-50px!important;width:180px;height:180px!important;background:radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%)!important;pointer-events:none!important;}#pm-glass-modal .pm-inner{padding:18px 20px 20px!important;position:relative!important;z-index:1!important;max-width:100%!important;box-sizing:border-box!important;}#pm-glass-modal .pm-header{display:flex!important;align-items:center!important;justify-content:space-between!important;margin-bottom:12px!important;}#pm-glass-modal .pm-title{display:flex!important;align-items:center!important;gap:7px!important;font-size:11px!important;font-weight:700!important;color:#0f172a!important;letter-spacing:1px!important;text-transform:uppercase!important;}#pm-glass-modal .pm-dot{width:7px;height:7px!important;background:linear-gradient(135deg,#3b82f6,#8b5cf6)!important;border-radius:50%!important;box-shadow:0 0 8px rgba(59,130,246,0.7)!important;}#pm-glass-modal .pm-close{width:26px;height:26px!important;background:rgba(255,255,255,0.07)!important;border:1px solid rgba(0,0,0,0.12)!important;border-radius:50%!important;color:#64748b!important;font-size:15px!important;cursor:pointer!important;display:flex;align-items:center;justify-content:center!important;transition:all 0.2s!important;line-height:1!important;}#pm-glass-modal .pm-close:hover{background:#e2e8f0!important;color:#0f172a!important;}#pm-glass-modal .pm-prompt-box{background:#f8fafc!important;border:1px solid #e2e8f0!important;border-radius:14px!important;padding:14px 16px!important;font-size:13.5px!important;line-height:1.7!important;color:#0f172a!important;max-height:300px!important;overflow-y:auto!important;margin-bottom:14px!important;word-break:break-word!important;white-space:pre-wrap!important;}#pm-glass-modal .pm-prompt-box::-webkit-scrollbar{width:3px!important;}#pm-glass-modal .pm-prompt-box::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px!important;}#pm-glass-modal .pm-btn{width:100%!important;padding:13px!important;border:none!important;border-radius:14px!important;font-size:13px!important;font-weight:700!important;cursor:pointer!important;transition:all 0.3s cubic-bezier(0.16,1,0.3,1)!important;font-family:inherit!important;letter-spacing:0.2px!important;}#pm-glass-modal .pm-btn:hover{transform:translateY(-1px)!important;filter:brightness(1.1)!important;}#pm-glass-modal .pm-btn-primary{background:linear-gradient(135deg,#3b82f6,#8b5cf6)!important;color:white!important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),0 3px 0 #3654c9!important;}#pm-glass-modal .pm-btn-primary:hover{transform:translateY(-1px)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),0 4px 0 #3654c9!important;}#pm-glass-modal .pm-btn-primary:active{transform:translateY(2px)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),0 1px 0 #3654c9!important;}#pm-glass-modal #pm-upgrade-btn:hover{transform:translateY(-1px)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),0 4px 0 #3654c9!important;}#pm-glass-modal #pm-upgrade-btn:active{transform:translateY(2px)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),0 1px 0 #3654c9!important;}#pm-glass-modal .pm-btn-success{background:linear-gradient(135deg,#10b981,#059669)!important;color:white!important;}#pm-glass-modal .pm-btn-danger{background:linear-gradient(135deg,#ef4444,#dc2626)!important;color:white!important;}#pm-glass-modal .pm-loader-wrap{text-align:center!important;padding:10px 0 6px!important;}#pm-glass-modal .pm-loader-icon{font-size:34px!important;color:#3b82f6!important;display:block!important;margin-bottom:10px!important;animation:pm-breathe 2s ease-in-out infinite!important;}#pm-glass-modal .pm-loader-text{font-size:14px!important;font-weight:600!important;color:#0f172a!important;margin-bottom:4px!important;}#pm-glass-modal .pm-loader-sub{font-size:11px!important;color:#64748b!important;}#pm-glass-modal .pm-shimmer-bar{height:2px!important;border-radius:2px!important;background:linear-gradient(90deg,transparent,#3b82f6,#8b5cf6,transparent)!important;background-size:200% 100%!important;animation:pm-shimmer 1.5s linear infinite!important;margin-top:16px!important;}#pm-glass-modal .pm-error-wrap{display:flex!important;justify-content:center!important;width:100%!important;margin-bottom:14px!important;box-sizing:border-box!important;}#pm-glass-modal .pm-error-body{max-width:350px!important;width:100%!important;box-sizing:border-box!important;padding:14px 16px!important;margin:0 auto!important;background:#fef2f2!important;border:1px solid #fecaca!important;border-radius:14px!important;font-size:13px!important;line-height:1.65!important;color:#7f1d1d!important;word-wrap:break-word!important;overflow-wrap:break-word!important;word-break:break-word!important;white-space:pre-wrap!important;text-align:left!important;}#pm-glass-modal .pm-error-body.pm-error-centered{text-align:center!important;}#pm-glass-modal .pm-error-icwrap{width:34px!important;height:34px!important;margin:0 auto 8px!important;border-radius:50%!important;background:rgba(248,113,113,0.16)!important;display:flex!important;align-items:center!important;justify-content:center!important;}#pm-glass-modal .pm-error-icwrap svg{width:17px!important;height:17px!important;color:#f87171!important;animation:pm-err-spin 1.6s linear infinite!important;}@media (prefers-reduced-motion:reduce){#pm-glass-modal .pm-error-icwrap svg{animation:none!important;}}@keyframes pm-err-spin{to{transform:rotate(360deg);}}#pm-glass-modal .pm-error-msg{display:block!important;font-weight:700!important;color:#991b1b!important;font-size:13.5px!important;margin-bottom:3px!important;}';
  document.head.appendChild(s);
}
function _cMd(html){_rMd();_iSt();var w=document.createElement('div');w.id=_MID;w.innerHTML='<div class="pm-card"><div class="pm-inner">'+html+'</div></div>';document.body.appendChild(w);return w;}
function _shLd(){
  _hBtn();
  _cMd('<div class="pm-loader-wrap"><span class="pm-loader-icon"><svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z"/><path d="M19 15l.8 2.4L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.6z"/><path d="M5 15l.6 1.8L7.4 17l-1.8.6L5 19.4l-.6-1.8L2.6 17l1.8-.6z"/></svg></span><div class="pm-loader-text">Analyzing Image...</div><div class="pm-loader-sub">Generating detailed prompt</div><div class="pm-shimmer-bar"></div></div>');
}
async function _shRs(rawP,dSt,elapsed){
  var pt=(typeof rawP==='object'&&rawP!==null)?(rawP.prompt||JSON.stringify(rawP)):String(rawP||'');
  var p=pt.replace(/^\/imagine\s*/i,'').trim();
  var{prompt_style:style='universal'}=await chrome.storage.local.get(['prompt_style']);
  var SL_ICON={
    universal:'<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>',
    midjourney:'<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 1 0 0 20 3 3 0 0 0 3-3c0-1-1-1.5-1-2.5a2 2 0 0 1 2-2h1.5a3.5 3.5 0 0 0 3.5-3.5C21 6 17 2 12 2z"/></svg>',
    stablediff:'<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>',
    dalle:'<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/><path d="M12 11V7a2 2 0 0 1 2-2h1"/></svg>',
    flux:'<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M6 9V5M12 9V4M18 9V5"/></svg>',
    auto:'<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/></svg>'
  };
  var SL_TEXT={universal:'Universal',midjourney:'Midjourney',stablediff:'Stable Diff',dalle:'DALL\u00B7E 3',flux:'Flux',auto:'Auto'};
  
  // Auto-copy directly to clipboard
  try {
    await navigator.clipboard.writeText(p);
  } catch (_ce) {
    try {
      var ta = document.createElement("textarea");
      ta.value = p;
      ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch (_te) {}
  }

  var bIcon=SL_ICON[style]||SL_ICON.universal;
  var bText=SL_TEXT[style]||SL_TEXT.universal;
  var xL=(style==='auto'&&dSt)?' \u2192 '+dSt:'';

  // One-time Groq nudge if generation was slow (>4s means Gemini was used)
  var nudgeHtml='';
  if(elapsed&&elapsed>4000){
    var _nd=await chrome.storage.local.get('pm_groq_nudge_shown');
    if(!_nd.pm_groq_nudge_shown){
      var _sec=Math.round(elapsed/1000);
      nudgeHtml='<div id="pm-groq-nudge" style="margin-top:10px;padding:9px 12px;border-radius:10px;background:rgba(59,130,246,0.13);border:1px solid rgba(59,130,246,0.3);display:flex;align-items:center;gap:8px;cursor:pointer">'
        +'<span style="font-size:15px">\u26A1</span>'
        +'<div style="flex:1">'
          +'<div style="font-size:11.5px;font-weight:700;color:#60a5fa;margin-bottom:1px">Add a free Groq key for 5\u00D7 faster generation</div>'
          +'<div style="font-size:10.5px;color:rgba(255,255,255,0.5)">Took '+_sec+'s \u00B7 Groq averages 0.5\u20131.5s \u2014 click to open Settings</div>'
        +'</div>'
        +'<span style="font-size:10px;color:#60a5fa;font-weight:600;white-space:nowrap">Settings \u2192</span>'
      +'</div>';
      chrome.storage.local.set({pm_groq_nudge_shown:true});
    }
  }

  var CLIP_ICON='<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/></svg>';
  var el=_cMd('<div class="pm-header"><div class="pm-title"><div class="pm-dot"></div> AI Prompt</div><button class="pm-close" id="pm-close">\u00D7</button></div><div style="margin-bottom:10px;display:flex;align-items:center;gap:6px"><span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(59,130,246,0.18);color:#60a5fa;letter-spacing:.5px">'+bIcon+' '+_esc(bText)+'</span><span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;letter-spacing:.3px">✓ Auto-Copied</span>'+(xL?'<span style="font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;background:rgba(139,92,246,0.18);color:#a78bfa;letter-spacing:.5px">'+_esc(xL)+'</span>':'')+'</div><div class="pm-prompt-box" id="pm-text">'+_esc(p)+'</div>'+nudgeHtml+'<div style="margin-top:10px;margin-bottom:10px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;"><button type="button" class="pm-launch-btn" data-url="https://www.midjourney.com/imagine" style="padding:6px 2px;font-size:10px;font-weight:600;border-radius:6px;background:#f8fafc;color:#1e293b;border:1px solid #cbd5e1;cursor:pointer;text-align:center">Midjourney</button><button type="button" class="pm-launch-btn" data-url="https://app.leonardo.ai/ai-generations" style="padding:6px 2px;font-size:10px;font-weight:600;border-radius:6px;background:#f8fafc;color:#1e293b;border:1px solid #cbd5e1;cursor:pointer;text-align:center">Leonardo</button><button type="button" class="pm-launch-btn" data-url="https://chatgpt.com/" style="padding:6px 2px;font-size:10px;font-weight:600;border-radius:6px;background:#f8fafc;color:#1e293b;border:1px solid #cbd5e1;cursor:pointer;text-align:center">ChatGPT</button><button type="button" class="pm-launch-btn" data-url="https://fal.ai/models/fal-ai/flux/schnell" style="padding:6px 2px;font-size:10px;font-weight:600;border-radius:6px;background:#f8fafc;color:#1e293b;border:1px solid #cbd5e1;cursor:pointer;text-align:center">Flux</button></div><button class="pm-btn pm-btn-primary" id="pm-copy">'+CLIP_ICON+' Copy &amp; Close</button>');
  if(nudgeHtml){
    var _nudgeEl=el.querySelector('#pm-groq-nudge');
    if(_nudgeEl)_nudgeEl.onclick=function(){try{chrome.runtime.sendMessage({type:'OPEN_SETTINGS_TAB'});}catch(e){}; _rMd();};
  }
  el.querySelector('#pm-copy').onclick=async function(){
    try{await navigator.clipboard.writeText(p);}
    catch(e){var ta=document.createElement('textarea');ta.value=p;ta.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}
    try{await chrome.runtime.sendMessage({ type: 'SYNC_SERVER_QUOTA' });}catch(eSync){}
    this.className='pm-btn pm-btn-success';this.innerHTML='<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg> Copied!';
    _cpTmr=setTimeout(function(){_rMd();},900);
  };
  el.querySelector('#pm-close').onclick=_rMd;
  el.querySelectorAll('.pm-launch-btn').forEach(function(b){
    b.onclick=async function(){
      try{await navigator.clipboard.writeText(p);}catch(_){}
      window.open(this.dataset.url,'_blank');
    };
  });
}
function _stripHtmlLoose(s){
  return String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
function _humanizeError(msg){
  var raw=_stripHtmlLoose(msg);
  var t=raw.toLowerCase();
  if(!raw)return'Something went wrong. Please try again.';
  if(t.indexOf('limit_reached')>=0||t.indexOf('daily limit')>=0||t.indexOf('limit reached')>=0){
    return'Daily prompt limit reached. It resets at midnight (your device time).\n\u0986\u09aa\u09a8\u09be\u09b0 \u09a6\u09c8\u09a8\u09bf\u0995 \u09b2\u09bf\u09ae\u09bf\u099f \u09b6\u09c7\u09b7\u0964 \u09ae\u09a7\u09cd\u09af\u09b0\u09be\u09a4\u09c7 \u09b0\u09bf\u09b8\u09c7\u099f \u09b9\u09ac\u09c7\u0964';
  }
  if(t.indexOf('429')>=0||t.indexOf('rate limit')>=0)return'Too many requests. Please wait a moment and try again.\n\u0985\u09a8\u09c1\u09b0\u09cb\u09a6 \u09ac\u09c7\u09b6\u09bf \u0995\u09bf\u099b\u09c1\u0995\u09cd\u09b7\u09a3 \u0985\u09aa\u09c7\u0995\u09cd\u09b7\u09be \u0995\u09b0\u09c1\u09a8\u0964';
  if(t.indexOf('401')>=0&&(t.indexOf('mailchannels')>=0||t.indexOf('authorization required')>=0))return'Email / API authorization failed on the server. If you are the site owner, check MailChannels and domain settings.';
  if(t.indexOf('401')>=0||(t.indexOf('invalid')>=0&&(t.indexOf('key')>=0||t.indexOf('api')>=0)))return'Authorization failed. Open extension Settings and verify your API key.\n\u0985\u09a8\u09c1\u09ae\u09a4\u09bf \u0995\u09b0\u09c7 \u098f\u09aa\u09bf\u0986\u0987 \u0995\u09bf \u09ae\u09bf\u09b2\u09bf\u09af\u09bc\u09c7 \u0995\u09bf\u09a8\u09c1\u09a8\u0964';
  if(t.indexOf('403')>=0)return'Access was denied. Check your account or permissions.';
  if(t.indexOf('404')>=0)return'The requested item was not found. Try again later.';
  if(t.indexOf('cannot reach')>=0||t.indexOf('connection')>=0||t.indexOf('network')>=0||t.indexOf('failed to fetch')>=0||t.indexOf('internet')>=0)return'Cannot reach the server. Check your internet connection.\n\u0987\u09a8\u09cd\u099f\u09be\u09b0\u09a8\u09c7\u099f \u0995\u09a8\u09c7\u0995\u09b6\u09a8 \u099a\u09c7\u0995 \u0995\u09b0\u09c1\u09a8\u0964';
  if(t.indexOf('500')>=0||t.indexOf('502')>=0||t.indexOf('503')>=0||t.indexOf('server error')>=0||t.indexOf('bad gateway')>=0)return'The service is busy or unavailable. Please try again in a few minutes.';
  if(t.indexOf('empty response')>=0)return'No usable reply from the AI. Try another image or try again.';
  if(t.indexOf('could not fetch image')>=0||t.indexOf('hotlink')>=0||t.indexOf('cdn protection')>=0||(t.indexOf('blocked')>=0&&t.indexOf('download')>=0)||t.indexOf('image host blocked')>=0){
    return'This image host blocked remote downloads (anti-hotlink / CDN protection). Use the steps below on this page.';
  }
  if(t.indexOf('server could not read this image')>=0||t.indexOf('invalid image data')>=0||t.indexOf('invalid image')>=0||t.indexOf('imageurl or imagebase64')>=0)return raw;
  if(t.indexOf('ultimate nexus')>=0&&t.indexOf('bulk generate')>=0)return raw;
  if(t.indexOf('ultimate nexus')>=0&&t.indexOf('pricing')>=0)return raw;
  if(raw.length>300)return raw.slice(0,297)+'\u2026';
  return raw;
}
function _parsePmErr(msg){
  var s=String(msg||'');
  if(s.indexOf('PM_ERR:')!==0)return null;
  var rest=s.slice(7);
  var nl=rest.indexOf('\n');
  var code=(nl>=0?rest.slice(0,nl):rest).trim();
  var body=(nl>=0?rest.slice(nl+1):'').trim();
  return{code:code,message:body};
}
function _shMissingApiKey(){
  var html=
    '<div class="pm-header"><div class="pm-title"><div class="pm-dot" style="background:linear-gradient(135deg,#3b82f6,#8b5cf6)!important"></div> API KEY REQUIRED</div><button class="pm-close" id="pm-close">×</button></div>'+
    '<div style="font-size:13.5px;font-weight:400;color:rgba(255,255,255,0.65);margin-bottom:16px;line-height:1.65">Your <span style="background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700">Silver plan</span> needs your own Groq or Gemini API key to generate prompts.</div>'+
    '<div style="background:rgba(59,130,246,0.13);border:1px solid rgba(59,130,246,0.38);border-radius:12px;padding:13px 14px;margin-bottom:8px">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+
        '<div style="min-width:24px;height:24px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0">1</div>'+
        '<div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.92);letter-spacing:0.1px">Get a free API key — choose one:</div>'+
      '</div>'+
      '<div style="display:flex;gap:8px">'+
        '<button id="pm-groq-link" type="button" style="width:50%;box-sizing:border-box;background:linear-gradient(135deg,rgba(59,130,246,0.28),rgba(99,102,241,0.22));border:1.5px solid rgba(96,165,250,0.65);border-radius:10px;padding:14px 8px;cursor:pointer;text-align:center;font-family:inherit;outline:none;-webkit-appearance:none;transition:transform 0.18s,background 0.18s,border-color 0.18s;position:relative;overflow:hidden">'+
          '<div style="font-size:13px;font-weight:700;color:#60a5fa;margin-bottom:6px">Groq</div>'+
          '<div style="font-size:9.5px;color:#34d399;font-weight:700;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);border-radius:5px;padding:2px 6px;display:inline-block">Recommended</div>'+
          '<span class="pm-sweep-g" style="position:absolute;top:0;left:-100%;width:55%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent);pointer-events:none"></span>'+
        '</button>'+
        '<button id="pm-gem-link" type="button" style="width:50%;box-sizing:border-box;background:linear-gradient(135deg,rgba(139,92,246,0.26),rgba(167,139,250,0.18));border:1.5px solid rgba(167,139,250,0.55);border-radius:10px;padding:14px 8px;cursor:pointer;text-align:center;font-family:inherit;outline:none;-webkit-appearance:none;transition:transform 0.18s,background 0.18s,border-color 0.18s;position:relative;overflow:hidden">'+
          '<div style="font-size:13px;font-weight:700;color:#a78bfa;margin-bottom:6px">Gemini</div>'+
          '<div style="font-size:9.5px;color:rgba(255,255,255,0.35);font-weight:600;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:5px;padding:2px 6px;display:inline-block">Alternative</div>'+
          '<span class="pm-sweep-m" style="position:absolute;top:0;left:-100%;width:55%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent);pointer-events:none"></span>'+
        '</button>'+
      '</div>'+
    '</div>'+
    '<div style="background:rgba(59,130,246,0.13);border:1px solid rgba(59,130,246,0.38);border-radius:12px;padding:13px 14px;margin-bottom:18px">'+
      '<div style="display:flex;align-items:flex-start;gap:10px">'+
        '<div style="min-width:24px;height:24px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0;margin-top:1px">2</div>'+
        '<div>'+
          '<div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.92);margin-bottom:4px;letter-spacing:0.1px">Add key in extension Settings</div>'+
          '<div style="font-size:11px;color:rgba(255,255,255,0.42);line-height:1.55;letter-spacing:0.1px">Click extension icon → Settings tab → API Keys</div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<button class="pm-btn" id="pm-dismiss" type="button" style="background:rgba(255,255,255,0.06)!important;border:1px solid rgba(255,255,255,0.1)!important;color:rgba(255,255,255,0.42)!important;font-size:12px!important;letter-spacing:0.3px!important">Dismiss</button>';
  var el=_cMd(html);
  // Sweep animation style — একবার মাত্র চলবে
  var swSt=document.createElement('style');
  swSt.textContent='@keyframes pm-key-sw{0%{left:-100%}100%{left:120%}}';
  el.appendChild(swSt);
  var gSw=el.querySelector('.pm-sweep-g');
  var mSw=el.querySelector('.pm-sweep-m');
  setTimeout(function(){if(gSw)gSw.style.animation='pm-key-sw 0.7s ease-in-out forwards';},350);
  setTimeout(function(){if(mSw)mSw.style.animation='pm-key-sw 0.7s ease-in-out forwards';},750);
  var gBtn=el.querySelector('#pm-groq-link');
  var mBtn=el.querySelector('#pm-gem-link');
  gBtn.onclick=function(){window.open('https://console.groq.com/keys','_blank');};
  gBtn.onmouseenter=function(){this.style.transform='translateY(-2px)';this.style.background='linear-gradient(135deg,rgba(59,130,246,0.45),rgba(99,102,241,0.38))';this.style.borderColor='rgba(96,165,250,0.9)';this.style.backdropFilter='blur(8px)';};
  gBtn.onmouseleave=function(){this.style.transform='translateY(0)';this.style.background='linear-gradient(135deg,rgba(59,130,246,0.28),rgba(99,102,241,0.22))';this.style.borderColor='rgba(96,165,250,0.65)';this.style.backdropFilter='none';};
  mBtn.onclick=function(){window.open('https://aistudio.google.com/apikey','_blank');};
  mBtn.onmouseenter=function(){this.style.transform='translateY(-2px)';this.style.background='linear-gradient(135deg,rgba(139,92,246,0.42),rgba(167,139,250,0.32))';this.style.borderColor='rgba(167,139,250,0.85)';this.style.backdropFilter='blur(8px)';};
  mBtn.onmouseleave=function(){this.style.transform='translateY(0)';this.style.background='linear-gradient(135deg,rgba(139,92,246,0.26),rgba(167,139,250,0.18))';this.style.borderColor='rgba(167,139,250,0.55)';this.style.backdropFilter='none';};
  el.querySelector('#pm-dismiss').onclick=_rMd;
  el.querySelector('#pm-close').onclick=_rMd;
  el.querySelectorAll('.pm-launch-btn').forEach(function(b){
    b.onclick=async function(){
      try{await navigator.clipboard.writeText(p);}catch(_){}
      window.open(this.dataset.url,'_blank');
    };
  });
}
function _shAccessBlocked(parsed){
  var code=parsed.code||'';
  // DAILY_LIMIT_REACHED → paid user: simple limit modal; free user: upsell
  if(code==='DAILY_LIMIT_REACHED'){
    _rMd();
    chrome.storage.local.get(['pm_is_pro','pm_plan','pm_plan_display','pm_daily_limit','pm_remaining']).then(function(st){
      if(st.pm_is_pro){_shDailyLimitPaid(st);}else{_shUpsell();}
    }).catch(function(){_shUpsell();});
    return;
  }
  // FREE_LIFETIME_LIMIT_REACHED → free user has used all 50 lifetime prompts (no daily reset — permanent)
  if(code==='FREE_LIFETIME_LIMIT_REACHED'){
    _shUpsell({
      title:'Free Limit Reached',
      icon:'🎉',
      lead:'You’ve used all 50 free prompts',
      sub:'That’s your lifetime free limit — upgrade for unlimited access'
    });
    return;
  }
  // STALE_KV_RETRY → server KV was stale. Show in-page retry message.
  if(code==='STALE_KV_RETRY'){
    _rMd();_iSt();
    var _stEl=_cMd('<div class="pm-header"><div class="pm-title"><div class="pm-dot" style="background:#f59e0b;box-shadow:0 0 8px rgba(245,158,11,0.6)"></div> Please Try Again</div><button class="pm-close" id="pm-close">×</button></div><div style="text-align:center;padding:8px 0 12px"><div style="font-size:28px;margin-bottom:10px">⏳</div><div style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.9);margin-bottom:6px">Server is syncing</div><div style="font-size:12.5px;color:rgba(255,255,255,0.5)">Please try again in a moment.</div></div><button class="pm-btn pm-btn-primary" id="pm-dismiss" type="button">Try Again</button>');
    _stEl.querySelector('#pm-close').onclick=_rMd;
    _stEl.querySelector('#pm-dismiss').onclick=_rMd;
    return;
  }
  // MISSING_USER_API_KEY → step-by-step guide দেখাও
  if(code==='MISSING_USER_API_KEY'){_shMissingApiKey();return;}
  // SUBSCRIPTION_INACTIVE → always show friendly pause modal (same as ADMIN_DEACTIVATED)
  if(code==='SUBSCRIPTION_INACTIVE'){
    _shMissingApiKey();
    return;
  }
  // ADMIN_DEACTIVATED → friendly purple modal
  if(code==='ADMIN_DEACTIVATED'){
    _shMissingApiKey();
    return;
  }
  if(false){
    var adminHtml='<div class="pm-header"><div class="pm-title"><div class="pm-dot" style="background:linear-gradient(135deg,#7c3aed,#a78bfa);box-shadow:0 0 10px rgba(124,58,237,0.5)"></div> ⏸️ Subscription Paused</div><button class="pm-close" id="pm-close">×</button></div>'+
      '<div style="text-align:center;padding:10px 4px 6px">'+
      '<div style="font-size:32px;margin-bottom:10px"><svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/></svg></div>'+
      '<div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.92);margin-bottom:8px">Your subscription is inactive</div>'+
      '<div style="font-size:12.5px;line-height:1.65;color:rgba(255,255,255,0.55);margin-bottom:12px">Renew your plan or contact support to continue.</div>'+
      '<div style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#a78bfa;margin-bottom:4px"><svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg> support@aivision.local</div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">'+
      '<button class="pm-btn pm-btn-primary" id="pm-renew" type="button" style="background:linear-gradient(135deg,#7c3aed,#a78bfa)!important">Renew My Plan</button>'+
      '<button class="pm-btn" id="pm-support" type="button" style="background:transparent!important;border:1px solid rgba(124,58,237,0.4)!important;color:rgba(255,255,255,0.7)!important">Contact Support</button>'+
      '</div>';
    var adminEl=_cMd(adminHtml);
    adminEl.querySelector('#pm-renew').onclick=function(){window.open('#','_blank');_rMd();};
    adminEl.querySelector('#pm-support').onclick=function(){window.open('mailto:support@aivision.local','_blank');_rMd();};
    adminEl.querySelector('#pm-close').onclick=_rMd;
    return;
  }
  var title='Access denied';
  if(code==='SUBSCRIPTION_INACTIVE')title='Subscription inactive';
  else if(code==='DEVICE_LIMIT_EXCEEDED')title='Device limit exceeded';
  else if(code==='UNREGISTERED_DEVICE')title='Unrecognized device';
  var accent='linear-gradient(135deg,#ef4444,#f97316)';
  var isServerError=code==='SERVER_ERROR';
  var errorBodyHtml;
  if(isServerError){
    errorBodyHtml='<div class="pm-error-icwrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M2.5 12a9.5 9.5 0 0 1 16.2-6.7L21.5 8"/><path d="M2.5 22v-6h6"/><path d="M21.5 12a9.5 9.5 0 0 1-16.2 6.7L2.5 16"/></svg></div>'+
      '<span class="pm-error-msg">Couldn\u2019t confirm usage</span>Your plan isn\u2019t affected \u2014 please try again in a few seconds.';
  } else {
    var msg=_esc(parsed.message||'Access denied.');
    var extra='';
    if(code==='DEVICE_LIMIT_EXCEEDED')extra='<div style="margin-top:10px;font-size:12px;line-height:1.5;opacity:0.92">This plan allows a limited number of devices. Sign out from another browser or upgrade for more devices.</div>';
    errorBodyHtml=msg+extra;
  }
  var html='<div class="pm-header"><div class="pm-title"><div class="pm-dot" style="background:'+accent+';box-shadow:0 0 10px rgba(239,68,68,0.55)"></div> '+_esc(title)+'</div><button class="pm-close" id="pm-close">\u00D7</button></div>'+
    '<div class="pm-error-wrap"><div class="pm-error-body'+(isServerError?' pm-error-centered':'')+'" style="border-color:rgba(249,115,22,0.45)!important;background:rgba(239,68,68,0.12)!important;color:rgba(255,248,240,0.95)!important">'+errorBodyHtml+'</div></div>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">'+
    '<button class="pm-btn pm-btn-primary" id="pm-pricing" type="button">'+(isServerError?'Try Again':'View Pricing')+'</button>'+
    '<button class="pm-btn pm-btn-danger" id="pm-dismiss" type="button">Dismiss</button></div>'+
    (isServerError?'<button class="pm-btn pm-btn-ghost" id="pm-contact" type="button" style="width:100%!important;margin-top:10px!important;background:rgba(255,255,255,0.06)!important;color:rgba(255,255,255,0.75)!important;border:1px solid rgba(255,255,255,0.12)!important">Contact Support</button>':'');
  var el=_cMd(html);
  el.querySelector('#pm-pricing').onclick=isServerError?_rMd:function(){window.open('#','_blank');_rMd();};
  el.querySelector('#pm-dismiss').onclick=_rMd;
  el.querySelector('#pm-close').onclick=_rMd;
  el.querySelectorAll('.pm-launch-btn').forEach(function(b){
    b.onclick=async function(){
      try{await navigator.clipboard.writeText(p);}catch(_){}
      window.open(this.dataset.url,'_blank');
    };
  });
  var contactBtn=el.querySelector('#pm-contact');
  if(contactBtn)contactBtn.onclick=function(){window.open('#','_blank');_rMd();};
}
function _pmBeep(){
  try{
    var C=window.AudioContext||window.webkitAudioContext;
    if(!C)return;
    var ctx=new C();
    var o=ctx.createOscillator();
    var g=ctx.createGain();
    o.connect(g);g.connect(ctx.destination);
    o.type='sine';o.frequency.value=880;
    g.gain.setValueAtTime(0.0001,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.055,ctx.currentTime+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.1);
    o.start(ctx.currentTime);o.stop(ctx.currentTime+0.11);
  }catch(e){}
}
function _pmNotify(title,body){
  try{
    if(typeof Notification==='undefined')return;
    var iconUrl='';
    try{if(typeof chrome!=='undefined'&&chrome.runtime&&chrome.runtime.getURL)iconUrl=chrome.runtime.getURL('Icon/icon48.png');}catch(e2){}
    var opts={body:String(body||'').replace(/\n+/g,' ').trim().slice(0,220),silent:false};
    if(iconUrl)opts.icon=iconUrl;
    if(Notification.permission==='granted')new Notification(String(title||'AI Vision Prompt'),opts);
    else if(Notification.permission==='default')Notification.requestPermission().then(function(p){if(p==='granted')new Notification(String(title||'AI Vision Prompt'),opts);});
  }catch(e){}
}
function _pmErrorAlert(title,body){
  _pmBeep();
  _pmNotify(title||'AI Vision Prompt',body||'');
}
function _shApiKeyExhausted(provider){
  _rMd();
  chrome.storage.local.get(['pm_plan','pm_plan_display']).then(function(st){
    var isGolden=String(st.pm_plan||'').toLowerCase()==='power'||String(st.pm_plan_display||'').toLowerCase()==='golden';
    if(isGolden){_shServerBusy();return;}
    _shApiKeyExhaustedOwnKey(provider);
  }).catch(function(){_shApiKeyExhaustedOwnKey(provider);});
}
// Golden (System B) users don't manage their own key — "add your own key" guidance doesn't
// apply to them, so a rate-limit hit on the shared admin key pool gets this simpler message.
function _shServerBusy(){
  _iSt();
  var el=_cMd(
    '<div class="pm-header">'+
      '<div class="pm-title">'+
        '<div class="pm-dot" style="background:linear-gradient(135deg,#f59e0b,#ef4444);box-shadow:0 0 10px rgba(245,158,11,0.6)"></div>'+
        ' <svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/></svg> High Demand Right Now'+
      '</div>'+
      '<button class="pm-close" id="pm-close">×</button>'+
    '</div>'+
    '<div style="text-align:center;padding:16px 0 8px">'+
      '<div style="font-size:40px;margin-bottom:12px">⏳</div>'+
      '<div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.92);margin-bottom:8px">Our servers are busy right now.</div>'+
      '<div style="font-size:12px;color:rgba(255,255,255,0.45);line-height:1.6;margin-bottom:20px">Please wait a minute and try again — not a plan limit.</div>'+
    '</div>'+
    '<button class="pm-btn pm-btn-primary" id="pm-dismiss" type="button" style="width:100%">Got it</button>'
  );
  el.querySelector('#pm-close').onclick=_rMd;
  el.querySelectorAll('.pm-launch-btn').forEach(function(b){
    b.onclick=async function(){
      try{await navigator.clipboard.writeText(p);}catch(_){}
      window.open(this.dataset.url,'_blank');
    };
  });
  el.querySelector('#pm-dismiss').onclick=_rMd;
}
function _shApiKeyExhaustedOwnKey(provider){
  var isGroq=String(provider||'').toLowerCase().indexOf('gemini')<0;
  var provName=isGroq?'Groq':'Gemini';
  var otherName=isGroq?'Gemini':'Groq';
  var provLimit=isGroq?'1,000/day':'500/day';
  var provColor=isGroq?'#60a5fa':'#a78bfa';
  var provEmoji=isGroq?'<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>':'<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z"/></svg>';
  // Groq→Gemini auto-fallback (worker.js) already tried the other provider before this ever
  // fired — so if the user has BOTH keys configured, this only shows once both are exhausted,
  // and "Switch to X" would be wrong advice here. Check what's actually configured first.
  chrome.storage.local.get(['groq_api_key','gemini_api_key']).then(function(st){
    var both=!!String(st.groq_api_key||'').trim()&&!!String(st.gemini_api_key||'').trim();
    _renderApiKeyExhausted(provName,otherName,provLimit,provColor,provEmoji,both);
  }).catch(function(){_renderApiKeyExhausted(provName,otherName,provLimit,provColor,provEmoji,false);});
}
function _renderApiKeyExhausted(provName,otherName,provLimit,provColor,provEmoji,both){
  var SWITCH_ICON='<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg>';
  var PLUS_ICON='<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
  var msgLine=both
    ?'<span style="color:#60a5fa">Groq</span> &amp; <span style="color:#a78bfa">Gemini</span>: both limits used. Resets at midnight.'
    :'<span style="color:'+provColor+'">'+provName+'</span>: '+provLimit+' used. Resets at midnight.';
  var row=function(icon,label){return '<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:9px 12px"><div style="font-size:16px;flex-shrink:0">'+icon+'</div><div style="font-size:12.5px;font-weight:700;color:rgba(255,255,255,0.88)">'+label+'</div></div>';};
  var items=both
    ?row(PLUS_ICON,'Add another key')+row('⏰','Wait for reset')
    :row(SWITCH_ICON,'Switch to '+otherName)+row(PLUS_ICON,'Add another '+provName+' key')+row('⏰','Wait for reset');
  var btnLabel=both?'Open Settings':'Add '+otherName+' Key';
  var el=_cMd(
    '<div class="pm-header">'+
      '<div class="pm-title">'+
        '<div class="pm-dot" style="background:linear-gradient(135deg,#f59e0b,#ef4444)!important;box-shadow:0 0 10px rgba(245,158,11,0.6)!important"></div>'+
        ' '+provEmoji+' API Key Limit Reached'+
      '</div>'+
      '<button class="pm-close" id="pm-close">×</button>'+
    '</div>'+
    '<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:10px 14px;margin-bottom:12px">'+
      '<div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.9)">'+msgLine+'</div>'+
    '</div>'+
    '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px">Options</div>'+
    '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">'+items+'</div>'+
    '<button class="pm-btn pm-btn-primary" id="pm-open-settings" type="button" style="margin-bottom:8px">'+btnLabel+'</button>'+
    '<button class="pm-btn" id="pm-dismiss" type="button" style="background:rgba(255,255,255,0.05)!important;border:1px solid rgba(255,255,255,0.08)!important;color:rgba(255,255,255,0.4)!important;font-size:12px!important">Dismiss</button>'
  );
  el.querySelector('#pm-close').onclick=_rMd;
  el.querySelectorAll('.pm-launch-btn').forEach(function(b){
    b.onclick=async function(){
      try{await navigator.clipboard.writeText(p);}catch(_){}
      window.open(this.dataset.url,'_blank');
    };
  });
  el.querySelector('#pm-dismiss').onclick=_rMd;
  el.querySelector('#pm-open-settings').onclick=function(){
    chrome.runtime.sendMessage({type:'OPEN_SETTINGS_TAB'}).catch(function(){});
    _rMd();
  };
}
function _shEr(msg){
  var parsed=_parsePmErr(msg);
  if(parsed){_shAccessBlocked(parsed);return;}
  var mStr=String(msg||'');
  var mLow=mStr.toLowerCase();
  // Groq/Gemini API key daily limit exhausted — dedicated modal
  var isGroqExhausted=mLow.indexOf('groq keys exhausted')>=0||mLow.indexOf('all groq')>=0;
  var isGeminiExhausted=mLow.indexOf('gemini keys exhausted')>=0||mLow.indexOf('all gemini')>=0;
  if(isGroqExhausted||isGeminiExhausted){
    _pmBeep();
    _shApiKeyExhausted(isGroqExhausted?'groq':'gemini');
    return;
  }
  // Groq's own infra is overloaded (affects all their customers, not this account/plan) — same friendly modal as a rate-limit hit.
  // Also catches Groq's own per-minute "Rate limit reached for model..." (TPM) message — this is
  // NOT the plan's daily cap, but its wording ("...limit reached...") would otherwise falsely match
  // the isLimit check below and show the wrong "Daily Limit Reached" modal.
  if(mLow.indexOf('over capacity')>=0||mLow.indexOf('groqstatus.com')>=0||mLow.indexOf('rate limit reached for model')>=0||mLow.indexOf('tokens per minute')>=0){
    _pmBeep();
    _shServerBusy();
    return;
  }
  var isLimit=mStr&&(mStr.includes('Daily limit')||mLow.includes('limit reached')||mStr.includes('LIMIT_REACHED'));
  var friendly=_humanizeError(msg);
  if(isLimit){
    _rMd();
    _pmErrorAlert('AI Vision Prompt',friendly);
    chrome.storage.local.get(['pm_is_pro','pm_plan','pm_daily_limit','pm_remaining']).then(function(st){
      if(st.pm_is_pro){_shDailyLimitPaid(st);}else{_shUpsell();}
    }).catch(function(){_shUpsell();});
    return;
  }
  _pmErrorAlert('AI Vision Prompt',friendly);
  var tImg=(function(){var x=mStr.toLowerCase();return x.indexOf('could not fetch image')>=0||x.indexOf('hotlink')>=0||x.indexOf('cdn protection')>=0||(x.indexOf('blocked')>=0&&x.indexOf('download')>=0)||x.indexOf('image host blocked')>=0;}());
  var tBadImg=(function(){var x=mStr.toLowerCase();return x.indexOf('invalid image')>=0||x.indexOf('server could not read this image')>=0||x.indexOf('imageurl or imagebase64')>=0;}());
  var steps=tImg?'<div style="margin-top:12px;padding:12px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;text-align:left"><div style="font-size:11px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">What you can do</div><ol style="margin:0 0 0 18px;padding:0;font-size:12.5px;line-height:1.58;color:rgba(255,255,255,0.9)"><li><strong>Right-click</strong> the image \u2192 <strong>Save image as\u2026</strong> \u2192 open that file in a new tab, then run VisionPrompt on it.</li><li>Use the <strong>hover \u2728 Generate</strong> button on the <strong>thumbnail</strong> (the image you actually see), not a zoom overlay the site blocks.</li><li>Pick a <strong>preview / smaller</strong> version if the site offers one, or another page that allows embedding.</li></ol></div>':'';
  var stepsImg=tBadImg&&!tImg?'<div style="margin-top:12px;padding:12px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;text-align:left"><div style="font-size:11px;font-weight:700;color:#fca5a5;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Fix invalid image data</div><ol style="margin:0 0 0 18px;padding:0;font-size:12.5px;line-height:1.58;color:rgba(255,255,255,0.9)"><li><strong>Open image in new tab</strong> (right-click \u2192 Open image in new tab), then generate from that tab.</li><li>Use a <strong>larger preview</strong>, not a tiny search-grid icon (often empty / WebP tile).</li><li>Prefer <strong>JPEG or PNG</strong>; if the site only offers AVIF/WebP, open the image alone first.</li></ol></div>':'';
  steps=steps||stepsImg;
  var el=_cMd('<div class="pm-header"><div class="pm-title"><div class="pm-dot" style="background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,0.6)"></div> Error</div><button class="pm-close" id="pm-close">\u00D7</button></div><div class="pm-error-wrap"><div class="pm-error-body">'+_esc(friendly)+'</div></div>'+steps+'<button class="pm-btn pm-btn-danger" id="pm-dismiss">Dismiss</button>');
  el.querySelector('#pm-dismiss').onclick=_rMd;
  el.querySelector('#pm-close').onclick=_rMd;
  el.querySelectorAll('.pm-launch-btn').forEach(function(b){
    b.onclick=async function(){
      try{await navigator.clipboard.writeText(p);}catch(_){}
      window.open(this.dataset.url,'_blank');
    };
  });
}
function _renderDailyLimitModal(plan, dailyLimit){
  _rMd();_iSt();
  var planRaw=String(plan||'').trim().toLowerCase().replace(/_/g,'-');
  var planNames={'basic':'Starter Core','standard':'Creator Flow','pro-key':'Silver','prokey':'Silver','starter':'Instant Access','pro':'Pro Stream','power':'Golden','max':'Golden'};
  var planName=planNames[planRaw]||'Pro';
  var lim=typeof dailyLimit==='number'&&dailyLimit>0?dailyLimit:null;
  var limitLine=lim?'You’ve used all '+lim+' prompts for today.':'You’ve used all your prompts for today.';
  var el=_cMd(
    '<div class="pm-header">'+
      '<div class="pm-title">'+
        '<div class="pm-dot" style="background:linear-gradient(135deg,#f59e0b,#ef4444);box-shadow:0 0 10px rgba(245,158,11,0.6)"></div>'+
        ' <svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/></svg> Daily Limit Reached'+
      '</div>'+
      '<button class="pm-close" id="pm-close">×</button>'+
    '</div>'+
    '<div style="text-align:center;padding:16px 0 8px">'+
      '<div style="font-size:40px;margin-bottom:12px">⏰</div>'+
      '<div style="font-size:15px;font-weight:700;color:rgba(255,255,255,0.95);margin-bottom:8px;letter-spacing:-0.3px">'+
        limitLine+
      '</div>'+
      '<div style="font-size:12px;color:rgba(255,255,255,0.45);margin-bottom:20px;line-height:1.6">'+
        'Resets at midnight · '+planName+' Plan'+
      '</div>'+
    '</div>'+
    '<button class="pm-btn" id="pm-dismiss" style="width:100%;padding:13px;background:linear-gradient(135deg,rgba(59,130,246,0.18),rgba(139,92,246,0.18));border:1px solid rgba(139,92,246,0.35);border-radius:14px;color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),0 3px 0 #3d3572">'+
      'Got it · Come back tomorrow'+
    '</button>'
  );
  el.querySelector('#pm-close').onclick=_rMd;
  el.querySelectorAll('.pm-launch-btn').forEach(function(b){
    b.onclick=async function(){
      try{await navigator.clipboard.writeText(p);}catch(_){}
      window.open(this.dataset.url,'_blank');
    };
  });
  el.querySelector('#pm-dismiss').onclick=_rMd;
}
function _shDailyLimitPaid(st){
  chrome.storage.local.get(['pm_plan','pm_daily_limit']).then(function(fresh){
    _renderDailyLimitModal(fresh.pm_plan||st.pm_plan, fresh.pm_daily_limit||st.pm_daily_limit);
  }).catch(function(){
    _renderDailyLimitModal(st.pm_plan, st.pm_daily_limit);
  });
}
async function _shUpsell(opts){
  opts=opts||{};
  var headline=opts.title||'Daily Limit Reached';
  var emoji=opts.icon||'<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>';
  var lead=opts.lead||'You’ve used all prompts for today';
  var sub=opts.sub||'Resets at midnight in your timezone · Upgrade for more daily prompts';
  _rMd();_iSt();
  var isBD=Intl.DateTimeFormat().resolvedOptions().timeZone==='Asia/Dhaka';
  var pr={silverBdt:99,goldenBdt:499,silverUsd:2,goldenUsd:5,goldenLimit:300};
  try{
    var wr=await Promise.race([
      fetch('http://127.0.0.1/content?key=pricing'),
      new Promise(function(_r,rj){setTimeout(function(){rj(new Error('timeout'));},3000);})
    ]);
    if(wr&&wr.ok){
      var fd=await wr.json();
      var fsA=fd&&fd.systemA&&fd.systemA['pro-key'];
      var fsB=fd&&fd.systemB&&fd.systemB.power;
      if(fsA&&fsA.monthly)pr.silverBdt=fsA.monthly;
      if(fsB&&fsB.monthly)pr.goldenBdt=fsB.monthly;
      if(fsA&&fsA.monthlyUsd)pr.silverUsd=fsA.monthlyUsd;
      if(fsB&&fsB.monthlyUsd)pr.goldenUsd=fsB.monthlyUsd;
      var fpl=fd&&fd.planLimits&&fd.planLimits.systemB;
      if(fpl&&fpl.power)pr.goldenLimit=fpl.power;
      try{await chrome.storage.local.set({pm_upsell_pricing:{silverBdt:pr.silverBdt,goldenBdt:pr.goldenBdt,silverUsd:pr.silverUsd,goldenUsd:pr.goldenUsd,goldenLimit:pr.goldenLimit}});}catch(_se){}
    }
  }catch(_fe){
    try{
      var pd=await chrome.storage.local.get('pm_upsell_pricing');
      if(pd&&pd.pm_upsell_pricing){
        if(pd.pm_upsell_pricing.silverBdt)pr.silverBdt=pd.pm_upsell_pricing.silverBdt;
        if(pd.pm_upsell_pricing.goldenBdt)pr.goldenBdt=pd.pm_upsell_pricing.goldenBdt;
        if(pd.pm_upsell_pricing.silverUsd)pr.silverUsd=pd.pm_upsell_pricing.silverUsd;
        if(pd.pm_upsell_pricing.goldenUsd)pr.goldenUsd=pd.pm_upsell_pricing.goldenUsd;
        if(pd.pm_upsell_pricing.goldenLimit)pr.goldenLimit=pd.pm_upsell_pricing.goldenLimit;
      }
    }catch(_ce){}
  }
  var sPrice=isBD?'\u09f3'+pr.silverBdt+'/mo':'$'+pr.silverUsd+'/mo';
  var gPrice=isBD?'\u09f3'+pr.goldenBdt+'/mo':'$'+pr.goldenUsd+'/mo';
  var el=_cMd(
    '<div class="pm-header">'+
      '<div class="pm-title">'+
        '<div class="pm-dot" style="background:linear-gradient(135deg,#f59e0b,#ef4444);box-shadow:0 0 10px rgba(245,158,11,0.6)"></div>'+
        ' \u26a1 '+headline+
      '</div>'+
      '<button class="pm-close" id="pm-close">\u00D7</button>'+
    '</div>'+
    '<div style="text-align:center;padding:8px 0 4px">'+
      '<div style="font-size:36px;margin-bottom:10px">'+emoji+'</div>'+
      '<div style="font-size:15px;font-weight:700;color:rgba(255,255,255,0.95);margin-bottom:8px;letter-spacing:-0.3px">'+
        lead+
      '</div>'+
      '<div style="font-size:12px;color:rgba(255,255,255,0.45);margin-bottom:18px;line-height:1.6">'+
        sub+
      '</div>'+
    '</div>'+
    '<div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:14px 16px;margin-bottom:16px">'+
      '<div style="font-size:11px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">'+
        '\uD83C\uDFAF Upgrade & Get More'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
        '<div style="background:rgba(52,211,153,0.06);border-radius:8px;padding:8px 10px;border:1px solid rgba(52,211,153,0.18)">'+
          '<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:1px">Silver Plan</div>'+
          '<div style="font-size:9px;color:rgba(52,211,153,0.7);margin-bottom:4px">Own API Key</div>'+
          '<div style="font-size:13px;font-weight:700;color:#34d399">Unlimited</div>'+
          '<div style="font-size:10px;color:rgba(255,255,255,0.4)">prompts/day*</div>'+
          '<div style="font-size:11px;font-weight:700;color:#fbbf24;margin-top:4px">from '+sPrice+'</div>'+
        '</div>'+
        '<div style="background:rgba(139,92,246,0.08);border-radius:8px;padding:8px 10px;border:1px solid rgba(139,92,246,0.2)">'+
          '<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:1px">Golden Plan</div>'+
          '<div style="font-size:9px;color:rgba(167,139,250,0.7);margin-bottom:4px">Our Server</div>'+
          '<div style="font-size:13px;font-weight:700;color:#a78bfa">'+pr.goldenLimit+'</div>'+
          '<div style="font-size:10px;color:rgba(255,255,255,0.4)">prompts/day</div>'+
          '<div style="font-size:11px;font-weight:700;color:#fbbf24;margin-top:4px">from '+gPrice+'</div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<a href="#" target="_blank" id="pm-upgrade-btn" rel="noopener noreferrer"'+
      ' style="display:block;width:100%;padding:13px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border:none;border-radius:14px;color:white;font-size:13px;font-weight:700;cursor:pointer;text-align:center;text-decoration:none;letter-spacing:0.2px;margin-bottom:8px;transition:all 0.3s;box-sizing:border-box;box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),0 3px 0 #3654c9">'+
      'View Pricing & Upgrade'+
    '</a>'+
    '<button class="pm-btn" id="pm-dismiss" style="width:100%;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:rgba(255,255,255,0.5);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">'+
      'Maybe Later'+
    '</button>'
  );
  el.querySelector('#pm-close').onclick=_rMd;
  el.querySelectorAll('.pm-launch-btn').forEach(function(b){
    b.onclick=async function(){
      try{await navigator.clipboard.writeText(p);}catch(_){}
      window.open(this.dataset.url,'_blank');
    };
  });
  el.querySelector('#pm-dismiss').onclick=_rMd;
  el.querySelector('#pm-upgrade-btn').onclick=function(){_rMd();};
}
function _rMd(){
  clearTimeout(_cpTmr);_cpTmr=null;
  var el=document.getElementById(_MID);
  if(!el)return;
  try{el.remove();}catch(e){}
  clearTimeout(_hTmr);
  _cImg=null;
}
function _bulkLimitReached(r){
  if(!r||!r.error)return false;
  var e=String(r.error);
  return e==='LIMIT_REACHED'||e.indexOf('LIMIT_REACHED')>=0||e.toLowerCase().indexOf('daily limit')>=0;
}
function _pmIsInfiniteScroll(){
  var host=(window.location.hostname||'').toLowerCase();
  var inf=['facebook.com','instagram.com','youtube.com','linkedin.com','twitter.com','x.com','pinterest.com','tiktok.com','reddit.com','magnific.com'];
  for(var i=0;i<inf.length;i++){if(host.indexOf(inf[i])>=0)return true;}
  return false;
}
function _pmAutoScroll(onProgress){
  return new Promise(function(resolve){
    var savedY=window.scrollY||window.pageYOffset||0;
    var isInf=_pmIsInfiniteScroll();
    var maxMs=isInf?3000:12000;
    var stepPx=window.innerHeight*0.9;
    var startT=Date.now();
    function atBottom(){return window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-80;}
    function step(){
      var elapsed=Date.now()-startT;
      if(elapsed>=maxMs||(!isInf&&atBottom())){
        window.scrollTo({top:savedY,behavior:'instant'});
        setTimeout(resolve,380);
        return;
      }
      if(typeof onProgress==='function')onProgress(elapsed,maxMs);
      window.scrollBy({top:stepPx,behavior:'instant'});
      setTimeout(step,220);
    }
    step();
  });
}
function _startBulkSelect(){
  var old=document.getElementById('pm-bulk-overlay');
  if(old)old.remove();

  (async function(){
    var gate;
    try{gate=await chrome.runtime.sendMessage({type:'CHECK_BULK_FEATURE'});}catch(_eg){gate={allowed:false};}
    if(!gate||!gate.allowed){
      _shEr('PM_ERR:BULK_PLAN_RESTRICTED\nUpgrade to Silver (own key) or Golden (our server) to use Bulk Generate.');
      return;
    }

    var scanOverlay=document.createElement('div');
    scanOverlay.id='pm-scan-overlay';
    scanOverlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Display\',sans-serif';
    scanOverlay.innerHTML='<div style="background:#0c0c18;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:24px 32px;text-align:center"><div style="font-size:26px;margin-bottom:10px"><svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div><div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:6px">Scanning page images…</div><div style="font-size:11px;color:rgba(255,255,255,0.45)" id="pm-scan-info">Loading all images on the page</div></div>';
    document.body.appendChild(scanOverlay);
    await _pmAutoScroll(function(elapsed,maxMs){
      var info=document.getElementById('pm-scan-info');
      if(!info)return;
      if(_pmIsInfiniteScroll()){info.textContent='Scanning… ('+Math.ceil((maxMs-elapsed)/1000)+'s remaining)';}
      else{info.textContent='Scrolling to load all images…';}
    });
    try{scanOverlay.remove();}catch(_se){}

    var BULK_LIMIT=100;
    var stPl=await chrome.storage.local.get(['pm_plan','prompt_style']);
    var plLow=String(stPl.pm_plan||'').trim().toLowerCase();
    var bulkMvUxUnlimitedDaily=(plLow==='pro-key'||plLow==='max');
    var currentStyle=String(stPl.prompt_style||'universal');

    var allImgs=Array.from(document.querySelectorAll('img')).filter(function(img){
      var s=_pmRealSrc(img);
      if(!s||s.startsWith('data:image/gif')||s.includes('1x1'))return false;
      var w=img.offsetWidth,h=img.offsetHeight;
      if(w<100||h<100)return false;
      if(!img.offsetParent&&window.getComputedStyle(img).position!=='fixed')return false;
      var cs=window.getComputedStyle(img);
      if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')return false;
      return true;
    }).sort(function(a,b){
      var ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
      var ay=Math.round((ra.top+window.scrollY)/8)*8;
      var by=Math.round((rb.top+window.scrollY)/8)*8;
      if(ay!==by)return ay-by;
      return (ra.left+window.scrollX)-(rb.left+window.scrollX);
    });

    if(!allImgs.length){
      _shEr('No suitable images found on this page.');
      return;
    }

    if(!document.getElementById('pm-bulk-styles')){
      var st=document.createElement('style');
      st.id='pm-bulk-styles';
      st.textContent='#pm-bulk-overlay{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.45);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Display\',\'Segoe UI\',sans-serif}#pm-bulk-panel{background:linear-gradient(160deg,rgba(22,22,45,0.80),rgba(12,12,28,0.86));backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);border:1px solid rgba(255,255,255,0.13);border-radius:22px;width:100%;max-width:560px;max-height:82vh;overflow:hidden;display:flex;flex-direction:column}#pm-bulk-header{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,rgba(59,130,246,0.08),rgba(139,92,246,0.08))}#pm-bulk-title{font-size:13px;font-weight:700;background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:0.01em}#pm-bulk-close{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:50%;width:28px;height:28px;color:rgba(255,255,255,0.6);cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:background 0.2s,color 0.2s}#pm-bulk-close:hover{background:rgba(255,255,255,0.13);color:#fff}#pm-bulk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:14px;overflow-y:auto;flex:1}.pm-bulk-item{position:relative!important;padding-top:100%!important;overflow:hidden!important;border-radius:10px;cursor:pointer;border:2px solid transparent;transition:border-color 0.18s,opacity 0.18s}.pm-bulk-item:hover{opacity:0.88}.pm-bulk-item img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}.pm-bulk-item.selected{border-color:#6366f1}.pm-bulk-check{position:absolute!important;top:5px!important;right:5px!important;z-index:1;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:none;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:700}.pm-bulk-item.selected .pm-bulk-check{display:flex}#pm-bulk-footer{padding:12px 16px;border-top:1px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;gap:9px;background:rgba(255,255,255,0.01)}#pm-bulk-info{font-size:11px;color:rgba(255,255,255,0.45);display:flex;align-items:center;justify-content:space-between;padding:7px 11px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);transition:background 0.3s,border-color 0.3s}#pm-bulk-info-text{transition:color 0.3s;font-weight:500}#pm-bulk-info.pm-info-warn{background:rgba(251,191,36,0.07);border-color:rgba(251,191,36,0.18)}#pm-bulk-info.pm-info-warn #pm-bulk-info-text{color:#fbbf24}#pm-bulk-info.pm-info-full{background:rgba(248,113,113,0.07);border-color:rgba(248,113,113,0.2)}#pm-bulk-info.pm-info-full #pm-bulk-info-text{color:#f87171;font-weight:600}#pm-bulk-counter{font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;border:1px solid transparent;transition:background 0.3s,color 0.3s,border-color 0.3s;display:none}#pm-bulk-counter.pm-cnt-normal{display:none}#pm-bulk-counter.pm-cnt-warn{display:inline-block;background:rgba(251,191,36,0.1);color:#fbbf24;border-color:rgba(251,191,36,0.25)}#pm-bulk-counter.pm-cnt-full{display:inline-block;background:rgba(248,113,113,0.1);color:#f87171;border-color:rgba(248,113,113,0.25)}@keyframes pm-pulse-cnt{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.65;transform:scale(0.95)}}.pm-cnt-full{animation:pm-pulse-cnt 1s ease-in-out infinite}@keyframes pm-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}.pm-shake{animation:pm-shake 0.4s ease!important}#pm-bulk-actions{display:flex;gap:8px;align-items:center}#pm-bulk-selall{flex:1;padding:8px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:9px;color:rgba(255,255,255,0.65);font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:background 0.2s,color 0.2s}#pm-bulk-selall:hover{background:rgba(255,255,255,0.09);color:#fff}#pm-bulk-gen{flex:2;padding:9px 10px;background:linear-gradient(135deg,#3b82f6,#7c3aed);border:none;border-radius:9px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity 0.2s,transform 0.15s}#pm-bulk-gen:hover:not(:disabled){opacity:0.9;transform:translateY(-1px)}#pm-bulk-gen:active:not(:disabled){transform:translateY(0)}#pm-bulk-gen:disabled{opacity:0.35;cursor:not-allowed}#pm-bulk-progress{display:none;text-align:center;padding:8px;font-size:12px;color:rgba(255,255,255,0.65);font-weight:600}.pm-bulk-progress-wrap{display:none;height:4px;background:rgba(255,255,255,0.07);border-radius:6px;overflow:hidden}.pm-bulk-progress-bar{height:100%;width:0;background:linear-gradient(90deg,#3b82f6,#8b5cf6);transition:width .25s ease}.pm-bulk-result-actions{display:none;gap:8px}.pm-bulk-copyall,.pm-bulk-csv,.pm-bulk-sheets{flex:1;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.8);cursor:pointer;font-size:11px;font-weight:600;transition:background 0.2s}.pm-bulk-copyall:hover,.pm-bulk-csv:hover,.pm-bulk-sheets:hover{background:rgba(255,255,255,0.1)}#pm-bulk-brand{display:flex;align-items:center;justify-content:center;gap:10px;padding:7px 0 1px;border-top:1px solid rgba(255,255,255,0.05);margin-top:1px}#pm-bulk-brand a{color:rgba(255,255,255,0.3);text-decoration:none;font-size:10px;font-weight:500;transition:color 0.2s}#pm-bulk-brand a:hover{color:rgba(255,255,255,0.6)}.pm-bulk-brand-sep{color:rgba(255,255,255,0.15);font-size:10px}';
      document.head.appendChild(st);
    }

    var overlay=document.createElement('div');
    overlay.id='pm-bulk-overlay';
    overlay.innerHTML='<div id="pm-bulk-panel"><div id="pm-bulk-header"><div id="pm-bulk-title">\u26A1 Bulk Generate \u2014 '+allImgs.length+' images found</div><button type="button" id="pm-bulk-close">\u00D7</button></div><div id="pm-bulk-grid"></div><div id="pm-bulk-footer"><div id="pm-bulk-info"><span id="pm-bulk-info-text">0 of '+allImgs.length+' selected (max '+BULK_LIMIT+')</span><span id="pm-bulk-counter" class="pm-cnt-normal">0/100</span></div><div class="pm-bulk-progress-wrap" id="pm-bulk-progress-wrap"><div class="pm-bulk-progress-bar" id="pm-bulk-progress-bar"></div></div><div id="pm-bulk-progress"></div><div class="pm-bulk-result-actions" id="pm-bulk-result-actions"><button type="button" class="pm-bulk-copyall" id="pm-bulk-copyall">\uD83D\uDCCB Copy All</button><button type="button" class="pm-bulk-csv" id="pm-bulk-csv">\u2B07\uFE0F Download CSV</button><button type="button" class="pm-bulk-sheets" id="pm-bulk-sheets">\uD83D\uDCC8 Open in Sheets</button></div><div id="pm-bulk-sheets-tip" style="display:none;font-size:11px;color:rgba(255,255,255,0.55);text-align:center;padding:5px 0 0;font-weight:500">\uD83D\uDCA1 Click <b style="color:#60a5fa">"Open in Sheets"</b> \u2192 new tab opens \u2192 press <b style="color:#60a5fa">Ctrl+V</b> \u2192 done!</div><div id="pm-bulk-actions"><button type="button" id="pm-bulk-selall">Select All</button><button type="button" id="pm-bulk-gen" disabled>Generate 0 Prompts</button></div><div id="pm-bulk-brand" style="font-size:11px;color:#64748b;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;"><span>AI Vision Prompt Generator</span><span>·</span><span>100-Image Bulk Engine</span></div></div></div>';
    document.body.appendChild(overlay);

    var grid=document.getElementById('pm-bulk-grid');
    var selected=new Set();
    var promptsOut=[];

    allImgs.forEach(function(img,i){
      var item=document.createElement('div');
      item.className='pm-bulk-item';
      item.dataset.idx=String(i);
      var im=document.createElement('img');
      im.alt='';
      im.loading='lazy';
      im.src=_pmRealSrc(img)||'';
      item.appendChild(im);
      var chk=document.createElement('div');
      chk.className='pm-bulk-check';
      chk.textContent='\u2713';
      item.appendChild(chk);
      item.addEventListener('click',function(){
        if(selected.has(i)){
          selected.delete(i);
          item.classList.remove('selected');
        }else{
          if(selected.size>=BULK_LIMIT){
            var info=document.getElementById('pm-bulk-info');
            var counter=document.getElementById('pm-bulk-counter');
            if(info){info.classList.remove('pm-shake');void info.offsetWidth;info.classList.add('pm-shake');setTimeout(function(){info.classList.remove('pm-shake');},400);}
            if(counter){counter.classList.remove('pm-shake');void counter.offsetWidth;counter.classList.add('pm-shake');setTimeout(function(){counter.classList.remove('pm-shake');},400);}
            return;
          }
          selected.add(i);
          item.classList.add('selected');
        }
        updateBulkUI();
      });
      grid.appendChild(item);
    });

    function updateBulkUI(){
      var count=selected.size;
      var info=document.getElementById('pm-bulk-info');
      var infoText=document.getElementById('pm-bulk-info-text');
      var counter=document.getElementById('pm-bulk-counter');
      var genBtn=document.getElementById('pm-bulk-gen');
      if(count>=BULK_LIMIT){
        if(infoText)infoText.innerHTML='<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Batch full — '+BULK_LIMIT+'/'+BULK_LIMIT+' selected';
        if(info)info.className='pm-info-full';
        if(counter){counter.textContent=count+'/'+BULK_LIMIT;counter.className='pm-cnt-full';}
      }else if(count>=BULK_LIMIT-4){
        if(infoText)infoText.textContent=count+' of '+allImgs.length+' selected — '+(BULK_LIMIT-count)+' remaining';
        if(info)info.className='pm-info-warn';
        if(counter){counter.textContent=count+'/'+BULK_LIMIT;counter.className='pm-cnt-warn';}
      }else{
        if(infoText)infoText.textContent=count+' of '+allImgs.length+' selected (max '+BULK_LIMIT+')';
        if(info)info.className='';
        if(counter){counter.textContent=count+'/'+BULK_LIMIT;counter.className='pm-cnt-normal';}
      }
      genBtn.textContent='Generate '+count+' Prompts';
      genBtn.disabled=count===0;
    }

    var allSelected=false;
    document.getElementById('pm-bulk-selall').addEventListener('click',function(){
      allSelected=!allSelected;
      selected.clear();
      document.querySelectorAll('.pm-bulk-item').forEach(function(item,idx){
        if(allSelected&&idx<BULK_LIMIT){
          selected.add(idx);
          item.classList.add('selected');
        }else{
          item.classList.remove('selected');
        }
      });
      document.getElementById('pm-bulk-selall').textContent=allSelected?'Deselect All':'Select All';
      updateBulkUI();
    });

    document.getElementById('pm-bulk-close').addEventListener('click',function(){
      overlay.remove();
    });

    document.getElementById('pm-bulk-copyall').addEventListener('click',async function(){
      if(!promptsOut.length)return;
      var txt=promptsOut.map(function(p,i){return '#'+(i+1)+'\n'+p.prompt;}).join('\n\n---\n\n');
      try{await navigator.clipboard.writeText(txt);}catch(_cc){}
      var pg=document.getElementById('pm-bulk-progress');
      if(pg)pg.innerHTML='<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg> Copied '+promptsOut.length+' prompts.';
    });
    document.getElementById('pm-bulk-csv').addEventListener('click',function(){
      if(!promptsOut.length)return;
      var rows=['"No","Style","Prompt"'];
      for(var i=0;i<promptsOut.length;i++){
        var cleanP=String(promptsOut[i].prompt).replace(/^MAIN PROMPT:\s*/i,'').replace(/"/g,'""').replace(/\r?\n/g,' ');
        var sty=String(promptsOut[i].style||'universal').replace(/"/g,'""');
        rows.push('"'+String(i+1)+'","'+sty+'","'+cleanP+'"');
      }
      var blob=new Blob(['\uFEFF'+rows.join('\n')],{type:'text/csv;charset=utf-8;'});
      var u=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=u;
      a.download='VisionPrompt-bulk-'+new Date().toLocaleDateString('en-CA')+'.csv';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){try{URL.revokeObjectURL(u);}catch(_e){}},800);
    });

    document.getElementById('pm-bulk-sheets').addEventListener('click',async function(){
      if(!promptsOut.length)return;
      var tsv='No\tStyle\tPrompt\n'+promptsOut.map(function(p,i){
        var cleanP=String(p.prompt).replace(/^MAIN PROMPT:\s*/i,'').replace(/\t/g,' ').replace(/\r?\n/g,' ');
        var sty=String(p.style||'universal').replace(/\t/g,' ');
        return String(i+1)+'\t'+sty+'\t'+cleanP;
      }).join('\n');
      try{await navigator.clipboard.writeText(tsv);}catch(_cc){}
      window.open('https://docs.google.com/spreadsheets/u/0/create','_blank');
      var pg=document.getElementById('pm-bulk-progress');
      if(pg)pg.innerHTML='<svg style="display:inline-block;vertical-align:-0.15em" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg> Google Sheets opened!<br><small style="color:rgba(255,255,255,0.5);line-height:1.7">Go to the new tab &rarr; press <b style="color:#60a5fa">Ctrl+V</b><br>&rarr; All data will paste into columns automatically!</small>';
    });

    document.getElementById('pm-bulk-gen').addEventListener('click',function(){
      if(selected.size===0)return;
      if(selected.size>BULK_LIMIT){
        _shEr('Max 100 images per batch allowed.');
        return;
      }
      var selectedImgs=Array.from(selected).map(function(i){return allImgs[i];});
      var total=selectedImgs.length;

      document.getElementById('pm-bulk-actions').style.display='none';
      var progress=document.getElementById('pm-bulk-progress');
      var pWrap=document.getElementById('pm-bulk-progress-wrap');
      var pBar=document.getElementById('pm-bulk-progress-bar');
      var rActions=document.getElementById('pm-bulk-result-actions');
      if(rActions)rActions.style.display='none';
      progress.style.display='block';
      if(pWrap)pWrap.style.display='block';
      promptsOut=[];

      (async function(){
        var done=0,failed=0,stoppedByQuota=false;
        for(var bi=0;bi<selectedImgs.length;bi++){
          var img=selectedImgs[bi];
          var src=_pmRealSrc(img);
          if(!src){failed++;continue;}

          progress.textContent='\u26A1 Generating '+(bi+1)+'/'+total+'...';
          if(pBar)pBar.style.width=(Math.round((bi/Math.max(total,1))*100))+'%';

          try{
            var quotaCheck=await chrome.runtime.sendMessage({type:'GET_REMAINING'}).catch(function(){return null;});
            if(quotaCheck&&typeof quotaCheck.remaining==='number'&&quotaCheck.remaining<=0&&quotaCheck.remaining<999){
              stoppedByQuota=true;
              break;
            }
            var bw=0,bh=0;try{if(img){bw=img.naturalWidth||img.width||0;bh=img.naturalHeight||img.height||0;}}catch(_){}var ar=_calcMidjourneyAspectRatio(bw,bh);
            var r=await chrome.runtime.sendMessage({type:'BULK_GENERATE_SINGLE',src:src,aspectRatio:ar});
            if(_bulkLimitReached(r)){
              stoppedByQuota=true;
              break;
            }
            if(r&&r.prompt){
              done++;
              promptsOut.push({prompt:String(r.prompt||'').replace(/^\/imagine\s*/i,'').trim(),style:r.detectedStyle||currentStyle});
            }else{
              failed++;
            }
          }catch(e){
            failed++;
          }

          if(bi<selectedImgs.length-1){
            await new Promise(function(res){setTimeout(res,850);});
          }
        }

        if(pBar)pBar.style.width='100%';
        if(stoppedByQuota){
          progress.textContent='\u26A0\uFE0F Daily limit reached. Stopped after '+done+' successful prompts.';
          _pmErrorAlert('AI Vision Prompt','Daily limit reached during bulk generation. Completed: '+done+' prompt(s).');
        }else if(done>0){
          progress.innerHTML='\u2705 Done! '+done+' prompts generated.'+(failed>0?' ('+failed+' failed)':'');
        }else{
          progress.textContent='\u274C Failed to generate prompts.';
        }
        if(done>0&&rActions){rActions.style.display='flex';var tip=document.getElementById('pm-bulk-sheets-tip');if(tip)tip.style.display='block';}
      })();
    });
  })();
}
function _esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
})();
