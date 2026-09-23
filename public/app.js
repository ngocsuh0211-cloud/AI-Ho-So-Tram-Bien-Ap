const content=document.getElementById('content');let history=[];window.currentProject='Trạm ABC';const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));const pages={
home:()=>`<div class="eyebrow">TRỢ LÝ AI HỒ SƠ</div><h1 class="title">Xin chào, Admin 👋</h1><p class="sub">V1 đã nối với AI thật ở phía máy chủ.</p><div class="grid"><div class="card stat"><div><span class="muted">AI API</span><div class="num" id="apiStatus">Đang kiểm tra...</div></div><b>✦</b></div><div class="card stat"><div><span class="muted">Kho kiến thức</span><div class="num">File Search</div></div><b>🧠</b></div><div class="card stat"><div><span class="muted">Chat AI</span><div class="num">Sẵn sàng</div></div><b>💬</b></div><div class="card stat"><div><span class="muted">Word/Excel/PDF</span><div class="num">Giai đoạn kế</div></div><b>📄</b></div></div><div class="two"><div class="card"><h3>Luồng hoạt động</h3><p class="muted">Đào tạo → Kho kiến thức → Chọn công trình → Giao việc → AI trả kết quả.</p><button class="btn gold" onclick="go('chat')">✦ Thử Chat AI</button></div><div class="card"><h3>Nguyên tắc</h3><p class="muted">Không tự bịa dữ liệu. Thiếu thông tin sẽ báo CHƯA CÓ DỮ LIỆU.</p></div></div>`,
projects:()=>`<div class="eyebrow">QUẢN LÝ</div><h1 class="title">Công trình</h1><p class="sub">V1 demo; dữ liệu riêng từng công trình sẽ nối vào CSDL ở bước tiếp theo.</p><div class="grid3">${['Trạm ABC','Di dời 4B','Trạm XYZ'].map(x=>`<div class="card"><h3>${x}</h3><p class="muted">Kho hồ sơ công trình</p><button class="btn light" onclick="go('chat')">Mở</button></div>`).join('')}</div>`,
training:()=>`<div class="eyebrow">ADMIN</div><h1 class="title">🧠 Đào tạo AI</h1><p class="sub">Tải tài liệu quy trình, mẫu hồ sơ và hồ sơ mẫu vào kho kiến thức.</p><div class="card"><h3>1. Khởi tạo kho kiến thức</h3><p class="muted">Chỉ cần làm một lần. Hệ thống sẽ tạo kho File Search trên OpenAI.</p><button class="btn light" onclick="setupVectorStore()">⚙ Khởi tạo kho kiến thức</button><p id="storeResult" class="muted"></p></div><div class="card"><h3>2. Đưa tài liệu vào kho</h3><input id="trainFiles" type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.pptx"><button class="btn gold" onclick="uploadTraining()">＋ Đưa vào kho kiến thức</button><p id="uploadResult" class="muted"></p></div><div class="card"><h3>AI đang tuân thủ</h3><p class="muted">ĐÃ CÓ · THIẾU · CẦN KIỂM TRA và không tự bịa dữ liệu.</p></div>`,
files:()=>`<div class="eyebrow">DỮ LIỆU</div><h1 class="title">📚 Kho hồ sơ</h1><p class="sub">Hiện tại tài liệu được lưu trong OpenAI Vector Store để AI tra cứu.</p><div class="drop"><h3>Muốn AI đọc tài liệu?</h3><p>Dùng mục Đào tạo AI để tải file lên kho kiến thức.</p><button class="btn gold" onclick="go('training')">Mở Đào tạo AI</button></div>`,
chat:()=>`<div class="eyebrow">TRỢ LÝ</div><h1 class="title">✦ Chat AI thật</h1><p class="sub">AI tra cứu kho kiến thức đã tải lên.</p><div class="chat"><div class="chat-side"><b>Công trình</b><button class="projectBtn active" data-project="Trạm ABC">▣ Trạm ABC</button><button class="projectBtn" data-project="Di dời 4B">▣ Di dời 4B</button><button class="projectBtn" data-project="Trạm XYZ">▣ Trạm XYZ</button></div><div class="chat-main"><div class="messages" id="messages"><div class="bubble ai"><b>AI Hồ sơ</b><br>Xin chào! Hãy giao một công việc.</div></div><div class="composer"><input id="msg" placeholder="Ví dụ: Kiểm tra hồ sơ công trình này còn thiếu gì..."><button class="btn gold" onclick="send()">Gửi</button></div></div></div>`,
users:()=>`<div class="eyebrow">QUẢN TRỊ</div><h1 class="title">👥 Người dùng</h1><p class="sub">Đăng nhập, phân quyền Admin/User và quản lý tài khoản sẽ được nối ở lớp nhiều người dùng.</p><div class="card"><h3>Admin</h3><p class="muted">V1 hiện là bản kiểm thử AI.</p></div>`};
function go(p){document.querySelectorAll('.nav[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));content.innerHTML=pages[p]();if(p==='home')status();if(p==='chat')bind();}
async function status(){try{const r=await fetch('/api/status'),d=await r.json();document.getElementById('apiStatus').textContent=d.configured?(d.blobConfigured?'Đã kết nối':'AI kết nối · Chưa có Blob'):'Chưa có Key';}catch(e){document.getElementById('apiStatus').textContent='Backend lỗi';}}
function bind(){document.querySelectorAll('.projectBtn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.projectBtn').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentProject=b.dataset.project;});}
async function send(){const i=document.getElementById('msg');if(!i.value.trim())return;const q=i.value.trim(),m=document.getElementById('messages');m.innerHTML+=`<div class="bubble me">${esc(q)}</div><div class="bubble ai" id="typing">Đang xử lý...</div>`;i.value='';try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,project:currentProject,history})});const d=await r.json();document.getElementById('typing')?.remove();if(!r.ok)throw Error(d.error||'Lỗi API');m.innerHTML+=`<div class="bubble ai"><b>AI Hồ sơ</b><br>${esc(d.text).replace(/\\n/g,'<br>')}</div>`;history.push({role:'user',content:q},{role:'assistant',content:d.text});}catch(e){document.getElementById('typing')?.remove();m.innerHTML+=`<div class="bubble ai"><b>Lỗi:</b> ${esc(e.message)}</div>`;}}
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
document.querySelectorAll('.nav[data-page]').forEach(b=>b.onclick=()=>go(b.dataset.page));go('home');