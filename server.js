import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI, { toFile, toStreamingFile } from 'openai';
import { get, del, put, issueSignedToken, presignUrl } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const requestedModel = process.env.OPENAI_MODEL?.trim();
const MODEL = ['gpt-5.6-luna','gpt-5.6-terra','gpt-5.6-sol'].includes(requestedModel) ? requestedModel : 'gpt-5.6-luna';
const upload = multer({ dest:'/tmp/ai-ho-so-uploads', limits:{fileSize:500*1024*1024} });

app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'public')));

function client(){ return process.env.OPENAI_API_KEY ? new OpenAI({apiKey:process.env.OPENAI_API_KEY}) : null; }
function store(){ return process.env.OPENAI_VECTOR_STORE_ID?.trim() || ''; }
function blobConfigured(){ return !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN); }

app.get('/api/status', async (req,res)=>{
  const configured=!!process.env.OPENAI_API_KEY, id=store();
  if(!configured) return res.json({ok:true,configured:false,vectorStoreConfigured:!!id,blobConfigured:blobConfigured(),model:MODEL});
  try{
    const c=client(); const vs=id?await c.vectorStores.retrieve(id):null;
    res.json({ok:true,configured:true,vectorStoreConfigured:!!id,blobConfigured:blobConfigured(),model:MODEL,vectorStoreName:vs?.name||null});
  }catch(e){res.status(500).json({ok:false,error:e.message});}
});

