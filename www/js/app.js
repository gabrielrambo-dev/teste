const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const LOCAL_PROXY = "/api/chat";
const $ = id => document.getElementById(id);

const el = {
  drawer:$("drawer"), overlay:$("overlay"), menuBtn:$("menuBtn"), messages:$("messages"),
  input:$("input"), sendBtn:$("sendBtn"), apiKey:$("apiKey"), model:$("model"),
  mode:$("mode"), tokens:$("tokens"), persona:$("persona"), chatList:$("chatList"),
  title:$("title"), subtitle:$("subtitle"), newChatBtn:$("newChatBtn"),
  clearBtn:$("clearBtn"), exportBtn:$("exportBtn"), toast:$("toast")
};

const STORE = "nemotron_mobile_app_fixed_v1";
const SETTINGS = "nemotron_mobile_settings_fixed_v1";
let state = { current:null, chats:[], sending:false };

function isNativeApp(){
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}
function id(){ return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function save(){
  localStorage.setItem(STORE, JSON.stringify(state));
  localStorage.setItem(SETTINGS, JSON.stringify({
    apiKey: el.apiKey.value, model: el.model.value, mode: el.mode.value,
    tokens: el.tokens.value, persona: el.persona.value
  }));
}
function load(){
  try{ const s = JSON.parse(localStorage.getItem(STORE)||"{}"); if(s.chats) state=s; }catch{}
  try{
    const c = JSON.parse(localStorage.getItem(SETTINGS)||"{}");
    el.apiKey.value = c.apiKey || "";
    el.model.value = c.model || el.model.value;
    el.mode.value = c.mode || "medio";
    el.tokens.value = c.tokens || "1600";
    el.persona.value = c.persona || "Responda em português do Brasil, seja direto, profissional, use tópicos quando fizer sentido e entregue código completo quando eu pedir.";
  }catch{}
  if(!state.chats.length) newChat(false);
  if(!state.current) state.current = state.chats[0].id;
}
function chat(){ return state.chats.find(c=>c.id===state.current); }
function newChat(draw=true){
  const c = { id:id(), title:"Novo chat", created:Date.now(), messages:[] };
  state.chats.unshift(c); state.current=c.id; save(); if(draw) render(); closeMenu();
}
function html(s){ return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function format(t){
  let safe = html(t);
  safe = safe.replace(/```([\s\S]*?)```/g, (_,code)=>`<pre><code>${code.trim()}</code></pre>`);
  safe = safe.replace(/`([^`]+)`/g,"<code>$1</code>");
  return safe;
}
function toast(t){
  el.toast.textContent=t; el.toast.style.display="block";
  clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>el.toast.style.display="none",2600);
}
function render(){
  const c = chat();
  el.title.textContent = c?.title || "Novo chat";
  const ambiente = isNativeApp() ? "App Android" : (location.protocol === "file:" ? "file:// não recomendado" : "Proxy local");
  el.subtitle.textContent = `${el.model.options[el.model.selectedIndex]?.text || el.model.value} • ${ambiente}`;
  el.chatList.innerHTML = "";
  state.chats.forEach(x=>{
    const b=document.createElement("button");
    b.className="chat-item"+(x.id===state.current?" active":"");
    b.innerHTML=`<strong>${html(x.title)}</strong><span>${html((x.messages.at(-1)?.content||"Sem mensagens").slice(0,80))}</span>`;
    b.onclick=()=>{state.current=x.id;save();render();closeMenu();}
    b.oncontextmenu=e=>{e.preventDefault(); removeChat(x.id);}
    el.chatList.appendChild(b);
  });
  renderMessages();
  save();
}
function removeChat(cid){
  if(!confirm("Excluir conversa?")) return;
  state.chats=state.chats.filter(c=>c.id!==cid);
  if(!state.chats.length) newChat(false);
  state.current=state.chats[0].id; save(); render();
}
function renderMessages(){
  const c=chat(); el.messages.innerHTML="";
  if(!c || !c.messages.length){
    el.messages.innerHTML=`<div class="welcome"><div class="big">N</div><h2>Nemotron Chat</h2><p>Versão corrigida: no Android usa HTTP nativo; no PC usa proxy local. Não abra direto por file://.</p></div>`;
    return;
  }
  c.messages.forEach(m=>addBubble(m.role,m.content));
}
function addBubble(role,text,loading=false){
  const wrap=document.createElement("div"); wrap.className="msg "+role;
  const av=document.createElement("div"); av.className="avatar"; av.textContent=role==="user"?"EU":"IA";
  const bubble=document.createElement("div"); bubble.className="bubble"; bubble.innerHTML=loading?"Pensando...":format(text);
  wrap.append(role==="user"?bubble:av, role==="user"?av:bubble);
  el.messages.appendChild(wrap); el.messages.scrollTop=el.messages.scrollHeight; return bubble;
}
function titleFrom(t){ t=t.replace(/\s+/g," ").trim(); return t.length>34?t.slice(0,34)+"...":t||"Novo chat"; }
function systemPrompt(){
  const mode = {curto:"Responda curto e direto.",medio:"Responda com boa explicação, mas sem enrolar.",profundo:"Analise melhor, organize por passos e entregue solução completa."}[el.mode.value] || "";
  return `${el.persona.value}\n${mode}\nNão mostre raciocínio interno oculto. Mostre apenas resposta final útil.`;
}
function payloadFor(c){
  return {
    model: el.model.value,
    messages: [{role:"system",content:systemPrompt()}, ...c.messages.slice(-18).map(m=>({role:m.role,content:m.content}))],
    temperature: 0.45,
    max_tokens: Number(el.tokens.value),
    stream: false
  };
}
async function callNvidia(payload, key){
  if(isNativeApp()){
    const http = window.Capacitor?.Plugins?.CapacitorHttp;
    if(!http) throw new Error("CapacitorHttp não encontrado. Rode npx cap sync android e gere o APK novamente.");
    const r = await http.post({
      url: NVIDIA_URL,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
        "Accept": "application/json"
      },
      data: payload
    });
    if(r.status < 200 || r.status >= 300){
      throw new Error("HTTP " + r.status + " - " + JSON.stringify(r.data).slice(0,500));
    }
    return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
  }

  if(location.protocol === "file:"){
    throw new Error("Você abriu por file://. A NVIDIA bloqueia chamada direta no navegador. Rode pelo testar-no-pc.bat ou gere o APK corrigido.");
  }

  const res = await fetch(LOCAL_PROXY,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer " + key
    },
    body:JSON.stringify(payload)
  });
  const text = await res.text();
  if(!res.ok) throw new Error("HTTP " + res.status + " - " + text.slice(0,500));
  return JSON.parse(text);
}
async function send(){
  if(state.sending) return;
  const text=el.input.value.trim();
  if(!text) return;
  const key=el.apiKey.value.trim();
  if(!key){ toast("Coloque sua API Key NVIDIA."); openMenu(); return; }

  const c=chat(); el.input.value=""; resizeInput();
  if(!c.messages.length) c.title=titleFrom(text);
  c.messages.push({role:"user",content:text});
  save(); render();

  const bubble=addBubble("assistant","",true);
  state.sending=true; el.sendBtn.disabled=true;

  let finalText="";
  try{
    const data = await callNvidia(payloadFor(c), key);
    finalText = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    if(!finalText) finalText = "O modelo respondeu, mas não veio texto. Tente outro modelo.";
  }catch(e){
    finalText = "Erro ao chamar a NVIDIA API:\n\n" + (e.message || e) + "\n\nSolução: no PC use testar-no-pc.bat. No celular instale o APK gerado por este projeto corrigido.";
  }finally{
    bubble.innerHTML=format(finalText);
    c.messages.push({role:"assistant",content:finalText});
    state.sending=false; el.sendBtn.disabled=false; save(); render();
  }
}
function resizeInput(){ el.input.style.height="auto"; el.input.style.height=Math.min(el.input.scrollHeight,140)+"px"; }
function openMenu(){ document.body.classList.add("open"); }
function closeMenu(){ document.body.classList.remove("open"); }
function exportChat(){
  const c=chat(); if(!c) return;
  const txt=["# "+c.title,"",...c.messages.map(m=>`## ${m.role==="user"?"Você":"IA"}\n${m.content}\n`)].join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([txt],{type:"text/markdown"}));
  a.download=c.title.replace(/[^\wÀ-ÿ]+/g,"_")+".md"; a.click();
}
el.sendBtn.onclick=send;
el.input.oninput=resizeInput;
el.input.onkeydown=e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} };
el.menuBtn.onclick=openMenu; el.overlay.onclick=closeMenu;
el.newChatBtn.onclick=()=>newChat(true);
el.exportBtn.onclick=exportChat;
el.clearBtn.onclick=()=>{ if(confirm("Apagar tudo?")){localStorage.clear(); state={current:null,chats:[],sending:false}; load(); render();} };
document.querySelectorAll(".quickbar button").forEach(b=>b.onclick=()=>{ el.input.value=b.dataset.fill+el.input.value; resizeInput(); el.input.focus(); });
[el.apiKey,el.model,el.mode,el.tokens,el.persona].forEach(x=>x.oninput=()=>{save();render();});
load(); render();
