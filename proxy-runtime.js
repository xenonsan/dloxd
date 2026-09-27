(()=>{
  'use strict';

  const HTTP_PROXY_PREFIX='/__proxy/url/';
  const WS_PROXY_PREFIX='/__proxy-ws/';

  const encodeUrl=value=>{
    const bytes=new TextEncoder().encode(String(value));
    let binary='';
    for(const byte of bytes)binary+=String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  };

  const isOwnOrigin=url=>url.host===location.host;

  const mapUrl=value=>{
    if(value==null)return value;
    const raw=String(value);
    if(!raw||raw.startsWith('#')||/^(data|blob|javascript|about|mailto|tel):/i.test(raw)||raw.startsWith(HTTP_PROXY_PREFIX))return raw;
    try{
      const url=new URL(raw,location.href);
      return isOwnOrigin(url)?url.pathname+url.search+url.hash:HTTP_PROXY_PREFIX+encodeUrl(url.href);
    }catch{
      return raw;
    }
  };

  const mapSrcset=value=>{
    if(value==null)return value;
    return String(value).split(',').map(candidate=>{
      const part=candidate.trim();
      if(!part)return part;
      const match=part.match(/^(\S+)(\s+.+)?$/);
      return match?mapUrl(match[1])+(match[2]||''):part;
    }).join(', ');
  };

  const nativeFetch=fetch.bind(window);
  window.fetch=(input,init)=>input instanceof Request
    ?nativeFetch(new Request(mapUrl(input.url),input),init)
    :nativeFetch(mapUrl(input),init);

  const nativeXhrOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url){
    arguments[1]=mapUrl(url);
    return nativeXhrOpen.apply(this,arguments);
  };

  const nativeBeacon=navigator.sendBeacon?.bind(navigator);
  if(nativeBeacon)navigator.sendBeacon=(url,data)=>nativeBeacon(mapUrl(url),data);

  const mapCssUrls=value=>{
    if(value==null)return value;
    return String(value).replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi,(whole,quote,url)=>{
      const mapped=mapUrl(url);
      return `url(${quote}${mapped}${quote})`;
    });
  };

  const nativeSetAttribute=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(name,value){
    const attr=String(name).toLowerCase();
    if(attr==='src'||attr==='href'||attr==='poster')value=mapUrl(value);
    else if(attr==='srcset')value=mapSrcset(value);
    else if(attr==='style')value=mapCssUrls(value);
    return nativeSetAttribute.call(this,name,value);
  };

  const nativeStyleSetProperty=CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty=function(property,value,priority){
    return nativeStyleSetProperty.call(this,property,mapCssUrls(value),priority);
  };

  // CSSStyleDeclaration is an exotic host object in Chromium. Properties such as
  // backgroundImage are not normal configurable prototype setters, so replacing
  // CSSStyleDeclaration.prototype.backgroundImage does not intercept React writes.
  // Wrap each element's native style object instead and translate URL values at the
  // exact assignment boundary used by React: element.style.backgroundImage = value.
  const nativeStyleDescriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'style');
  const styleWrappers=new WeakMap();
  if(nativeStyleDescriptor?.get&&nativeStyleDescriptor.configurable){
    Object.defineProperty(HTMLElement.prototype,'style',{
      ...nativeStyleDescriptor,
      get(){
        const nativeStyle=nativeStyleDescriptor.get.call(this);
        let wrapper=styleWrappers.get(nativeStyle);
        if(wrapper)return wrapper;
        wrapper=new Proxy(nativeStyle,{
          get(target,property){
            const value=Reflect.get(target,property,target);
            return typeof value==='function'?value.bind(target):value;
          },
          set(target,property,value){
            const mapped=typeof value==='string'?mapCssUrls(value):value;
            return Reflect.set(target,property,mapped,target);
          },
          defineProperty(target,property,descriptor){
            if(typeof descriptor.value==='string')descriptor={...descriptor,value:mapCssUrls(descriptor.value)};
            return Reflect.defineProperty(target,property,descriptor);
          }
        });
        styleWrappers.set(nativeStyle,wrapper);
        return wrapper;
      }
    });
  }

  const patchUrlProperty=(prototype,property,mapper=mapUrl)=>{
    if(!prototype)return;
    const descriptor=Object.getOwnPropertyDescriptor(prototype,property);
    if(!descriptor?.set||!descriptor.configurable)return;
    Object.defineProperty(prototype,property,{
      ...descriptor,
      set(value){return descriptor.set.call(this,mapper(value));}
    });
  };

  patchUrlProperty(window.HTMLImageElement?.prototype,'src');
  patchUrlProperty(window.HTMLImageElement?.prototype,'srcset',mapSrcset);
  patchUrlProperty(window.HTMLSourceElement?.prototype,'src');
  patchUrlProperty(window.HTMLSourceElement?.prototype,'srcset',mapSrcset);
  patchUrlProperty(window.HTMLVideoElement?.prototype,'poster');

  const NativeWebSocket=window.WebSocket;
  if(NativeWebSocket){
    window.WebSocket=class extends NativeWebSocket{
      constructor(value,protocols){
        const target=new URL(String(value),location.href);
        if(!/^wss?:$/.test(target.protocol)||isOwnOrigin(target)){
          return protocols===undefined?super(target.href):super(target.href,protocols);
        }
        const local=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+WS_PROXY_PREFIX+encodeUrl(target.href);
        return protocols===undefined?super(local):super(local,protocols);
      }
    };
    for(const key of ['CONNECTING','OPEN','CLOSING','CLOSED'])window.WebSocket[key]=NativeWebSocket[key];
  }
})();
