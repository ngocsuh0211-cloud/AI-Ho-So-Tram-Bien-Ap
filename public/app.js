const content=document.getElementById('content');let history=[];window.currentProject='Trạm ABC';const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));const pages={
home:()=>`<div class="eyebrow">TRỢ LÝ AI HỒ SƠ</div><h1 class="title">Xin chào, Admin 👋</h1><p class="sub">V1 đã nối với AI thật ở phía máy chủ.</p><div class="grid"><div class="card stat"><div><span class="muted">AI API</span><div class="num" id="apiStatus">Đang kiểm tra...</div></div><b>✦</b></div><div class="card stat"><div><span class="muted">Kho kiến thức</span><div class="num">File Search</div></div><b>🧠</b></div><div class="card stat"><div><span class="muted">Chat AI</span><div class="num">Sẵn sàng</div></div><b>💬</b></div><div class="card stat"><div><span class="muted">Word/Excel/PDF</span><div class="num">Giai đoạn kế</div></div><b>📄</b></div></div><div class="two"><div class="card"><h3>Luồng hoạt động</h3><p class="muted">Đào tạo → Kho kiến thức → Chọn công trình → Giao việc → AI trả kết quả.</p><button class="btn gold" onclick="go('chat')">✦ Thử Chat AI</button></div><div class="card"><h3>Nguyên tắc</h3><p class="muted">Không tự bịa dữ liệu. Thiếu thông tin sẽ báo CHƯA CÓ DỮ LIỆU.</p></div></div>`,
projects:()=>`<div class="eyebrow">QUẢN LÝ</div><h1 class="title">Công trình</h1><p class="sub">V1 demo; dữ liệu riêng từng công trình sẽ nối vào CSDL ở bước tiếp theo.</p><div class="grid3">${['Trạm ABC','Di dời 4B','Trạm XYZ'].map(x=>`<div class="card"><h3>${x}</h3><p class="muted">Kho hồ sơ công trình</p><button class="btn light" onclick="go('chat')">Mở</button></div>`).join('')}</div>`,
training:()=>`<div class="eyebrow">ADMIN</div><h1 class="title">🧠 Đào tạo AI</h1><p class="sub">Dạy AI cách làm hồ sơ theo quy trình thực tế của bạn. Không ép theo một mẫu cố định.</p>
<div class="two">
<div class="card"><h3>① Tạo quy trình mới</h3><input id="wfTitle" class="field" placeholder="Ví dụ: Lập hồ sơ nghiệm thu thiết bị"><textarea id="wfGoal" class="field" rows="3" placeholder="Mục tiêu của quy trình, đầu vào cần có, đầu ra phải tạo..."></textarea><button class="btn gold" onclick="createWorkflow()">＋ Tạo quy trình</button><p id="wfResult" class="muted"></p></div>
<div class="card"><h3>② Các quy trình đã dạy</h3><div id="workflowList" class="muted">Đang tải...</div></div>
</div>
<div class="card"><h3>③ Dạy từng bước</h3><p class="muted">Mỗi bước có thể ghi: phải làm gì, đọc dữ liệu ở đâu, điều kiện nào, khi gặp trường hợp chưa được dạy thì hỏi gì, và cách kiểm tra kết quả.</p><div id="workflowEditor" class="muted">Chọn một quy trình bên phải để bắt đầu dạy.</div></div>`,
files:()=>`<div class="eyebrow">DỮ LIỆU</div><h1 class="title">📚 Kho hồ sơ</h1><p class="sub">Hiện tại tài liệu được lưu trong OpenAI Vector Store để AI tra cứu.</p><div class="drop"><h3>Muốn AI đọc tài liệu?</h3><p>Dùng mục Đào tạo AI để tải file lên kho kiến thức.</p><button class="btn gold" onclick="go('training')">Mở Đào tạo AI</button></div>`,
chat:()=>`<div class="eyebrow">TRỢ LÝ</div><h1 class="title">✦ Chat AI thật</h1><p class="sub">AI tra cứu kho kiến thức đã tải lên.</p><div class="chat"><div class="chat-side"><b>Công trình</b><button class="projectBtn active" data-project="Trạm ABC">▣ Trạm ABC</button><button class="projectBtn" data-project="Di dời 4B">▣ Di dời 4B</button><button class="projectBtn" data-project="Trạm XYZ">▣ Trạm XYZ</button></div><div class="chat-main"><div class="messages" id="messages"><div class="bubble ai"><b>AI Hồ sơ</b><br>Xin chào! Hãy giao một công việc.</div></div><div class="composer"><input id="msg" placeholder="Ví dụ: Kiểm tra hồ sơ công trình này còn thiếu gì..."><button class="btn gold" onclick="send()">Gửi</button></div></div></div>`,
users:()=>`<div class="eyebrow">QUẢN TRỊ</div><h1 class="title">👥 Người dùng</h1><p class="sub">Đăng nhập, phân quyền Admin/User và quản lý tài khoản sẽ được nối ở lớp nhiều người dùng.</p><div class="card"><h3>Admin</h3><p class="muted">V1 hiện là bản kiểm thử AI.</p></div>`};
function go(p){document.querySelectorAll('.nav[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));content.innerHTML=pages[p]();if(p==='home')status();if(p==='chat')bind();}
async function status(){try{const r=await fetch('/api/status'),d=await r.json();document.getElementById('apiStatus').textContent=d.configured?(d.blobConfigured?'Đã kết nối':'AI kết nối · Chưa có Blob'):'Chưa có Key';}catch(e){document.getElementById('apiStatus').textContent='Backend lỗi';}}
function bind(){document.querySelectorAll('.projectBtn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.projectBtn').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentProject=b.dataset.project;});}
async function send(){const i=document.getElementById('msg');if(!i.value.trim())return;const q=i.value.trim(),m=document.getElementById('messages');m.innerHTML+=`<div class="bubble me">${esc(q)}</div><div class="bubble ai" id="typing">Đang xử lý...</div>`;i.value='';try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,project:currentProject,history})});const d=await r.json();document.getElementById('typing')?.remove();if(!r.ok)throw Error(d.error||'Lỗi API');m.innerHTML+=`<div class="bubble ai"><b>AI Hồ sơ</b><br>${esc(d.text).replace(/\\n/g,'<br>')}</div>`;history.push({role:'user',content:q},{role:'assistant',content:d.text});}catch(e){document.getElementById('typing')?.remove();m.innerHTML+=`<div class="bubble ai"><b>Lỗi:</b> ${esc(e.message)}</div>`;}}
async function loadWorkflows(){
  const el=document.getElementById('workflowList'); if(!el)return;
  try{
    const r=await fetch('/api/workflows'); const d=await r.json();
    if(!r.ok)throw Error(d.error||'Không tải được quy trình');
    if(!d.workflows?.length){el.innerHTML='<span>Chưa có quy trình. Hãy tạo quy trình đầu tiên.</span>';return;}
    el.innerHTML=d.workflows.map(w=>`<div class="workflow-row"><button class="btn light" onclick="editWorkflow('${esc(w.id)}')">${esc(w.title)}</button><span class="muted">${w.steps?.length||0} bước</span></div>`).join('');
  }catch(e){el.textContent='Lỗi: '+e.message;}
}
async function createWorkflow(){
  const title=document.getElementById('wfTitle')?.value.trim();
  const goal=document.getElementById('wfGoal')?.value.trim();
  const out=document.getElementById('wfResult');
  if(!title){out.textContent='Hãy nhập tên quy trình.';return;}
  try{
    const r=await fetch('/api/workflows',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,goal,steps:[]})});
    const d=await r.json(); if(!r.ok)throw Error(d.error||'Không tạo được');
    out.textContent='✓ Đã lưu quy trình. Bây giờ thêm từng bước.';
    await loadWorkflows(); await editWorkflow(d.workflow.id);
  }catch(e){out.textContent='Lỗi: '+e.message;}
}
async function editWorkflow(id){
  const box=document.getElementById('workflowEditor'); if(!box)return;
  try{
    const r=await fetch('/api/workflows/'+encodeURIComponent(id)); const d=await r.json();
    if(!r.ok)throw Error(d.error||'Không tải được');
    const w=d.workflow;
    box.innerHTML=`
      <div class="workflow-head"><div><h3>${esc(w.title)}</h3><p class="muted">${esc(w.goal||'')}</p></div>
      <button class="btn gold" onclick="addStep()">＋ Thêm bước</button></div>
      <div id="steps">${(w.steps||[]).map((s,i)=>stepHtml(i,s)).join('')}</div>
      <button class="btn light" onclick="saveWorkflow('${esc(w.id)}')">💾 Lưu toàn bộ quy trình</button>
      <span id="saveMsg" class="muted"></span>`;
  }catch(e){box.textContent='Lỗi: '+e.message;}
}
function stepHtml(i,s){
  return `<div class="step card" data-step="${i}">
    <div class="step-title"><b>Bước ${i+1}</b><button class="btn danger" onclick="removeStep(${i})">Xóa</button></div>
    <input class="field s-title" value="${esc(s.title||'')}" placeholder="Tên bước">
    <textarea class="field s-action" rows="4" placeholder="AI phải thực hiện việc gì?">${esc(s.action||'')}</textarea>
    <textarea class="field s-input" rows="3" placeholder="Dữ liệu/file nào cần đọc, lấy thông tin ở đâu?">${esc(s.input||'')}</textarea>
    <textarea class="field s-rule" rows="3" placeholder="Điều kiện / If-Then / cách quyết định">${esc(s.rule||'')}</textarea>
    <textarea class="field s-check" rows="3" placeholder="Kiểm tra kết quả như thế nào?">${esc(s.check||'')}</textarea>
    <textarea class="field s-unknown" rows="2" placeholder="Nếu gặp trường hợp chưa được dạy, AI phải hỏi gì?">${esc(s.unknown||'')}</textarea>
  </div>`;
}
function addStep(){
  const box=document.getElementById('steps'); if(!box)return;
  const n=box.querySelectorAll('.step').length;
  box.insertAdjacentHTML('beforeend',stepHtml(n,{title:'',action:'',input:'',rule:'',check:'',unknown:''}));
}
function removeStep(i){
  document.querySelector('[data-step="'+i+'"]')?.remove();
  document.querySelectorAll('#steps .step').forEach((x,n)=>{x.dataset.step=n;x.querySelector('.step-title b').textContent='Bước '+(n+1);});
}
async function saveWorkflow(id){
  try{
    const r0=await fetch('/api/workflows/'+encodeURIComponent(id)); const d0=await r0.json();
    if(!r0.ok)throw Error(d0.error||'Không tải được');
    const steps=[...document.querySelectorAll('#steps .step')].map((el,i)=>({
      order:i+1,title:el.querySelector('.s-title').value,action:el.querySelector('.s-action').value,
      input:el.querySelector('.s-input').value,rule:el.querySelector('.s-rule').value,
      check:el.querySelector('.s-check').value,unknown:el.querySelector('.s-unknown').value
    }));
    const r=await fetch('/api/workflows/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...d0.workflow,steps})});
    const d=await r.json(); if(!r.ok)throw Error(d.error||'Không lưu được');
    document.getElementById('saveMsg').textContent=' ✓ Đã lưu '+new Date().toLocaleTimeString('vi-VN');
    loadWorkflows();
  }catch(e){const m=document.getElementById('saveMsg');if(m)m.textContent=' Lỗi: '+e.message;}
}
async function setupVectorStore(){const o=document.getElementById('storeResult');o.textContent='Đang khởi tạo...';try{const r=await fetch('/api/setup/vector-store',{method:'POST'}),d=await r.json();if(!r.ok)throw Error(d.error||'Không tạo được kho');o.textContent='Đã tạo kho. ID: '+d.vectorStoreId+' — hãy thêm ID này vào Vercel với tên OPENAI_VECTOR_STORE_ID rồi Redeploy.';}catch(e){o.textContent='Lỗi: '+e.message;}}
let blobClientPromise;
async function getBlobUpload(){
  if(!blobClientPromise){
    blobClientPromise=import('https://esm.unpkg.com/@vercel/blob@2.8.0/client')
      .then(m=>m.upload)
      .catch(async()=>{const m=await import('https://esm.sh/@vercel/blob@2.8.0/client');return m.upload;});
  }
  return blobClientPromise;
}
async function getPdfLib(){
  if(window.PDFLib)return window.PDFLib;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    s.onload=resolve;
    s.onerror=()=>reject(Error('Không tải được thư viện xử lý PDF. Hãy tải lại trang rồi thử lại.'));
    document.head.appendChild(s);
  });
  if(!window.PDFLib)throw Error('Thư viện PDF chưa sẵn sàng.');
  return window.PDFLib;
}

