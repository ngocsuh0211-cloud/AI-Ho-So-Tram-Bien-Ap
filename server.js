import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI, { toStreamingFile } from 'openai';
import { handleUpload, get, del } from '@vercel/blob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const upload = multer({ dest:'/tmp/ai-ho-so-uploads', limits:{fileSize:50*1024*1024} });

app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'public')));

function client(){ return process.env.OPENAI_API_KEY ? new OpenAI({apiKey:process.env.OPENAI_API_KEY}) : null; }
function store(){ return process.env.OPENAI_VECTOR_STORE_ID?.trim() || ''; }
function blobConfigured(){ return !!process.env.BLOB_READ_WRITE_TOKEN; }

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

app.post('/api/blob/upload', async (req,res)=>{
  if(!blobConfigured()) return res.status(503).json({error:'Chưa có BLOB_READ_WRITE_TOKEN. Hãy tạo Vercel Blob Store cho project.'});
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
        maximumSizeInBytes:50*1024*1024,
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
  if(!blobConfigured()) return res.status(503).json({error:'Chưa có BLOB_READ_WRITE_TOKEN trên máy chủ.'});
  const {pathname,name,contentType}=req.body||{};
  if(!pathname||!name) return res.status(400).json({error:'Thiếu pathname hoặc tên file.'});
  try{
    const blob=await get(pathname,{access:'private'});
    if(!blob || blob.statusCode!==200) return res.status(404).json({error:'Không tìm thấy tài liệu tạm trong Blob.'});
    const streamFile=toStreamingFile(blob.stream,name,{type:contentType||blob.blob?.contentType||'application/octet-stream'});
    const up=await c.files.create({file:streamFile,purpose:'assistants'});
    const vsFile=await c.vectorStores.files.create(store(),{file_id:up.id});
    res.status(202).json({
      ok:true,
      name,
      fileId:up.id,
      vectorStoreFileId:vsFile.id,
      status:vsFile.status||'in_progress',
      message:'Đã chuyển tài liệu vào OpenAI. Hệ thống đang lập chỉ mục.'
    });
    // The source is now safely in OpenAI; remove the temporary Blob copy.
    try{ await del(pathname); }catch(cleanErr){ console.warn('blob cleanup warning',cleanErr.message); }
  }catch(e){
    console.error('training from blob error',e);
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
    const f=await c.vectorStores.files.retrieve(store(),req.params.fileId);
    res.json({ok:true,id:f.id,status:f.status,error:f.last_error||null});
  }catch(e){
    console.error('training status error',e);
    res.status(500).json({error:e.message});
  }
});

app.get(/.*/, (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
export default app;