app.post('/api/setup/vector-store', async (req,res)=>{
  const c=client(); if(!c) return res.status(503).json({error:'Chưa cấu hình OPENAI_API_KEY.'});
  if(store()) return res.json({ok:true,vectorStoreId:store(),existing:true});
  try{
    const vs=await c.vectorStores.create({name:'Ho so Tram Bien Ap - Kho kien thuc AI'});
    res.json({ok:true,vectorStoreId:vs.id,message:'Đặt ID này vào OPENAI_VECTOR_STORE_ID trên Vercel rồi redeploy.'});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/chat', async (req,res)=>{
  const {message,project='Trạm ABC',history=[]}=req.body||{};
  if(!message?.trim()) return res.status(400).json({error:'Thiếu nội dung yêu cầu.'});
  const c=client(); if(!c) return res.status(503).json({error:'Chưa cấu hình OPENAI_API_KEY trên máy chủ.'});
  if(!store()) return res.status(503).json({error:'Chưa cấu hình OPENAI_VECTOR_STORE_ID trên máy chủ.'});
  try{
    const instructions=`Bạn là AI trợ lý hồ sơ cho công tác thi công trạm biến áp.
Nguyên tắc bắt buộc:
- Chỉ dùng dữ liệu người dùng cung cấp và tài liệu trong kho khi có liên quan.
- Không tự bịa số liệu, ngày tháng, tên người, mã hồ sơ, kết quả thí nghiệm hoặc thông tin pháp lý.
- Nếu thiếu dữ liệu, ghi rõ "CHƯA CÓ DỮ LIỆU".
- Khi kiểm tra hồ sơ, phân loại: ĐÃ CÓ / THIẾU / CẦN KIỂM TRA.
- Trả lời bằng tiếng Việt, ưu tiên bảng/danh sách.
- Công trình đang chọn: ${project}.`;
    const prior=Array.isArray(history)?history.slice(-10):[];
    const input=[...prior.map(x=>({role:x.role==='assistant'?'assistant':'user',content:String(x.content||'')})),{role:'user',content:message}];
    const r=await c.responses.create({model:MODEL,instructions,input,tools:[{type:'file_search',vector_store_ids:[store()]}]});
    res.json({ok:true,text:r.output_text||'AI không trả về nội dung.'});
  }catch(e){console.error('chat error',e);res.status(500).json({error:e.message});}
});

app.post('/api/blob/presign-upload', async (req,res)=>{
  if(!blobConfigured()) return res.status(503).json({error:'Chưa kết nối Vercel Blob với project.'});
  try{
    const {name,contentType,size}=req.body||{};
    if(!name) return res.status(400).json({error:'Thiếu tên file.'});
    if(Number(size||0)>500*1024*1024) return res.status(400).json({error:'File vượt quá giới hạn 500 MB.'});
    const safeName=String(name).replace(/[^a-zA-Z0-9._-]+/g,'_');
    const pathname=`training/${Date.now()}-${Math.random().toString(36).slice(2,10)}-${safeName}`;
    const putToken=await issueSignedToken({pathname,operations:['put'],maximumSizeInBytes:500*1024*1024});
    const getToken=await issueSignedToken({pathname,operations:['get']});
    const {presignedUrl}=await presignUrl(putToken,{pathname,operation:'put',validUntil:Date.now()+15*60*1000});
    const {presignedUrl:getUrl}=await presignUrl(getToken,{pathname,operation:'get',validUntil:Date.now()+15*60*1000,useCache:false});
    res.json({ok:true,pathname,presignedUrl,getUrl,contentType:contentType||'application/octet-stream'});
  }catch(e){
    console.error('blob presign error',e);
    res.status(500).json({error:e.message});
  }
});

app.post('/api/blob/upload', async (req,res)=>{
  if(!blobConfigured()) return res.status(503).json({error:'Chưa kết nối Vercel Blob với project.'});
  try{
    const jsonResponse=await handleUpload({
      request:req,
      body:req.body,
      onBeforeGenerateToken:async (pathname,clientPayload,multipart)=>({
        allowedContentTypes:[
          'application/pdf',
          'text/plain',
          'text/markdown',
          'text/csv',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint'
        ],
        maximumSizeInBytes:500*1024*1024,
        addRandomSuffix:true,
        tokenPayload:JSON.stringify({originalPathname:pathname,clientPayload:clientPayload||null,multipart:!!multipart})
      }),
      onUploadCompleted:async ({blob})=>{
        console.log('blob upload completed',blob.pathname,blob.url);
      }
    });
    res.json(jsonResponse);
  }catch(e){
    console.error('blob upload token error',e);
    res.status(400).json({error:e.message});
  }
});

app.post('/api/training/from-blob',async(req,res)=>{
  const c=client();
  if(!c) return res.status(503).json({error:'Chưa cấu hình OPENAI_API_KEY trên máy chủ.'});
  if(!store()) return res.status(503).json({error:'Chưa cấu hình OPENAI_VECTOR_STORE_ID trên máy chủ.'});
  if(!blobConfigured()) return res.status(503).json({error:'Chưa kết nối Vercel Blob với project.'});
  const {pathname,name,contentType,getUrl,pageStart,pageEnd,sourceName}=req.body||{};
  if(!pathname||!name) return res.status(400).json({error:'Thiếu thông tin tài liệu tạm trong Blob.'});
  try{
    let sourceStream=null;
    let detectedType=contentType||'application/octet-stream';
    if(getUrl){
      const u=new URL(getUrl);
      if(!u.hostname.endsWith('.blob.vercel-storage.com')) return res.status(400).json({error:'Đường dẫn Blob không hợp lệ.'});
      const blobResponse=await fetch(getUrl,{cache:'no-store'});
      if(blobResponse.ok && blobResponse.body){
        sourceStream=blobResponse.body;
        detectedType=contentType||blobResponse.headers.get('content-type')||detectedType;
      }
    }
    if(!sourceStream){
      const blobResult=await get(pathname,{access:'private',useCache:false});
      if(!blobResult || blobResult.statusCode!==200 || !blobResult.stream){
        return res.status(404).json({error:'Blob đã upload nhưng máy chủ không đọc được tài liệu. Hãy kiểm tra kết nối Blob/OIDC.'});
      }
      sourceStream=blobResult.stream;
      detectedType=contentType||blobResult.blob.contentType||detectedType;
    }
    const streamFile=toStreamingFile(sourceStream,name,{type:detectedType});
    // Keep the uploaded PDF in OpenAI so the Responses API can inspect the
    // rendered pages (including scanned/image-only pages) independently of
    // File Search indexing.
    const up=await c.files.create({file:streamFile,purpose:'assistants'});
    const vsFile=await c.vectorStores.files.create(store(),{file_id:up.id});

    if((detectedType||'').toLowerCase()==='application/pdf' || /\\.pdf$/i.test(name)){
      const originalPageStart=Number.isFinite(Number(pageStart))?Number(pageStart):1;
      const originalPageEnd=Number.isFinite(Number(pageEnd))?Number(pageEnd):null;
      const sourceLabel=sourceName||name;
      const ocr=await c.responses.create({
        model:MODEL,
        background:true,
        metadata:{
          source_filename:name,
          source_name:sourceLabel,
          source_page_start:String(originalPageStart),
          source_page_end:String(originalPageEnd||''),
          source_file_id:up.id,
          source_vector_store_file_id:vsFile.id,
          vector_store_id:store()
        },
        instructions:
          'Bạn là bộ phận OCR và trích xuất hồ sơ kỹ thuật. ' +
          'Đọc trực tiếp toàn bộ PDF, kể cả các trang scan/hình ảnh. ' +
          'Không tóm tắt và không suy diễn. Trích xuất tối đa nội dung có thể đọc được, ' +
          'Đây là phần từ trang '+originalPageStart+(originalPageEnd?' đến trang '+originalPageEnd:'')+' của hồ sơ gốc '+sourceLabel+'. ' +
          'giữ nguyên tiếng Việt, số liệu, ngày tháng, mã hiệu, tên người/tổ chức, tiêu đề, ' +
          'bảng biểu và các mục của hồ sơ. Mỗi trang phải bắt đầu bằng [TRANG N] với N là số trang gốc để giữ vị trí. ' +
          'Nếu một trang không đọc được, ghi [TRANG N - KHÔNG ĐỌC ĐƯỢC]. ' +
          'Không tự điền phần bị mờ hoặc thiếu.',
        input:[{
          role:'user',
          content:[
            {type:'input_file',file_id:up.id,detail:'high'},
            {type:'input_text',text:
              'Hãy OCR toàn bộ tài liệu này. Ưu tiên độ chính xác của chữ, số, ký hiệu kỹ thuật và bảng biểu. ' +
              'Xuất văn bản liên tục theo thứ tự trang để hệ thống lưu làm lớp dữ liệu có thể tìm kiếm.'
            }
          ]
        }],
        max_output_tokens:120000
      });

      // The source is now safely in OpenAI; remove the temporary Blob copy.
      try{ await del(pathname); }catch(cleanErr){ console.warn('blob cleanup warning',cleanErr.message); }

      return res.status(202).json({
        ok:true,
        name,
        fileId:up.id,
        vectorStoreFileId:vsFile.id,
        ocrResponseId:ocr.id,
        ocrStatus:ocr.status||'queued',
        needsOcr:true,
        message:'Đã nhận PDF. AI đang đọc OCR toàn bộ trang scan; sau đó hệ thống sẽ đưa phần văn bản vào kho tìm kiếm.'
      });
    }

    res.status(202).json({
      ok:true,
      name,
      fileId:up.id,
      vectorStoreFileId:vsFile.id,
      status:vsFile.status||'in_progress',
      message:'Đã chuyển tài liệu vào OpenAI. Hệ thống đang lập chỉ mục.'
    });
    try{ await del(pathname); }catch(cleanErr){ console.warn('blob cleanup warning',cleanErr.message); }
  }catch(e){
    console.error('training from blob error',e);
    res.status(500).json({error:e.message});
  }
});

// OCR status/finalization for scanned PDFs.
app.get('/api/training/ocr-status/:responseId',async(req,res)=>{
  const c=client();
  if(!c) return res.status(503).json({error:'Chưa cấu hình OPENAI_API_KEY trên máy chủ.'});
  if(!store()) return res.status(503).json({error:'Chưa cấu hình OPENAI_VECTOR_STORE_ID trên máy chủ.'});
  const responseId=String(req.params.responseId||'').trim();
  if(!responseId) return res.status(400).json({error:'Thiếu mã OCR.'});

  try{
    const r=await c.responses.retrieve(responseId);

    if(r.status==='queued' || r.status==='in_progress'){
      return res.json({ok:true,status:r.status,message:'AI đang đọc các trang scan...'});
    }
    if(r.status==='failed' || r.status==='cancelled'){
      return res.status(500).json({ok:false,status:r.status,error:r.error?.message||'OCR không hoàn tất.'});
    }
    if(r.status!=='completed'){
      return res.json({ok:true,status:r.status,message:'Đang xử lý OCR...'});
    }

    if(r.incomplete_details?.reason==='max_output_tokens'){
      return res.status(500).json({
        ok:false,
        status:'incomplete',
        error:'OCR đã chạm giới hạn đầu ra. Hồ sơ quá dài để trích xuất toàn bộ trong một lượt.'
      });
    }

    const metadata=r.metadata||{};
    const name=metadata.source_filename||'tai-lieu.pdf';
    const sourceFileId=metadata.source_file_id||null;
    const sourceVectorStoreFileId=metadata.source_vector_store_file_id||null;
    const markerPath=`training/ocr-state/${responseId}.json`;

    // Prevent duplicate OCR text files if the browser polls more than once
    // or the request is retried.
    let markerData=null;
    try{
      const markerBlob=await get(markerPath,{access:'private',useCache:false});
      if(markerBlob?.statusCode===200 && markerBlob.stream){
        const chunks=[];
        for await(const chunk of markerBlob.stream) chunks.push(Buffer.from(chunk));
        markerData=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      }
    }catch{}

    if(!markerData){
      const text=String(r.output_text||'').trim();
      if(!text) return res.status(500).json({ok:false,status:'failed',error:'OCR hoàn tất nhưng không có văn bản trả về.'});

      const ocrFilename=`OCR__${name.replace(/[^a-zA-Z0-9._-]+/g,'_')}.txt`;
      const ocrFile=await toFile(Buffer.from(text,'utf8'),ocrFilename,{type:'text/plain'});
      const textUp=await c.files.create({file:ocrFile,purpose:'assistants'});
      const textVs=await c.vectorStores.files.create(store(),{file_id:textUp.id});
      markerData={
        ok:true,
        status:'indexing',
        name,
        sourceFileId,
        sourceVectorStoreFileId,
        ocrFileId:textUp.id,
        vectorStoreFileId:textVs.id
      };
      try{
        await put(markerPath,JSON.stringify(markerData),{
          access:'private',
          contentType:'application/json',
          addRandomSuffix:false,
          overwrite:true
        });
      }catch(markerErr){
        console.warn('ocr marker write warning',markerErr.message);
      }
    }

    const indexed=await c.vectorStores.files.retrieve(markerData.vectorStoreFileId,{vector_store_id:store()});
    if(indexed.status==='completed'){
      return res.json({
        ok:true,
        status:'completed',
        name:markerData.name,
        vectorStoreFileId:markerData.vectorStoreFileId,
        message:'Đã OCR và đưa nội dung đọc được vào kho kiến thức AI.'
      });
    }
    if(indexed.status==='failed'){
      return res.status(500).json({
        ok:false,
        status:'failed',
        error:indexed.last_error?.message||'Không lập chỉ mục được văn bản OCR.'
      });
    }
    return res.json({
      ok:true,
      status:'indexing',
      name:markerData.name,
      vectorStoreFileId:markerData.vectorStoreFileId,
      message:'OCR đã xong; hệ thống đang lập chỉ mục văn bản vào kho kiến thức.'
    });
  }catch(e){
    console.error('ocr status error',e);
    res.status(500).json({error:e.message});
  }
});

// Legacy small-file route kept for compatibility; Vercel rejects requests over 4.5 MB before this handler.
app.post('/api/training/upload',upload.array('files',20),async(req,res)=>{
  const c=client(); if(!c) return res.status(503).json({error:'Chưa cấu hình OPENAI_API_KEY trên máy chủ.'});
  if(!req.files?.length) return res.status(400).json({error:'Chưa chọn file.'});
  if(!store()) return res.status(503).json({error:'Chưa cấu hình OPENAI_VECTOR_STORE_ID trên máy chủ.'});
  try{
    const results=[];
    for(const f of req.files){
      try{
        const up=await c.files.create({file:fs.createReadStream(f.path),purpose:'assistants'});
        const vsFile=await c.vectorStores.files.create(store(),{file_id:up.id});
        results.push({name:f.originalname,fileId:up.id,vectorStoreFileId:vsFile.id,status:vsFile.status||'in_progress'});
      }finally{fs.rmSync(f.path,{force:true});}
    }
    res.status(202).json({ok:true,results,message:'Đã nhận tài liệu. Hệ thống đang lập chỉ mục trong kho kiến thức.'});
  }catch(e){
    for(const f of req.files||[])fs.rmSync(f.path,{force:true});
    console.error('training upload error',e);
    res.status(500).json({error:e.message});
  }
});

app.get('/api/training/status/:fileId',async(req,res)=>{
  const c=client(); if(!c) return res.status(503).json({error:'Chưa cấu hình OPENAI_API_KEY trên máy chủ.'});
  if(!store()) return res.status(503).json({error:'Chưa cấu hình OPENAI_VECTOR_STORE_ID trên máy chủ.'});
  try{
    const f=await c.vectorStores.files.retrieve(req.params.fileId,{vector_store_id:store()});
    res.json({ok:true,id:f.id,status:f.status,error:f.last_error||null});
  }catch(e){
    console.error('training status error',e);
    res.status(500).json({error:e.message});
  }
});


// =========================
// AI WORKFLOW TRAINING V1
// Stored as structured lessons in private Vercel Blob.
// This is the reusable method layer; it is intentionally separate from project files.
// =========================
const WORKFLOW_INDEX='training/workflows/index.json';

async function readBlobJson(pathname,fallback){
  try{
    const b=await get(pathname,{access:'private',useCache:false});
    if(!b || b.statusCode!==200 || !b.stream) return fallback;
    const chunks=[]; for await(const c of b.stream) chunks.push(Buffer.from(c));
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }catch{return fallback;}
}
async function writeBlobJson(pathname,value){
  if(!blobConfigured()) throw Error('Chưa kết nối Vercel Blob với project.');
  await put(pathname,JSON.stringify(value,null,2),{
    access:'private',contentType:'application/json',addRandomSuffix:false,overwrite:true
  });
}
function cleanWorkflow(w){
  return {
    id:String(w.id||''),
    title:String(w.title||'').trim(),
    goal:String(w.goal||'').trim(),
    version:Number(w.version||1),
    updatedAt:w.updatedAt||new Date().toISOString(),
    steps:Array.isArray(w.steps)?w.steps.map((s,i)=>({
      order:i+1,title:String(s.title||'').trim(),action:String(s.action||'').trim(),
      input:String(s.input||'').trim(),rule:String(s.rule||'').trim(),
      check:String(s.check||'').trim(),unknown:String(s.unknown||'').trim()
    })):[]
  };
}

app.get('/api/workflows',async(req,res)=>{
  try{
    const data=await readBlobJson(WORKFLOW_INDEX,{workflows:[]});
    res.json({ok:true,workflows:Array.isArray(data.workflows)?data.workflows:[]});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/workflows/:id',async(req,res)=>{
  try{
    const data=await readBlobJson(WORKFLOW_INDEX,{workflows:[]});
    const w=(data.workflows||[]).find(x=>x.id===req.params.id);
    if(!w)return res.status(404).json({error:'Không tìm thấy quy trình.'});
    res.json({ok:true,workflow:w});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post('/api/workflows',async(req,res)=>{
  try{
    const title=String(req.body?.title||'').trim();
    if(!title)return res.status(400).json({error:'Thiếu tên quy trình.'});
    const data=await readBlobJson(WORKFLOW_INDEX,{workflows:[]});
    const id='wf_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
    const w=cleanWorkflow({id,title,goal:req.body?.goal,steps:[],version:1});
    data.workflows=[...(data.workflows||[]),w];
    await writeBlobJson(WORKFLOW_INDEX,data);
    res.status(201).json({ok:true,workflow:w});
  }catch(e){console.error('workflow create error',e);res.status(500).json({error:e.message});}
});

app.put('/api/workflows/:id',async(req,res)=>{
  try{
    const data=await readBlobJson(WORKFLOW_INDEX,{workflows:[]});
    const i=(data.workflows||[]).findIndex(x=>x.id===req.params.id);
    if(i<0)return res.status(404).json({error:'Không tìm thấy quy trình.'});
    const previous=data.workflows[i];
    const w=cleanWorkflow({...previous,...req.body,id:previous.id,version:Number(previous.version||1)+1,updatedAt:new Date().toISOString()});
    data.workflows[i]=w;
    await writeBlobJson(WORKFLOW_INDEX,data);
    res.json({ok:true,workflow:w});
  }catch(e){console.error('workflow update error',e);res.status(500).json({error:e.message});}
});

app.delete('/api/workflows/:id',async(req,res)=>{
  try{
    const data=await readBlobJson(WORKFLOW_INDEX,{workflows:[]});
    const before=data.workflows||[], after=before.filter(x=>x.id!==req.params.id);
    if(after.length===before.length)return res.status(404).json({error:'Không tìm thấy quy trình.'});
    data.workflows=after; await writeBlobJson(WORKFLOW_INDEX,data);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message});}
});

// Execution endpoint: converts a taught workflow into a deterministic execution plan.
// When an AI model is available it can be connected here; without paid AI credits the
// training system still works and preserves the user's method instead of pretending it executed.
app.post('/api/workflows/:id/execute',async(req,res)=>{
  try{
    const data=await readBlobJson(WORKFLOW_INDEX,{workflows:[]});
    const w=(data.workflows||[]).find(x=>x.id===req.params.id);
    if(!w)return res.status(404).json({error:'Không tìm thấy quy trình.'});
    if(!w.steps?.length)return res.status(400).json({error:'Quy trình chưa có bước nào.'});
    const project=String(req.body?.project||'').trim();
    const files=Array.isArray(req.body?.files)?req.body.files:[];
    res.json({
      ok:true,mode:process.env.OPENAI_API_KEY?'ai-ready':'training-only',
      workflow:{id:w.id,title:w.title,version:w.version},
      project,files,
      plan:w.steps.map(s=>({
        order:s.order,title:s.title,
        instruction:s.action,inputSources:s.input,decisionRule:s.rule,
        validation:s.check,unknownCase:s.unknown,status:'CHƯA THỰC HIỆN'
      })),
      next:'Cần kết nối bộ máy AI/file-operations để thực thi các bước và xuất Word/Excel/PDF; quy trình đã được lưu độc lập và sẵn sàng cho lớp thực thi.'
    });
  }catch(e){res.status(500).json({error:e.message});}
});

app.get(/.*/, (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
export default app;