async function splitLargePdf(file){
  const LIMIT=45*1024*1024; // stay safely below OpenAI's 50 MB input-file limit
  if(file.size<=LIMIT)return [{file,pageStart:1,pageEnd:null}];

  const {PDFDocument}=await getPdfLib();
  const bytes=await file.arrayBuffer();
  const src=await PDFDocument.load(bytes,{ignoreEncryption:true});
  const total=src.getPageCount();
  const parts=[];

  async function build(start,end){
    const doc=await PDFDocument.create();
    const pages=await doc.copyPages(src,Array.from({length:end-start},(_,k)=>start+k));
    pages.forEach(p=>doc.addPage(p));
    const out=await doc.save({useObjectStreams:true});
    if(out.byteLength<=LIMIT){
      const suffix=' - phần '+(parts.length+1)+' (trang '+(start+1)+'-'+end+')';
      parts.push({
        file:new File([out],file.name.replace(/\.pdf$/i,'')+suffix+'.pdf',{type:'application/pdf'}),
        pageStart:start+1,
        pageEnd:end
      });
      return;
    }
    if(end-start<=1){
      throw Error('Một trang PDF riêng lẻ đã vượt 45 MB, không thể đưa trang này vào OCR theo giới hạn của OpenAI.');
    }
    const mid=Math.floor((start+end)/2);
    await build(start,mid);
    await build(mid,end);
  }

  await build(0,total);
  return parts;
}

