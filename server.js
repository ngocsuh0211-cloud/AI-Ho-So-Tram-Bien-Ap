import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const upload = multer({ dest:'/tmp/ai-ho-so-uploads', limits:{fileSize:50*1024*1024} });

app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname,'public')));

function client(){ return process.env.OPENAI_API_KEY ? new OpenAI({apiKey:process.env.OPENAI_API_KEY}) : null; }
function store(){ return process.env.OPENAI_VECTOR_STORE_ID?.trim() || ''; }

app.get('/api/status', async (req,res)=>{
  const configured=!!process.env.OPENAI_API_KEY, id=store();
  if(!configured) return res.json({ok:true,configured:false,vectorStoreConfigured:!!id,model:MODEL});
  try{
    const c=client(); const vs=id?await c.vectorStores.retrieve(id):null;
    res.json({ok:true,configured:true,vectorStoreConfigured:!!id,model:MODEL,vectorStoreName:vs?.name||null});
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
  }catch(e){console.error(e);res.status(500).json({error:e.message});}
});

app.post('/api/training/upload',upload.array('files',20),async(req,res)=>{
  const c=client(); if(!c) return res.status(503).json({error:'Chưa cấu hình OPENAI_API_KEY trên máy chủ.'});
  if(!req.files?.length) return res.status(400).json({error:'Chưa chọn file.'});
  if(!store()) return res.status(503).json({error:'Chưa cấu hình OPENAI_VECTOR_STORE_ID trên máy chủ.'});
  try{
    const results=[];
    for(const f of req.files){
      try{
        const up=await c.files.create({file:fs.createReadStream(f.path),purpose:'assistants'});
        await c.vectorStores.files.createAndPoll(store(),{file_id:up.id});
        results.push({name:f.originalname,fileId:up.id,status:'Đã đưa vào kho kiến thức AI'});
      }finally{fs.rmSync(f.path,{force:true});}
    }
    res.json({ok:true,results});
  }catch(e){for(const f of req.files||[])fs.rmSync(f.path,{force:true});res.status(500).json({error:e.message});}
});

app.get(/.*/, (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
export default app;