async function uploadTraining(){
  const i=document.getElementById('trainFiles'),o=document.getElementById('uploadResult');
  if(!i.files.length){o.textContent='Hãy chọn file.';return;}
  const files=Array.from(i.files);
  let upload;
  try{upload=await getBlobUpload();}catch(e){
    o.textContent='Lỗi: Không tải được thư viện upload Vercel Blob. '+(e?.message||e);
    return;
  }
  for(const original of files){
    try{
      if(original.size>500*1024*1024)throw Error('File vượt quá giới hạn 500 MB.');

      let parts=[{file:original,pageStart:1,pageEnd:null}];
      if(original.type==='application/pdf' || /\.pdf$/i.test(original.name)){
        o.textContent='Đang kiểm tra kích thước PDF '+original.name+'...';
        parts=await splitLargePdf(original);
        if(parts.length>1)o.textContent='PDF '+original.name+' lớn hơn 50 MB. Hệ thống đã tự chia thành '+parts.length+' phần để AI OCR.';
      }

      for(let partIndex=0;partIndex<parts.length;partIndex++){
        const part=parts[partIndex], f=part.file;
        const display=parts.length>1 ? original.name+' — phần '+(partIndex+1)+'/'+parts.length : f.name;
        o.textContent='Đang tải '+display+' trực tiếp lên Vercel Blob...';
        const blob=await upload('training/'+Date.now()+'-'+f.name.replace(/[^a-zA-Z0-9._-]+/g,'_'),f,{
          access:'private',
          handleUploadUrl:'/api/blob/upload',
          contentType:'application/pdf',
          multipart:f.size>5*1024*1024,
          onUploadProgress:(p)=>{o.textContent='Đang tải '+display+' lên Blob: '+Math.round(p.percentage||0)+'%';}
        });
        o.textContent='✓ Đã tải '+display+' lên Blob. Đang chuyển vào AI...';
        const r=await fetch('/api/training/from-blob',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            pathname:blob.pathname,
            name:f.name,
            contentType:'application/pdf',
            pageStart:part.pageStart,
            pageEnd:part.pageEnd,
            sourceName:original.name
          })
        });
        let d={};try{d=await r.json();}catch{throw Error('Máy chủ không trả JSON khi chuyển tài liệu vào AI.');}
        if(!r.ok&&r.status!==202)throw Error(d.error||'Không chuyển được tài liệu vào AI');

        let done=false;
        if(d.ocrResponseId){
          for(let n=0;n<180&&!done;n++){
            await new Promise(resolve=>setTimeout(resolve,3000));
            const sr=await fetch('/api/training/ocr-status/'+encodeURIComponent(d.ocrResponseId));
            let sd={};try{sd=await sr.json();}catch{throw Error('Máy chủ không trả JSON khi kiểm tra OCR.');}
            if(!sr.ok)throw Error(sd.error||'OCR không hoàn tất');
            if(sd.status==='completed'){
              o.textContent='✓ '+display+': Đã OCR và đưa nội dung vào kho kiến thức AI';
              done=true;
            }else if(sd.status==='failed'||sd.status==='incomplete'){
              throw Error(display+': '+(sd.error||'OCR không hoàn tất'));
            }else{
              o.textContent='⏳ '+display+': '+(sd.message||'AI đang đọc hồ sơ scan')+' ('+(n+1)+'/180)...';
            }
          }
        }else{
          for(let n=0;n<60&&!done;n++){
            await new Promise(resolve=>setTimeout(resolve,2000));
            const sr=await fetch('/api/training/status/'+encodeURIComponent(d.vectorStoreFileId));
            const sd=await sr.json();
            if(!sr.ok)throw Error(sd.error||'Không kiểm tra được trạng thái tài liệu');
            if(sd.status==='completed'){o.textContent='✓ '+display+': Đã đưa vào kho kiến thức AI';done=true;}
            else if(sd.status==='failed')throw Error(display+': '+(sd.error?.message||sd.error||'OpenAI không lập chỉ mục được tài liệu'));
            else o.textContent='⏳ '+display+': đang lập chỉ mục ('+(n+1)+'/60)...';
          }
        }
        if(!done)throw Error(display+': quá thời gian chờ xử lý. Có thể kiểm tra lại sau.');
      }
      o.textContent='✓ '+original.name+': Đã xử lý xong và đưa nội dung đọc được vào kho kiến thức AI';
    }catch(e){
      o.textContent='Lỗi: '+(e?.message||e);
      return;
    }
  }
}
document.querySelectorAll('.nav[data-page]').forEach(b=>b.onclick=()=>go(b.dataset.page));const _go=go;go=function(p){_go(p);if(p==='training')loadWorkflows();};go('home');